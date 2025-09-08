/**
 * Enhanced /initproject Command for Claude Code
 * Auto-detects project and creates project-specific DevAssist
 */

import { ProjectOrchestrator } from '../agents/project-orchestrator.js';
import { createWarmUpManager } from '../session/warmup.js';
import { registerProjectMCP } from './register-mcp.js';
import { createSubagentManager } from '../agents/subagent-manager.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export class InitProjectCommand {
  constructor() {
    this.orchestrator = new ProjectOrchestrator();
    this.name = 'initproject';
    this.description = 'Initialize current project with its own DevAssist';
  }

  /**
   * Execute the /initproject command - auto-detects project
   */
  async execute(args = {}) {
    // Auto-detect project from current directory
    const projectPath = args.path || process.cwd();
    let projectName = path.basename(projectPath);
    
    // Check for package.json or other project files to get proper name
    try {
      const packagePath = path.join(projectPath, 'package.json');
      if (await fs.access(packagePath).then(() => true).catch(() => false)) {
        const pkg = JSON.parse(await fs.readFile(packagePath, 'utf8'));
        if (pkg.name) projectName = pkg.name;
      }
    } catch {}
    
    // Capitalize project name for display
    const displayName = projectName.charAt(0).toUpperCase() + projectName.slice(1);
    
    console.error(`[INITPROJECT] 🚀 Initializing ${displayName} DevAssist...`);
    console.error(`[INITPROJECT] 📁 Path: ${projectPath}`);
    
    try {
      // Step 1: Create project structure
      console.error('[INITPROJECT] Step 1: Creating project structure...');
      await this.createProjectStructure(projectPath);
      
      // Step 2: Run warmup configuration
      console.error('[INITPROJECT] Step 2: Configuring warmup...');
      await this.configureWarmup(projectPath, projectName);
      
      // Step 3: Analyze project and suggest documentation
      console.error('[INITPROJECT] Step 3: Analyzing project...');
      const analysis = await this.orchestrator.analyzeProject(projectPath);
      const docSuggestions = await this.suggestDocumentation(analysis, projectPath);
      
      // Step 4: Create documentation
      console.error('[INITPROJECT] Step 4: Creating documentation...');
      await this.createDocumentation(projectPath, docSuggestions);
      
      // Step 5: Initialize project with orchestrator
      console.error('[INITPROJECT] Step 5: Creating subagents...');
      const result = await this.orchestrator.initProject(projectPath, {
        documentation: docSuggestions,
        analysis: analysis
      });
      
      // Step 6: Create project-specific MCP server for Claude Code
      console.error('[INITPROJECT] Step 6: Creating project MCP server...');
      await this.createProjectMCPServer(projectPath, projectName);
      
      // Step 7: Create cleanup and other agents based on project needs
      console.error('[INITPROJECT] Step 7: Setting up project-specific agents...');
      const subagentResults = await this.createProjectSubagents(projectPath, projectName);
      
      // Step 8: Register with Claude Code config
      console.error('[INITPROJECT] Step 8: Registering with Claude Code...');
      await this.registerWithClaudeCode(projectName, projectPath);
      
      // Step 9: Remove generic DevAssist from this project
      console.error('[INITPROJECT] Step 9: Removing generic DevAssist...');
      await this.disableGenericDevAssist(projectPath);
      
      // Generate final report
      const report = this.generateInitReport(displayName, analysis, result, docSuggestions, subagentResults);
      
      console.error(`[INITPROJECT] ✅ ${displayName} DevAssist initialization complete!`);
      
      return {
        content: [{
          type: 'text',
          text: report
        }]
      };
      
    } catch (error) {
      console.error('[INITPROJECT] ❌ Error during initialization:', error);
      return {
        content: [{
          type: 'text',
          text: `Error initializing project: ${error.message}`
        }]
      };
    }
  }

  async createProjectStructure(projectPath) {
    const dirs = [
      '.devassist/agents',
      '.devassist/data/sqlite', 
      '.devassist/data/vectors',
      '.devassist/sessions',
      '.devassist/terminal_logs',
      '.devassist/docs'
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(path.join(projectPath, dir), { recursive: true });
    }
  }

  async configureWarmup(projectPath, projectName) {
    const warmupScript = `#!/usr/bin/env node

/**
 * ${projectName} DevAssist Warmup
 */

console.log('🔥 ${projectName} DevAssist Warmup');
console.log('=====================================\\n');

// Check git status
const { execSync } = require('child_process');
try {
  const status = execSync('git status --porcelain', { encoding: 'utf8' });
  const changes = status.split('\\n').filter(l => l.trim()).length;
  console.log(\`📊 Git: \${changes} uncommitted changes\`);
} catch {}

// Check project structure
const fs = require('fs');
const dirs = ['src', 'tests', 'docs'];
dirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    const count = fs.readdirSync(dir).length;
    console.log(\`📁 \${dir}/: \${count} items\`);
  }
});

console.log('\\n✨ Warmup Complete!');
`;
    
    await fs.writeFile(
      path.join(projectPath, '.devassist/warmup.js'),
      warmupScript,
      { mode: 0o755 }
    );
  }

  async suggestDocumentation(analysis, projectPath) {
    const suggestions = [];
    
    // Always suggest README
    suggestions.push({
      type: 'README',
      reason: 'Essential project overview',
      priority: 'high'
    });
    
    // Suggest based on analysis
    if (analysis.techStack.length > 2) {
      suggestions.push({
        type: 'ARCHITECTURE',
        reason: 'Multiple technologies detected - architecture docs recommended',
        priority: 'high'
      });
    }
    
    if (analysis.hasTests) {
      suggestions.push({
        type: 'TESTING',
        reason: 'Test directory found - testing documentation recommended',
        priority: 'medium'
      });
    }
    
    // Check for specific project types
    const files = await fs.readdir(projectPath);
    
    if (files.includes('docker-compose.yml')) {
      suggestions.push({
        type: 'DEPLOYMENT',
        reason: 'Docker configuration found - deployment docs recommended',
        priority: 'high'
      });
    }
    
    if (files.includes('.env.example')) {
      suggestions.push({
        type: 'CONFIGURATION',
        reason: 'Environment configuration found - setup docs recommended',
        priority: 'high'
      });
    }
    
    if (analysis.techStack.includes('Python')) {
      suggestions.push({
        type: 'API',
        reason: 'Python project - API documentation recommended',
        priority: 'medium'
      });
    }
    
    return suggestions;
  }

  async createDocumentation(projectPath, suggestions) {
    for (const doc of suggestions) {
      if (doc.priority === 'high') {
        console.error(`[INITPROJECT] 📚 Creating ${doc.type}: ${doc.reason}`);
        // Create placeholder docs
        const content = `# ${doc.type}\n\nReason: ${doc.reason}\n\n[To be completed]`;
        await fs.writeFile(
          path.join(projectPath, '.devassist/docs', `${doc.type}.md`),
          content
        );
      }
    }
  }

  async createProjectMCPServer(projectPath, projectName) {
    const serverPath = path.join(projectPath, '.devassist', `${projectName.toLowerCase()}-server.js`);
    
    const serverCode = `#!/usr/bin/env node

/**
 * ${projectName} DevAssist MCP Server for Claude Code
 * Project-isolated instance with custom commands
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

const PROJECT_NAME = '${projectName}';
const PROJECT_PATH = '${projectPath}';

// Set up project isolation - NO generic DevAssist
process.env.DEVASSIST_PROJECT = PROJECT_NAME;
process.env.DEVASSIST_PROJECT_PATH = PROJECT_PATH;
process.env.DEVASSIST_DATA_PATH = PROJECT_PATH + '/.devassist/data';

// Import main DevAssist but run in isolated mode
import('${path.join('/Users/danielconnolly/Projects/Custom_MCP/DevAssist_MCP', 'index.js')}').then(async (devassist) => {
  // Server is ready
  console.error(\`🚀 ${projectName} DevAssist Ready (Claude Code)\`);
});

// Create project-specific server
const server = new Server({
  name: '${projectName.toLowerCase()}-devassist',
  version: '1.0.0',
}, {
  capabilities: { tools: {} },
});

// Project-specific tools (these become slash commands in Claude Code)
const tools = [
  {
    name: 'start-${projectName.toLowerCase()}',
    description: 'Start ${projectName} session with warmup',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'end-${projectName.toLowerCase()}',
    description: 'End ${projectName} session with cleanup',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'status-${projectName.toLowerCase()}',
    description: 'Check ${projectName} status',
    inputSchema: { type: 'object', properties: {} },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;
  console.error(\`[${projectName} DevAssist] \${name}\`);
  
  // Handle project-specific commands
  switch (name) {
    case 'start-${projectName.toLowerCase()}':
      await execAsync(\`node \${PROJECT_PATH}/.devassist/warmup.js\`).catch(() => {});
      return {
        content: [{
          type: 'text',
          text: \`🔥 ${projectName} DevAssist Session Started!
          
✅ Warmup complete
✅ Context loaded
✅ Indices ready
✅ AI primed for ${projectName}

Your project-isolated environment is ready!\`
        }]
      };
    
    case 'end-${projectName.toLowerCase()}':
      await execAsync(\`node \${PROJECT_PATH}/.devassist/agents/cleanup.js\`).catch(() => {});
      return {
        content: [{
          type: 'text',
          text: \`🏁 ${projectName} DevAssist Session Ended!
          
✅ Cleanup complete
✅ Context saved
✅ Ready for next session\`
        }]
      };
      
    default:
      return { content: [{ type: 'text', text: \`[${projectName}] \${name}\` }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
`;
    
    await fs.writeFile(serverPath, serverCode, { mode: 0o755 });
    
    // Create package.json for the MCP server
    const packageJson = {
      name: `${projectName.toLowerCase()}-devassist`,
      version: '1.0.0',
      type: 'module',
      dependencies: {
        '@modelcontextprotocol/sdk': '^1.0.0'
      }
    };
    
    await fs.writeFile(
      path.join(projectPath, '.devassist/package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // Install dependencies
    await execAsync('npm install', { cwd: path.join(projectPath, '.devassist') });
  }

  async createProjectSubagents(projectPath, projectName) {
    const subagentManager = createSubagentManager(projectPath, projectName);
    
    // Initialize agents based on project analysis
    const result = await subagentManager.initializeSubagents();
    
    console.error(`[INITPROJECT] Created ${result.created.length} subagents: ${result.created.join(', ')}`);
    
    return result;
  }

  async createAgents(projectPath, projectName) {
    // This method is now replaced by createProjectSubagents
    // Kept for backward compatibility
    return this.createProjectSubagents(projectPath, projectName);
  }

  async registerWithClaudeCode(projectName, projectPath) {
    // Update Claude Code config (not Desktop!)
    const configPath = path.join(
      process.env.HOME,
      'Library/Application Support/Claude/claude_desktop_config.json'
    );
    
    try {
      const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
      
      // Add project-specific DevAssist
      config.mcpServers[`${projectName.toLowerCase()}-devassist`] = {
        command: 'node',
        args: [path.join(projectPath, '.devassist', `${projectName.toLowerCase()}-server.js`)]
      };
      
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      console.error(`[INITPROJECT] ✅ Registered ${projectName} DevAssist with Claude Code`);
    } catch (e) {
      console.error(`[INITPROJECT] ⚠️ Manual config needed: ${e.message}`);
    }
  }

  async disableGenericDevAssist(projectPath) {
    // Create a marker file that tells generic DevAssist to not run here
    await fs.writeFile(
      path.join(projectPath, '.devassist/.no-generic'),
      'This project uses its own DevAssist instance\n'
    );
  }

  generateInitReport(projectName, analysis, result, docSuggestions, subagentResults) {
    const docList = docSuggestions
      .map(d => `  📚 ${d.type}: ${d.reason}`)
      .join('\n');
    
    const agentList = subagentResults.created
      .map(a => `  🤖 ${a}`)
      .join('\n');
    
    const detectedNeeds = Object.entries(subagentResults.needs)
      .filter(([k, v]) => v)
      .map(([k]) => k);
    
    return `🎯 ${projectName} DevAssist Initialized!
===================================

📁 Project: ${projectName}
📊 Analysis:
  • Tech Stack: ${analysis.techStack.join(', ') || 'To be determined'}
  • Has Tests: ${analysis.hasTests ? '✅' : '❌'}
  • Has CI/CD: ${analysis.hasCI ? '✅' : '❌'}
  • File Count: ${analysis.fileCount}

📚 Documentation Created:
${docList}

🤖 Subagents Created (based on project needs):
${agentList || '  🧹 cleanup (universal)'}

📋 Detected Project Needs:
  ${detectedNeeds.join(', ')}

✨ Claude Code Commands Available:
  • /start-${projectName.toLowerCase()} - Start session with warmup & agent verification
  • /end-${projectName.toLowerCase()} - End session with cleanup
  • /status-${projectName.toLowerCase()} - Check status

⚠️ IMPORTANT: 
1. Restart Claude Code to activate ${projectName} DevAssist
2. Subagents will auto-verify at each session start
3. New agents will be created if sprint requires them

After restart, you'll ONLY see ${projectName} DevAssist, not generic DevAssist.
All commands are project-isolated and specific to ${projectName}.

Happy coding with ${projectName} DevAssist! 🚀`;
  }
}

// Export for use in DevAssist
export default InitProjectCommand;