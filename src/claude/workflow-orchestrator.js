/**
 * Workflow Orchestrator for DevAssist v3.0
 * Creates and manages multi-agent workflow patterns
 */

import { promises as fs } from 'fs';
import path from 'path';
import { AgentNetworkBuilder } from '../agents/agent-network-builder.js';

export class WorkflowOrchestrator {
  constructor() {
    this.networkBuilder = new AgentNetworkBuilder();
    this.workflows = new Map();
  }

  /**
   * Create workflows for the project
   */
  async createWorkflows(profile, agents) {
    const workflows = [];

    // Core workflows
    workflows.push(await this.createFeatureDevelopmentWorkflow(profile, agents));
    workflows.push(await this.createDeploymentWorkflow(profile, agents));
    workflows.push(await this.createTestingWorkflow(profile, agents));
    workflows.push(await this.createCodeReviewWorkflow(profile, agents));

    // Specialized workflows based on project requirements
    if (profile.special.compliance) {
      workflows.push(await this.createComplianceWorkflow(profile, agents));
    }

    if (profile.special.security) {
      workflows.push(await this.createSecurityWorkflow(profile, agents));
    }

    if (profile.custom.tokenization) {
      workflows.push(await this.createTokenizationWorkflow(profile, agents));
    }

    if (profile.special.performance) {
      workflows.push(await this.createPerformanceWorkflow(profile, agents));
    }

    if (profile.special.ai) {
      workflows.push(await this.createMLWorkflow(profile, agents));
    }

    // Save workflows
    await this.saveWorkflows(workflows, profile.projectPath);

    return workflows;
  }

  /**
   * Create feature development workflow
   */
  async createFeatureDevelopmentWorkflow(profile, agents) {
    return {
      name: 'feature-development',
      description: 'Complete feature development from design to deployment',
      trigger: ['manual', 'pr-created'],
      agents: this.selectRelevantAgents(agents, ['architect', 'developer', 'tester', 'reviewer']),
      steps: [
        {
          id: 'design',
          name: 'Design & Planning',
          agents: ['architect', 'api-designer'],
          tasks: [
            'Review requirements',
            'Create technical design',
            'Define API contracts',
            'Plan implementation'
          ],
          outputs: ['design-doc', 'api-spec']
        },
        {
          id: 'implement',
          name: 'Implementation',
          agents: ['developer', 'engineer'],
          tasks: [
            'Write code',
            'Implement tests',
            'Update documentation',
            'Handle edge cases'
          ],
          outputs: ['code', 'tests', 'docs']
        },
        {
          id: 'test',
          name: 'Testing',
          agents: ['test-engineer', 'qa'],
          tasks: [
            'Run unit tests',
            'Execute integration tests',
            'Perform E2E testing',
            'Validate acceptance criteria'
          ],
          outputs: ['test-results', 'coverage-report']
        },
        {
          id: 'review',
          name: 'Code Review',
          agents: ['code-reviewer', 'security-auditor'],
          tasks: [
            'Review code quality',
            'Check security issues',
            'Verify best practices',
            'Suggest improvements'
          ],
          outputs: ['review-comments', 'approval-status']
        },
        {
          id: 'deploy',
          name: 'Deployment',
          agents: ['devops-engineer'],
          tasks: [
            'Build artifacts',
            'Run deployment',
            'Verify deployment',
            'Monitor metrics'
          ],
          outputs: ['deployment-status', 'monitoring-dashboard']
        }
      ],
      rollback: {
        enabled: true,
        automatic: true,
        conditions: ['test-failure', 'deployment-error', 'health-check-fail']
      }
    };
  }

  /**
   * Create deployment workflow
   */
  async createDeploymentWorkflow(profile, agents) {
    const workflow = {
      name: 'deployment-pipeline',
      description: 'Production deployment with validation',
      trigger: ['manual', 'merge-to-main'],
      agents: this.selectRelevantAgents(agents, ['devops', 'test', 'monitor']),
      steps: []
    };

    // Pre-deployment validation
    workflow.steps.push({
      id: 'pre-deploy',
      name: 'Pre-deployment Validation',
      agents: ['test-engineer', 'security-auditor'],
      tasks: [
        'Run smoke tests',
        'Security scan',
        'Dependency check',
        'Configuration validation'
      ],
      gates: {
        'test-pass-rate': '>= 100%',
        'security-vulnerabilities': '== 0',
        'config-valid': 'true'
      }
    });

    // Build stage
    workflow.steps.push({
      id: 'build',
      name: 'Build & Package',
      agents: ['devops-engineer'],
      tasks: [
        'Compile code',
        'Optimize assets',
        'Create containers',
        'Push to registry'
      ],
      outputs: ['build-artifacts', 'container-images']
    });

    // Deployment based on platform
    if (profile.stack.cloud === 'gcp') {
      workflow.steps.push(this.createGCPDeploymentStep(profile));
    } else if (profile.stack.cloud === 'aws') {
      workflow.steps.push(this.createAWSDeploymentStep(profile));
    } else if (profile.stack.cloud === 'azure') {
      workflow.steps.push(this.createAzureDeploymentStep(profile));
    } else {
      workflow.steps.push(this.createGenericDeploymentStep(profile));
    }

    // Post-deployment validation
    workflow.steps.push({
      id: 'post-deploy',
      name: 'Post-deployment Validation',
      agents: ['test-engineer', 'monitoring-specialist'],
      tasks: [
        'Health checks',
        'Smoke tests',
        'Performance validation',
        'Alert configuration'
      ],
      monitoring: {
        duration: '30m',
        metrics: ['latency', 'error-rate', 'throughput'],
        thresholds: {
          'error-rate': '< 1%',
          'latency-p99': '< 500ms'
        }
      }
    });

    return workflow;
  }

  /**
   * Create GCP-specific deployment step
   */
  createGCPDeploymentStep(profile) {
    return {
      id: 'gcp-deploy',
      name: 'Deploy to Google Cloud Platform',
      agents: ['gcp-specialist', 'cloud-engineer'],
      tasks: [
        'Configure Cloud Run service',
        'Set up VPC connector',
        'Configure Secret Manager',
        'Deploy with traffic management',
        'Configure monitoring'
      ],
      config: {
        platform: 'cloud-run',
        authentication: profile.custom.oidc_wif ? 'oidc' : 'default',
        networking: profile.custom.private_only ? 'private' : 'public',
        scaling: {
          min: 1,
          max: 100,
          concurrency: 1000
        }
      }
    };
  }

  /**
   * Create AWS-specific deployment step
   */
  createAWSDeploymentStep(profile) {
    return {
      id: 'aws-deploy',
      name: 'Deploy to AWS',
      agents: ['aws-specialist', 'cloud-engineer'],
      tasks: [
        'Configure ECS/Lambda',
        'Set up ALB/API Gateway',
        'Configure Secrets Manager',
        'Deploy with blue-green',
        'Set up CloudWatch'
      ],
      config: {
        platform: profile.patterns.architecture === 'serverless' ? 'lambda' : 'ecs',
        deployment: 'blue-green',
        monitoring: 'cloudwatch'
      }
    };
  }

  /**
   * Create Azure-specific deployment step
   */
  createAzureDeploymentStep(profile) {
    return {
      id: 'azure-deploy',
      name: 'Deploy to Azure',
      agents: ['azure-specialist', 'cloud-engineer'],
      tasks: [
        'Configure App Service/Functions',
        'Set up Application Gateway',
        'Configure Key Vault',
        'Deploy with slots',
        'Configure Application Insights'
      ],
      config: {
        platform: profile.patterns.architecture === 'serverless' ? 'functions' : 'app-service',
        deployment: 'slots',
        monitoring: 'application-insights'
      }
    };
  }

  /**
   * Create generic deployment step
   */
  createGenericDeploymentStep(profile) {
    return {
      id: 'deploy',
      name: 'Deploy Application',
      agents: ['devops-engineer'],
      tasks: [
        'Deploy to target environment',
        'Configure load balancer',
        'Set up monitoring',
        'Verify deployment'
      ],
      config: {
        platform: 'generic',
        deployment: 'rolling'
      }
    };
  }

  /**
   * Create testing workflow
   */
  async createTestingWorkflow(profile, agents) {
    return {
      name: 'comprehensive-testing',
      description: 'Full testing suite execution',
      trigger: ['pr-update', 'pre-deploy', 'manual'],
      agents: this.selectRelevantAgents(agents, ['test', 'qa', 'performance']),
      parallel: true,
      steps: [
        {
          id: 'unit',
          name: 'Unit Testing',
          agents: ['test-engineer'],
          tasks: [
            'Run unit tests',
            'Generate coverage report',
            'Validate coverage threshold'
          ],
          config: {
            framework: profile.stack.testing[0] || 'jest',
            coverageThreshold: profile.complexity.level === 'enterprise' ? 80 : 70
          }
        },
        {
          id: 'integration',
          name: 'Integration Testing',
          agents: ['test-engineer'],
          tasks: [
            'Test API endpoints',
            'Validate database operations',
            'Check service integrations'
          ]
        },
        {
          id: 'e2e',
          name: 'End-to-End Testing',
          agents: ['qa-engineer'],
          tasks: [
            'Run E2E scenarios',
            'Test user workflows',
            'Validate UI functionality'
          ],
          config: {
            framework: profile.stack.testing.find(t => ['playwright', 'cypress'].includes(t)) || 'playwright'
          }
        },
        {
          id: 'performance',
          name: 'Performance Testing',
          agents: ['performance-engineer'],
          tasks: [
            'Load testing',
            'Stress testing',
            'Memory profiling',
            'Response time analysis'
          ],
          thresholds: {
            'response-time-p95': '< 1000ms',
            'throughput': '> 100 req/s',
            'error-rate': '< 1%'
          }
        },
        {
          id: 'security',
          name: 'Security Testing',
          agents: ['security-auditor'],
          tasks: [
            'Vulnerability scanning',
            'Dependency audit',
            'OWASP compliance check',
            'Penetration testing'
          ]
        }
      ],
      reporting: {
        format: 'html',
        aggregation: 'all',
        failFast: false
      }
    };
  }

  /**
   * Create code review workflow
   */
  async createCodeReviewWorkflow(profile, agents) {
    return {
      name: 'code-review',
      description: 'Automated code review process',
      trigger: ['pr-opened', 'pr-updated'],
      agents: this.selectRelevantAgents(agents, ['reviewer', 'security', 'architect']),
      steps: [
        {
          id: 'static-analysis',
          name: 'Static Code Analysis',
          agents: ['code-reviewer'],
          tasks: [
            'Linting',
            'Type checking',
            'Complexity analysis',
            'Code smell detection'
          ],
          tools: ['eslint', 'typescript', 'sonarqube']
        },
        {
          id: 'security-review',
          name: 'Security Review',
          agents: ['security-auditor'],
          tasks: [
            'Secret scanning',
            'Vulnerability check',
            'Permission validation',
            'Input validation review'
          ]
        },
        {
          id: 'architecture-review',
          name: 'Architecture Review',
          agents: ['architect'],
          tasks: [
            'Design pattern compliance',
            'Architecture consistency',
            'Performance implications',
            'Scalability considerations'
          ]
        },
        {
          id: 'documentation',
          name: 'Documentation Review',
          agents: ['documentation-specialist'],
          tasks: [
            'API documentation',
            'Code comments',
            'README updates',
            'Changelog entries'
          ]
        }
      ],
      approval: {
        required: true,
        minimumApprovers: profile.complexity.level === 'enterprise' ? 2 : 1,
        blockingLabels: ['needs-changes', 'security-issue']
      }
    };
  }

  /**
   * Create compliance workflow
   */
  async createComplianceWorkflow(profile, agents) {
    return {
      name: 'compliance-verification',
      description: 'Regulatory compliance checking',
      trigger: ['scheduled', 'pre-release', 'manual'],
      agents: this.selectRelevantAgents(agents, ['compliance', 'security', 'auditor']),
      steps: [
        {
          id: 'data-privacy',
          name: 'Data Privacy Compliance',
          agents: ['compliance-officer'],
          tasks: [
            'GDPR compliance check',
            'Data retention validation',
            'PII handling review',
            'Consent management verification'
          ],
          standards: profile.special.compliance || []
        },
        {
          id: 'security-compliance',
          name: 'Security Compliance',
          agents: ['security-auditor'],
          tasks: [
            'Access control review',
            'Encryption validation',
            'Audit logging check',
            'Security policy compliance'
          ]
        },
        {
          id: 'audit-trail',
          name: 'Audit Trail Generation',
          agents: ['compliance-officer'],
          tasks: [
            'Generate compliance report',
            'Document exceptions',
            'Create audit logs',
            'Prepare evidence'
          ],
          outputs: ['compliance-report', 'audit-logs']
        }
      ],
      schedule: 'weekly',
      notifications: {
        onFailure: ['compliance-team', 'security-team'],
        onSuccess: ['project-manager']
      }
    };
  }

  /**
   * Create security workflow
   */
  async createSecurityWorkflow(profile, agents) {
    return {
      name: 'security-assessment',
      description: 'Security vulnerability assessment and remediation',
      trigger: ['scheduled', 'pre-deploy', 'security-alert'],
      agents: this.selectRelevantAgents(agents, ['security']),
      steps: [
        {
          id: 'vulnerability-scan',
          name: 'Vulnerability Scanning',
          agents: ['security-auditor'],
          tasks: [
            'Dependency scanning',
            'Container scanning',
            'Code vulnerability analysis',
            'Infrastructure scanning'
          ],
          tools: ['snyk', 'trivy', 'sonarqube']
        },
        {
          id: 'penetration-test',
          name: 'Penetration Testing',
          agents: ['security-engineer'],
          tasks: [
            'API penetration testing',
            'Authentication bypass attempts',
            'SQL injection testing',
            'XSS vulnerability testing'
          ]
        },
        {
          id: 'remediation',
          name: 'Vulnerability Remediation',
          agents: ['security-engineer', 'developer'],
          tasks: [
            'Patch vulnerabilities',
            'Update dependencies',
            'Fix security issues',
            'Validate fixes'
          ]
        },
        {
          id: 'verification',
          name: 'Security Verification',
          agents: ['security-auditor'],
          tasks: [
            'Re-scan for vulnerabilities',
            'Verify remediations',
            'Update security baseline',
            'Generate security report'
          ]
        }
      ],
      severity: {
        critical: {
          sla: '4 hours',
          escalation: 'immediate'
        },
        high: {
          sla: '24 hours',
          escalation: 'daily'
        },
        medium: {
          sla: '7 days',
          escalation: 'weekly'
        }
      }
    };
  }

  /**
   * Create tokenization workflow (for projects like Veria)
   */
  async createTokenizationWorkflow(profile, agents) {
    return {
      name: 'tokenization-workflow',
      description: 'Real-world asset tokenization process',
      trigger: ['manual', 'api-request'],
      agents: this.selectRelevantAgents(agents, ['blockchain', 'compliance', 'security']),
      steps: [
        {
          id: 'kyc-aml',
          name: 'KYC/AML Verification',
          agents: ['compliance-officer'],
          tasks: [
            'Identity verification',
            'AML screening',
            'Accreditation check',
            'Document validation'
          ],
          requirements: {
            'identity-verified': true,
            'aml-clear': true,
            'accreditation-valid': true
          }
        },
        {
          id: 'asset-validation',
          name: 'Asset Validation',
          agents: ['tokenization-specialist'],
          tasks: [
            'Asset ownership verification',
            'Valuation confirmation',
            'Legal review',
            'Compliance check'
          ]
        },
        {
          id: 'smart-contract',
          name: 'Smart Contract Deployment',
          agents: ['blockchain-developer'],
          tasks: [
            'Deploy token contract',
            'Set transfer restrictions',
            'Configure compliance rules',
            'Initialize token parameters'
          ],
          config: {
            'token-standard': 'ERC-1400',
            'transfer-restrictions': true,
            'compliance-enabled': true
          }
        },
        {
          id: 'token-minting',
          name: 'Token Minting',
          agents: ['tokenization-specialist'],
          tasks: [
            'Calculate token allocation',
            'Mint tokens',
            'Distribute to wallets',
            'Record on-chain'
          ]
        },
        {
          id: 'post-tokenization',
          name: 'Post-Tokenization',
          agents: ['compliance-officer'],
          tasks: [
            'Generate compliance report',
            'Update registry',
            'Send notifications',
            'Archive documentation'
          ]
        }
      ],
      compliance: {
        standards: ['SEC', 'MiCA', 'FINMA'],
        reporting: 'quarterly',
        audit: 'annual'
      }
    };
  }

  /**
   * Create performance workflow
   */
  async createPerformanceWorkflow(profile, agents) {
    return {
      name: 'performance-optimization',
      description: 'Performance analysis and optimization',
      trigger: ['scheduled', 'performance-alert', 'manual'],
      agents: this.selectRelevantAgents(agents, ['performance', 'architect', 'developer']),
      steps: [
        {
          id: 'profiling',
          name: 'Performance Profiling',
          agents: ['performance-engineer'],
          tasks: [
            'CPU profiling',
            'Memory profiling',
            'Network analysis',
            'Database query analysis'
          ],
          tools: ['profiler', 'apm', 'lighthouse']
        },
        {
          id: 'analysis',
          name: 'Bottleneck Analysis',
          agents: ['performance-engineer', 'architect'],
          tasks: [
            'Identify bottlenecks',
            'Analyze hot paths',
            'Review architecture impacts',
            'Prioritize optimizations'
          ]
        },
        {
          id: 'optimization',
          name: 'Implementation',
          agents: ['developer', 'performance-engineer'],
          tasks: [
            'Code optimization',
            'Query optimization',
            'Caching implementation',
            'Asset optimization'
          ]
        },
        {
          id: 'validation',
          name: 'Performance Validation',
          agents: ['performance-engineer'],
          tasks: [
            'Run benchmarks',
            'Compare metrics',
            'Validate improvements',
            'Generate report'
          ],
          metrics: {
            'improvement-target': '> 20%',
            'regression-tolerance': '< 5%'
          }
        }
      ],
      benchmarks: {
        'response-time': {
          p50: '< 100ms',
          p95: '< 500ms',
          p99: '< 1000ms'
        },
        'throughput': '> 1000 req/s',
        'error-rate': '< 0.1%'
      }
    };
  }

  /**
   * Create ML workflow
   */
  async createMLWorkflow(profile, agents) {
    return {
      name: 'ml-pipeline',
      description: 'Machine learning model development and deployment',
      trigger: ['data-update', 'scheduled', 'manual'],
      agents: this.selectRelevantAgents(agents, ['ml', 'data', 'devops']),
      steps: [
        {
          id: 'data-preparation',
          name: 'Data Preparation',
          agents: ['data-engineer'],
          tasks: [
            'Data collection',
            'Data cleaning',
            'Feature engineering',
            'Data validation'
          ]
        },
        {
          id: 'model-training',
          name: 'Model Training',
          agents: ['ml-engineer'],
          tasks: [
            'Hyperparameter tuning',
            'Model training',
            'Cross-validation',
            'Model evaluation'
          ],
          config: {
            'framework': profile.stack.frameworks.find(f => ['tensorflow', 'pytorch', 'sklearn'].includes(f)) || 'tensorflow'
          }
        },
        {
          id: 'model-validation',
          name: 'Model Validation',
          agents: ['ml-engineer', 'data-scientist'],
          tasks: [
            'Performance validation',
            'Bias detection',
            'Explainability analysis',
            'A/B test setup'
          ]
        },
        {
          id: 'deployment',
          name: 'Model Deployment',
          agents: ['devops-engineer', 'ml-engineer'],
          tasks: [
            'Model packaging',
            'API creation',
            'Deployment',
            'Monitoring setup'
          ]
        },
        {
          id: 'monitoring',
          name: 'Model Monitoring',
          agents: ['ml-engineer'],
          tasks: [
            'Performance monitoring',
            'Drift detection',
            'Feedback collection',
            'Retraining trigger'
          ]
        }
      ],
      mlops: {
        'experiment-tracking': 'mlflow',
        'model-registry': true,
        'auto-retraining': true,
        'drift-detection': true
      }
    };
  }

  /**
   * Select relevant agents for workflow
   */
  selectRelevantAgents(agents, keywords) {
    return agents.filter(agent =>
      keywords.some(keyword =>
        agent.name.toLowerCase().includes(keyword.toLowerCase())
      )
    );
  }

  /**
   * Save workflows to files
   */
  async saveWorkflows(workflows, projectPath) {
    const workflowsDir = path.join(projectPath, '.claude', 'workflows');
    await fs.mkdir(workflowsDir, { recursive: true });

    // Save each workflow
    for (const workflow of workflows) {
      const workflowPath = path.join(workflowsDir, `${workflow.name}.json`);
      await fs.writeFile(workflowPath, JSON.stringify(workflow, null, 2), 'utf8');
    }

    // Generate workflow documentation
    await this.generateWorkflowDocumentation(workflows, projectPath);

    // Generate workflow commands
    await this.generateWorkflowCommands(workflows, projectPath);

    return workflowsDir;
  }

  /**
   * Generate workflow documentation
   */
  async generateWorkflowDocumentation(workflows, projectPath) {
    const docs = [];

    docs.push('# Multi-Agent Workflows\n');
    docs.push('This project has the following automated workflows configured:\n');

    for (const workflow of workflows) {
      docs.push(`## ${workflow.name}\n`);
      docs.push(`**Description:** ${workflow.description}\n`);

      if (workflow.trigger) {
        docs.push(`**Triggers:** ${Array.isArray(workflow.trigger) ? workflow.trigger.join(', ') : workflow.trigger}\n`);
      }

      if (workflow.agents && workflow.agents.length > 0) {
        docs.push('**Participating Agents:**');
        workflow.agents.forEach(agent => {
          docs.push(`- ${agent.name}`);
        });
        docs.push('');
      }

      if (workflow.steps) {
        docs.push('**Steps:**');
        workflow.steps.forEach((step, index) => {
          docs.push(`${index + 1}. **${step.name}** (${step.id})`);
          if (step.tasks) {
            step.tasks.forEach(task => {
              docs.push(`   - ${task}`);
            });
          }
        });
        docs.push('');
      }

      docs.push('---\n');
    }

    const docsPath = path.join(projectPath, '.claude', 'workflows', 'README.md');
    await fs.writeFile(docsPath, docs.join('\n'), 'utf8');

    return docsPath;
  }

  /**
   * Generate workflow commands
   */
  async generateWorkflowCommands(workflows, projectPath) {
    const commands = [];

    commands.push('#!/bin/bash');
    commands.push('# Workflow execution commands\n');

    for (const workflow of workflows) {
      commands.push(`# Execute ${workflow.name}`);
      commands.push(`${workflow.name}() {`);
      commands.push(`  echo "Executing workflow: ${workflow.name}"`);
      commands.push(`  # Workflow execution logic here`);
      commands.push(`}\n`);
    }

    const commandsPath = path.join(projectPath, '.claude', 'workflows', 'commands.sh');
    await fs.writeFile(commandsPath, commands.join('\n'), { mode: 0o755 });

    return commandsPath;
  }
}

export default WorkflowOrchestrator;