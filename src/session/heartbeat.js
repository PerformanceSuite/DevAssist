/**
 * Session Heartbeat for Long Sprints
 * Keeps DevAssist engaged during extended coding sessions
 */

export class SessionHeartbeat {
  constructor(sessionManager, interval = 5 * 60 * 1000) { // 5 minutes default
    this.sessionManager = sessionManager;
    this.interval = interval;
    this.timer = null;
    this.lastActivity = Date.now();
    this.reminders = [
      '💭 Remember to commit your changes regularly',
      '☕ Good time for a quick break?',
      '📝 Consider documenting what you just built',
      '🧪 Have you tested the recent changes?',
      '🔍 Any duplicate code to refactor?',
      '💡 Is there a decision worth recording?',
      '🎯 Still aligned with the sprint goals?',
      '📊 Want me to check project status?'
    ];
  }

  start() {
    if (this.timer) return;
    
    console.error('[HEARTBEAT] Starting session heartbeat...');
    
    this.timer = setInterval(() => {
      this.pulse();
    }, this.interval);
    
    // Also set up activity tracking
    this.lastActivity = Date.now();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.error('[HEARTBEAT] Session heartbeat stopped');
    }
  }

  pulse() {
    const now = Date.now();
    const timeSinceActivity = now - this.lastActivity;
    
    // If more than 15 minutes of inactivity, send a gentle reminder
    if (timeSinceActivity > 15 * 60 * 1000) {
      this.sendReminder();
    }
    
    // Keep session warm
    if (this.sessionManager && this.sessionManager.currentSession) {
      this.sessionManager.addKnowledge({
        type: 'heartbeat',
        timestamp: new Date().toISOString(),
        status: 'active'
      });
    }
  }

  sendReminder() {
    const reminder = this.reminders[Math.floor(Math.random() * this.reminders.length)];
    console.error(`[DEVASSIST] ${reminder}`);
    
    // Reset activity timer
    this.lastActivity = Date.now();
  }

  recordActivity() {
    this.lastActivity = Date.now();
  }
}

export function createSessionHeartbeat(sessionManager, interval) {
  return new SessionHeartbeat(sessionManager, interval);
}