# DevAssist MCP Documentation

## Overview

DevAssist is an intelligent Model Context Protocol (MCP) server that provides advanced development assistance through semantic search, knowledge management, and project intelligence.

## Version: 2.1.0

## Core Features

### 🧠 Semantic Search
- Uses MPNet embeddings (768 dimensions) for high-quality semantic matching
- Searches across code, decisions, and documentation
- 40-50% better accuracy than basic models

### 📋 Architectural Decision Records
- Track why decisions were made
- Link related decisions
- Search past decisions semantically

### 📈 Progress Tracking
- Monitor milestone progress
- Track blockers and issues
- Generate development summaries

### 💾 Knowledge Persistence
- Project-specific vector databases
- Session continuity between Claude restarts
- Terminal log preservation and analysis

### 🔒 Project Isolation
- Complete data isolation per project
- Separate databases for each project
- No cross-project data leakage

## Architecture

```
DevAssist MCP
├── SQLite Database (structured data)
│   ├── Projects
│   ├── Decisions
│   ├── Progress
│   └── Code Patterns
├── LanceDB (vector embeddings)
│   ├── Decision embeddings
│   ├── Code pattern embeddings
│   └── Documentation embeddings
└── Session Management
    ├── Terminal logs
    ├── Knowledge base
    └── Context bridging
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DEVASSIST_PROJECT` | Project name for isolation | `my-app` |
| `DEVASSIST_PROJECT_PATH` | Root path of project | `/Users/name/Projects/my-app` |
| `DEVASSIST_DATA_PATH` | Where to store data | `/Users/name/Projects/my-app/.devassist/data` |
| `DEVASSIST_KNOWLEDGE_PATH` | Knowledge storage | `/Users/name/Projects/my-app/.devassist/knowledge` |

## How It Works

1. **Initialization**: When DevAssist starts, it:
   - Initializes project-specific databases
   - Loads previous session context
   - Indexes existing documentation
   - Prepares embedding models

2. **During Development**: DevAssist:
   - Records architectural decisions
   - Tracks progress on milestones
   - Indexes code patterns
   - Maintains session context

3. **Knowledge Building**: Over time, DevAssist:
   - Learns project patterns
   - Builds semantic understanding
   - Creates knowledge graph
   - Improves search relevance

## Database Schema

### SQLite Tables
- `projects` - Project metadata
- `decisions` - Architectural decisions with embeddings
- `progress` - Milestone tracking
- `code_patterns` - Indexed code patterns
- `decision_relations` - Decision relationships

### Vector Tables (LanceDB)
- `decisions` - Decision text embeddings
- `code_patterns` - Code embeddings
- `documentation` - Doc embeddings

## Embedding Models

DevAssist supports multiple embedding models:

| Model | Dimensions | Quality | Speed | Use Case |
|-------|------------|---------|-------|----------|
| MiniLM | 384 | Good | Fast | Basic matching |
| **MPNet** | 768 | **Better** | **Medium** | **Default - best balance** |
| GTE-Small | 384 | Best | Slow | High accuracy needed |
| Multilingual | 384 | Good | Medium | Multi-language projects |

## Session Management

Sessions provide continuity between Claude conversations:

1. **Session Start**: Loads previous context
2. **During Session**: Tracks changes and decisions
3. **Session End**: Saves knowledge and context
4. **Next Session**: Bridges from previous work

## Best Practices

1. **Always Start Sessions**: Use `/session-start` to ensure context
2. **Record Decisions**: Document important choices
3. **Track Progress**: Update milestone status regularly
4. **End Properly**: Use `/session-end` to save knowledge

## Troubleshooting

### Database not initializing
- Check environment variables are set
- Ensure write permissions on data directory
- Verify Node.js >= 18

### Search not finding results
- Check embedding model is loaded
- Verify data is indexed
- Try broader search terms

### Project isolation issues
- Ensure unique `DEVASSIST_PROJECT` per project
- Check data paths are project-specific
- Restart after configuration changes

## Technical Details

- **Language**: Node.js (ES6 modules)
- **Databases**: SQLite3 + LanceDB
- **Embeddings**: Xenova/transformers
- **Protocol**: MCP over stdio
- **Dependencies**: See package.json

## Contributing

DevAssist is part of the Custom_MCP suite and is proprietary software.

---

*DevAssist MCP - Intelligence for your development workflow*
