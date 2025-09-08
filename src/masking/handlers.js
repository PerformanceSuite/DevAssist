/**
 * Handler Adapters for DevAssist Tool Masking
 * Wraps existing functionality with the masking layer
 */

import { InitProjectCommand } from '../commands/initproject.js';
import { ProjectManager } from '../project-manager.js';
import { SessionManager } from '../session/session-manager.js';
import path from 'path';

// Initialize managers
const projectManager = new ProjectManager();
await projectManager.initialize();

const sessionManagers = new Map();

async function getSessionManager(project) {
  if (!project) return null;
  
  if (!sessionManagers.has(project.name)) {
    const manager = new SessionManager();
    manager.setDataPath(projectManager.getDataPath(project, 'sessions'));
    sessionManagers.set(project.name, manager);
  }
  
  return sessionManagers.get(project.name);
}

/**
 * Initialize Project Handler
 */
export async function initproject_handler(input) {
  try {
    const initCommand = new InitProjectCommand();
    const result = await initCommand.execute({
      path: input.path || '.',
      skipDocumentation: input.skipDocumentation || false,
    });
    
    // Register the new project
    const projectPath = path.resolve(input.path || '.');
    const projectName = path.basename(projectPath);
    await projectManager.registerProject(projectName, projectPath, true);
    
    return {
      success: true,
      projectName,
      message: result,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Session Management Handler
 */
export async function session_handler(input) {
  const action = input.action;
  const project = await projectManager.getCurrentProject();
  
  if (!project) {
    return {
      success: false,
      error: 'No project detected. Please run from a project directory.',
    };
  }
  
  const sessionManager = await getSessionManager(project);
  
  switch (action) {
    case 'start': {
      const session = await sessionManager.startSession(input.description);
      return {
        sessionId: session.id,
        status: 'started',
        message: `Started session for ${project.name}: ${session.description}`,
      };
    }
    
    case 'checkpoint': {
      await sessionManager.createCheckpoint(input.summary);
      return {
        success: true,
        message: `Checkpoint saved: ${input.summary}`,
      };
    }
    
    case 'end': {
      const summary = await sessionManager.endSession();
      const sessionData = sessionManager.currentSession || {};
      
      return {
        summary,
        duration: sessionData.duration || 'unknown',
        checkpoints: sessionData.checkpoints?.length || 0,
      };
    }
    
    default:
      return {
        success: false,
        error: `Unknown session action: ${action}`,
      };
  }
}

/**
 * Status Handler
 */
export async function status_handler(input) {
  const project = await projectManager.getCurrentProject();
  
  if (!project) {
    return {
      project: null,
      session: null,
      metrics: {
        totalProjects: (await projectManager.listProjects()).length,
      },
    };
  }
  
  const sessionManager = await getSessionManager(project);
  const status = await sessionManager.getStatus();
  
  const result = {
    project: {
      name: project.name,
      path: project.path,
      sessions: project.sessions || 0,
      decisions: project.decisions || 0,
    },
    session: {
      active: sessionManager.currentSession !== null,
      status,
    },
    metrics: {
      totalProjects: (await projectManager.listProjects()).length,
      currentProject: project.name,
    },
  };
  
  if (input.verbose) {
    // Add more detailed information
    result.session.details = sessionManager.currentSession;
    result.project.lastModified = project.lastModified;
  }
  
  return result;
}

/**
 * Decision Recording Handler
 */
export async function decision_handler(input) {
  const project = await projectManager.getCurrentProject();
  
  if (!project) {
    return {
      success: false,
      error: 'No project detected. Please run from a project directory.',
    };
  }
  
  const decisionPath = projectManager.getDataPath(project, 'decisions');
  const decision = {
    id: Date.now().toString(),
    timestamp: input.timestamp || new Date().toISOString(),
    decision: input.decision,
    context: input.context,
    alternatives: input.alternatives || [],
    project: project.name,
    sessionId: input.sessionId,
  };
  
  const fs = await import('fs/promises');
  await fs.mkdir(decisionPath, { recursive: true });
  await fs.writeFile(
    path.join(decisionPath, `${decision.id}.json`),
    JSON.stringify(decision, null, 2)
  );
  
  return {
    id: decision.id,
    decision: decision.decision,
    recorded: true,
  };
}

// Helper function to process system variables and remapping in masks
export function processSystemVariables(value, input = {}, context = {}) {
  if (typeof value !== 'string') return value;
  
  // Handle remapping first ($REMAP:fieldname$)
  const remapMatch = value.match(/\$\$REMAP:(.+?)\$\$/);
  if (remapMatch) {
    const fieldName = remapMatch[1];
    return input[fieldName] || value;
  }
  
  // Then handle system variables
  return value
    .replace('$TIMESTAMP$', new Date().toISOString())
    .replace('$GENERATE_ID$', Date.now().toString())
    .replace('$CURRENT_SESSION$', context.sessionId || 'none')
    .replace('$PROJECT_NAME$', context.projectName || 'unknown');
}

// Export all handlers
export const handlers = {
  initproject_handler,
  session_handler,
  status_handler,
  decision_handler,
};
