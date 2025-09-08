/**
 * Terminal Logger for DevAssist Sessions
 * Captures terminal output for context during warmup
 */

import fs from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';

export class TerminalLogger {
  constructor(projectPath, sessionId) {
    this.projectPath = projectPath;
    this.sessionId = sessionId;
    this.logPath = path.join(projectPath, '.devassist', 'logs', `terminal-${sessionId}.log`);
    this.scriptPath = null;
    this.isLogging = false;
    this.platform = os.platform();
  }

  /**
   * Start terminal logging based on platform
   */
  async startLogging() {
    // Ensure log directory exists
    await fs.mkdir(path.dirname(this.logPath), { recursive: true });

    if (this.platform === 'darwin') {
      await this.startMacOSLogging();
    } else if (this.platform === 'linux') {
      await this.startLinuxLogging();
    } else if (this.platform === 'win32') {
      await this.startWindowsLogging();
    }

    this.isLogging = true;
    console.error(`[TerminalLogger] Started logging to ${this.logPath}`);
  }

  /**
   * macOS terminal logging using script command
   */
  async startMacOSLogging() {
    // Create a shell script that will log the session
    this.scriptPath = path.join(this.projectPath, '.devassist', 'logs', `session-${this.sessionId}.sh`);
    
    const scriptContent = `#!/bin/bash
# DevAssist Terminal Logger for Session ${this.sessionId}

# Start logging with script command
export DEVASSIST_SESSION="${this.sessionId}"
export PS1="[DevAssist] \\w $ "

# Use script to log all terminal output
script -q "${this.logPath}" bash --init-file <(echo '
  echo "📝 DevAssist terminal logging started for session ${this.sessionId}"
  echo "All commands and output will be captured for context"
  echo "---"
  
  # Source user bashrc if exists
  [ -f ~/.bashrc ] && source ~/.bashrc
  [ -f ~/.zshrc ] && source ~/.zshrc 2>/dev/null
  
  # Add timestamp to commands
  export PROMPT_COMMAND="echo -n [\$(date +%H:%M:%S)] "
')

echo "📝 Terminal logging ended for session ${this.sessionId}"
`;

    await fs.writeFile(this.scriptPath, scriptContent, { mode: 0o755 });
    
    // Also create a simpler background logger
    await this.createBackgroundLogger();
  }

  /**
   * Linux terminal logging using script command
   */
  async startLinuxLogging() {
    this.scriptPath = path.join(this.projectPath, '.devassist', 'logs', `session-${this.sessionId}.sh`);
    
    const scriptContent = `#!/bin/bash
# DevAssist Terminal Logger for Session ${this.sessionId}

# Start logging with script command (Linux version)
export DEVASSIST_SESSION="${this.sessionId}"

# Linux script command has different syntax
script -q -f "${this.logPath}" -c "bash -l"
`;

    await fs.writeFile(this.scriptPath, scriptContent, { mode: 0o755 });
    await this.createBackgroundLogger();
  }

  /**
   * Windows terminal logging using PowerShell
   */
  async startWindowsLogging() {
    this.scriptPath = path.join(this.projectPath, '.devassist', 'logs', `session-${this.sessionId}.ps1`);
    
    const scriptContent = `# DevAssist Terminal Logger for Session ${this.sessionId}
$ErrorActionPreference = "Continue"

# Start transcript
Start-Transcript -Path "${this.logPath}" -Append

Write-Host "📝 DevAssist terminal logging started for session ${this.sessionId}"
Write-Host "All commands and output will be captured for context"
Write-Host "---"

# Keep PowerShell session open
$Host.UI.RawUI.WindowTitle = "DevAssist Session ${this.sessionId}"
`;

    await fs.writeFile(this.scriptPath, scriptContent);
  }

  /**
   * Create a background logger that captures command history
   */
  async createBackgroundLogger() {
    // This runs independently to capture command history
    const historyLogger = `#!/bin/bash
# Background command history logger

while true; do
  # Capture bash history
  if [ -f ~/.bash_history ]; then
    tail -n 50 ~/.bash_history > "${this.logPath}.history"
  fi
  
  # Capture zsh history if available
  if [ -f ~/.zsh_history ]; then
    tail -n 50 ~/.zsh_history >> "${this.logPath}.history"
  fi
  
  # Also capture current directory and git status
  echo "PWD: $(pwd)" >> "${this.logPath}.context"
  echo "Git: $(git status --short 2>/dev/null)" >> "${this.logPath}.context"
  
  sleep 60  # Update every minute
done &

echo $! > "${this.logPath}.pid"
`;

    const bgLoggerPath = path.join(this.projectPath, '.devassist', 'logs', `bg-logger-${this.sessionId}.sh`);
    await fs.writeFile(bgLoggerPath, historyLogger, { mode: 0o755 });
    
    // Start background logger
    spawn('bash', [bgLoggerPath], { 
      detached: true, 
      stdio: 'ignore',
      cwd: this.projectPath 
    }).unref();
  }

  /**
   * Stop terminal logging
   */
  async stopLogging() {
    if (!this.isLogging) return;

    // Kill background logger if running
    try {
      const pidFile = `${this.logPath}.pid`;
      if (await this.fileExists(pidFile)) {
        const pid = await fs.readFile(pidFile, 'utf8');
        process.kill(parseInt(pid.trim()), 'SIGTERM');
        await fs.unlink(pidFile);
      }
    } catch (error) {
      // Process might already be dead
    }

    this.isLogging = false;
    console.error(`[TerminalLogger] Stopped logging`);
  }

  /**
   * Read recent terminal logs for warmup
   */
  async getRecentLogs(lines = 100) {
    try {
      const logContent = await fs.readFile(this.logPath, 'utf8');
      const logLines = logContent.split('\n');
      const recentLines = logLines.slice(-lines);
      
      // Parse for important information
      const commands = recentLines.filter(line => 
        line.includes('$') || 
        line.includes('#') ||
        line.match(/^\[[\d:]+\]/)  // Timestamp pattern
      );

      const errors = recentLines.filter(line => 
        line.toLowerCase().includes('error') ||
        line.toLowerCase().includes('failed') ||
        line.toLowerCase().includes('exception')
      );

      const gitCommands = recentLines.filter(line => 
        line.includes('git ')
      );

      return {
        totalLines: logLines.length,
        recentCommands: commands.slice(-20),
        recentErrors: errors.slice(-10),
        gitActivity: gitCommands.slice(-10),
        rawLogs: recentLines
      };
    } catch (error) {
      return {
        totalLines: 0,
        recentCommands: [],
        recentErrors: [],
        gitActivity: [],
        rawLogs: [],
        error: error.message
      };
    }
  }

  /**
   * Get command history from shell history files
   */
  async getCommandHistory() {
    const history = [];
    
    try {
      // Try bash history
      const bashHistory = path.join(os.homedir(), '.bash_history');
      if (await this.fileExists(bashHistory)) {
        const content = await fs.readFile(bashHistory, 'utf8');
        const lines = content.split('\n').slice(-50);
        history.push(...lines.map(cmd => ({ shell: 'bash', command: cmd })));
      }
    } catch {}

    try {
      // Try zsh history
      const zshHistory = path.join(os.homedir(), '.zsh_history');
      if (await this.fileExists(zshHistory)) {
        const content = await fs.readFile(zshHistory, 'utf8');
        // zsh history format includes timestamps
        const lines = content.split('\n').slice(-50);
        const commands = lines.map(line => {
          // Remove zsh timestamp prefix if present
          const match = line.match(/^: \d+:\d+;(.*)$/);
          return { shell: 'zsh', command: match ? match[1] : line };
        });
        history.push(...commands);
      }
    } catch {}

    return history;
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export default TerminalLogger;