/**
 * Deep Project Analyzer for DevAssist v3.0
 * Analyzes project structure, technology stack, and complexity
 */

import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ProjectAnalyzer {
  constructor(options = {}) {
    this.options = options;
    this.filePatterns = {
      javascript: ['.js', '.jsx', '.mjs', '.cjs'],
      typescript: ['.ts', '.tsx', '.d.ts'],
      python: ['.py', '.pyw', '.pyx'],
      go: ['.go'],
      rust: ['.rs'],
      java: ['.java'],
      csharp: ['.cs'],
      ruby: ['.rb'],
      php: ['.php'],
      swift: ['.swift'],
      kotlin: ['.kt', '.kts'],
      scala: ['.scala'],
      cpp: ['.cpp', '.cc', '.cxx', '.hpp', '.h'],
      c: ['.c', '.h']
    };
  }

  /**
   * Perform deep analysis of the project
   */
  async deepAnalyze(projectPath) {
    this.projectPath = projectPath || process.cwd();

    const profile = {
      projectPath: this.projectPath,
      name: await this.detectProjectName(),
      type: await this.detectProjectTypes(),
      stack: await this.analyzeStack(),
      patterns: await this.detectPatterns(),
      complexity: await this.assessComplexity(),
      special: await this.detectSpecialRequirements(),
      custom: await this.detectCustomRequirements(),
      vcs: await this.detectVCS(),
      structure: await this.analyzeStructure(),
      dependencies: await this.analyzeDependencies()
    };

    return profile;
  }

  /**
   * Detect project name from various sources
   */
  async detectProjectName() {
    try {
      // Try package.json
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      if (await this.fileExists(packageJsonPath)) {
        const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
        if (pkg.name) return pkg.name;
      }

      // Try go.mod
      const goModPath = path.join(this.projectPath, 'go.mod');
      if (await this.fileExists(goModPath)) {
        const content = await fs.readFile(goModPath, 'utf8');
        const match = content.match(/^module\s+(.+)$/m);
        if (match) return match[1];
      }

      // Try Cargo.toml
      const cargoPath = path.join(this.projectPath, 'Cargo.toml');
      if (await this.fileExists(cargoPath)) {
        const content = await fs.readFile(cargoPath, 'utf8');
        const match = content.match(/^name\s*=\s*"([^"]+)"/m);
        if (match) return match[1];
      }

      // Fall back to directory name
      return path.basename(this.projectPath);
    } catch (error) {
      return path.basename(this.projectPath);
    }
  }

  /**
   * Detect project types
   */
  async detectProjectTypes() {
    const types = [];

    // Check for API/Backend
    if (await this.hasFiles(['app.js', 'server.js', 'main.go', 'main.py', 'main.rs'])) {
      types.push('api');
    }

    // Check for Web Application
    if (await this.hasFiles(['index.html', 'public/index.html', 'src/index.html']) ||
        await this.hasDirectory('pages') ||
        await this.hasDirectory('app')) {
      types.push('web-app');
    }

    // Check for CLI
    if (await this.hasFiles(['cli.js', 'bin/', 'cmd/'])) {
      types.push('cli');
    }

    // Check for Library
    if (await this.hasFiles(['index.js', 'lib/', 'src/lib/']) &&
        !types.includes('api') && !types.includes('web-app')) {
      types.push('library');
    }

    // Check for Mobile
    if (await this.hasFiles(['android/', 'ios/', 'App.tsx', 'App.js'])) {
      types.push('mobile');
    }

    // Check for Microservices
    if (await this.hasFiles(['docker-compose.yml', 'docker-compose.yaml']) ||
        await this.hasMultipleServices()) {
      types.push('microservices');
    }

    // Check for Serverless
    if (await this.hasFiles(['serverless.yml', 'netlify.toml', 'vercel.json', 'functions/'])) {
      types.push('serverless');
    }

    // Check for Desktop
    if (await this.hasFiles(['electron.js', 'main.electron.js', 'src-tauri/'])) {
      types.push('desktop');
    }

    return types.length > 0 ? types : ['general'];
  }

  /**
   * Analyze technology stack
   */
  async analyzeStack() {
    return {
      languages: await this.detectLanguages(),
      frameworks: await this.detectFrameworks(),
      databases: await this.detectDatabases(),
      cloud: await this.detectCloudProviders(),
      tools: await this.detectDevTools(),
      testing: await this.detectTestFrameworks(),
      ci: await this.detectCICD()
    };
  }

  /**
   * Detect programming languages
   */
  async detectLanguages() {
    const languages = new Set();

    try {
      const { stdout } = await execAsync(
        `find ${this.projectPath} -type f -name "*.*" | head -1000 | xargs -I {} basename {} | sed 's/.*\\.//' | sort | uniq -c | sort -rn | head -20`,
        { maxBuffer: 1024 * 1024 }
      );

      const extensions = stdout.split('\n').map(line => line.trim().split(/\s+/)[1]).filter(Boolean);

      for (const [lang, exts] of Object.entries(this.filePatterns)) {
        if (extensions.some(ext => exts.includes(`.${ext}`))) {
          languages.add(lang);
        }
      }

      // Also check for specific files
      if (await this.fileExists(path.join(this.projectPath, 'package.json'))) {
        languages.add('javascript');
        if (await this.hasFiles(['tsconfig.json'])) {
          languages.add('typescript');
        }
      }

      if (await this.fileExists(path.join(this.projectPath, 'requirements.txt')) ||
          await this.fileExists(path.join(this.projectPath, 'setup.py')) ||
          await this.fileExists(path.join(this.projectPath, 'Pipfile'))) {
        languages.add('python');
      }

      if (await this.fileExists(path.join(this.projectPath, 'go.mod'))) {
        languages.add('go');
      }

      if (await this.fileExists(path.join(this.projectPath, 'Cargo.toml'))) {
        languages.add('rust');
      }

      if (await this.fileExists(path.join(this.projectPath, 'pom.xml')) ||
          await this.fileExists(path.join(this.projectPath, 'build.gradle'))) {
        languages.add('java');
      }

    } catch (error) {
      console.warn('Language detection via find failed, using fallback');
    }

    return Array.from(languages);
  }

  /**
   * Detect frameworks
   */
  async detectFrameworks() {
    const frameworks = new Set();

    // Node.js frameworks
    const packageJson = await this.readPackageJson();
    if (packageJson) {
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (deps.express) frameworks.add('express');
      if (deps.fastify) frameworks.add('fastify');
      if (deps.koa) frameworks.add('koa');
      if (deps.next) frameworks.add('nextjs');
      if (deps.react) frameworks.add('react');
      if (deps.vue) frameworks.add('vue');
      if (deps.angular) frameworks.add('angular');
      if (deps.svelte) frameworks.add('svelte');
      if (deps.gatsby) frameworks.add('gatsby');
      if (deps.nuxt) frameworks.add('nuxt');
      if (deps['react-native']) frameworks.add('react-native');
      if (deps.electron) frameworks.add('electron');
      if (deps.nestjs || deps['@nestjs/core']) frameworks.add('nestjs');
    }

    // Python frameworks
    const requirements = await this.readRequirements();
    if (requirements) {
      if (requirements.includes('django')) frameworks.add('django');
      if (requirements.includes('flask')) frameworks.add('flask');
      if (requirements.includes('fastapi')) frameworks.add('fastapi');
      if (requirements.includes('pyramid')) frameworks.add('pyramid');
      if (requirements.includes('tornado')) frameworks.add('tornado');
    }

    // Go frameworks
    const goMod = await this.readGoMod();
    if (goMod) {
      if (goMod.includes('gin-gonic/gin')) frameworks.add('gin');
      if (goMod.includes('labstack/echo')) frameworks.add('echo');
      if (goMod.includes('gofiber/fiber')) frameworks.add('fiber');
      if (goMod.includes('gorilla/mux')) frameworks.add('gorilla');
    }

    // Ruby frameworks
    if (await this.fileExists(path.join(this.projectPath, 'Gemfile'))) {
      const gemfile = await fs.readFile(path.join(this.projectPath, 'Gemfile'), 'utf8');
      if (gemfile.includes('rails')) frameworks.add('rails');
      if (gemfile.includes('sinatra')) frameworks.add('sinatra');
    }

    // PHP frameworks
    if (await this.fileExists(path.join(this.projectPath, 'composer.json'))) {
      const composer = JSON.parse(await fs.readFile(path.join(this.projectPath, 'composer.json'), 'utf8'));
      const deps = { ...composer.require, ...composer['require-dev'] };
      if (deps['laravel/framework']) frameworks.add('laravel');
      if (deps['symfony/framework-bundle']) frameworks.add('symfony');
    }

    // Mobile frameworks
    if (await this.hasDirectory('android')) frameworks.add('android');
    if (await this.hasDirectory('ios')) frameworks.add('ios');
    if (await this.fileExists(path.join(this.projectPath, 'pubspec.yaml'))) frameworks.add('flutter');

    return Array.from(frameworks);
  }

  /**
   * Detect databases
   */
  async detectDatabases() {
    const databases = new Set();

    // Check package.json
    const packageJson = await this.readPackageJson();
    if (packageJson) {
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      if (deps.pg || deps.postgres) databases.add('postgresql');
      if (deps.mysql || deps.mysql2) databases.add('mysql');
      if (deps.mongodb || deps.mongoose) databases.add('mongodb');
      if (deps.redis || deps.ioredis) databases.add('redis');
      if (deps.sqlite3 || deps['better-sqlite3']) databases.add('sqlite');
      if (deps.elasticsearch) databases.add('elasticsearch');
      if (deps.neo4j) databases.add('neo4j');
      if (deps.cassandra) databases.add('cassandra');
    }

    // Check docker-compose
    if (await this.fileExists(path.join(this.projectPath, 'docker-compose.yml'))) {
      const compose = await fs.readFile(path.join(this.projectPath, 'docker-compose.yml'), 'utf8');
      if (compose.includes('postgres')) databases.add('postgresql');
      if (compose.includes('mysql')) databases.add('mysql');
      if (compose.includes('mongo')) databases.add('mongodb');
      if (compose.includes('redis')) databases.add('redis');
      if (compose.includes('elastic')) databases.add('elasticsearch');
    }

    // Check for database config files
    if (await this.hasFiles(['prisma/schema.prisma'])) databases.add('prisma');
    if (await this.hasFiles(['knexfile.js'])) databases.add('knex');
    if (await this.hasFiles(['ormconfig.json', 'ormconfig.js'])) databases.add('typeorm');

    return Array.from(databases);
  }

  /**
   * Detect cloud providers
   */
  async detectCloudProviders() {
    // AWS
    if (await this.hasFiles(['serverless.yml', 'sam-template.yaml', '.aws/']) ||
        await this.hasFiles(['amplify.yml', 'amplify/'])) {
      return 'aws';
    }

    // Google Cloud
    if (await this.hasFiles(['app.yaml', 'cloudbuild.yaml', '.gcloudignore']) ||
        await this.fileContainsString('package.json', '@google-cloud/')) {
      return 'gcp';
    }

    // Azure
    if (await this.hasFiles(['azure-pipelines.yml', '.azure/']) ||
        await this.fileContainsString('package.json', '@azure/')) {
      return 'azure';
    }

    // Vercel
    if (await this.hasFiles(['vercel.json', '.vercel/'])) {
      return 'vercel';
    }

    // Netlify
    if (await this.hasFiles(['netlify.toml', '.netlify/'])) {
      return 'netlify';
    }

    // Heroku
    if (await this.hasFiles(['Procfile', 'app.json'])) {
      return 'heroku';
    }

    // DigitalOcean
    if (await this.hasFiles(['.do/', 'app.yaml'])) {
      return 'digitalocean';
    }

    return null;
  }

  /**
   * Detect development tools
   */
  async detectDevTools() {
    const tools = new Set();

    if (await this.hasFiles(['Dockerfile', '.dockerignore'])) tools.add('docker');
    if (await this.hasFiles(['docker-compose.yml', 'docker-compose.yaml'])) tools.add('docker-compose');
    if (await this.hasFiles(['kubernetes/', 'k8s/', 'helm/'])) tools.add('kubernetes');
    if (await this.hasFiles(['terraform/', '*.tf'])) tools.add('terraform');
    if (await this.hasFiles(['ansible/', 'playbook.yml'])) tools.add('ansible');
    if (await this.hasFiles(['Vagrantfile'])) tools.add('vagrant');
    if (await this.hasFiles(['.github/workflows/', '.gitlab-ci.yml', '.circleci/'])) tools.add('ci/cd');
    if (await this.hasFiles(['webpack.config.js'])) tools.add('webpack');
    if (await this.hasFiles(['vite.config.js', 'vite.config.ts'])) tools.add('vite');
    if (await this.hasFiles(['rollup.config.js'])) tools.add('rollup');
    if (await this.hasFiles(['gulpfile.js'])) tools.add('gulp');
    if (await this.hasFiles(['.eslintrc', '.eslintrc.js', '.eslintrc.json'])) tools.add('eslint');
    if (await this.hasFiles(['.prettierrc', 'prettier.config.js'])) tools.add('prettier');

    return Array.from(tools);
  }

  /**
   * Detect test frameworks
   */
  async detectTestFrameworks() {
    const frameworks = new Set();

    const packageJson = await this.readPackageJson();
    if (packageJson) {
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      if (deps.jest) frameworks.add('jest');
      if (deps.mocha) frameworks.add('mocha');
      if (deps.jasmine) frameworks.add('jasmine');
      if (deps.ava) frameworks.add('ava');
      if (deps.vitest) frameworks.add('vitest');
      if (deps.cypress) frameworks.add('cypress');
      if (deps.playwright || deps['@playwright/test']) frameworks.add('playwright');
      if (deps.puppeteer) frameworks.add('puppeteer');
      if (deps['@testing-library/react']) frameworks.add('testing-library');
    }

    const requirements = await this.readRequirements();
    if (requirements) {
      if (requirements.includes('pytest')) frameworks.add('pytest');
      if (requirements.includes('unittest')) frameworks.add('unittest');
      if (requirements.includes('nose')) frameworks.add('nose');
    }

    if (await this.hasFiles(['test/', 'tests/', 'spec/', '__tests__/'])) {
      frameworks.add('has-tests');
    }

    return Array.from(frameworks);
  }

  /**
   * Detect CI/CD systems
   */
  async detectCICD() {
    const systems = new Set();

    if (await this.hasDirectory('.github/workflows')) systems.add('github-actions');
    if (await this.hasFiles(['.gitlab-ci.yml'])) systems.add('gitlab-ci');
    if (await this.hasDirectory('.circleci')) systems.add('circleci');
    if (await this.hasFiles(['Jenkinsfile'])) systems.add('jenkins');
    if (await this.hasFiles(['.travis.yml'])) systems.add('travis-ci');
    if (await this.hasFiles(['bitbucket-pipelines.yml'])) systems.add('bitbucket-pipelines');
    if (await this.hasFiles(['azure-pipelines.yml'])) systems.add('azure-pipelines');
    if (await this.hasFiles(['cloudbuild.yaml', 'cloudbuild.yml'])) systems.add('google-cloud-build');
    if (await this.hasFiles(['buildspec.yml'])) systems.add('aws-codebuild');

    return Array.from(systems);
  }

  /**
   * Detect architecture patterns
   */
  async detectPatterns() {
    return {
      architecture: await this.detectArchitecture(),
      design: await this.detectDesignPatterns(),
      api: await this.detectAPIPatterns(),
      auth: await this.detectAuthMethods()
    };
  }

  /**
   * Detect architecture style
   */
  async detectArchitecture() {
    if (await this.hasFiles(['docker-compose.yml']) && await this.hasMultipleServices()) {
      return 'microservices';
    }

    if (await this.hasFiles(['serverless.yml', 'functions/', 'netlify/functions/'])) {
      return 'serverless';
    }

    if (await this.hasFiles(['src/events/', 'src/handlers/', 'events/', 'handlers/'])) {
      return 'event-driven';
    }

    if (await this.hasDirectory('layers')) {
      return 'layered';
    }

    if (await this.hasFiles(['src/domain/', 'src/infrastructure/', 'src/application/'])) {
      return 'hexagonal';
    }

    return 'monolithic';
  }

  /**
   * Detect design patterns
   */
  async detectDesignPatterns() {
    const patterns = new Set();

    if (await this.hasFiles(['src/models/', 'src/views/', 'src/controllers/']) ||
        await this.hasFiles(['models/', 'views/', 'controllers/'])) {
      patterns.add('mvc');
    }

    if (await this.hasFiles(['src/components/', 'components/']) &&
        await this.hasFiles(['src/stores/', 'src/state/', 'stores/'])) {
      patterns.add('component-based');
    }

    if (await this.hasFiles(['src/repositories/', 'repositories/'])) {
      patterns.add('repository');
    }

    if (await this.hasFiles(['src/services/', 'services/'])) {
      patterns.add('service-layer');
    }

    if (await this.hasFiles(['src/factories/', 'factories/'])) {
      patterns.add('factory');
    }

    if (await this.hasFiles(['src/observers/', 'src/events/', 'events/'])) {
      patterns.add('observer');
    }

    return Array.from(patterns);
  }

  /**
   * Detect API patterns
   */
  async detectAPIPatterns() {
    const patterns = new Set();

    if (await this.hasFiles(['graphql/', 'schema.graphql', 'src/graphql/'])) {
      patterns.add('graphql');
    }

    if (await this.hasFiles(['proto/', '*.proto', 'grpc/'])) {
      patterns.add('grpc');
    }

    if (await this.hasFiles(['swagger.json', 'swagger.yaml', 'openapi.json', 'openapi.yaml'])) {
      patterns.add('openapi');
    }

    if (await this.hasFiles(['websocket/', 'ws/', 'socket.io/']) ||
        await this.fileContainsString('package.json', 'socket.io')) {
      patterns.add('websocket');
    }

    if (await this.hasFiles(['api/', 'routes/', 'endpoints/'])) {
      patterns.add('rest');
    }

    return Array.from(patterns);
  }

  /**
   * Detect authentication methods
   */
  async detectAuthMethods() {
    const methods = new Set();

    const packageJson = await this.readPackageJson();
    if (packageJson) {
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      if (deps.passport) methods.add('passport');
      if (deps.jsonwebtoken) methods.add('jwt');
      if (deps['express-session']) methods.add('session');
      if (deps['@auth0/nextjs-auth0'] || deps['auth0-js']) methods.add('auth0');
      if (deps.firebase || deps['firebase-admin']) methods.add('firebase');
      if (deps['@okta/okta-auth-js']) methods.add('okta');
      if (deps.keycloak) methods.add('keycloak');
    }

    // Check for OAuth/OIDC
    if (await this.searchInFiles('oauth') || await this.searchInFiles('oidc')) {
      methods.add('oauth');
    }

    // Check for SAML
    if (await this.searchInFiles('saml')) {
      methods.add('saml');
    }

    return Array.from(methods);
  }

  /**
   * Assess project complexity
   */
  async assessComplexity() {
    const factors = {
      fileCount: await this.countFiles(),
      dependencies: await this.countDependencies(),
      services: await this.countServices(),
      integrations: await this.countIntegrations(),
      teamSize: await this.estimateTeamSize(),
      loc: await this.countLinesOfCode()
    };

    const score = this.calculateComplexityScore(factors);
    const level = this.determineComplexityLevel(score);

    return {
      score,
      level,
      factors
    };
  }

  /**
   * Calculate complexity score
   */
  calculateComplexityScore(factors) {
    let score = 0;

    // File count scoring (0-20 points)
    if (factors.fileCount < 50) score += 5;
    else if (factors.fileCount < 200) score += 10;
    else if (factors.fileCount < 1000) score += 15;
    else score += 20;

    // Dependencies scoring (0-20 points)
    if (factors.dependencies < 10) score += 5;
    else if (factors.dependencies < 30) score += 10;
    else if (factors.dependencies < 100) score += 15;
    else score += 20;

    // Services scoring (0-20 points)
    if (factors.services === 1) score += 5;
    else if (factors.services < 3) score += 10;
    else if (factors.services < 10) score += 15;
    else score += 20;

    // Integrations scoring (0-20 points)
    if (factors.integrations < 2) score += 5;
    else if (factors.integrations < 5) score += 10;
    else if (factors.integrations < 10) score += 15;
    else score += 20;

    // Lines of code scoring (0-20 points)
    if (factors.loc < 1000) score += 5;
    else if (factors.loc < 10000) score += 10;
    else if (factors.loc < 50000) score += 15;
    else score += 20;

    return Math.min(100, score);
  }

  /**
   * Determine complexity level
   */
  determineComplexityLevel(score) {
    if (score >= 80) return 'enterprise';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Detect special requirements
   */
  async detectSpecialRequirements() {
    return {
      compliance: await this.detectCompliance(),
      security: await this.detectSecurityNeeds(),
      performance: await this.detectPerformanceRequirements(),
      blockchain: await this.detectBlockchain(),
      ai: await this.detectAIComponents()
    };
  }

  /**
   * Detect compliance requirements
   */
  async detectCompliance() {
    const compliance = [];

    if (await this.searchInFiles('gdpr')) compliance.push('GDPR');
    if (await this.searchInFiles('hipaa')) compliance.push('HIPAA');
    if (await this.searchInFiles('sox')) compliance.push('SOX');
    if (await this.searchInFiles('pci-dss')) compliance.push('PCI-DSS');
    if (await this.searchInFiles('iso27001')) compliance.push('ISO27001');
    if (await this.searchInFiles('ccpa')) compliance.push('CCPA');

    return compliance;
  }

  /**
   * Detect security needs
   */
  async detectSecurityNeeds() {
    const security = [];

    if (await this.searchInFiles('zero-trust')) security.push('zero-trust');
    if (await this.searchInFiles('end-to-end encryption') ||
        await this.searchInFiles('e2e encryption')) security.push('e2e-encryption');
    if (await this.searchInFiles('mfa') ||
        await this.searchInFiles('multi-factor')) security.push('mfa');
    if (await this.searchInFiles('vault') ||
        await this.searchInFiles('secret-manager')) security.push('secrets-management');

    return security;
  }

  /**
   * Detect performance requirements
   */
  async detectPerformanceRequirements() {
    const performance = [];

    if (await this.searchInFiles('real-time') ||
        await this.searchInFiles('realtime')) performance.push('real-time');
    if (await this.searchInFiles('high-throughput')) performance.push('high-throughput');
    if (await this.searchInFiles('low-latency')) performance.push('low-latency');
    if (await this.searchInFiles('scalable')) performance.push('scalable');

    return performance;
  }

  /**
   * Detect blockchain components
   */
  async detectBlockchain() {
    if (await this.searchInFiles('smart contract') ||
        await this.searchInFiles('blockchain') ||
        await this.searchInFiles('web3') ||
        await this.fileContainsString('package.json', 'ethers') ||
        await this.fileContainsString('package.json', 'web3')) {
      return true;
    }
    return false;
  }

  /**
   * Detect AI components
   */
  async detectAIComponents() {
    const ai = [];

    const packageJson = await this.readPackageJson();
    if (packageJson) {
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      if (deps.openai) ai.push('llm');
      if (deps['@tensorflow/tfjs']) ai.push('tensorflow');
      if (deps.brain) ai.push('neural-network');
    }

    const requirements = await this.readRequirements();
    if (requirements) {
      if (requirements.includes('openai')) ai.push('llm');
      if (requirements.includes('tensorflow')) ai.push('tensorflow');
      if (requirements.includes('pytorch')) ai.push('pytorch');
      if (requirements.includes('scikit-learn')) ai.push('ml');
    }

    return ai.length > 0 ? ai : null;
  }

  /**
   * Detect custom requirements (project-specific like Veria)
   */
  async detectCustomRequirements() {
    const custom = {};

    // OIDC/WIF detection
    if (await this.searchInFiles('workload identity') ||
        await this.searchInFiles('OIDC') ||
        await this.searchInFiles('WIF')) {
      custom.oidc_wif = true;
    }

    // Private-only services
    if (await this.searchInFiles('private-only') ||
        await this.searchInFiles('internal-only') ||
        await this.searchInFiles('no-public-access')) {
      custom.private_only = true;
    }

    // Tokenization
    if (await this.searchInFiles('tokenization') ||
        await this.searchInFiles('real-world assets') ||
        await this.searchInFiles('RWA')) {
      custom.tokenization = true;
    }

    // GCP specific
    if (await this.fileExists(path.join(this.projectPath, 'app.yaml')) ||
        await this.fileExists(path.join(this.projectPath, 'cloudbuild.yaml'))) {
      custom.gcp_project = await this.detectGCPProject();
      custom.region = await this.detectGCPRegion();
    }

    // Deployment strategy
    custom.deployment = await this.detectDeploymentStrategy();

    return custom;
  }

  /**
   * Detect version control system
   */
  async detectVCS() {
    if (await this.hasDirectory('.git')) return 'git';
    if (await this.hasDirectory('.svn')) return 'svn';
    if (await this.hasDirectory('.hg')) return 'mercurial';
    return null;
  }

  /**
   * Analyze project structure
   */
  async analyzeStructure() {
    const structure = {
      hasMonorepo: await this.hasFiles(['lerna.json', 'rush.json', 'nx.json', 'pnpm-workspace.yaml']),
      hasWorkspaces: false,
      mainDirs: [],
      entryPoints: []
    };

    // Check for workspaces
    const packageJson = await this.readPackageJson();
    if (packageJson && packageJson.workspaces) {
      structure.hasWorkspaces = true;
    }

    // Identify main directories
    const dirs = ['src', 'lib', 'app', 'packages', 'services', 'apps'];
    for (const dir of dirs) {
      if (await this.hasDirectory(dir)) {
        structure.mainDirs.push(dir);
      }
    }

    // Find entry points
    const entryFiles = ['index.js', 'index.ts', 'main.js', 'main.ts', 'app.js', 'app.ts', 'server.js', 'server.ts'];
    for (const file of entryFiles) {
      if (await this.fileExists(path.join(this.projectPath, file))) {
        structure.entryPoints.push(file);
      }
      if (await this.fileExists(path.join(this.projectPath, 'src', file))) {
        structure.entryPoints.push(`src/${file}`);
      }
    }

    return structure;
  }

  /**
   * Analyze dependencies
   */
  async analyzeDependencies() {
    const deps = {
      production: {},
      development: {},
      peer: {},
      total: 0
    };

    const packageJson = await this.readPackageJson();
    if (packageJson) {
      deps.production = packageJson.dependencies || {};
      deps.development = packageJson.devDependencies || {};
      deps.peer = packageJson.peerDependencies || {};
      deps.total = Object.keys(deps.production).length +
                   Object.keys(deps.development).length;
    }

    return deps;
  }

  // Helper methods

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async hasFiles(patterns) {
    for (const pattern of patterns) {
      const fullPath = path.join(this.projectPath, pattern);
      if (pattern.includes('*')) {
        try {
          const dir = path.dirname(fullPath);
          const files = await fs.readdir(dir);
          const regex = new RegExp(pattern.replace('*', '.*'));
          if (files.some(file => regex.test(file))) {
            return true;
          }
        } catch {
          continue;
        }
      } else {
        if (await this.fileExists(fullPath)) {
          return true;
        }
      }
    }
    return false;
  }

  async hasDirectory(dir) {
    try {
      const stats = await fs.stat(path.join(this.projectPath, dir));
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  async hasMultipleServices() {
    const serviceDirs = ['services', 'microservices', 'apps'];
    for (const dir of serviceDirs) {
      if (await this.hasDirectory(dir)) {
        try {
          const files = await fs.readdir(path.join(this.projectPath, dir));
          const subdirs = [];
          for (const file of files) {
            const stats = await fs.stat(path.join(this.projectPath, dir, file));
            if (stats.isDirectory()) subdirs.push(file);
          }
          if (subdirs.length > 1) return true;
        } catch {
          continue;
        }
      }
    }
    return false;
  }

  async readPackageJson() {
    try {
      const content = await fs.readFile(path.join(this.projectPath, 'package.json'), 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async readRequirements() {
    try {
      return await fs.readFile(path.join(this.projectPath, 'requirements.txt'), 'utf8');
    } catch {
      return null;
    }
  }

  async readGoMod() {
    try {
      return await fs.readFile(path.join(this.projectPath, 'go.mod'), 'utf8');
    } catch {
      return null;
    }
  }

  async fileContainsString(file, searchString) {
    try {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
      return content.includes(searchString);
    } catch {
      return false;
    }
  }

  async searchInFiles(searchTerm) {
    try {
      const { stdout } = await execAsync(
        `grep -r -i "${searchTerm}" ${this.projectPath} --include="*.{js,ts,py,go,rs,java,cs,rb,php}" 2>/dev/null | head -1`,
        { maxBuffer: 1024 * 1024 }
      );
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  async countFiles() {
    try {
      const { stdout } = await execAsync(
        `find ${this.projectPath} -type f -name "*.*" | wc -l`,
        { maxBuffer: 1024 * 1024 }
      );
      return parseInt(stdout.trim()) || 0;
    } catch {
      return 0;
    }
  }

  async countDependencies() {
    const deps = await this.analyzeDependencies();
    return deps.total;
  }

  async countServices() {
    if (await this.hasMultipleServices()) {
      try {
        const serviceDirs = ['services', 'microservices', 'apps'];
        for (const dir of serviceDirs) {
          if (await this.hasDirectory(dir)) {
            const files = await fs.readdir(path.join(this.projectPath, dir));
            const subdirs = files.filter(async (file) => {
              const stats = await fs.stat(path.join(this.projectPath, dir, file));
              return stats.isDirectory();
            });
            return subdirs.length;
          }
        }
      } catch {
        return 1;
      }
    }
    return 1;
  }

  async countIntegrations() {
    let count = 0;

    // Count databases
    const databases = await this.detectDatabases();
    count += databases.length;

    // Count external services
    const packageJson = await this.readPackageJson();
    if (packageJson) {
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      const integrations = ['stripe', 'twilio', 'sendgrid', 'mailgun', 'aws-sdk', '@google-cloud', '@azure'];
      for (const integration of integrations) {
        if (Object.keys(deps).some(dep => dep.includes(integration))) {
          count++;
        }
      }
    }

    return count;
  }

  async estimateTeamSize() {
    try {
      const { stdout } = await execAsync(
        `cd ${this.projectPath} && git shortlog -sn 2>/dev/null | wc -l`,
        { maxBuffer: 1024 * 1024 }
      );
      return parseInt(stdout.trim()) || 1;
    } catch {
      return 1;
    }
  }

  async countLinesOfCode() {
    try {
      const { stdout } = await execAsync(
        `find ${this.projectPath} -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.java" \\) -exec wc -l {} + | tail -1 | awk '{print $1}'`,
        { maxBuffer: 1024 * 1024 }
      );
      return parseInt(stdout.trim()) || 0;
    } catch {
      return 0;
    }
  }

  async detectGCPProject() {
    // Try to find GCP project ID in various files
    const files = ['app.yaml', 'cloudbuild.yaml', '.gcloudignore', 'terraform.tfvars'];
    for (const file of files) {
      if (await this.fileExists(path.join(this.projectPath, file))) {
        const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
        const match = content.match(/project[_-]?id[:\s]+["']?([a-z0-9-]+)["']?/i);
        if (match) return match[1];
      }
    }
    return null;
  }

  async detectGCPRegion() {
    const files = ['app.yaml', 'cloudbuild.yaml', 'terraform.tfvars'];
    for (const file of files) {
      if (await this.fileExists(path.join(this.projectPath, file))) {
        const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
        const match = content.match(/region[:\s]+["']?([a-z0-9-]+)["']?/i);
        if (match) return match[1];
      }
    }
    return 'us-central1';
  }

  async detectDeploymentStrategy() {
    if (await this.hasFiles(['kubernetes/', 'k8s/', 'helm/'])) {
      return 'kubernetes';
    }
    if (await this.hasFiles(['docker-compose.yml', 'docker-compose.yaml'])) {
      return 'docker-compose';
    }
    if (await this.hasFiles(['serverless.yml'])) {
      return 'serverless';
    }
    if (await this.hasFiles(['Dockerfile'])) {
      return 'container';
    }
    return 'traditional';
  }
}

export default ProjectAnalyzer;