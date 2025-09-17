/**
 * Intelligent Agent Generator for DevAssist v3.0
 * Main orchestrator for analyzing projects and generating optimized Claude Code configurations
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProjectAnalyzer } from '../analysis/project-analyzer.js';
import { AgentTemplateEngine } from './agent-template-engine.js';
import { AgentNetworkBuilder } from './agent-network-builder.js';
import { ClaudeConfigGenerator } from '../claude/claude-config-generator.js';
import { MCPAutoConfigurator } from '../mcp/mcp-auto-configurator.js';
import { WorkflowOrchestrator } from '../claude/workflow-orchestrator.js';
import { ContinuousLearner } from '../learning/pattern-scanner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class IntelligentAgentGenerator {
  constructor(options = {}) {
    this.analyzer = new ProjectAnalyzer(options);
    this.templateEngine = new AgentTemplateEngine();
    this.networkBuilder = new AgentNetworkBuilder();
    this.claudeGenerator = new ClaudeConfigGenerator();
    this.mcpConfigurator = new MCPAutoConfigurator();
    this.workflowOrchestrator = new WorkflowOrchestrator();
    this.learner = new ContinuousLearner();
    this.templatesPath = path.join(__dirname, '../../templates');
  }

  /**
   * Generate complete Claude Code setup for a project
   */
  async generateClaudeCodeSetup(projectPath) {
    console.log('🚀 Starting Intelligent Claude Code Configuration...\n');

    try {
      // 1. Deep project analysis
      console.log('📊 Analyzing project structure...');
      const profile = await this.analyzer.deepAnalyze(projectPath);

      // 2. Create .claude directory structure
      await this.createClaudeStructure(projectPath);

      // 3. Generate optimized agents based on complexity
      console.log('🤖 Generating optimized agents...');
      const agents = await this.generateAgentsForComplexity(profile);

      // 4. Create project-specific claude.md
      console.log('📝 Creating claude.md configuration...');
      await this.claudeGenerator.generateClaudeMD(projectPath, profile, agents);

      // 5. Configure and install MCPs
      console.log('🔌 Configuring MCP integrations...');
      const mcps = await this.mcpConfigurator.configureMCPs(profile);

      // 6. Generate slash commands
      console.log('⚡ Generating slash commands...');
      const commands = await this.createCommands(profile);

      // 7. Build multi-agent workflows
      console.log('🔄 Building multi-agent workflows...');
      const workflows = await this.workflowOrchestrator.createWorkflows(profile, agents);

      // 8. Set up continuous learning
      await this.initializeLearning(profile);

      // 9. Generate comprehensive report
      const report = this.generateReport(profile, agents, mcps, commands, workflows);

      return {
        profile,
        agents,
        mcps,
        commands,
        workflows,
        report,
        status: 'success',
        message: 'Claude Code configuration complete!'
      };
    } catch (error) {
      console.error('❌ Error generating configuration:', error);
      throw error;
    }
  }

  /**
   * Generate agents based on project complexity
   */
  async generateAgentsForComplexity(profile) {
    const strategies = {
      enterprise: [
        // Full suite - 15-20 specialized agents
        'backend-architect', 'frontend-architect', 'cloud-architect',
        'database-architect', 'api-designer', 'security-architect',
        'devops-orchestrator', 'test-strategist', 'performance-engineer',
        'incident-commander', 'compliance-officer', 'ml-engineer',
        'data-engineer', 'release-manager', 'monitoring-specialist',
        'code-quality-guardian', 'documentation-specialist', 'ux-architect'
      ],
      high: [
        // Advanced suite - 10-12 agents
        'backend-engineer', 'frontend-engineer', 'devops-engineer',
        'database-admin', 'security-auditor', 'test-automator',
        'api-developer', 'cloud-engineer', 'code-reviewer',
        'performance-optimizer', 'ci-cd-specialist'
      ],
      medium: [
        // Standard suite - 5-7 agents
        'full-stack-developer', 'devops-engineer', 'test-engineer',
        'database-manager', 'code-reviewer', 'api-specialist'
      ],
      low: [
        // Minimal suite - 3-4 agents
        'developer', 'devops-helper', 'tester', 'code-reviewer'
      ]
    };

    const selectedStrategy = strategies[profile.complexity.level] || strategies.medium;
    const agents = [];

    // Generate base agents
    for (const agentType of selectedStrategy) {
      const template = await this.templateEngine.loadTemplate(agentType);
      const customized = await this.templateEngine.customizeTemplate(template, profile);
      const agent = await this.createAgent(customized, profile);
      agents.push(agent);
    }

    // Add project-specific agents
    agents.push(...await this.addSpecializedAgents(profile));

    return agents;
  }

  /**
   * Add specialized agents based on project requirements
   */
  async addSpecializedAgents(profile) {
    const specializedAgents = [];

    // Blockchain specialist
    if (profile.special.blockchain || profile.custom.tokenization) {
      specializedAgents.push(await this.createSpecialAgent('blockchain-developer', profile));
      if (profile.custom.tokenization) {
        specializedAgents.push(await this.createSpecialAgent('tokenization-specialist', profile));
      }
    }

    // Compliance officer
    if (profile.special.compliance) {
      specializedAgents.push(await this.createSpecialAgent('compliance-officer', profile));
    }

    // OIDC/WIF specialist (for Veria-like projects)
    if (profile.custom.oidc_wif) {
      specializedAgents.push(await this.createSpecialAgent('oidc-wif-engineer', profile));
    }

    // Private service guardian (for private-only requirements)
    if (profile.custom.private_only) {
      specializedAgents.push(await this.createSpecialAgent('private-service-guardian', profile));
    }

    // AI/ML specialists
    if (profile.special.ai) {
      specializedAgents.push(await this.createSpecialAgent('ml-engineer', profile));
      if (profile.special.ai.includes('llm')) {
        specializedAgents.push(await this.createSpecialAgent('llm-integration-specialist', profile));
      }
    }

    // Real-time systems specialist
    if (profile.special.performance?.includes('real-time')) {
      specializedAgents.push(await this.createSpecialAgent('real-time-systems-engineer', profile));
    }

    // Mobile specialists
    if (profile.type.includes('mobile')) {
      if (profile.stack.frameworks.includes('react-native')) {
        specializedAgents.push(await this.createSpecialAgent('react-native-developer', profile));
      }
      if (profile.stack.frameworks.includes('flutter')) {
        specializedAgents.push(await this.createSpecialAgent('flutter-developer', profile));
      }
    }

    return specializedAgents;
  }

  /**
   * Create a single agent with customization
   */
  async createAgent(template, profile) {
    const agentContent = await this.templateEngine.generateAgent(template, profile);
    const agentPath = path.join(profile.projectPath, '.claude', 'agents', `${template.name}.md`);

    await fs.mkdir(path.dirname(agentPath), { recursive: true });
    await fs.writeFile(agentPath, agentContent, 'utf8');

    return {
      name: template.name,
      path: agentPath,
      description: template.description,
      model: template.model || this.selectModel(profile.complexity.level),
      tools: template.tools,
      activation: template.activation
    };
  }

  /**
   * Create a specialized agent for specific requirements
   */
  async createSpecialAgent(type, profile) {
    const template = await this.templateEngine.loadSpecialTemplate(type, profile);
    return this.createAgent(template, profile);
  }

  /**
   * Create .claude directory structure
   */
  async createClaudeStructure(projectPath) {
    const claudePath = path.join(projectPath, '.claude');
    const directories = [
      'agents',
      'commands',
      'workflows',
      'mcps',
      'templates',
      'learning',
      'reports'
    ];

    for (const dir of directories) {
      await fs.mkdir(path.join(claudePath, dir), { recursive: true });
    }

    // Create initial configuration
    const config = {
      version: '3.0',
      generated: new Date().toISOString(),
      generator: 'DevAssist v3.0',
      features: {
        intelligentAgents: true,
        continuousLearning: true,
        mcpAutoConfiguration: true,
        multiAgentWorkflows: true
      }
    };

    await fs.writeFile(
      path.join(claudePath, 'config.json'),
      JSON.stringify(config, null, 2),
      'utf8'
    );
  }

  /**
   * Create slash commands for the project
   */
  async createCommands(profile) {
    const commands = [];

    // Core commands
    commands.push({
      name: '/analyze',
      description: 'Analyze codebase and generate insights',
      handler: 'analyze-codebase'
    });

    commands.push({
      name: '/deploy',
      description: 'Deploy to configured environment',
      handler: 'deployment-workflow'
    });

    commands.push({
      name: '/test',
      description: 'Run comprehensive test suite',
      handler: 'test-orchestration'
    });

    // Project-specific commands
    if (profile.stack.cloud === 'gcp') {
      commands.push({
        name: '/gcp-deploy',
        description: 'Deploy to Google Cloud Platform',
        handler: 'gcp-deployment'
      });
    }

    if (profile.special.compliance) {
      commands.push({
        name: '/compliance-check',
        description: 'Run compliance verification',
        handler: 'compliance-verification'
      });
    }

    if (profile.custom.tokenization) {
      commands.push({
        name: '/tokenize',
        description: 'Tokenize real-world assets',
        handler: 'tokenization-workflow'
      });
    }

    return commands;
  }

  /**
   * Initialize continuous learning system
   */
  async initializeLearning(profile) {
    await this.learner.initialize(profile);

    // Schedule periodic updates
    const learningConfig = {
      autoUpdate: true,
      scanInterval: 'weekly',
      sources: [
        'github-trending',
        'tech-blogs',
        'mcp-registry',
        'framework-updates'
      ],
      projectProfile: profile
    };

    const configPath = path.join(profile.projectPath, '.claude', 'learning', 'config.json');
    await fs.writeFile(configPath, JSON.stringify(learningConfig, null, 2), 'utf8');
  }

  /**
   * Select appropriate model based on complexity
   */
  selectModel(complexityLevel) {
    const modelMap = {
      enterprise: 'opus',
      high: 'opus',
      medium: 'sonnet',
      low: 'haiku'
    };
    return modelMap[complexityLevel] || 'sonnet';
  }

  /**
   * Generate comprehensive report
   */
  generateReport(profile, agents, mcps, commands, workflows) {
    const report = [];

    report.push('═══════════════════════════════════════════════════════');
    report.push('  INTELLIGENT CLAUDE CODE CONFIGURATION REPORT');
    report.push('═══════════════════════════════════════════════════════\n');

    report.push(`Project: ${profile.name}`);
    report.push(`Type: ${profile.type.join(', ')}`);
    report.push(`Complexity: ${profile.complexity.level} (Score: ${profile.complexity.score}/100)\n`);

    report.push('📊 Technology Stack:');
    report.push(`  Languages: ${profile.stack.languages.join(', ')}`);
    report.push(`  Frameworks: ${profile.stack.frameworks.join(', ')}`);
    report.push(`  Databases: ${profile.stack.databases.join(', ')}`);
    report.push(`  Cloud: ${profile.stack.cloud}`);
    report.push(`  Tools: ${profile.stack.tools.join(', ')}\n`);

    report.push(`🤖 Generated Agents (${agents.length}):`);
    agents.forEach(agent => {
      report.push(`  • ${agent.name} [${agent.model}] - ${agent.description}`);
    });
    report.push('');

    report.push(`🔌 Configured MCPs (${mcps.length}):`);
    mcps.forEach(mcp => {
      report.push(`  • ${mcp.name} - ${mcp.description}`);
    });
    report.push('');

    report.push(`⚡ Slash Commands (${commands.length}):`);
    commands.forEach(cmd => {
      report.push(`  • ${cmd.name} - ${cmd.description}`);
    });
    report.push('');

    report.push(`🔄 Multi-Agent Workflows (${workflows.length}):`);
    workflows.forEach(workflow => {
      report.push(`  • ${workflow.name} - ${workflow.description}`);
    });
    report.push('');

    if (profile.special.compliance || profile.special.security) {
      report.push('🔒 Security & Compliance:');
      if (profile.special.compliance) {
        report.push(`  • Compliance: ${profile.special.compliance.join(', ')}`);
      }
      if (profile.special.security) {
        report.push(`  • Security: ${profile.special.security.join(', ')}`);
      }
      report.push('');
    }

    report.push('✅ Configuration Complete!');
    report.push('📁 Configuration saved to .claude/');
    report.push('🚀 Your intelligent agents are ready!');

    return report.join('\n');
  }

  /**
   * Recommend agents without generating
   */
  async recommendAgents(profile) {
    const recommendations = {
      required: [],
      recommended: [],
      optional: []
    };

    // Always required
    recommendations.required.push('developer', 'code-reviewer', 'test-engineer');

    // Based on stack
    if (profile.stack.databases.length > 0) {
      recommendations.recommended.push('database-architect');
    }

    if (profile.stack.cloud) {
      recommendations.recommended.push('cloud-engineer');
      if (profile.complexity.level === 'enterprise') {
        recommendations.required.push('cloud-architect');
      }
    }

    // Optional based on features
    if (profile.special.ai) {
      recommendations.optional.push('ml-engineer');
    }

    if (profile.special.blockchain) {
      recommendations.optional.push('blockchain-developer');
    }

    return recommendations;
  }
}

export default IntelligentAgentGenerator;