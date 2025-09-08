/**
 * ProjectManager - Core component for multi-project isolation in DevAssist
 * Handles project context, isolation, and routing
 */

import path from 'path';
import fs from 'fs/promises';
import { createHash } from 'crypto';

export class ProjectManager {
  constructor(projectRoot = process.env.PROJECT_ROOT || '/Users/danielconnolly/Projects') {
    this.projectRoot = projectRoot;
    this.projects = new Map();
    this.currentProject = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    // Load existing projects
    await this.discoverProjects();
    
    // Detect current project from working directory
    this.currentProject = await this.detectCurrentProject();
    
    this.initialized = true;
    console.error(`[ProjectManager] Initialized with ${this.projects.size} projects`);
    if (this.currentProject) {
      console.error(`[ProjectManager] Current project: ${this.currentProject.name}`);
    }
  }

  async discoverProjects() {
    try {
      const entries = await fs.readdir(this.projectRoot, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const projectPath = path.join(this.projectRoot, entry.name);
          
          // Check if it's a valid project (has .git or package.json or .devassist)
          const hasGit = await this.fileExists(path.join(projectPath, '.git'));
          const hasPackageJson = await this.fileExists(path.join(projectPath, 'package.json'));
          const hasDevAssist = await this.fileExists(path.join(projectPath, '.devassist'));
          
          if (hasGit || hasPackageJson || hasDevAssist) {
            await this.registerProject(entry.name, projectPath);
          }
        }
      }
    } catch (error) {
      console.error('[ProjectManager] Error discovering projects:', error);
    }
  }

  async registerProject(name, projectPath, autoCreate = false) {
    if (this.projects.has(name)) {
      return this.projects.get(name);
    }

    const project = {
      name,
      path: projectPath,
      dataPath: path.join(projectPath, '.devassist', 'data'),
      sessionsPath: path.join(projectPath, '.devassist', 'sessions'),
      decisionsPath: path.join(projectPath, '.devassist', 'decisions'),
      vectorDbPath: path.join(projectPath, '.devassist', 'vectors'),
      config: {},
      metadata: {
        created: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
      },
      currentSession: null,
    };

    // Load project config if it exists
    const configPath = path.join(projectPath, '.devassist', 'config.json');
    if (await this.fileExists(configPath)) {
      try {
        project.config = JSON.parse(await fs.readFile(configPath, 'utf8'));
      } catch (e) {
        // Use defaults if config is corrupted
      }
    }

    // Only create directories if explicitly requested (like from /initproject)
    if (autoCreate) {
      await this.ensureProjectDirectories(project);
    }

    this.projects.set(name, project);
    console.error(`[ProjectManager] Registered project: ${name}`);
    
    return project;
  }

  async detectCurrentProject() {
    const cwd = process.cwd();
    
    // Check if we're inside a project directory
    if (cwd.startsWith(this.projectRoot)) {
      const relativePath = path.relative(this.projectRoot, cwd);
      const projectName = relativePath.split(path.sep)[0];
      
      if (projectName && this.projects.has(projectName)) {
        return this.projects.get(projectName);
      }
    }
    
    // Check if CWD itself is a project
    const cwdName = path.basename(cwd);
    if (this.projects.has(cwdName)) {
      return this.projects.get(cwdName);
    }
    
    return null;
  }

  async switchProject(projectName) {
    if (!this.projects.has(projectName)) {
      // Try to discover it
      const projectPath = path.join(this.projectRoot, projectName);
      if (await this.fileExists(projectPath)) {
        await this.registerProject(projectName, projectPath);
      } else {
        throw new Error(`Project not found: ${projectName}`);
      }
    }
    
    this.currentProject = this.projects.get(projectName);
    this.currentProject.metadata.lastAccessed = new Date().toISOString();
    
    console.error(`[ProjectManager] Switched to project: ${projectName}`);
    return this.currentProject;
  }

  getProject(nameOrPath) {
    // Try by name first
    if (this.projects.has(nameOrPath)) {
      return this.projects.get(nameOrPath);
    }
    
    // Try by path
    for (const project of this.projects.values()) {
      if (project.path === nameOrPath) {
        return project;
      }
    }
    
    return null;
  }

  getCurrentProject() {
    return this.currentProject;
  }

  parseProjectFromCommand(args) {
    // Check for explicit project specification
    // Formats: 
    //   - project:name
    //   - --project name
    //   - -p name
    
    if (args.project) {
      return args.project;
    }
    
    // Check for project:name format in any argument
    for (const key in args) {
      if (typeof args[key] === 'string' && args[key].startsWith('project:')) {
        return args[key].substring(8);
      }
    }
    
    return null;
  }

  async getProjectContext(commandName, args) {
    // Priority order:
    // 1. Explicit project in args
    // 2. Current project (from CWD)
    // 3. Default to null (cross-project command)
    
    const explicitProject = this.parseProjectFromCommand(args);
    if (explicitProject) {
      return await this.switchProject(explicitProject);
    }
    
    // Some commands should always be cross-project
    const crossProjectCommands = ['initproject', 'list_projects', 'search_all_projects'];
    if (crossProjectCommands.includes(commandName)) {
      return null;
    }
    
    return this.currentProject;
  }

  async ensureProjectDirectories(project) {
    const dirs = [
      project.dataPath,
      project.sessionsPath,
      project.decisionsPath,
      project.vectorDbPath,
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async saveProjectMetadata(project) {
    const metadataPath = path.join(project.path, '.devassist', 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(project.metadata, null, 2));
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // Get isolated data path for a specific feature
  getDataPath(project, feature) {
    if (!project) {
      // Cross-project data goes in main DevAssist directory
      return path.join(this.projectRoot, '.devassist-global', feature);
    }
    
    switch (feature) {
      case 'sessions':
        return project.sessionsPath;
      case 'decisions':
        return project.decisionsPath;
      case 'vectors':
        return project.vectorDbPath;
      default:
        return path.join(project.dataPath, feature);
    }
  }

  async listProjects() {
    const projectList = [];
    for (const [name, project] of this.projects) {
      const stats = await this.getProjectStats(project);
      projectList.push({
        name,
        path: project.path,
        current: project === this.currentProject,
        ...stats,
      });
    }
    return projectList;
  }

  async getProjectStats(project) {
    try {
      // Count sessions
      const sessionsDir = project.sessionsPath;
      let sessionCount = 0;
      try {
        const sessions = await fs.readdir(sessionsDir);
        sessionCount = sessions.filter(f => f.endsWith('.json')).length;
      } catch {}
      
      // Count decisions
      const decisionsDir = project.decisionsPath;
      let decisionCount = 0;
      try {
        const decisions = await fs.readdir(decisionsDir);
        decisionCount = decisions.filter(f => f.endsWith('.json')).length;
      } catch {}
      
      return {
        sessions: sessionCount,
        decisions: decisionCount,
        lastAccessed: project.metadata.lastAccessed,
      };
    } catch (error) {
      return {
        sessions: 0,
        decisions: 0,
        lastAccessed: project.metadata.lastAccessed,
      };
    }
  }
}

export default ProjectManager;
