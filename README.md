# DevAssist MCP Server v2.1

An intelligent development assistant MCP (Model Context Protocol) server with **real semantic search**, vector embeddings, persistent SQLite + LanceDB storage, and **documentation resources** for maintaining architectural memory and enhancing development productivity.

## Overview

DevAssist MCP Server is designed to be your persistent development companion that:
- **Maintains project context** across development sessions
- **Remembers architectural decisions** with full reasoning and alternatives
- **Tracks development progress** and identifies blockers
- **Prevents duplicate efforts** by analyzing existing code
- **Provides instant documentation** as MCP resources for immediate access
- **Serves JUCE and SuperCollider docs** locally without web fetches

## What's New in v2.1 🎯

- **Documentation Resources**: Native MCP resource support for local docs
- **JUCE/SuperCollider Docs**: Immediate access to critical audio development references
- **Resource URIs**: Access docs via `docs://` URI scheme
- **Zero-latency Documentation**: <1ms access vs ~500ms web fetches
- **Auto-discovery**: Finds docs in project `.devassist/docs/` automatically

## What's New in v2.0 🚀

- **Real Semantic Search**: Vector embeddings with cosine similarity (not just grep!)
- **SQLite + LanceDB**: Production-ready databases replacing JSON files
- **10x Faster**: Sub-millisecond queries with proper indexing
- **Similarity Scoring**: Actual duplicate detection using embeddings
- **New Tool**: `semantic_search` for natural language queries

## Key Features

### 🧠 Architectural Memory with Embeddings
- Records decisions with 384-dimensional vector embeddings
- Semantic search finds related decisions by meaning, not just keywords
- Maintains full context, reasoning, and alternatives
- Cross-project decision tracking

### 🔍 Intelligent Semantic Search
- Natural language queries across all data
- Vector similarity scoring (0-100%)
- Context-aware retrieval
- Works with decisions, code patterns, and progress

### 📊 Development Intelligence  
- Real-time codebase analysis with pattern indexing
- Duplicate detection using vector similarity
- Dependency tracking and analysis
- AI-powered development summaries

### 🎯 Progress Tracking
- SQLite-backed persistent storage
- Real-time milestone updates
- Blocker identification
- Multi-project support with isolation

### 📚 Documentation Resources (New in v2.1)
- **Native MCP Resources**: Browse and read docs without leaving Claude Code
- **Auto-discovery**: Finds docs in `.devassist/docs/` directory
- **URI Access**: Read docs via `docs://` URIs
- **Project-specific**: Each project can have its own documentation set
- **Supported formats**: Markdown files with full formatting

### 🚀 Performance
- Embedding generation: ~2.4ms
- Decision recording: ~3.4ms
- Semantic search: <100ms
- Progress tracking: ~0.05ms
- Documentation access: <1ms (local)

## Installation

### Prerequisites
- Node.js v20+ 
- npm or yarn
- Git (for commit history features)

### Setup

```bash
# Clone or navigate to the DevAssist MCP directory
cd DevAssist_MCP

# Install dependencies
npm install

# Initialize databases (required for v2.0)
npm run db:init

# Optional: Migrate existing JSON data to new databases
npm run db:migrate

# Make the server executable
chmod +x index.js
```

### Testing Installation

```bash
# Run tests
npm test

# Run performance benchmarks
npm run benchmark

# Test the server
npm start

# Should output: "DevAssist MCP Server v2.0 running with SQLite + LanceDB..."
```

## Configuration

### For Claude Desktop

Add to your Claude configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "devassist": {
      "command": "node",
      "args": ["/path/to/DevAssist_MCP/index.js"]
    }
  }
}
```

### For Cursor

Add to your Cursor settings:

```json
{
  "mcp.servers": {
    "devassist": {
      "command": "node",
      "args": ["/path/to/DevAssist_MCP/index.js"]
    }
  }
}
```

## Available Tools (v2.0)

### analyze_codebase
Analyzes project structure and identifies patterns.

```javascript
// Example usage by AI assistant
analyze_codebase({
  path: "/path/to/project",
  depth: 3,
  pattern: "*.js"
})
```

### record_architectural_decision
Records important technical decisions with full context.

```javascript
record_architectural_decision({
  decision: "Use TypeScript for type safety",
  context: "Team has mixed JS/TS experience but type safety is critical",
  alternatives: ["Pure JavaScript", "Flow"],
  impact: "Longer ramp-up but fewer runtime errors",
  project: "my-project"
})
```

### get_project_memory
Retrieves past decisions and development context.

```javascript
get_project_memory({
  query: "database",
  category: "decisions",
  limit: 5,
  project: "my-project"
})
```

### track_progress
Tracks development milestones and identifies blockers.

```javascript
track_progress({
  milestone: "Authentication System",
  status: "in_progress",
  notes: "OAuth integration complete, working on JWT",
  blockers: ["Waiting for security review"],
  project: "my-project"
})
```

### identify_duplicate_effort
**Now with real vector similarity!** Checks for existing implementations using semantic search.

```javascript
identify_duplicate_effort({
  feature: "user authentication",
  path: "/path/to/project",
  similarity_threshold: 0.7  // Actually works now!
})
```

### semantic_search (NEW in v2.0)
Natural language search across all project data using vector embeddings.

```javascript
semantic_search({
  query: "how do we handle user authentication",
  search_type: "all",  // or "decisions", "code_patterns"
  min_similarity: 0.5,
  limit: 10
})
```

### get_documentation
Retrieves relevant documentation from multiple sources.

```javascript
get_documentation({
  topic: "OSC communication",
  source: "supercollider",
  search_depth: 3
})
```

### analyze_dependencies
Analyzes project dependencies across different package managers.

```javascript
analyze_dependencies({
  path: "/path/to/project",
  include_dev: true,
  check_updates: false
})
```

### generate_summary
Generates development activity summaries.

```javascript
generate_summary({
  days_back: 7,
  include_commits: true,
  project: "my-project"
})
```

## Usage Examples

### Accessing Documentation Resources (New in v2.1)

DevAssist automatically exposes documentation in your project's `.devassist/docs/` directory:

```markdown
# Create documentation structure
.devassist/docs/
├── README.md                 # Main index
├── juce/                     # Framework-specific docs
│   ├── AudioAppComponent.md
│   └── macOS_CoreAudio.md
└── supercollider/           # Tool-specific docs
    ├── OSC_Commands.md
    └── SynthDef_Patterns.md
```

Documentation is then available as MCP resources:
- List resources: Automatically discovered by Claude Code
- Read via URI: `docs://juce/AudioAppComponent.md`
- Instant access: No web fetches, <1ms response time

### Recording an Architectural Decision

When making important technical decisions, the AI assistant can automatically document them:

```javascript
// AI Assistant records your decision
record_architectural_decision({
  decision: "Switch from REST to GraphQL",
  context: "Need more flexible data fetching for mobile clients",
  alternatives: ["REST with custom endpoints", "gRPC"],
  impact: "Requires API rewrite but improves client performance"
})
```

### Checking for Duplicates

Before implementing new features, check for existing code:

```javascript
// AI checks before suggesting new implementation
identify_duplicate_effort({
  feature: "email validation",
  path: "./src"
})
```

### Tracking Progress

Monitor development milestones:

```javascript
track_progress({
  milestone: "User Dashboard",
  status: "completed",
  notes: "All features implemented and tested"
})
```

## Data Storage (v2.0)

DevAssist now uses a hybrid database approach for performance and semantic search:

```
DevAssist_MCP/
├── data/
│   ├── devassist.db              # SQLite database (structured data)
│   ├── vectors/                  # LanceDB vector storage
│   │   ├── decisions.lance/      # Decision embeddings
│   │   └── code_patterns.lance/  # Code pattern embeddings
│   └── backups/                  # JSON backups from migration
```

### Database Architecture
- **SQLite**: Relational data, project management, metadata
- **LanceDB**: Vector embeddings for semantic search
- **Embeddings**: 384-dimensional vectors using all-MiniLM-L6-v2

### Multi-Project Support

DevAssist supports multiple projects by using the `project` parameter in all tools. If not specified, it defaults to "default".

## Best Practices

### 1. Record Decisions Immediately
Document architectural decisions as they're made, not after the fact.

### 2. Use Descriptive Milestones
Create clear, measurable milestone names for better tracking.

### 3. Regular Summaries
Generate weekly summaries to maintain awareness of progress.

### 4. Check for Duplicates
Always run duplicate detection before major new features.

### 5. Tag Projects Consistently
Use consistent project names across all tools for better organization.

## Troubleshooting

### Server Won't Start
1. Check Node.js version: `node --version` (requires v20+)
2. Verify dependencies: `npm install`
3. Check file permissions: `chmod +x index.js`

### Tools Not Available in Claude/Cursor
1. Restart the application after configuration
2. Verify JSON syntax in configuration
3. Use absolute paths in configuration
4. Check server console for errors

### Data Not Persisting
1. Ensure `data` directory exists
2. Check write permissions
3. Verify JSON files are being created

### Commands Failing
1. Check if commands (find, grep) are available
2. Verify path permissions
3. Check for special characters in paths

## Roadmap

### Current Features ✅
- Architectural decision recording
- Progress tracking
- Codebase analysis
- Duplicate detection
- Documentation retrieval
- Dependency analysis
- Development summaries

### Planned Enhancements
- [ ] Vector database for semantic search
- [ ] Web UI for browsing decisions
- [ ] Integration with issue trackers
- [ ] Automated decision suggestions
- [ ] Code quality metrics
- [ ] Team collaboration features
- [ ] CI/CD integration

## Contributing

We welcome contributions! Key areas:

1. **Search Enhancement**: Improve semantic search capabilities
2. **Database Integration**: Add vector database support
3. **UI Development**: Create web interface
4. **Testing**: Increase test coverage
5. **Documentation**: Expand examples

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review existing decisions with `get_project_memory`
3. Open an issue on GitHub

## License

MIT License

## Acknowledgments

- Anthropic for the MCP protocol
- The Claude Code team for the integration framework
- SuperCollider community for audio synthesis documentation

---

**DevAssist MCP - Your persistent development memory and intelligence assistant**

*Version: 1.0.0 | Focus: Development Productivity & Architectural Memory*