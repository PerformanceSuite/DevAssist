/**
 * Terminal Log Processor for DevAssist
 * Automatically extracts knowledge from terminal sessions
 */

import { readFileSync, existsSync } from 'fs';
import { generateEmbedding } from '../database/dataAccess.js';

export class TerminalLogProcessor {
  constructor() {
    this.patterns = {
      // Command patterns
      commands: /^\$\s+(.+)$/gm,
      shellPrompts: /^[>%#]\s+(.+)$/gm,
      
      // Error patterns
      errors: {
        general: /error:|exception:|failed|failure/gi,
        node: /TypeError|ReferenceError|SyntaxError|RangeError/g,
        python: /Traceback|ValueError|KeyError|AttributeError/g,
        build: /BUILD FAILED|compilation failed|make.*error/gi,
        test: /FAIL|✗|test.*failed|assertion.*failed/gi
      },
      
      // Success patterns
      success: {
        general: /success|succeeded|completed|done|✓|✔/gi,
        build: /BUILD SUCCESSFUL|compiled successfully/gi,
        test: /PASS|✓|test.*passed|all tests pass/gi,
        npm: /added \d+ packages|updated \d+ packages/gi
      },
      
      // File operation patterns
      fileOps: {
        created: /created?|new file|touch/gi,
        modified: /modified|changed|updated|edited/gi,
        deleted: /deleted|removed|rm -/gi,
        moved: /moved|renamed|mv /gi
      },
      
      // Git operation patterns
      gitOps: {
        commands: /git\s+(add|commit|push|pull|merge|checkout|branch|status|diff|log|rebase|cherry-pick)/gi,
        branch: /switched to branch|created branch/gi,
        commit: /\[[\w\-\/]+\s+[a-f0-9]{7}\]/gi,
        merge: /Merge branch|merged|fast-forward/gi
      },
      
      // Package management
      packageOps: {
        npm: /npm (install|update|audit|run|test)/gi,
        yarn: /yarn (add|upgrade|install|run|test)/gi,
        pip: /pip (install|upgrade)/gi,
        cargo: /cargo (build|test|run)/gi
      },
      
      // Development patterns
      devPatterns: {
        server: /server.*started|listening on|running on port/gi,
        database: /connected to database|database connection|migration/gi,
        api: /GET|POST|PUT|DELETE|PATCH.*\/api/gi,
        docker: /docker (run|build|compose|exec)/gi
      }
    };
  }

  /**
   * Process a terminal log file
   */
  async processLog(logPath) {
    if (!existsSync(logPath)) {
      throw new Error(`Log file not found: ${logPath}`);
    }
    
    const content = readFileSync(logPath, 'utf8');
    
    // Extract structured information
    const extracted = this.extractAll(content);
    
    // Generate insights
    const insights = this.generateInsights(extracted);
    
    // Identify patterns and workflows
    const patterns = this.identifyPatterns(extracted);
    
    // Extract learnings
    const learnings = this.extractLearnings(extracted, insights);
    
    // Create summary
    const summary = this.createSummary(extracted, insights, patterns, learnings);
    
    // Generate embeddings for semantic search
    const embeddings = await this.createEmbeddings(summary);
    
    return {
      path: logPath,
      extracted,
      insights,
      patterns,
      learnings,
      summary,
      embeddings,
      session_id: this.extractSessionId(logPath),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Extract all patterns from content
   */
  extractAll(content) {
    return {
      commands: this.extractCommands(content),
      errors: this.extractErrors(content),
      successes: this.extractSuccesses(content),
      fileOperations: this.extractFileOps(content),
      gitOperations: this.extractGitOps(content),
      packageOperations: this.extractPackageOps(content),
      developmentActivity: this.extractDevActivity(content),
      timestamps: this.extractTimestamps(content),
      context: this.extractContext(content)
    };
  }

  extractCommands(content) {
    const commands = [];
    const matches = content.matchAll(this.patterns.commands);
    
    for (const match of matches) {
      commands.push({
        command: match[1].trim(),
        line: this.getLineNumber(content, match.index)
      });
    }
    
    // Also extract shell prompts
    const shellMatches = content.matchAll(this.patterns.shellPrompts);
    for (const match of shellMatches) {
      commands.push({
        command: match[1].trim(),
        line: this.getLineNumber(content, match.index)
      });
    }
    
    return commands;
  }

  extractErrors(content) {
    const errors = [];
    const lines = content.split('\n');
    
    for (const [category, pattern] of Object.entries(this.patterns.errors)) {
      const matches = content.matchAll(pattern);
      
      for (const match of matches) {
        const lineNum = this.getLineNumber(content, match.index);
        const context = this.getContextLines(lines, lineNum, 2);
        
        errors.push({
          type: category,
          message: match[0],
          line: lineNum,
          context: context.join('\n')
        });
      }
    }
    
    return errors;
  }

  extractSuccesses(content) {
    const successes = [];
    
    for (const [category, pattern] of Object.entries(this.patterns.success)) {
      const matches = content.matchAll(pattern);
      
      for (const match of matches) {
        successes.push({
          type: category,
          message: match[0],
          line: this.getLineNumber(content, match.index)
        });
      }
    }
    
    return successes;
  }

  extractFileOps(content) {
    const operations = [];
    
    for (const [type, pattern] of Object.entries(this.patterns.fileOps)) {
      const matches = content.matchAll(pattern);
      
      for (const match of matches) {
        operations.push({
          type,
          operation: match[0],
          line: this.getLineNumber(content, match.index)
        });
      }
    }
    
    return operations;
  }

  extractGitOps(content) {
    const operations = [];
    
    for (const [type, pattern] of Object.entries(this.patterns.gitOps)) {
      const matches = content.matchAll(pattern);
      
      for (const match of matches) {
        operations.push({
          type,
          operation: match[0],
          details: match[1] || null,
          line: this.getLineNumber(content, match.index)
        });
      }
    }
    
    return operations;
  }

  extractPackageOps(content) {
    const operations = [];
    
    for (const [manager, pattern] of Object.entries(this.patterns.packageOps)) {
      const matches = content.matchAll(pattern);
      
      for (const match of matches) {
        operations.push({
          manager,
          operation: match[0],
          line: this.getLineNumber(content, match.index)
        });
      }
    }
    
    return operations;
  }

  extractDevActivity(content) {
    const activities = [];
    
    for (const [type, pattern] of Object.entries(this.patterns.devPatterns)) {
      const matches = content.matchAll(pattern);
      
      for (const match of matches) {
        activities.push({
          type,
          activity: match[0],
          line: this.getLineNumber(content, match.index)
        });
      }
    }
    
    return activities;
  }

  extractTimestamps(content) {
    const timestamps = [];
    const pattern = /\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}/g;
    const matches = content.matchAll(pattern);
    
    for (const match of matches) {
      timestamps.push({
        timestamp: match[0],
        line: this.getLineNumber(content, match.index)
      });
    }
    
    return timestamps;
  }

  extractContext(content) {
    const lines = content.split('\n');
    
    return {
      totalLines: lines.length,
      totalCharacters: content.length,
      sessionStart: lines[0] || '',
      sessionEnd: lines[lines.length - 1] || '',
      workingDirectory: this.extractWorkingDirectory(content),
      environment: this.extractEnvironment(content)
    };
  }

  extractWorkingDirectory(content) {
    const pwdMatch = content.match(/pwd\n([^\n]+)/);
    const cdMatch = content.match(/cd\s+([^\n]+)/);
    
    return pwdMatch?.[1] || cdMatch?.[1] || 'unknown';
  }

  extractEnvironment(content) {
    const env = {};
    
    // Look for common environment indicators
    if (content.includes('node_modules')) env.node = true;
    if (content.includes('package.json')) env.npm = true;
    if (content.includes('requirements.txt')) env.python = true;
    if (content.includes('Cargo.toml')) env.rust = true;
    if (content.includes('go.mod')) env.go = true;
    
    return env;
  }

  /**
   * Generate insights from extracted data
   */
  generateInsights(extracted) {
    const totalCommands = extracted.commands.length;
    const totalErrors = extracted.errors.length;
    const totalSuccesses = extracted.successes.length;
    
    return {
      totalCommands,
      totalErrors,
      totalSuccesses,
      errorRate: totalCommands > 0 ? (totalErrors / totalCommands) : 0,
      successRate: totalCommands > 0 ? (totalSuccesses / totalCommands) : 0,
      
      mostCommonCommands: this.findMostCommon(extracted.commands.map(c => c.command.split(' ')[0])),
      errorCategories: this.groupBy(extracted.errors, 'type'),
      
      gitActivity: {
        total: extracted.gitOperations.length,
        types: this.groupBy(extracted.gitOperations, 'type')
      },
      
      packageActivity: {
        total: extracted.packageOperations.length,
        managers: this.groupBy(extracted.packageOperations, 'manager')
      },
      
      developmentFocus: this.inferDevelopmentFocus(extracted),
      workflow: this.inferWorkflow(extracted),
      
      sessionDuration: this.calculateSessionDuration(extracted.timestamps),
      productivity: this.assessProductivity(extracted)
    };
  }

  /**
   * Identify patterns in the session
   */
  identifyPatterns(extracted) {
    const patterns = [];
    
    // Test-driven development pattern
    if (this.hasPattern(extracted.commands, ['test', 'code', 'test'])) {
      patterns.push({
        type: 'tdd',
        description: 'Test-driven development detected',
        confidence: 0.8
      });
    }
    
    // Debug-fix cycle
    if (this.hasErrorFollowedBySuccess(extracted)) {
      patterns.push({
        type: 'debug-fix',
        description: 'Debug and fix cycle detected',
        confidence: 0.9
      });
    }
    
    // Feature development
    if (this.hasFeatureDevelopmentPattern(extracted)) {
      patterns.push({
        type: 'feature-dev',
        description: 'Feature development workflow',
        confidence: 0.7
      });
    }
    
    // Dependency management
    if (extracted.packageOperations.length > 2) {
      patterns.push({
        type: 'dependency-mgmt',
        description: 'Dependency management activity',
        confidence: 0.9
      });
    }
    
    // Git workflow
    const gitPattern = this.identifyGitPattern(extracted.gitOperations);
    if (gitPattern) {
      patterns.push(gitPattern);
    }
    
    return patterns;
  }

  /**
   * Extract learnings from the session
   */
  extractLearnings(extracted, insights) {
    const learnings = [];
    
    // Learn from errors and their resolutions
    for (const error of extracted.errors) {
      const resolution = this.findErrorResolution(error, extracted);
      if (resolution) {
        learnings.push({
          type: 'error-resolution',
          problem: error.message,
          solution: resolution,
          confidence: 0.8
        });
      }
    }
    
    // Learn from successful patterns
    if (insights.successRate > 0.8) {
      learnings.push({
        type: 'successful-workflow',
        description: 'High success rate workflow',
        commands: extracted.commands.slice(0, 5).map(c => c.command),
        confidence: 0.9
      });
    }
    
    // Learn from repeated commands
    const repeated = this.findRepeatedSequences(extracted.commands);
    if (repeated.length > 0) {
      learnings.push({
        type: 'common-sequences',
        description: 'Frequently used command sequences',
        sequences: repeated,
        confidence: 0.7
      });
    }
    
    return learnings;
  }

  /**
   * Create a summary of the session
   */
  createSummary(extracted, insights, patterns, learnings) {
    const summary = {
      overview: `Session with ${insights.totalCommands} commands, ${insights.errorRate.toFixed(1)}% error rate`,
      
      mainActivities: this.summarizeActivities(extracted),
      
      keyMetrics: {
        commands: insights.totalCommands,
        errors: insights.totalErrors,
        successes: insights.totalSuccesses,
        gitOps: insights.gitActivity.total,
        packages: insights.packageActivity.total
      },
      
      patterns: patterns.map(p => p.description),
      learnings: learnings.map(l => l.description || l.type),
      
      workflow: insights.workflow,
      focus: insights.developmentFocus,
      
      notable: this.findNotableEvents(extracted, insights)
    };
    
    return summary;
  }

  /**
   * Create embeddings for semantic search
   */
  async createEmbeddings(summary) {
    const textForEmbedding = [
      summary.overview,
      ...summary.mainActivities,
      ...summary.patterns,
      ...summary.learnings,
      summary.workflow,
      summary.focus
    ].filter(Boolean).join(' ');
    
    const embedding = await generateEmbedding(textForEmbedding);
    
    return {
      summary: embedding,
      searchText: textForEmbedding
    };
  }

  // Helper methods

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  getContextLines(lines, lineNum, radius) {
    const start = Math.max(0, lineNum - radius);
    const end = Math.min(lines.length, lineNum + radius + 1);
    return lines.slice(start, end);
  }

  findMostCommon(items, limit = 5) {
    const counts = {};
    for (const item of items) {
      counts[item] = (counts[item] || 0) + 1;
    }
    
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([item, count]) => ({ item, count }));
  }

  groupBy(items, key) {
    const groups = {};
    for (const item of items) {
      const group = item[key];
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(item);
    }
    return groups;
  }

  hasPattern(commands, pattern) {
    const commandTexts = commands.map(c => c.command.toLowerCase());
    for (let i = 0; i <= commandTexts.length - pattern.length; i++) {
      let matches = true;
      for (let j = 0; j < pattern.length; j++) {
        if (!commandTexts[i + j].includes(pattern[j])) {
          matches = false;
          break;
        }
      }
      if (matches) return true;
    }
    return false;
  }

  hasErrorFollowedBySuccess(extracted) {
    for (let i = 0; i < extracted.errors.length; i++) {
      const errorLine = extracted.errors[i].line;
      for (const success of extracted.successes) {
        if (success.line > errorLine && success.line < errorLine + 10) {
          return true;
        }
      }
    }
    return false;
  }

  hasFeatureDevelopmentPattern(extracted) {
    const indicators = [
      extracted.gitOperations.some(op => op.type === 'branch'),
      extracted.fileOperations.length > 3,
      extracted.successes.some(s => s.type === 'test'),
      extracted.gitOperations.some(op => op.type === 'commit')
    ];
    
    return indicators.filter(Boolean).length >= 3;
  }

  identifyGitPattern(gitOps) {
    if (gitOps.length === 0) return null;
    
    const types = gitOps.map(op => op.type);
    
    if (types.includes('branch') && types.includes('commit') && types.includes('push')) {
      return {
        type: 'feature-branch',
        description: 'Feature branch workflow detected',
        confidence: 0.9
      };
    }
    
    if (types.filter(t => t === 'commit').length > 3) {
      return {
        type: 'iterative-dev',
        description: 'Iterative development with frequent commits',
        confidence: 0.8
      };
    }
    
    return null;
  }

  findErrorResolution(error, extracted) {
    const errorLine = error.line;
    
    // Look for success after error
    for (const success of extracted.successes) {
      if (success.line > errorLine && success.line < errorLine + 20) {
        // Find commands between error and success
        const resolutionCommands = extracted.commands
          .filter(c => c.line > errorLine && c.line < success.line)
          .map(c => c.command);
        
        if (resolutionCommands.length > 0) {
          return resolutionCommands.join(' -> ');
        }
      }
    }
    
    return null;
  }

  findRepeatedSequences(commands, minLength = 2, minCount = 2) {
    const sequences = {};
    
    for (let len = minLength; len <= Math.min(5, commands.length / 2); len++) {
      for (let i = 0; i <= commands.length - len; i++) {
        const seq = commands.slice(i, i + len).map(c => c.command).join(' | ');
        sequences[seq] = (sequences[seq] || 0) + 1;
      }
    }
    
    return Object.entries(sequences)
      .filter(([_, count]) => count >= minCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([seq, count]) => ({ sequence: seq.split(' | '), count }));
  }

  inferDevelopmentFocus(extracted) {
    const focuses = [];
    
    if (extracted.developmentActivity.some(a => a.type === 'server')) {
      focuses.push('backend');
    }
    if (extracted.commands.some(c => c.command.includes('react') || c.command.includes('vue'))) {
      focuses.push('frontend');
    }
    if (extracted.developmentActivity.some(a => a.type === 'database')) {
      focuses.push('database');
    }
    if (extracted.developmentActivity.some(a => a.type === 'docker')) {
      focuses.push('devops');
    }
    if (extracted.successes.some(s => s.type === 'test')) {
      focuses.push('testing');
    }
    
    return focuses.length > 0 ? focuses.join(', ') : 'general development';
  }

  inferWorkflow(extracted) {
    const commandCount = extracted.commands.length;
    const errorRate = extracted.errors.length / Math.max(commandCount, 1);
    const gitOpsRate = extracted.gitOperations.length / Math.max(commandCount, 1);
    
    if (errorRate > 0.2) {
      return 'debugging-focused workflow';
    }
    if (gitOpsRate > 0.15) {
      return 'version-control-heavy workflow';
    }
    if (extracted.packageOperations.length > 5) {
      return 'dependency management workflow';
    }
    if (extracted.successes.filter(s => s.type === 'test').length > 3) {
      return 'test-driven workflow';
    }
    
    return 'standard development workflow';
  }

  calculateSessionDuration(timestamps) {
    if (timestamps.length < 2) return 'unknown';
    
    const first = new Date(timestamps[0].timestamp);
    const last = new Date(timestamps[timestamps.length - 1].timestamp);
    const duration = last - first;
    
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    
    return `${hours}h ${minutes}m`;
  }

  assessProductivity(extracted) {
    const score = 
      (extracted.successes.length * 2) +
      (extracted.commands.length * 0.5) +
      (extracted.gitOperations.filter(op => op.type === 'commit').length * 3) -
      (extracted.errors.length * 1);
    
    if (score > 50) return 'high';
    if (score > 20) return 'medium';
    return 'low';
  }

  summarizeActivities(extracted) {
    const activities = [];
    
    if (extracted.commands.length > 0) {
      activities.push(`Executed ${extracted.commands.length} commands`);
    }
    if (extracted.gitOperations.length > 0) {
      activities.push(`${extracted.gitOperations.length} git operations`);
    }
    if (extracted.fileOperations.length > 0) {
      activities.push(`${extracted.fileOperations.length} file operations`);
    }
    if (extracted.packageOperations.length > 0) {
      activities.push(`${extracted.packageOperations.length} package operations`);
    }
    
    return activities;
  }

  findNotableEvents(extracted, insights) {
    const events = [];
    
    if (insights.errorRate > 0.3) {
      events.push('High error rate - debugging session');
    }
    if (insights.successRate > 0.8) {
      events.push('High success rate - productive session');
    }
    if (extracted.gitOperations.filter(op => op.type === 'merge').length > 0) {
      events.push('Code merge performed');
    }
    if (extracted.packageOperations.length > 5) {
      events.push('Significant dependency changes');
    }
    
    return events;
  }

  extractSessionId(logPath) {
    const match = logPath.match(/session[_-]?(\d+|[\w-]+)/);
    return match ? match[1] : 'unknown';
  }
}

// Export for use in other modules
export default TerminalLogProcessor;

// Singleton instance
let processorInstance = null;

export function getTerminalLogProcessor() {
  if (!processorInstance) {
    processorInstance = new TerminalLogProcessor();
  }
  return processorInstance;
}

/**
 * Process a log file directly
 */
export async function processTerminalLog(logPath) {
  const processor = getTerminalLogProcessor();
  return await processor.processLog(logPath);
}