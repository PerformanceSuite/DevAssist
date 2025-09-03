#!/usr/bin/env node

// Simple MCP server that works without complex SDK dependencies
import { readFileSync, writeFileSync } from 'fs';
import { execSync, exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

// Simple MCP protocol implementation
class SimpleMCPServer {
  constructor() {
    this.tools = [
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
      {
        name: 'analyze_codebase',
        description: 'Analyze the current codebase structure and identify patterns',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to analyze (default: project root)',
              default: '.',
            },
            depth: {
              type: 'number',
              description: 'Directory depth to analyze',
              default: 3,
            },
          },
        },
      },
      {
        name: 'record_architectural_decision',
        description: 'Record an architectural decision with context and reasoning',
        inputSchema: {
          type: 'object',
          properties: {
            decision: {
              type: 'string',
              description: 'The architectural decision made',
              required: true,
            },
            context: {
              type: 'string',
              description: 'Context and reasoning behind the decision',
              required: true,
            },
            alternatives: {
              type: 'array',
              items: { type: 'string' },
              description: 'Alternative approaches considered',
            },
            impact: {
              type: 'string',
              description: 'Expected impact on the system',
            },
          },
          required: ['decision', 'context'],
        },
      },
      {
        name: 'get_project_memory',
        description: 'Retrieve project memory including decisions, progress, and lessons learned',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for specific memories',
            },
            category: {
              type: 'string',
              description: 'Category to filter by (decisions, progress, lessons, architecture)',
              enum: ['decisions', 'progress', 'lessons', 'architecture', 'all'],
              default: 'all',
          },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return',
              default: 10,
            },
          },
        },
      },
      {
        name: 'track_progress',
        description: 'Track progress on a specific feature or milestone',
        inputSchema: {
          type: 'object',
          properties: {
            milestone: {
              type: 'string',
              description: 'Name of the milestone or feature',
              required: true,
            },
            status: {
              type: 'string',
              description: 'Current status',
              enum: ['not_started', 'in_progress', 'testing', 'completed', 'blocked'],
              required: true,
            },
            notes: {
              type: 'string',
              description: 'Additional notes or context',
            },
            blockers: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of blockers or issues',
            },
          },
          required: ['milestone', 'status'],
        },
      },
      {
        name: 'identify_duplicate_effort',
        description: 'Analyze the codebase to identify potential duplicate functionality or scope creep',
        inputSchema: {
          type: 'object',
          properties: {
            feature: {
              type: 'string',
              description: 'Feature or functionality to check for duplicates',
            },
            path: {
              type: 'string',
              description: 'Path to analyze (default: project root)',
              default: '.',
            },
          },
        },
      },
    ];
  }

  handleRequest(request) {
    try {
      const { method, params, id } = request;
      
      switch (method) {
        case 'tools/list':
          return this.handleToolsList(id);
        case 'tools/call':
          return this.handleToolsCall(params, id);
        default:
          return this.createErrorResponse(id, -32601, 'Method not found');
      }
    } catch (error) {
      return this.createErrorResponse(request.id || 0, -32603, 'Internal error', error.message);
    }
  }

  handleToolsList(id) {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: this.tools,
      },
    };
  }

  handleToolsCall(params, id) {
    const { name, arguments: args } = params;
    
    try {
      let result;
      
      switch (name) {
        case 'run_supercollider':
          result = this.runSuperCollider(args);
          break;
        case 'start_performia':
          result = this.startPerformia(args);
          break;
        case 'get_system_status':
          result = this.getSystemStatus();
          break;
        case 'calibrate_input':
          result = this.calibrateInput();
          break;
        case 'analyze_codebase':
          result = this.analyzeCodebase(args);
          break;
        case 'record_architectural_decision':
          result = this.recordArchitecturalDecision(args);
          break;
        case 'get_project_memory':
          result = this.getProjectMemory(args);
          break;
        case 'track_progress':
          result = this.trackProgress(args);
          break;
        case 'identify_duplicate_effort':
          result = this.identifyDuplicateEffort(args);
          break;
        default:
          return this.createErrorResponse(id, -32601, `Unknown tool: ${name}`);
      }
      
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        },
      };
    } catch (error) {
      return this.createErrorResponse(id, -32603, 'Tool execution error', error.message);
    }
  }

  runSuperCollider(args) {
    const { code } = args;
    const tempFile = path.join(projectRoot, 'temp_sc.scd');
    writeFileSync(tempFile, code);
    
    const result = execSync(`sclang ${tempFile}`, {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: 5000,
    });
    
    return `SuperCollider executed successfully:\n${result}`;
  }

  startPerformia(args) {
    const { enableInput = false, gui = true } = args || {};
    
    let command;
    if (gui) {
      command = `cd ${projectRoot} && ./run_performia.sh`;
    } else {
      command = `cd ${projectRoot} && python src/main.py${enableInput ? ' --enable-input' : ''}`;
    }
    
    exec(command, { cwd: projectRoot });
    
    return `Performia system started${enableInput ? ' with audio input' : ''}${gui ? ' and GUI' : ''}`;
  }

  getSystemStatus() {
    const scStatus = execSync('pgrep -f scsynth || echo "Not running"', { encoding: 'utf8' }).trim();
    const pythonStatus = execSync('pgrep -f "python.*main.py" || echo "Not running"', { encoding: 'utf8' }).trim();
    const guiStatus = execSync('pgrep -f "python.*app.py" || echo "Not running"', { encoding: 'utf8' }).trim();
    
    return `System Status:
- SuperCollider: ${scStatus !== 'Not running' ? 'Running (PID: ' + scStatus + ')' : 'Not running'}
- Python Backend: ${pythonStatus !== 'Not running' ? 'Running (PID: ' + pythonStatus + ')' : 'Not running'}
- GUI: ${guiStatus !== 'Not running' ? 'Running (PID: ' + guiStatus + ')' : 'Not running'}`;
  }

  calibrateInput() {
    const result = execSync(`cd ${projectRoot} && python scripts/calibrate_input.py`, {
      encoding: 'utf8',
      timeout: 30000,
    });
    
    return `Input calibration completed:\n${result}`;
  }

  analyzeCodebase(args) {
    const { path: analyzePath = '.', depth = 3 } = args || {};
    const fullPath = path.join(projectRoot, analyzePath);
    
    const result = execSync(`find ${fullPath} -maxdepth ${depth} -type f -name "*.py" -o -name "*.js" -o -name "*.scd" | head -20`, {
      encoding: 'utf8',
      cwd: projectRoot,
    });
    
    const fileCount = result.trim().split('\n').filter(line => line.trim()).length;
    
    return `Codebase Analysis (${analyzePath}, depth: ${depth}):
Found ${fileCount} source files:
${result}`;
  }

  recordArchitecturalDecision(args) {
    const { decision, context, alternatives, impact } = args || {};
    
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
    
    return `✅ Architectural decision recorded:
Decision: ${decision}
Context: ${context}
Impact: ${impact}
Alternatives: ${alternatives ? alternatives.join(', ') : 'None specified'}

This decision has been saved to architectural_decisions.json and will be remembered by the system.`;
  }

  getProjectMemory(args) {
    const { query, category = 'all', limit = 10 } = args || {};
    
    const decisionsFile = path.join(projectRoot, 'architectural_decisions.json');
    let decisions = [];
    
    try {
      const existing = readFileSync(decisionsFile, 'utf8');
      decisions = JSON.parse(existing);
    } catch (e) {
      // No decisions file yet
    }
    
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
      return `No project memory found${query ? ` for query: "${query}"` : ''}${category !== 'all' ? ` in category: ${category}` : ''}.

Use record_architectural_decision to start building your project memory!`;
    }
    
    const memoryText = results.map(d => 
      `📋 ${d.decision}\n   Context: ${d.context}\n   Impact: ${d.impact}\n   Date: ${new Date(d.timestamp).toLocaleDateString()}\n`
    ).join('\n');
    
    return `🧠 Project Memory (${results.length} results):
${memoryText}`;
  }

  trackProgress(args) {
    const { milestone, status, notes, blockers } = args || {};
    
    const progressFile = path.join(projectRoot, 'project_progress.json');
    let progress = [];
    
    try {
      const existing = readFileSync(progressFile, 'utf8');
      progress = JSON.parse(existing);
    } catch (e) {
      // File doesn't exist or is invalid, start fresh
    }
    
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
    
    return `📊 Progress tracked for milestone: ${milestone}
Status: ${status}
Notes: ${notes || 'None'}
Blockers: ${blockers ? blockers.join(', ') : 'None'}

This progress has been saved and will be remembered by the system.`;
  }

  identifyDuplicateEffort(args) {
    const { feature, path: analyzePath = '.' } = args || {};
    const fullPath = path.join(projectRoot, analyzePath);
    
    if (!feature) {
      const result = execSync(`find ${fullPath} -type f -name "*.py" -o -name "*.js" | xargs grep -l "def\\|function\\|class" | head -20`, {
        encoding: 'utf8',
        cwd: projectRoot,
      });
      
      return `🔍 General codebase analysis for potential duplicates:
${result}

Use identify_duplicate_effort with a specific feature name to check for duplicate functionality.`;
    }
    
    const result = execSync(`grep -r "${feature}" ${fullPath} --include="*.py" --include="*.js" --include="*.scd" | head -20`, {
      encoding: 'utf8',
      cwd: projectRoot,
    });
    
    return `🔍 Search for "${feature}" functionality:
${result}

This will help identify if you're building duplicate functionality elsewhere in the codebase.`;
  }

  createErrorResponse(id, code, message, data = null) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        ...(data && { data }),
      },
    };
  }
}

// Main server loop
const server = new SimpleMCPServer();

console.error('🧠 Performia MCP Server v1.0.0 - Project Intelligence & Musical Control');
console.error('📡 Listening for MCP requests on stdin/stdout');

process.stdin.setEncoding('utf8');
let buffer = '';

process.stdin.on('data', (chunk) => {
  buffer += chunk;
  
  // Process complete JSON lines
  const lines = buffer.split('\n');
  buffer = lines.pop(); // Keep incomplete line in buffer
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const request = JSON.parse(line);
        const response = server.handleRequest(request);
        console.log(JSON.stringify(response));
      } catch (error) {
        console.error('Error processing request:', error.message);
        const errorResponse = {
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: 'Parse error',
            data: error.message,
          },
        };
        console.log(JSON.stringify(errorResponse));
      }
    }
  }
});

process.stdin.on('end', () => {
  console.error('Server shutting down');
  process.exit(0);
});

// Handle process termination
process.on('SIGINT', () => {
  console.error('\nServer interrupted, shutting down');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Server terminated, shutting down');
  process.exit(0);
});

