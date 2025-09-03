#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { execSync, exec } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

// Create server instance
const server = new Server({
  name: 'performia-mcp',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

// Tool: Run SuperCollider command
const RunSuperColliderSchema = z.object({
  code: z.string().describe('SuperCollider code to execute'),
});

server.setRequestHandler('tools/list', async () => ({
  tools: [
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
  ],
}));

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'run_supercollider': {
      const { code } = RunSuperColliderSchema.parse(args);
      
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

    case 'analyze_codebase': {
      try {
        const { path: analyzePath = '.', depth = 3 } = args || {};
        const fullPath = path.join(projectRoot, analyzePath);
        
        // Simple directory analysis
        const result = execSync(`find ${fullPath} -maxdepth ${depth} -type f -name "*.py" -o -name "*.js" -o -name "*.scd" | head -20`, {
          encoding: 'utf8',
          cwd: projectRoot,
        });
        
        const fileCount = result.trim().split('\n').filter(line => line.trim()).length;
        
        return {
          content: [
            {
              type: 'text',
              text: `Codebase Analysis (${analyzePath}, depth: ${depth}):
Found ${fileCount} source files:
${result}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error analyzing codebase: ${error.message}`,
            },
          ],
        };
      }
    }

    case 'record_architectural_decision': {
      try {
        const { decision, context, alternatives, impact } = args || {};
        
        // For now, write to a simple JSON file
        const decisionsFile = path.join(projectRoot, 'architectural_decisions.json');
        let decisions = [];
        
        try {
          const existing = readFileSync(decisionsFile, 'utf8');
          decisions = JSON.parse(existing);
        } catch (e) {
          // File doesn't exist or is invalid, start fresh
        }
        
        const newDecision = {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          decision,
          context,
          alternatives: alternatives || [],
          impact: impact || 'Not specified',
        };
        
        decisions.push(newDecision);
        writeFileSync(decisionsFile, JSON.stringify(decisions, null, 2));
        
        return {
          content: [
            {
              type: 'text',
              text: `✅ Architectural decision recorded:
Decision: ${decision}
Context: ${context}
Impact: ${impact}
Alternatives: ${alternatives ? alternatives.join(', ') : 'None specified'}

This decision has been saved to architectural_decisions.json and will be remembered by the system.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error recording architectural decision: ${error.message}`,
            },
          ],
        };
      }
    }

    case 'get_project_memory': {
      try {
        const { query, category = 'all', limit = 10 } = args || {};
        
        // Read architectural decisions
        const decisionsFile = path.join(projectRoot, 'architectural_decisions.json');
        let decisions = [];
        
        try {
          const existing = readFileSync(decisionsFile, 'utf8');
          decisions = JSON.parse(existing);
        } catch (e) {
          // No decisions file yet
        }
        
        // Filter by category and query
        let results = decisions;
        if (category !== 'all') {
          results = results.filter(d => d.category === category);
        }
        if (query) {
          results = results.filter(d => 
            d.decision.toLowerCase().includes(query.toLowerCase()) ||
            d.context.toLowerCase().includes(query.toLowerCase())
          );
        }
        
        results = results.slice(0, limit);
        
        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No project memory found${query ? ` for query: "${query}"` : ''}${category !== 'all' ? ` in category: ${category}` : ''}.

Use record_architectural_decision to start building your project memory!`,
              },
            ],
          };
        }
        
        const memoryText = results.map(d => 
          `📋 ${d.decision}\n   Context: ${d.context}\n   Impact: ${d.impact}\n   Date: ${new Date(d.timestamp).toLocaleDateString()}\n`
        ).join('\n');
        
        return {
          content: [
            {
              type: 'text',
              text: `🧠 Project Memory (${results.length} results):
${memoryText}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error retrieving project memory: ${error.message}`,
            },
          ],
        };
      }
    }

    case 'track_progress': {
      try {
        const { milestone, status, notes, blockers } = args || {};
        
        // For now, write to a simple JSON file
        const progressFile = path.join(projectRoot, 'project_progress.json');
        let progress = [];
        
        try {
          const existing = readFileSync(progressFile, 'utf8');
          progress = JSON.parse(existing);
        } catch (e) {
          // File doesn't exist or is invalid, start fresh
        }
        
        // Update existing milestone or add new one
        const existingIndex = progress.findIndex(p => p.milestone === milestone);
        if (existingIndex >= 0) {
          progress[existingIndex] = {
            ...progress[existingIndex],
            status,
            notes: notes || progress[existingIndex].notes,
            blockers: blockers || progress[existingIndex].blockers,
            lastUpdated: new Date().toISOString(),
          };
        } else {
          progress.push({
            id: Date.now(),
            milestone,
            status,
            notes: notes || '',
            blockers: blockers || [],
            created: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
          });
        }
        
        writeFileSync(progressFile, JSON.stringify(progress, null, 2));
        
        return {
          content: [
            {
              type: 'text',
              text: `📊 Progress tracked for milestone: ${milestone}
Status: ${status}
Notes: ${notes || 'None'}
Blockers: ${blockers ? blockers.join(', ') : 'None'}

This progress has been saved and will be remembered by the system.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error tracking progress: ${error.message}`,
            },
          ],
        };
      }
    }

    case 'identify_duplicate_effort': {
      try {
        const { feature, path: analyzePath = '.' } = args || {};
        const fullPath = path.join(projectRoot, analyzePath);
        
        if (!feature) {
          // General duplicate analysis
          const result = execSync(`find ${fullPath} -type f -name "*.py" -o -name "*.js" | xargs grep -l "def\\|function\\|class" | head -20`, {
            encoding: 'utf8',
            cwd: projectRoot,
          });
          
          return {
            content: [
              {
                type: 'text',
                text: `🔍 General codebase analysis for potential duplicates:
${result}

Use identify_duplicate_effort with a specific feature name to check for duplicate functionality.`,
              },
            ],
          };
        }
        
        // Search for specific feature
        const result = execSync(`grep -r "${feature}" ${fullPath} --include="*.py" --include="*.js" --include="*.scd" | head -20`, {
          encoding: 'utf8',
          cwd: projectRoot,
        });
        
        return {
          content: [
            {
              type: 'text',
              text: `🔍 Search for "${feature}" functionality:
${result}

This will help identify if you're building duplicate functionality elsewhere in the codebase.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error identifying duplicate effort: ${error.message}`,
            },
          ],
        };
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start the server
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Server is now running and listening for MCP messages on stdio
  } catch (error) {
    console.error('Server error:', error);
    process.exit(1);
  }
}

main();