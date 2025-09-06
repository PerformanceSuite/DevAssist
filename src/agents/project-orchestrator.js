import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Project Orchestrator - Master agent that coordinates all subagents
 */
class ProjectOrchestrator {
  constructor() {
    this.subagents = new Map();
    this.projectContext = {};
    this.sessionState = {};
  }

  /**
   * Initialize session management
   */
  async initializeSessionManagement(projectPath) {
    // Session management is now handled by DevAssist's session manager
    // But we'll add hooks for our orchestration system
    return true;
  }

  /**
   * Analyze project to determine requirements
   */
  async analyzeProject(projectPath) {
    const analysis = {
      hasTests: false,
      hasDocs: false,
      hasCI: false,
      techStack: [],
      fileCount: 0
    };
    
    try {
      const files = await fs.readdir(projectPath);
      analysis.fileCount = files.length;
      analysis.hasTests = files.includes('tests') || files.includes('test');
      analysis.hasDocs = files.includes('docs') || files.includes('documentation');
      analysis.hasCI = files.includes('.github') || files.includes('.gitlab-ci.yml');
      
      if (files.includes('package.json')) analysis.techStack.push('Node.js');
      if (files.includes('requirements.txt')) analysis.techStack.push('Python');
      if (files.includes('Cargo.toml')) analysis.techStack.push('Rust');
    } catch (error) {
      console.error('Analysis error:', error);
    }
    
    return analysis;
  }

  /**
   * Initialize project with orchestration
   */
  async initProject(projectPath, options = {}) {
    const result = {
      subagents: [],
      documentation: [],
      success: true
    };
    
    // Create .devassist directory structure
    const devassistPath = path.join(projectPath, '.devassist');
    await fs.mkdir(devassistPath, { recursive: true });
    await fs.mkdir(path.join(devassistPath, 'agents'), { recursive: true });
    await fs.mkdir(path.join(devassistPath, 'data'), { recursive: true });
    await fs.mkdir(path.join(devassistPath, 'logs'), { recursive: true });
    
    // Save orchestrator state
    await this.saveSessionState(projectPath);
    
    result.subagents = ['cleanup', 'documentation', 'testing'];
    result.documentation = ['README', 'ARCHITECTURE'];
    
    return result;
  }

  /**
   * Generate project tree for documentation
   */
  async generateProjectTree(projectPath) {
    try {
      const { stdout } = await execAsync(
        `find "${projectPath}" -type d -name node_modules -prune -o -type d -print | head -20 | sed 's|${projectPath}|.|g'`,
        { cwd: projectPath }
      );
      return stdout || 'Project structure';
    } catch {
      return 'Project structure';
    }
  }

  /**
   * Generate agent architecture documentation
   */
  generateAgentArchitecture() {
    const agents = Array.from(this.subagents.entries());
    return agents.map(([type, agent]) => 
      `#### ${agent.name}\n- Type: ${type}\n- Priority: ${agent.priority}\n- Auto-run: ${agent.autoRun || false}`
    ).join('\n\n');
  }

  /**
   * Generate tech stack based on project
   */
  async generateTechStack(projectPath) {
    const stack = [];
    const files = await fs.readdir(projectPath).catch(() => []);
    
    if (files.includes('package.json')) stack.push('- Node.js/JavaScript');
    if (files.includes('requirements.txt')) stack.push('- Python');
    if (files.includes('Cargo.toml')) stack.push('- Rust');
    if (files.includes('go.mod')) stack.push('- Go');
    if (files.includes('docker-compose.yml')) stack.push('- Docker');
    
    return stack.join('\n') || '- To be determined';
  }

  /**
   * Generate agent API documentation
   */
  generateAgentAPIs() {
    return Array.from(this.subagents.entries()).map(([type, agent]) => 
      `### ${agent.name}\n\`\`\`javascript\nawait runAgent('${type}', context);\n\`\`\``
    ).join('\n\n');
  }

  /**
   * Save session state for the orchestrator
   */
  async saveSessionState(projectPath) {
    const state = {
      timestamp: new Date().toISOString(),
      project: projectPath,
      subagents: Array.from(this.subagents.keys()),
      status: 'saved'
    };
    
    const statePath = path.join(projectPath, '.devassist/orchestrator-state.json');
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
    return state;
  }

  /**
   * Archive session logs
   */
  async archiveSessionLogs(projectPath) {
    const logsPath = path.join(projectPath, '.devassist/logs');
    const archivePath = path.join(projectPath, '.devassist/logs/archive');
    
    await fs.mkdir(archivePath, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const files = await fs.readdir(logsPath).catch(() => []);
    
    for (const file of files) {
      if (!file.includes('archive') && file.endsWith('.log')) {
        const src = path.join(logsPath, file);
        const dest = path.join(archivePath, `${timestamp}-${file}`);
        await fs.rename(src, dest).catch(() => {});
      }
    }
  }

  /**
   * Generate session report
   */
  async generateSessionReport(projectPath) {
    const report = {
      timestamp: new Date().toISOString(),
      project: path.basename(projectPath),
      subagentsRun: [],
      filesModified: 0,
      tasksCompleted: 0
    };
    
    // Try to get git stats
    try {
      const { stdout } = await execAsync('git diff --stat', { cwd: projectPath });
      const lines = stdout.split('\n');
      const lastLine = lines[lines.length - 2] || '';
      const match = lastLine.match(/(\d+) files? changed/);
      if (match) report.filesModified = parseInt(match[1]);
    } catch {}
    
    return `Session Report:
- Project: ${report.project}
- Time: ${report.timestamp}
- Files modified: ${report.filesModified}
- Cleanup: Complete`;
  }
}

// Export for use in DevAssist
export { ProjectOrchestrator };
export default ProjectOrchestrator;