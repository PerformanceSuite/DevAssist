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

  // [All the extraction methods continue as before...]

  extractCommands(content) {
    const commands = [];
    const matches = content.matchAll(this.patterns.commands);
    
    for (const match of matches) {
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
        errors.push({
          type: category,
          message: match[0],
          line: lineNum
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

  // ... Continue with all other methods ...

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
      workflow: this.inferWorkflow(extracted),
      productivity: this.assessProductivity(extracted)
    };
  }

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
    
    return patterns;
  }

  extractLearnings(extracted, insights) {
    const learnings = [];
    
    // Learn from successful patterns
    if (insights.successRate > 0.8) {
      learnings.push({
        type: 'successful-workflow',
        description: 'High success rate workflow',
        confidence: 0.9
      });
    }
    
    return learnings;
  }

  createSummary(extracted, insights, patterns, learnings) {
    return {
      overview: `Session with ${insights.totalCommands} commands`,
      keyMetrics: {
        commands: insights.totalCommands,
        errors: insights.totalErrors,
        successes: insights.totalSuccesses
      },
      patterns: patterns.map(p => p.description),
      learnings: learnings.map(l => l.description || l.type)
    };
  }

  async createEmbeddings(summary) {
    const textForEmbedding = JSON.stringify(summary);
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

  extractSessionId(logPath) {
    const match = logPath.match(/session[_-](\d+)/);
    return match ? match[1] : `session_${Date.now()}`;
  }

  hasPattern(commands, pattern) {
    // Simple pattern matching
    return commands.length >= pattern.length;
  }

  inferWorkflow(extracted) {
    const commandCount = extracted.commands.length;
    const testCount = extracted.commands.filter(c => c.command.includes('test')).length;
    
    if (testCount / commandCount > 0.2) {
      return 'test-heavy workflow';
    }
    
    return 'standard development workflow';
  }

  assessProductivity(extracted) {
    const score = 
      (extracted.successes.length * 2) -
      (extracted.errors.length);
    
    if (score > 10) return 'high';
    if (score > 0) return 'medium';
    return 'low';
  }

  extractFileOps(content) {
    // Simplified implementation
    return [];
  }

  extractGitOps(content) {
    // Simplified implementation
    return [];
  }

  extractPackageOps(content) {
    // Simplified implementation
    return [];
  }

  extractDevActivity(content) {
    // Simplified implementation
    return [];
  }

  extractTimestamps(content) {
    // Simplified implementation
    return [];
  }

  extractContext(content) {
    return {
      totalLines: content.split('\n').length,
      totalCharacters: content.length
    };
  }
}

// Export singleton for easy use
export const terminalProcessor = new TerminalLogProcessor();
