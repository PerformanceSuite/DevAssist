/**
 * Agent Template Engine for DevAssist v3.0
 * Manages and customizes agent templates based on project requirements
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class AgentTemplateEngine {
  constructor() {
    this.templatesPath = path.join(__dirname, '../../templates/claude-agents');
    this.templates = new Map();
    this.loadedTemplates = false;
  }

  /**
   * Initialize and load all templates
   */
  async initialize() {
    if (this.loadedTemplates) return;

    await this.createTemplateRegistry();
    await this.loadAllTemplates();
    this.loadedTemplates = true;
  }

  /**
   * Create comprehensive template registry
   */
  async createTemplateRegistry() {
    const registry = {
      architecture: [
        'backend-architect',
        'frontend-architect',
        'cloud-architect',
        'database-architect',
        'api-designer',
        'security-architect',
        'microservices-architect',
        'solution-architect'
      ],
      development: [
        'typescript-developer',
        'javascript-developer',
        'python-developer',
        'go-developer',
        'rust-developer',
        'java-developer',
        'csharp-developer',
        'ruby-developer',
        'php-developer',
        'swift-developer',
        'kotlin-developer',
        'scala-developer',
        'cpp-developer',
        'full-stack-developer',
        'backend-engineer',
        'frontend-engineer',
        'mobile-developer',
        'game-developer'
      ],
      operations: [
        'devops-engineer',
        'devops-orchestrator',
        'sre-engineer',
        'platform-engineer',
        'infrastructure-engineer',
        'release-manager',
        'deployment-specialist',
        'monitoring-specialist',
        'incident-commander',
        'chaos-engineer'
      ],
      quality: [
        'test-engineer',
        'test-strategist',
        'test-automator',
        'qa-engineer',
        'performance-engineer',
        'performance-optimizer',
        'security-auditor',
        'code-reviewer',
        'code-quality-guardian',
        'accessibility-specialist'
      ],
      data: [
        'data-engineer',
        'data-scientist',
        'ml-engineer',
        'ai-specialist',
        'analytics-engineer',
        'etl-developer',
        'data-architect',
        'database-admin',
        'database-manager'
      ],
      specialized: [
        'blockchain-developer',
        'smart-contract-developer',
        'tokenization-specialist',
        'compliance-officer',
        'payment-specialist',
        'fintech-engineer',
        'healthcare-specialist',
        'iot-developer',
        'embedded-systems-engineer',
        'real-time-systems-engineer',
        'game-engine-developer',
        'ar-vr-developer'
      ],
      cloud: [
        'aws-specialist',
        'gcp-specialist',
        'azure-specialist',
        'cloud-engineer',
        'cloud-security-specialist',
        'kubernetes-engineer',
        'serverless-architect'
      ],
      integration: [
        'api-specialist',
        'api-developer',
        'graphql-specialist',
        'integration-engineer',
        'middleware-developer',
        'webhook-specialist',
        'event-driven-architect'
      ],
      ui_ux: [
        'ux-architect',
        'ui-developer',
        'design-system-engineer',
        'frontend-performance-specialist',
        'react-specialist',
        'vue-specialist',
        'angular-specialist'
      ],
      mobile: [
        'ios-developer',
        'android-developer',
        'react-native-developer',
        'flutter-developer',
        'mobile-architect',
        'mobile-security-specialist'
      ],
      documentation: [
        'documentation-specialist',
        'technical-writer',
        'api-documentation-specialist'
      ],
      project_specific: [
        'oidc-wif-engineer',
        'private-service-guardian',
        'gcp-cloud-run-specialist',
        'llm-integration-specialist',
        'ci-cd-specialist',
        'gitops-engineer'
      ]
    };

    const registryPath = path.join(__dirname, '../../templates/registry.json');
    await fs.mkdir(path.dirname(registryPath), { recursive: true });
    await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf8');

    return registry;
  }

  /**
   * Load a template by type
   */
  async loadTemplate(agentType) {
    await this.initialize();

    // Check cache
    if (this.templates.has(agentType)) {
      return this.templates.get(agentType);
    }

    // Generate template if not exists
    const template = await this.generateTemplate(agentType);
    this.templates.set(agentType, template);

    return template;
  }

  /**
   * Load a specialized template for specific requirements
   */
  async loadSpecialTemplate(type, profile) {
    const baseTemplate = await this.loadTemplate(type);

    // Enhance with project-specific context
    const enhancedTemplate = {
      ...baseTemplate,
      projectContext: {
        name: profile.name,
        type: profile.type,
        stack: profile.stack,
        patterns: profile.patterns,
        special: profile.special,
        custom: profile.custom
      }
    };

    return enhancedTemplate;
  }

  /**
   * Generate a template for an agent type
   */
  async generateTemplate(agentType) {
    const templates = {
      'backend-architect': this.backendArchitectTemplate(),
      'frontend-architect': this.frontendArchitectTemplate(),
      'cloud-architect': this.cloudArchitectTemplate(),
      'database-architect': this.databaseArchitectTemplate(),
      'api-designer': this.apiDesignerTemplate(),
      'security-architect': this.securityArchitectTemplate(),
      'devops-orchestrator': this.devopsOrchestratorTemplate(),
      'test-strategist': this.testStrategistTemplate(),
      'performance-engineer': this.performanceEngineerTemplate(),
      'ml-engineer': this.mlEngineerTemplate(),
      'blockchain-developer': this.blockchainDeveloperTemplate(),
      'compliance-officer': this.complianceOfficerTemplate(),
      'oidc-wif-engineer': this.oidcWifEngineerTemplate(),
      'tokenization-specialist': this.tokenizationSpecialistTemplate(),
      'private-service-guardian': this.privateServiceGuardianTemplate(),
      'gcp-cloud-run-specialist': this.gcpCloudRunSpecialistTemplate(),
      'full-stack-developer': this.fullStackDeveloperTemplate(),
      'developer': this.developerTemplate(),
      'code-reviewer': this.codeReviewerTemplate()
    };

    // Return specific template or generate generic one
    return templates[agentType] || this.genericTemplate(agentType);
  }

  /**
   * Customize a template based on project profile
   */
  async customizeTemplate(template, profile) {
    const customized = { ...template };

    // Replace placeholders
    customized.name = template.name || 'agent';
    customized.description = this.interpolate(template.description, profile);
    customized.model = this.selectModelForComplexity(profile.complexity.level, template);
    customized.tools = this.selectToolsForProfile(profile, template.tools);
    customized.activation = template.activation || 'manual';
    customized.content = this.generateAgentContent(template, profile);

    return customized;
  }

  /**
   * Generate agent markdown content
   */
  async generateAgent(template, profile) {
    const content = [];

    // Frontmatter
    content.push('---');
    content.push(`name: ${template.name}`);
    content.push(`description: ${template.description}`);
    content.push(`model: ${template.model}`);
    content.push(`tools: ${JSON.stringify(template.tools || [])}`);
    content.push(`activation: ${template.activation || 'manual'}`);
    content.push('---\n');

    // Role definition
    content.push(`You are a ${template.name} for ${profile.name}.`);
    content.push('');

    // Core expertise
    content.push('## Core Expertise');
    if (template.expertise) {
      template.expertise.forEach(item => {
        content.push(`- ${item}`);
      });
    }
    content.push('');

    // Project context
    content.push('## Project Context');
    content.push(`- **Technology Stack**: ${profile.stack.languages.join(', ')}`);
    content.push(`- **Frameworks**: ${profile.stack.frameworks.join(', ')}`);
    content.push(`- **Architecture**: ${profile.patterns.architecture}`);
    content.push(`- **Deployment**: ${profile.custom.deployment || 'standard'}`);

    if (profile.special.compliance && profile.special.compliance.length > 0) {
      content.push(`- **Compliance**: ${profile.special.compliance.join(', ')}`);
    }

    if (profile.custom.oidc_wif) {
      content.push('- **Authentication**: OIDC/Workload Identity Federation');
    }

    if (profile.custom.private_only) {
      content.push('- **Access**: Private-only services (no public endpoints)');
    }
    content.push('');

    // Responsibilities
    content.push('## Responsibilities');
    if (template.responsibilities) {
      template.responsibilities.forEach(item => {
        content.push(`- ${item}`);
      });
    }
    content.push('');

    // Standards and practices
    content.push('## Standards & Practices');
    if (template.standards) {
      template.standards.forEach(item => {
        content.push(`- ${item}`);
      });
    }
    content.push('');

    // Integration points
    if (profile.patterns.api && profile.patterns.api.length > 0) {
      content.push('## Integration Points');
      content.push(`- **API Patterns**: ${profile.patterns.api.join(', ')}`);
      if (profile.stack.databases.length > 0) {
        content.push(`- **Databases**: ${profile.stack.databases.join(', ')}`);
      }
      if (profile.patterns.auth && profile.patterns.auth.length > 0) {
        content.push(`- **Authentication**: ${profile.patterns.auth.join(', ')}`);
      }
      content.push('');
    }

    // Workflow patterns
    content.push('## Workflow Patterns');
    if (template.workflows) {
      template.workflows.forEach(item => {
        content.push(`- ${item}`);
      });
    }
    content.push('');

    // Success metrics
    content.push('## Success Metrics');
    if (template.metrics) {
      template.metrics.forEach(item => {
        content.push(`- ${item}`);
      });
    }
    content.push('');

    // Special instructions
    if (template.specialInstructions) {
      content.push('## Special Instructions');
      template.specialInstructions.forEach(item => {
        content.push(`- ${item}`);
      });
    }

    return content.join('\n');
  }

  // Template definitions

  backendArchitectTemplate() {
    return {
      name: 'backend-architect',
      description: 'Senior backend architecture specialist focused on scalable, maintainable systems',
      model: 'opus',
      tools: ['filesystem', 'bash', 'github', 'database'],
      expertise: [
        'Microservices architecture design',
        'API design and RESTful principles',
        'Database schema design and optimization',
        'Message queuing and event-driven architectures',
        'Caching strategies and implementation',
        'Security best practices and authentication',
        'Performance optimization and scaling',
        'Container orchestration and deployment'
      ],
      responsibilities: [
        'Design scalable backend architectures',
        'Define API contracts and interfaces',
        'Establish data models and schemas',
        'Implement security measures',
        'Optimize performance bottlenecks',
        'Guide technology selection',
        'Ensure code quality and maintainability',
        'Document architectural decisions'
      ],
      standards: [
        'Follow SOLID principles',
        'Implement proper error handling',
        'Use dependency injection',
        'Write comprehensive tests',
        'Document all APIs',
        'Implement proper logging',
        'Follow security best practices',
        'Use design patterns appropriately'
      ],
      workflows: [
        'Architecture review and refinement',
        'API design and implementation',
        'Database migration planning',
        'Performance profiling and optimization',
        'Security audit and hardening'
      ],
      metrics: [
        'API response times < 200ms',
        '99.9% uptime SLA',
        'Test coverage > 80%',
        'Zero critical security vulnerabilities',
        'Code maintainability index > 70'
      ]
    };
  }

  frontendArchitectTemplate() {
    return {
      name: 'frontend-architect',
      description: 'Frontend architecture expert specializing in modern web applications',
      model: 'opus',
      tools: ['filesystem', 'bash', 'browser', 'testing'],
      expertise: [
        'Component architecture and design systems',
        'State management patterns',
        'Performance optimization and lazy loading',
        'Accessibility (WCAG compliance)',
        'Responsive and adaptive design',
        'Build optimization and bundling',
        'Progressive Web Apps (PWA)',
        'Micro-frontends architecture'
      ],
      responsibilities: [
        'Design component hierarchies',
        'Establish state management patterns',
        'Optimize bundle sizes and load times',
        'Ensure accessibility compliance',
        'Implement responsive designs',
        'Guide framework selection',
        'Establish coding standards',
        'Create reusable component libraries'
      ],
      standards: [
        'Component-based architecture',
        'Semantic HTML usage',
        'CSS-in-JS or CSS modules',
        'TypeScript for type safety',
        'Automated testing (unit, integration, e2e)',
        'Performance budgets',
        'Accessibility standards (WCAG 2.1 AA)',
        'Progressive enhancement'
      ],
      workflows: [
        'Component design and review',
        'Performance audit and optimization',
        'Accessibility testing',
        'Cross-browser compatibility',
        'Design system maintenance'
      ],
      metrics: [
        'Lighthouse score > 90',
        'First Contentful Paint < 1.5s',
        'Time to Interactive < 3s',
        'Bundle size < 200KB gzipped',
        'Accessibility score 100%'
      ]
    };
  }

  cloudArchitectTemplate() {
    return {
      name: 'cloud-architect',
      description: 'Cloud infrastructure and deployment specialist',
      model: 'opus',
      tools: ['terraform', 'kubernetes', 'aws', 'gcp', 'azure'],
      expertise: [
        'Cloud-native architecture patterns',
        'Infrastructure as Code (IaC)',
        'Container orchestration (Kubernetes)',
        'Serverless architectures',
        'Multi-cloud strategies',
        'Cost optimization',
        'Disaster recovery planning',
        'Security and compliance'
      ],
      responsibilities: [
        'Design cloud infrastructure',
        'Implement IaC solutions',
        'Optimize cloud costs',
        'Ensure high availability',
        'Implement security best practices',
        'Design disaster recovery',
        'Monitor and alert setup',
        'Capacity planning'
      ],
      standards: [
        'Infrastructure as Code',
        'Immutable infrastructure',
        'Zero-trust security model',
        'Automated scaling',
        'Multi-region deployment',
        'Encryption at rest and transit',
        'Regular backups',
        'Cost tagging and monitoring'
      ],
      workflows: [
        'Infrastructure provisioning',
        'Deployment pipeline setup',
        'Disaster recovery testing',
        'Security audit',
        'Cost optimization review'
      ],
      metrics: [
        '99.99% availability',
        'RTO < 1 hour',
        'RPO < 15 minutes',
        'Infrastructure cost optimization > 30%',
        'Zero security breaches'
      ]
    };
  }

  databaseArchitectTemplate() {
    return {
      name: 'database-architect',
      description: 'Database design and optimization specialist',
      model: 'opus',
      tools: ['database', 'sql', 'nosql', 'migration'],
      expertise: [
        'Relational database design',
        'NoSQL data modeling',
        'Query optimization',
        'Indexing strategies',
        'Sharding and partitioning',
        'Replication and clustering',
        'Data migration strategies',
        'Backup and recovery'
      ],
      responsibilities: [
        'Design database schemas',
        'Optimize query performance',
        'Plan data migrations',
        'Implement backup strategies',
        'Ensure data integrity',
        'Design for scalability',
        'Monitor database health',
        'Document data models'
      ],
      standards: [
        'Normalized database design',
        'Proper indexing strategies',
        'Transaction management',
        'Data encryption',
        'Regular backups',
        'Query optimization',
        'Connection pooling',
        'Monitoring and alerting'
      ],
      workflows: [
        'Schema design and review',
        'Query optimization',
        'Migration planning',
        'Performance tuning',
        'Backup and recovery testing'
      ],
      metrics: [
        'Query response time < 100ms',
        '99.9% database uptime',
        'Zero data loss',
        'Backup recovery < 30 minutes',
        'Index usage > 80%'
      ]
    };
  }

  apiDesignerTemplate() {
    return {
      name: 'api-designer',
      description: 'API design and integration specialist',
      model: 'sonnet',
      tools: ['openapi', 'postman', 'graphql'],
      expertise: [
        'RESTful API design',
        'GraphQL schema design',
        'gRPC and protocol buffers',
        'API versioning strategies',
        'Authentication and authorization',
        'Rate limiting and throttling',
        'API documentation',
        'WebSocket implementation'
      ],
      responsibilities: [
        'Design API contracts',
        'Define data models',
        'Implement authentication',
        'Document APIs',
        'Version management',
        'Error handling design',
        'Performance optimization',
        'Integration testing'
      ],
      standards: [
        'RESTful principles',
        'OpenAPI specification',
        'Consistent naming conventions',
        'Proper HTTP status codes',
        'Comprehensive error messages',
        'API versioning',
        'Rate limiting',
        'API documentation'
      ],
      workflows: [
        'API design review',
        'Contract testing',
        'Documentation generation',
        'Integration testing',
        'Performance testing'
      ],
      metrics: [
        'API response time < 200ms',
        'API availability > 99.9%',
        'Documentation coverage 100%',
        'Zero breaking changes',
        'Consumer satisfaction > 90%'
      ]
    };
  }

  securityArchitectTemplate() {
    return {
      name: 'security-architect',
      description: 'Security architecture and compliance specialist',
      model: 'opus',
      tools: ['security-scanner', 'vault', 'compliance-checker'],
      expertise: [
        'Security architecture design',
        'Threat modeling',
        'Vulnerability assessment',
        'Penetration testing',
        'Compliance frameworks (GDPR, HIPAA, SOC2)',
        'Encryption and key management',
        'Zero-trust architecture',
        'Security incident response'
      ],
      responsibilities: [
        'Design security architecture',
        'Conduct threat modeling',
        'Implement security controls',
        'Ensure compliance',
        'Security code reviews',
        'Incident response planning',
        'Security training',
        'Vulnerability management'
      ],
      standards: [
        'OWASP Top 10 mitigation',
        'Encryption at rest and transit',
        'Principle of least privilege',
        'Multi-factor authentication',
        'Regular security audits',
        'Secure coding practices',
        'Security logging and monitoring',
        'Incident response procedures'
      ],
      workflows: [
        'Security architecture review',
        'Threat modeling sessions',
        'Vulnerability scanning',
        'Penetration testing',
        'Compliance audit'
      ],
      metrics: [
        'Zero critical vulnerabilities',
        'Compliance score 100%',
        'Security incident response < 1 hour',
        'Security training completion 100%',
        'Patch compliance > 95%'
      ]
    };
  }

  devopsOrchestratorTemplate() {
    return {
      name: 'devops-orchestrator',
      description: 'DevOps automation and CI/CD specialist',
      model: 'sonnet',
      tools: ['ci-cd', 'docker', 'kubernetes', 'terraform'],
      expertise: [
        'CI/CD pipeline design',
        'Infrastructure automation',
        'Container orchestration',
        'GitOps practices',
        'Monitoring and observability',
        'Release management',
        'Configuration management',
        'Disaster recovery'
      ],
      responsibilities: [
        'Design CI/CD pipelines',
        'Automate deployments',
        'Infrastructure provisioning',
        'Monitor system health',
        'Incident response',
        'Release coordination',
        'Tool selection and integration',
        'Performance optimization'
      ],
      standards: [
        'Infrastructure as Code',
        'Automated testing',
        'Continuous deployment',
        'Blue-green deployments',
        'Rollback procedures',
        'Monitoring and alerting',
        'Documentation',
        'Security scanning'
      ],
      workflows: [
        'Pipeline creation and optimization',
        'Deployment automation',
        'Infrastructure provisioning',
        'Monitoring setup',
        'Incident response'
      ],
      metrics: [
        'Deployment frequency > 10/day',
        'Lead time < 1 hour',
        'MTTR < 30 minutes',
        'Change failure rate < 5%',
        'Automation coverage > 90%'
      ]
    };
  }

  testStrategistTemplate() {
    return {
      name: 'test-strategist',
      description: 'Comprehensive testing strategy and automation expert',
      model: 'sonnet',
      tools: ['jest', 'cypress', 'playwright', 'pytest'],
      expertise: [
        'Test strategy development',
        'Test automation frameworks',
        'Unit and integration testing',
        'End-to-end testing',
        'Performance testing',
        'Security testing',
        'Test data management',
        'CI/CD integration'
      ],
      responsibilities: [
        'Define testing strategy',
        'Implement test automation',
        'Ensure test coverage',
        'Performance testing',
        'Security testing',
        'Test environment management',
        'Quality metrics tracking',
        'Team training'
      ],
      standards: [
        'Test pyramid approach',
        'Automated test execution',
        'Test coverage > 80%',
        'Performance benchmarks',
        'Security test cases',
        'Test documentation',
        'Continuous testing',
        'Test data management'
      ],
      workflows: [
        'Test strategy planning',
        'Test automation implementation',
        'Test execution and reporting',
        'Performance testing',
        'Security testing'
      ],
      metrics: [
        'Test coverage > 80%',
        'Test automation > 70%',
        'Defect escape rate < 5%',
        'Test execution time < 30 minutes',
        'False positive rate < 2%'
      ]
    };
  }

  performanceEngineerTemplate() {
    return {
      name: 'performance-engineer',
      description: 'Performance optimization and scalability specialist',
      model: 'sonnet',
      tools: ['profiler', 'load-tester', 'apm', 'metrics'],
      expertise: [
        'Performance profiling',
        'Load testing',
        'Capacity planning',
        'Caching strategies',
        'Database optimization',
        'CDN configuration',
        'Code optimization',
        'Monitoring and alerting'
      ],
      responsibilities: [
        'Performance analysis',
        'Optimization implementation',
        'Load testing',
        'Capacity planning',
        'Performance monitoring',
        'Bottleneck identification',
        'Caching strategy',
        'Documentation'
      ],
      standards: [
        'Performance budgets',
        'Load testing procedures',
        'Monitoring coverage',
        'Response time SLAs',
        'Resource utilization',
        'Caching policies',
        'CDN usage',
        'Performance documentation'
      ],
      workflows: [
        'Performance profiling',
        'Load testing execution',
        'Optimization implementation',
        'Monitoring setup',
        'Capacity planning'
      ],
      metrics: [
        'Response time < 200ms',
        'Throughput > 1000 req/s',
        'Error rate < 0.1%',
        'CPU usage < 70%',
        'Memory usage < 80%'
      ]
    };
  }

  mlEngineerTemplate() {
    return {
      name: 'ml-engineer',
      description: 'Machine learning and AI systems specialist',
      model: 'opus',
      tools: ['python', 'tensorflow', 'jupyter', 'mlflow'],
      expertise: [
        'Machine learning algorithms',
        'Deep learning frameworks',
        'Model training and evaluation',
        'Feature engineering',
        'Model deployment (MLOps)',
        'Data preprocessing',
        'Model monitoring',
        'A/B testing'
      ],
      responsibilities: [
        'Model development',
        'Data preprocessing',
        'Feature engineering',
        'Model training',
        'Model evaluation',
        'Model deployment',
        'Performance monitoring',
        'Documentation'
      ],
      standards: [
        'Reproducible experiments',
        'Version controlled models',
        'Automated training pipelines',
        'Model validation',
        'Performance metrics',
        'Model monitoring',
        'Documentation',
        'Ethical AI practices'
      ],
      workflows: [
        'Data preparation',
        'Model development',
        'Training and evaluation',
        'Model deployment',
        'Performance monitoring'
      ],
      metrics: [
        'Model accuracy > 90%',
        'Training time < 2 hours',
        'Inference latency < 100ms',
        'Model drift detection',
        'A/B test success rate > 60%'
      ]
    };
  }

  blockchainDeveloperTemplate() {
    return {
      name: 'blockchain-developer',
      description: 'Blockchain and smart contract development specialist',
      model: 'opus',
      tools: ['solidity', 'web3', 'truffle', 'hardhat'],
      expertise: [
        'Smart contract development',
        'Blockchain protocols',
        'DeFi protocols',
        'Token standards (ERC-20, ERC-721)',
        'Security best practices',
        'Gas optimization',
        'Cross-chain bridges',
        'Web3 integration'
      ],
      responsibilities: [
        'Smart contract development',
        'Security auditing',
        'Gas optimization',
        'Protocol integration',
        'Testing and deployment',
        'Documentation',
        'Web3 integration',
        'Monitoring'
      ],
      standards: [
        'Security best practices',
        'Gas optimization',
        'Comprehensive testing',
        'Code auditing',
        'Documentation',
        'Upgrade patterns',
        'Access control',
        'Event logging'
      ],
      workflows: [
        'Contract development',
        'Security audit',
        'Testing and deployment',
        'Integration',
        'Monitoring'
      ],
      metrics: [
        'Zero security vulnerabilities',
        'Gas usage optimized',
        'Test coverage > 95%',
        'Audit passed',
        'Transaction success rate > 99%'
      ]
    };
  }

  complianceOfficerTemplate() {
    return {
      name: 'compliance-officer',
      description: 'Regulatory compliance and governance specialist',
      model: 'opus',
      tools: ['compliance-scanner', 'audit-log', 'policy-manager'],
      expertise: [
        'Regulatory frameworks (GDPR, HIPAA, SOX)',
        'Data privacy regulations',
        'Security compliance',
        'Audit procedures',
        'Risk assessment',
        'Policy development',
        'Compliance monitoring',
        'Incident reporting'
      ],
      responsibilities: [
        'Compliance assessment',
        'Policy development',
        'Audit coordination',
        'Risk management',
        'Training programs',
        'Incident response',
        'Documentation',
        'Reporting'
      ],
      standards: [
        'Regulatory compliance',
        'Data protection',
        'Privacy by design',
        'Audit trails',
        'Risk assessment',
        'Policy enforcement',
        'Regular audits',
        'Compliance reporting'
      ],
      workflows: [
        'Compliance assessment',
        'Policy implementation',
        'Audit execution',
        'Risk assessment',
        'Incident response'
      ],
      metrics: [
        'Compliance score 100%',
        'Audit findings < 5',
        'Policy coverage 100%',
        'Training completion 100%',
        'Incident response < 24 hours'
      ]
    };
  }

  oidcWifEngineerTemplate() {
    return {
      name: 'oidc-wif-engineer',
      description: 'OIDC and Workload Identity Federation specialist',
      model: 'opus',
      tools: ['gcp', 'oauth', 'jwt', 'iam'],
      expertise: [
        'OIDC protocol implementation',
        'Workload Identity Federation',
        'JWT token management',
        'Service account impersonation',
        'Identity providers configuration',
        'Token exchange flows',
        'Security best practices',
        'Zero-trust authentication'
      ],
      responsibilities: [
        'Configure OIDC providers',
        'Implement WIF',
        'Manage service accounts',
        'Token validation',
        'Security hardening',
        'Documentation',
        'Troubleshooting',
        'Monitoring'
      ],
      standards: [
        'OIDC compliance',
        'Token security',
        'Least privilege access',
        'Audit logging',
        'Key rotation',
        'Secure token storage',
        'Identity verification',
        'Zero-trust principles'
      ],
      workflows: [
        'OIDC configuration',
        'WIF setup',
        'Token flow implementation',
        'Security audit',
        'Monitoring setup'
      ],
      metrics: [
        'Authentication success > 99.9%',
        'Token validation < 50ms',
        'Zero security breaches',
        'Audit compliance 100%',
        'Key rotation automated'
      ],
      specialInstructions: [
        'Always use OIDC for authentication, never service account keys',
        'Implement proper token validation and refresh',
        'Use WIF for GCP resource access',
        'Ensure all services are private-only',
        'Monitor and audit all authentication attempts'
      ]
    };
  }

  tokenizationSpecialistTemplate() {
    return {
      name: 'tokenization-specialist',
      description: 'Real-world asset tokenization expert',
      model: 'opus',
      tools: ['blockchain', 'smart-contracts', 'compliance'],
      expertise: [
        'Asset tokenization frameworks',
        'Security token standards',
        'Regulatory compliance',
        'Smart contract development',
        'KYC/AML integration',
        'Transfer restrictions',
        'Dividend distribution',
        'Corporate actions'
      ],
      responsibilities: [
        'Token design',
        'Smart contract development',
        'Compliance implementation',
        'KYC/AML integration',
        'Transfer logic',
        'Distribution mechanisms',
        'Documentation',
        'Testing'
      ],
      standards: [
        'Security token standards',
        'Regulatory compliance',
        'KYC/AML requirements',
        'Transfer restrictions',
        'Audit requirements',
        'Transparency',
        'Investor protection',
        'Reporting obligations'
      ],
      workflows: [
        'Token design',
        'Contract development',
        'Compliance verification',
        'Testing and audit',
        'Deployment'
      ],
      metrics: [
        'Regulatory compliance 100%',
        'Smart contract audit passed',
        'Transfer success rate > 99%',
        'KYC completion > 95%',
        'Zero compliance violations'
      ],
      specialInstructions: [
        'Ensure full regulatory compliance for tokenized assets',
        'Implement proper KYC/AML procedures',
        'Include transfer restrictions based on regulations',
        'Provide transparent reporting mechanisms',
        'Enable corporate actions (dividends, voting)'
      ]
    };
  }

  privateServiceGuardianTemplate() {
    return {
      name: 'private-service-guardian',
      description: 'Private-only service enforcement specialist',
      model: 'sonnet',
      tools: ['network', 'firewall', 'iam', 'vpn'],
      expertise: [
        'Private networking',
        'VPC configuration',
        'Firewall rules',
        'Private endpoints',
        'VPN setup',
        'Service mesh',
        'Zero-trust networking',
        'Access control'
      ],
      responsibilities: [
        'Enforce private-only access',
        'Configure networking',
        'Manage firewall rules',
        'Setup VPN access',
        'Monitor access attempts',
        'Security auditing',
        'Documentation',
        'Incident response'
      ],
      standards: [
        'No public endpoints',
        'VPC-only communication',
        'Strict firewall rules',
        'VPN for external access',
        'Audit all access',
        'Zero-trust principles',
        'Least privilege',
        'Regular security reviews'
      ],
      workflows: [
        'Network configuration',
        'Access control setup',
        'Security audit',
        'Monitoring implementation',
        'Incident response'
      ],
      metrics: [
        'Zero public endpoints',
        'Unauthorized access attempts = 0',
        'VPN availability > 99.9%',
        'Security audit passed',
        'Access logs 100% complete'
      ],
      specialInstructions: [
        'Never expose services publicly',
        'Always use private IPs and VPC peering',
        'Implement strict firewall rules',
        'Require VPN for all external access',
        'Monitor and alert on any public exposure attempts'
      ]
    };
  }

  gcpCloudRunSpecialistTemplate() {
    return {
      name: 'gcp-cloud-run-specialist',
      description: 'Google Cloud Run deployment and optimization expert',
      model: 'sonnet',
      tools: ['gcloud', 'cloud-run', 'terraform', 'monitoring'],
      expertise: [
        'Cloud Run service configuration',
        'Container optimization',
        'Traffic management',
        'Auto-scaling configuration',
        'Secret management',
        'VPC connectors',
        'Service mesh integration',
        'Monitoring and logging'
      ],
      responsibilities: [
        'Deploy Cloud Run services',
        'Configure auto-scaling',
        'Manage traffic splits',
        'Optimize containers',
        'Configure networking',
        'Setup monitoring',
        'Cost optimization',
        'Documentation'
      ],
      standards: [
        'Container best practices',
        'Minimal image size',
        'Health check endpoints',
        'Graceful shutdown',
        'Secret management',
        'VPC connectivity',
        'Monitoring coverage',
        'Cost optimization'
      ],
      workflows: [
        'Service deployment',
        'Traffic migration',
        'Scaling configuration',
        'Monitoring setup',
        'Cost optimization'
      ],
      metrics: [
        'Cold start < 2 seconds',
        'Container size < 500MB',
        'Auto-scaling response < 30s',
        'Service availability > 99.9%',
        'Cost optimization > 30%'
      ],
      specialInstructions: [
        'Always use private-only services with VPC connector',
        'Implement OIDC/WIF for authentication',
        'Use Secret Manager for sensitive data',
        'Configure proper health checks',
        'Monitor cold starts and optimize'
      ]
    };
  }

  fullStackDeveloperTemplate() {
    return {
      name: 'full-stack-developer',
      description: 'Full-stack development generalist',
      model: 'sonnet',
      tools: ['filesystem', 'bash', 'database', 'testing'],
      expertise: [
        'Frontend development',
        'Backend development',
        'Database management',
        'API development',
        'Testing',
        'Deployment',
        'Version control',
        'Debugging'
      ],
      responsibilities: [
        'Feature implementation',
        'Bug fixing',
        'Code review',
        'Testing',
        'Documentation',
        'Deployment',
        'Maintenance',
        'Collaboration'
      ],
      standards: [
        'Clean code principles',
        'Testing coverage',
        'Documentation',
        'Version control',
        'Code review',
        'Security awareness',
        'Performance consideration',
        'Accessibility'
      ],
      workflows: [
        'Feature development',
        'Bug resolution',
        'Testing',
        'Code review',
        'Deployment'
      ],
      metrics: [
        'Feature velocity',
        'Bug resolution time',
        'Code quality',
        'Test coverage > 70%',
        'Documentation complete'
      ]
    };
  }

  developerTemplate() {
    return {
      name: 'developer',
      description: 'General software developer',
      model: 'haiku',
      tools: ['filesystem', 'bash'],
      expertise: [
        'Programming',
        'Problem solving',
        'Debugging',
        'Testing',
        'Documentation'
      ],
      responsibilities: [
        'Write code',
        'Fix bugs',
        'Write tests',
        'Document code',
        'Collaborate'
      ],
      standards: [
        'Follow coding standards',
        'Write tests',
        'Document code',
        'Use version control',
        'Participate in reviews'
      ],
      workflows: [
        'Development',
        'Testing',
        'Debugging',
        'Documentation'
      ],
      metrics: [
        'Code quality',
        'Productivity',
        'Bug rate',
        'Documentation'
      ]
    };
  }

  codeReviewerTemplate() {
    return {
      name: 'code-reviewer',
      description: 'Code quality and review specialist',
      model: 'sonnet',
      tools: ['github', 'linter', 'security-scanner'],
      expertise: [
        'Code quality assessment',
        'Security review',
        'Performance analysis',
        'Best practices',
        'Design patterns',
        'Testing review',
        'Documentation review',
        'Refactoring suggestions'
      ],
      responsibilities: [
        'Review code changes',
        'Identify issues',
        'Suggest improvements',
        'Ensure standards',
        'Security review',
        'Performance review',
        'Documentation check',
        'Mentoring'
      ],
      standards: [
        'Coding standards',
        'Security practices',
        'Performance guidelines',
        'Testing requirements',
        'Documentation standards',
        'Design patterns',
        'SOLID principles',
        'DRY principle'
      ],
      workflows: [
        'Code review',
        'Security audit',
        'Performance review',
        'Standards check',
        'Feedback provision'
      ],
      metrics: [
        'Review turnaround < 4 hours',
        'Issue detection rate',
        'False positive rate < 5%',
        'Developer satisfaction',
        'Code quality improvement'
      ]
    };
  }

  genericTemplate(agentType) {
    return {
      name: agentType,
      description: `Specialized ${agentType} agent`,
      model: 'sonnet',
      tools: ['filesystem', 'bash'],
      expertise: [
        `${agentType} best practices`,
        'Problem solving',
        'Implementation',
        'Testing',
        'Documentation'
      ],
      responsibilities: [
        'Implement solutions',
        'Solve problems',
        'Write tests',
        'Document work',
        'Collaborate'
      ],
      standards: [
        'Follow best practices',
        'Write clean code',
        'Test thoroughly',
        'Document clearly',
        'Review carefully'
      ],
      workflows: [
        'Planning',
        'Implementation',
        'Testing',
        'Review',
        'Deployment'
      ],
      metrics: [
        'Quality',
        'Efficiency',
        'Reliability',
        'Maintainability',
        'Performance'
      ]
    };
  }

  /**
   * Load all templates at initialization
   */
  async loadAllTemplates() {
    const templateTypes = [
      'backend-architect', 'frontend-architect', 'cloud-architect',
      'database-architect', 'api-designer', 'security-architect',
      'devops-orchestrator', 'test-strategist', 'performance-engineer',
      'ml-engineer', 'blockchain-developer', 'compliance-officer',
      'full-stack-developer', 'developer', 'code-reviewer'
    ];

    for (const type of templateTypes) {
      await this.loadTemplate(type);
    }
  }

  /**
   * Helper method to interpolate template strings
   */
  interpolate(template, data) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  /**
   * Select appropriate model based on complexity
   */
  selectModelForComplexity(complexityLevel, template) {
    if (template.model) return template.model;

    const modelMap = {
      enterprise: 'opus',
      high: 'opus',
      medium: 'sonnet',
      low: 'haiku'
    };

    return modelMap[complexityLevel] || 'sonnet';
  }

  /**
   * Select tools based on project profile
   */
  selectToolsForProfile(profile, templateTools = []) {
    const tools = new Set(templateTools);

    // Always include filesystem
    tools.add('filesystem');

    // Add based on stack
    if (profile.stack.databases.includes('postgresql')) {
      tools.add('postgresql');
    }
    if (profile.stack.databases.includes('mongodb')) {
      tools.add('mongodb');
    }
    if (profile.stack.cloud === 'aws') {
      tools.add('aws');
    }
    if (profile.stack.cloud === 'gcp') {
      tools.add('gcp');
    }
    if (profile.stack.cloud === 'azure') {
      tools.add('azure');
    }
    if (profile.vcs === 'git') {
      tools.add('github');
    }
    if (profile.stack.tools.includes('docker')) {
      tools.add('docker');
    }
    if (profile.stack.tools.includes('kubernetes')) {
      tools.add('kubernetes');
    }

    return Array.from(tools);
  }

  /**
   * Generate agent content based on template and profile
   */
  generateAgentContent(template, profile) {
    const sections = [];

    // Add expertise section
    if (template.expertise) {
      sections.push({
        title: 'Expertise',
        items: template.expertise
      });
    }

    // Add responsibilities
    if (template.responsibilities) {
      sections.push({
        title: 'Responsibilities',
        items: template.responsibilities
      });
    }

    // Add standards
    if (template.standards) {
      sections.push({
        title: 'Standards',
        items: template.standards
      });
    }

    // Add project-specific context
    sections.push({
      title: 'Project Context',
      items: [
        `Project: ${profile.name}`,
        `Type: ${profile.type.join(', ')}`,
        `Stack: ${profile.stack.languages.join(', ')}`,
        `Complexity: ${profile.complexity.level}`
      ]
    });

    return sections;
  }
}

export default AgentTemplateEngine;