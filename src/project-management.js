// Project Management Module for DevAssist
// Replaces the need for separate Prjctzr MCP

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ProjectManager {
  constructor(projectsRoot = process.env.PROJECT_ROOT || path.join(process.env.HOME, 'Projects')) {
    this.projectsRoot = projectsRoot;
    this.projectsFile = path.join(projectsRoot, '.devassist-projects.json');
  }

  async ensureProjectsFile() {
    try {
      await fs.access(this.projectsFile);
    } catch {
      await fs.writeFile(this.projectsFile, JSON.stringify({ 
        projects: [],
        version: "2.0"
      }, null, 2));
    }
  }

  async createProject(params) {
    const { name, type, basePath, template } = params;
    const projectPath = path.join(basePath || this.projectsRoot, name);
    
    // Create project directory
    await fs.mkdir(projectPath, { recursive: true });
    
    // Initialize based on type
    switch(type) {
      case 'nextjs':
        await execAsync(`cd "${projectPath}" && npx create-next-app@latest . --typescript --tailwind --app --no-git --yes`);
        break;
      case 'react':
        await execAsync(`cd "${projectPath}" && npx create-react-app . --template typescript`);
        break;
      case 'node':
        await execAsync(`cd "${projectPath}" && npm init -y`);
        break;
      case 'python':
        await fs.writeFile(path.join(projectPath, 'requirements.txt'), '');
        await fs.writeFile(path.join(projectPath, 'README.md'), `# ${name}\n\nPython project created with DevAssist`);
        break;
      default:
        // Just create basic structure
        await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });
        await fs.writeFile(path.join(projectPath, 'README.md'), `# ${name}\n\nProject created with DevAssist`);
    }
    
    // Initialize DevAssist structure
    await this.initializeDevAssist(projectPath, name, type);
    
    // Register project
    await this.registerProject({
      name,
      type,
      path: projectPath,
      createdAt: new Date().toISOString()
    });
    
    return {
      success: true,
      message: `Project ${name} created successfully`,
      path: projectPath,
      type,
      nextSteps: [
        `cd ${projectPath}`,
        'Restart Claude Code to load DevAssist for this project',
        `/start-${name}-session to begin development`
      ]
    };
  }

  async initializeDevAssist(projectPath, projectName, projectType) {
    // Create DevAssist structure
    const devassistDir = path.join(projectPath, '.devassist');
    
    // Create all directories
    const dirs = [
      path.join(devassistDir, 'data'),
      path.join(devassistDir, 'knowledge'),
      path.join(devassistDir, 'docs'),
      path.join(devassistDir, 'scripts'),
      path.join(devassistDir, 'terminal_logs'),
      path.join(devassistDir, 'warmup'),
      path.join(projectPath, '.sessions'),
      path.join(projectPath, '.claude', 'commands')
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
    
    // Initialize knowledge base
    const knowledgeFiles = {
      'decisions.json': { decisions: [], last_updated: new Date().toISOString() },
      'patterns.json': { patterns: [], last_updated: new Date().toISOString() },
      'lessons.json': { lessons: [], last_updated: new Date().toISOString() },
      'progress.json': { progress: [], last_updated: new Date().toISOString() }
    };
    
    for (const [filename, content] of Object.entries(knowledgeFiles)) {
      await fs.writeFile(
        path.join(devassistDir, 'knowledge', filename),
        JSON.stringify(content, null, 2)
      );
    }
    
    // Create project metadata
    const projectMeta = {
      name: projectName,
      type: projectType,
      path: projectPath,
      createdAt: new Date().toISOString(),
      devassist: {
        version: "2.0",
        initialized: true,
        features: {
          projectManagement: true,
          sessionManagement: true,
          knowledgeBase: true,
          codeAnalysis: true,
          semanticSearch: true
        }
      }
    };
    
    await fs.writeFile(
      path.join(devassistDir, 'project.json'),
      JSON.stringify(projectMeta, null, 2)
    );
    
    // Create session commands
    await this.createSessionCommands(projectPath, projectName, projectType);
  }

  async createSessionCommands(projectPath, projectName, projectType) {
    const commandsDir = path.join(projectPath, '.claude', 'commands');
    
    // Start session command
    const startCommand = `#!/usr/bin/env bash
echo "Starting DevAssist session for ${projectName}"
echo "Type: ${projectType}"
echo ""
echo "Execute these DevAssist commands:"
echo "1. devassist:session-start { \\"project\\": \\"${projectName}\\" }"
echo "2. devassist:analyze_codebase { \\"path\\": \\".\\" }"
echo "3. devassist:get_project_memory"
echo "4. Generate contextual next steps"
`;
    
    await fs.writeFile(
      path.join(commandsDir, `start-${projectName}-session.md`),
      startCommand
    );
    
    // Other commands...
    const commands = {
      [`check-${projectName}-session.md`]: `#!/usr/bin/env bash\necho "Check status: devassist:session-status"`,
      [`sprint-${projectName}.md`]: `#!/usr/bin/env bash\necho "Sprint check: devassist:sprint-check"`,
      [`end-${projectName}-session.md`]: `#!/usr/bin/env bash\necho "End session: devassist:session-end"`
    };
    
    for (const [filename, content] of Object.entries(commands)) {
      await fs.writeFile(path.join(commandsDir, filename), content);
    }
  }

  async listProjects(filter = null) {
    await this.ensureProjectsFile();
    const data = JSON.parse(await fs.readFile(this.projectsFile, 'utf-8'));
    let projects = data.projects || [];
    
    if (filter) {
      projects = projects.filter(p => 
        p.name.toLowerCase().includes(filter.toLowerCase()) ||
        p.type.toLowerCase().includes(filter.toLowerCase())
      );
    }
    
    return {
      success: true,
      projects,
      count: projects.length,
      projectsRoot: this.projectsRoot
    };
  }

  async getProjectInfo(name) {
    await this.ensureProjectsFile();
    const data = JSON.parse(await fs.readFile(this.projectsFile, 'utf-8'));
    const project = data.projects.find(p => p.name === name);
    
    if (!project) {
      return { 
        success: false, 
        error: `Project ${name} not found` 
      };
    }
    
    // Check if DevAssist is initialized
    const devassistPath = path.join(project.path, '.devassist', 'project.json');
    let devassistInfo = null;
    
    try {
      devassistInfo = JSON.parse(await fs.readFile(devassistPath, 'utf-8'));
    } catch {
      // DevAssist not initialized
    }
    
    return {
      success: true,
      project: {
        ...project,
        devassist: devassistInfo
      }
    };
  }

  async registerProject(projectData) {
    await this.ensureProjectsFile();
    const data = JSON.parse(await fs.readFile(this.projectsFile, 'utf-8'));
    
    // Check if project already exists
    const existingIndex = data.projects.findIndex(p => p.name === projectData.name);
    
    if (existingIndex >= 0) {
      // Update existing
      data.projects[existingIndex] = {
        ...data.projects[existingIndex],
        ...projectData,
        updatedAt: new Date().toISOString()
      };
    } else {
      // Add new
      data.projects.push(projectData);
    }
    
    await fs.writeFile(this.projectsFile, JSON.stringify(data, null, 2));
    
    return { success: true };
  }

  async detectProjectType(projectPath) {
    // Check for various project indicators
    const checks = [
      { file: 'package.json', type: async (content) => {
        const pkg = JSON.parse(content);
        if (pkg.dependencies?.next || pkg.devDependencies?.next) return 'nextjs';
        if (pkg.dependencies?.react || pkg.devDependencies?.react) return 'react';
        if (pkg.dependencies?.vue || pkg.devDependencies?.vue) return 'vue';
        return 'node';
      }},
      { file: 'Cargo.toml', type: 'rust' },
      { file: 'go.mod', type: 'go' },
      { file: 'requirements.txt', type: 'python' },
      { file: 'setup.py', type: 'python' },
      { file: 'composer.json', type: 'php' },
      { file: 'pom.xml', type: 'java' },
      { file: 'build.gradle', type: 'java' }
    ];
    
    for (const check of checks) {
      try {
        const filePath = path.join(projectPath, check.file);
        const content = await fs.readFile(filePath, 'utf-8');
        
        if (typeof check.type === 'function') {
          return await check.type(content);
        }
        return check.type;
      } catch {
        // File doesn't exist, try next
      }
    }
    
    return 'unknown';
  }
}

// Export singleton instance
export const projectManager = new ProjectManager();
