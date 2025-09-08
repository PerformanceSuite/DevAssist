#!/usr/bin/env node

/**
 * DevAssist MCP Server - Refactored for Multi-Project Support
 * Single server handling all projects with proper isolation
 */

console.error('[DevAssist] Starting DevAssist MCP Server (Refactored)...');

// Monitor parent process (Claude Code) and exit if it dies
if (process.ppid) {
  setInterval(() => {
    try {
      // Check if parent process still exists
      process.kill(process.ppid, 0);
    } catch (e) {
      // Parent process is dead, exit cleanly
      console.error('[DevAssist] Parent process (Claude Code) has died, exiting...');
      process.exit(0);
    }
  }, 5000); // Check every 5 seconds
}

// Also handle stdin closure (when Claude Code closes the pipe)
process.stdin.on('end', () => {
  console.error('[DevAssist] stdin closed (Claude Code disconnected), exiting...');
  process.exit(0);
});

process.stdin.on('error', () => {
  console.error('[DevAssist] stdin error (Claude Code disconnected), exiting...');
  process.exit(0);
});

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import { ProjectManager } from './src/project-manager.js';
import { SessionManager } from './src/session/session-manager.js';
import { KnowledgeManager } from './src/knowledge-manager.cjs';
import { WarmUpManager } from './src/session/warmup.js';
import { createSessionHeartbeat } from './src/session/heartbeat.js';
import { CleanupManager } from './src/session/cleanup-manager.js';
import { TerminalLogger } from './src/session/terminal-logger.js';

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

// Initialize managers
const projectManager = new ProjectManager();
const knowledgeManager = new KnowledgeManager();

// Session managers per project
const sessionManagers = new Map();
const activeHeartbeats = new Map(); // Track heartbeats per project

async function getSessionManager(project) {
  if (!project) return null;
  
  if (!sessionManagers.has(project.name)) {
    const manager = new SessionManager();
    manager.setDataPath(projectManager.getDataPath(project, 'sessions'));
    sessionManagers.set(project.name, manager);
  }
  
  return sessionManagers.get(project.name);
}

// Create server
const server = new Server({
  name: 'devassist-refactored',
  version: '3.0.0',
}, {
  capabilities: { tools: {} },
});

// Define tools with project awareness
const tools = [
  {
    name: 'initproject',
    description: 'Initialize a new project with DevAssist - sets up GitHub integration, Claude configuration, and development environment',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Project path to initialize',
          default: '.',
        },
        skipDocumentation: {
          type: 'boolean',
          description: 'Skip documentation setup',
          default: false,
        },
      },
    },
  },
  {
    name: 'setup-project',
    description: 'Initialize a new project with DevAssist - sets up GitHub integration, Claude configuration, and development environment',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Project path to initialize',
          default: '.',
        },
        skipDocumentation: {
          type: 'boolean',
          description: 'Skip documentation setup',
          default: false,
        },
      },
    },
  },
  {
    name: 'list_projects',
    description: 'List all projects managed by DevAssist',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'switch_project',
    description: 'Switch to a different project context',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Project name to switch to',
        },
      },
      required: ['project'],
    },
  },
  {
    name: 'session-start',
    description: 'Start a new development session for the current or specified project',
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Session description',
          default: 'Development session',
        },
        project: {
          type: 'string',
          description: 'Optional: specific project (defaults to current)',
        },
      },
    },
  },
  {
    name: 'session-checkpoint',
    description: 'Save a checkpoint in the current project session',
    inputSchema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Checkpoint summary',
        },
        project: {
          type: 'string',
          description: 'Optional: specific project (defaults to current)',
        },
      },
      required: ['summary'],
    },
  },
  {
    name: 'session-end',
    description: 'End the current project session with cleanup',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Optional: specific project (defaults to current)',
        },
      },
    },
  },
  {
    name: 'session-status',
    description: 'Check session and warmup status for current or specified project',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Optional: specific project (defaults to current)',
        },
      },
    },
  },
  {
    name: 'record_architectural_decision',
    description: 'Record an architectural decision for the current project',
    inputSchema: {
      type: 'object',
      properties: {
        decision: {
          type: 'string',
          description: 'The architectural decision made',
        },
        context: {
          type: 'string',
          description: 'Context and reasoning behind the decision',
        },
        alternatives: {
          type: 'array',
          items: { type: 'string' },
          description: 'Alternative approaches considered',
        },
        project: {
          type: 'string',
          description: 'Optional: specific project (defaults to current)',
        },
      },
      required: ['decision', 'context'],
    },
  },
];

// Initialize server
async function initialize() {
  await projectManager.initialize();
  
  // Set up request handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    console.error(`[DevAssist] Handling command: ${name}`);
    
    try {
      switch (name) {
        case 'initproject':
        case 'setup-project': {
          // Now handled by Prjctzr
          return {
            content: [{
              type: 'text',
              text: `⚠️ Project initialization is now handled by Prjctzr!\n\n` +
                    `Use: prjctzr:init name="${args.name || 'my-project'}" features=["devassist"]\n\n` +
                    `This will create the project AND set up DevAssist infrastructure.`,
            }],
          };
        }
        
        case 'list_projects': {
          const projects = await projectManager.listProjects();
          const projectList = projects.map(p => 
            `${p.current ? '→ ' : '  '}${p.name} (${p.sessions} sessions, ${p.decisions} decisions)`
          ).join('\n');
          
          return {
            content: [{
              type: 'text',
              text: `📁 DevAssist Projects:\n\n${projectList}\n\nCurrent: ${projectManager.getCurrentProject()?.name || 'none'}`,
            }],
          };
        }
        
        case 'switch_project': {
          const project = await projectManager.switchProject(args.project);
          return {
            content: [{
              type: 'text',
              text: `✅ Switched to project: ${project.name}\nPath: ${project.path}`,
            }],
          };
        }
        
        case 'session-start': {
          const project = await projectManager.getProjectContext('session-start', args);
          if (!project) {
            return {
              content: [{
                type: 'text',
                text: '❌ No project detected. Please run from a project directory or specify project:name',
              }],
            };
          }
          
          const sessionManager = await getSessionManager(project);
          const session = await sessionManager.startSession(args.description);
          
          // Perform warmup if enabled
          let warmupStatus = '';
          if (process.env.DEVASSIST_WARMUP_ENABLED !== 'false') {
            try {
              const warmupManager = new WarmUpManager(project.path, {}, sessionManager);
              const warmupResult = await warmupManager.performWarmUp(session.id);
              if (warmupResult.performed) {
                warmupStatus = '\n🔥 Warmup complete - context preloaded';
              }
            } catch (error) {
              console.error('[DevAssist] Warmup error:', error);
            }
          }
          
          // Start terminal logging
          const terminalLogger = new TerminalLogger(project.path, session.id);
          await terminalLogger.startLogging();
          
          // Start heartbeat for long sessions
          const heartbeat = createSessionHeartbeat(sessionManager);
          heartbeat.start();
          
          // Track both for cleanup
          activeHeartbeats.set(project.name, { heartbeat, terminalLogger });
          
          return {
            content: [{
              type: 'text',
              text: `✅ Started session for ${project.name}\nID: ${session.id}\nDescription: ${session.description}${warmupStatus}\n💓 Heartbeat active - staying engaged\n📝 Terminal logging enabled`,
            }],
          };
        }
        
        case 'session-checkpoint': {
          const project = await projectManager.getProjectContext('session-checkpoint', args);
          if (!project) {
            return {
              content: [{
                type: 'text',
                text: '❌ No project detected. Please run from a project directory or specify project:name',
              }],
            };
          }
          
          const sessionManager = await getSessionManager(project);
          await sessionManager.createCheckpoint(args.summary);
          
          return {
            content: [{
              type: 'text',
              text: `✅ Checkpoint saved for ${project.name}: ${args.summary}`,
            }],
          };
        }
        
        case 'session-end': {
          const project = await projectManager.getProjectContext('session-end', args);
          if (!project) {
            return {
              content: [{
                type: 'text',
                text: '❌ No project detected. Please run from a project directory or specify project:name',
              }],
            };
          }
          
          const sessionManager = await getSessionManager(project);
          
          // Perform cleanup before ending session
          const cleanupManager = new CleanupManager(project.path, sessionManager.currentSession?.id);
          const cleanupReport = await cleanupManager.performCleanup();
          
          const summary = await sessionManager.endSession();
          
          // Stop heartbeat and terminal logging if active
          const trackers = activeHeartbeats.get(project.name);
          if (trackers) {
            trackers.heartbeat?.stop();
            await trackers.terminalLogger?.stopLogging();
            activeHeartbeats.delete(project.name);
          }
          
          return {
            content: [{
              type: 'text',
              text: `🏁 Session ended for ${project.name}\n💓 Heartbeat stopped\n📝 Terminal logging stopped\n🧹 Cleanup complete\n\n${summary}\n\n${cleanupReport}`,
            }],
          };
        }
        
        case 'session-status': {
          const project = await projectManager.getProjectContext('session-status', args);
          if (!project) {
            return {
              content: [{
                type: 'text',
                text: '❌ No project detected. Please run from a project directory or specify project:name',
              }],
            };
          }
          
          const sessionManager = await getSessionManager(project);
          const status = await sessionManager.getStatus();
          
          return {
            content: [{
              type: 'text',
              text: `📊 ${project.name} Status:\n${status}`,
            }],
          };
        }
        
        case 'record_architectural_decision': {
          const project = await projectManager.getProjectContext('record_architectural_decision', args);
          if (!project) {
            return {
              content: [{
                type: 'text',
                text: '❌ No project detected. Please run from a project directory or specify project:name',
              }],
            };
          }
          
          const decisionPath = projectManager.getDataPath(project, 'decisions');
          const decision = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            decision: args.decision,
            context: args.context,
            alternatives: args.alternatives || [],
            project: project.name,
          };
          
          await fs.mkdir(decisionPath, { recursive: true });
          await fs.writeFile(
            path.join(decisionPath, `${decision.id}.json`),
            JSON.stringify(decision, null, 2)
          );
          
          return {
            content: [{
              type: 'text',
              text: `✅ Recorded architectural decision for ${project.name}:\n"${args.decision}"`,
            }],
          };
        }
        
        default:
          return {
            content: [{
              type: 'text',
              text: `Unknown command: ${name}`,
            }],
          };
      }
    } catch (error) {
      console.error(`[DevAssist] Error handling ${name}:`, error);
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`,
        }],
      };
    }
  });
  
  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('[DevAssist] Server ready (Refactored for multi-project support)');
  console.error(`[DevAssist] Managing ${(await projectManager.listProjects()).length} projects`);
  if (projectManager.getCurrentProject()) {
    console.error(`[DevAssist] Current project: ${projectManager.getCurrentProject().name}`);
  }
}

// Start the server
initialize().catch(console.error);
