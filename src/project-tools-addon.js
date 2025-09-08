// Add this to DevAssist MCP's tool definitions
// This goes in the server setup section of index.js

import { projectManager } from './src/project-management.js';

// Project Management Tools (replacing need for Prjctzr)
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    // ========== PROJECT MANAGEMENT TOOLS ==========
    case 'create_project': {
      console.error(`[DevAssist] Creating project: ${args.name}`);
      return await projectManager.createProject(args);
    }
    
    case 'list_projects': {
      console.error('[DevAssist] Listing projects');
      return await projectManager.listProjects(args.filter);
    }
    
    case 'get_project_info': {
      console.error(`[DevAssist] Getting info for project: ${args.name}`);
      return await projectManager.getProjectInfo(args.name);
    }
    
    case 'register_project': {
      console.error(`[DevAssist] Registering existing project: ${args.name}`);
      const projectPath = args.path || process.cwd();
      const projectType = args.type || await projectManager.detectProjectType(projectPath);
      
      await projectManager.registerProject({
        name: args.name,
        type: projectType,
        path: projectPath,
        createdAt: new Date().toISOString()
      });
      
      if (args.initDevAssist) {
        await projectManager.initializeDevAssist(projectPath, args.name, projectType);
      }
      
      return {
        success: true,
        message: `Project ${args.name} registered`,
        type: projectType,
        path: projectPath
      };
    }
    
    // ========== EXISTING DEVASSIST TOOLS ==========
    // ... rest of existing tools ...
  }
});

// Tool definitions for listing
const projectManagementTools = [
  {
    name: 'create_project',
    description: 'Create a new project with DevAssist management',
    inputSchema: {
      type: 'object',
      properties: {
        name: { 
          type: 'string', 
          description: 'Project name' 
        },
        type: { 
          type: 'string', 
          enum: ['nextjs', 'react', 'node', 'python', 'go', 'rust', 'unknown'],
          description: 'Project type/framework' 
        },
        basePath: { 
          type: 'string', 
          description: 'Base directory for project (optional)' 
        },
        template: { 
          type: 'string', 
          description: 'Template to use (optional)' 
        }
      },
      required: ['name', 'type']
    }
  },
  {
    name: 'list_projects',
    description: 'List all projects managed by DevAssist',
    inputSchema: {
      type: 'object',
      properties: {
        filter: { 
          type: 'string', 
          description: 'Optional filter for project names or types' 
        }
      }
    }
  },
  {
    name: 'get_project_info',
    description: 'Get detailed information about a specific project',
    inputSchema: {
      type: 'object',
      properties: {
        name: { 
          type: 'string', 
          description: 'Project name' 
        }
      },
      required: ['name']
    }
  },
  {
    name: 'register_project',
    description: 'Register an existing project with DevAssist',
    inputSchema: {
      type: 'object',
      properties: {
        name: { 
          type: 'string', 
          description: 'Project name' 
        },
        type: { 
          type: 'string', 
          description: 'Project type (auto-detected if not provided)' 
        },
        path: { 
          type: 'string', 
          description: 'Project path (current directory if not provided)' 
        },
        initDevAssist: { 
          type: 'boolean', 
          description: 'Initialize DevAssist structure' 
        }
      },
      required: ['name']
    }
  }
];
