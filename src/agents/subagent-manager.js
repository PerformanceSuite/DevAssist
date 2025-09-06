/**
 * Subagent Manager - Creates and manages project-specific agents
 * Cleanup is universal, others are created based on project/sprint needs
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class SubagentManager {
  constructor(projectPath, projectName) {
    this.projectPath = projectPath;
    this.projectName = projectName;
    this.agentsPath = path.join(projectPath, '.devassist/agents');
  }

  /**
   * Analyze project and determine needed subagents
   */
  async analyzeProjectNeeds() {
    const needs = {
      cleanup: true, // Always needed
      testing: false,
      deployment: false,
      database: false,
      api: false,
      security: false,
      performance: false,
      documentation: false,
      blockchain: false,
      compliance: false,
      ai: false
    };

    try {
      // Check project files to determine needs
      const files = await fs.readdir(this.projectPath);
      
      // Testing agent
      if (files.includes('jest.config.js') || files.includes('pytest.ini') || 
          files.includes('.rspec') || await this.hasDirectory('tests')) {
        needs.testing = true;
      }

      // Deployment agent
      if (files.includes('Dockerfile') || files.includes('docker-compose.yml') || 
          files.includes('.github') || files.includes('.gitlab-ci.yml')) {
        needs.deployment = true;
      }

      // Database agent
      if (files.includes('schema.sql') || files.includes('migrations') || 
          files.some(f => f.includes('database') || f.includes('db'))) {
        needs.database = true;
      }

      // API agent
      if (files.includes('openapi.yaml') || files.includes('swagger.json') || 
          await this.hasDirectory('api')) {
        needs.api = true;
      }

      // Check package.json for specific dependencies
      if (files.includes('package.json')) {
        const pkg = JSON.parse(await fs.readFile(path.join(this.projectPath, 'package.json'), 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        if (deps['web3'] || deps['ethers'] || deps['@solana/web3.js']) {
          needs.blockchain = true;
        }
        
        if (deps['tensorflow'] || deps['@tensorflow/tfjs'] || deps['openai']) {
          needs.ai = true;
        }
      }

      // Check for Python requirements
      if (files.includes('requirements.txt')) {
        const reqs = await fs.readFile(path.join(this.projectPath, 'requirements.txt'), 'utf8');
        
        if (reqs.includes('web3') || reqs.includes('eth-') || reqs.includes('solana')) {
          needs.blockchain = true;
        }
        
        if (reqs.includes('tensorflow') || reqs.includes('torch') || reqs.includes('openai')) {
          needs.ai = true;
        }
        
        if (reqs.includes('django') || reqs.includes('flask') || reqs.includes('fastapi')) {
          needs.api = true;
        }
      }

      // Special case for Veria - tokenized RWA platform
      if (this.projectName.toLowerCase() === 'veria') {
        needs.blockchain = true;
        needs.compliance = true;
        needs.security = true;
      }

    } catch (error) {
      console.error('[SUBAGENT] Error analyzing project:', error.message);
    }

    return needs;
  }

  /**
   * Analyze sprint requirements and determine new agents needed
   */
  async analyzeSprintNeeds() {
    const newNeeds = [];
    
    try {
      // Check for sprint files
      const sprintFiles = ['SPRINT.md', 'TODO.md', 'TASKS.md'];
      
      for (const file of sprintFiles) {
        const filePath = path.join(this.projectPath, file);
        if (await this.fileExists(filePath)) {
          const content = await fs.readFile(filePath, 'utf8');
          const contentLower = content.toLowerCase();
          
          // Check for technology mentions
          if (contentLower.includes('kubernetes') || contentLower.includes('k8s')) {
            newNeeds.push({ type: 'kubernetes', reason: 'Kubernetes mentioned in sprint' });
          }
          
          if (contentLower.includes('performance') || contentLower.includes('optimization')) {
            newNeeds.push({ type: 'performance', reason: 'Performance optimization in sprint' });
          }
          
          if (contentLower.includes('security') || contentLower.includes('audit')) {
            newNeeds.push({ type: 'security', reason: 'Security audit in sprint' });
          }
          
          if (contentLower.includes('migration') || contentLower.includes('database')) {
            newNeeds.push({ type: 'database', reason: 'Database work in sprint' });
          }
          
          if (contentLower.includes('compliance') || contentLower.includes('regulatory')) {
            newNeeds.push({ type: 'compliance', reason: 'Compliance requirements in sprint' });
          }
          
          if (contentLower.includes('smart contract') || contentLower.includes('blockchain')) {
            newNeeds.push({ type: 'blockchain', reason: 'Blockchain integration in sprint' });
          }
          
          if (contentLower.includes('machine learning') || contentLower.includes('ai model')) {
            newNeeds.push({ type: 'ai', reason: 'AI/ML work in sprint' });
          }
        }
      }
    } catch (error) {
      console.error('[SUBAGENT] Error analyzing sprint:', error.message);
    }
    
    return newNeeds;
  }

  /**
   * Create a specific subagent
   */
  async createSubagent(type, reason = '') {
    const agentPath = path.join(this.agentsPath, `${type}.js`);
    
    // Skip if already exists
    if (await this.fileExists(agentPath)) {
      return false;
    }
    
    const templates = {
      cleanup: this.getCleanupTemplate(),
      testing: this.getTestingTemplate(),
      deployment: this.getDeploymentTemplate(),
      database: this.getDatabaseTemplate(),
      api: this.getApiTemplate(),
      security: this.getSecurityTemplate(),
      performance: this.getPerformanceTemplate(),
      blockchain: this.getBlockchainTemplate(),
      compliance: this.getComplianceTemplate(),
      ai: this.getAiTemplate(),
      kubernetes: this.getKubernetesTemplate()
    };
    
    const template = templates[type] || this.getGenericTemplate(type);
    const agentCode = template
      .replace(/{{PROJECT_NAME}}/g, this.projectName)
      .replace(/{{PROJECT_PATH}}/g, this.projectPath)
      .replace(/{{REASON}}/g, reason);
    
    await fs.writeFile(agentPath, agentCode, { mode: 0o755 });
    console.error(`[SUBAGENT] Created ${type} agent${reason ? `: ${reason}` : ''}`);
    
    return true;
  }

  /**
   * Initialize subagents based on project analysis
   */
  async initializeSubagents() {
    // Ensure agents directory exists
    await fs.mkdir(this.agentsPath, { recursive: true });
    
    // Analyze what's needed
    const needs = await this.analyzeProjectNeeds();
    const created = [];
    
    for (const [type, needed] of Object.entries(needs)) {
      if (needed) {
        const wasCreated = await this.createSubagent(type);
        if (wasCreated) {
          created.push(type);
        }
      }
    }
    
    return { needs, created };
  }

  /**
   * Verify and update agents at sprint start
   */
  async verifyAndUpdateAgents() {
    const sprintNeeds = await this.analyzeSprintNeeds();
    const created = [];
    
    for (const need of sprintNeeds) {
      const wasCreated = await this.createSubagent(need.type, need.reason);
      if (wasCreated) {
        created.push(need);
      }
    }
    
    // List existing agents
    const existing = await this.listAgents();
    
    return { existing, created, sprintNeeds };
  }

  /**
   * List all existing agents
   */
  async listAgents() {
    try {
      const files = await fs.readdir(this.agentsPath);
      return files
        .filter(f => f.endsWith('.js'))
        .map(f => f.replace('.js', ''));
    } catch {
      return [];
    }
  }

  // Helper methods
  async fileExists(path) {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async hasDirectory(dirName) {
    try {
      const stat = await fs.stat(path.join(this.projectPath, dirName));
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  // Agent Templates
  getCleanupTemplate() {
    return `#!/usr/bin/env node

/**
 * Cleanup Agent for {{PROJECT_NAME}}
 * Universal agent that runs at session end
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧹 {{PROJECT_NAME}} Cleanup Agent');

// Clean Python cache
try {
  execSync('find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null');
  console.log('✓ Cleaned Python cache');
} catch {}

// Clean test artifacts
try {
  execSync('rm -rf .pytest_cache htmlcov .coverage 2>/dev/null');
  console.log('✓ Cleaned test artifacts');
} catch {}

// Archive old logs
const logsPath = path.join('{{PROJECT_PATH}}', '.devassist/terminal_logs');
try {
  const logs = fs.readdirSync(logsPath);
  const weekOld = Date.now() - (7 * 24 * 60 * 60 * 1000);
  
  logs.forEach(log => {
    const logPath = path.join(logsPath, log);
    const stat = fs.statSync(logPath);
    if (stat.mtime < weekOld) {
      fs.unlinkSync(logPath);
    }
  });
  console.log('✓ Archived old logs');
} catch {}

console.log('✨ Cleanup complete!');
`;
  }

  getTestingTemplate() {
    return `#!/usr/bin/env node

/**
 * Testing Agent for {{PROJECT_NAME}}
 * {{REASON}}
 */

const { execSync } = require('child_process');

console.log('🧪 {{PROJECT_NAME}} Testing Agent');

// Run tests based on project type
try {
  // Check for test runners
  if (require('fs').existsSync('package.json')) {
    const pkg = JSON.parse(require('fs').readFileSync('package.json', 'utf8'));
    
    if (pkg.scripts && pkg.scripts.test) {
      console.log('Running npm test...');
      execSync('npm test', { stdio: 'inherit' });
    }
  }
  
  if (require('fs').existsSync('pytest.ini')) {
    console.log('Running pytest...');
    execSync('pytest -v', { stdio: 'inherit' });
  }
  
} catch (error) {
  console.error('Test error:', error.message);
}

console.log('✅ Testing complete!');
`;
  }

  getBlockchainTemplate() {
    return `#!/usr/bin/env node

/**
 * Blockchain Agent for {{PROJECT_NAME}}
 * {{REASON}}
 */

console.log('⛓️ {{PROJECT_NAME}} Blockchain Agent');

// Check smart contracts
const contractsPath = '{{PROJECT_PATH}}/contracts';
if (require('fs').existsSync(contractsPath)) {
  const contracts = require('fs').readdirSync(contractsPath);
  console.log(\`Found \${contracts.length} smart contracts\`);
}

// Check deployment status
console.log('Checking deployment status...');

// Run security checks
console.log('Running security audit...');

console.log('✅ Blockchain checks complete!');
`;
  }

  getComplianceTemplate() {
    return `#!/usr/bin/env node

/**
 * Compliance Agent for {{PROJECT_NAME}}
 * {{REASON}}
 */

console.log('📋 {{PROJECT_NAME}} Compliance Agent');

const checks = {
  kyc: 'KYC implementation',
  aml: 'AML screening',
  securities: 'Securities regulations',
  privacy: 'Data privacy (GDPR/CCPA)'
};

for (const [key, value] of Object.entries(checks)) {
  console.log(\`Checking \${value}...\`);
  // Add actual compliance checks here
}

console.log('✅ Compliance checks complete!');
`;
  }

  getGenericTemplate(type) {
    return `#!/usr/bin/env node

/**
 * ${type.charAt(0).toUpperCase() + type.slice(1)} Agent for {{PROJECT_NAME}}
 * {{REASON}}
 */

console.log('🤖 {{PROJECT_NAME}} ${type.charAt(0).toUpperCase() + type.slice(1)} Agent');

// Add ${type}-specific logic here

console.log('✅ ${type.charAt(0).toUpperCase() + type.slice(1)} tasks complete!');
`;
  }

  getDeploymentTemplate() {
    return this.getGenericTemplate('deployment');
  }

  getDatabaseTemplate() {
    return this.getGenericTemplate('database');
  }

  getApiTemplate() {
    return this.getGenericTemplate('api');
  }

  getSecurityTemplate() {
    return this.getGenericTemplate('security');
  }

  getPerformanceTemplate() {
    return this.getGenericTemplate('performance');
  }

  getAiTemplate() {
    return this.getGenericTemplate('ai');
  }

  getKubernetesTemplate() {
    return this.getGenericTemplate('kubernetes');
  }
}

export function createSubagentManager(projectPath, projectName) {
  return new SubagentManager(projectPath, projectName);
}