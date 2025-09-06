#!/usr/bin/env node
import Database from 'better-sqlite3';
import * as lancedb from '@lancedb/lancedb';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..', '..');

// Ensure data directories exist
const DATA_DIR = path.join(ROOT_DIR, 'data');
const VECTOR_DIR = path.join(DATA_DIR, 'vectors');

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

if (!existsSync(VECTOR_DIR)) {
  mkdirSync(VECTOR_DIR, { recursive: true });
}

// SQLite database initialization
export function initSQLite() {
  const dbPath = path.join(DATA_DIR, 'devassist.db');
  const db = new Database(dbPath);
  
  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  
  // Create tables
  db.exec(`
    -- Projects table
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata JSON
    );

    -- Decisions table
    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    CREATE TABLE IF NOT EXISTS progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      milestone TEXT NOT NULL,
      status TEXT CHECK(status IN ('not_started', 'in_progress', 'testing', 'completed', 'blocked')),
      notes TEXT,
      blockers JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    -- Decision relationships table
    CREATE TABLE IF NOT EXISTS decision_relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      decision_id INTEGER NOT NULL,
      related_id INTEGER NOT NULL,
      relation_type TEXT CHECK(relation_type IN ('depends_on', 'conflicts_with', 'extends', 'replaces')),
      strength REAL DEFAULT 0.5,
      FOREIGN KEY (decision_id) REFERENCES decisions(id),
      FOREIGN KEY (related_id) REFERENCES decisions(id)
    );

    -- Code patterns table for duplicate detection
    CREATE TABLE IF NOT EXISTS code_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      pattern_hash TEXT UNIQUE NOT NULL,
      file_path TEXT NOT NULL,
      language TEXT,
      content TEXT,
      embedding_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    -- Create indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project_id);
    CREATE INDEX IF NOT EXISTS idx_decisions_embedding ON decisions(embedding_id);
    CREATE INDEX IF NOT EXISTS idx_progress_project ON progress(project_id);
    CREATE INDEX IF NOT EXISTS idx_progress_status ON progress(status);
    CREATE INDEX IF NOT EXISTS idx_patterns_project ON code_patterns(project_id);
    CREATE INDEX IF NOT EXISTS idx_patterns_embedding ON code_patterns(embedding_id);
    CREATE INDEX IF NOT EXISTS idx_relations_decision ON decision_relations(decision_id);
    CREATE INDEX IF NOT EXISTS idx_relations_related ON decision_relations(related_id);

    -- Create trigger to update progress.updated_at
    CREATE TRIGGER IF NOT EXISTS update_progress_timestamp 
    AFTER UPDATE ON progress
    FOR EACH ROW
    BEGIN
      UPDATE progress SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
  `);
  
  // console.log('✅ SQLite database initialized successfully');
  return db;
}

// LanceDB vector database initialization
export async function initVectorDB() {
  try {
    // Connect to LanceDB
    const db = await lancedb.connect(VECTOR_DIR);
    
    // Define schemas for our tables
    const decisionsSchema = [
      { name: 'id', type: 'string' },
      { name: 'project', type: 'string' },
      { name: 'text', type: 'string' },
      { name: 'embedding', type: 'float32[]' },
      { name: 'metadata', type: 'string' }
    ];
    
    const patternsSchema = [
      { name: 'id', type: 'string' },
      { name: 'project', type: 'string' },
      { name: 'file_path', type: 'string' },
      { name: 'content', type: 'string' },
      { name: 'embedding', type: 'float32[]' },
      { name: 'language', type: 'string' }
    ];
    
    // Create tables if they don't exist
    const tables = await db.tableNames();
    
    if (!tables.includes('decisions')) {
      // Create with empty data initially
      await db.createTable('decisions', [{
        id: 'init',
        project: 'default',
        text: 'Initial decision',
        embedding: new Array(384).fill(0), // Placeholder embedding
        metadata: '{}'
      }]);
      // console.log('✅ Created LanceDB table: decisions');
    }
    
    if (!tables.includes('code_patterns')) {
      await db.createTable('code_patterns', [{
        id: 'init',
        project: 'default',
        file_path: '/init',
        content: 'Initial pattern',
        embedding: new Array(384).fill(0), // Placeholder embedding
        language: 'unknown'
      }]);
      // console.log('✅ Created LanceDB table: code_patterns');
    }
    
    // console.log('✅ LanceDB initialized successfully');
    return db;
  } catch (error) {
    console.error('❌ LanceDB initialization error:', error);
    throw error;
  }
}

// Combined initialization
export async function initDatabases() {
  const sqlite = initSQLite();
  const vectordb = await initVectorDB();
  
  return { sqlite, vectordb };
}

// Run initialization if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initDatabases()
    .then(() => {
      // console.log('✅ All databases initialized successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Database initialization failed:', error);
      process.exit(1);
    });
}