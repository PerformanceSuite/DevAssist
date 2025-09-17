import { UIModeManager } from './UIModeManager.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Integration layer between UI Module and existing DevAssist MCP server
 * This module extends DevAssist with UI development capabilities
 */
export class DevAssistUIIntegration {
  constructor(mcpServer) {
    this.server = mcpServer;
    this.uiManager = null;
    this.isInitialized = false;
    this.projectRoot = process.cwd();
  }

  /**
   * Initialize the UI module integration
   */
  async initialize() {
    try {
      // Create UI mode manager
      this.uiManager = new UIModeManager({
        projectRoot: this.projectRoot,
        autoStart: false
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Register new MCP tools for UI mode
      await this.registerUITools();

      this.isInitialized = true;
      console.log('[DevAssist UI] Integration initialized successfully');
    } catch (error) {
      console.error('[DevAssist UI] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Set up event handlers for UI mode events
   */
  setupEventHandlers() {
    // UI Mode state changes
    this.uiManager.on('uiModeEntered', () => {
      console.log('[DevAssist UI] Entered UI development mode');
      this.broadcastNotification('UI Mode activated - Visual development environment ready');
    });

    this.uiManager.on('uiModeExited', () => {
      console.log('[DevAssist UI] Exited UI development mode');
      this.broadcastNotification('UI Mode deactivated - Returned to standard mode');
    });

    // Browser events
    this.uiManager.on('browserReady', () => {
      console.log('[DevAssist UI] Browser session ready');
    });

    this.uiManager.on('browserConsole', (msg) => {
      if (msg.type === 'error') {
        this.recordUIIssue('console-error', msg.text);
      }
    });

    // File change events
    this.uiManager.on('fileChanged', (change) => {
      console.log(`[DevAssist UI] File changed: ${change.relativePath}`);
    });

    // Validation events
    this.uiManager.on('validationComplete', async (report) => {
      console.log(`[DevAssist UI] Validation score: ${report.score.percentage}%`);

      // Record validation results as architectural decision if significant issues
      if (report.score.percentage < 80) {
        await this.recordValidationIssues(report);
      }
    });

    // Iteration events
    this.uiManager.on('iterationSaved', (iteration) => {
      console.log(`[DevAssist UI] Design iteration saved: ${iteration.id}`);
    });

    // Error handling
    this.uiManager.on('error', (error) => {
      console.error('[DevAssist UI] Error:', error);
    });
  }

  /**
   * Register UI-specific MCP tools
   */
  async registerUITools() {
    const tools = [
      {
        name: 'toggle_ui_mode',
        description: 'Switch between standard and UI development mode',
        inputSchema: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['ui', 'standard'],
              description: 'The mode to switch to'
            }
          }
        },
        handler: this.handleToggleUIMode.bind(this)
      },
      {
        name: 'navigate_to_component',
        description: 'Navigate browser to a specific component or URL in UI mode',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL to navigate to'
            }
          },
          required: ['url']
        },
        handler: this.handleNavigate.bind(this)
      },
      {
        name: 'set_viewport',
        description: 'Change browser viewport to test responsive design',
        inputSchema: {
          type: 'object',
          properties: {
            preset: {
              type: 'string',
              enum: ['desktop', 'tablet', 'mobile', 'iPhone15', 'iPadPro'],
              description: 'Viewport preset name'
            },
            width: {
              type: 'number',
              description: 'Custom viewport width'
            },
            height: {
              type: 'number',
              description: 'Custom viewport height'
            }
          }
        },
        handler: this.handleSetViewport.bind(this)
      },
      {
        name: 'capture_ui_screenshot',
        description: 'Take a screenshot of the current UI state',
        inputSchema: {
          type: 'object',
          properties: {
            fullPage: {
              type: 'boolean',
              description: 'Capture full page or viewport only',
              default: true
            }
          }
        },
        handler: this.handleCaptureScreenshot.bind(this)
      },
      {
        name: 'run_design_validation',
        description: 'Run design validation checks on current page',
        inputSchema: {
          type: 'object',
          properties: {}
        },
        handler: this.handleRunValidation.bind(this)
      },
      {
        name: 'compare_design_iterations',
        description: 'Compare two design iterations visually',
        inputSchema: {
          type: 'object',
          properties: {
            iteration1: {
              type: 'string',
              description: 'ID of first iteration'
            },
            iteration2: {
              type: 'string',
              description: 'ID of second iteration'
            }
          },
          required: ['iteration1', 'iteration2']
        },
        handler: this.handleCompareIterations.bind(this)
      },
      {
        name: 'get_design_timeline',
        description: 'Get design evolution timeline for current component',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of iterations to return',
              default: 10
            }
          }
        },
        handler: this.handleGetTimeline.bind(this)
      },
      {
        name: 'trigger_design_review',
        description: 'Trigger automated design review process',
        inputSchema: {
          type: 'object',
          properties: {}
        },
        handler: this.handleTriggerDesignReview.bind(this)
      },
      {
        name: 'test_interaction',
        description: 'Test UI interactions like click, hover, focus',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector for element'
            },
            action: {
              type: 'string',
              enum: ['click', 'hover', 'focus'],
              description: 'Interaction type'
            }
          },
          required: ['selector', 'action']
        },
        handler: this.handleTestInteraction.bind(this)
      }
    ];

    // Register each tool with the MCP server
    for (const tool of tools) {
      this.server.registerTool(tool);
    }
  }

  /**
   * Tool Handlers
   */

  async handleToggleUIMode({ mode }) {
    try {
      if (mode === 'ui') {
        await this.uiManager.enterUIMode();
        return {
          success: true,
          message: 'UI Mode activated',
          state: this.uiManager.getState()
        };
      } else {
        await this.uiManager.exitUIMode();
        return {
          success: true,
          message: 'Returned to standard mode',
          state: this.uiManager.getState()
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async handleNavigate({ url }) {
    try {
      await this.uiManager.navigateTo(url);
      return {
        success: true,
        message: `Navigated to ${url}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async handleSetViewport({ preset, width, height }) {
    try {
      if (preset) {
        await this.uiManager.setViewport(preset);
      } else if (width && height) {
        await this.uiManager.setViewport({ width, height });
      } else {
        throw new Error('Either preset or width/height must be provided');
      }

      return {
        success: true,
        message: 'Viewport updated'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async handleCaptureScreenshot({ fullPage }) {
    try {
      const screenshot = await this.uiManager.captureScreenshot(fullPage);
      const timestamp = Date.now();
      const filename = `screenshot_${timestamp}.jpg`;
      const filepath = path.join(this.projectRoot, '.ui-mode', 'captures', filename);

      await fs.mkdir(path.dirname(filepath), { recursive: true });
      await fs.writeFile(filepath, screenshot);

      return {
        success: true,
        message: 'Screenshot captured',
        path: filepath,
        size: screenshot.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async handleRunValidation() {
    try {
      const report = await this.uiManager.runValidation();
      return {
        success: true,
        report: {
          score: report.score,
          issues: report.results.filter(r => !r.passed),
          performance: report.performance
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async handleCompareIterations({ iteration1, iteration2 }) {
    try {
      const diff = await this.uiManager.compareIterations(iteration1, iteration2);
      return {
        success: true,
        diff: {
          percentDifferent: diff.percentDifferent,
          pixelsDifferent: diff.pixelsDifferent,
          diffImage: diff.diffImagePath
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async handleGetTimeline({ limit }) {
    try {
      const iterations = this.uiManager.getIterations(limit);
      return {
        success: true,
        iterations: iterations.map(iter => ({
          id: iter.id,
          timestamp: iter.timestamp,
          url: iter.url,
          viewport: iter.viewport,
          validationScore: iter.validationScore,
          changes: iter.changes
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async handleTriggerDesignReview() {
    try {
      await this.uiManager.triggerDesignReview();

      // Here you would integrate with the design-review agent
      // For now, we'll return a mock response
      return {
        success: true,
        message: 'Design review initiated',
        reviewId: Date.now().toString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async handleTestInteraction({ selector, action }) {
    try {
      await this.uiManager.triggerInteraction(selector, action);
      return {
        success: true,
        message: `Triggered ${action} on ${selector}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Helper methods for DevAssist integration
   */

  async recordUIIssue(type, description) {
    // Record UI issues as architectural decisions
    const decision = {
      timestamp: Date.now(),
      decision: `UI Issue: ${type}`,
      context: description,
      impact: 'UI/UX',
      project: 'ui-development'
    };

    // Save to DevAssist's decision storage
    const dataPath = path.join(this.projectRoot, 'data', 'ui_issues.json');
    try {
      let issues = [];
      try {
        const existing = await fs.readFile(dataPath, 'utf-8');
        issues = JSON.parse(existing);
      } catch {
        // File doesn't exist yet
      }

      issues.push(decision);
      await fs.mkdir(path.dirname(dataPath), { recursive: true });
      await fs.writeFile(dataPath, JSON.stringify(issues, null, 2));
    } catch (error) {
      console.error('[DevAssist UI] Failed to record issue:', error);
    }
  }

  async recordValidationIssues(report) {
    const criticalIssues = report.results
      .filter(r => !r.passed && r.severity === 'error')
      .map(r => r.message);

    if (criticalIssues.length > 0) {
      await this.recordUIIssue('validation-failure', {
        url: report.url,
        score: report.score.percentage,
        issues: criticalIssues
      });
    }
  }

  broadcastNotification(message) {
    // This would send notifications to the DevAssist system
    console.log(`[DevAssist UI Notification] ${message}`);
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.uiManager) {
      await this.uiManager.cleanup();
    }
  }
}

/**
 * Factory function to create and initialize the UI integration
 */
export async function createUIIntegration(mcpServer) {
  const integration = new DevAssistUIIntegration(mcpServer);
  await integration.initialize();
  return integration;
}