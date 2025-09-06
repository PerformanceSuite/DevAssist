#!/usr/bin/env node

/**
 * Enhanced Session Startup with Automatic Sprint Reporting and Agent Verification
 * This module ensures sessions start with actionable information, not questions
 */

import { createSubagentManager } from '../agents/subagent-manager.js';
import path from 'path';

export class SessionStartupEnhancer {
  constructor(sessionManager, databases, warmUpManager) {
    this.sessionManager = sessionManager;
    this.databases = databases;
    this.warmUpManager = warmUpManager;
  }

  /**
   * Start session with automatic sprint status and agent verification
   */
  async startEnhancedSession(description = 'Development session') {
    // 1. Start session with warm-up
    const sessionResult = await this.sessionManager.startSession({ description });
    const warmUpResult = await this.warmUpManager.performWarmUp(sessionResult.session.id);
    
    // 2. Verify and update subagents based on sprint needs
    const agentStatus = await this.verifyAndUpdateAgents();
    
    // 3. Automatically gather sprint status
    const sprintStatus = await this.gatherSprintStatus();
    
    // 4. Get git status
    const gitStatus = await this.getGitStatus();
    
    // 5. Generate actionable report
    const report = this.generateActionableReport(
      sessionResult,
      warmUpResult,
      sprintStatus,
      gitStatus,
      agentStatus
    );
    
    return report;
  }

  /**
   * Verify existing agents and create new ones based on sprint needs
   */
  async verifyAndUpdateAgents() {
    const projectPath = this.databases.paths.projectPath;
    const projectName = this.databases.projectName;
    
    const subagentManager = createSubagentManager(projectPath, projectName);
    const result = await subagentManager.verifyAndUpdateAgents();
    
    // Log new agents created
    if (result.created.length > 0) {
      console.error('[AGENTS] Created new agents for sprint:');
      result.created.forEach(agent => {
        console.error(`  🤖 ${agent.type}: ${agent.reason}`);
      });
    }
    
    return result;
  }

  /**
   * Gather current sprint status from DevAssist
   */
  async gatherSprintStatus() {
    const status = {
      inProgress: [],
      blocked: [],
      completed: [],
      notStarted: [],
      priorities: []
    };

    try {
      // Get all progress items
      const progressItems = await this.databases.sqlite.prepare(`
        SELECT milestone, status, notes, blockers, updated_at
        FROM progress 
        WHERE project_name = ?
        ORDER BY 
          CASE status 
            WHEN 'blocked' THEN 1
            WHEN 'in_progress' THEN 2
            WHEN 'not_started' THEN 3
            WHEN 'testing' THEN 4
            WHEN 'completed' THEN 5
          END,
          updated_at DESC
      `).all(this.databases.projectName);

      // Categorize items
      for (const item of progressItems) {
        const entry = {
          milestone: item.milestone,
          notes: item.notes,
          updated: new Date(item.updated_at).toLocaleDateString(),
          blockers: item.blockers ? JSON.parse(item.blockers) : []
        };

        switch(item.status) {
          case 'blocked':
            status.blocked.push(entry);
            break;
          case 'in_progress':
            status.inProgress.push(entry);
            break;
          case 'completed':
            status.completed.push(entry);
            break;
          case 'not_started':
            status.notStarted.push(entry);
            break;
        }
      }

      // Determine priorities
      // 1. First priority: unblock blocked items
      if (status.blocked.length > 0) {
        status.priorities.push({
          type: 'UNBLOCK',
          items: status.blocked.slice(0, 3),
          action: 'Resolve blockers for these critical items'
        });
      }

      // 2. Second priority: continue in-progress work
      if (status.inProgress.length > 0) {
        status.priorities.push({
          type: 'CONTINUE',
          items: status.inProgress.slice(0, 3),
          action: 'Continue work on these active tasks'
        });
      }

      // 3. Third priority: start new work
      if (status.notStarted.length > 0) {
        status.priorities.push({
          type: 'START',
          items: status.notStarted.slice(0, 2),
          action: 'Consider starting these tasks'
        });
      }

    } catch (error) {
      console.error('Error gathering sprint status:', error);
    }

    return status;
  }

  /**
   * Get git status and recent commits
   */
  async getGitStatus() {
    const { execSync } = require('child_process');
    const status = {
      hasUncommittedChanges: false,
      modifiedFiles: [],
      recentCommits: [],
      branch: 'main'
    };

    try {
      // Get current branch
      status.branch = execSync('git branch --show-current', {
        cwd: this.databases.paths.projectPath,
        encoding: 'utf8'
      }).trim();

      // Get uncommitted changes
      const gitStatus = execSync('git status --short', {
        cwd: this.databases.paths.projectPath,
        encoding: 'utf8'
      }).trim();

      if (gitStatus) {
        status.hasUncommittedChanges = true;
        status.modifiedFiles = gitStatus
          .split('\n')
          .map(line => line.substring(3))
          .slice(0, 10);
      }

      // Get recent commits
      const commits = execSync('git log --oneline -5', {
        cwd: this.databases.paths.projectPath,
        encoding: 'utf8'
      }).trim().split('\n');

      status.recentCommits = commits.map(c => {
        const [hash, ...messageParts] = c.split(' ');
        return {
          hash: hash,
          message: messageParts.join(' ')
        };
      });

    } catch (error) {
      // Git commands might fail if not in a repo
    }

    return status;
  }

  /**
   * Generate actionable report instead of asking questions
   */
  generateActionableReport(sessionResult, warmUpResult, sprintStatus, gitStatus, agentStatus) {
    let report = `🚀 **Session Started Successfully**\n`;
    report += `Session ID: ${sessionResult.session.id}\n`;
    report += `Project: ${sessionResult.session.project}\n\n`;

    // Warm-up summary
    if (warmUpResult.performed) {
      report += `🔥 **Warm-Up Complete** (${warmUpResult.summary.estimatedImprovement} improvement)\n`;
      if (warmUpResult.summary.highlights.length > 0) {
        warmUpResult.summary.highlights.forEach(h => {
          report += `  • ${h}\n`;
        });
      }
      report += '\n';
    }

    // Agent verification summary
    if (agentStatus) {
      report += `🤖 **Subagent Verification**\n`;
      report += `  Active agents: ${agentStatus.existing.join(', ') || 'cleanup'}\n`;
      
      if (agentStatus.created.length > 0) {
        report += `  ✨ New agents created for sprint:\n`;
        agentStatus.created.forEach(agent => {
          report += `    • ${agent.type}: ${agent.reason}\n`;
        });
      }
      report += '\n';
    }

    // CRITICAL: Actionable sprint status, not questions
    report += `📋 **Current Sprint Status**\n\n`;

    // Priority #1: Blockers
    if (sprintStatus.blocked.length > 0) {
      report += `🚨 **BLOCKED ITEMS REQUIRING IMMEDIATE ATTENTION:**\n`;
      sprintStatus.blocked.slice(0, 3).forEach(item => {
        report += `\n  ❌ **${item.milestone}**\n`;
        if (item.blockers.length > 0) {
          report += `     Blockers: ${item.blockers.join(', ')}\n`;
        }
        if (item.notes) {
          report += `     Notes: ${item.notes}\n`;
        }
      });
      report += `\n  **→ Action: Resolve these blockers first**\n\n`;
    }

    // Priority #2: In Progress
    if (sprintStatus.inProgress.length > 0) {
      report += `🔄 **IN PROGRESS - Continue these:**\n`;
      sprintStatus.inProgress.slice(0, 3).forEach(item => {
        report += `  • ${item.milestone}`;
        if (item.notes) {
          report += ` - ${item.notes}`;
        }
        report += '\n';
      });
      report += '\n';
    }

    // Git status if there are uncommitted changes
    if (gitStatus.hasUncommittedChanges) {
      report += `⚠️  **Uncommitted Changes Detected:**\n`;
      report += `  Branch: ${gitStatus.branch}\n`;
      report += `  Modified files:\n`;
      gitStatus.modifiedFiles.slice(0, 5).forEach(file => {
        report += `    • ${file}\n`;
      });
      report += `  **→ Action: Review and commit these changes**\n\n`;
    }

    // Next tasks to start
    if (sprintStatus.notStarted.length > 0 && sprintStatus.blocked.length === 0) {
      report += `📝 **Ready to Start:**\n`;
      sprintStatus.notStarted.slice(0, 2).forEach(item => {
        report += `  • ${item.milestone}\n`;
      });
      report += '\n';
    }

    // Recent progress for context
    if (sprintStatus.completed.length > 0) {
      report += `✅ **Recently Completed:**\n`;
      sprintStatus.completed.slice(0, 2).forEach(item => {
        report += `  • ${item.milestone} (${item.updated})\n`;
      });
      report += '\n';
    }

    // ACTIONABLE CONCLUSION - Not a question!
    report += `\n📍 **Next Actions:**\n`;
    
    if (sprintStatus.blocked.length > 0) {
      report += `1. **Unblock:** ${sprintStatus.blocked[0].milestone}\n`;
    } else if (gitStatus.hasUncommittedChanges) {
      report += `1. **Commit:** Review and commit the ${gitStatus.modifiedFiles.length} modified files\n`;
    } else if (sprintStatus.inProgress.length > 0) {
      report += `1. **Continue:** ${sprintStatus.inProgress[0].milestone}\n`;
    } else if (sprintStatus.notStarted.length > 0) {
      report += `1. **Start:** ${sprintStatus.notStarted[0].milestone}\n`;
    } else {
      report += `1. **Plan:** Define next sprint tasks using track_progress tool\n`;
    }

    report += `\nUse \`/session-checkpoint\` periodically to save progress.\n`;

    return {
      content: [{
        type: 'text',
        text: report
      }],
      sprintStatus,
      gitStatus,
      sessionResult,
      warmUpResult
    };
  }
}

/**
 * Export factory function
 */
export function createSessionStartupEnhancer(sessionManager, databases, warmUpManager) {
  return new SessionStartupEnhancer(sessionManager, databases, warmUpManager);
}