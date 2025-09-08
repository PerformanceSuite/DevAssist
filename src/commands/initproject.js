/**
 * Infrastructure-Aware /initproject Command
 * Detects: Dagger, Kubernetes, Terraform, and more
 */

import { ProjectOrchestrator } from '../agents/project-orchestrator.js';
import { createSubagentManager } from '../agents/subagent-manager.js';
import { TechDocsFetcher } from '../documentation/tech-docs-fetcher.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export class InitProjectCommand {
  constructor() {
    this.orchestrator = new ProjectOrchestrator();
    this.name = 'initproject';
    this.description = 'Initialize a new project with DevAssist - sets up GitHub integration, Claude configuration, and development environment';
  }

  /**
   * Enhanced infrastructure detection
   */
  async detectInfrastructure(projectPath) {
    const infra = {
      tools: [],
      orchestration: [],
      cicd: [],
      iac: [],  // Infrastructure as Code
      deployment: [],
      monitoring: [],
      security: [],
      documentation: []
    };

    console.error('  🔍 Detecting infrastructure tools...');

    try {
      // Check for Dagger
      const daggerFiles = [
        'dagger.json',
        'dagger.cue',
        'dagger/dagger.json',
        'ci/dagger.cue',
        '.dagger/dagger.json'
      ];
      
      for (const file of daggerFiles) {
        if (await this.fileExists(projectPath, file)) {
          infra.iac.push('Dagger');
          infra.tools.push('Dagger');
          console.error('  ✓ Dagger detected - CI/CD pipeline as code');
          break;
        }
      }

      // Check package.json for Dagger SDK
      const packagePath = path.join(projectPath, 'package.json');
      if (await this.fileExists(projectPath, 'package.json')) {
        const pkg = JSON.parse(await fs.readFile(packagePath, 'utf8'));
        if (pkg.dependencies?.['@dagger.io/dagger'] || pkg.devDependencies?.['@dagger.io/dagger']) {
          if (!infra.iac.includes('Dagger')) {
            infra.iac.push('Dagger');
            infra.tools.push('Dagger SDK');
            console.error('  ✓ Dagger SDK detected');
          }
        }
      }

      // Check for Kubernetes
      const k8sFiles = [
        'k8s/',
        'kubernetes/',
        'deployment.yaml',
        'deployment.yml',
        'kustomization.yaml',
        'helm/',
        'charts/',
        'helmfile.yaml',
        'skaffold.yaml'
      ];
      
      for (const file of k8sFiles) {
        if (await this.fileOrDirExists(projectPath, file)) {
          if (!infra.orchestration.includes('Kubernetes')) {
            infra.orchestration.push('Kubernetes');
            infra.tools.push('Kubernetes');
            console.error('  ✓ Kubernetes detected - container orchestration');
          }
          
          if (file.includes('helm')) {
            infra.tools.push('Helm');
            console.error('  ✓ Helm detected - Kubernetes package manager');
          }
          
          if (file.includes('skaffold')) {
            infra.tools.push('Skaffold');
            console.error('  ✓ Skaffold detected - Kubernetes development');
          }
        }
      }

      // Check for Docker Compose
      const dockerComposeFiles = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];
      for (const file of dockerComposeFiles) {
        if (await this.fileExists(projectPath, file)) {
          infra.orchestration.push('Docker Compose');
          infra.tools.push('Docker Compose');
          console.error('  ✓ Docker Compose detected');
          break;
        }
      }

      // Check for Terraform
      const terraformFiles = [
        'main.tf',
        'terraform/',
        '*.tf',
        'terraform.tfvars',
        '.terraform/',
        'terragrunt.hcl'
      ];
      
      for (const pattern of terraformFiles) {
        if (await this.patternExists(projectPath, pattern)) {
          if (!infra.iac.includes('Terraform')) {
            infra.iac.push('Terraform');
            infra.tools.push('Terraform');
            console.error('  ✓ Terraform detected - infrastructure as code');
          }
          
          if (pattern.includes('terragrunt')) {
            infra.tools.push('Terragrunt');
            console.error('  ✓ Terragrunt detected - Terraform wrapper');
          }
          break;
        }
      }

      // Check for Pulumi
      if (await this.fileExists(projectPath, 'Pulumi.yaml') || await this.fileExists(projectPath, 'Pulumi.yml')) {
        infra.iac.push('Pulumi');
        infra.tools.push('Pulumi');
        console.error('  ✓ Pulumi detected - infrastructure as code');
      }

      // Check for AWS CDK
      if (await this.fileExists(projectPath, 'cdk.json')) {
        infra.iac.push('AWS CDK');
        infra.tools.push('AWS CDK');
        console.error('  ✓ AWS CDK detected - AWS infrastructure as code');
      }

      // Check for Ansible
      const ansibleFiles = ['ansible.cfg', 'playbook.yml', 'playbook.yaml', 'ansible/', 'inventories/'];
      for (const file of ansibleFiles) {
        if (await this.fileOrDirExists(projectPath, file)) {
          infra.iac.push('Ansible');
          infra.tools.push('Ansible');
          console.error('  ✓ Ansible detected - configuration management');
          break;
        }
      }

      // Check for CI/CD
      if (await this.fileOrDirExists(projectPath, '.github/workflows')) {
        infra.cicd.push('GitHub Actions');
        console.error('  ✓ GitHub Actions detected');
      }
      
      if (await this.fileExists(projectPath, '.gitlab-ci.yml')) {
        infra.cicd.push('GitLab CI');
        console.error('  ✓ GitLab CI detected');
      }
      
      if (await this.fileExists(projectPath, 'Jenkinsfile')) {
        infra.cicd.push('Jenkins');
        console.error('  ✓ Jenkins detected');
      }
      
      if (await this.fileExists(projectPath, '.circleci/config.yml')) {
        infra.cicd.push('CircleCI');
        console.error('  ✓ CircleCI detected');
      }
      
      if (await this.fileExists(projectPath, 'azure-pipelines.yml')) {
        infra.cicd.push('Azure DevOps');
        console.error('  ✓ Azure DevOps detected');
      }

      // Check for Serverless
      if (await this.fileExists(projectPath, 'serverless.yml') || await this.fileExists(projectPath, 'serverless.yaml')) {
        infra.deployment.push('Serverless Framework');
        infra.tools.push('Serverless');
        console.error('  ✓ Serverless Framework detected');
      }

      // Check for Vercel
      if (await this.fileExists(projectPath, 'vercel.json')) {
        infra.deployment.push('Vercel');
        console.error('  ✓ Vercel detected');
      }

      // Check for Netlify
      if (await this.fileExists(projectPath, 'netlify.toml')) {
        infra.deployment.push('Netlify');
        console.error('  ✓ Netlify detected');
      }

      // Check for monitoring tools
      if (await this.patternExists(projectPath, '*prometheus*') || await this.patternExists(projectPath, '*grafana*')) {
        infra.monitoring.push('Prometheus/Grafana');
        console.error('  ✓ Prometheus/Grafana detected - monitoring');
      }

      // Check for service mesh
      if (await this.patternExists(projectPath, '*istio*') || await this.patternExists(projectPath, '*linkerd*')) {
        infra.tools.push('Service Mesh');
        console.error('  ✓ Service mesh detected');
      }

      // Check for message queues
      if (await this.patternExists(projectPath, '*kafka*') || await this.patternExists(projectPath, '*rabbitmq*')) {
        infra.tools.push('Message Queue');
        console.error('  ✓ Message queue infrastructure detected');
      }

    } catch (e) {
      console.error('  ⚠️ Infrastructure detection error:', e.message);
    }

    return infra;
  }

  /**
   * Create infrastructure-specific subagents
   */
  async createInfrastructureAgents(projectPath, infra) {
    const agents = [];

    // Always include cleanup
    agents.push({
      name: 'cleanup',
      type: 'universal',
      reason: 'Session cleanup and resource management'
    });

    // Dagger agent
    if (infra.iac.includes('Dagger') || infra.tools.includes('Dagger')) {
      agents.push({
        name: 'dagger-pipeline',
        type: 'cicd',
        reason: 'Dagger pipeline execution and management',
        script: `#!/usr/bin/env node
console.log('🔧 Dagger Pipeline Agent Active');
const { execSync } = require('child_process');

try {
  // Check Dagger version
  const version = execSync('dagger version', { encoding: 'utf8' });
  console.log('Dagger version:', version.trim());
  
  // List available pipelines
  const fs = require('fs');
  const daggerFiles = [
    'dagger.cue',
    'ci/dagger.cue',
    'dagger/dagger.json'
  ];
  
  daggerFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(\`  ✓ Found pipeline: \${file}\`);
    }
  });
  
  // Check for Dagger SDK
  if (fs.existsSync('package.json')) {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    if (pkg.dependencies?.['@dagger.io/dagger']) {
      console.log('  ✓ Dagger SDK installed');
    }
  }
  
  console.log('\\n💡 Commands:');
  console.log('  dagger run <pipeline> - Execute pipeline');
  console.log('  dagger list - List available actions');
  console.log('  dagger query - Interactive GraphQL');
  
} catch (e) {
  console.error('⚠️ Dagger not installed or configured:', e.message);
  console.log('\\nTo install Dagger:');
  console.log('  curl -L https://dl.dagger.io/dagger/install.sh | sh');
}

console.log('✅ Dagger pipeline check complete');
`
      });
      console.error('  ✓ Created dagger-pipeline agent');
    }

    // Kubernetes agent
    if (infra.orchestration.includes('Kubernetes')) {
      agents.push({
        name: 'k8s-manager',
        type: 'orchestration',
        reason: 'Kubernetes deployment and management',
        script: `#!/usr/bin/env node
console.log('☸️ Kubernetes Manager Agent Active');
const { execSync } = require('child_process');

try {
  // Check kubectl
  const version = execSync('kubectl version --client --short', { encoding: 'utf8' });
  console.log('kubectl:', version.trim());
  
  // Check current context
  const context = execSync('kubectl config current-context', { encoding: 'utf8' });
  console.log('Current context:', context.trim());
  
  // Check for manifests
  const fs = require('fs');
  const k8sDirs = ['k8s', 'kubernetes', 'manifests'];
  k8sDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      console.log(\`  ✓ Found \${files.length} manifests in \${dir}/\`);
    }
  });
  
  // Check for Helm
  try {
    const helmVersion = execSync('helm version --short', { encoding: 'utf8' });
    console.log('Helm:', helmVersion.trim());
  } catch {}
  
} catch (e) {
  console.error('⚠️ kubectl not configured:', e.message);
}

console.log('✅ Kubernetes check complete');
`
      });
      console.error('  ✓ Created k8s-manager agent');
    }

    // Terraform agent
    if (infra.iac.includes('Terraform')) {
      agents.push({
        name: 'terraform-planner',
        type: 'iac',
        reason: 'Terraform planning and state management',
        script: `#!/usr/bin/env node
console.log('🏗️ Terraform Planner Agent Active');
const { execSync } = require('child_process');

try {
  // Check Terraform version
  const version = execSync('terraform version -json', { encoding: 'utf8' });
  const versionInfo = JSON.parse(version);
  console.log('Terraform version:', versionInfo.terraform_version);
  
  // Check for state files
  const fs = require('fs');
  if (fs.existsSync('terraform.tfstate')) {
    console.log('  ⚠️ Local state file detected (consider remote state)');
  }
  
  // List workspaces
  try {
    const workspaces = execSync('terraform workspace list', { encoding: 'utf8' });
    console.log('Workspaces:', workspaces);
  } catch {}
  
  console.log('\\n💡 Commands:');
  console.log('  terraform init - Initialize configuration');
  console.log('  terraform plan - Preview changes');
  console.log('  terraform apply - Apply changes');
  console.log('  terraform destroy - Destroy infrastructure');
  
} catch (e) {
  console.error('⚠️ Terraform not installed:', e.message);
}

console.log('✅ Terraform check complete');
`
      });
      console.error('  ✓ Created terraform-planner agent');
    }

    // Docker Compose agent
    if (infra.orchestration.includes('Docker Compose')) {
      agents.push({
        name: 'compose-manager',
        type: 'orchestration',
        reason: 'Docker Compose service management',
        script: `#!/usr/bin/env node
console.log('🐳 Docker Compose Manager Agent Active');
const { execSync } = require('child_process');

try {
  // List services
  const services = execSync('docker compose ps --services', { encoding: 'utf8' });
  const serviceList = services.trim().split('\\n').filter(s => s);
  console.log(\`Services defined: \${serviceList.length}\`);
  serviceList.forEach(s => console.log(\`  • \${s}\`));
  
  // Check running containers
  try {
    const running = execSync('docker compose ps --status running --services', { encoding: 'utf8' });
    const runningList = running.trim().split('\\n').filter(s => s);
    console.log(\`\\nRunning: \${runningList.length} services\`);
  } catch {
    console.log('\\nNo services running');
  }
  
  console.log('\\n💡 Commands:');
  console.log('  docker compose up -d - Start services');
  console.log('  docker compose logs -f - View logs');
  console.log('  docker compose down - Stop services');
  
} catch (e) {
  console.error('⚠️ Docker Compose not configured:', e.message);
}

console.log('✅ Docker Compose check complete');
`
      });
      console.error('  ✓ Created compose-manager agent');
    }

    // CI/CD monitor agent for any CI/CD tool
    if (infra.cicd.length > 0) {
      agents.push({
        name: 'cicd-monitor',
        type: 'cicd',
        reason: `Monitor ${infra.cicd.join(', ')} pipelines`,
        script: `#!/usr/bin/env node
console.log('🔄 CI/CD Monitor Agent Active');
console.log('Monitoring: ${infra.cicd.join(', ')}');

const fs = require('fs');

${infra.cicd.includes('GitHub Actions') ? `
// GitHub Actions
if (fs.existsSync('.github/workflows')) {
  const workflows = fs.readdirSync('.github/workflows');
  console.log(\`\\nGitHub Actions: \${workflows.length} workflows\`);
  workflows.forEach(w => console.log(\`  • \${w}\`));
}
` : ''}

${infra.cicd.includes('GitLab CI') ? `
// GitLab CI
if (fs.existsSync('.gitlab-ci.yml')) {
  console.log('\\n✓ GitLab CI pipeline configured');
}
` : ''}

${infra.cicd.includes('Jenkins') ? `
// Jenkins
if (fs.existsSync('Jenkinsfile')) {
  console.log('\\n✓ Jenkinsfile present');
}
` : ''}

console.log('\\n💡 Check pipeline status in your CI/CD platform');
console.log('✅ CI/CD check complete');
`
      });
      console.error('  ✓ Created cicd-monitor agent');
    }

    return agents;
  }

  /**
   * Load infrastructure-specific documentation
   */
  async loadInfrastructureKnowledge(infra) {
    const knowledge = {
      documentation: [],
      commands: [],
      bestPractices: []
    };

    // Dagger knowledge
    if (infra.tools.includes('Dagger')) {
      knowledge.documentation.push({
        tool: 'Dagger',
        url: 'https://docs.dagger.io',
        description: 'Programmable CI/CD engine that runs pipelines in containers'
      });
      
      knowledge.commands.push({
        tool: 'Dagger',
        commands: [
          'dagger init - Initialize new Dagger project',
          'dagger run <cmd> - Run pipeline',
          'dagger list - List available actions',
          'dagger query - Interactive GraphQL explorer'
        ]
      });
      
      knowledge.bestPractices.push({
        tool: 'Dagger',
        practices: [
          'Keep pipelines modular and reusable',
          'Use caching effectively for dependencies',
          'Version your Dagger modules',
          'Test pipelines locally before pushing'
        ]
      });
    }

    // Kubernetes knowledge
    if (infra.orchestration.includes('Kubernetes')) {
      knowledge.documentation.push({
        tool: 'Kubernetes',
        url: 'https://kubernetes.io/docs',
        description: 'Container orchestration platform'
      });
      
      knowledge.commands.push({
        tool: 'Kubernetes',
        commands: [
          'kubectl apply -f <file> - Apply configuration',
          'kubectl get pods - List pods',
          'kubectl logs <pod> - View pod logs',
          'kubectl exec -it <pod> -- /bin/bash - Shell into pod'
        ]
      });
      
      knowledge.bestPractices.push({
        tool: 'Kubernetes',
        practices: [
          'Use namespaces for environment separation',
          'Implement resource limits and requests',
          'Use ConfigMaps and Secrets for configuration',
          'Set up health checks and readiness probes'
        ]
      });
    }

    // Terraform knowledge
    if (infra.iac.includes('Terraform')) {
      knowledge.documentation.push({
        tool: 'Terraform',
        url: 'https://www.terraform.io/docs',
        description: 'Infrastructure as Code tool'
      });
      
      knowledge.commands.push({
        tool: 'Terraform',
        commands: [
          'terraform init - Initialize working directory',
          'terraform plan - Preview changes',
          'terraform apply - Apply changes',
          'terraform state list - List resources in state'
        ]
      });
      
      knowledge.bestPractices.push({
        tool: 'Terraform',
        practices: [
          'Use remote state storage (S3, Azure Storage, etc.)',
          'Implement state locking to prevent conflicts',
          'Use workspaces for environment separation',
          'Version your modules and use semantic versioning'
        ]
      });
    }

    return knowledge;
  }

  /**
   * Enhanced deep analysis including infrastructure
   */
  async deepAnalyzeProject(projectPath) {
    const analysis = {
      // Language/Framework detection
      techStack: [],
      languages: [],
      frameworks: [],
      
      // Infrastructure detection
      infrastructure: await this.detectInfrastructure(projectPath),
      
      // Testing
      hasTests: false,
      testFrameworks: [],
      
      // Database
      hasDatabase: false,
      databases: [],
      
      // Project characteristics
      fileCount: 0,
      projectType: 'unknown',
      complexity: 'simple',  // simple, moderate, complex
      
      // Dependencies
      dependencies: []
    };

    try {
      // Check package.json for Node.js projects
      const packagePath = path.join(projectPath, 'package.json');
      if (await this.fileExists(projectPath, 'package.json')) {
        const pkg = JSON.parse(await fs.readFile(packagePath, 'utf8'));
        
        analysis.languages.push('JavaScript/TypeScript');
        
        // Detect all technologies
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        // Frameworks
        if (allDeps.next) {
          analysis.frameworks.push('Next.js');
          analysis.techStack.push('Next.js');
        }
        if (allDeps.react) {
          analysis.frameworks.push('React');
          analysis.techStack.push('React');
        }
        if (allDeps.vue) {
          analysis.frameworks.push('Vue');
          analysis.techStack.push('Vue');
        }
        if (allDeps.express) {
          analysis.frameworks.push('Express');
          analysis.techStack.push('Express');
        }
        if (allDeps.fastify) {
          analysis.frameworks.push('Fastify');
          analysis.techStack.push('Fastify');
        }
        
        // Testing
        if (allDeps.jest) {
          analysis.hasTests = true;
          analysis.testFrameworks.push('Jest');
        }
        if (allDeps.vitest) {
          analysis.hasTests = true;
          analysis.testFrameworks.push('Vitest');
        }
        if (allDeps.mocha) {
          analysis.hasTests = true;
          analysis.testFrameworks.push('Mocha');
        }
        
        // Database
        if (allDeps.prisma) {
          analysis.hasDatabase = true;
          analysis.databases.push('Prisma ORM');
        }
        if (allDeps.typeorm) {
          analysis.hasDatabase = true;
          analysis.databases.push('TypeORM');
        }
        if (allDeps.mongoose) {
          analysis.hasDatabase = true;
          analysis.databases.push('MongoDB (Mongoose)');
        }
        if (allDeps.pg || allDeps.postgres) {
          analysis.hasDatabase = true;
          analysis.databases.push('PostgreSQL');
        }
        
        analysis.dependencies = Object.keys(allDeps);
      }

      // Check for Python projects
      if (await this.fileExists(projectPath, 'requirements.txt') || 
          await this.fileExists(projectPath, 'pyproject.toml') ||
          await this.fileExists(projectPath, 'setup.py')) {
        analysis.languages.push('Python');
        analysis.techStack.push('Python');
        
        // Check for Python frameworks
        if (await this.fileExists(projectPath, 'manage.py')) {
          analysis.frameworks.push('Django');
        }
        if (await this.patternExists(projectPath, '*flask*')) {
          analysis.frameworks.push('Flask');
        }
        if (await this.patternExists(projectPath, '*fastapi*')) {
          analysis.frameworks.push('FastAPI');
        }
      }

      // Check for Go projects
      if (await this.fileExists(projectPath, 'go.mod')) {
        analysis.languages.push('Go');
        analysis.techStack.push('Go');
      }

      // Check for Rust projects
      if (await this.fileExists(projectPath, 'Cargo.toml')) {
        analysis.languages.push('Rust');
        analysis.techStack.push('Rust');
      }

      // Check for Java projects
      if (await this.fileExists(projectPath, 'pom.xml')) {
        analysis.languages.push('Java');
        analysis.techStack.push('Maven');
      }
      if (await this.fileExists(projectPath, 'build.gradle')) {
        analysis.languages.push('Java/Kotlin');
        analysis.techStack.push('Gradle');
      }

      // Count files to determine complexity
      const countFiles = async (dir) => {
        let count = 0;
        try {
          const items = await fs.readdir(dir);
          for (const item of items) {
            if (item.startsWith('.') || item === 'node_modules' || item === 'venv') continue;
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
      
      // Determine complexity
      if (analysis.fileCount < 50) {
        analysis.complexity = 'simple';
      } else if (analysis.fileCount < 200) {
        analysis.complexity = 'moderate';
      } else {
        analysis.complexity = 'complex';
      }
      
      // Determine project type based on everything detected
      if (analysis.infrastructure.iac.includes('Dagger')) {
        analysis.projectType = 'dagger-cicd';
      } else if (analysis.infrastructure.orchestration.includes('Kubernetes')) {
        analysis.projectType = 'kubernetes-app';
      } else if (analysis.frameworks.includes('Next.js')) {
        analysis.projectType = 'nextjs-app';
      } else if (analysis.frameworks.includes('React')) {
        analysis.projectType = 'react-app';
      } else if (analysis.infrastructure.iac.includes('Terraform')) {
        analysis.projectType = 'infrastructure';
      } else if (analysis.languages.includes('Python')) {
        analysis.projectType = 'python-app';
      } else if (analysis.languages.includes('Go')) {
        analysis.projectType = 'go-app';
      }
      
    } catch (e) {
      console.error('  ⚠️ Analysis error:', e.message);
    }

    return analysis;
  }

  /**
   * Create documentation including infrastructure
   */
  async createEnhancedDocumentation(projectPath, analysis, infra) {
    const docsDir = path.join(projectPath, '.devassist/docs');
    await fs.mkdir(docsDir, { recursive: true });

    // Create README
    const readmeContent = `# Project Documentation

## Overview
- **Type**: ${analysis.projectType}
- **Complexity**: ${analysis.complexity}
- **Languages**: ${analysis.languages.join(', ') || 'Not detected'}
- **Frameworks**: ${analysis.frameworks.join(', ') || 'None'}

## Infrastructure

### Tools
${infra.tools.map(t => `- ${t}`).join('\n') || '- None detected'}

### Infrastructure as Code
${infra.iac.map(t => `- ${t}`).join('\n') || '- None detected'}

### Container Orchestration
${infra.orchestration.map(t => `- ${t}`).join('\n') || '- None detected'}

### CI/CD
${infra.cicd.map(t => `- ${t}`).join('\n') || '- None detected'}

## Quick Start
See individual documentation for each tool.
`;

    await fs.writeFile(path.join(docsDir, 'README.md'), readmeContent);
    console.error('  ✓ Created README.md with infrastructure details');

    // Create infrastructure-specific docs
    if (infra.iac.includes('Dagger')) {
      const daggerDoc = `# Dagger Configuration

## Overview
This project uses Dagger for CI/CD pipelines as code.

## Commands
- \`dagger init\` - Initialize Dagger
- \`dagger run <pipeline>\` - Run a pipeline
- \`dagger list\` - List available actions
- \`dagger query\` - Interactive GraphQL explorer

## Project Pipelines
Check the following files for pipeline definitions:
- dagger.cue
- ci/dagger.cue
- dagger/dagger.json

## Best Practices
1. Keep pipelines modular
2. Use caching for dependencies
3. Version your modules
4. Test locally before pushing

## Resources
- [Dagger Documentation](https://docs.dagger.io)
- [Dagger SDK Reference](https://docs.dagger.io/sdk)
`;
      
      await fs.writeFile(path.join(docsDir, 'DAGGER.md'), daggerDoc);
      console.error('  ✓ Created DAGGER.md documentation');
    }

    if (infra.orchestration.includes('Kubernetes')) {
      const k8sDoc = `# Kubernetes Configuration

## Overview
This project is deployed on Kubernetes.

## Structure
- \`k8s/\` or \`kubernetes/\` - Manifest files
- \`helm/\` - Helm charts (if using Helm)

## Common Commands
- \`kubectl apply -f <manifest>\` - Apply configuration
- \`kubectl get pods\` - List pods
- \`kubectl logs <pod>\` - View logs
- \`kubectl exec -it <pod> -- /bin/bash\` - Shell access

## Deployment
1. Ensure kubectl is configured
2. Apply manifests: \`kubectl apply -f k8s/\`
3. Check status: \`kubectl get all\`

## Resources
- [Kubernetes Documentation](https://kubernetes.io/docs)
`;
      
      await fs.writeFile(path.join(docsDir, 'KUBERNETES.md'), k8sDoc);
      console.error('  ✓ Created KUBERNETES.md documentation');
    }

    if (infra.iac.includes('Terraform')) {
      const terraformDoc = `# Terraform Configuration

## Overview
Infrastructure managed by Terraform.

## Commands
- \`terraform init\` - Initialize
- \`terraform plan\` - Preview changes
- \`terraform apply\` - Apply changes
- \`terraform destroy\` - Destroy resources

## Structure
- \`main.tf\` - Main configuration
- \`variables.tf\` - Variable definitions
- \`outputs.tf\` - Output definitions

## Best Practices
1. Use remote state
2. Implement state locking
3. Use workspaces for environments
4. Version your modules

## Resources
- [Terraform Documentation](https://www.terraform.io/docs)
`;
      
      await fs.writeFile(path.join(docsDir, 'TERRAFORM.md'), terraformDoc);
      console.error('  ✓ Created TERRAFORM.md documentation');
    }
  }

  /**
   * Generate comprehensive report including infrastructure
   */
  generateUltimateReport(config) {
    const {
      projectName,
      projectPath,
      analysis,
      infraAgents,
      knowledge,
      docsResult
    } = config;
    
    const infraTools = analysis.infrastructure.tools.join(', ') || 'None';
    const infraAgentList = infraAgents
      .map(a => `  🤖 ${a.name} (${a.type}): ${a.reason}`)
      .join('\n');
    
    return `
╔════════════════════════════════════════════════════════════╗
║   🎉 ${projectName} DevAssist with Infrastructure Ready!   ║
╚════════════════════════════════════════════════════════════╝

📁 Project: ${projectName}
📂 Path: ${projectPath}

📊 Language & Framework Analysis:
  • Languages: ${analysis.languages.join(', ') || 'Not detected'}
  • Frameworks: ${analysis.frameworks.join(', ') || 'None'}
  • Complexity: ${analysis.complexity}
  • File Count: ${analysis.fileCount}

🏗️ Infrastructure Analysis:
  • Tools: ${infraTools}
  • IaC: ${analysis.infrastructure.iac.join(', ') || 'None'}
  • Orchestration: ${analysis.infrastructure.orchestration.join(', ') || 'None'}
  • CI/CD: ${analysis.infrastructure.cicd.join(', ') || 'None'}
  • Deployment: ${analysis.infrastructure.deployment.join(', ') || 'None'}

🤖 Infrastructure Agents Created:
${infraAgentList}

📚 Documentation Status:
${docsResult ? docsResult.summary : '  • No documentation fetched'}

📄 Project Documentation Created:
  • README.md - Project overview with infrastructure
${analysis.infrastructure.iac.includes('Dagger') ? '  • DAGGER.md - Dagger pipeline documentation' : ''}
${analysis.infrastructure.orchestration.includes('Kubernetes') ? '  • KUBERNETES.md - Kubernetes deployment guide' : ''}
${analysis.infrastructure.iac.includes('Terraform') ? '  • TERRAFORM.md - Terraform infrastructure guide' : ''}

✨ Commands Available:
  • /start-${projectName.toLowerCase()} - Start with warmup & agent verification
  • /end-${projectName.toLowerCase()} - End with cleanup
  • /status-${projectName.toLowerCase()} - Check all systems
${infraAgents.map(a => `  • /run-${a.name} - Execute ${a.type} operations`).join('\n')}

📖 Infrastructure Knowledge Loaded:
${knowledge.documentation.map(d => `  • ${d.tool}: ${d.description}`).join('\n') || '  • Standard development practices'}

⚠️ IMPORTANT:
1. Restart Claude Code to activate enhanced DevAssist
2. Infrastructure agents will verify tools on startup
3. Documentation includes infrastructure-specific guides

🚀 Your infrastructure-aware environment is ready!`;
  }

  // Helper methods
  async fileExists(projectPath, file) {
    try {
      const fullPath = path.join(projectPath, file);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async fileOrDirExists(projectPath, fileOrDir) {
    try {
      const fullPath = path.join(projectPath, fileOrDir);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async patternExists(projectPath, pattern) {
    try {
      const { stdout } = await execAsync(`find . -name "${pattern}" -print -quit`, { 
        cwd: projectPath 
      });
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  // Main execute method
  async execute(args = {}) {
    const projectPath = args.path || process.cwd();
    let projectName = path.basename(projectPath);
    
    // Get project name from package.json if available
    try {
      if (await this.fileExists(projectPath, 'package.json')) {
        const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf8'));
        if (pkg.name) projectName = pkg.name;
      }
    } catch {}
    
    const displayName = projectName.charAt(0).toUpperCase() + projectName.slice(1);
    
    console.error(`
╔══════════════════════════════════════════════════════════════╗
║  🚀 DevAssist Infrastructure-Aware Initialization           ║
╚══════════════════════════════════════════════════════════════╝

📁 Project: ${displayName}
📂 Path: ${projectPath}
`);
    
    try {
      // Deep analysis including infrastructure
      console.error('▶ Analyzing project (languages & infrastructure)...');
      const analysis = await this.deepAnalyzeProject(projectPath);
      
      // Fetch documentation for detected technologies
      console.error('\n▶ Fetching documentation for detected technologies...');
      const docsFetcher = new TechDocsFetcher();
      await docsFetcher.initialize();
      
      // Combine all detected technologies
      const allTechnologies = [
        ...analysis.primaryLanguages,
        ...analysis.infrastructure.tools,
        ...analysis.infrastructure.orchestration,
        ...analysis.infrastructure.iac,
        ...analysis.infrastructure.cicd
      ].filter((tech, index, self) => self.indexOf(tech) === index); // Remove duplicates
      
      const docsResult = await docsFetcher.fetchDocsForTechnologies(allTechnologies);
      
      // Create infrastructure agents
      console.error('\n▶ Creating infrastructure-specific agents...');
      const infraAgents = await this.createInfrastructureAgents(projectPath, analysis.infrastructure);
      
      // Load infrastructure knowledge
      console.error('\n▶ Loading infrastructure knowledge base...');
      const knowledge = await this.loadInfrastructureKnowledge(analysis.infrastructure);
      
      // Create documentation
      console.error('\n▶ Creating documentation...');
      await this.createEnhancedDocumentation(projectPath, analysis, analysis.infrastructure);
      
      // Build agents
      console.error('\n▶ Building agent scripts...');
      const agentsDir = path.join(projectPath, '.devassist/agents');
      await fs.mkdir(agentsDir, { recursive: true });
      
      for (const agent of infraAgents) {
        const agentPath = path.join(agentsDir, `${agent.name}.js`);
        await fs.writeFile(agentPath, agent.script || '#!/usr/bin/env node\nconsole.log("Agent placeholder");', { mode: 0o755 });
      }
      
      // Generate report
      const report = this.generateUltimateReport({
        projectName: displayName,
        projectPath,
        analysis,
        infraAgents,
        knowledge,
        docsResult
      });
      
      console.error(`\n✅ ${displayName} infrastructure-aware DevAssist ready!`);
      
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
          text: `Error: ${error.message}\n\nPlease check logs and try again.`
        }]
      };
    }
  }
}

export default InitProjectCommand;
