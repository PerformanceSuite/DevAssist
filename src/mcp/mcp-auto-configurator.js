/**
 * MCP Auto-Configurator for DevAssist v3.0
 * Automatically discovers and configures MCP servers based on project requirements
 */

import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class MCPAutoConfigurator {
  constructor() {
    this.mcpRegistry = this.initializeMCPRegistry();
    this.configured = [];
  }

  /**
   * Initialize MCP registry with available MCPs
   */
  initializeMCPRegistry() {
    return {
      // File system MCPs
      filesystem: {
        name: 'filesystem',
        description: 'File system operations',
        package: '@modelcontextprotocol/server-filesystem',
        always: true
      },

      // Version control
      github: {
        name: 'github',
        description: 'GitHub integration',
        package: '@modelcontextprotocol/server-github',
        detection: ['git', '.git', '.github']
      },
      gitlab: {
        name: 'gitlab',
        description: 'GitLab integration',
        package: '@modelcontextprotocol/server-gitlab',
        detection: ['.gitlab-ci.yml']
      },

      // Databases
      postgresql: {
        name: 'postgresql',
        description: 'PostgreSQL database',
        package: '@modelcontextprotocol/server-postgres',
        detection: ['pg', 'postgres', 'postgresql']
      },
      mysql: {
        name: 'mysql',
        description: 'MySQL database',
        package: '@modelcontextprotocol/server-mysql',
        detection: ['mysql', 'mysql2']
      },
      mongodb: {
        name: 'mongodb',
        description: 'MongoDB database',
        package: '@modelcontextprotocol/server-mongodb',
        detection: ['mongodb', 'mongoose']
      },
      redis: {
        name: 'redis',
        description: 'Redis cache',
        package: '@modelcontextprotocol/server-redis',
        detection: ['redis', 'ioredis']
      },

      // Cloud providers
      aws: {
        name: 'aws',
        description: 'AWS services',
        package: '@modelcontextprotocol/server-aws',
        detection: ['aws-sdk', '@aws-sdk', 'serverless.yml']
      },
      gcp: {
        name: 'gcp',
        description: 'Google Cloud Platform',
        package: '@modelcontextprotocol/server-gcp',
        detection: ['@google-cloud', 'app.yaml', 'cloudbuild.yaml']
      },
      azure: {
        name: 'azure',
        description: 'Azure services',
        package: '@modelcontextprotocol/server-azure',
        detection: ['@azure', 'azure-pipelines.yml']
      },

      // Development tools
      docker: {
        name: 'docker',
        description: 'Docker container management',
        package: '@modelcontextprotocol/server-docker',
        detection: ['Dockerfile', 'docker-compose.yml']
      },
      kubernetes: {
        name: 'kubernetes',
        description: 'Kubernetes orchestration',
        package: '@modelcontextprotocol/server-kubernetes',
        detection: ['kubernetes/', 'k8s/', 'helm/']
      },
      terraform: {
        name: 'terraform',
        description: 'Terraform infrastructure',
        package: '@modelcontextprotocol/server-terraform',
        detection: ['*.tf', 'terraform/']
      },

      // Testing tools
      playwright: {
        name: 'playwright',
        description: 'Playwright E2E testing',
        package: '@modelcontextprotocol/server-playwright',
        detection: ['@playwright/test', 'playwright.config']
      },
      cypress: {
        name: 'cypress',
        description: 'Cypress E2E testing',
        package: '@modelcontextprotocol/server-cypress',
        detection: ['cypress', 'cypress.config']
      },

      // Specialized MCPs
      slack: {
        name: 'slack',
        description: 'Slack integration',
        package: '@modelcontextprotocol/server-slack',
        detection: ['@slack/web-api']
      },
      jira: {
        name: 'jira',
        description: 'Jira integration',
        package: '@modelcontextprotocol/server-jira',
        detection: ['jira-client']
      },
      sentry: {
        name: 'sentry',
        description: 'Sentry error tracking',
        package: '@modelcontextprotocol/server-sentry',
        detection: ['@sentry']
      },

      // Custom GCP MCPs for Veria-like projects
      'gcp-cloud-run': {
        name: 'gcp-cloud-run',
        description: 'Google Cloud Run deployment',
        package: '@custom/mcp-gcp-cloud-run',
        custom: true,
        detection: ['app.yaml', 'service.yaml']
      },
      'gcp-secret-manager': {
        name: 'gcp-secret-manager',
        description: 'GCP Secret Manager',
        package: '@custom/mcp-gcp-secrets',
        custom: true,
        detection: ['@google-cloud/secret-manager']
      },
      'gcp-artifact-registry': {
        name: 'gcp-artifact-registry',
        description: 'GCP Artifact Registry',
        package: '@custom/mcp-gcp-artifacts',
        custom: true,
        detection: ['cloudbuild.yaml']
      }
    };
  }

  /**
   * Configure MCPs based on project profile
   */
  async configureMCPs(profile) {
    const mcps = [];

    // Always include filesystem
    mcps.push(await this.configureMCP('filesystem', profile));

    // Version control
    if (profile.vcs === 'git') {
      mcps.push(await this.configureMCP('github', profile));
    }

    // Databases
    for (const db of profile.stack.databases) {
      const mcpName = this.mapDatabaseToMCP(db);
      if (mcpName && this.mcpRegistry[mcpName]) {
        mcps.push(await this.configureMCP(mcpName, profile));
      }
    }

    // Cloud providers
    if (profile.stack.cloud) {
      const cloudMCP = await this.configureCloudMCP(profile.stack.cloud, profile);
      if (cloudMCP) mcps.push(...cloudMCP);
    }

    // Development tools
    if (profile.stack.tools.includes('docker')) {
      mcps.push(await this.configureMCP('docker', profile));
    }
    if (profile.stack.tools.includes('kubernetes')) {
      mcps.push(await this.configureMCP('kubernetes', profile));
    }
    if (profile.stack.tools.includes('terraform')) {
      mcps.push(await this.configureMCP('terraform', profile));
    }

    // Testing tools
    if (profile.stack.testing.includes('playwright')) {
      mcps.push(await this.configureMCP('playwright', profile));
    }
    if (profile.stack.testing.includes('cypress')) {
      mcps.push(await this.configureMCP('cypress', profile));
    }

    // Special requirements
    if (profile.custom.oidc_wif && profile.stack.cloud === 'gcp') {
      mcps.push(await this.configureMCP('gcp-secret-manager', profile));
    }

    // Save configuration
    await this.saveMCPConfiguration(mcps, profile.projectPath);

    return mcps.filter(Boolean);
  }

  /**
   * Configure a single MCP
   */
  async configureMCP(name, profile) {
    const mcp = this.mcpRegistry[name];
    if (!mcp) return null;

    const config = {
      name: mcp.name,
      description: mcp.description,
      package: mcp.package,
      configuration: await this.generateMCPConfig(name, profile),
      status: 'configured'
    };

    // Check if MCP needs installation
    if (!mcp.custom && !await this.isMCPInstalled(mcp.package)) {
      config.status = 'needs-installation';
      config.installCommand = `npm install -g ${mcp.package}`;
    }

    this.configured.push(config);
    return config;
  }

  /**
   * Configure cloud-specific MCPs
   */
  async configureCloudMCP(cloud, profile) {
    const mcps = [];

    switch (cloud) {
      case 'gcp':
        mcps.push(await this.configureMCP('gcp', profile));
        if (profile.custom.oidc_wif) {
          mcps.push(await this.configureGCPWithOIDC(profile));
        }
        if (profile.custom.private_only) {
          mcps.push(await this.configurePrivateGCP(profile));
        }
        break;

      case 'aws':
        mcps.push(await this.configureMCP('aws', profile));
        break;

      case 'azure':
        mcps.push(await this.configureMCP('azure', profile));
        break;
    }

    return mcps.filter(Boolean);
  }

  /**
   * Configure GCP with OIDC/WIF
   */
  async configureGCPWithOIDC(profile) {
    return {
      name: 'gcp-oidc',
      description: 'GCP with OIDC/Workload Identity Federation',
      configuration: {
        authentication: 'oidc',
        workloadIdentityProvider: profile.custom.gcp_wif_provider || 'projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID',
        serviceAccount: profile.custom.gcp_service_account || 'SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com',
        project: profile.custom.gcp_project,
        region: profile.custom.region || 'us-central1'
      },
      specialInstructions: [
        'Use OIDC tokens for authentication',
        'Never use service account keys',
        'Implement proper token refresh',
        'Validate tokens on every request'
      ]
    };
  }

  /**
   * Configure private-only GCP services
   */
  async configurePrivateGCP(profile) {
    return {
      name: 'gcp-private',
      description: 'Private-only GCP configuration',
      configuration: {
        networking: 'private-only',
        vpcConnector: profile.custom.vpc_connector || 'projects/PROJECT_ID/locations/REGION/connectors/CONNECTOR_NAME',
        ingressSettings: 'internal-only',
        egressSettings: 'private-ranges-only',
        loadBalancer: 'internal'
      },
      specialInstructions: [
        'All services must be private',
        'Use VPC connector for Cloud Run',
        'Configure internal load balancers',
        'No public IP addresses',
        'VPN required for external access'
      ]
    };
  }

  /**
   * Generate MCP-specific configuration
   */
  async generateMCPConfig(name, profile) {
    const configs = {
      filesystem: {
        rootPath: profile.projectPath,
        allowedPaths: [profile.projectPath],
        excludePatterns: ['node_modules', '.git', 'dist', 'build']
      },

      github: {
        owner: await this.detectGitHubOwner(profile.projectPath),
        repo: await this.detectGitHubRepo(profile.projectPath),
        defaultBranch: 'main'
      },

      postgresql: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || profile.name,
        connectionPool: {
          min: 2,
          max: 10
        }
      },

      mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
        database: process.env.DB_NAME || profile.name,
        options: {
          useUnifiedTopology: true
        }
      },

      docker: {
        socket: '/var/run/docker.sock',
        registry: profile.custom.docker_registry,
        buildContext: profile.projectPath
      },

      kubernetes: {
        context: process.env.K8S_CONTEXT || 'default',
        namespace: process.env.K8S_NAMESPACE || 'default'
      },

      gcp: {
        project: profile.custom.gcp_project,
        region: profile.custom.region || 'us-central1',
        services: this.detectGCPServices(profile)
      },

      aws: {
        region: process.env.AWS_REGION || 'us-east-1',
        profile: process.env.AWS_PROFILE || 'default'
      }
    };

    return configs[name] || {};
  }

  /**
   * Map database names to MCP names
   */
  mapDatabaseToMCP(database) {
    const mapping = {
      'postgresql': 'postgresql',
      'postgres': 'postgresql',
      'mysql': 'mysql',
      'mongodb': 'mongodb',
      'mongo': 'mongodb',
      'redis': 'redis'
    };
    return mapping[database.toLowerCase()];
  }

  /**
   * Check if MCP is installed
   */
  async isMCPInstalled(packageName) {
    try {
      const { stdout } = await execAsync(`npm list -g ${packageName} --depth=0`);
      return stdout.includes(packageName);
    } catch {
      return false;
    }
  }

  /**
   * Detect GitHub owner and repo
   */
  async detectGitHubOwner(projectPath) {
    try {
      const { stdout } = await execAsync('git remote get-url origin', { cwd: projectPath });
      const match = stdout.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  async detectGitHubRepo(projectPath) {
    try {
      const { stdout } = await execAsync('git remote get-url origin', { cwd: projectPath });
      const match = stdout.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
      return match ? match[2].replace('.git', '') : null;
    } catch {
      return null;
    }
  }

  /**
   * Detect GCP services in use
   */
  detectGCPServices(profile) {
    const services = [];

    if (profile.custom.deployment === 'container') {
      services.push('cloud-run');
    }
    if (profile.stack.databases.includes('postgresql')) {
      services.push('cloud-sql');
    }
    if (profile.custom.oidc_wif) {
      services.push('iam', 'sts');
    }
    services.push('secret-manager', 'artifact-registry');

    return services;
  }

  /**
   * Save MCP configuration
   */
  async saveMCPConfiguration(mcps, projectPath) {
    const config = {
      version: '1.0',
      generated: new Date().toISOString(),
      mcps: mcps.map(mcp => ({
        name: mcp.name,
        description: mcp.description,
        package: mcp.package,
        configuration: mcp.configuration,
        status: mcp.status
      }))
    };

    const configPath = path.join(projectPath, '.claude', 'mcps', 'config.json');
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

    // Generate installation script
    await this.generateInstallScript(mcps, projectPath);

    // Generate MCP documentation
    await this.generateMCPDocumentation(mcps, projectPath);

    return configPath;
  }

  /**
   * Generate installation script for MCPs
   */
  async generateInstallScript(mcps, projectPath) {
    const script = [];

    script.push('#!/bin/bash');
    script.push('# MCP Installation Script');
    script.push('# Generated by DevAssist v3.0\n');

    script.push('echo "Installing MCP servers..."\n');

    for (const mcp of mcps) {
      if (mcp.status === 'needs-installation' && !mcp.custom) {
        script.push(`echo "Installing ${mcp.name}..."`);
        script.push(`npm install -g ${mcp.package}`);
        script.push('');
      }
    }

    script.push('echo "MCP installation complete!"');

    const scriptPath = path.join(projectPath, '.claude', 'mcps', 'install.sh');
    await fs.writeFile(scriptPath, script.join('\n'), { mode: 0o755 });

    return scriptPath;
  }

  /**
   * Generate MCP documentation
   */
  async generateMCPDocumentation(mcps, projectPath) {
    const docs = [];

    docs.push('# MCP Configuration\n');
    docs.push('This document describes the Model Context Protocol servers configured for this project.\n');

    docs.push('## Configured MCPs\n');

    for (const mcp of mcps) {
      docs.push(`### ${mcp.name}\n`);
      docs.push(`**Description:** ${mcp.description}`);
      docs.push(`**Package:** \`${mcp.package}\``);
      docs.push(`**Status:** ${mcp.status}\n`);

      if (mcp.configuration && Object.keys(mcp.configuration).length > 0) {
        docs.push('**Configuration:**');
        docs.push('```json');
        docs.push(JSON.stringify(mcp.configuration, null, 2));
        docs.push('```\n');
      }

      if (mcp.specialInstructions) {
        docs.push('**Special Instructions:**');
        mcp.specialInstructions.forEach(instruction => {
          docs.push(`- ${instruction}`);
        });
        docs.push('');
      }
    }

    docs.push('## Installation\n');
    docs.push('To install all required MCPs, run:');
    docs.push('```bash');
    docs.push('sh .claude/mcps/install.sh');
    docs.push('```\n');

    docs.push('## Claude Desktop Configuration\n');
    docs.push('Add the following to your Claude Desktop configuration:');
    docs.push('```json');
    docs.push(JSON.stringify(this.generateClaudeDesktopConfig(mcps), null, 2));
    docs.push('```');

    const docsPath = path.join(projectPath, '.claude', 'mcps', 'README.md');
    await fs.writeFile(docsPath, docs.join('\n'), 'utf8');

    return docsPath;
  }

  /**
   * Generate Claude Desktop configuration
   */
  generateClaudeDesktopConfig(mcps) {
    const config = {
      mcpServers: {}
    };

    for (const mcp of mcps) {
      if (!mcp.custom) {
        config.mcpServers[mcp.name] = {
          command: 'npx',
          args: [mcp.package],
          env: this.generateMCPEnv(mcp)
        };
      }
    }

    return config;
  }

  /**
   * Generate environment variables for MCP
   */
  generateMCPEnv(mcp) {
    const env = {};

    if (mcp.name === 'github') {
      env.GITHUB_TOKEN = '${GITHUB_TOKEN}';
    } else if (mcp.name === 'postgresql') {
      env.DATABASE_URL = '${DATABASE_URL}';
    } else if (mcp.name === 'mongodb') {
      env.MONGODB_URI = '${MONGODB_URI}';
    } else if (mcp.name === 'gcp') {
      env.GOOGLE_APPLICATION_CREDENTIALS = '${GOOGLE_APPLICATION_CREDENTIALS}';
    } else if (mcp.name === 'aws') {
      env.AWS_ACCESS_KEY_ID = '${AWS_ACCESS_KEY_ID}';
      env.AWS_SECRET_ACCESS_KEY = '${AWS_SECRET_ACCESS_KEY}';
    }

    return env;
  }

  /**
   * Recommend MCPs based on profile
   */
  recommendMCPs(profile) {
    const recommendations = {
      required: [],
      recommended: [],
      optional: []
    };

    // Always required
    recommendations.required.push('filesystem');

    // Based on VCS
    if (profile.vcs === 'git') {
      recommendations.required.push('github');
    }

    // Based on databases
    profile.stack.databases.forEach(db => {
      const mcpName = this.mapDatabaseToMCP(db);
      if (mcpName) {
        recommendations.recommended.push(mcpName);
      }
    });

    // Based on cloud
    if (profile.stack.cloud) {
      recommendations.recommended.push(profile.stack.cloud);
    }

    // Based on tools
    if (profile.stack.tools.includes('docker')) {
      recommendations.optional.push('docker');
    }
    if (profile.stack.tools.includes('kubernetes')) {
      recommendations.optional.push('kubernetes');
    }

    return recommendations;
  }
}

export default MCPAutoConfigurator;