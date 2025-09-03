# Claude Desktop Installation Guide for DevAssist MCP Server

## Prerequisites

1. **Claude Desktop** installed on your system
2. **Node.js v20+** installed
3. **Git** (optional, for cloning)

## Installation Steps

### Step 1: Setup DevAssist MCP Server

```bash
# Clone or download DevAssist to a permanent location
cd ~/Projects  # Or your preferred directory
git clone [repository-url] DevAssist_MCP
# OR extract the DevAssist_MCP folder

# Navigate to the directory
cd DevAssist_MCP

# Install dependencies
npm install

# Initialize databases (one-time setup)
npm run db:init

# Optional: Migrate any existing JSON data
npm run db:migrate
```

### Step 2: Configure Claude Desktop

1. **Find your Claude Desktop configuration file:**

   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. **Edit the configuration file** (create it if it doesn't exist):

```json
{
  "mcpServers": {
    "devassist": {
      "command": "node",
      "args": ["/Users/danielconnolly/Projects/DevAssist_MCP/index.js"],
      "env": {}
    }
  }
}
```

**IMPORTANT**: Replace `/Users/danielconnolly/Projects/DevAssist_MCP` with YOUR actual absolute path to the DevAssist_MCP directory.

### Step 3: Verify Installation

1. **Restart Claude Desktop** completely (quit and reopen)

2. **Test the tools** - In a new conversation, you should be able to use:
   - `record_architectural_decision` - Record design decisions
   - `get_project_memory` - Retrieve past decisions with semantic search
   - `track_progress` - Track project milestones
   - `identify_duplicate_effort` - Find similar code patterns
   - `semantic_search` - Natural language search across all data
   - `analyze_codebase` - Analyze project structure
   - `generate_summary` - Get development summaries

3. **Verify it's working** by asking Claude:
   ```
   "Can you check what DevAssist tools are available?"
   ```

## Example Configuration Files

### macOS Example
```json
{
  "mcpServers": {
    "devassist": {
      "command": "node",
      "args": ["/Users/yourusername/Projects/DevAssist_MCP/index.js"],
      "env": {}
    }
  }
}
```

### Windows Example
```json
{
  "mcpServers": {
    "devassist": {
      "command": "node",
      "args": ["C:\\Users\\yourusername\\Projects\\DevAssist_MCP\\index.js"],
      "env": {}
    }
  }
}
```

### Linux Example
```json
{
  "mcpServers": {
    "devassist": {
      "command": "node",
      "args": ["/home/yourusername/Projects/DevAssist_MCP/index.js"],
      "env": {}
    }
  }
}
```

## Multiple MCP Servers

If you have other MCP servers, add DevAssist alongside them:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/yourusername/Documents"]
    },
    "devassist": {
      "command": "node",
      "args": ["/Users/yourusername/Projects/DevAssist_MCP/index.js"],
      "env": {}
    }
  }
}
```

## Troubleshooting

### Server Not Available in Claude

1. **Check the configuration file** is valid JSON (use a JSON validator)
2. **Verify the path** to index.js is absolute and correct
3. **Restart Claude Desktop** completely
4. **Check Node.js** is in your PATH: `node --version`

### Database Errors

```bash
# Reinitialize databases
cd /path/to/DevAssist_MCP
npm run db:init

# Check database files exist
ls -la data/
# Should show: devassist.db and vectors/ directory
```

### Test Server Manually

```bash
# Test if server starts
cd /path/to/DevAssist_MCP
npm start

# Should output:
# DevAssist MCP Server v2.0 running with SQLite + LanceDB...
# (Press Ctrl+C to stop)
```

### View Server Logs

In Claude Desktop, server errors may appear in the developer console:
- **macOS**: View → Developer → Developer Tools
- **Windows/Linux**: Help → Toggle Developer Tools

## Available Tools

Once installed, you can use these tools in Claude Desktop:

| Tool | Description |
|------|------------|
| `record_architectural_decision` | Record design decisions with context and reasoning |
| `get_project_memory` | Retrieve decisions and progress with semantic search |
| `track_progress` | Track milestones and development status |
| `identify_duplicate_effort` | Find similar code using vector similarity |
| `semantic_search` | Natural language search across all data |
| `analyze_codebase` | Analyze project structure and patterns |
| `analyze_dependencies` | Check project dependencies |
| `generate_summary` | Get development activity summaries |

## Quick Test Commands

After installation, try these in Claude Desktop:

1. **Record a decision:**
   "Record an architectural decision: We're using React for the frontend because the team knows it well"

2. **Search memories:**
   "Search project memory for anything about frontend frameworks"

3. **Track progress:**
   "Track progress: Authentication system is completed"

4. **Semantic search:**
   "Use semantic search to find anything about user authentication"

## Data Storage

Your data is stored locally in:
- **SQLite Database**: `DevAssist_MCP/data/devassist.db`
- **Vector Embeddings**: `DevAssist_MCP/data/vectors/`
- **Backups**: `DevAssist_MCP/data/backups/`

## Updating DevAssist

To update to a new version:

```bash
cd /path/to/DevAssist_MCP
git pull  # If using git
npm install  # Update dependencies
npm run db:migrate  # Migrate any data changes
```

Then restart Claude Desktop.

## Support

- Check `CLAUDE.md` for technical details
- Run `npm test` to verify installation
- Run `npm run benchmark` to test performance

---

**Ready to use!** Once configured, DevAssist will maintain your architectural decisions, track progress, and provide semantic search across all your development data.