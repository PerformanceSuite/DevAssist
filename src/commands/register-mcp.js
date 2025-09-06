#!/usr/bin/env node

/**
 * Auto-register project MCP server with Claude Desktop
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export async function registerProjectMCP(projectName, projectPath) {
  const configPath = path.join(
    os.homedir(),
    'Library/Application Support/Claude/claude_desktop_config.json'
  );
  
  try {
    // Read current config
    const configContent = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configContent);
    
    // Add project-specific DevAssist server
    const serverKey = `${projectName.toLowerCase()}-devassist`;
    const serverPath = path.join(projectPath, '.devassist', `${projectName.toLowerCase()}-mcp-server.js`);
    
    config.mcpServers[serverKey] = {
      command: 'node',
      args: [serverPath]
    };
    
    // Write updated config
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    
    console.error(`✅ Registered ${projectName} DevAssist with Claude Desktop`);
    console.error(`   Server key: ${serverKey}`);
    console.error(`   Restart Claude Code to load project-specific commands`);
    
    return true;
  } catch (error) {
    console.error(`⚠️ Could not auto-register MCP server: ${error.message}`);
    console.error(`   Please manually add to Claude Desktop config`);
    return false;
  }
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const [,, projectName, projectPath] = process.argv;
  if (projectName && projectPath) {
    await registerProjectMCP(projectName, projectPath);
  }
}