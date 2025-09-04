# DevAssist Configuration Guide

## Quick Start

DevAssist is configured through environment variables and configuration files. Each project gets its own isolated instance.

## Environment Variables

### Required Variables

```bash
# Project identification
export DEVASSIST_PROJECT="my-project-name"
export DEVASSIST_PROJECT_PATH="/path/to/project"

# Data storage (automatically set by init script)
export DEVASSIST_DATA_PATH="/path/to/project/.devassist/data"
export DEVASSIST_KNOWLEDGE_PATH="/path/to/project/.devassist/knowledge"
```

### Optional Variables

```bash
# Embedding model selection
export DEVASSIST_MODEL="mpnet"  # Options: minilm, mpnet, gte-small, multilingual

# Performance tuning
export DEVASSIST_MAX_RESULTS="20"
export DEVASSIST_SIMILARITY_THRESHOLD="0.6"

# Debug mode
export DEVASSIST_DEBUG="true"
```

## Configuration Files

### 1. Project Configuration
**Location**: `.devassist/config/devassist.json`

```json
{
  "version": "2.0.0",
  "project": "my-project",
  "projectPath": "/Users/name/Projects/my-project",
  "initialized": "2025-01-03T10:00:00Z",
  "paths": {
    "devassistMCP": "/Users/name/Projects/Custom_MCP/DevAssist_MCP",
    "dataPath": "/Users/name/Projects/my-project/.devassist/data",
    "knowledgePath": "/Users/name/Projects/my-project/.devassist/knowledge",
    "logsPath": "/Users/name/Projects/my-project/.devassist/terminal_logs"
  },
  "features": {
    "sessionManagement": true,
    "terminalLogging": true,
    "knowledgeBase": true,
    "semanticSearch": true,
    "architecturalDecisions": true,
    "progressTracking": true,
    "codePatternAnalysis": true
  },
  "indexing": {
    "includePatterns": ["**/*.{js,ts,jsx,tsx,py,rs,go,java,cpp,c,h,md,json,yaml,yml}"],
    "excludePatterns": ["node_modules/**", ".git/**", "dist/**", "build/**"],
    "autoIndex": true
  }
}
```

### 2. MCP Configuration
**Location**: `.mcp.json` (project root)

```json
{
  "mcpServers": {
    "devassist-my-project": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/project/.devassist/server.js"],
      "env": {
        "PROJECT_ROOT": "/path/to/project",
        "DEVASSIST_PROJECT": "my-project"
      }
    }
  }
}
```

### 3. Session Configuration
**Location**: `.sessions/config.json`

```json
{
  "autoSave": true,
  "saveInterval": 300,
  "maxSessions": 100,
  "terminalLogging": {
    "enabled": true,
    "maxLogSize": "10MB",
    "retention": "30d"
  }
}
```

## Embedding Models

### Model Comparison

| Model | Config Value | Dimensions | Speed | Quality | Best For |
|-------|-------------|------------|-------|---------|----------|
| MiniLM | `minilm` | 384 | Fast | Good | Quick searches |
| **MPNet** | `mpnet` | 768 | Medium | Better | **Default - recommended** |
| GTE-Small | `gte-small` | 384 | Slow | Best | High accuracy |
| Multilingual | `multilingual` | 384 | Medium | Good | Multi-language |

### Changing Models

```bash
# In your shell configuration
export DEVASSIST_MODEL="mpnet"

# Or in .devassist/config/devassist.json
{
  "embedding": {
    "model": "mpnet"
  }
}
```

## Project Structure

After initialization, your project will have:

```
your-project/
├── .devassist/
│   ├── config/
│   │   └── devassist.json      # Main configuration
│   ├── data/
│   │   ├── vectors/            # LanceDB vector database
│   │   └── devassist.db        # SQLite database
│   ├── docs/                   # Project documentation
│   ├── knowledge/              # Knowledge base
│   ├── scripts/
│   │   ├── session-manager.sh  # Session management
│   │   └── claude-project.sh   # Terminal logging
│   └── terminal_logs/          # Session recordings
├── .sessions/
│   ├── config.json            # Session configuration
│   ├── current.json           # Active session
│   └── session_*.json         # Historical sessions
└── .mcp.json                  # MCP server configuration
```

## Indexing Configuration

### File Patterns

Control what files are indexed:

```json
{
  "indexing": {
    "includePatterns": [
      "**/*.js",      // All JavaScript
      "src/**/*.ts",  // TypeScript in src
      "**/*.md",      // All markdown
      "!**/*.test.js" // Exclude tests
    ],
    "excludePatterns": [
      "node_modules/**",
      ".git/**",
      "dist/**",
      "coverage/**"
    ]
  }
}
```

### Auto-Indexing

Enable/disable automatic indexing:

```json
{
  "indexing": {
    "autoIndex": true,
    "indexOnStart": true,
    "indexInterval": 3600,  // seconds
    "incrementalIndex": true
  }
}
```

## Performance Tuning

### Memory Usage

```json
{
  "performance": {
    "maxMemory": "512MB",
    "cacheSize": "100MB",
    "batchSize": 50
  }
}
```

### Search Performance

```json
{
  "search": {
    "maxResults": 20,
    "defaultThreshold": 0.6,
    "timeout": 5000,
    "cache": true
  }
}
```

## Debugging

### Enable Debug Mode

```bash
export DEVASSIST_DEBUG=true
export DEVASSIST_LOG_LEVEL=debug
```

### Debug Output

```json
{
  "debug": {
    "enabled": true,
    "logLevel": "debug",
    "logFile": ".devassist/debug.log",
    "verbose": true
  }
}
```

## Multi-Project Setup

### Separate Configurations

Each project must have unique:
- `DEVASSIST_PROJECT` name
- Data paths
- MCP server instance

### Example Setup

```bash
# Project 1
cd ~/Projects/app1
export DEVASSIST_PROJECT="app1"
/initproject

# Project 2
cd ~/Projects/app2
export DEVASSIST_PROJECT="app2"
/initproject
```

## Backup and Recovery

### Backup Configuration

```json
{
  "backup": {
    "enabled": true,
    "schedule": "daily",
    "retention": 7,
    "path": "~/.devassist-backups"
  }
}
```

### Manual Backup

```bash
# Backup data
cp -r .devassist/data ~/.devassist-backups/$(date +%Y%m%d)

# Restore
cp -r ~/.devassist-backups/20250103/data .devassist/
```

## Troubleshooting

### Configuration Not Loading

1. Check environment variables:
```bash
env | grep DEVASSIST
```

2. Verify config file exists:
```bash
cat .devassist/config/devassist.json
```

3. Check file permissions:
```bash
ls -la .devassist/
```

### Database Issues

```bash
# Reset vector database
rm -rf .devassist/data/vectors
# Will rebuild on next start

# Check SQLite
sqlite3 .devassist/data/devassist.db ".tables"
```

---

*Keep configuration consistent across team members for best results*
