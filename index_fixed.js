#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { execSync, exec } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

// Create server instance with proper configuration
const server = new Server({
  name: 'performia-mcp',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

// Define tools array
const tools = [
  {
    name: 'run_supercollider',
    description: 'Execute SuperCollider code directly',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'SuperCollider code to execute',
        },
      },
      required: ['code'],
    },
  },
  {
    name: 'start_performia',
    description: 'Start the Performia system with specified options',
    inputSchema: {
      type: 'object',
      properties: {
        enableInput: {
          type: 'boolean',
          description: 'Enable audio input system',
          default: false,
        },
        gui: {
          type: 'boolean',
          description: 'Start the GUI interface',
          default: true,
        },
      },
    },
  },
  {
    name: 'get_system_status',
    description: 'Get the current status of the Performia system',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'calibrate_input',
    description: 'Run the audio input calibration script',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Set up tools/list handler
server.setRequestHandler({
  method: 'tools/list'
}, async () => ({
  tools: tools,
}));

// Set up tools/call handler
server.setRequestHandler({
  method: 'tools/call'
}, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'run_supercollider': {
        const { code } = args;
        
        try {
          // Write code to temporary file and execute with sclang
          const tempFile = path.join(projectRoot, 'temp_sc.scd');
          writeFileSync(tempFile, code);
          
          const result = execSync(`sclang ${tempFile}`, {
            cwd: projectRoot,
            encoding: 'utf8',
            timeout: 5000,
          });
          
          return {
            content: [
              {
                type: 'text',
                text: `SuperCollider executed successfully:\n${result}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error executing SuperCollider: ${error.message}`,
              },
            ],
          };
        }
      }

      case 'start_performia': {
        const { enableInput = false, gui = true } = args || {};
        
        try {
          let command;
          if (gui) {
            command = `cd ${projectRoot} && ./run_performia.sh`;
          } else {
            command = `cd ${projectRoot} && python src/main.py${enableInput ? ' --enable-input' : ''}`;
          }
          
          // Start in background
          exec(command, { cwd: projectRoot });
          
          return {
            content: [
              {
                type: 'text',
                text: `Performia system started${enableInput ? ' with audio input' : ''}${gui ? ' and GUI' : ''}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error starting Performia: ${error.message}`,
              },
            ],
          };
        }
      }

      case 'get_system_status': {
        try {
          // Check if SuperCollider is running
          const scStatus = execSync('pgrep -f scsynth || echo "Not running"', { encoding: 'utf8' }).trim();
          
          // Check if Python backend is running
          const pythonStatus = execSync('pgrep -f "python.*main.py" || echo "Not running"', { encoding: 'utf8' }).trim();
          
          // Check if GUI is running
          const guiStatus = execSync('pgrep -f "python.*app.py" || echo "Not running"', { encoding: 'utf8' }).trim();
          
          // Read configuration
          const config = readFileSync(path.join(projectRoot, 'config', 'config.yaml'), 'utf8');
          
          return {
            content: [
              {
                type: 'text',
                text: `System Status:
- SuperCollider: ${scStatus !== 'Not running' ? 'Running (PID: ' + scStatus + ')' : 'Not running'}
- Python Backend: ${pythonStatus !== 'Not running' ? 'Running (PID: ' + pythonStatus + ')' : 'Not running'}
- GUI: ${guiStatus !== 'Not running' ? 'Running (PID: ' + guiStatus + ')' : 'Not running'}

Configuration loaded from config/config.yaml`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error getting system status: ${error.message}`,
              },
            ],
          };
        }
      }

      case 'calibrate_input': {
        try {
          const result = execSync(`cd ${projectRoot} && python scripts/calibrate_input.py`, {
            encoding: 'utf8',
            timeout: 30000,
          });
          
          return {
            content: [
              {
                type: 'text',
                text: `Input calibration completed:\n${result}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error calibrating input: ${error.message}`,
              },
            ],
          };
        }
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error executing tool: ${error.message}`,
        },
      ],
    };
  }
});

// Start the server
async function main() {
  console.error('Starting Performia MCP Server v1.0.0...');
  
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Server connected and listening for MCP messages on stdio');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});