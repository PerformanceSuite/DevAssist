/**
 * Session Persistence Module for DevAssist
 * Provides knowledge continuity between Claude sessions
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { generateEmbedding } from '../database/dataAccess.js';

export class SessionManager {
  constructor(projectName, paths) {
    this.projectName = projectName;
    this.paths = paths;
    this.sessionPath = path.join(
      paths.projectPath,
      '.sessions'
    );
    this.currentSession = null;
    this.db = null;
  }

  /**
   * Initialize session manager with database
   */
  initialize(db) {
    this.db = db;
    return this;
  }

  /**
   * Start a new session
   */
  async startSession(metadata = {}) {
    const sessionId = `session_${Date.now()}`;
    
    // Load previous session context
    const previousContext = await this.loadPreviousSession();
    
    // Create new session
    this.currentSession = {
      id: sessionId,
      project: this.projectName,
      started_at: new Date().toISOString(),
      previous_session: previousContext?.session?.id || null,
      context_loaded: previousContext !== null,
      metadata: {
        ...metadata,
        git_branch: await this.getGitBranch(),
        terminal_log: path.join(this.paths.projectPath, '.devassist/terminal_logs', `${sessionId}.log`)
      },
      knowledge: [],
      decisions: [],
      checkpoints: []
    };
    
    // Store in database
    if (this.db) {
      const stmt = this.db.prepare(`
        INSERT INTO sessions (id, project_name, started_at, git_branch, metadata)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        sessionId,
        this.projectName,
        this.currentSession.started_at,
        this.currentSession.metadata.git_branch,
        JSON.stringify(this.currentSession.metadata)
      );
    }
    
    // Save to file
    this.saveSessionFile();
    
    return {
      session: this.currentSession,
      previousContext
    };
  }

  /**
   * Load the most recent previous session
   */
  async loadPreviousSession() {
    try {
      // Find most recent session from database
      if (this.db) {
        const stmt = this.db.prepare(`
          SELECT * FROM sessions 
          WHERE project_name = ? AND ended_at IS NOT NULL
          ORDER BY ended_at DESC
          LIMIT 1
        `);
        
        const lastSession = stmt.get(this.projectName);
        
        if (lastSession) {
          // Load associated knowledge
          const knowledge = await this.loadSessionKnowledge(lastSession.id);
          
          // Load terminal logs if they exist
          let terminalContext = null;
          if (lastSession.terminal_log && existsSync(lastSession.terminal_log)) {
            terminalContext = await this.extractTerminalContext(lastSession.terminal_log);
          }
          
          // Generate context summary
          const contextSummary = await this.generateContextSummary({
            session: lastSession,
            knowledge,
            terminalContext
          });
          
          return {
            session: lastSession,
            knowledge,
            terminalContext,
            summary: contextSummary
          };
        }
      }
      
      // Fallback to file-based search
      const sessionFiles = this.findSessionFiles();
      if (sessionFiles.length > 0) {
        const lastFile = sessionFiles[0];
        const content = JSON.parse(readFileSync(lastFile, 'utf-8'));
        return {
          session: content,
          knowledge: content.knowledge || [],
          summary: content.summary || 'Previous session loaded from file'
        };
      }
    } catch (error) {
      console.error('Error loading previous session:', error);
    }
    
    return null;
  }

  /**
   * Load knowledge associated with a session
   */
  async loadSessionKnowledge(sessionId) {
    const knowledge = [];
    
    if (this.db) {
      // Load decisions from this session
      const decisionsStmt = this.db.prepare(`
        SELECT * FROM decisions 
        WHERE project_name = ? AND session_id = ?
        ORDER BY timestamp DESC
      `);
      
      const decisions = decisionsStmt.all(this.projectName, sessionId);
      knowledge.push(...decisions.map(d => ({
        type: 'decision',
        content: d.decision,
        context: d.context,
        timestamp: d.timestamp
      })));
      
      // Load progress updates
      const progressStmt = this.db.prepare(`
        SELECT * FROM progress 
        WHERE project_name = ? AND session_id = ?
        ORDER BY updated_at DESC
      `);
      
      const progress = progressStmt.all(this.projectName, sessionId);
      knowledge.push(...progress.map(p => ({
        type: 'progress',
        milestone: p.milestone,
        status: p.status,
        notes: p.notes,
        timestamp: p.updated_at
      })));
    }
    
    return knowledge;
  }

  /**
   * Save a checkpoint during the session
   */
  async checkpoint(summary, metadata = {}) {
    if (!this.currentSession) {
      throw new Error('No active session');
    }
    
    const checkpoint = {
      timestamp: new Date().toISOString(),
      summary,
      metadata,
      git_status: await this.getGitStatus(),
      knowledge_count: this.currentSession.knowledge.length,
      decisions_count: this.currentSession.decisions.length
    };
    
    this.currentSession.checkpoints.push(checkpoint);
    
    // Save to file
    this.saveSessionFile();
    
    // Save checkpoint file
    const checkpointPath = path.join(
      this.sessionPath,
      `checkpoint_${Date.now()}.json`
    );
    
    writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
    
    return checkpoint;
  }

  /**
   * End the current session
   */
  async endSession() {
    if (!this.currentSession) {
      throw new Error('No active session');
    }
    
    const endTime = new Date().toISOString();
    
    // Update session
    this.currentSession.ended_at = endTime;
    this.currentSession.duration = this.calculateDuration(
      this.currentSession.started_at,
      endTime
    );
    
    // Generate session summary
    this.currentSession.summary = await this.generateSessionSummary();
    
    // Update database
    if (this.db) {
      const stmt = this.db.prepare(`
        UPDATE sessions 
        SET ended_at = ?, 
            knowledge_items = ?,
            decisions_made = ?,
            metadata = ?
        WHERE id = ?
      `);
      
      stmt.run(
        endTime,
        this.currentSession.knowledge.length,
        this.currentSession.decisions.length,
        JSON.stringify(this.currentSession.metadata),
        this.currentSession.id
      );
    }
    
    // Process terminal logs if they exist
    if (this.currentSession.metadata.terminal_log && 
        existsSync(this.currentSession.metadata.terminal_log)) {
      await this.processTerminalLog(this.currentSession.metadata.terminal_log);
    }
    
    // Save final session file
    const finalPath = path.join(
      this.sessionPath,
      `${this.currentSession.id}.json`
    );
    
    writeFileSync(finalPath, JSON.stringify(this.currentSession, null, 2));
    
    // Clear current session
    const summary = this.currentSession.summary;
    this.currentSession = null;
    
    // Remove current.json
    const currentPath = path.join(this.sessionPath, 'current.json');
    if (existsSync(currentPath)) {
      require('fs').unlinkSync(currentPath);
    }
    
    return summary;
  }

  /**
   * Add knowledge item to current session
   */
  addKnowledge(item) {
    if (!this.currentSession) {
      throw new Error('No active session');
    }
    
    this.currentSession.knowledge.push({
      ...item,
      timestamp: new Date().toISOString()
    });
    
    this.saveSessionFile();
  }

  /**
   * Add decision to current session
   */
  addDecision(decision) {
    if (!this.currentSession) {
      throw new Error('No active session');
    }
    
    this.currentSession.decisions.push({
      ...decision,
      timestamp: new Date().toISOString()
    });
    
    this.saveSessionFile();
  }

  /**
   * Bridge sessions for continuity
   */
  async bridgeSessions(fromSessionId, toSessionId) {
    const bridge = {
      from: fromSessionId,
      to: toSessionId,
      timestamp: new Date().toISOString(),
      context: await this.extractBridgeContext(fromSessionId, toSessionId)
    };
    
    // Store bridge in database
    if (this.db) {
      // Could add a session_bridges table if needed
      // console.log('Session bridge created:', bridge);
    }
    
    return bridge;
  }

  /**
   * Extract context from terminal logs
   */
  async extractTerminalContext(logPath) {
    try {
      const content = readFileSync(logPath, 'utf-8');
      
      return {
        commands: this.extractCommands(content),
        errors: this.extractErrors(content),
        gitOperations: this.extractGitOps(content),
        summary: this.summarizeTerminalActivity(content)
      };
    } catch (error) {
      console.error('Error extracting terminal context:', error);
      return null;
    }
  }

  /**
   * Process terminal log for knowledge extraction
   */
  async processTerminalLog(logPath) {
    const context = await this.extractTerminalContext(logPath);
    
    if (context && this.currentSession) {
      // Add extracted knowledge
      this.addKnowledge({
        type: 'terminal_activity',
        commands_count: context.commands.length,
        errors_found: context.errors.length,
        git_operations: context.gitOperations.length,
        summary: context.summary
      });
    }
    
    return context;
  }

  // Helper methods

  saveSessionFile() {
    if (!this.currentSession) return;
    
    const currentPath = path.join(this.sessionPath, 'current.json');
    writeFileSync(currentPath, JSON.stringify(this.currentSession, null, 2));
  }

  findSessionFiles() {
    if (!existsSync(this.sessionPath)) return [];
    
    return readdirSync(this.sessionPath)
      .filter(f => f.startsWith('session_') && f.endsWith('.json'))
      .map(f => path.join(this.sessionPath, f))
      .sort((a, b) => b.localeCompare(a));
  }

  async getGitBranch() {
    try {
      const { execSync } = require('child_process');
      return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
    } catch {
      return 'none';
    }
  }

  async getGitStatus() {
    try {
      const { execSync } = require('child_process');
      return execSync('git status --short', { encoding: 'utf-8' }).trim();
    } catch {
      return '';
    }
  }

  calculateDuration(start, end) {
    const ms = new Date(end) - new Date(start);
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }

  extractCommands(content) {
    const commands = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('$ ') || line.startsWith('> ')) {
        commands.push(line.substring(2).trim());
      }
    }
    
    return commands;
  }

  extractErrors(content) {
    const errors = [];
    const errorPatterns = [
      /error:/gi,
      /exception:/gi,
      /failed/gi,
      /cannot find/gi,
      /undefined/gi
    ];
    
    const lines = content.split('\n');
    for (const line of lines) {
      for (const pattern of errorPatterns) {
        if (pattern.test(line)) {
          errors.push(line.trim());
          break;
        }
      }
    }
    
    return errors;
  }

  extractGitOps(content) {
    const gitOps = [];
    const gitPattern = /git\s+(add|commit|push|pull|merge|checkout|branch|status|diff|log)/gi;
    
    const matches = content.match(gitPattern);
    if (matches) {
      gitOps.push(...matches);
    }
    
    return gitOps;
  }

  summarizeTerminalActivity(content) {
    const commands = this.extractCommands(content);
    const errors = this.extractErrors(content);
    const gitOps = this.extractGitOps(content);
    
    return `Activity: ${commands.length} commands, ${errors.length} errors, ${gitOps.length} git operations`;
  }

  async generateContextSummary(context) {
    const parts = [];
    
    if (context.session) {
      parts.push(`Previous session: ${context.session.id}`);
      parts.push(`Duration: ${context.session.duration || 'unknown'}`);
    }
    
    if (context.knowledge && context.knowledge.length > 0) {
      parts.push(`Knowledge items: ${context.knowledge.length}`);
    }
    
    if (context.terminalContext) {
      parts.push(context.terminalContext.summary);
    }
    
    return parts.join(', ');
  }

  async generateSessionSummary() {
    const parts = [];
    
    parts.push(`Session: ${this.currentSession.id}`);
    parts.push(`Duration: ${this.currentSession.duration}`);
    parts.push(`Knowledge items: ${this.currentSession.knowledge.length}`);
    parts.push(`Decisions: ${this.currentSession.decisions.length}`);
    parts.push(`Checkpoints: ${this.currentSession.checkpoints.length}`);
    
    return parts.join(', ');
  }

  async extractBridgeContext(fromId, toId) {
    // Extract key information to bridge between sessions
    return {
      from: fromId,
      to: toId,
      timestamp: new Date().toISOString(),
      knowledge_preserved: true
    };
  }

  /**
   * Get current session status
   */
  getStatus() {
    if (!this.currentSession) {
      return {
        active: false,
        message: 'No active session'
      };
    }
    
    return {
      active: true,
      session: this.currentSession.id,
      started: this.currentSession.started_at,
      knowledge: this.currentSession.knowledge.length,
      decisions: this.currentSession.decisions.length,
      checkpoints: this.currentSession.checkpoints.length
    };
  }
}

// Export singleton for easy use
let sessionManagerInstance = null;

export function getSessionManager(projectName, paths, db) {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager(projectName, paths);
    if (db) {
      sessionManagerInstance.initialize(db);
    }
  }
  return sessionManagerInstance;
}
