# DevAssist MCP Documentation

## 📚 Documentation Structure

### User Documentation
- **[README.md](../README.md)** - Project overview, installation, and usage
- **[CLAUDE_DESKTOP_SETUP.md](../CLAUDE_DESKTOP_SETUP.md)** - Step-by-step Claude Desktop installation
- **[CHANGELOG.md](../CHANGELOG.md)** - Version history and upgrade instructions

### Technical Documentation
- **[CLAUDE.md](../CLAUDE.md)** - Technical guide for Claude Code developers
- **[DEVASSIST_UPGRADE_PLAN.md](../DEVASSIST_UPGRADE_PLAN.md)** - Database architecture and implementation
- **[DEVASSIST_PRD.md](../DEVASSIST_PRD.md)** - Product requirements and specifications

### Analysis Documents
- **[DAGGER_ANALYSIS.md](../DAGGER_ANALYSIS.md)** - Evaluation of Dagger.io integration
- **[DOCUMENTATION_STATUS.md](../DOCUMENTATION_STATUS.md)** - Documentation coverage analysis

## 🚀 Quick Start

1. **Install DevAssist**: See [README.md](../README.md#installation)
2. **Configure Claude Desktop**: Follow [CLAUDE_DESKTOP_SETUP.md](../CLAUDE_DESKTOP_SETUP.md)
3. **Start using tools**: Check [Available Tools](../README.md#available-tools-v20)

## 🔧 For Developers

### Understanding the Architecture
1. Read [CLAUDE.md](../CLAUDE.md) for codebase overview
2. Review [DEVASSIST_UPGRADE_PLAN.md](../DEVASSIST_UPGRADE_PLAN.md) for database design
3. Check `src/database/dataAccess.js` for data layer API

### Running Tests
```bash
npm test          # Run test suite
npm run benchmark # Performance benchmarks
```

### Database Management
```bash
npm run db:init    # Initialize databases
npm run db:migrate # Migrate JSON to databases
npm run db:test    # Test with sample data
```

## 📊 Version 2.0 Highlights

### What Changed?
- JSON → SQLite + LanceDB
- String matching → Vector embeddings
- Linear search → Indexed queries
- Fake similarity → Real cosine similarity

### Performance Gains
- Search: 10x faster
- Memory usage: 50% less
- Query time: <100ms
- Concurrent access: Yes

### New Capabilities
- Semantic search across all data
- Real duplicate detection
- Vector similarity scoring
- Natural language queries

## 🎯 Key Features

### Semantic Search
The `semantic_search` tool enables natural language queries:
```javascript
// Find related decisions by meaning, not keywords
semantic_search({
  query: "how do we handle user data privacy",
  search_type: "decisions",
  min_similarity: 0.6
})
```

### Duplicate Detection
Real similarity scoring using embeddings:
```javascript
// Actually calculates vector similarity now!
identify_duplicate_effort({
  feature: "email validation",
  similarity_threshold: 0.7
})
```

### Project Memory
Semantic retrieval of past decisions:
```javascript
// Searches by meaning across decisions and progress
get_project_memory({
  query: "authentication approach",
  category: "all"
})
```

## 📈 Benchmarks

| Operation | Average Time | P95 |
|-----------|-------------|-----|
| Embedding Generation | 2.4ms | 1.5ms |
| Decision Recording | 3.4ms | 9.5ms |
| Semantic Search | <100ms | <150ms |
| Progress Tracking | 0.05ms | 0.06ms |

## 🛠️ Troubleshooting

### Common Issues
1. **Server not found**: Check path in Claude config is absolute
2. **Database errors**: Run `npm run db:init`
3. **Migration issues**: Check `data/backups/` for original files
4. **Search not working**: Ensure embeddings are generated

### Getting Help
1. Check [CLAUDE_DESKTOP_SETUP.md](../CLAUDE_DESKTOP_SETUP.md#troubleshooting)
2. Run validation: `node validate_all.js`
3. Review test output: `npm test`

## 📝 Contributing

Before contributing:
1. Read existing documentation
2. Run tests: `npm test`
3. Check benchmarks: `npm run benchmark`
4. Update relevant docs

## 🔗 Links

- [MCP Protocol Documentation](https://modelcontextprotocol.io)
- [LanceDB Documentation](https://lancedb.github.io/lancedb/)
- [SQLite Best Practices](https://sqlite.org/bestpractice.html)

---

**DevAssist MCP v2.0** - Your intelligent development companion with real semantic search