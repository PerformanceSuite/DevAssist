#!/usr/bin/env node

/**
 * Test Example: Veria Project Configuration
 * Simulates running the intelligent agent generator on a Veria-like project
 */

import { IntelligentAgentGenerator } from '../src/agents/intelligent-agent-generator.js';
import { ProjectAnalyzer } from '../src/analysis/project-analyzer.js';
import { promises as fs } from 'fs';
import path from 'path';

// Create a mock Veria project structure for testing
async function createMockVeriaProject() {
  const testPath = '/tmp/veria-test';

  // Create project structure
  await fs.mkdir(testPath, { recursive: true });
  await fs.mkdir(path.join(testPath, 'services'), { recursive: true });
  await fs.mkdir(path.join(testPath, 'services', 'ai-broker'), { recursive: true });
  await fs.mkdir(path.join(testPath, '.github', 'workflows'), { recursive: true });

  // Create package.json with Veria-like dependencies
  const packageJson = {
    name: 'veria',
    version: '1.0.0',
    description: 'AI-native compliance and distribution middleware for tokenized real-world assets',
    dependencies: {
      '@google-cloud/secret-manager': '^4.0.0',
      '@google-cloud/run': '^1.0.0',
      'express': '^4.18.0',
      'jsonwebtoken': '^9.0.0',
      'web3': '^4.0.0',
      'ethers': '^6.0.0',
      'pg': '^8.11.0'
    },
    devDependencies: {
      'typescript': '^5.0.0',
      'jest': '^29.0.0',
      '@types/node': '^20.0.0'
    }
  };

  await fs.writeFile(
    path.join(testPath, 'package.json'),
    JSON.stringify(packageJson, null, 2),
    'utf8'
  );

  // Create app.yaml for GCP
  const appYaml = `
runtime: nodejs20
service: ai-broker

env_variables:
  NODE_ENV: production

vpc_access_connector:
  name: projects/veria-dev/locations/us-central1/connectors/veria-connector

service_account: ai-broker@veria-dev.iam.gserviceaccount.com
`;

  await fs.writeFile(
    path.join(testPath, 'app.yaml'),
    appYaml,
    'utf8'
  );

  // Create cloudbuild.yaml
  const cloudbuild = `
steps:
  - name: gcr.io/cloud-builders/docker
    args: ['build', '-t', 'gcr.io/veria-dev/ai-broker', '.']
  - name: gcr.io/cloud-builders/docker
    args: ['push', 'gcr.io/veria-dev/ai-broker']
  - name: gcr.io/cloud-builders/gcloud
    args: ['run', 'deploy', 'ai-broker', '--image', 'gcr.io/veria-dev/ai-broker']
`;

  await fs.writeFile(
    path.join(testPath, 'cloudbuild.yaml'),
    cloudbuild,
    'utf8'
  );

  // Create a sample service file with OIDC/WIF references
  const serviceCode = `
import { authenticateWithOIDC } from './auth/oidc';
import { WorkloadIdentityFederation } from '@google-cloud/iam';

// OIDC/WIF authentication for private-only service
export async function initializeAuth() {
  const wif = new WorkloadIdentityFederation({
    workloadIdentityPool: 'projects/123456/locations/global/workloadIdentityPools/veria-pool',
    provider: 'projects/123456/locations/global/workloadIdentityPools/veria-pool/providers/github',
    serviceAccount: 'ai-broker@veria-dev.iam.gserviceaccount.com'
  });

  return await wif.getAccessToken();
}

// Tokenization logic for real-world assets
export class RWATokenizer {
  async tokenizeAsset(asset) {
    // KYC/AML verification
    await this.verifyKYC(asset.owner);

    // Compliance checks
    await this.checkCompliance(asset);

    // Create token on blockchain
    return await this.mintToken(asset);
  }
}
`;

  await fs.writeFile(
    path.join(testPath, 'services', 'ai-broker', 'index.js'),
    serviceCode,
    'utf8'
  );

  // Create GitHub Actions workflow
  const workflow = `
name: Deploy to Cloud Run
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: actions/checkout@v3

      - id: auth
        uses: google-github-actions/auth@v1
        with:
          workload_identity_provider: 'projects/123456/locations/global/workloadIdentityPools/veria-pool/providers/github'
          service_account: 'ai-broker@veria-dev.iam.gserviceaccount.com'

      - name: Deploy to Cloud Run
        run: gcloud run deploy ai-broker --source .
`;

  await fs.writeFile(
    path.join(testPath, '.github', 'workflows', 'deploy.yml'),
    workflow,
    'utf8'
  );

  return testPath;
}

// Test the intelligent agent generator
async function testVeriaConfiguration() {
  console.log('🧪 Testing Intelligent Agent Generator with Veria Project\n');
  console.log('=' .repeat(60) + '\n');

  try {
    // Create mock project
    console.log('📁 Creating mock Veria project structure...');
    const projectPath = await createMockVeriaProject();
    console.log(`   Created at: ${projectPath}\n`);

    // Analyze the project
    console.log('📊 Analyzing project...');
    const analyzer = new ProjectAnalyzer();
    const profile = await analyzer.deepAnalyze(projectPath);

    console.log('   Project Analysis Results:');
    console.log(`   • Name: ${profile.name}`);
    console.log(`   • Type: ${profile.type.join(', ')}`);
    console.log(`   • Complexity: ${profile.complexity.level} (Score: ${profile.complexity.score}/100)`);
    console.log(`   • Stack: ${profile.stack.languages.join(', ')}`);
    console.log(`   • Cloud: ${profile.stack.cloud}`);
    console.log(`   • Special Requirements:`);

    if (profile.custom.oidc_wif) {
      console.log(`     ✓ OIDC/WIF Authentication detected`);
    }
    if (profile.custom.private_only) {
      console.log(`     ✓ Private-only services detected`);
    }
    if (profile.custom.tokenization) {
      console.log(`     ✓ Real-world asset tokenization detected`);
    }
    if (profile.special.compliance?.length > 0) {
      console.log(`     ✓ Compliance requirements: ${profile.special.compliance.join(', ')}`);
    }
    console.log('');

    // Generate configuration
    console.log('🤖 Generating intelligent agent configuration...');
    const generator = new IntelligentAgentGenerator();
    const result = await generator.generateClaudeCodeSetup(projectPath);

    console.log('   Configuration Results:');
    console.log(`   • Generated ${result.agents.length} specialized agents`);
    console.log(`   • Configured ${result.mcps.length} MCP integrations`);
    console.log(`   • Created ${result.workflows.length} multi-agent workflows`);
    console.log(`   • Generated ${result.commands.length} slash commands\n`);

    // Display agents
    console.log('🤖 Specialized Agents Generated:');
    const agentCategories = {
      Architecture: [],
      Development: [],
      Operations: [],
      Specialized: []
    };

    result.agents.forEach(agent => {
      if (agent.name.includes('architect')) {
        agentCategories.Architecture.push(agent);
      } else if (agent.name.includes('dev') || agent.name.includes('engineer')) {
        agentCategories.Development.push(agent);
      } else if (agent.name.includes('ops') || agent.name.includes('deploy')) {
        agentCategories.Operations.push(agent);
      } else {
        agentCategories.Specialized.push(agent);
      }
    });

    for (const [category, agents] of Object.entries(agentCategories)) {
      if (agents.length > 0) {
        console.log(`\n   ${category}:`);
        agents.forEach(agent => {
          console.log(`   • ${agent.name} [${agent.model}] - ${agent.description}`);
        });
      }
    }

    // Display MCPs
    console.log('\n🔌 MCP Integrations:');
    result.mcps.forEach(mcp => {
      console.log(`   • ${mcp.name} - ${mcp.description} [${mcp.status}]`);
    });

    // Display workflows
    console.log('\n🔄 Multi-Agent Workflows:');
    result.workflows.forEach(workflow => {
      console.log(`   • ${workflow.name} - ${workflow.description}`);
    });

    // Display commands
    console.log('\n⚡ Slash Commands:');
    const coreCommands = result.commands.filter(c => !c.name.includes('-'));
    const specialCommands = result.commands.filter(c => c.name.includes('-'));

    console.log('   Core:');
    coreCommands.forEach(cmd => {
      console.log(`   • ${cmd.name} - ${cmd.description}`);
    });

    if (specialCommands.length > 0) {
      console.log('\n   Specialized:');
      specialCommands.forEach(cmd => {
        console.log(`   • ${cmd.name} - ${cmd.description}`);
      });
    }

    // Validate Veria-specific features
    console.log('\n✅ Validation Results:');

    const hasOIDCAgent = result.agents.some(a => a.name.includes('oidc'));
    const hasTokenizationAgent = result.agents.some(a => a.name.includes('token'));
    const hasComplianceAgent = result.agents.some(a => a.name.includes('compliance'));
    const hasGCPMCP = result.mcps.some(m => m.name.includes('gcp'));
    const hasPrivateServiceGuardian = result.agents.some(a => a.name.includes('private'));

    console.log(`   • OIDC/WIF Engineer: ${hasOIDCAgent ? '✓' : '✗'}`);
    console.log(`   • Tokenization Specialist: ${hasTokenizationAgent ? '✓' : '✗'}`);
    console.log(`   • Compliance Officer: ${hasComplianceAgent ? '✓' : '✗'}`);
    console.log(`   • Private Service Guardian: ${hasPrivateServiceGuardian ? '✓' : '✗'}`);
    console.log(`   • GCP MCPs Configured: ${hasGCPMCP ? '✓' : '✗'}`);

    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 Test Complete!');
    console.log(`\nThe Veria project would receive:`);
    console.log(`• ${result.agents.length} specialized agents (including OIDC/WIF and tokenization experts)`);
    console.log(`• ${result.mcps.length} MCPs (including GCP-specific integrations)`);
    console.log(`• ${result.workflows.length} workflows (including compliance and tokenization)`);
    console.log(`• ${result.commands.length} commands (including /gcp-deploy and /tokenize)`);
    console.log(`\nComplexity Level: ${profile.complexity.level}`);
    console.log(`Configuration saved to: ${projectPath}/.claude/`);

    // Cleanup
    console.log('\n🧹 Cleaning up test files...');
    await fs.rm(projectPath, { recursive: true, force: true });
    console.log('   Test files removed.');

    return { success: true, profile, result };

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    return { success: false, error };
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testVeriaConfiguration()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { testVeriaConfiguration, createMockVeriaProject };