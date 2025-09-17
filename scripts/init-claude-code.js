#!/usr/bin/env node

/**
 * One-Command Claude Code Initialization Script
 * Initialize intelligent Claude Code configuration for any project
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { IntelligentAgentGenerator } from '../src/agents/intelligent-agent-generator.js';
import { ProjectAnalyzer } from '../src/analysis/project-analyzer.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

/**
 * Main initialization function
 */
async function initializeClaudeCode(options = {}) {
  const projectPath = options.path || process.cwd();
  const forceRegenerate = options.force || false;
  const complexityOverride = options.complexity || 'auto';
  const verbose = options.verbose || false;

  console.log(`\n${colors.bright}${colors.cyan}🚀 Initializing Intelligent Claude Code Configuration${colors.reset}\n`);
  console.log(`${colors.dim}Version: DevAssist v3.0${colors.reset}`);
  console.log(`${colors.dim}Project: ${projectPath}${colors.reset}\n`);

  try {
    // Check if already configured
    if (!forceRegenerate && await isAlreadyConfigured(projectPath)) {
      console.log(`${colors.yellow}⚠️  Project already has Claude Code configuration${colors.reset}`);
      const answer = await promptUser('Do you want to regenerate? (y/n): ');
      if (answer.toLowerCase() !== 'y') {
        console.log(`${colors.dim}Exiting...${colors.reset}`);
        return;
      }
    }

    // Step 1: Analyze project
    console.log(`${colors.blue}📊 Analyzing project structure...${colors.reset}`);
    const startAnalysis = Date.now();

    const analyzer = new ProjectAnalyzer({ verbose });
    const profile = await analyzer.deepAnalyze(projectPath);

    // Override complexity if specified
    if (complexityOverride !== 'auto') {
      profile.complexity.level = complexityOverride;
      console.log(`${colors.dim}  Complexity override: ${complexityOverride}${colors.reset}`);
    }

    const analysisTime = ((Date.now() - startAnalysis) / 1000).toFixed(2);

    // Display analysis results
    displayAnalysisResults(profile, analysisTime);

    // Step 2: Generate agents
    console.log(`\n${colors.blue}🤖 Generating optimized agents...${colors.reset}`);
    const startGeneration = Date.now();

    const generator = new IntelligentAgentGenerator({ verbose });
    const result = await generator.generateClaudeCodeSetup(projectPath);

    const generationTime = ((Date.now() - startGeneration) / 1000).toFixed(2);

    // Display generation results
    displayGenerationResults(result, generationTime);

    // Step 3: Configure MCPs
    if (result.mcps && result.mcps.length > 0) {
      console.log(`\n${colors.blue}🔌 Configuring MCP integrations...${colors.reset}`);
      displayMCPConfiguration(result.mcps);
    }

    // Step 4: Create workflows
    if (result.workflows && result.workflows.length > 0) {
      console.log(`\n${colors.blue}🔄 Creating multi-agent workflows...${colors.reset}`);
      displayWorkflows(result.workflows);
    }

    // Step 5: Generate commands
    if (result.commands && result.commands.length > 0) {
      console.log(`\n${colors.blue}⚡ Generating slash commands...${colors.reset}`);
      displayCommands(result.commands);
    }

    // Step 6: Final report
    console.log(`\n${colors.bright}${colors.green}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}${colors.green}  ✅ Claude Code Configuration Complete!${colors.reset}`);
    console.log(`${colors.bright}${colors.green}═══════════════════════════════════════════════════════${colors.reset}\n`);

    displaySummary(result);

    // Optional: Install MCPs
    if (result.mcps && result.mcps.some(mcp => mcp.status === 'needs-installation')) {
      const answer = await promptUser('\nSome MCPs need installation. Install now? (y/n): ');
      if (answer.toLowerCase() === 'y') {
        await installMCPs(result.mcps, projectPath);
      }
    }

    // Save configuration report
    await saveConfigurationReport(result, projectPath);

    console.log(`\n${colors.cyan}📁 Configuration saved to: ${colors.bright}.claude/${colors.reset}`);
    console.log(`${colors.cyan}📚 Documentation available in: ${colors.bright}.claude/README.md${colors.reset}`);
    console.log(`${colors.cyan}🚀 Your intelligent agents are ready to use!${colors.reset}\n`);

    return result;

  } catch (error) {
    console.error(`\n${colors.red}❌ Error during initialization:${colors.reset}`);
    console.error(`${colors.red}${error.message}${colors.reset}`);
    if (verbose) {
      console.error(`${colors.dim}${error.stack}${colors.reset}`);
    }
    process.exit(1);
  }
}

/**
 * Check if project is already configured
 */
async function isAlreadyConfigured(projectPath) {
  try {
    const claudePath = path.join(projectPath, '.claude', 'config.json');
    await fs.access(claudePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Display analysis results
 */
function displayAnalysisResults(profile, time) {
  console.log(`${colors.dim}  Analysis completed in ${time}s${colors.reset}\n`);

  console.log(`  ${colors.bright}Project Profile:${colors.reset}`);
  console.log(`  ├─ Type: ${colors.cyan}${profile.type.join(', ')}${colors.reset}`);
  console.log(`  ├─ Languages: ${colors.cyan}${profile.stack.languages.join(', ')}${colors.reset}`);
  console.log(`  ├─ Frameworks: ${colors.cyan}${profile.stack.frameworks.join(', ')}${colors.reset}`);
  console.log(`  ├─ Architecture: ${colors.cyan}${profile.patterns.architecture}${colors.reset}`);
  console.log(`  └─ Complexity: ${getComplexityColor(profile.complexity.level)}${profile.complexity.level}${colors.reset} (Score: ${profile.complexity.score}/100)`);

  if (profile.stack.databases.length > 0) {
    console.log(`\n  ${colors.bright}Databases:${colors.reset} ${profile.stack.databases.join(', ')}`);
  }

  if (profile.stack.cloud) {
    console.log(`  ${colors.bright}Cloud:${colors.reset} ${profile.stack.cloud}`);
  }

  if (profile.special.compliance && profile.special.compliance.length > 0) {
    console.log(`  ${colors.bright}Compliance:${colors.reset} ${profile.special.compliance.join(', ')}`);
  }

  if (profile.custom.oidc_wif) {
    console.log(`  ${colors.bright}${colors.yellow}⚠️  Special: OIDC/WIF Authentication${colors.reset}`);
  }

  if (profile.custom.private_only) {
    console.log(`  ${colors.bright}${colors.yellow}⚠️  Special: Private-only services${colors.reset}`);
  }

  if (profile.custom.tokenization) {
    console.log(`  ${colors.bright}${colors.yellow}⚠️  Special: Real-world asset tokenization${colors.reset}`);
  }
}

/**
 * Get color for complexity level
 */
function getComplexityColor(level) {
  const colorMap = {
    'low': colors.green,
    'medium': colors.yellow,
    'high': colors.magenta,
    'enterprise': colors.red
  };
  return colorMap[level] || colors.white;
}

/**
 * Display generation results
 */
function displayGenerationResults(result, time) {
  console.log(`${colors.dim}  Generation completed in ${time}s${colors.reset}\n`);

  console.log(`  ${colors.bright}Generated ${result.agents.length} specialized agents:${colors.reset}`);

  // Group agents by category
  const categories = {
    Architecture: [],
    Development: [],
    Operations: [],
    Quality: [],
    Specialized: []
  };

  result.agents.forEach(agent => {
    if (agent.name.includes('architect')) {
      categories.Architecture.push(agent);
    } else if (agent.name.includes('dev') || agent.name.includes('engineer')) {
      categories.Development.push(agent);
    } else if (agent.name.includes('ops') || agent.name.includes('deploy')) {
      categories.Operations.push(agent);
    } else if (agent.name.includes('test') || agent.name.includes('review')) {
      categories.Quality.push(agent);
    } else {
      categories.Specialized.push(agent);
    }
  });

  for (const [category, agents] of Object.entries(categories)) {
    if (agents.length > 0) {
      console.log(`\n  ${colors.dim}${category}:${colors.reset}`);
      agents.forEach(agent => {
        const modelColor = agent.model === 'opus' ? colors.magenta :
                          agent.model === 'sonnet' ? colors.blue :
                          colors.green;
        console.log(`  • ${agent.name} ${colors.dim}[${modelColor}${agent.model}${colors.reset}${colors.dim}]${colors.reset}`);
      });
    }
  }
}

/**
 * Display MCP configuration
 */
function displayMCPConfiguration(mcps) {
  console.log(`  ${colors.bright}Configured ${mcps.length} MCP integrations:${colors.reset}`);

  mcps.forEach(mcp => {
    const statusIcon = mcp.status === 'configured' ? '✓' : '⚠';
    const statusColor = mcp.status === 'configured' ? colors.green : colors.yellow;
    console.log(`  ${statusColor}${statusIcon}${colors.reset} ${mcp.name} - ${colors.dim}${mcp.description}${colors.reset}`);
  });
}

/**
 * Display workflows
 */
function displayWorkflows(workflows) {
  console.log(`  ${colors.bright}Created ${workflows.length} multi-agent workflows:${colors.reset}`);

  workflows.forEach(workflow => {
    console.log(`  • ${workflow.name} - ${colors.dim}${workflow.description}${colors.reset}`);
  });
}

/**
 * Display commands
 */
function displayCommands(commands) {
  console.log(`  ${colors.bright}Generated ${commands.length} slash commands:${colors.reset}`);

  const coreCommands = commands.filter(c => !c.name.includes('-'));
  const specializedCommands = commands.filter(c => c.name.includes('-'));

  if (coreCommands.length > 0) {
    console.log(`\n  ${colors.dim}Core:${colors.reset}`);
    coreCommands.forEach(cmd => {
      console.log(`  • ${colors.cyan}${cmd.name}${colors.reset} - ${colors.dim}${cmd.description}${colors.reset}`);
    });
  }

  if (specializedCommands.length > 0) {
    console.log(`\n  ${colors.dim}Specialized:${colors.reset}`);
    specializedCommands.forEach(cmd => {
      console.log(`  • ${colors.cyan}${cmd.name}${colors.reset} - ${colors.dim}${cmd.description}${colors.reset}`);
    });
  }
}

/**
 * Display configuration summary
 */
function displaySummary(result) {
  const stats = {
    'Agents': result.agents.length,
    'MCPs': result.mcps.length,
    'Workflows': result.workflows.length,
    'Commands': result.commands.length
  };

  console.log(`${colors.bright}Configuration Summary:${colors.reset}`);
  console.log('┌─────────────────────────────────────────┐');

  for (const [key, value] of Object.entries(stats)) {
    const padding = ' '.repeat(15 - key.length);
    console.log(`│  ${key}:${padding}${colors.cyan}${value.toString().padStart(3)}${colors.reset}                     │`);
  }

  console.log('└─────────────────────────────────────────┘');
}

/**
 * Install MCPs that need installation
 */
async function installMCPs(mcps, projectPath) {
  console.log(`\n${colors.blue}📦 Installing MCP servers...${colors.reset}`);

  for (const mcp of mcps) {
    if (mcp.status === 'needs-installation' && !mcp.custom) {
      console.log(`  Installing ${mcp.name}...`);
      try {
        await execAsync(`npm install -g ${mcp.package}`, { cwd: projectPath });
        console.log(`  ${colors.green}✓${colors.reset} ${mcp.name} installed`);
      } catch (error) {
        console.log(`  ${colors.red}✗${colors.reset} Failed to install ${mcp.name}: ${error.message}`);
      }
    }
  }
}

/**
 * Save configuration report
 */
async function saveConfigurationReport(result, projectPath) {
  const reportPath = path.join(projectPath, '.claude', 'reports', 'initialization.json');
  await fs.mkdir(path.dirname(reportPath), { recursive: true });

  const report = {
    timestamp: new Date().toISOString(),
    version: '3.0',
    profile: result.profile,
    configuration: {
      agents: result.agents.length,
      mcps: result.mcps.length,
      workflows: result.workflows.length,
      commands: result.commands.length
    },
    agents: result.agents.map(a => ({
      name: a.name,
      model: a.model,
      description: a.description
    })),
    mcps: result.mcps.map(m => ({
      name: m.name,
      status: m.status,
      package: m.package
    })),
    workflows: result.workflows.map(w => ({
      name: w.name,
      description: w.description,
      trigger: w.trigger
    })),
    commands: result.commands.map(c => ({
      name: c.name,
      description: c.description
    }))
  };

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
}

/**
 * Simple prompt for user input
 */
async function promptUser(question) {
  process.stdout.write(question);

  return new Promise((resolve) => {
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });
}

/**
 * Parse command line arguments
 */
function parseArguments(args) {
  const options = {
    path: process.cwd(),
    force: false,
    complexity: 'auto',
    verbose: false,
    help: false
  };

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-p':
      case '--path':
        options.path = args[++i];
        break;

      case '-f':
      case '--force':
        options.force = true;
        break;

      case '-c':
      case '--complexity':
        options.complexity = args[++i];
        if (!['auto', 'low', 'medium', 'high', 'enterprise'].includes(options.complexity)) {
          console.error(`Invalid complexity level: ${options.complexity}`);
          process.exit(1);
        }
        break;

      case '-v':
      case '--verbose':
        options.verbose = true;
        break;

      case '-h':
      case '--help':
        options.help = true;
        break;

      default:
        if (!arg.startsWith('-')) {
          options.path = arg;
        } else {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  return options;
}

/**
 * Display help message
 */
function displayHelp() {
  console.log(`
${colors.bright}DevAssist v3.0 - Intelligent Claude Code Configuration${colors.reset}

${colors.bright}Usage:${colors.reset}
  init-claude-code [options] [path]

${colors.bright}Options:${colors.reset}
  -p, --path <path>         Project path (default: current directory)
  -f, --force               Force regeneration of existing configuration
  -c, --complexity <level>  Override complexity detection (auto|low|medium|high|enterprise)
  -v, --verbose             Show detailed output
  -h, --help                Show this help message

${colors.bright}Examples:${colors.reset}
  init-claude-code                    # Initialize current directory
  init-claude-code /path/to/project   # Initialize specific project
  init-claude-code -f                 # Force regenerate configuration
  init-claude-code -c enterprise      # Use enterprise complexity level

${colors.bright}Features:${colors.reset}
  • Deep project analysis and profiling
  • Intelligent agent generation (82+ types)
  • Automatic MCP discovery and configuration
  • Multi-agent workflow creation
  • Slash command generation
  • Continuous learning system
  • Project-specific customization

${colors.bright}Learn More:${colors.reset}
  Documentation: https://github.com/devassist/docs
  Report Issues: https://github.com/devassist/issues
`);
}

/**
 * Main execution when run directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArguments(process.argv);

  if (options.help) {
    displayHelp();
    process.exit(0);
  }

  // Handle interrupts gracefully
  process.on('SIGINT', () => {
    console.log(`\n${colors.yellow}Interrupted by user${colors.reset}`);
    process.exit(0);
  });

  // Run initialization
  initializeClaudeCode(options)
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    });
}

export { initializeClaudeCode };