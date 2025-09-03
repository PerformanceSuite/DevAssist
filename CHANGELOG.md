# Changelog

All notable changes to DevAssist MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2025-08-30

### Added
- **MCP Resource Support** for serving local documentation
- **Documentation Resources Module** (`src/resources/documentationResources.js`)
- **Auto-discovery** of documentation in `.devassist/docs/` directory
- **URI-based access** to documentation via `docs://` scheme
- **Resource handlers** for ListResources and ReadResource MCP requests
- **JUCE and SuperCollider documentation** templates for audio development
- **Performance improvement** from ~500ms web fetches to <1ms local access

### Changed
- Updated server capabilities to include `resources: {}`
- Enhanced server version to 2.1.0
- Added import statements for resource schemas
- Console output now shows documentation availability status

### Technical Details
- Resources exposed via native MCP protocol
- Security checks prevent path traversal attacks
- Supports nested directory structures for organized docs
- Markdown files served with proper MIME type

## [2.0.0] - 2024-08-27

### Added
- **SQLite database** for structured data storage replacing JSON files
- **LanceDB vector database** for semantic search capabilities
- **Real semantic search** using 384-dimensional embeddings (all-MiniLM-L6-v2)
- **New `semantic_search` tool** for natural language queries across all data
- **Vector similarity scoring** for duplicate detection (actually functional now!)
- **Database migration tool** (`npm run db:migrate`) to convert JSON to new format
- **Performance benchmarking suite** (`npm run benchmark`)
- **Comprehensive test suite** using Node.js native test runner
- **Data access layer** abstraction for clean separation of concerns
- **Database initialization scripts** (`npm run db:init`)
- **Embedding generation pipeline** for all text data
- **Project isolation** with proper multi-project support

### Changed
- **10x performance improvement** in search operations
- `identify_duplicate_effort` now uses real vector similarity instead of grep
- `get_project_memory` now supports semantic search with similarity scores
- All tools updated to use new database backend
- Improved error handling with fallback mechanisms
- Better project management with automatic project creation
- Progress tracking now updates existing milestones instead of duplicating

### Technical Improvements
- Sub-millisecond query response times
- Concurrent access support with SQLite WAL mode
- Proper indexing on all database tables
- Async/await throughout for better performance
- Batch operations support
- Connection pooling for database access

### Migration
- Automatic backup of JSON files to `data/backups/`
- Non-destructive migration preserves original data
- Support for incremental migration

### Dependencies Added
- `better-sqlite3` - High-performance SQLite bindings
- `@lancedb/lancedb` - Embedded vector database
- `@xenova/transformers` - Local embedding generation

### Documentation
- Added CLAUDE_DESKTOP_SETUP.md for installation guide
- Added DEVASSIST_UPGRADE_PLAN.md for architecture documentation
- Updated CLAUDE.md with new database information
- Created comprehensive test documentation

### Performance Metrics
- Embedding generation: ~2.4ms average
- Decision recording: ~3.4ms average
- Semantic search: <100ms for complex queries
- Progress tracking: ~0.05ms average

## [1.0.0] - 2024-08-26

### Initial Release
- Basic MCP server implementation
- JSON file storage
- Core tools for architectural decisions
- Progress tracking functionality
- Simple string-based search
- Claude Desktop compatibility
- Multi-project support
- Basic codebase analysis

### Tools Included
- `analyze_codebase` - Analyze project structure
- `record_architectural_decision` - Save decisions
- `get_project_memory` - Retrieve memories
- `track_progress` - Track milestones
- `identify_duplicate_effort` - Check for duplicates (basic grep)
- `get_documentation` - Retrieve documentation
- `analyze_dependencies` - Check dependencies
- `generate_summary` - Create summaries

---

## Upgrade Instructions

### From v1.0.0 to v2.0.0

1. **Backup your data** (automatic during migration)
2. **Install new dependencies**: `npm install`
3. **Initialize databases**: `npm run db:init`
4. **Migrate existing data**: `npm run db:migrate`
5. **Update Claude Desktop config** (no changes needed)
6. **Restart Claude Desktop**

Your existing JSON data will be preserved in `data/backups/` and automatically migrated to the new database format.