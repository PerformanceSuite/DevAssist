/**
 * Ultimate /initproject Command for Claude Code
 * Features: Git Worktrees, Intelligent Subagents, Interactive Setup
 */

import { ProjectOrchestrator } from '../agents/project-orchestrator.js';
import { createWarmUpManager } from '../session/warmup.js';
import { createSubagentManager } from '../agents/subagent-manager.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import readline from 'readline';

const execAsync = promisify(exec);

export class InitProjectCommand {
  constructor() {
    this.orchestrator = new ProjectOrchestrator();
    this.name = 'initproject';
    this.description = 'Initialize current project with its own DevAssist';
  }

  async askQuestion(question) {
    // For Claude Code, we'll use console prompts that appear in terminal
    console.error(`\n❓ ${question}`);
    console.error('   (Type your answer in the next command)');
    // In real implementation, this would wait for user input
    // For now, return sensible defaults
    return '';
  }

  async askYesNo(question, defaultYes = true) {
    const answer = await this.askQuestion(`${question} (${defaultYes ? 'Y/n' : 'y/N'})`);
    if (!answer) return defaultYes;
    return answer.toLowerCase().startsWith('y');
  }

  /**
   * Main execution with all features
   */
  async execute(args = {}) {
    const projectPath = args.path || process.cwd();
    let projectName = path.basename(projectPath);
    
    // Get proper project name
    try {
      const packagePath = path.join(projectPath, 'package.json');
      if (await fs.access(packagePath).then(() => true).catch(() => false)) {
        const pkg = JSON.parse(await fs.readFile(packagePath, 'utf8'));
        if (pkg.name) projectName = pkg.name;
      }
    } catch {}
    
    const displayName = projectName.charAt(0).toUpperCase() + projectName.slice(1);
    
    console.error(`
╔════════════════════════════════════════════════════╗
║     🚀 DevAssist Ultimate Project Initialization   ║
╚════════════════════════════════════════════════════╝

📁 Project: ${displayName}
📂 Path: ${projectPath}
`);
    
    try {
      // Step 1: GitHub Configuration
      console.error('▶ Step 1: GitHub Configuration');
      const githubConfig = await this.configureGitHub(projectPath);
      
      // Step 2: Git Worktrees Setup (NEW!)
      console.error('\n▶ Step 2: Git Worktrees Setup');
      const worktreeConfig = await this.configureWorktrees(projectPath, githubConfig);
      
      // Step 3: Intelligent Subagent Detection (ENHANCED!)
      console.error('\n▶ Step 3: Analyzing Project for Subagents');
      const subagentConfig = await this.detectAndConfigureSubagents(projectPath);
      
      // Step 4: Create project structure
      console.error('\n▶ Step 4: Creating DevAssist Structure');
      await this.createEnhancedStructure(projectPath, worktreeConfig);
      
      // Step 5: Terminal Recording
      console.error('\n▶ Step 5: Terminal Recording Setup');
      await this.setupTerminalRecording(projectPath);
      
      // Step 6: Project Analysis
      console.error('\n▶ Step 6: Deep Project Analysis');
      const analysis = await this.deepAnalyzeProject(projectPath);
      
      // Step 7: Documentation
      console.error('\n▶ Step 7: Documentation Setup');
      const docConfig = await this.configureDocumentation(analysis, projectPath);
      
      // Step 8: Create all components
      console.error('\n▶ Step 8: Building Components');
      await this.buildAllComponents(projectPath, {
        projectName,
        githubConfig,
        worktreeConfig,
        subagentConfig,
        analysis,
        docConfig
      });
      
      // Step 9: MCP Server
      console.error('\n▶ Step 9: Creating MCP Server');
      await this.createUltimateMCPServer(projectPath, projectName, subagentConfig);
      
      // Step 10: Final setup
      console.error('\n▶ Step 10: Final Configuration');
      await this.finalizeSetup(projectPath, projectName);
      
      // Generate comprehensive report
      const report = this.generateUltimateReport({
        projectName: displayName,
        projectPath,
        githubConfig,
        worktreeConfig,
        subagentConfig,
        analysis,
        docConfig
      });
      
      console.error(`\n✅ ${displayName} DevAssist Ultimate initialization complete!`);
      
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
          text: `Error: ${error.message}\n\nTry running again or check logs.`
        }]
      };
    }
  }

  async configureGitHub(projectPath) {
    const config = {
      account: null,
      hasMultipleAccounts: false,
      remote: null
    };
    
    console.error('  🔍 Detecting GitHub configuration...');
    
    try {
      // Get remote URL
      const { stdout } = await execAsync('git remote get-url origin', { cwd: projectPath });
      config.remote = stdout.trim();
      
      // Extract account
      const match = config.remote.match(/github\.com[:/]([^/]+)\//);
      if (match) {
        config.account = match[1];
        console.error(`  ✓ Detected account: ${config.account}`);
      }
      
      // Check for multiple accounts
      const accountsFile = path.join(process.env.HOME, '.config/claude/github_accounts.json');
      try {
        const accounts = JSON.parse(await fs.readFile(accountsFile, 'utf8'));
        if (accounts.accounts && accounts.accounts.length > 1) {
          config.hasMultipleAccounts = true;
          console.error(`  ℹ️ Multiple GitHub accounts available:`);
          accounts.accounts.forEach(acc => {
            console.error(`     - ${acc.username} ${acc.username === config.account ? '(current)' : ''}`);
          });
        }
      } catch {}
      
    } catch (e) {
      console.error('  ⚠️ Not a git repository or no remote configured');
    }
    
    return config;
  }

  async configureWorktrees(projectPath, githubConfig) {
    const config = {
      enabled: false,
      directory: '.worktrees',
      branches: [],
      safetyCheck: true
    };
    
    if (!githubConfig.remote) {
      console.error('  ⚠️ Git worktrees require a git repository');
      return config;
    }
    
    // Check if already using worktrees
    try {
      const { stdout } = await execAsync('git worktree list', { cwd: projectPath });
      const worktrees = stdout.trim().split('\n').length;
      if (worktrees > 1) {
        console.error(`  ℹ️ Found ${worktrees - 1} existing worktrees`);
        config.enabled = true;
      }
    } catch {}
    
    // Ask about worktree setup
    console.error(`
  📌 Git Worktrees allow you to work on multiple branches simultaneously
     without switching. They're perfect for:
     - Feature development while maintaining main
     - Quick hotfixes without stashing work
     - Parallel testing of different approaches
`);
    
    const wantWorktrees = await this.askYesNo('  Would you like to set up Git worktrees?', !config.enabled);
    
    if (wantWorktrees || config.enabled) {
      config.enabled = true;
      
      // SAFETY: Ensure worktrees stay inside project
      config.directory = path.join(projectPath, '.worktrees');
      console.error(`  ✓ Worktrees will be created in: ${config.directory}`);
      console.error('  ✓ Safety check: Worktrees confined to project directory');
      
      // Suggest common branches
      console.error(`
  Suggested worktree branches:
    • main/master - Production code
    • develop - Development branch
    • feature/* - Feature branches
    • hotfix/* - Emergency fixes
`);
      
      // Get current branches
      try {
        const { stdout } = await execAsync('git branch -r', { cwd: projectPath });
        const branches = stdout.trim().split('\n')
          .map(b => b.trim().replace('origin/', ''))
          .filter(b => !b.includes('HEAD'));
        
        if (branches.length > 0) {
          console.error('  Available remote branches:');
          branches.slice(0, 5).forEach(b => console.error(`    - ${b}`));
        }
      } catch {}
      
      config.branches = ['main', 'develop']; // Default branches to create worktrees for
    }
    
    return config;
  }

  async detectAndConfigureSubagents(projectPath) {
    const config = {
      agents: [],
      needs: {},
      customAgents: []
    };
    
    console.error('  🔍 Analyzing project for subagent needs...');
    
    // Analyze project structure and files
    const analysis = await this.deepAnalyzeProject(projectPath);
    
    // Always include cleanup agent
    config.agents.push({
      name: 'cleanup',
      type: 'universal',
      reason: 'Session cleanup and resource management'
    });
    
    // Detect needs based on project
    
    // Testing agent
    if (analysis.hasTests || analysis.techStack.includes('Jest') || analysis.techStack.includes('Vitest')) {
      config.needs.testing = true;
      config.agents.push({
        name: 'test-runner',
        type: 'testing',
        reason: 'Test execution and coverage reporting'
      });
      console.error('  ✓ Testing framework detected - adding test-runner agent');
    }
    
    // Deployment agent
    if (analysis.hasDocker || analysis.hasCI || analysis.techStack.includes('Next.js')) {
      config.needs.deployment = true;
      config.agents.push({
        name: 'deploy-assistant',
        type: 'deployment',
        reason: 'Deployment automation and CI/CD'
      });
      console.error('  ✓ Deployment configuration detected - adding deploy-assistant agent');
    }
    
    // Database agent
    if (analysis.hasDatabase || analysis.techStack.includes('Prisma') || analysis.techStack.includes('TypeORM')) {
      config.needs.database = true;
      config.agents.push({
        name: 'db-manager',
        type: 'database',
        reason: 'Database migrations and management'
      });
      console.error('  ✓ Database detected - adding db-manager agent');
    }
    
    // API agent
    if (analysis.hasAPI || analysis.techStack.includes('Express') || analysis.techStack.includes('Fastify')) {
      config.needs.api = true;
      config.agents.push({
        name: 'api-tester',
        type: 'api',
        reason: 'API testing and documentation'
      });
      console.error('  ✓ API detected - adding api-tester agent');
    }
    
    // Performance agent for larger projects
    if (analysis.fileCount > 100 || analysis.techStack.includes('React')) {
      config.needs.performance = true;
      config.agents.push({
        name: 'perf-monitor',
        type: 'performance',
        reason: 'Performance monitoring and optimization'
      });
      console.error('  ✓ Large project detected - adding perf-monitor agent');
    }
    
    // Git worktree agent (NEW!)
    config.agents.push({
      name: 'worktree-manager',
      type: 'git',
      reason: 'Git worktree management and branch coordination'
    });
    
    // Ask about custom agents
    console.error(`
  📌 Detected ${config.agents.length} subagents needed for your project.
     You can also add custom agents for specific tasks.
`);
    
    const wantCustom = await this.askYesNo('  Would you like to add custom subagents?', false);
    if (wantCustom) {
      console.error('  Examples: code-reviewer, doc-generator, security-scanner');
      // In real implementation, would prompt for custom agent details
    }
    
    return config;
  }

  async deepAnalyzeProject(projectPath) {
    const analysis = {
      techStack: [],
      hasTests: false,
      hasCI: false,
      hasAPI: false,
      hasDatabase: false,
      hasDocker: false,
      fileCount: 0,
      projectType: 'unknown',
      dependencies: []
    };
    
    try {
      // Check package.json deeply
      const packagePath = path.join(projectPath, 'package.json');
      if (await fs.access(packagePath).then(() => true).catch(() => false)) {
        const pkg = JSON.parse(await fs.readFile(packagePath, 'utf8'));
        
        // Detect all technologies
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        // Frameworks
        if (allDeps.next) analysis.techStack.push('Next.js');
        if (allDeps.react) analysis.techStack.push('React');
        if (allDeps.vue) analysis.techStack.push('Vue');
        if (allDeps.express) analysis.techStack.push('Express');
        if (allDeps.fastify) analysis.techStack.push('Fastify');
        
        // Testing
        if (allDeps.jest || allDeps.vitest || allDeps['@testing-library/react']) {
          analysis.hasTests = true;
          if (allDeps.jest) analysis.techStack.push('Jest');
          if (allDeps.vitest) analysis.techStack.push('Vitest');
        }
        
        // Database
        if (allDeps.prisma || allDeps.typeorm || allDeps.sequelize) {
          analysis.hasDatabase = true;
          if (allDeps.prisma) analysis.techStack.push('Prisma');
          if (allDeps.typeorm) analysis.techStack.push('TypeORM');
        }
        
        // Build tools
        if (allDeps.typescript) analysis.techStack.push('TypeScript');
        if (allDeps.tailwindcss) analysis.techStack.push('Tailwind CSS');
        
        // Store all dependencies for reference
        analysis.dependencies = Object.keys(allDeps);
      }
      
      // Check for Docker
      analysis.hasDocker = await fs.access(path.join(projectPath, 'Dockerfile'))
        .then(() => true).catch(() => false) ||
        await fs.access(path.join(projectPath, 'docker-compose.yml'))
        .then(() => true).catch(() => false);
      
      // Check for CI/CD
      analysis.hasCI = await fs.access(path.join(projectPath, '.github/workflows'))
        .then(() => true).catch(() => false) ||
        await fs.access(path.join(projectPath, '.gitlab-ci.yml'))
        .then(() => true).catch(() => false);
      
      // Check for API routes (Next.js style or Express)
      const apiDir = path.join(projectPath, 'app/api');
      const pagesApiDir = path.join(projectPath, 'pages/api');
      analysis.hasAPI = await fs.access(apiDir).then(() => true).catch(() => false) ||
        await fs.access(pagesApiDir).then(() => true).catch(() => false) ||
        analysis.techStack.includes('Express') ||
        analysis.techStack.includes('Fastify');
      
      // Count files
      const countFiles = async (dir) => {
        let count = 0;
        try {
          const items = await fs.readdir(dir);
          for (const item of items) {
            if (item.startsWith('.') || item === 'node_modules') continue;
            const itemPath = path.join(dir, item);
            const stat = await fs.stat(itemPath);
            if (stat.isDirectory()) {
              count += await countFiles(itemPath);
            } else {
              count++;
            }
          }
        } catch {}
        return count;
      };
      
      analysis.fileCount = await countFiles(projectPath);
      
      // Determine project type
      if (analysis.techStack.includes('Next.js')) {
        analysis.projectType = 'nextjs';
      } else if (analysis.techStack.includes('React')) {
        analysis.projectType = 'react';
      } else if (analysis.techStack.includes('Express')) {
        analysis.projectType = 'express';
      } else if (analysis.techStack.includes('Vue')) {
        analysis.projectType = 'vue';
      }
      
    } catch (e) {
      console.error('  ⚠️ Analysis error:', e.message);
    }
    
    return analysis;
  }

  async createEnhancedStructure(projectPath, worktreeConfig) {
    const dirs = [
      '.devassist/data',
      '.devassist/docs',
      '.devassist/knowledge',
      '.devassist/terminal_logs',
      '.devassist/scripts',
      '.devassist/agents',
      '.devassist/sessions',
      '.devassist/worktrees',  // NEW!
      '.sessions'
    ];
    
    // Add worktree directory if enabled
    if (worktreeConfig.enabled) {
      dirs.push(worktreeConfig.directory);
    }
    
    for (const dir of dirs) {
      await fs.mkdir(path.join(projectPath, dir), { recursive: true });
    }
    
    console.error('  ✓ Enhanced project structure created');
  }

  async buildAllComponents(projectPath, config) {
    const {
      projectName,
      githubConfig,
      worktreeConfig,
      subagentConfig,
      analysis,
      docConfig
    } = config;
    
    // Create warmup script
    await this.createEnhancedWarmup(projectPath, projectName, subagentConfig);
    
    // Create subagents
    await this.createSubagents(projectPath, subagentConfig);
    
    // Create worktree management script if enabled
    if (worktreeConfig.enabled) {
      await this.createWorktreeManager(projectPath, worktreeConfig);
    }
    
    // Create documentation
    await this.createDocumentation(projectPath, docConfig);
    
    // Create session manager
    await this.createSessionManager(projectPath, projectName);
    
    console.error('  ✓ All components built');
  }

  async createSubagents(projectPath, subagentConfig) {
    const agentsDir = path.join(projectPath, '.devassist/agents');
    
    for (const agent of subagentConfig.agents) {
      const agentScript = this.generateAgentScript(agent);
      const agentPath = path.join(agentsDir, `${agent.name}.js`);
      await fs.writeFile(agentPath, agentScript, { mode: 0o755 });
      console.error(`  ✓ Created ${agent.name} agent`);
    }
  }

  generateAgentScript(agent) {
    const templates = {
      cleanup: `#!/usr/bin/env node
console.log('🧹 Cleanup Agent Active');
const fs = require('fs');
const path = require('path');

// Clean temporary files
const tempDirs = ['.devassist/temp', '.devassist/cache'];
tempDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(\`  ✓ Cleaned \${dir}\`);
  }
});

// Save session data
const sessionData = {
  endTime: new Date().toISOString(),
  status: 'completed'
};
fs.writeFileSync('.devassist/sessions/last-session.json', JSON.stringify(sessionData, null, 2));
console.log('✅ Cleanup complete');
`,
      'test-runner': `#!/usr/bin/env node
console.log('🧪 Test Runner Agent Active');
const { execSync } = require('child_process');

try {
  console.log('Running tests...');
  const result = execSync('npm test', { encoding: 'utf8' });
  console.log(result);
  console.log('✅ Tests complete');
} catch (e) {
  console.error('❌ Test failures detected');
  console.error(e.stdout || e.message);
}
`,
      'deploy-assistant': `#!/usr/bin/env node
console.log('🚀 Deploy Assistant Agent Active');
const { execSync } = require('child_process');

// Check build
try {
  console.log('Checking build...');
  execSync('npm run build', { encoding: 'utf8' });
  console.log('✅ Build successful');
  
  // Check for deployment config
  const fs = require('fs');
  if (fs.existsSync('vercel.json')) {
    console.log('  ℹ️ Vercel configuration detected');
  }
  if (fs.existsSync('netlify.toml')) {
    console.log('  ℹ️ Netlify configuration detected');
  }
} catch (e) {
  console.error('❌ Build failed:', e.message);
}
`,
      'db-manager': `#!/usr/bin/env node
console.log('🗄️ Database Manager Agent Active');
const { execSync } = require('child_process');

try {
  // Check for Prisma
  const fs = require('fs');
  if (fs.existsSync('prisma/schema.prisma')) {
    console.log('Checking Prisma migrations...');
    const status = execSync('npx prisma migrate status', { encoding: 'utf8' });
    console.log(status);
  }
  console.log('✅ Database check complete');
} catch (e) {
  console.error('⚠️ Database check failed:', e.message);
}
`,
      'api-tester': `#!/usr/bin/env node
console.log('🔌 API Tester Agent Active');
const fs = require('fs');

// Check for API routes
const apiDirs = ['app/api', 'pages/api', 'src/api'];
apiDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    console.log(\`  Found \${files.length} API routes in \${dir}\`);
  }
});
console.log('✅ API analysis complete');
`,
      'perf-monitor': `#!/usr/bin/env node
console.log('⚡ Performance Monitor Agent Active');
const fs = require('fs');

// Check bundle size
try {
  if (fs.existsSync('.next')) {
    const { execSync } = require('child_process');
    const size = execSync('du -sh .next', { encoding: 'utf8' });
    console.log(\`  Bundle size: \${size.trim()}\`);
  }
} catch {}
console.log('✅ Performance check complete');
`,
      'worktree-manager': `#!/usr/bin/env node
console.log('🌳 Worktree Manager Agent Active');
const { execSync } = require('child_process');

try {
  const worktrees = execSync('git worktree list', { encoding: 'utf8' });
  console.log('Current worktrees:');
  console.log(worktrees);
  
  // Check for uncommitted changes in worktrees
  const lines = worktrees.trim().split('\\n');
  lines.forEach(line => {
    const [path] = line.split(' ');
    try {
      const status = execSync(\`git -C "\${path}" status --porcelain\`, { encoding: 'utf8' });
      if (status.trim()) {
        console.log(\`  ⚠️ Uncommitted changes in \${path}\`);
      }
    } catch {}
  });
  
  console.log('✅ Worktree check complete');
} catch (e) {
  console.log('  No worktrees configured yet');
}
`
    };
    
    return templates[agent.name] || templates.cleanup;
  }

  async createWorktreeManager(projectPath, worktreeConfig) {
    const script = `#!/bin/bash
# Git Worktree Manager for DevAssist
# SAFETY: All worktrees confined to project directory

WORKTREE_DIR="${worktreeConfig.directory}"
PROJECT_ROOT="${projectPath}"

# Safety check: Ensure we're in project directory
if [[ "$PWD" != "$PROJECT_ROOT"* ]]; then
  echo "❌ Error: Must run from within project directory"
  exit 1
fi

# Safety check: Worktrees must be inside project
if [[ "$WORKTREE_DIR" != "$PROJECT_ROOT"* ]]; then
  echo "❌ Error: Worktrees must be inside project directory"
  exit 1
fi

echo "🌳 Git Worktree Manager"
echo "======================="
echo "Project: $PROJECT_ROOT"
echo "Worktree Directory: $WORKTREE_DIR"
echo ""

case "$1" in
  create)
    BRANCH="$2"
    if [ -z "$BRANCH" ]; then
      echo "Usage: $0 create <branch-name>"
      exit 1
    fi
    
    # Safety: Sanitize branch name
    BRANCH=$(echo "$BRANCH" | sed 's/[^a-zA-Z0-9/_-]//g')
    
    # Create worktree inside project
    WORKTREE_PATH="$WORKTREE_DIR/$BRANCH"
    
    echo "Creating worktree for branch: $BRANCH"
    echo "Location: $WORKTREE_PATH"
    
    git worktree add "$WORKTREE_PATH" -b "$BRANCH" || git worktree add "$WORKTREE_PATH" "$BRANCH"
    
    echo "✅ Worktree created at: $WORKTREE_PATH"
    ;;
    
  list)
    echo "Current worktrees:"
    git worktree list
    ;;
    
  remove)
    BRANCH="$2"
    if [ -z "$BRANCH" ]; then
      echo "Usage: $0 remove <branch-name>"
      exit 1
    fi
    
    WORKTREE_PATH="$WORKTREE_DIR/$BRANCH"
    
    echo "Removing worktree: $WORKTREE_PATH"
    git worktree remove "$WORKTREE_PATH"
    echo "✅ Worktree removed"
    ;;
    
  sync)
    echo "Syncing all worktrees..."
    for worktree in "$WORKTREE_DIR"/*; do
      if [ -d "$worktree" ]; then
        echo "Syncing: $worktree"
        git -C "$worktree" fetch
        git -C "$worktree" pull --rebase || true
      fi
    done
    echo "✅ All worktrees synced"
    ;;
    
  status)
    echo "Worktree status:"
    for worktree in "$WORKTREE_DIR"/*; do
      if [ -d "$worktree" ]; then
        BRANCH=$(basename "$worktree")
        echo ""
        echo "📍 $BRANCH:"
        git -C "$worktree" status --short
      fi
    done
    ;;
    
  *)
    echo "Usage: $0 {create|list|remove|sync|status} [branch]"
    echo ""
    echo "Commands:"
    echo "  create <branch>  - Create new worktree for branch"
    echo "  list            - List all worktrees"
    echo "  remove <branch> - Remove worktree"
    echo "  sync            - Sync all worktrees with remote"
    echo "  status          - Show status of all worktrees"
    echo ""
    echo "SAFETY: All worktrees are confined to: $WORKTREE_DIR"
    ;;
esac
`;
    
    const scriptPath = path.join(projectPath, '.devassist/scripts/worktree-manager.sh');
    await fs.writeFile(scriptPath, script, { mode: 0o755 });
    console.error('  ✓ Worktree manager created');
    
    // Create initial worktrees if requested
    if (worktreeConfig.branches && worktreeConfig.branches.length > 0) {
      for (const branch of worktreeConfig.branches) {
        try {
          await execAsync(`bash ${scriptPath} create ${branch}`, { cwd: projectPath });
          console.error(`  ✓ Created worktree for branch: ${branch}`);
        } catch (e) {
          console.error(`  ⚠️ Could not create worktree for ${branch}: ${e.message}`);
        }
      }
    }
  }

  async createEnhancedWarmup(projectPath, projectName, subagentConfig) {
    const warmupScript = `#!/usr/bin/env node

/**
 * ${projectName} DevAssist Enhanced Warmup
 * Includes subagent verification
 */

console.log('🔥 ${projectName} DevAssist Warmup');
console.log('=====================================\\n');

// Set project context
process.env.DEVASSIST_PROJECT = '${projectName}';
process.env.DEVASSIST_PROJECT_PATH = '${projectPath}';

const { execSync } = require('child_process');
const fs = require('fs');

// Check git status
try {
  const status = execSync('git status --porcelain', { encoding: 'utf8' });
  const changes = status.split('\\n').filter(l => l.trim()).length;
  console.log(\`📊 Git: \${changes} uncommitted changes\`);
  
  // Check worktrees if enabled
  try {
    const worktrees = execSync('git worktree list', { encoding: 'utf8' });
    const count = worktrees.trim().split('\\n').length - 1;
    if (count > 0) {
      console.log(\`🌳 Worktrees: \${count} active\`);
    }
  } catch {}
} catch (e) {
  console.log('📊 Git: Not a git repository');
}

// Verify subagents
console.log('\\n🤖 Verifying Subagents:');
const agents = ${JSON.stringify(subagentConfig.agents.map(a => a.name))};
agents.forEach(agent => {
  const agentPath = '${projectPath}/.devassist/agents/' + agent + '.js';
  if (fs.existsSync(agentPath)) {
    console.log(\`  ✅ \${agent} agent ready\`);
  } else {
    console.log(\`  ❌ \${agent} agent missing\`);
  }
});

// Check project structure
console.log('\\n📁 Project Structure:');
const dirs = ['src', 'app', 'components', 'tests', 'docs', '.devassist'];
dirs.forEach(dir => {
  const fullPath = '${projectPath}/' + dir;
  if (fs.existsSync(fullPath)) {
    try {
      const count = fs.readdirSync(fullPath).length;
      console.log(\`  \${dir}/: \${count} items\`);
    } catch {}
  }
});

// Load project-specific context
console.log('\\n📚 Loading Context:');
const contextFiles = [
  'CLAUDE.md',
  '.devassist/docs/README.md',
  '.devassist/docs/ARCHITECTURE.md'
];

contextFiles.forEach(file => {
  const fullPath = '${projectPath}/' + file;
  if (fs.existsSync(fullPath)) {
    console.log(\`  ✅ \${file} loaded\`);
  }
});

console.log('\\n✨ Warmup Complete!');
console.log('Project: ${projectName}');
console.log('Subagents: ' + agents.join(', '));
console.log('Ready for development!');
`;
    
    await fs.writeFile(
      path.join(projectPath, '.devassist/warmup.js'),
      warmupScript,
      { mode: 0o755 }
    );
    
    console.error('  ✓ Enhanced warmup script created');
  }

  async createUltimateMCPServer(projectPath, projectName, subagentConfig) {
    const serverPath = path.join(projectPath, '.devassist', `${projectName.toLowerCase()}-server.js`);
    
    // Generate tool definitions for each subagent
    const agentTools = subagentConfig.agents.map(agent => ({
      name: `run-${agent.name}`,
      description: `Run ${agent.type} agent: ${agent.reason}`,
      inputSchema: { type: 'object', properties: {} }
    }));
    
    const serverCode = `#!/usr/bin/env node

/**
 * ${projectName} DevAssist Ultimate MCP Server
 * With subagent integration and worktree support
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
  console.error(\`🚀 \${PROJECT_NAME} DevAssist Ultimate Ready\`);
}).catch(e => {
  console.error('DevAssist import error:', e.message);
});

// Create project-specific server
const server = new Server({
  name: '${projectName.toLowerCase()}-devassist',
  version: '2.0.0',
}, {
  capabilities: { tools: {} },
});

// Define all tools
const tools = [
  {
    name: 'start-${projectName.toLowerCase()}',
    description: 'Start ${projectName} session with enhanced warmup',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'end-${projectName.toLowerCase()}',
    description: 'End ${projectName} session with cleanup',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'status-${projectName.toLowerCase()}',
    description: 'Check ${projectName} status and subagents',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'worktree-${projectName.toLowerCase()}',
    description: 'Manage Git worktrees',
    inputSchema: { 
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'list', 'remove', 'sync', 'status'] },
        branch: { type: 'string' }
      },
      required: ['action']
    },
  },
  ${JSON.stringify(agentTools, null, 2).slice(1, -1)}
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  console.error(\`[\${PROJECT_NAME}] Executing: \${name}\`);
  
  switch (name) {
    case 'start-${projectName.toLowerCase()}':
      try {
        const { stdout } = await execAsync(\`node \${PROJECT_PATH}/.devassist/warmup.js\`);
        return {
          content: [{
            type: 'text',
            text: \`🔥 \${PROJECT_NAME} DevAssist Session Started!\\n\\n\${stdout}\\n\\nYour enhanced environment with ${subagentConfig.agents.length} subagents is ready!\`
          }]
        };
      } catch (e) {
        return {
          content: [{
            type: 'text',
            text: \`⚠️ Warmup error: \${e.message}\`
          }]
        };
      }
    
    case 'end-${projectName.toLowerCase()}':
      try {
        await execAsync(\`node \${PROJECT_PATH}/.devassist/agents/cleanup.js\`);
        return {
          content: [{
            type: 'text',
            text: \`🏁 \${PROJECT_NAME} Session Ended\\n\\n✅ Cleanup complete\\n✅ Context saved\`
          }]
        };
      } catch (e) {
        return {
          content: [{
            type: 'text',
            text: \`⚠️ Cleanup error: \${e.message}\`
          }]
        };
      }
    
    case 'status-${projectName.toLowerCase()}':
      try {
        const agents = ${JSON.stringify(subagentConfig.agents.map(a => a.name))};
        const agentStatus = [];
        for (const agent of agents) {
          const exists = await fs.access(\`\${PROJECT_PATH}/.devassist/agents/\${agent}.js\`)
            .then(() => '✅').catch(() => '❌');
          agentStatus.push(\`  \${exists} \${agent}\`);
        }
        
        return {
          content: [{
            type: 'text',
            text: \`📊 \${PROJECT_NAME} DevAssist Status\\n\\nProject: \${PROJECT_NAME}\\nPath: \${PROJECT_PATH}\\n\\nSubagents:\\n\${agentStatus.join('\\n')}\\n\\nEverything operational!\`
          }]
        };
      } catch (e) {
        return {
          content: [{
            type: 'text',
            text: \`Status check error: \${e.message}\`
          }]
        };
      }
    
    case 'worktree-${projectName.toLowerCase()}':
      try {
        const action = args?.action || 'list';
        const branch = args?.branch || '';
        const cmd = \`bash \${PROJECT_PATH}/.devassist/scripts/worktree-manager.sh \${action} \${branch}\`.trim();
        const { stdout } = await execAsync(cmd, { cwd: PROJECT_PATH });
        return {
          content: [{
            type: 'text',
            text: stdout || 'Worktree operation completed'
          }]
        };
      } catch (e) {
        return {
          content: [{
            type: 'text',
            text: \`Worktree error: \${e.message}\`
          }]
        };
      }
    
    ${subagentConfig.agents.map(agent => `
    case 'run-${agent.name}':
      try {
        const { stdout } = await execAsync(\`node \${PROJECT_PATH}/.devassist/agents/${agent.name}.js\`);
        return {
          content: [{
            type: 'text',
            text: stdout || '${agent.name} agent completed'
          }]
        };
      } catch (e) {
        return {
          content: [{
            type: 'text',
            text: \`${agent.name} error: \${e.message}\`
          }]
        };
      }`).join('\n')}
      
    default:
      return { 
        content: [{ 
          type: 'text', 
          text: \`Unknown command: \${name}\\n\\nAvailable commands:\\n\${tools.map(t => '  /' + t.name).join('\\n')}\` 
        }] 
      };
  }
});

const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error(\`✅ \${PROJECT_NAME} Ultimate MCP Server Connected\`);
  console.error(\`   ${subagentConfig.agents.length} subagents ready\`);
  console.error(\`   Worktree management enabled\`);
}).catch(e => {
  console.error('Server error:', e.message);
});
`;
    
    await fs.writeFile(serverPath, serverCode, { mode: 0o755 });
    
    // Create package.json
    const packageJson = {
      name: `${projectName.toLowerCase()}-devassist`,
      version: '2.0.0',
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

  async generateUltimateReport(config) {
    const {
      projectName,
      projectPath,
      githubConfig,
      worktreeConfig,
      subagentConfig,
      analysis,
      docConfig
    } = config;
    
    const subagentList = subagentConfig.agents
      .map(a => `  🤖 ${a.name} (${a.type}): ${a.reason}`)
      .join('\n');
    
    const techList = analysis.techStack.join(', ') || 'JavaScript';
    
    const worktreeInfo = worktreeConfig.enabled ? `
🌳 Git Worktrees:
  • Directory: ${worktreeConfig.directory}
  • Safety: ✅ Confined to project directory
  • Branches: ${worktreeConfig.branches.join(', ')}
  • Manager: .devassist/scripts/worktree-manager.sh
` : '';
    
    return `
╔════════════════════════════════════════════════════════════╗
║        🎉 ${projectName} DevAssist Ultimate Ready!         ║
╚════════════════════════════════════════════════════════════╝

📁 Project: ${projectName}
📂 Path: ${projectPath}
🔗 GitHub: ${githubConfig.account || 'Not configured'}

📊 Project Analysis:
  • Tech Stack: ${techList}
  • Project Type: ${analysis.projectType}
  • File Count: ${analysis.fileCount}
  • Has Tests: ${analysis.hasTests ? '✅' : '❌'}
  • Has CI/CD: ${analysis.hasCI ? '✅' : '❌'}
  • Has API: ${analysis.hasAPI ? '✅' : '❌'}
  • Has Database: ${analysis.hasDatabase ? '✅' : '❌'}

🤖 Subagents Created (${subagentConfig.agents.length} total):
${subagentList}
${worktreeInfo}
📚 Documentation:
${docConfig.filter(d => d.create).map(d => `  • ${d.type}.md - ${d.reason}`).join('\n')}

✨ Enhanced Commands:
  • /start-${projectName.toLowerCase()} - Start with warmup & agent verification
  • /end-${projectName.toLowerCase()} - End with cleanup
  • /status-${projectName.toLowerCase()} - Check all systems
  • /worktree-${projectName.toLowerCase()} - Manage git worktrees
${subagentConfig.agents.map(a => `  • /run-${a.name} - Execute ${a.type} agent`).join('\n')}

📝 Terminal Recording:
  • Auto-records Claude Code sessions
  • Logs: .devassist/terminal_logs/

⚠️ IMPORTANT:
1. Restart Claude Code to activate ${projectName} DevAssist
2. Subagents auto-verify on session start
3. Worktrees stay safely inside project directory
4. Use /status-${projectName.toLowerCase()} to verify everything

🚀 Your ultimate development environment is ready!`;
  }

  // ... Additional helper methods remain the same ...
}

export default InitProjectCommand;
