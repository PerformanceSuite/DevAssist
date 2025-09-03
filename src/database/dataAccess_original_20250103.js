import Database from 'better-sqlite3';
import * as lancedb from '@lancedb/lancedb';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from '@xenova/transformers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const VECTOR_DIR = path.join(DATA_DIR, 'vectors');

// Singleton instances
let sqliteDb = null;
let vectorDb = null;
let embeddingPipeline = null;

// Initialize embedding pipeline (using all-MiniLM-L6-v2 for efficiency)
async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    embeddingPipeline = await pipeline(
      'feature-extraction', 
      'Xenova/all-MiniLM-L6-v2'
    );
  }
  return embeddingPipeline;
}

// Generate embeddings for text
export async function generateEmbedding(text) {
  const extractor = await getEmbeddingPipeline();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

// Get database connections
export function getSQLiteDB() {
  if (!sqliteDb) {
    const dbPath = path.join(DATA_DIR, 'devassist.db');
    sqliteDb = new Database(dbPath);
    sqliteDb.pragma('journal_mode = WAL');
  }
  return sqliteDb;
}

export async function getVectorDB() {
  if (!vectorDb) {
    vectorDb = await lancedb.connect(VECTOR_DIR);
  }
  return vectorDb;
}

// Project management
export function getOrCreateProject(projectName = 'default') {
  const db = getSQLiteDB();
  
  // Try to get existing project
  let project = db.prepare('SELECT * FROM projects WHERE name = ?').get(projectName);
  
  if (!project) {
    // Create new project
    const result = db.prepare(
      'INSERT INTO projects (name, metadata) VALUES (?, ?)'
    ).run(projectName, JSON.stringify({ created: new Date().toISOString() }));
    
    project = {
      id: result.lastInsertRowid,
      name: projectName
    };
  }
  
  return project;
}

// Decision management
export async function recordDecision(data) {
  const { decision, context, alternatives, impact, project = 'default' } = data;
  
  const db = getSQLiteDB();
  const vectorDb = await getVectorDB();
  const projectData = getOrCreateProject(project);
  
  // Generate embedding for decision + context
  const textToEmbed = `${decision} ${context || ''}`;
  const embedding = await generateEmbedding(textToEmbed);
  
  // Create unique ID
  const embeddingId = `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Insert into SQLite
  const result = db.prepare(`
    INSERT INTO decisions (project_id, decision, context, impact, alternatives, embedding_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    projectData.id,
    decision,
    context,
    impact,
    JSON.stringify(alternatives || []),
    embeddingId
  );
  
  // Insert into vector database
  const decisionsTable = await vectorDb.openTable('decisions');
  await decisionsTable.add([{
    id: embeddingId,
    project: project,
    text: textToEmbed,
    embedding: embedding,
    metadata: JSON.stringify({
      decision_id: result.lastInsertRowid,
      impact: impact,
      alternatives: alternatives
    })
  }]);
  
  return {
    id: result.lastInsertRowid,
    embedding_id: embeddingId
  };
}

// Progress tracking
export function trackProgress(data) {
  const { milestone, status, notes, blockers, project = 'default' } = data;
  
  const db = getSQLiteDB();
  const projectData = getOrCreateProject(project);
  
  // Check if milestone exists
  const existing = db.prepare(`
    SELECT * FROM progress 
    WHERE project_id = ? AND milestone = ?
  `).get(projectData.id, milestone);
  
  if (existing) {
    // Update existing
    db.prepare(`
      UPDATE progress 
      SET status = ?, notes = ?, blockers = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, notes, JSON.stringify(blockers || []), existing.id);
    
    return existing.id;
  } else {
    // Create new
    const result = db.prepare(`
      INSERT INTO progress (project_id, milestone, status, notes, blockers)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      projectData.id,
      milestone,
      status,
      notes,
      JSON.stringify(blockers || [])
    );
    
    return result.lastInsertRowid;
  }
}

// Semantic search
export async function semanticSearch(query, options = {}) {
  const {
    table = 'decisions',
    project = null,
    limit = 10,
    threshold = 0.7
  } = options;
  
  const vectorDb = await getVectorDB();
  const queryEmbedding = await generateEmbedding(query);
  
  // Open the table
  const targetTable = await vectorDb.openTable(table);
  
  try {
    // Execute the search query
    const searchQuery = targetTable.search(queryEmbedding).limit(limit);
    const iterator = await searchQuery.execute();
    
    // Collect results from RecordBatchIterator
    const results = [];
    while (true) {
      const { value, done } = await iterator.next();
      if (done) break;
      
      // value is a RecordBatch which is iterable
      if (value) {
        for (const record of value) {
          results.push(record);
        }
      }
    }
    
    // Filter by project and similarity threshold
    return results.filter(r => {
      // Calculate similarity from distance (similarity = 1 - distance)
      const similarity = r._distance ? (1 - r._distance) : 1;
      const similarityOk = similarity >= threshold;
      const projectOk = !project || r.project === project;
      return similarityOk && projectOk;
    });
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

// Get project memories
export async function getProjectMemory(query, category = 'all', limit = 10, project = 'default') {
  const db = getSQLiteDB();
  const projectData = getOrCreateProject(project);
  
  let memories = [];
  
  if (category === 'all' || category === 'decisions') {
    // Get decisions
    const decisions = db.prepare(`
      SELECT * FROM decisions 
      WHERE project_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(projectData.id, limit);
    
    memories.push(...decisions.map(d => ({
      ...d,
      type: 'decision',
      category: 'decisions',
      alternatives: JSON.parse(d.alternatives || '[]')
    })));
  }
  
  if (category === 'all' || category === 'progress') {
    // Get progress
    const progress = db.prepare(`
      SELECT * FROM progress
      WHERE project_id = ?
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(projectData.id, limit);
    
    memories.push(...progress.map(p => ({
      ...p,
      type: 'progress',
      category: 'progress',
      blockers: JSON.parse(p.blockers || '[]')
    })));
  }
  
  // If query provided, perform semantic search
  if (query && (category === 'all' || category === 'decisions')) {
    try {
      const searchResults = await semanticSearch(query, {
        table: 'decisions',
        project: project,
        limit: limit
      });
      
      // Merge with structured data
      const embeddingIds = searchResults.map(r => r.id);
      if (embeddingIds.length > 0) {
        const semanticDecisions = db.prepare(`
          SELECT * FROM decisions 
          WHERE embedding_id IN (${embeddingIds.map(() => '?').join(',')})
        `).all(...embeddingIds);
        
        // Add to memories with similarity scores
        semanticDecisions.forEach((d, i) => {
          const searchResult = searchResults.find(r => r.id === d.embedding_id);
          memories.push({
            ...d,
            type: 'decision',
            category: 'decisions',
            similarity: searchResult ? 1 - searchResult._distance : 0,
            alternatives: JSON.parse(d.alternatives || '[]')
          });
        });
      }
    } catch (error) {
      console.error('Semantic search error:', error);
    }
  }
  
  // Sort by timestamp/relevance
  memories.sort((a, b) => {
    if (a.similarity && b.similarity) {
      return b.similarity - a.similarity;
    }
    const timeA = new Date(a.timestamp || a.updated_at || 0).getTime();
    const timeB = new Date(b.timestamp || b.updated_at || 0).getTime();
    return timeB - timeA;
  });
  
  return memories.slice(0, limit);
}

// Identify duplicate patterns
export async function identifyDuplicates(feature, searchPath, threshold = 0.7) {
  if (!feature) {
    return { duplicates: [], message: 'No feature specified' };
  }
  
  try {
    // Search in vector database for similar patterns
    const searchResults = await semanticSearch(feature, {
      table: 'code_patterns',
      limit: 20,
      threshold: threshold
    });
    
    if (searchResults.length === 0) {
      return {
        duplicates: [],
        message: `No duplicates found for "${feature}"`
      };
    }
    
    // Format results with similarity scores
    const duplicates = searchResults.map(r => ({
      content: r.content,
      similarity: 1 - r._distance,
      file_path: r.file_path,
      language: r.language
    }));
    
    return {
      duplicates: duplicates,
      message: `Found ${duplicates.length} potential duplicates`
    };
  } catch (error) {
    console.error('Duplicate detection error:', error);
    return {
      duplicates: [],
      message: `Error during duplicate detection: ${error.message}`
    };
  }
}

// Add code pattern for duplicate detection
export async function addCodePattern(filePath, content, language, project = 'default') {
  const vectorDb = await getVectorDB();
  const db = getSQLiteDB();
  const projectData = getOrCreateProject(project);
  
  // Generate embedding
  const embedding = await generateEmbedding(content);
  
  // Create unique ID
  const patternId = `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const patternHash = `${filePath}_${content.length}`;
  
  // Check if pattern already exists
  const existing = db.prepare(
    'SELECT * FROM code_patterns WHERE pattern_hash = ?'
  ).get(patternHash);
  
  if (existing) {
    return { 
      id: existing.id, 
      embedding_id: existing.embedding_id,
      status: 'exists' 
    };
  }
  
  // Insert into SQLite
  const result = db.prepare(`
    INSERT INTO code_patterns (project_id, pattern_hash, file_path, language, content, embedding_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    projectData.id,
    patternHash,
    filePath,
    language,
    content.substring(0, 1000), // Store first 1000 chars
    patternId
  );
  
  // Insert into vector database
  const patternsTable = await vectorDb.openTable('code_patterns');
  
  // Remove the initial placeholder record if it exists
  try {
    const existing = await patternsTable.query().execute();
    const existingArray = [];
    for await (const item of existing) {
      existingArray.push(item);
      if (existingArray.length > 1) break; // Just check if there's more than placeholder
    }
    // If only placeholder exists, we'll overwrite it
  } catch (e) {
    // Table might be empty or error
  }
  
  await patternsTable.add([{
    id: patternId,
    project: project,
    file_path: filePath,
    content: content,
    embedding: embedding,
    language: language
  }]);
  
  return {
    id: result.lastInsertRowid,
    embedding_id: patternId,
    status: 'created'
  };
}

// Get all projects
export function getAllProjects() {
  const db = getSQLiteDB();
  const projects = db.prepare('SELECT * FROM projects ORDER BY name').all();
  
  return projects.map(p => ({
    ...p,
    metadata: JSON.parse(p.metadata || '{}')
  }));
}

// Get decisions by project
export function getDecisionsByProject(projectName = 'default', limit = 50) {
  const db = getSQLiteDB();
  const project = getOrCreateProject(projectName);
  
  const decisions = db.prepare(`
    SELECT * FROM decisions 
    WHERE project_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(project.id, limit);
  
  return decisions.map(d => ({
    ...d,
    alternatives: JSON.parse(d.alternatives || '[]')
  }));
}

// Get progress by project
export function getProgressByProject(projectName = 'default', limit = 50) {
  const db = getSQLiteDB();
  const project = getOrCreateProject(projectName);
  
  const progress = db.prepare(`
    SELECT * FROM progress
    WHERE project_id = ?
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(project.id, limit);
  
  return progress.map(p => ({
    ...p,
    blockers: JSON.parse(p.blockers || '[]')
  }));
}

// Clean up connections
export async function closeConnections() {
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }
  vectorDb = null;
  embeddingPipeline = null;
}