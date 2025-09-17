/**
 * DevAssist UI Module Integration
 * Adds UI Module tools to DevAssist MCP server
 */

import { UIModuleCoordinator } from './ui-module/UIModuleCoordinator.js';

// UI Module instance (initialized on first use)
let uiModule = null;

/**
 * UI Module MCP Tools
 */
export const uiModuleTools = {
  /**
   * Enter UI Focus Mode
   */
  enter_ui_mode: {
    description: 'Enter UI Focus Mode for visual development with live preview',
    parameters: {
      type: 'object',
      properties: {
        component: {
          type: 'string',
          description: 'Component to focus on'
        },
        viewport: {
          type: 'string',
          enum: ['mobile', 'tablet', 'desktop', 'wide'],
          description: 'Initial viewport size'
        },
        profile: {
          type: 'string',
          enum: ['development', 'production', 'testing'],
          description: 'Configuration profile to use'
        }
      }
    },
    handler: async (params) => {
      if (!uiModule) {
        uiModule = new UIModuleCoordinator(
          process.cwd(),
          process.env.DEVASSIST_PATH || '.'
        );
        await uiModule.initialize();
      }
      
      return await uiModule.enterUIMode(params);
    }
  },

  /**
   * Create UI checkpoint
   */
  create_ui_checkpoint: {
    description: 'Create visual checkpoint with screenshots and metrics',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Checkpoint message'
        },
        viewports: {
          type: 'array',
          items: { type: 'string' },
          description: 'Viewports to capture'
        },
        validate: {
          type: 'boolean',
          description: 'Run validation before checkpoint'
        }
      },
      required: ['message']
    },
    handler: async (params) => {
      if (!uiModule) {
        throw new Error('UI Module not initialized. Run enter_ui_mode first.');
      }
      
      return await uiModule.createCheckpoint(params);
    }
  },
