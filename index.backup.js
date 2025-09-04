#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import new database functions
import { initDatabases } from './src/database/init.js';
import {
  recordDecision,
  trackProgress,
  getProjectMemory,
  semanticSearch,
  identifyDuplicates,
  addCodePattern,
  generateEmbedding
} from './src/database/dataAccess.js';

// Import documentation resources
import { 
  getDocumentationResources, 
  readDocumentationResource,
  hasDocumentation,
  getDocumentationPath
} from './src/resources/documentationResources.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize databases on startup
let dbInitialized = false;
async function ensureDbInitialized() {
  if (!dbInitialized) {
    await initDatabases();
    dbInitialized = true;
  }
}

// Create server instance
const server = new Server({
  name: 'devassist-mcp',
  version: '2.1.0', // Updated version with database and resource support
}, {
  capabilities: {
    tools: {},
    resources: {},
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
        index_patterns: {
          type: 'boolean',
          description: 'Index code patterns for duplicate detection',
          default: false,
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
    description: 'Retrieve project memory using semantic search',
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
    description: 'Use semantic search to identify potential duplicate functionality',
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
      required: ['feature'],
    },
  },
  {
    name: 'semantic_search',
    description: 'Search across all project data using natural language',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query',
        },
        search_type: {
          type: 'string',
          description: 'Type of data to search',
          enum: ['decisions', 'code_patterns', 'all'],
          default: 'all',
        },
        min_similarity: {
          type: 'number',
          description: 'Minimum similarity score (0.0 to 1.0)',
          default: 0.5,
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results',
          default: 10,
        },
        project: {
          type: 'string',
          description: 'Project to search within',
          default: null,
        },
      },
      required: ['query'],
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

// Handle tools/list requests
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools,
}));

// Handle resources/list requests
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    const resources = getDocumentationResources();
    return { resources };
  } catch (error) {
    console.error('Error listing resources:', error);
    return { resources: [] };
  }
});

// Handle resources/read requests
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  try {
    const { uri } = request.params;
    const resource = readDocumentationResource(uri);
    return {
      contents: [
        {
          uri: resource.uri,
          mimeType: resource.mimeType,
          text: resource.text
        }
      ]
    };
  } catch (error) {
    console.error('Error reading resource:', error);
    throw new Error(`Failed to read resource: ${error.message}`);
  }
});

// Handle tools/call requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Ensure databases are initialized
  await ensureDbInitialized();

  try {
    switch (name) {
      case 'analyze_codebase': {
        const { path: analyzePath = '.', depth = 3, pattern = '*', index_patterns = false } = args || {};
        
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
          
          // Index code patterns if requested
          let indexedCount = 0;
          if (index_patterns && codeFiles.length > 0) {
            for (const file of codeFiles.slice(0, 20)) { // Limit to first 20 files
              try {
                const content = execSync(`head -100 "${file}" 2>/dev/null`, { encoding: 'utf8' });
                const language = path.extname(file).slice(1) || 'unknown';
                await addCodePattern(file, content, language);
                indexedCount++;
              } catch (e) {
                // Skip files that can't be read
              }
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
${index_patterns ? `Code patterns indexed: ${indexedCount}` : ''}

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
          const result = await recordDecision({
            decision,
            context,
            alternatives,
            impact,
            project
          });
          
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
**ID**: ${result.id}
**Embedding ID**: ${result.embedding_id}

This decision has been indexed for semantic search and will be maintained in project memory.`,
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
          const memories = await getProjectMemory(query, category, limit, project);
          
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
              const similarity = m.similarity ? ` (similarity: ${(m.similarity * 100).toFixed(1)}%)` : '';
              return `📋 **Decision**: ${m.decision}${similarity}
   Context: ${m.context}
   Impact: ${m.impact}
   Date: ${new Date(m.timestamp).toLocaleDateString()}`;
            } else if (m.type === 'progress') {
              return `📊 **Milestone**: ${m.milestone}
   Status: ${m.status}
   Notes: ${m.notes || 'None'}
   Date: ${new Date(m.updated_at || m.created_at).toLocaleDateString()}`;
            }
            return '';
          }).filter(text => text).join('\n\n');
          
          return {
            content: [
              {
                type: 'text',
                text: `🧠 Project Memory (${memories.length} results)${query ? ` for "${query}"` : ''}:

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
          const id = await trackProgress({
            milestone,
            status,
            notes,
            blockers,
            project
          });
          
          return {
            content: [
              {
                type: 'text',
                text: `✅ Progress tracked successfully:

**Milestone**: ${milestone}
**Status**: ${status}
**Notes**: ${notes || 'None'}
**Blockers**: ${blockers?.length ? blockers.join(', ') : 'None'}
**Project**: ${project}
**ID**: ${id}

Progress has been recorded and will be tracked in project history.`,
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
          const result = await identifyDuplicates(feature, searchPath, similarity_threshold);
          
          if (result.duplicates.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `✅ ${result.message}

The feature "${feature}" appears to be unique in the codebase.`,
                },
              ],
            };
          }
          
          // Format duplicates with similarity scores
          const formattedDuplicates = result.duplicates
            .slice(0, 10)
            .map((d, i) => `${i + 1}. **${d.file_path}** (${(d.similarity * 100).toFixed(1)}% similar)
   Language: ${d.language}
   Preview: ${d.content.substring(0, 100)}...`)
            .join('\n\n');
          
          return {
            content: [
              {
                type: 'text',
                text: `⚠️ Potential duplicate effort detected for "${feature}":

${result.message}

Top matches:
${formattedDuplicates}

Consider reviewing these existing implementations before creating new functionality.`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error detecting duplicates: ${error.message}`,
              },
            ],
          };
        }
      }

      case 'semantic_search': {
        const { query, search_type = 'all', min_similarity = 0.5, limit = 10, project } = args || {};
        
        try {
          const results = [];
          
          if (search_type === 'all' || search_type === 'decisions') {
            const decisionResults = await semanticSearch(query, {
              table: 'decisions',
              project: project,
              limit: limit,
              threshold: min_similarity
            });
            results.push(...decisionResults.map(r => ({ ...r, type: 'decision' })));
          }
          
          if (search_type === 'all' || search_type === 'code_patterns') {
            const patternResults = await semanticSearch(query, {
              table: 'code_patterns',
              project: project,
              limit: limit,
              threshold: min_similarity
            });
            results.push(...patternResults.map(r => ({ ...r, type: 'code_pattern' })));
          }
          
          if (results.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No results found for query: "${query}"

Try adjusting your search terms or lowering the similarity threshold.`,
                },
              ],
            };
          }
          
          // Sort by similarity and format
          results.sort((a, b) => a._distance - b._distance);
          
          const formattedResults = results.slice(0, limit).map((r, i) => {
            const similarity = ((1 - r._distance) * 100).toFixed(1);
            if (r.type === 'decision') {
              return `${i + 1}. 📋 **Decision** (${similarity}% match)
   ${r.text.substring(0, 200)}...`;
            } else {
              return `${i + 1}. 💻 **Code Pattern** (${similarity}% match)
   File: ${r.file_path}
   ${r.content.substring(0, 100)}...`;
            }
          }).join('\n\n');
          
          return {
            content: [
              {
                type: 'text',
                text: `🔍 Semantic Search Results for "${query}":

Found ${results.length} results above ${(min_similarity * 100).toFixed(0)}% similarity:

${formattedResults}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error performing semantic search: ${error.message}`,
              },
            ],
          };
        }
      }

      case 'get_documentation': {
        const { topic, source = 'all', search_depth = 3 } = args || {};
        
        // For now, return placeholder as before
        // In future, this could use semantic search on indexed documentation
        return {
          content: [
            {
              type: 'text',
              text: `📚 Documentation search for "${topic}":

This feature will be enhanced to use semantic search on indexed documentation.

Current sources available:
- SuperCollider documentation
- Claude Code documentation  
- Project-specific documentation

For now, please refer to:
- SuperCollider: https://doc.sccode.org/
- Claude Code: https://claude.ai/docs
- Project docs: Check README.md and docs/ folder`,
            },
          ],
        };
      }

      case 'analyze_dependencies': {
        const { path: projectPath = '.', include_dev = true, check_updates = false } = args || {};
        
        try {
          const fullPath = path.isAbsolute(projectPath) ? projectPath : path.resolve(projectPath);
          
          // Check for package.json
          const packageJsonPath = path.join(fullPath, 'package.json');
          if (existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(require('fs').readFileSync(packageJsonPath, 'utf8'));
            const deps = packageJson.dependencies || {};
            const devDeps = include_dev ? (packageJson.devDependencies || {}) : {};
            
            return {
              content: [
                {
                  type: 'text',
                  text: `📦 Dependency Analysis for ${fullPath}:

Production Dependencies: ${Object.keys(deps).length}
${Object.entries(deps).map(([name, version]) => `  - ${name}: ${version}`).join('\n')}

${include_dev ? `Development Dependencies: ${Object.keys(devDeps).length}
${Object.entries(devDeps).map(([name, version]) => `  - ${name}: ${version}`).join('\n')}` : ''}

Total: ${Object.keys(deps).length + Object.keys(devDeps).length} dependencies`,
                },
              ],
            };
          }
          
          return {
            content: [
              {
                type: 'text',
                text: `No package.json found in ${fullPath}`,
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
          // Get recent decisions
          const recentDecisions = await getProjectMemory(null, 'decisions', 20, project);
          const recentProgress = await getProjectMemory(null, 'progress', 20, project);
          
          // Filter by date
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - days_back);
          
          const filteredDecisions = recentDecisions.filter(d => 
            new Date(d.timestamp) > cutoffDate
          );
          
          const filteredProgress = recentProgress.filter(p => 
            new Date(p.updated_at || p.created_at) > cutoffDate
          );
          
          let commitSummary = '';
          if (include_commits) {
            try {
              const gitLog = execSync(`git log --since="${days_back} days ago" --oneline --no-merges 2>/dev/null | head -20`, {
                encoding: 'utf8',
              }).trim();
              
              if (gitLog) {
                const commitCount = gitLog.split('\n').length;
                commitSummary = `

📝 Git Activity:
- Commits: ${commitCount}
Recent commits:
${gitLog.split('\n').slice(0, 5).map(c => `  ${c}`).join('\n')}`;
              }
            } catch (e) {
              // No git repo or error
            }
          }
          
          return {
            content: [
              {
                type: 'text',
                text: `📊 Development Summary (Last ${days_back} days):

🎯 Project: ${project}

📋 Architectural Decisions: ${filteredDecisions.length}
${filteredDecisions.slice(0, 3).map(d => `  - ${d.decision}`).join('\n')}

📈 Progress Updates: ${filteredProgress.length}
${filteredProgress.slice(0, 3).map(p => `  - ${p.milestone}: ${p.status}`).join('\n')}
${commitSummary}

Use get_project_memory for detailed information on any item.`,
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
          text: `Error executing tool ${name}: ${error.message}`,
        },
      ],
    };
  }
});

// Start the server
const transport = new StdioServerTransport();
server.connect(transport);

console.error('DevAssist MCP Server v2.1 running with SQLite + LanceDB + Documentation Resources...');
if (hasDocumentation()) {
  console.error('Documentation resources available from:', getDocumentationPath());
} else {
  console.error('No documentation resources found - add docs to .devassist/docs/');
}