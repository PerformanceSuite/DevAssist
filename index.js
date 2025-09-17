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

// New v3.0 imports for intelligent agent generation
import { IntelligentAgentGenerator } from './src/agents/intelligent-agent-generator.js';
import { ProjectAnalyzer } from './src/analysis/project-analyzer.js';
import { AgentTemplateEngine } from './src/agents/agent-template-engine.js';
import { WorkflowOrchestrator } from './src/claude/workflow-orchestrator.js';
import { ContinuousLearner } from './src/learning/pattern-scanner.js';

// UI Module import (optional enhancement)
let uiModuleAvailable = false;
let UIModeManager = null;
try {
  const uiModule = await import('./ui-module/index.js');
  UIModeManager = uiModule.UIModeManager;
  uiModuleAvailable = true;
  console.error('[DevAssist] UI Module loaded - Enhanced UI development mode available');
} catch (error) {
  console.error('[DevAssist] UI Module not available - run npm install in ui-module/ to enable');
}

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
  // New v3.0 Intelligent Agent Tools
  {
    name: 'init_claude_code',
    description: 'Generate complete Claude Code configuration with optimized agents for your project - analyzes codebase and creates 15-20 specialized agents, MCPs, and workflows',
    inputSchema: {
      type: 'object',
      properties: {
        project_path: {
          type: 'string',
          description: 'Project path to configure (defaults to current directory)',
        },
        complexity_override: {
          type: 'string',
          enum: ['auto', 'low', 'medium', 'high', 'enterprise'],
          description: 'Override automatic complexity detection',
          default: 'auto',
        },
        force: {
          type: 'boolean',
          description: 'Regenerate even if configuration exists',
          default: false,
        },
      },
    },
  },
  {
    name: 'analyze_project_for_agents',
    description: 'Deep analysis of project to recommend optimal agent configuration - detects tech stack, architecture, and special requirements',
    inputSchema: {
      type: 'object',
      properties: {
        project_path: {
          type: 'string',
          description: 'Project path to analyze (defaults to current directory)',
        },
        verbose: {
          type: 'boolean',
          description: 'Include detailed analysis results',
          default: false,
        },
      },
    },
  },
  {
    name: 'update_agent_capabilities',
    description: 'Scan for new patterns and update agent templates with latest techniques and best practices',
    inputSchema: {
      type: 'object',
      properties: {
        scan_sources: {
          type: 'array',
          items: { type: 'string' },
          description: 'Sources to scan for updates',
          default: ['github-trending', 'tech-blogs', 'mcp-registry'],
        },
        apply_updates: {
          type: 'boolean',
          description: 'Automatically apply discovered updates',
          default: false,
        },
      },
    },
  },
  {
    name: 'generate_agent_workflow',
    description: 'Create a multi-agent workflow for specific tasks like deployment, testing, or compliance',
    inputSchema: {
      type: 'object',
      properties: {
        workflow_type: {
          type: 'string',
          enum: ['feature-development', 'deployment', 'testing', 'security', 'compliance', 'performance'],
          description: 'Type of workflow to generate',
        },
        project_path: {
          type: 'string',
          description: 'Project path (defaults to current directory)',
        },
        agents: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific agents to include in workflow',
        },
      },
      required: ['workflow_type'],
    },
  },
  {
    name: 'list_available_agents',
    description: 'List all available agent templates and their specializations',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['all', 'architecture', 'development', 'operations', 'quality', 'specialized'],
          description: 'Filter agents by category',
          default: 'all',
        },
        complexity_level: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'enterprise'],
          description: 'Filter agents by complexity level',
        },
      },
    },
  },
];

// Add UI Mode tools if module is available
if (uiModuleAvailable) {
  tools.push(
    {
      name: 'toggle_ui_mode',
      description: 'Switch between standard and UI development mode for rapid visual iteration',
      inputSchema: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['ui', 'standard'],
            description: 'The mode to switch to',
          },
        },
        required: ['mode'],
      },
    },
    {
      name: 'ui_navigate',
      description: 'Navigate browser to a specific component or URL in UI mode',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to navigate to',
          },
        },
        required: ['url'],
      },
    },
    {
      name: 'ui_set_viewport',
      description: 'Change browser viewport to test responsive design',
      inputSchema: {
        type: 'object',
        properties: {
          preset: {
            type: 'string',
            enum: ['desktop', 'tablet', 'mobile', 'iPhone15', 'iPadPro'],
            description: 'Viewport preset name',
          },
          width: {
            type: 'number',
            description: 'Custom viewport width',
          },
          height: {
            type: 'number',
            description: 'Custom viewport height',
          },
        },
      },
    },
    {
      name: 'ui_validate_design',
      description: 'Run design validation checks on current page',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'ui_capture_iteration',
      description: 'Capture current UI state as a design iteration',
      inputSchema: {
        type: 'object',
        properties: {
          fullPage: {
            type: 'boolean',
            description: 'Capture full page or viewport only',
            default: true,
          },
        },
      },
    }
  );
}

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

        // New v3.0 Intelligent Agent Tool Handlers
        case 'init_claude_code': {
          const projectPath = args.project_path || process.cwd();
          const generator = new IntelligentAgentGenerator();

          try {
            const result = await generator.generateClaudeCodeSetup(projectPath);

            const summary = [
              `✅ Claude Code Configuration Complete!`,
              ``,
              `📊 Project Analysis:`,
              `  • Type: ${result.profile.type.join(', ')}`,
              `  • Complexity: ${result.profile.complexity.level} (${result.profile.complexity.score}/100)`,
              `  • Stack: ${result.profile.stack.languages.join(', ')}`,
              ``,
              `🤖 Generated ${result.agents.length} Specialized Agents:`,
              ...result.agents.slice(0, 5).map(a => `  • ${a.name} [${a.model}]`),
              result.agents.length > 5 ? `  ... and ${result.agents.length - 5} more` : '',
              ``,
              `🔌 Configured ${result.mcps.length} MCP Integrations`,
              `🔄 Created ${result.workflows.length} Multi-Agent Workflows`,
              `⚡ Generated ${result.commands.length} Slash Commands`,
              ``,
              `📁 Configuration saved to .claude/`,
              `🚀 Your intelligent agents are ready!`
            ].filter(Boolean);

            return {
              content: [{
                type: 'text',
                text: summary.join('\n'),
              }],
            };
          } catch (error) {
            return {
              content: [{
                type: 'text',
                text: `❌ Error generating Claude Code configuration: ${error.message}`,
              }],
            };
          }
        }

        case 'analyze_project_for_agents': {
          const projectPath = args.project_path || process.cwd();
          const analyzer = new ProjectAnalyzer({ verbose: args.verbose });

          try {
            const profile = await analyzer.deepAnalyze(projectPath);
            const generator = new IntelligentAgentGenerator();
            const recommendations = await generator.recommendAgents(profile);

            const analysis = [
              `📊 Project Analysis Results:`,
              ``,
              `Project: ${profile.name}`,
              `Type: ${profile.type.join(', ')}`,
              `Architecture: ${profile.patterns.architecture}`,
              `Complexity: ${profile.complexity.level} (Score: ${profile.complexity.score}/100)`,
              ``,
              `Technology Stack:`,
              `  • Languages: ${profile.stack.languages.join(', ')}`,
              `  • Frameworks: ${profile.stack.frameworks.join(', ')}`,
              `  • Databases: ${profile.stack.databases.join(', ')}`,
              `  • Cloud: ${profile.stack.cloud || 'None detected'}`,
              ``,
              `Recommended Agents:`,
              `  Required: ${recommendations.required.join(', ')}`,
              `  Recommended: ${recommendations.recommended.join(', ')}`,
              `  Optional: ${recommendations.optional.join(', ')}`
            ];

            if (profile.special.compliance?.length > 0) {
              analysis.push('', `⚠️ Compliance Requirements: ${profile.special.compliance.join(', ')}`);
            }

            if (profile.custom.oidc_wif) {
              analysis.push('⚠️ Special: OIDC/WIF Authentication detected');
            }

            if (args.verbose) {
              analysis.push('', `Full Profile:`, JSON.stringify(profile, null, 2));
            }

            return {
              content: [{
                type: 'text',
                text: analysis.join('\n'),
              }],
            };
          } catch (error) {
            return {
              content: [{
                type: 'text',
                text: `❌ Error analyzing project: ${error.message}`,
              }],
            };
          }
        }

        case 'update_agent_capabilities': {
          const learner = new ContinuousLearner();

          try {
            // Initialize with current project context
            const projectPath = process.cwd();
            const analyzer = new ProjectAnalyzer();
            const profile = await analyzer.deepAnalyze(projectPath);
            await learner.initialize(profile);

            const result = await learner.scanAndLearn();

            const update = [
              `🔄 Agent Capability Update Report:`,
              ``,
              `New Patterns Discovered: ${result.stats.patterns}`,
              `Techniques Learned: ${result.stats.techniques}`,
              `MCPs Available: ${result.stats.mcps}`,
              `Practices Updated: ${result.stats.practices}`,
              `Framework Updates: ${result.stats.frameworks}`,
              ``,
              result.report
            ];

            if (args.apply_updates && result.stats.patterns + result.stats.techniques > 0) {
              update.push('', '✅ Updates have been applied to agent templates');
            }

            return {
              content: [{
                type: 'text',
                text: update.join('\n'),
              }],
            };
          } catch (error) {
            return {
              content: [{
                type: 'text',
                text: `❌ Error updating capabilities: ${error.message}`,
              }],
            };
          }
        }

        case 'generate_agent_workflow': {
          const projectPath = args.project_path || process.cwd();
          const orchestrator = new WorkflowOrchestrator();

          try {
            const analyzer = new ProjectAnalyzer();
            const profile = await analyzer.deepAnalyze(projectPath);

            // Get or generate agents
            let agents = args.agents || [];
            if (agents.length === 0) {
              const generator = new IntelligentAgentGenerator();
              const generatedAgents = await generator.generateAgentsForComplexity(profile);
              agents = generatedAgents.map(a => ({ name: a.name, model: a.model }));
            }

            // Create specific workflow
            let workflow;
            switch (args.workflow_type) {
              case 'deployment':
                workflow = await orchestrator.createDeploymentWorkflow(profile, agents);
                break;
              case 'testing':
                workflow = await orchestrator.createTestingWorkflow(profile, agents);
                break;
              case 'security':
                workflow = await orchestrator.createSecurityWorkflow(profile, agents);
                break;
              case 'compliance':
                workflow = await orchestrator.createComplianceWorkflow(profile, agents);
                break;
              case 'performance':
                workflow = await orchestrator.createPerformanceWorkflow(profile, agents);
                break;
              default:
                workflow = await orchestrator.createFeatureDevelopmentWorkflow(profile, agents);
            }

            // Save workflow
            await orchestrator.saveWorkflows([workflow], projectPath);

            const summary = [
              `✅ Generated ${args.workflow_type} workflow`,
              ``,
              `Workflow: ${workflow.name}`,
              `Description: ${workflow.description}`,
              `Agents Involved: ${workflow.agents?.length || 0}`,
              `Steps: ${workflow.steps?.length || 0}`,
              ``,
              `Workflow saved to .claude/workflows/${workflow.name}.json`
            ];

            return {
              content: [{
                type: 'text',
                text: summary.join('\n'),
              }],
            };
          } catch (error) {
            return {
              content: [{
                type: 'text',
                text: `❌ Error generating workflow: ${error.message}`,
              }],
            };
          }
        }

        case 'list_available_agents': {
          const templateEngine = new AgentTemplateEngine();
          await templateEngine.initialize();

          const registry = await templateEngine.createTemplateRegistry();
          const category = args.category || 'all';

          const output = [`📋 Available Agent Templates:\n`];

          const displayCategory = (name, agents) => {
            if (category === 'all' || category === name.toLowerCase()) {
              output.push(`${name}:`);
              agents.forEach(agent => {
                output.push(`  • ${agent}`);
              });
              output.push('');
            }
          };

          displayCategory('Architecture', registry.architecture);
          displayCategory('Development', registry.development);
          displayCategory('Operations', registry.operations);
          displayCategory('Quality', registry.quality);
          displayCategory('Data', registry.data);
          displayCategory('Specialized', registry.specialized);

          output.push(`Total: 82+ specialized agents available`);
          output.push(`\nUse 'init_claude_code' to automatically configure agents for your project`);

          return {
            content: [{
              type: 'text',
              text: output.join('\n'),
            }],
          };
        }

        // UI Mode handlers (if available)
        case 'toggle_ui_mode': {
          if (!uiModuleAvailable) {
            return {
              content: [{
                type: 'text',
                text: '❌ UI Module not available. Run: cd ui-module && npm install',
              }],
            };
          }

          const project = await projectManager.getProjectContext('ui-mode', args);
          if (!project) {
            return {
              content: [{
                type: 'text',
                text: '❌ No project detected. Please run from a project directory',
              }],
            };
          }

          // Initialize UI mode manager for project
          if (!project.uiManager) {
            project.uiManager = new UIModeManager({
              projectRoot: project.path,
              autoStart: false,
            });
          }

          if (args.mode === 'ui') {
            await project.uiManager.enterUIMode();
            return {
              content: [{
                type: 'text',
                text: '🎨 UI Mode activated\n• Browser session started\n• File watcher active\n• Design validation enabled\n• Visual iterations tracking',
              }],
            };
          } else {
            await project.uiManager.exitUIMode();
            return {
              content: [{
                type: 'text',
                text: '✅ Returned to standard mode',
              }],
            };
          }
        }

        case 'ui_navigate': {
          if (!uiModuleAvailable) {
            return {
              content: [{
                type: 'text',
                text: '❌ UI Module not available',
              }],
            };
          }

          const project = await projectManager.getProjectContext('ui-navigate', args);
          if (!project?.uiManager) {
            return {
              content: [{
                type: 'text',
                text: '❌ UI Mode not active. Use toggle_ui_mode first',
              }],
            };
          }

          await project.uiManager.navigateTo(args.url);
          return {
            content: [{
              type: 'text',
              text: `🌐 Navigated to: ${args.url}`,
            }],
          };
        }

        case 'ui_set_viewport': {
          if (!uiModuleAvailable) {
            return {
              content: [{
                type: 'text',
                text: '❌ UI Module not available',
              }],
            };
          }

          const project = await projectManager.getProjectContext('ui-viewport', args);
          if (!project?.uiManager) {
            return {
              content: [{
                type: 'text',
                text: '❌ UI Mode not active. Use toggle_ui_mode first',
              }],
            };
          }

          if (args.preset) {
            await project.uiManager.setViewport(args.preset);
            return {
              content: [{
                type: 'text',
                text: `📱 Viewport changed to: ${args.preset}`,
              }],
            };
          } else if (args.width && args.height) {
            await project.uiManager.setViewport({ width: args.width, height: args.height });
            return {
              content: [{
                type: 'text',
                text: `📐 Viewport set to: ${args.width}x${args.height}`,
              }],
            };
          }
        }

        case 'ui_validate_design': {
          if (!uiModuleAvailable) {
            return {
              content: [{
                type: 'text',
                text: '❌ UI Module not available',
              }],
            };
          }

          const project = await projectManager.getProjectContext('ui-validate', args);
          if (!project?.uiManager) {
            return {
              content: [{
                type: 'text',
                text: '❌ UI Mode not active. Use toggle_ui_mode first',
              }],
            };
          }

          const report = await project.uiManager.runValidation();
          const issues = report.results.filter(r => !r.passed);

          return {
            content: [{
              type: 'text',
              text: `✅ Design Validation Complete\n\nScore: ${report.score.percentage}%\n${report.score.failed} errors, ${report.score.warnings} warnings\n\n${issues.slice(0, 5).map(i => `• ${i.message}`).join('\n')}`,
            }],
          };
        }

        case 'ui_capture_iteration': {
          if (!uiModuleAvailable) {
            return {
              content: [{
                type: 'text',
                text: '❌ UI Module not available',
              }],
            };
          }

          const project = await projectManager.getProjectContext('ui-capture', args);
          if (!project?.uiManager) {
            return {
              content: [{
                type: 'text',
                text: '❌ UI Mode not active. Use toggle_ui_mode first',
              }],
            };
          }

          const screenshot = await project.uiManager.captureScreenshot(args.fullPage);
          const iterations = project.uiManager.getIterations(1);
          const latest = iterations[0];

          return {
            content: [{
              type: 'text',
              text: `📸 Design iteration captured\nID: ${latest?.id}\nTimestamp: ${new Date(latest?.timestamp).toLocaleString()}`,
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
