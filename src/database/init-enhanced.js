#!/usr/bin/env node
/**
 * Enhanced Database Initialization with Project Isolation
 * Ensures complete data separation between projects
 */

import Database from 'better-sqlite3';
import * as lancedb from '@lancedb/lancedb';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get project-specific paths from environment
 */
function getProjectPaths() {
  const projectName = process.env.DEVASSIST_PROJECT || 'default';
  const projectPath = process.env.DEVASSIST_PROJECT_PATH || process.cwd();
  
  // Use environment variable if set, otherwise use project-specific path
  const dataPath = process.env.DEVASSIST_DATA_PATH || 
                   path.join(projectPath, '.devassist', 'data');
  
  // Create project-specific subdirectories
  const paths = {
    projectName,
    projectPath,
    dataDir: dataPath,
    sqliteDir: path.join(dataPath, 'sqlite'),
    vectorDir: path.join(dataPath, 'vectors', projectName),
    sqlitePath: path.join(dataPath, 'sqlite', `${projectName}.db`),
    knowledgePath: process.env.DEVASSIST_KNOWLEDGE_PATH || 
                   path.join(projectPath, '.devassist', 'knowledge')
  };
  
  // Validate isolation
  if (!paths.vectorDir.includes(projectName) && projectName !== 'default') {
    console.warn(`⚠️  Vector DB path doesn't include project name: ${paths.vectorDir}`);
  }
  
  return paths;
}

/**
 * Ensure all required directories exist
 */
function ensureDirectories(paths) {
  const dirs = [
    paths.dataDir,
    paths.sqliteDir,
    paths.vectorDir,
    paths.knowledgePath
  ];
  
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      // // console.log(`✅ Created directory: ${dir}`);
    }
  }
}

/**
 * Initialize SQLite with project isolation
 */
export function initSQLite(paths) {
  const dbPath = paths.sqlitePath;
  // // console.log(`Initializing SQLite for project: ${paths.projectName}`);
  // // console.log(`Database path: ${dbPath}`);
  
  const db = new Database(dbPath);
  
  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  
  // Create tables with project awareness
  db.exec(`
    -- Projects table (for multi-project awareness)
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata JSON
    );

    -- Decisions table with project isolation
    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      project_name TEXT DEFAULT '${paths.projectName}',
      decision TEXT NOT NULL,
      context TEXT,
      impact TEXT,
      alternatives JSON,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      embedding_id TEXT,
      session_id TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    -- Progress table with project isolation
    CREATE TABLE IF NOT EXISTS progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      project_name TEXT DEFAULT '${paths.projectName}',
      milestone TEXT NOT NULL,
      status TEXT CHECK(status IN ('not_started', 'in_progress', 'testing', 'completed', 'blocked')),
      notes TEXT,
      blockers JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      session_id TEXT,
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

    -- Code patterns table with project isolation
    CREATE TABLE IF NOT EXISTS code_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      project_name TEXT DEFAULT '${paths.projectName}',
      pattern_hash TEXT UNIQUE NOT NULL,
      file_path TEXT NOT NULL,
      language TEXT,
      content TEXT,
      embedding_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      session_id TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    
    -- Sessions table for continuity
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_name TEXT DEFAULT '${paths.projectName}',
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      terminal_log TEXT,
      knowledge_items INTEGER DEFAULT 0,
      decisions_made INTEGER DEFAULT 0,
      git_branch TEXT,
      metadata JSON
    );
    
    -- Documentation index table
    CREATE TABLE IF NOT EXISTS documentation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT DEFAULT '${paths.projectName}',
      title TEXT NOT NULL,
      path TEXT NOT NULL,
      source TEXT,
      content TEXT,
      embedding_id TEXT,
      indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata JSON
    );

    -- Create indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project_name);
    CREATE INDEX IF NOT EXISTS idx_decisions_embedding ON decisions(embedding_id);
    CREATE INDEX IF NOT EXISTS idx_decisions_session ON decisions(session_id);
    CREATE INDEX IF NOT EXISTS idx_progress_project ON progress(project_name);
    CREATE INDEX IF NOT EXISTS idx_progress_status ON progress(status);
    CREATE INDEX IF NOT EXISTS idx_patterns_project ON code_patterns(project_name);
    CREATE INDEX IF NOT EXISTS idx_patterns_embedding ON code_patterns(embedding_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_name);
    CREATE INDEX IF NOT EXISTS idx_documentation_project ON documentation(project_name);
    CREATE INDEX IF NOT EXISTS idx_relations_decision ON decision_relations(decision_id);
    CREATE INDEX IF NOT EXISTS idx_relations_related ON decision_relations(related_id);

    -- Create trigger to update progress.updated_at
    CREATE TRIGGER IF NOT EXISTS update_progress_timestamp 
    AFTER UPDATE ON progress
    FOR EACH ROW
    BEGIN
      UPDATE progress SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
    
    -- Create trigger to update project last_accessed
    CREATE TRIGGER IF NOT EXISTS update_project_access_on_decision
    AFTER INSERT ON decisions
    FOR EACH ROW
    BEGIN
      UPDATE projects SET last_accessed = CURRENT_TIMESTAMP 
      WHERE name = NEW.project_name;
    END;
    
    CREATE TRIGGER IF NOT EXISTS update_project_access_on_progress
    AFTER INSERT ON progress
    FOR EACH ROW
    BEGIN
      UPDATE projects SET last_accessed = CURRENT_TIMESTAMP 
      WHERE name = NEW.project_name;
    END;
  `);
  
  // Ensure current project exists in projects table
  const insertProject = db.prepare(`
    INSERT OR IGNORE INTO projects (name, path, metadata) 
    VALUES (?, ?, ?)
  `);
  
  insertProject.run(
    paths.projectName,
    paths.projectPath,
    JSON.stringify({
      dataPath: paths.dataDir,
      vectorPath: paths.vectorDir,
      initialized: new Date().toISOString()
    })
  );
  
  // // console.log(`✅ SQLite database initialized for project: ${paths.projectName}`);
  return db;
}

/**
 * Initialize LanceDB with project isolation
 */
export async function initVectorDB(paths) {
  try {
    // // console.log(`Initializing LanceDB for project: ${paths.projectName}`);
    // // console.log(`Vector DB path: ${paths.vectorDir}`);
    
    // Connect to project-specific LanceDB
    const db = await lancedb.connect(paths.vectorDir);
    
    // Define schemas for our tables
    const decisionsSchema = [
      { name: 'id', type: 'string' },
      { name: 'project', type: 'string' },
      { name: 'text', type: 'string' },
      { name: 'embedding', type: 'float32[]' },
      { name: 'metadata', type: 'string' },
      { name: 'session_id', type: 'string' },
      { name: 'timestamp', type: 'string' }
    ];
    
    const patternsSchema = [
      { name: 'id', type: 'string' },
      { name: 'project', type: 'string' },
      { name: 'file_path', type: 'string' },
      { name: 'content', type: 'string' },
      { name: 'embedding', type: 'float32[]' },
      { name: 'language', type: 'string' },
      { name: 'session_id', type: 'string' }
    ];
    
    const documentationSchema = [
      { name: 'id', type: 'string' },
      { name: 'project', type: 'string' },
      { name: 'title', type: 'string' },
      { name: 'content', type: 'string' },
      { name: 'embedding', type: 'float32[]' },
      { name: 'source', type: 'string' },
      { name: 'path', type: 'string' }
    ];
    
    // Create tables if they don't exist
    const tables = await db.tableNames();
    
    if (!tables.includes('decisions')) {
      // Create with empty data initially
      await db.createTable('decisions', [{
        id: `init_${paths.projectName}`,
        project: paths.projectName,
        text: 'Initial decision for project initialization',
        embedding: new Array(768).fill(0), // MPNet dimensions
        metadata: '{}',
        session_id: 'init',
        timestamp: new Date().toISOString()
      }]);
      // // console.log(`✅ Created LanceDB table: decisions for ${paths.projectName}`);
    }
    
    if (!tables.includes('code_patterns')) {
      await db.createTable('code_patterns', [{
        id: `init_${paths.projectName}`,
        project: paths.projectName,
        file_path: '/init',
        content: 'Initial pattern',
        embedding: new Array(768).fill(0), // MPNet dimensions
        language: 'unknown',
        session_id: 'init'
      }]);
      // // console.log(`✅ Created LanceDB table: code_patterns for ${paths.projectName}`);
    }
    
    if (!tables.includes('documentation')) {
      await db.createTable('documentation', [{
        id: `init_${paths.projectName}`,
        project: paths.projectName,
        title: 'Project Documentation',
        content: 'Initial documentation',
        embedding: new Array(768).fill(0), // MPNet dimensions
        source: 'project',
        path: '/init'
      }]);
      // // console.log(`✅ Created LanceDB table: documentation for ${paths.projectName}`);
    }
    
    // // console.log(`✅ LanceDB initialized for project: ${paths.projectName}`);
    return db;
  } catch (error) {
    console.error(`❌ LanceDB initialization error for ${paths.projectName}:`, error);
    throw error;
  }
}

/**
 * Project isolation validator
 */
export class ProjectIsolation {
  constructor(paths) {
    this.paths = paths;
    this.projectName = paths.projectName;
  }
  
  /**
   * Validate that all operations are isolated to current project
   */
  validateQuery(query) {
    if (!query.project || query.project !== this.projectName) {
      query.project = this.projectName;
      query.project_name = this.projectName;
    }
    return query;
  }
  
  /**
   * Ensure results are from current project only
   */
  validateResults(results) {
    return results.filter(r => 
      !r.project || 
      r.project === this.projectName || 
      r.project_name === this.projectName
    );
  }
  
  /**
   * Check if databases are properly isolated
   */
  checkIsolation() {
    const issues = [];
    
    // Check SQLite path
    if (!this.paths.sqlitePath.includes(this.projectName) && this.projectName !== 'default') {
      issues.push(`SQLite path doesn't include project name: ${this.paths.sqlitePath}`);
    }
    
    // Check vector DB path
    if (!this.paths.vectorDir.includes(this.projectName) && this.projectName !== 'default') {
      issues.push(`Vector DB path doesn't include project name: ${this.paths.vectorDir}`);
    }
    
    if (issues.length > 0) {
      console.warn('⚠️  Isolation issues detected:');
      issues.forEach(issue => console.warn(`  - ${issue}`));
      return false;
    }
    
    // // console.log(`✅ Project isolation verified for: ${this.projectName}`);
    return true;
  }
}

/**
 * Combined initialization with project isolation
 */
export async function initDatabases() {
  // // console.log('🚀 Initializing DevAssist databases with project isolation...');
  
  // Get project-specific paths
  const paths = getProjectPaths();
  
  // // console.log('📁 Project configuration:');
  // // console.log(`  Project: ${paths.projectName}`);
  // // console.log(`  Path: ${paths.projectPath}`);
  // // console.log(`  Data: ${paths.dataDir}`);
  
  // Ensure directories exist
  ensureDirectories(paths);
  
  // Initialize databases
  const sqlite = initSQLite(paths);
  const vectordb = await initVectorDB(paths);
  
  // Create isolation validator
  const isolation = new ProjectIsolation(paths);
  isolation.checkIsolation();
  
  return { 
    sqlite, 
    vectordb, 
    paths,
    isolation,
    projectName: paths.projectName,
    dataPath: paths.dataDir
  };
}

// Run initialization if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initDatabases()
    .then(() => {
      // // console.log('✅ All databases initialized successfully with project isolation');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Database initialization failed:', error);
      process.exit(1);
    });
}