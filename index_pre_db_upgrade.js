#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { execSync, exec } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create server instance
const server = new Server({
  name: 'devassist-mcp',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

// Define development assistance tools
const tools = [
  {
    name: 'analyze_codebase',
    description: 'Analyze the current codebase structure and identify patterns',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to analyze (absolute or relative)',
          default: '.',
        },
        depth: {
          type: 'number',
          description: 'Directory depth to analyze',
          default: 3,
        },
        pattern: {
          type: 'string',
          description: 'File pattern to match (e.g., *.py, *.js)',
          default: '*',
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
        impact: {
          type: 'string',
          description: 'Expected impact on the system',
        },
        project: {
          type: 'string',
          description: 'Project name (for multi-project support)',
          default: 'default',
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
          description: 'Category to filter by',
          enum: ['decisions', 'progress', 'lessons', 'architecture', 'all'],
          default: 'all',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return',
          default: 10,
        },
        project: {
          type: 'string',
          description: 'Project name to search within',
          default: 'default',
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
        },
        status: {
          type: 'string',
          description: 'Current status',
          enum: ['not_started', 'in_progress', 'testing', 'completed', 'blocked'],
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
        project: {
          type: 'string',
          description: 'Project name',
          default: 'default',
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
          description: 'Path to analyze',
          default: '.',
        },
        similarity_threshold: {
          type: 'number',
          description: 'Similarity threshold (0.0 to 1.0)',
          default: 0.7,
        },
      },
    },
  },
  {
    name: 'get_documentation',
    description: 'Retrieve documentation for SuperCollider, Claude Code, or project-specific features',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Documentation topic to retrieve',
        },
        source: {
          type: 'string',
          description: 'Documentation source',
          enum: ['supercollider', 'claude_code', 'project', 'all'],
          default: 'all',
        },
        search_depth: {
          type: 'number',
          description: 'How deep to search for relevant content',
          default: 3,
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'analyze_dependencies',
    description: 'Analyze project dependencies and their relationships',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Project path to analyze',
          default: '.',
        },
        include_dev: {
          type: 'boolean',
          description: 'Include development dependencies',
          default: true,
        },
        check_updates: {
          type: 'boolean',
          description: 'Check for available updates',
          default: false,
        },
      },
    },
  },
  {
    name: 'generate_summary',
    description: 'Generate a summary of recent development activity and decisions',
    inputSchema: {
      type: 'object',
      properties: {
        days_back: {
          type: 'number',
          description: 'Number of days to look back',
          default: 7,
        },
        include_commits: {
          type: 'boolean',
          description: 'Include git commit history',
          default: true,
        },
        project: {
          type: 'string',
          description: 'Project to summarize',
          default: 'default',
        },
      },
    },
  },
];

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Handle tools/list requests
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools,
}));

// Handle tools/call requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'analyze_codebase': {
        const { path: analyzePath = '.', depth = 3, pattern = '*' } = args || {};
        
        try {
          // Get absolute path
          const fullPath = path.isAbsolute(analyzePath) ? analyzePath : path.resolve(analyzePath);
          
          // Build find command based on pattern
          let findCmd = `find "${fullPath}" -maxdepth ${depth} -type f`;
          if (pattern !== '*') {
            findCmd += ` -name "${pattern}"`;
          }
          
          // Execute analysis
          const files = execSync(`${findCmd} 2>/dev/null | head -100`, {
            encoding: 'utf8',
          }).trim().split('\n').filter(line => line);
          
          // Count by file type
          const fileTypes = {};
          files.forEach(file => {
            const ext = path.extname(file) || 'no-extension';
            fileTypes[ext] = (fileTypes[ext] || 0) + 1;
          });
          
          // Get total line count for code files
          const codeFiles = files.filter(f => /\.(py|js|ts|jsx|tsx|java|cpp|c|h|go|rs|scd)$/.test(f));
          let totalLines = 0;
          if (codeFiles.length > 0) {
            try {
              totalLines = parseInt(execSync(`cat ${codeFiles.join(' ')} 2>/dev/null | wc -l`, {
                encoding: 'utf8',
              }).trim()) || 0;
            } catch (e) {
              // Ignore errors in line counting
            }
          }
          
          return {
            content: [
              {
                type: 'text',
                text: `Codebase Analysis for ${fullPath}:
                
Files found: ${files.length}
Code files: ${codeFiles.length}
Total lines of code: ${totalLines}

File types breakdown:
${Object.entries(fileTypes)
  .sort((a, b) => b[1] - a[1])
  .map(([ext, count]) => `  ${ext}: ${count} files`)
  .join('\n')}

Sample files:
${files.slice(0, 10).map(f => `  - ${f}`).join('\n')}`,
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
        const { decision, context, alternatives, impact, project = 'default' } = args || {};
        
        try {
          // Load existing decisions
          const decisionsFile = path.join(dataDir, `${project}_decisions.json`);
          let decisions = [];
          
          if (existsSync(decisionsFile)) {
            try {
              decisions = JSON.parse(readFileSync(decisionsFile, 'utf8'));
            } catch (e) {
              // Start fresh if file is corrupted
            }
          }
          
          // Add new decision
          const newDecision = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            decision,
            context,
            alternatives: alternatives || [],
            impact: impact || 'Not specified',
            project,
          };
          
          decisions.push(newDecision);
          
          // Save decisions
          writeFileSync(decisionsFile, JSON.stringify(decisions, null, 2));
          
          return {
            content: [
              {
                type: 'text',
                text: `✅ Architectural decision recorded successfully:

**Decision**: ${decision}
**Context**: ${context}
**Impact**: ${impact || 'Not specified'}
**Alternatives**: ${alternatives?.length ? alternatives.join(', ') : 'None specified'}
**Project**: ${project}
**Timestamp**: ${newDecision.timestamp}

This decision has been saved and will be maintained in project memory.`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error recording decision: ${error.message}`,
              },
            ],
          };
        }
      }

      case 'get_project_memory': {
        const { query, category = 'all', limit = 10, project = 'default' } = args || {};
        
        try {
          // Load decisions and progress
          const decisionsFile = path.join(dataDir, `${project}_decisions.json`);
          const progressFile = path.join(dataDir, `${project}_progress.json`);
          
          let memories = [];
          
          // Load decisions
          if (existsSync(decisionsFile)) {
            try {
              const decisions = JSON.parse(readFileSync(decisionsFile, 'utf8'));
              decisions.forEach(d => {
                memories.push({
                  ...d,
                  type: 'decision',
                  category: 'decisions',
                });
              });
            } catch (e) {
              // Ignore corrupted files
            }
          }
          
          // Load progress
          if (existsSync(progressFile)) {
            try {
              const progress = JSON.parse(readFileSync(progressFile, 'utf8'));
              progress.forEach(p => {
                memories.push({
                  ...p,
                  type: 'progress',
                  category: 'progress',
                });
              });
            } catch (e) {
              // Ignore corrupted files
            }
          }
          
          // Filter by category
          if (category !== 'all') {
            memories = memories.filter(m => m.category === category);
          }
          
          // Search by query
          if (query) {
            const searchQuery = query.toLowerCase();
            memories = memories.filter(m => {
              const searchableText = JSON.stringify(m).toLowerCase();
              return searchableText.includes(searchQuery);
            });
          }
          
          // Sort by timestamp (newest first)
          memories.sort((a, b) => {
            const timeA = new Date(a.timestamp || a.lastUpdated || 0).getTime();
            const timeB = new Date(b.timestamp || b.lastUpdated || 0).getTime();
            return timeB - timeA;
          });
          
          // Limit results
          memories = memories.slice(0, limit);
          
          if (memories.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No project memory found${query ? ` for query: "${query}"` : ''}${category !== 'all' ? ` in category: ${category}` : ''}.

Use record_architectural_decision and track_progress to build project memory.`,
                },
              ],
            };
          }
          
          // Format output
          const formattedMemories = memories.map(m => {
            if (m.type === 'decision') {
              return `📋 **Decision**: ${m.decision}
   Context: ${m.context}
   Impact: ${m.impact}
   Date: ${new Date(m.timestamp).toLocaleDateString()}`;
            } else if (m.type === 'progress') {
              return `📊 **Milestone**: ${m.milestone}
   Status: ${m.status}
   Notes: ${m.notes || 'None'}
   Date: ${new Date(m.lastUpdated || m.created).toLocaleDateString()}`;
            }
            return '';
          }).filter(text => text).join('\n\n');
          
          return {
            content: [
              {
                type: 'text',
                text: `🧠 Project Memory (${memories.length} results):

${formattedMemories}`,
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
        const { milestone, status, notes, blockers, project = 'default' } = args || {};
        
        try {
          // Load existing progress
          const progressFile = path.join(dataDir, `${project}_progress.json`);
          let progress = [];
          
          if (existsSync(progressFile)) {
            try {
              progress = JSON.parse(readFileSync(progressFile, 'utf8'));
            } catch (e) {
              // Start fresh if file is corrupted
            }
          }
          
          // Find or create milestone entry
          const existingIndex = progress.findIndex(p => p.milestone === milestone && p.project === project);
          
          if (existingIndex >= 0) {
            // Update existing
            progress[existingIndex] = {
              ...progress[existingIndex],
              status,
              notes: notes || progress[existingIndex].notes,
              blockers: blockers || progress[existingIndex].blockers,
              lastUpdated: new Date().toISOString(),
            };
          } else {
            // Create new
            progress.push({
              id: Date.now(),
              milestone,
              status,
              notes: notes || '',
              blockers: blockers || [],
              project,
              created: new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
            });
          }
          
          // Save progress
          writeFileSync(progressFile, JSON.stringify(progress, null, 2));
          
          return {
            content: [
              {
                type: 'text',
                text: `📊 Progress tracked successfully:

**Milestone**: ${milestone}
**Status**: ${status}
**Notes**: ${notes || 'None'}
**Blockers**: ${blockers?.length ? blockers.join(', ') : 'None'}
**Project**: ${project}

Progress has been saved to project memory.`,
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
        const { feature, path: searchPath = '.', similarity_threshold = 0.7 } = args || {};
        
        try {
          const fullPath = path.isAbsolute(searchPath) ? searchPath : path.resolve(searchPath);
          
          if (!feature) {
            // General duplicate analysis
            const result = execSync(`find "${fullPath}" -type f \\( -name "*.py" -o -name "*.js" -o -name "*.ts" \\) -exec grep -l "function\\|def\\|class" {} \\; 2>/dev/null | head -20`, {
              encoding: 'utf8',
            }).trim();
            
            return {
              content: [
                {
                  type: 'text',
                  text: `🔍 General codebase scan for potential duplicates:

${result}

Tip: Use identify_duplicate_effort with a specific feature name to check for duplicate functionality.`,
                },
              ],
            };
          }
          
          // Search for specific feature
          const searchResults = execSync(`grep -r "${feature}" "${fullPath}" --include="*.py" --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" 2>/dev/null | head -20`, {
            encoding: 'utf8',
          }).trim();
          
          if (!searchResults) {
            return {
              content: [
                {
                  type: 'text',
                  text: `✅ No duplicate functionality found for "${feature}".

The feature appears to be unique in the codebase.`,
                },
              ],
            };
          }
          
          // Parse results
          const matches = searchResults.split('\n');
          const fileCount = new Set(matches.map(m => m.split(':')[0])).size;
          
          return {
            content: [
              {
                type: 'text',
                text: `⚠️ Potential duplicate effort detected for "${feature}":

Found ${matches.length} references across ${fileCount} files:

${matches.slice(0, 10).map(m => `  - ${m}`).join('\n')}

Consider reviewing these existing implementations before creating new functionality.`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error identifying duplicates: ${error.message}`,
              },
            ],
          };
        }
      }

      case 'get_documentation': {
        const { topic, source = 'all', search_depth = 3 } = args || {};
        
        try {
          let documentation = [];
          
          // SuperCollider documentation
          if (source === 'supercollider' || source === 'all') {
            documentation.push({
              source: 'SuperCollider',
              content: `SuperCollider is a platform for audio synthesis and algorithmic composition.

Key concepts related to "${topic}":
- SynthDef: Define synthesizers
- Patterns: Create musical sequences
- UGens: Unit generators for sound synthesis
- OSC: Open Sound Control for communication
- Buffers: Audio sample storage
- Groups: Organize synths hierarchically

For detailed documentation, visit: https://doc.sccode.org/`,
            });
          }
          
          // Claude Code documentation
          if (source === 'claude_code' || source === 'all') {
            documentation.push({
              source: 'Claude Code',
              content: `Claude Code is Anthropic's AI coding assistant.

Key features related to "${topic}":
- MCP Protocol: Model Context Protocol for tool integration
- File operations: Read, write, edit files
- Bash commands: Execute system commands
- Project understanding: Analyze codebases
- Multi-file editing: Make coordinated changes
- Testing: Run and analyze test suites

For more info: https://claude.ai/code`,
            });
          }
          
          // Project documentation
          if (source === 'project' || source === 'all') {
            // Search for README files and docs
            try {
              const docFiles = execSync(`find . -maxdepth ${search_depth} \\( -name "README*" -o -name "*.md" -o -path "*/docs/*" \\) -type f 2>/dev/null | head -10`, {
                encoding: 'utf8',
              }).trim().split('\n').filter(line => line);
              
              documentation.push({
                source: 'Project',
                content: `Project documentation files found:
${docFiles.map(f => `  - ${f}`).join('\n')}

Search these files for information about "${topic}".`,
              });
            } catch (e) {
              documentation.push({
                source: 'Project',
                content: 'No project documentation found.',
              });
            }
          }
          
          if (documentation.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No documentation found for "${topic}" in source: ${source}`,
                },
              ],
            };
          }
          
          return {
            content: [
              {
                type: 'text',
                text: `📚 Documentation for "${topic}":

${documentation.map(d => `## ${d.source}\n\n${d.content}`).join('\n\n')}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error retrieving documentation: ${error.message}`,
              },
            ],
          };
        }
      }

      case 'analyze_dependencies': {
        const { path: projectPath = '.', include_dev = true, check_updates = false } = args || {};
        
        try {
          const fullPath = path.isAbsolute(projectPath) ? projectPath : path.resolve(projectPath);
          let analysis = [];
          
          // Check for package.json (Node.js)
          const packageJsonPath = path.join(fullPath, 'package.json');
          if (existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
            const deps = packageJson.dependencies || {};
            const devDeps = include_dev ? (packageJson.devDependencies || {}) : {};
            
            analysis.push({
              type: 'Node.js',
              file: 'package.json',
              dependencies: Object.keys(deps).length,
              devDependencies: Object.keys(devDeps).length,
              main: [...Object.entries(deps), ...(include_dev ? Object.entries(devDeps) : [])]
                .slice(0, 10)
                .map(([name, version]) => `${name}: ${version}`),
            });
          }
          
          // Check for requirements.txt (Python)
          const requirementsPath = path.join(fullPath, 'requirements.txt');
          if (existsSync(requirementsPath)) {
            const requirements = readFileSync(requirementsPath, 'utf8')
              .split('\n')
              .filter(line => line.trim() && !line.startsWith('#'));
            
            analysis.push({
              type: 'Python',
              file: 'requirements.txt',
              dependencies: requirements.length,
              main: requirements.slice(0, 10),
            });
          }
          
          // Check for Cargo.toml (Rust)
          const cargoPath = path.join(fullPath, 'Cargo.toml');
          if (existsSync(cargoPath)) {
            const cargoContent = readFileSync(cargoPath, 'utf8');
            const depMatch = cargoContent.match(/\[dependencies\]([\s\S]*?)(\[|$)/);
            const deps = depMatch ? depMatch[1].trim().split('\n').filter(line => line.trim()) : [];
            
            analysis.push({
              type: 'Rust',
              file: 'Cargo.toml',
              dependencies: deps.length,
              main: deps.slice(0, 10),
            });
          }
          
          if (analysis.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'No dependency files found in the specified path.',
                },
              ],
            };
          }
          
          return {
            content: [
              {
                type: 'text',
                text: `📦 Dependency Analysis for ${fullPath}:

${analysis.map(a => `**${a.type}** (${a.file}):
  Total dependencies: ${a.dependencies}${a.devDependencies ? `
  Dev dependencies: ${a.devDependencies}` : ''}
  
  Main dependencies:
${a.main.map(d => `    - ${d}`).join('\n')}`).join('\n\n')}

${check_updates ? '\n⚠️ Note: Update checking not yet implemented' : ''}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error analyzing dependencies: ${error.message}`,
              },
            ],
          };
        }
      }

      case 'generate_summary': {
        const { days_back = 7, include_commits = true, project = 'default' } = args || {};
        
        try {
          let summary = [];
          const since = new Date(Date.now() - days_back * 24 * 60 * 60 * 1000);
          
          // Load recent decisions
          const decisionsFile = path.join(dataDir, `${project}_decisions.json`);
          if (existsSync(decisionsFile)) {
            try {
              const decisions = JSON.parse(readFileSync(decisionsFile, 'utf8'));
              const recentDecisions = decisions.filter(d => new Date(d.timestamp) >= since);
              if (recentDecisions.length > 0) {
                summary.push({
                  type: 'Architectural Decisions',
                  count: recentDecisions.length,
                  items: recentDecisions.slice(0, 5).map(d => d.decision),
                });
              }
            } catch (e) {
              // Ignore errors
            }
          }
          
          // Load recent progress
          const progressFile = path.join(dataDir, `${project}_progress.json`);
          if (existsSync(progressFile)) {
            try {
              const progress = JSON.parse(readFileSync(progressFile, 'utf8'));
              const recentProgress = progress.filter(p => new Date(p.lastUpdated || p.created) >= since);
              if (recentProgress.length > 0) {
                summary.push({
                  type: 'Progress Updates',
                  count: recentProgress.length,
                  items: recentProgress.slice(0, 5).map(p => `${p.milestone}: ${p.status}`),
                });
              }
            } catch (e) {
              // Ignore errors
            }
          }
          
          // Get git commits if requested
          if (include_commits) {
            try {
              const sinceDate = since.toISOString().split('T')[0];
              const commits = execSync(`git log --since="${sinceDate}" --pretty=format:"%h - %s" 2>/dev/null | head -10`, {
                encoding: 'utf8',
              }).trim().split('\n').filter(line => line);
              
              if (commits.length > 0) {
                summary.push({
                  type: 'Git Commits',
                  count: commits.length,
                  items: commits.slice(0, 5),
                });
              }
            } catch (e) {
              // Not a git repo or git not available
            }
          }
          
          if (summary.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No activity found in the last ${days_back} days for project: ${project}`,
                },
              ],
            };
          }
          
          return {
            content: [
              {
                type: 'text',
                text: `📈 Development Summary (Last ${days_back} Days):

${summary.map(s => `**${s.type}** (${s.count} total):
${s.items.map(i => `  • ${i}`).join('\n')}`).join('\n\n')}

---
Generated on: ${new Date().toLocaleDateString()}
Project: ${project}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error generating summary: ${error.message}`,
              },
            ],
          };
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('DevAssist MCP Server running...');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});