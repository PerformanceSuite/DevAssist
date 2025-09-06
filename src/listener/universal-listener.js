#!/usr/bin/env node

/**
 * DevAssist Universal Listener
 * Monitors multiple sources for development decisions and insights
 * 
 * Features:
 * - Git commit monitoring
 * - File system watching for AI tools
 * - IDE integration bridge
 * - Browser extension WebSocket server
 * - Claude Code output parsing
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import chokidar from 'chokidar';
import { WebSocketServer } from 'ws';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import axios from 'axios';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

// Configuration
const CONFIG_PATH = path.join(process.env.HOME, '.devassist', 'listener-config.yaml');
const API_BASE = 'http://localhost:3456/api';
const WS_PORT = 9876;

// Event emitter for internal communication
class ListenerHub extends EventEmitter {
  constructor() {
    super();
    this.sources = new Map();
    this.config = null;
    this.stats = {
      decisions: 0,
      patterns: 0,
      commits: 0,
      aiOutputs: 0,
      errors: 0,
      startTime: Date.now()
    };
  }

  async initialize() {
    // console.log('🚀 DevAssist Universal Listener starting...');
    await this.loadConfig();
    await this.setupListeners();
    this.startHeartbeat();
    // console.log('✅ All listeners active');
  }

  async loadConfig() {
    try {
      const configContent = await fs.readFile(CONFIG_PATH, 'utf8');
      this.config = yaml.load(configContent);
    } catch (error) {
      // console.log('📝 No config found, using defaults');
      this.config = this.getDefaultConfig();
      await this.saveConfig();
    }
  }

  getDefaultConfig() {
    return {
      listeners: {
        git: {
          enabled: true,
          patterns: [
            'decision:',
            'architecture:',
            'chose:',
            'decided to',
            'refactored to'
          ]
        },
        claude_code: {
          enabled: true,
          watch_path: path.join(process.env.HOME, '.claude-code')
        },
        cursor: {
          enabled: true,
          watch_path: path.join(process.env.HOME, '.cursor')
        },
        vscode: {
          enabled: false,
          extension_id: 'devassist.vscode'
        },
        browser: {
          enabled: true,
          port: WS_PORT
        },
        file_watchers: [
          {
            path: '**/*.decisions.md',
            format: 'markdown',
            enabled: true
          },
          {
            path: '**/ADR-*.md',
            format: 'adr',
            enabled: true
          },
          {
            path: '**/.ai-chat/**',
            format: 'ai-chat',
            enabled: true
          }
        ]
      },
      auto_project_detection: {
        enabled: true,
        use_git_root: true,
        use_package_json: true
      },
      semantic_triggers: [
        'decided to',
        'choosing',
        'will use',
        'implemented',
        'refactored to',
        'switched from',
        'migrated to',
        'integrated with',
        'selected',
        'opted for'
      ]
    };
  }

  async saveConfig() {
    const configDir = path.dirname(CONFIG_PATH);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(CONFIG_PATH, yaml.dump(this.config), 'utf8');
  }

  async setupListeners() {
    // 1. Git Commit Listener
    if (this.config.listeners.git.enabled) {
      await this.setupGitListener();
    }

    // 2. Claude Code Listener
    if (this.config.listeners.claude_code.enabled) {
      await this.setupClaudeCodeListener();
    }

    // 3. Cursor Listener
    if (this.config.listeners.cursor.enabled) {
      await this.setupCursorListener();
    }

    // 4. File Watchers
    await this.setupFileWatchers();

    // 5. Browser Extension Bridge
    if (this.config.listeners.browser.enabled) {
      await this.setupBrowserBridge();
    }
  }

  async setupGitListener() {
    // console.log('🔍 Setting up Git listener...');
    
    // Install git hooks in current project
    const gitHookPath = '.git/hooks/post-commit';
    const hookContent = `#!/bin/bash
# DevAssist Git Hook
COMMIT_MSG=$(git log -1 --pretty=%B)
PROJECT=$(basename $(git rev-parse --show-toplevel))

curl -X POST ${API_BASE}/decisions \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"decision\\": \\"$COMMIT_MSG\\",
    \\"context\\": \\"Git commit\\",
    \\"project\\": \\"$PROJECT\\",
    \\"source\\": \\"git\\"
  }" 2>/dev/null || true
`;

    try {
      await fs.writeFile(gitHookPath, hookContent, { mode: 0o755 });
      // console.log('✅ Git hook installed');
    } catch (error) {
      // console.log('⚠️ Could not install git hook:', error.message);
    }

    // Monitor git commands globally
    this.monitorGitCommands();
  }

  monitorGitCommands() {
    // Watch for git commands using fs events on .git directories
    const projectsPath = '/Users/danielconnolly/Projects';
    
    const watcher = chokidar.watch(`${projectsPath}/**/.git/COMMIT_EDITMSG`, {
      ignored: /node_modules/,
      persistent: true,
      depth: 5
    });

    watcher.on('change', async (filepath) => {
      try {
        const commitMsg = await fs.readFile(filepath, 'utf8');
        const projectPath = path.dirname(path.dirname(filepath));
        const projectName = path.basename(projectPath);
        
        // Check if commit message contains decision patterns
        const hasDecision = this.config.listeners.git.patterns.some(pattern => 
          commitMsg.toLowerCase().includes(pattern.toLowerCase())
        );

        if (hasDecision) {
          await this.recordDecision({
            decision: commitMsg.trim(),
            context: 'Git commit message',
            project: projectName,
            source: 'git'
          });
          this.stats.commits++;
        }
      } catch (error) {
        console.error('Error processing git commit:', error);
        this.stats.errors++;
      }
    });

    this.sources.set('git', watcher);
  }

  async setupClaudeCodeListener() {
    // console.log('🤖 Setting up Claude Code listener...');
    
    const claudeCodePath = this.config.listeners.claude_code.watch_path;
    
    // Create directory if it doesn't exist
    await fs.mkdir(claudeCodePath, { recursive: true });
    
    const watcher = chokidar.watch(`${claudeCodePath}/**/*`, {
      ignored: /node_modules/,
      persistent: true,
      ignoreInitial: true
    });

    watcher.on('add', async (filepath) => {
      await this.processAIFile(filepath, 'claude-code');
    });

    watcher.on('change', async (filepath) => {
      await this.processAIFile(filepath, 'claude-code');
    });

    this.sources.set('claude-code', watcher);
  }

  async setupCursorListener() {
    // console.log('💻 Setting up Cursor listener...');
    
    const cursorPath = this.config.listeners.cursor.watch_path;
    
    const watcher = chokidar.watch([
      `${cursorPath}/**/*.md`,
      `${cursorPath}/**/*.json`,
      `${cursorPath}/**/chat-*.txt`
    ], {
      ignored: /node_modules/,
      persistent: true,
      ignoreInitial: true
    });

    watcher.on('add', async (filepath) => {
      await this.processAIFile(filepath, 'cursor');
    });

    watcher.on('change', async (filepath) => {
      await this.processAIFile(filepath, 'cursor');
    });

    this.sources.set('cursor', watcher);
  }

  async setupFileWatchers() {
    // console.log('📁 Setting up file watchers...');
    
    for (const watcherConfig of this.config.listeners.file_watchers) {
      if (!watcherConfig.enabled) continue;
      
      const watcher = chokidar.watch(watcherConfig.path, {
        ignored: /node_modules/,
        persistent: true,
        ignoreInitial: true,
        cwd: '/Users/danielconnolly/Projects'
      });

      watcher.on('add', async (filepath) => {
        await this.processWatchedFile(filepath, watcherConfig.format);
      });

      watcher.on('change', async (filepath) => {
        await this.processWatchedFile(filepath, watcherConfig.format);
      });

      this.sources.set(`file-${watcherConfig.format}`, watcher);
    }
  }

  async setupBrowserBridge() {
    // console.log('🌐 Setting up browser bridge...');
    
    const wss = new WebSocketServer({ port: this.config.listeners.browser.port });
    
    wss.on('connection', (ws) => {
      // console.log('Browser extension connected');
      
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'DECISION') {
            await this.recordDecision({
              ...message.data,
              source: message.source || 'browser'
            });
          } else if (message.type === 'PATTERN') {
            await this.recordPattern({
              ...message.data,
              source: message.source || 'browser'
            });
          }
        } catch (error) {
          console.error('Error processing browser message:', error);
          this.stats.errors++;
        }
      });
    });

    this.sources.set('browser-bridge', wss);
    // console.log(`✅ WebSocket server running on ws://localhost:${this.config.listeners.browser.port}`);
  }

  async processAIFile(filepath, source) {
    try {
      const content = await fs.readFile(filepath, 'utf8');
      const decisions = this.extractDecisions(content);
      
      for (const decision of decisions) {
        await this.recordDecision({
          ...decision,
          source,
          filepath
        });
      }
      
      this.stats.aiOutputs++;
    } catch (error) {
      console.error(`Error processing ${source} file:`, error);
      this.stats.errors++;
    }
  }

  async processWatchedFile(filepath, format) {
    try {
      const fullPath = path.join('/Users/danielconnolly/Projects', filepath);
      const content = await fs.readFile(fullPath, 'utf8');
      
      if (format === 'adr') {
        // Architecture Decision Record format
        const adrData = this.parseADR(content);
        if (adrData) {
          await this.recordDecision({
            ...adrData,
            source: 'adr',
            filepath: fullPath
          });
        }
      } else if (format === 'markdown') {
        // Generic markdown with decisions
        const decisions = this.extractDecisions(content);
        for (const decision of decisions) {
          await this.recordDecision({
            ...decision,
            source: 'markdown',
            filepath: fullPath
          });
        }
      }
    } catch (error) {
      console.error(`Error processing watched file:`, error);
      this.stats.errors++;
    }
  }

  extractDecisions(content) {
    const decisions = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for semantic triggers
      for (const trigger of this.config.semantic_triggers) {
        if (line.toLowerCase().includes(trigger)) {
          // Extract context (current line + surrounding lines)
          const context = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3)).join('\n');
          
          decisions.push({
            decision: line.trim(),
            context: context.trim(),
            project: this.detectProject()
          });
        }
      }
    }
    
    return decisions;
  }

  parseADR(content) {
    // Parse Architecture Decision Record format
    const titleMatch = content.match(/^#\s+(.+)/m);
    const statusMatch = content.match(/## Status\n\n(.+)/);
    const contextMatch = content.match(/## Context\n\n([\s\S]+?)(?=\n##|$)/);
    const decisionMatch = content.match(/## Decision\n\n([\s\S]+?)(?=\n##|$)/);
    const consequencesMatch = content.match(/## Consequences\n\n([\s\S]+?)(?=\n##|$)/);
    
    if (titleMatch && decisionMatch) {
      return {
        decision: titleMatch[1],
        context: contextMatch ? contextMatch[1].trim() : '',
        impact: consequencesMatch ? consequencesMatch[1].trim() : '',
        status: statusMatch ? statusMatch[1].trim() : 'accepted',
        project: this.detectProject()
      };
    }
    
    return null;
  }

  detectProject() {
    // Auto-detect current project
    if (!this.config.auto_project_detection.enabled) {
      return 'default';
    }
    
    try {
      // Try git root
      if (this.config.auto_project_detection.use_git_root) {
        const { stdout } = execAsync('git rev-parse --show-toplevel 2>/dev/null');
        if (stdout) {
          return path.basename(stdout.trim());
        }
      }
      
      // Try package.json
      if (this.config.auto_project_detection.use_package_json) {
        const packagePath = path.join(process.cwd(), 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        if (packageJson.name) {
          return packageJson.name;
        }
      }
    } catch (error) {
      // Fallback to current directory name
      return path.basename(process.cwd());
    }
    
    return 'default';
  }

  async recordDecision(data) {
    try {
      const response = await axios.post(`${API_BASE}/decisions`, {
        decision: data.decision,
        context: data.context || '',
        alternatives: data.alternatives || [],
        impact: data.impact || '',
        project: data.project || 'default',
        metadata: {
          source: data.source,
          filepath: data.filepath,
          timestamp: new Date().toISOString()
        }
      });
      
      this.stats.decisions++;
      // console.log(`✅ Decision recorded from ${data.source}: "${data.decision.substring(0, 50)}..."`);
      
      return response.data;
    } catch (error) {
      console.error('Error recording decision:', error.message);
      this.stats.errors++;
    }
  }

  async recordPattern(data) {
    try {
      const response = await axios.post(`${API_BASE}/patterns`, {
        filePath: data.filepath,
        content: data.content,
        language: data.language || 'unknown',
        project: data.project || 'default'
      });
      
      this.stats.patterns++;
      // console.log(`✅ Pattern recorded from ${data.source}`);
      
      return response.data;
    } catch (error) {
      console.error('Error recording pattern:', error.message);
      this.stats.errors++;
    }
  }

  startHeartbeat() {
    // Regular status updates
    setInterval(() => {
      const uptime = Math.floor((Date.now() - this.stats.startTime) / 1000);
      // console.log(`
📊 DevAssist Listener Status
  Uptime: ${Math.floor(uptime / 60)}m ${uptime % 60}s
  Decisions: ${this.stats.decisions}
  Patterns: ${this.stats.patterns}
  Commits: ${this.stats.commits}
  AI Outputs: ${this.stats.aiOutputs}
  Errors: ${this.stats.errors}
  Active Sources: ${this.sources.size}
      `);
    }, 60000); // Every minute
  }

  async shutdown() {
    // console.log('🛑 Shutting down listeners...');
    
    for (const [name, source] of this.sources) {
      if (source.close) {
        await source.close();
      } else if (source.unwatch) {
        await source.unwatch();
      }
    }
    
    // console.log('Goodbye! 👋');
    process.exit(0);
  }
}

// Main execution
const listener = new ListenerHub();

// Handle shutdown gracefully
process.on('SIGINT', () => listener.shutdown());
process.on('SIGTERM', () => listener.shutdown());

// Start the listener
listener.initialize().catch(error => {
  console.error('Failed to start listener:', error);
  process.exit(1);
});
