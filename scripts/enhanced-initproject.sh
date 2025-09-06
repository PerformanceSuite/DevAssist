#!/bin/bash

# Enhanced initproject that creates project-specific MCP server

PROJECT_NAME="$1"
PROJECT_PATH="${2:-$(pwd)}"

if [ -z "$PROJECT_NAME" ]; then
  echo "Usage: initproject.sh <project_name> [project_path]"
  exit 1
fi

echo "🚀 Initializing ${PROJECT_NAME} with isolated DevAssist..."

# Create .devassist directory structure
mkdir -p "${PROJECT_PATH}/.devassist/agents"
mkdir -p "${PROJECT_PATH}/.devassist/data/sqlite"
mkdir -p "${PROJECT_PATH}/.devassist/data/vectors"
mkdir -p "${PROJECT_PATH}/.devassist/sessions"
mkdir -p "${PROJECT_PATH}/.devassist/terminal_logs"

# Create project-specific MCP server
cat > "${PROJECT_PATH}/.devassist/${PROJECT_NAME,,}-mcp-server.js" << 'EOF'
#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);
EOF

# Add project-specific configuration
cat >> "${PROJECT_PATH}/.devassist/${PROJECT_NAME,,}-mcp-server.js" << EOF

const PROJECT_NAME = '${PROJECT_NAME}';
const PROJECT_PATH = '${PROJECT_PATH}';

// Set up project isolation
process.env.DEVASSIST_PROJECT = PROJECT_NAME;
process.env.DEVASSIST_PROJECT_PATH = PROJECT_PATH;
process.env.DEVASSIST_DATA_PATH = path.join(PROJECT_PATH, '.devassist/data');
process.env.DEVASSIST_WARMUP_ENABLED = 'true';

// Create project-specific server
const server = new Server({
  name: '${PROJECT_NAME,,}-devassist',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

// Project-specific tools (become slash commands)
const tools = [
  {
    name: '${PROJECT_NAME,,}-start',
    description: 'Start ${PROJECT_NAME} session with warmup',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: '${PROJECT_NAME,,}-end',
    description: 'End ${PROJECT_NAME} session with cleanup',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: '${PROJECT_NAME,,}-status',
    description: 'Check ${PROJECT_NAME} project status',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;
  console.error(\`[${PROJECT_NAME} DevAssist] Executing: \${name}\`);
  
  // Delegate to main DevAssist with project isolation
  const devassistPath = '/Users/danielconnolly/Projects/Custom_MCP/DevAssist_MCP/index.js';
  
  switch (name) {
    case '${PROJECT_NAME,,}-start':
      await execAsync(\`node \${PROJECT_PATH}/.devassist/warmup.js\`).catch(() => {});
      return {
        content: [{
          type: 'text',
          text: '🔥 ${PROJECT_NAME} session started with warmup!',
        }],
      };
    
    case '${PROJECT_NAME,,}-end':
      await execAsync(\`node \${PROJECT_PATH}/.devassist/agents/cleanup.js\`).catch(() => {});
      return {
        content: [{
          type: 'text',
          text: '🏁 ${PROJECT_NAME} session ended with cleanup!',
        }],
      };
      
    default:
      return {
        content: [{
          type: 'text',
          text: \`${PROJECT_NAME} DevAssist: \${name}\`,
        }],
      };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

console.error(\`🚀 ${PROJECT_NAME} DevAssist Ready\`);
EOF

# Make it executable
chmod +x "${PROJECT_PATH}/.devassist/${PROJECT_NAME,,}-mcp-server.js"

# Update Claude Desktop config to use project-specific server
echo ""
echo "📝 Add this to your Claude Desktop config:"
echo ""
echo "  \"${PROJECT_NAME,,}-devassist\": {"
echo "    \"command\": \"node\","
echo "    \"args\": ["
echo "      \"${PROJECT_PATH}/.devassist/${PROJECT_NAME,,}-mcp-server.js\""
echo "    ]"
echo "  },"
echo ""
echo "✅ Project ${PROJECT_NAME} initialized with isolated DevAssist!"
echo ""
echo "Available commands after Claude restart:"
echo "  /${PROJECT_NAME,,}-start - Start session with warmup"
echo "  /${PROJECT_NAME,,}-end - End session with cleanup"
echo "  /${PROJECT_NAME,,}-status - Check project status"