#!/usr/bin/env node

/**
 * DevAssist MCP Server - With Tool Masking Layer
 * Provides optimized tool surfaces for better Claude integration
 */

console.error('[DevAssist] Starting DevAssist MCP Server with Tool Masking...');

// Monitor parent process (Claude Code) and exit if it dies
if (process.ppid) {
  setInterval(() => {
    try {
      process.kill(process.ppid, 0);
    } catch (e) {
      console.error('[DevAssist] Parent process (Claude Code) has died, exiting...');
      process.exit(0);
    }
  }, 5000);
}

// Handle stdin closure
process.stdin.on('end', () => {
  console.error('[DevAssist] stdin closed (Claude Code disconnected), exiting...');
  process.exit(0);
});

process.stdin.on('error', () => {
  console.error('[DevAssist] stdin error (Claude Code disconnected), exiting...');
  process.exit(0);
});

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import { maskingEngine } from './src/masking/engine.js';
import { handlers, processSystemVariables } from './src/masking/handlers.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create server
const server = new Server({
  name: 'devassist-masked',
  version: '4.0.0',
}, {
  capabilities: { tools: {} },
});

// Initialize the masking engine
async function initialize() {
  console.error('[DevAssist] Initializing tool masking layer...');
  
  // Register all handlers
  for (const [name, handler] of Object.entries(handlers)) {
    maskingEngine.registerHandler(name, handler);
  }
  
  // Load mask definitions
  const masksDir = path.join(__dirname, 'masks');
  await maskingEngine.loadMasksFromDirectory(masksDir);
  
  console.error(`[DevAssist] Loaded ${maskingEngine.masks.size} tool masks`);
  
  // Set up request handlers with masked tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const maskedTools = maskingEngine.getMaskedTools();
    console.error(`[DevAssist] Providing ${maskedTools.length} masked tools to Claude`);
    return { tools: maskedTools };
  });
  
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    console.error(`[DevAssist] Tool called: ${name}`);
    
    // Process system variables in input
    const processedArgs = {};
    for (const [key, value] of Object.entries(args || {})) {
      processedArgs[key] = processSystemVariables(value, {
        projectName: process.env.PROJECT_NAME,
        sessionId: process.env.SESSION_ID,
      });
    }
    
    // Execute through masking engine
    const result = await maskingEngine.execute(name, processedArgs);
    
    if (result.success) {
      console.error(`[DevAssist] Tool ${name} succeeded in ${result.meta.latency}ms`);
      return {
        content: [{
          type: 'text',
          text: typeof result.data === 'string' 
            ? result.data 
            : JSON.stringify(result.data, null, 2),
        }],
      };
    } else {
      console.error(`[DevAssist] Tool ${name} failed: ${result.error}`);
      return {
        content: [{
          type: 'text',
          text: `❌ Error: ${result.error}`,
        }],
        isError: true,
      };
    }
  });
  
  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Show metrics periodically
  setInterval(() => {
    const metrics = maskingEngine.getMetrics();
    console.error(`[DevAssist Metrics] Calls: ${metrics.calls}, Success: ${metrics.successRate}, Tokens Saved: ${metrics.tokensSaved}, Avg Latency: ${metrics.avgLatency.toFixed(2)}ms`);
  }, 60000); // Every minute
  
  console.error('[DevAssist] Server ready with tool masking enabled');
  console.error('[DevAssist] Benefits: Simplified tool surfaces, reduced tokens, better accuracy');
}

// Start the server
initialize().catch(console.error);
