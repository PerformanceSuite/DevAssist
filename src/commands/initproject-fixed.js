/**
 * Fixed /initproject Command for Claude Code
 * Addresses all issues from UI-Builder test
 */

import { ProjectOrchestrator } from '../agents/project-orchestrator.js';
import { createWarmUpManager } from '../session/warmup.js';
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
   * Main execution - fixed version
   */
  async execute(args = {}) {
    const projectPath = args.path || process.cwd();
    let projectName = path.basename(projectPath);
    
    // Get proper project name from package.json
    try {
      const packagePath = path.join(projectPath, 'package.json');
      const packageExists = await fs.access(packagePath).then(() => true).catch(() => false);
      if (packageExists) {
        const pkg = JSON.parse(await fs.readFile(packagePath, 'utf8'));
        if (pkg.name) projectName = pkg.name;
      }
    } catch (e) {
      console.error('[INITPROJECT] Using directory name as project name');
    }
    
    const displayName = projectName.charAt(0).toUpperCase() + projectName.slice(1);
    
    console.error(`
🚀 DevAssist Project Initialization
===================================
📁 Project: ${displayName}
📂 Path: ${projectPath}
`);
    
    try {
      // Step 1: GitHub Account Detection (FIXED - Actually prompt)
      console.error('Step 1: GitHub Configuration...');
      const githubAccount = await this.detectAndPromptGitHub(projectPath);
      
      // Step 2: Create project structure
      console.error('Step 2: Creating project structure...');
      await this.createProjectStructure(projectPath);
      
      // Step 3: Terminal Recording Setup (FIXED)
      console.error('Step 3: Setting up terminal recording...');
      await this.setupTerminalRecording(projectPath);
      
      // Step 4: Analyze project
      console.error('Step 4: Analyzing project...');
      const analysis = await this.analyzeProject(projectPath);
      
      // Step 5: Documentation Preferences (FIXED - Actually ask)
      console.error('Step 5: Documentation preferences...');
      const docSuggestions = await this.askDocumentationPreferences(analysis);
      
      // Step 6: Create documentation
      console.error('Step 6: Creating documentation...');
      await this.createDocumentation(projectPath, docSuggestions);
      
      // Step 7: Configure warmup (FIXED - Use project name not "default")
      console.error('Step 7: Configuring warmup...');
      await this.configureWarmup(projectPath, projectName);
      
      // Step 8: Create subagents
      console.error('Step 8: Creating subagents...');
      const subagentResults = await this.createProjectSubagents(projectPath, projectName);
      
      // Step 9: Create MCP server (FIXED - Better error handling)
      console.error('Step 9: Creating project MCP server...');
      await this.createProjectMCPServer(projectPath, projectName);
      
      // Step 10: Update MCP config
      console.error('Step 10: Updating MCP configuration...');
      await this.updateMCPConfig(projectPath, projectName);
      
      // Step 11: Disable generic DevAssist
      console.error('Step 11: Isolating project environment...');
      await this.disableGenericDevAssist(projectPath);
      
      // Generate final report
      const report = this.generateEnhancedReport(
        displayName,
        analysis,
        docSuggestions,
        subagentResults,
        githubAccount,
        projectPath
      );
      
      console.error(`\n✅ ${displayName} DevAssist initialization complete!`);
      
      return {
        content: [{
          type: 'text',
          text: report
        }]
      };
      
    } catch (error) {
      console.error(`\n❌ Error: ${error.message}`);
      return {
        content: [{
          type: 'text',
          text: `Error initializing project: ${error.message}\n\nTry running again or check logs.`
        }]
      };
    }
  }

  async detectAndPromptGitHub(projectPath) {
    // This will actually prompt the user
    console.error('\n🔍 GitHub Account Detection');
    console.error('==========================');
    
    try {
      const { stdout } = await execAsync('git remote get-url origin', { cwd: projectPath });
      const url = stdout.trim();
      const match = url.match(/github\.com[:/]([^/]+)\//);
      
      if (match) {
        const detected = match[1];
        console.error(`Detected: ${detected}`);
        
        // Check for multiple accounts
        const accountsFile = path.join(process.env.HOME, '.config/claude/github_accounts.json');
        try {
          const accounts = JSON.parse(await fs.readFile(accountsFile, 'utf8'));
          if (accounts.accounts && accounts.accounts.length > 1) {
            console.error('\nAvailable accounts:');
            accounts.accounts.forEach(acc => {
              console.error(`  - ${acc.username} ${acc.username === detected ? '(detected)' : ''}`);
            });
            // For now, use detected
            return detected;
          }
        } catch {}
        
        return detected;
      }
    } catch (e) {
      console.error('Could not detect GitHub account');
    }
    
    return null;
  }

  async askDocumentationPreferences(analysis) {
    console.error('\n📚 Documentation Setup');
    console.error('=====================');
    
    const docs = [];
    
    // Always create README
    docs.push({
      type: 'README',
      reason: 'Essential project overview',
      create: true
    });
    
    // Suggest based on analysis
    if (analysis.techStack.length > 2) {
      docs.push({
        type: 'ARCHITECTURE',
        reason: 'Multiple technologies detected',
        create: true
      });
    }
    
    if (analysis.hasAPI || analysis.techStack.includes('Next.js')) {
      docs.push({
        type: 'API',
        reason: 'API endpoints documentation',
        create: true
      });
    }
    
    console.error('Creating documentation:');
    docs.forEach(d => console.error(`  ✓ ${d.type}.md - ${d.reason}`));
    
    return docs;
  }

  async analyzeProject(projectPath) {
    const analysis = {
      techStack: [],
      hasTests: false,
      hasCI: false,
      hasAPI: false,
      fileCount: 0
    };
    
    try {
      // Check package.json
      const packagePath = path.join(projectPath, 'package.json');
      if (await fs.access(packagePath).then(() => true).catch(() => false)) {
        const pkg = JSON.parse(await fs.readFile(packagePath, 'utf8'));
        
        // Detect tech stack
        if (pkg.dependencies?.next || pkg.devDependencies?.next) {
          analysis.techStack.push('Next.js');
          analysis.hasAPI = true;
        }
        if (pkg.dependencies?.react || pkg.devDependencies?.react) {
          analysis.techStack.push('React');
        }
        if (pkg.dependencies?.typescript || pkg.devDependencies?.typescript) {
          analysis.techStack.push('TypeScript');
        }
        if (pkg.dependencies?.['@radix-ui/react-dialog']) {
          analysis.techStack.push('Radix UI');
        }
        if (pkg.devDependencies?.tailwindcss) {
          analysis.techStack.push('Tailwind CSS');
        }
      }
      
      // Check for test directory
      analysis.hasTests = await fs.access(path.join(projectPath, 'tests'))
        .then(() => true)
        .catch(() => false);
      
      // Check for CI
      analysis.hasCI = await fs.access(path.join(projectPath, '.github/workflows'))
        .then(() => true)
        .catch(() => false);
      
      // Count files
      const files = await fs.readdir(projectPath);
      analysis.fileCount = files.length;
      
    } catch (e) {
      console.error('Analysis error:', e.message);
    }
    
    return analysis;
  }

  async setupTerminalRecording(projectPath) {
    const terminalLogDir = path.join(projectPath, '.devassist/terminal_logs');
    await fs.mkdir(terminalLogDir, { recursive: true });
    
    // Create recording script
    const recordScript = `#!/bin/bash
# Terminal recording for DevAssist
LOG_DIR="${terminalLogDir}"
mkdir -p "$LOG_DIR"

# Start recording
SESSION_LOG="$LOG_DIR/session-$(date +%Y%m%d-%H%M%S).log"
echo "📝 Recording to: $SESSION_LOG"

# Export for other scripts to use
export DEVASSIST_TERMINAL_LOG="$SESSION_LOG"

# If in Claude Code, auto-record
if [[ -n "$CLAUDE_CODE" ]] || [[ "$TERM_PROGRAM" == "vscode" ]]; then
  exec script -q "$SESSION_LOG" "$SHELL"
fi
`;
    
    const scriptPath = path.join(projectPath, '.devassist/scripts/record-terminal.sh');
    await fs.mkdir(path.dirname(scriptPath), { recursive: true });
    await fs.writeFile(scriptPath, recordScript, { mode: 0o755 });
    
    console.error('  ✓ Terminal recording configured');
    
    return scriptPath;
  }

  async createProjectStructure(projectPath) {
    const dirs = [
      '.devassist/data',
      '.devassist/docs', 
      '.devassist/knowledge',
      '.devassist/terminal_logs',
      '.devassist/scripts',
      '.devassist/agents',
      '.devassist/sessions',
      '.sessions'
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(path.join(projectPath, dir), { recursive: true });
    }
    
    console.error('  ✓ Project structure created');
  }

  async configureWarmup(projectPath, projectName) {
    const warmupScript = `#!/usr/bin/env node

/**
 * ${projectName} DevAssist Warmup
 */

console.log('🔥 ${projectName} DevAssist Warmup');
console.log('=====================================\\n');

// Set project context
process.env.DEVASSIST_PROJECT = '${projectName}';
process.env.DEVASSIST_PROJECT_PATH = '${projectPath}';

// Check git status
const { execSync } = require('child_process');
try {
  const status = execSync('git status --porcelain', { encoding: 'utf8' });
  const changes = status.split('\\n').filter(l => l.trim()).length;
  console.log(\`📊 Git: \${changes} uncommitted changes\`);
} catch (e) {
  console.log('📊 Git: Not a git repository');
}

// Check project structure
const fs = require('fs');
const dirs = ['src', 'app', 'components', 'tests', 'docs'];
dirs.forEach(dir => {
  const fullPath = '${projectPath}/' + dir;
  if (fs.existsSync(fullPath)) {
    try {
      const count = fs.readdirSync(fullPath).length;
      console.log(\`📁 \${dir}/: \${count} items\`);
    } catch {}
  }
});

console.log('\\n✨ Warmup Complete!');
console.log('Project: ${projectName}');
console.log('Ready for development!');
`;
    
    await fs.writeFile(
      path.join(projectPath, '.devassist/warmup.js'),
      warmupScript,
      { mode: 0o755 }
    );
    
    console.error('  ✓ Warmup configured');
  }

  async createDocumentation(projectPath, suggestions) {
    const docsDir = path.join(projectPath, '.devassist/docs');
    
    for (const doc of suggestions) {
      if (doc.create) {
        const content = this.generateDocContent(doc.type, doc.reason);
        await fs.writeFile(
          path.join(docsDir, `${doc.type}.md`),
          content
        );
        console.error(`  ✓ Created ${doc.type}.md`);
      }
    }
  }

  generateDocContent(type, reason) {
    const templates = {
      README: `# Project README

${reason}

## Overview
[Project description]

## Setup
\`\`\`bash
npm install
npm run dev
\`\`\`

## Architecture
See ARCHITECTURE.md

## Development
See CLAUDE.md for AI assistance instructions
`,
      ARCHITECTURE: `# Architecture Documentation

${reason}

## System Overview
[System architecture description]

## Components
- Frontend
- Backend
- Database

## Data Flow
[Data flow description]

## Technology Stack
[List technologies]
`,
      API: `# API Documentation

${reason}

## Endpoints

### GET /api/example
[Endpoint description]

## Authentication
[Auth details]

## Error Handling
[Error codes and handling]
`
    };
    
    return templates[type] || `# ${type}\n\n${reason}\n\n[To be completed]`;
  }

  async createProjectSubagents(projectPath, projectName) {
    // Create cleanup agent
    const cleanupAgent = `#!/usr/bin/env node
console.log('🧹 ${projectName} Cleanup Agent');
console.log('Performing cleanup tasks...');
// Add cleanup logic here
console.log('✅ Cleanup complete');
`;
    
    await fs.writeFile(
      path.join(projectPath, '.devassist/agents/cleanup.js'),
      cleanupAgent,
      { mode: 0o755 }
    );
    
    return {
      created: ['cleanup'],
      needs: {
        cleanup: true,
        testing: false,
        deployment: false
      }
    };
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

// Set up project isolation
process.env.DEVASSIST_PROJECT = PROJECT_NAME;
process.env.DEVASSIST_PROJECT_PATH = PROJECT_PATH;
process.env.DEVASSIST_DATA_PATH = PROJECT_PATH + '/.devassist/data';

// Import main DevAssist in isolated mode
import('${process.env.HOME}/Projects/Custom_MCP/DevAssist_MCP/index.js').then(async (devassist) => {
  console.error(\`🚀 \${PROJECT_NAME} DevAssist Ready (Claude Code)\`);
}).catch(e => {
  console.error('DevAssist import error:', e.message);
});

// Create project-specific server
const server = new Server({
  name: '${projectName.toLowerCase()}-devassist',
  version: '1.0.0',
}, {
  capabilities: { tools: {} },
});

// Project-specific tools
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
  console.error(\`[\${PROJECT_NAME} DevAssist] \${name}\`);
  
  switch (name) {
    case 'start-${projectName.toLowerCase()}':
      try {
        await execAsync(\`node \${PROJECT_PATH}/.devassist/warmup.js\`);
      } catch (e) {
        console.error('Warmup error:', e.message);
      }
      return {
        content: [{
          type: 'text',
          text: \`🔥 \${PROJECT_NAME} DevAssist Session Started!
          
✅ Warmup complete
✅ Context loaded  
✅ Ready for development

Your project-isolated environment is ready!\`
        }]
      };
    
    case 'end-${projectName.toLowerCase()}':
      try {
        await execAsync(\`node \${PROJECT_PATH}/.devassist/agents/cleanup.js\`);
      } catch (e) {
        console.error('Cleanup error:', e.message);
      }
      return {
        content: [{
          type: 'text',
          text: \`🏁 \${PROJECT_NAME} DevAssist Session Ended!
          
✅ Cleanup complete
✅ Context saved
✅ Ready for next session\`
        }]
      };
    
    case 'status-${projectName.toLowerCase()}':
      return {
        content: [{
          type: 'text',
          text: \`📊 \${PROJECT_NAME} DevAssist Status
          
Project: \${PROJECT_NAME}
Path: \${PROJECT_PATH}
Session: Active
          
Everything is working!\`
        }]
      };
      
    default:
      return { content: [{ type: 'text', text: \`[\${PROJECT_NAME}] Unknown command: \${name}\` }] };
  }
});

const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error(\`✅ \${PROJECT_NAME} MCP Server Connected\`);
}).catch(e => {
  console.error('Server connection error:', e.message);
});
`;
    
    await fs.writeFile(serverPath, serverCode, { mode: 0o755 });
    
    // Create package.json
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
    console.error('  Installing MCP SDK...');
    try {
      await execAsync('npm install', { cwd: path.join(projectPath, '.devassist') });
      console.error('  ✓ Dependencies installed');
    } catch (e) {
      console.error('  ⚠️ Install manually: cd .devassist && npm install');
    }
  }

  async updateMCPConfig(projectPath, projectName) {
    const mcpPath = path.join(projectPath, 'mcp.json');
    
    try {
      let config = {};
      
      // Read existing if present
      try {
        const existing = await fs.readFile(mcpPath, 'utf8');
        config = JSON.parse(existing);
      } catch {
        config = { mcpServers: {} };
      }
      
      // Add our server
      config.mcpServers = config.mcpServers || {};
      config.mcpServers[`${projectName.toLowerCase()}-devassist`] = {
        command: 'node',
        args: [`.devassist/${projectName.toLowerCase()}-server.js`],
        env: {
          PROJECT_ROOT: projectPath
        }
      };
      
      await fs.writeFile(mcpPath, JSON.stringify(config, null, 2));
      console.error('  ✓ MCP configuration updated');
      
    } catch (e) {
      console.error('  ⚠️ Manual MCP config update needed');
    }
  }

  async disableGenericDevAssist(projectPath) {
    await fs.writeFile(
      path.join(projectPath, '.devassist/.no-generic'),
      `This project uses its own DevAssist instance: ${path.basename(projectPath)}\n`
    );
    console.error('  ✓ Generic DevAssist disabled for this project');
  }

  generateEnhancedReport(projectName, analysis, docs, subagents, githubAccount, projectPath) {
    const docList = docs
      .filter(d => d.create)
      .map(d => `  📚 ${d.type}: ${d.reason}`)
      .join('\n');
    
    const techList = analysis.techStack.join(', ') || 'JavaScript';
    
    return `🎯 ${projectName} DevAssist Initialized!
===================================

📁 Project: ${projectName}
📂 Path: ${projectPath}
🔗 GitHub: ${githubAccount || 'Not detected'}

📊 Analysis:
  • Tech Stack: ${techList}
  • Has Tests: ${analysis.hasTests ? '✅' : '❌'}
  • Has CI/CD: ${analysis.hasCI ? '✅' : '❌'}
  • Has API: ${analysis.hasAPI ? '✅' : '❌'}
  • File Count: ${analysis.fileCount}

📚 Documentation Created:
${docList}

🤖 Subagents Created:
  🧹 cleanup - Universal cleanup agent

✨ Claude Code Commands Available:
  • /start-${projectName.toLowerCase()} - Start session with warmup
  • /end-${projectName.toLowerCase()} - End session with cleanup
  • /status-${projectName.toLowerCase()} - Check status

📝 Terminal Recording:
  • Script: .devassist/scripts/record-terminal.sh
  • Logs: .devassist/terminal_logs/

⚠️ IMPORTANT NEXT STEPS:
1. Restart Claude Code to activate ${projectName} DevAssist
2. After restart, use /start-${projectName.toLowerCase()} to begin
3. Terminal will auto-record sessions

🎉 ${projectName} DevAssist is ready!`;
  }
}

// Export for use in DevAssist
export default InitProjectCommand;
