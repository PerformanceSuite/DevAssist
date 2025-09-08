#!/usr/bin/env node

/**
 * Isolated Project MCP Server Template
 * This server is COMPLETELY INDEPENDENT from main DevAssist
 * No imports, no conflicts, pure isolation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';

const execAsync = promisify(exec);

// Project configuration (will be replaced during setup)
const PROJECT_NAME = '{{PROJECT_NAME}}';
const PROJECT_PATH = '{{PROJECT_PATH}}';
const PROJECT_PORT = {{PROJECT_PORT}}; // For future TCP/IPC communication

class IsolatedProjectServer {
  constructor() {
    this.server = new Server({
      name: `${PROJECT_NAME}-isolated`,
      version: '1.0.0',
    }, {
      capabilities: { tools: {} },
    });
    
    this.projectData = {
      sessions: [],
      decisions: [],
      context: {},
    };
    
    this.dataPath = path.join(PROJECT_PATH, '.devassist', 'isolated-data.json');
    this.setupServer();
  }
  
  async loadData() {
    try {
      const data = await fs.readFile(this.dataPath, 'utf8');
      this.projectData = JSON.parse(data);
    } catch (e) {
      // First run, no data yet
    }
  }
  
  async saveData() {
    await fs.mkdir(path.dirname(this.dataPath), { recursive: true });
    await fs.writeFile(this.dataPath, JSON.stringify(this.projectData, null, 2));
  }
  
  setupServer() {
    // Define project-specific tools with clear namespacing
    const tools = [
      {
        name: `${PROJECT_NAME}-start`,
        description: `Start ${PROJECT_NAME} development session`,
        inputSchema: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'Session description' }
          }
        },
      },
      {
        name: `${PROJECT_NAME}-status`,
        description: `Check ${PROJECT_NAME} project status`,
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: `${PROJECT_NAME}-checkpoint`,
        description: `Save ${PROJECT_NAME} progress checkpoint`,
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Checkpoint message' }
          },
          required: ['message']
        },
      },
      {
        name: `${PROJECT_NAME}-end`,
        description: `End ${PROJECT_NAME} session with summary`,
        inputSchema: { type: 'object', properties: {} },
      },
    ];
    
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
    
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      await this.loadData();
      
      switch (name) {
        case `${PROJECT_NAME}-start`: {
          const session = {
            id: createHash('md5').update(Date.now().toString()).digest('hex').slice(0, 8),
            startTime: new Date().toISOString(),
            description: args.description || 'Development session',
            checkpoints: [],
          };
          
          this.projectData.sessions.push(session);
          this.projectData.currentSession = session.id;
          await this.saveData();
          
          return {
            content: [{
              type: 'text',
              text: `✅ Started ${PROJECT_NAME} session: ${session.id}
Description: ${session.description}
Time: ${new Date().toLocaleString()}

Session tracking active. Use checkpoint command to save progress.`
            }]
          };
        }
        
        case `${PROJECT_NAME}-status`: {
          const current = this.projectData.sessions.find(
            s => s.id === this.projectData.currentSession
          );
          
          if (!current) {
            return {
              content: [{
                type: 'text',
                text: `No active session for ${PROJECT_NAME}. Start one with ${PROJECT_NAME}-start command.`
              }]
            };
          }
          
          const duration = Math.round(
            (Date.now() - new Date(current.startTime).getTime()) / 1000 / 60
          );
          
          return {
            content: [{
              type: 'text',
              text: `📊 ${PROJECT_NAME} Status:
Session: ${current.id}
Duration: ${duration} minutes
Checkpoints: ${current.checkpoints.length}
Description: ${current.description}`
            }]
          };
        }
        
        case `${PROJECT_NAME}-checkpoint`: {
          const current = this.projectData.sessions.find(
            s => s.id === this.projectData.currentSession
          );
          
          if (!current) {
            return {
              content: [{
                type: 'text',
                text: `No active session. Start one first with ${PROJECT_NAME}-start.`
              }]
            };
          }
          
          const checkpoint = {
            time: new Date().toISOString(),
            message: args.message,
          };
          
          current.checkpoints.push(checkpoint);
          await this.saveData();
          
          return {
            content: [{
              type: 'text',
              text: `✅ Checkpoint saved: ${args.message}`
            }]
          };
        }
        
        case `${PROJECT_NAME}-end`: {
          const current = this.projectData.sessions.find(
            s => s.id === this.projectData.currentSession
          );
          
          if (!current) {
            return {
              content: [{
                type: 'text',
                text: `No active session to end.`
              }]
            };
          }
          
          current.endTime = new Date().toISOString();
          const duration = Math.round(
            (new Date(current.endTime) - new Date(current.startTime)) / 1000 / 60
          );
          
          this.projectData.currentSession = null;
          await this.saveData();
          
          return {
            content: [{
              type: 'text',
              text: `🏁 Session ${current.id} ended!
Duration: ${duration} minutes
Checkpoints: ${current.checkpoints.length}

Summary:
${current.checkpoints.map(c => `• ${c.message}`).join('\n')}`
            }]
          };
        }
        
        default:
          return {
            content: [{
              type: 'text',
              text: `Unknown command: ${name}`
            }]
          };
      }
    });
  }
  
  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`🚀 ${PROJECT_NAME} Isolated Server Running (Port reserved: ${PROJECT_PORT})`);
  }
}

// Start the server
const server = new IsolatedProjectServer();
server.start().catch(console.error);
