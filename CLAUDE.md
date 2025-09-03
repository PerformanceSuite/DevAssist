# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DevAssist MCP Server is a Model Context Protocol (MCP) server that provides development assistance tools including architectural decision recording, codebase analysis, progress tracking, and documentation retrieval. It's designed to maintain project context across sessions and prevent duplicate development efforts.

## Key Architecture

### Core Structure
- **index.js**: Main MCP server implementation using @modelcontextprotocol/sdk
- **data/**: Directory for persistent JSON storage of decisions and progress
- ES6 module structure (type: "module" in package.json)
- Uses Node.js child_process for system commands (find, grep, wc)

### Available MCP Tools
The server exposes 8 development assistance tools:
- `analyze_codebase`: Analyzes project structure and patterns
- `record_architectural_decision`: Records decisions with full context
- `get_project_memory`: Retrieves past decisions and context
- `track_progress`: Tracks development milestones
- `identify_duplicate_effort`: Checks for existing implementations
- `get_documentation`: Retrieves documentation from multiple sources
- `analyze_dependencies`: Analyzes project dependencies
- `generate_summary`: Creates development activity summaries

### Data Persistence
- JSON file storage in `data/` directory
- Format: `{project}_{type}.json` (e.g., `default_decisions.json`)
- Multi-project support via project parameter

## Development Commands

### Running the Server
```bash
# Start the MCP server
npm start
# or
node index.js

# Test server functionality
node index.js
```

### Installing Dependencies
```bash
npm install
```

### File Permissions
```bash
# Make server executable
chmod +x index.js
```

## Important Implementation Details

### Tool Implementation Pattern
Each tool follows this structure:
1. Input validation using defined schemas
2. Execute system commands or file operations
3. Process and format results
4. Return structured MCP response

### Error Handling
- All system commands wrapped in try-catch blocks
- Graceful fallbacks for missing dependencies
- Detailed error messages for debugging

### System Command Dependencies
The server uses these system commands:
- `find`: For file discovery in codebase analysis
- `grep`: For searching code patterns
- `wc`: For line counting
- `git`: For commit history (optional)

### Current Data Storage (JSON)
Decision records contain:
- timestamp
- decision
- context
- alternatives (array)
- impact
- project

Progress records contain:
- timestamp
- milestone
- status
- notes
- blockers (array)
- project

### New Database Architecture (Implemented)
**Status: Phase 1 Complete - Foundation and Vector Search operational**

Current architecture includes:
- **LanceDB**: Embedded vector database for semantic search (no external server required)
- **SQLite**: Structured data and relationships with WAL mode for concurrency
- **Hybrid approach**: Combining vector search with SQL queries
- **Embedding generation**: Using Xenova/all-MiniLM-L6-v2 for 384-dim embeddings
- **Actual similarity scoring**: Real semantic search replacing placeholder grep implementation

### Database Commands
```bash
# Initialize databases
npm run db:init

# Migrate existing JSON data
npm run db:migrate

# Test with sample data
npm run db:test
```

### Data Access Layer
Located in `src/database/dataAccess.js`:
- `recordDecision()`: Store decisions with embeddings
- `trackProgress()`: Track project milestones
- `semanticSearch()`: Vector similarity search
- `getProjectMemory()`: Hybrid search combining SQL and vectors
- `identifyDuplicates()`: Real similarity-based duplicate detection

## Testing Approach

Currently no automated tests. Manual testing via:
1. Direct execution: `node index.js`
2. Integration testing through Claude Desktop or Cursor
3. Tool invocation testing via MCP client

## Configuration for AI Tools

### Claude Desktop
Path: `~/Library/Application Support/Claude/claude_desktop_config.json`

### Cursor
Add to Cursor settings under `mcp.servers`

Both require absolute path to index.js in configuration.