/**
 * DevAssist Browser Extension - Content Script
 * Monitors AI chat interfaces for development decisions
 */

class AIConversationMonitor {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.decisions = [];
    this.observer = null;
    this.config = {
      wsUrl: 'ws://localhost:9876',
      triggers: [
        'decided to',
        'choosing',
        'will use',
        'implemented',
        'refactored to',
        'architecture',
        'selected',
        'opted for'
      ]
    };
    
    this.init();
  }

  init() {
    this.connectWebSocket();
    this.setupObserver();
    this.injectUI();
  }

  connectWebSocket() {
    try {
      this.ws = new WebSocket(this.config.wsUrl);
      
      this.ws.onopen = () => {
        this.isConnected = true;
        console.log('✅ DevAssist connected');
        this.updateUI('connected');
      };
      
      this.ws.onclose = () => {
        this.isConnected = false;
        console.log('❌ DevAssist disconnected');
        this.updateUI('disconnected');
        // Retry connection after 5 seconds
        setTimeout(() => this.connectWebSocket(), 5000);
      };
      
      this.ws.onerror = (error) => {
        console.error('DevAssist WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect to DevAssist:', error);
    }
  }

  setupObserver() {
    // Different selectors for different AI platforms
    const selectors = {
      'gemini.google.com': '.message-content',
      'chat.openai.com': '.markdown.prose',
      'claude.ai': '.prose',
      'bard.google.com': '.response-content',
      'poe.com': '.Message_content'
    };
    
    const hostname = window.location.hostname;
    const selector = selectors[hostname] || '.message-content';
    
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.processMessage(node);
            }
          });
        }
      });
    });
    
    // Start observing
    const targetNode = document.body;
    this.observer.observe(targetNode, {
      childList: true,
      subtree: true
    });
  }

  processMessage(node) {
    const text = node.textContent || '';
    
    // Check for decision triggers
    for (const trigger of this.config.triggers) {
      if (text.toLowerCase().includes(trigger)) {
        this.extractDecision(text, trigger);
        break;
      }
    }
  }

  extractDecision(text, trigger) {
    // Extract the sentence containing the trigger
    const sentences = text.split(/[.!?]+/);
    const decisionSentence = sentences.find(s => 
      s.toLowerCase().includes(trigger)
    );
    
    if (decisionSentence) {
      const decision = {
        decision: decisionSentence.trim(),
        context: text.substring(0, 500), // First 500 chars for context
        source: window.location.hostname,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        project: this.detectProject(text)
      };
      
      this.sendDecision(decision);
      this.decisions.push(decision);
      this.updateUI('decision_captured');
    }
  }

  detectProject(text) {
    // Try to detect project name from context
    const projectPatterns = [
      /project[:\s]+(\w+)/i,
      /working on[:\s]+(\w+)/i,
      /(\w+)\s+project/i,
      /repository[:\s]+(\w+)/i
    ];
    
    for (const pattern of projectPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].toLowerCase();
      }
    }
    
    return 'default';
  }

  sendDecision(decision) {
    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify({
        type: 'DECISION',
        data: decision,
        source: 'browser-extension'
      }));
    } else {
      // Store locally if not connected
      this.storeLocally(decision);
    }
  }

  storeLocally(decision) {
    chrome.storage.local.get(['pending_decisions'], (result) => {
      const pending = result.pending_decisions || [];
      pending.push(decision);
      chrome.storage.local.set({ pending_decisions: pending });
    });
  }

  injectUI() {
    // Create floating indicator with Proactiva styling
    const indicator = document.createElement('div');
    indicator.id = 'devassist-indicator';
    indicator.innerHTML = `
      <div class="devassist-badge">
        <span class="pro">DEV</span><span class="va">ASSIST</span>
        <span class="status-dot"></span>
      </div>
      <div class="devassist-stats">
        <div class="stat-item">
          <span class="stat-label">Captured</span>
          <span class="stat-value">0</span>
        </div>
      </div>
    `;
    
    document.body.appendChild(indicator);
  }

  updateUI(status) {
    const indicator = document.getElementById('devassist-indicator');
    if (!indicator) return;
    
    const statusDot = indicator.querySelector('.status-dot');
    const statValue = indicator.querySelector('.stat-value');
    
    switch (status) {
      case 'connected':
        statusDot.className = 'status-dot connected';
        break;
      case 'disconnected':
        statusDot.className = 'status-dot disconnected';
        break;
      case 'decision_captured':
        statValue.textContent = this.decisions.length;
        // Flash animation
        indicator.classList.add('flash');
        setTimeout(() => indicator.classList.remove('flash'), 500);
        break;
    }
  }
}

// Initialize monitor
const monitor = new AIConversationMonitor();

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'get_stats') {
    sendResponse({
      decisions: monitor.decisions.length,
      connected: monitor.isConnected
    });
  }
});
