# DevAssist MCP Server - Database Upgrade & Implementation Plan

## Executive Summary

DevAssist currently uses JSON file storage without any semantic search capabilities. This plan outlines upgrading to a vector database with embeddings for intelligent search and retrieval.

## Current State

### Storage
- **Database:** Plain JSON files in `data/` directory
- **Format:** `{project}_{type}.json` files
- **Search:** Basic string matching using `grep` and JavaScript `.includes()`
- **Limitations:**
  - No semantic understanding
  - No similarity matching
  - Linear search complexity
  - No concurrent access control
  - No query optimization

### Missing Capabilities
- Vector embeddings for semantic search
- Similarity scoring for duplicate detection
- Relational queries across decisions
- Full-text search with ranking
- Incremental indexing

## Proposed Architecture

### Recommended Solution: ChromaDB + SQLite Hybrid

#### Why This Combination?
1. **ChromaDB** handles vector embeddings and semantic search
2. **SQLite** manages structured data and relationships
3. **Local-first** approach perfect for MCP servers
4. **No external dependencies** like Docker or cloud services

### Architecture Components

```
┌─────────────────────────────────────────┐
│          MCP Client (Claude/Cursor)      │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         DevAssist MCP Server             │
│  ┌────────────────────────────────────┐  │
│  │        Tool Handlers                │  │
│  └─────────────┬──────────────────────┘  │
│                │                          │
│  ┌─────────────▼──────────────────────┐  │
│  │      Data Access Layer              │  │
│  │  ┌──────────┐  ┌────────────────┐  │  │
│  │  │Embeddings│  │Query Processor │  │  │
│  │  │Generator │  │                │  │  │
│  │  └──────────┘  └────────────────┘  │  │
│  └─────────┬──────────┬───────────────┘  │
│            │          │                   │
│  ┌─────────▼─────┐ ┌─▼───────────────┐  │
│  │   ChromaDB    │ │     SQLite      │  │
│  │  (Vectors)    │ │  (Structured)   │  │
│  └───────────────┘ └─────────────────┘  │
└──────────────────────────────────────────┘
```

## Implementation Status ✅

### Phase 1: Foundation (COMPLETE)
- ✅ Set up SQLite for structured data
- ✅ Migrate JSON data to SQLite tables
- ✅ Create data access layer abstraction
- ✅ Add database connection management
- ✅ Implement basic CRUD operations

### Phase 2: Vector Search (COMPLETE)
- ✅ Integrate LanceDB (better than ChromaDB - no server required)
- ✅ Add local embeddings generation (Xenova/all-MiniLM-L6-v2)
- ✅ Create embedding pipeline for decisions
- ✅ Implement semantic search endpoints
- ✅ Add real similarity scoring

### Phase 3: Core Features (COMPLETE)
- ✅ Automatic duplicate detection with scoring
- ✅ Semantic search across all data types
- ✅ Performance benchmarking suite
- ✅ Comprehensive test coverage
- ✅ MCP tools updated to use new database

### Phase 4: Intelligence Layer (Future)
- [ ] Pattern recognition in decisions
- [ ] Trend analysis over time
- [ ] Automated insights generation
- [ ] Proactive recommendations
- [ ] Decision conflict detection

## Database Schema

### SQLite Tables

```sql
-- Projects table
CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata JSON
);

-- Decisions table
CREATE TABLE decisions (
    id INTEGER PRIMARY KEY,
    project_id INTEGER,
    decision TEXT NOT NULL,
    context TEXT,
    impact TEXT,
    alternatives JSON,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    embedding_id TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Progress table
CREATE TABLE progress (
    id INTEGER PRIMARY KEY,
    project_id INTEGER,
    milestone TEXT NOT NULL,
    status TEXT,
    notes TEXT,
    blockers JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Decision relationships
CREATE TABLE decision_relations (
    id INTEGER PRIMARY KEY,
    decision_id INTEGER,
    related_id INTEGER,
    relation_type TEXT,
    strength FLOAT,
    FOREIGN KEY (decision_id) REFERENCES decisions(id),
    FOREIGN KEY (related_id) REFERENCES decisions(id)
);
```

### ChromaDB Collections

```javascript
// Decision embeddings collection
{
  name: "decisions",
  metadata: {
    project: "project_name",
    type: "architectural_decision"
  },
  embeddings: [...], // 1536-dim vector
  documents: "decision + context text",
  ids: "decision_id_from_sqlite"
}

// Code pattern collection
{
  name: "code_patterns",
  metadata: {
    file_path: "/path/to/file",
    language: "javascript"
  },
  embeddings: [...],
  documents: "code snippet",
  ids: "pattern_hash"
}
```

## API Changes

### New Tool: `semantic_search`
```javascript
{
  name: 'semantic_search',
  description: 'Search using natural language across all project data',
  inputSchema: {
    query: 'string',
    search_type: ['decisions', 'code', 'all'],
    min_similarity: 'number (0-1)',
    limit: 'number'
  }
}
```

### Enhanced: `identify_duplicate_effort`
```javascript
// Now with actual similarity scoring
{
  feature: 'authentication system',
  similarity_threshold: 0.8  // Actually functional
}
// Returns:
{
  duplicates: [
    { 
      content: "User auth module",
      similarity: 0.92,
      location: "src/auth.js"
    }
  ]
}
```

## Dependencies to Add

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.17.4",
    "zod": "^3.24.1",
    "better-sqlite3": "^11.0.0",
    "chromadb": "^1.8.0",
    "openai": "^4.0.0",
    "@xenova/transformers": "^2.0.0"
  }
}
```

## Migration Strategy

### Step 1: Parallel Running
1. Keep JSON files as backup
2. Dual-write to both systems
3. Compare results for validation

### Step 2: Data Migration
```javascript
// Migration script
async function migrateToNewDB() {
  // 1. Read all JSON files
  // 2. Insert into SQLite
  // 3. Generate embeddings
  // 4. Store in ChromaDB
  // 5. Verify data integrity
}
```

### Step 3: Cutover
1. Switch reads to new system
2. Monitor for issues
3. Keep JSON export capability
4. Archive old JSON files

## Configuration Updates

### New Environment Variables
```bash
# Embedding model configuration
EMBEDDING_MODEL="local" # or "openai"
OPENAI_API_KEY="sk-..." # if using OpenAI

# Database paths
SQLITE_DB_PATH="./data/devassist.db"
CHROMA_PERSIST_PATH="./data/chroma"

# Performance tuning
EMBEDDING_BATCH_SIZE=100
CACHE_TTL_SECONDS=3600
```

## Testing Strategy

### Unit Tests
- Data access layer operations
- Embedding generation
- Similarity calculations
- Migration scripts

### Integration Tests
- Full tool execution paths
- Database transactions
- Search accuracy
- Performance benchmarks

### Test Data
- Generate synthetic decisions
- Create test projects
- Measure search relevance
- Validate duplicate detection

## Performance Targets

- **Search latency:** < 100ms for semantic search
- **Embedding generation:** < 500ms per decision
- **Duplicate detection:** < 2s for full codebase scan
- **Memory usage:** < 500MB for typical project
- **Concurrent operations:** Support 10+ parallel requests

## Risk Mitigation

### Data Loss Prevention
- Automated backups before migration
- Incremental migration approach
- Rollback procedures
- Data validation checks

### Performance Issues
- Implement caching layer
- Batch embedding operations
- Optimize query patterns
- Monitor resource usage

### Compatibility
- Maintain backward compatibility
- Version migration paths
- Export to JSON capability
- Import from legacy format

## Success Metrics

1. **Search Quality:** 90%+ relevant results in top 5
2. **Performance:** 10x faster duplicate detection
3. **Storage Efficiency:** 50% reduction in storage size
4. **User Satisfaction:** Reduced false positives in duplicate detection
5. **System Reliability:** 99.9% uptime for local operations

## Next Steps

1. **Immediate:** Review and approve this plan
2. **Week 1:** Set up development environment with new dependencies
3. **Week 2:** Implement Phase 1 (Foundation)
4. **Week 3:** Deploy Phase 2 (Vector Search)
5. **Month 2:** Complete all phases and migration

## Appendix: Alternative Approaches

### Option A: Pure Vector Database (Weaviate)
- Pros: Single system, powerful search
- Cons: Requires Docker, more complex

### Option B: PostgreSQL + pgvector
- Pros: Full SQL power, single database
- Cons: Requires PostgreSQL installation

### Option C: Cloud Solution (Pinecone/Supabase)
- Pros: Fully managed, scalable
- Cons: Internet dependency, costs, privacy concerns

## Resources

- [ChromaDB Documentation](https://docs.trychroma.com)
- [SQLite Best Practices](https://sqlite.org/bestpractice.html)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [MCP SDK Documentation](https://modelcontextprotocol.io)