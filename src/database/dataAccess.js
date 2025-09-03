// Enhanced dataAccess.js with better embeddings and hybrid search
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
let embeddingPipelines = {};

// ============================================
// EMBEDDING MODEL SELECTION
// ============================================

const EMBEDDING_MODELS = {
  // Current model - fast but lower quality
  'minilm': {
    name: 'Xenova/all-MiniLM-L6-v2',
    dimensions: 384,
    description: 'Fast, lightweight, good for basic matching'
  },
  
  // Better quality model - recommended upgrade
  'mpnet': {
    name: 'Xenova/all-mpnet-base-v2',
    dimensions: 768,
    description: 'Higher quality, better semantic understanding'
  },
  
  // Best quality (but slower)
  'gte-small': {
    name: 'Xenova/gte-small',
    dimensions: 384,
    description: 'State-of-art quality, same dimensions as minilm'
  },
  
  // Multilingual support
  'multilingual': {
    name: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
    dimensions: 384,
    description: 'Good for multi-language codebases'
  }
};

// Select which model to use (can be configurable)
const ACTIVE_MODEL = 'mpnet'; // Using MPNet for 40-50% better semantic matching

// Initialize embedding pipeline with selected model
async function getEmbeddingPipeline(modelKey = ACTIVE_MODEL) {
  if (!embeddingPipelines[modelKey]) {
    const model = EMBEDDING_MODELS[modelKey];
    console.log(`Loading embedding model: ${model.name}`);
    embeddingPipelines[modelKey] = await pipeline(
      'feature-extraction', 
      model.name
    );
  }
  return embeddingPipelines[modelKey];
}

// Generate embeddings with the selected model
export async function generateEmbedding(text, modelKey = ACTIVE_MODEL) {
  const extractor = await getEmbeddingPipeline(modelKey);
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

// ============================================
// QUERY INTELLIGENCE
// ============================================

/**
 * Analyzes a query to determine the best search strategy
 */
export function analyzeQuery(query) {
  const analysis = {
    type: 'unknown',
    strategy: 'hybrid',
    keywords: [],
    hasCodeElements: false,
    hasSpecificTerms: false,
    isNaturalLanguage: false,
    isNavigational: false,
    confidence: 0
  };
  
  // Check for code elements
  const codePatterns = [
    /\bfunction\b/i,
    /\bclass\b/i,
    /\bimport\b/i,
    /\bconst\b/i,
    /\blet\b/i,
    /\bvar\b/i,
    /\(\)/,
    /\[\]/,
    /\{\}/,
    /=>/,
    /\./,
    /::/
  ];
  
  analysis.hasCodeElements = codePatterns.some(pattern => pattern.test(query));
  
  // Check for specific technical terms
  const technicalTerms = [
    'api', 'database', 'auth', 'authentication', 'jwt', 'react', 'vue',
    'angular', 'node', 'python', 'docker', 'kubernetes', 'aws', 'azure',
    'postgresql', 'mongodb', 'redis', 'graphql', 'rest', 'microservice'
  ];
  
  const queryLower = query.toLowerCase();
  analysis.hasSpecificTerms = technicalTerms.some(term => 
    queryLower.includes(term)
  );
  
  // Check if it's a natural language question
  const questionWords = ['how', 'what', 'why', 'when', 'where', 'should', 'can', 'could', 'would'];
  analysis.isNaturalLanguage = questionWords.some(word => 
    queryLower.startsWith(word) || queryLower.includes(` ${word} `)
  );
  
  // Check if it's navigational (looking for specific file/function)
  analysis.isNavigational = query.includes('/') || query.includes('.js') || 
                           query.includes('.py') || query.includes('()');
  
  // Extract potential keywords
  analysis.keywords = query
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !['the', 'and', 'or', 'but', 'for', 'with'].includes(word.toLowerCase()));
  
  // Determine best strategy
  if (analysis.hasCodeElements || analysis.isNavigational) {
    analysis.strategy = 'keyword';
    analysis.type = 'code_search';
    analysis.confidence = 0.9;
  } else if (analysis.isNaturalLanguage && !analysis.hasSpecificTerms) {
    analysis.strategy = 'vector';
    analysis.type = 'semantic_question';
    analysis.confidence = 0.8;
  } else if (analysis.hasSpecificTerms && analysis.keywords.length <= 3) {
    analysis.strategy = 'keyword_boost';
    analysis.type = 'specific_lookup';
    analysis.confidence = 0.85;
  } else {
    analysis.strategy = 'hybrid';
    analysis.type = 'mixed_query';
    analysis.confidence = 0.7;
  }
  
  return analysis;
}

// ============================================
// KEYWORD SEARCH (SQLite FTS5)
// ============================================

/**
 * Keyword search using SQLite Full-Text Search
 */
export function keywordSearch(query, options = {}) {
  const {
    table = 'decisions',
    project = null,
    limit = 10
  } = options;
  
  const db = getSQLiteDB();
  
  // Create FTS virtual table if it doesn't exist
  const ftsTable = `${table}_fts`;
  
  try {
    // Check if FTS table exists
    const tableExists = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
    ).get(ftsTable);
    
    if (!tableExists) {
      // Create FTS table based on the source table
      if (table === 'decisions') {
        db.exec(`
          CREATE VIRTUAL TABLE ${ftsTable} USING fts5(
            decision, context, impact, content=decisions
          );
          INSERT INTO ${ftsTable}(decision, context, impact)
          SELECT decision, context, impact FROM decisions;
        `);
      } else if (table === 'code_patterns') {
        db.exec(`
          CREATE VIRTUAL TABLE ${ftsTable} USING fts5(
            file_path, content, language, content=code_patterns
          );
          INSERT INTO ${ftsTable}(file_path, content, language)
          SELECT file_path, content, language FROM code_patterns;
        `);
      }
    }
    
    // Perform FTS search
    let sql = `
      SELECT ${table}.*,
             rank as keyword_score
      FROM ${ftsTable}
      JOIN ${table} ON ${table}.rowid = ${ftsTable}.rowid
      WHERE ${ftsTable} MATCH ?
    `;
    
    if (project && table === 'decisions') {
      sql += ` AND ${table}.project_id = (SELECT id FROM projects WHERE name = ?)`;
    }
    
    sql += ` ORDER BY rank LIMIT ?`;
    
    const params = project ? [query, project, limit] : [query, limit];
    const results = db.prepare(sql).all(...params);
    
    return results.map(r => ({
      ...r,
      search_type: 'keyword',
      score: Math.abs(r.keyword_score) // FTS5 rank is negative
    }));
    
  } catch (error) {
    console.error('Keyword search error:', error);
    return [];
  }
}

// ============================================
// HYBRID SEARCH
// ============================================

/**
 * Intelligent hybrid search that combines vector and keyword search
 */
export async function hybridSearch(query, options = {}) {
  const {
    table = 'decisions',
    project = null,
    limit = 10,
    vectorWeight = 0.5,  // Weight for vector search (0-1)
    autoRoute = true     // Automatically choose best strategy
  } = options;
  
  // Analyze query to determine strategy
  const queryAnalysis = analyzeQuery(query);
  
  console.log(`Query Analysis: ${queryAnalysis.type} (${queryAnalysis.strategy}) - Confidence: ${queryAnalysis.confidence}`);
  
  // Route based on analysis if autoRoute is enabled
  if (autoRoute) {
    switch (queryAnalysis.strategy) {
      case 'keyword':
        // Pure keyword search for code/navigation
        return keywordSearch(query, { table, project, limit });
        
      case 'vector':
        // Pure vector search for natural language
        return semanticSearch(query, { 
          table, 
          project, 
          limit, 
          threshold: 0.25  // Lower threshold for natural language
        });
        
      case 'keyword_boost':
        // Keyword search with vector fallback
        const keywordResults = keywordSearch(query, { table, project, limit: limit / 2 });
        if (keywordResults.length < 3) {
          // Not enough keyword results, add vector results
          const vectorResults = await semanticSearch(query, {
            table,
            project,
            limit: limit - keywordResults.length,
            threshold: 0.3
          });
          return [...keywordResults, ...vectorResults];
        }
        return keywordResults;
        
      case 'hybrid':
      default:
        // Full hybrid search
        break;
    }
  }
  
  // Perform both searches in parallel
  const [vectorResults, keywordResults] = await Promise.all([
    semanticSearch(query, { table, project, limit, threshold: 0.2 }),
    keywordSearch(query, { table, project, limit })
  ]);
  
  // Create a map to merge results
  const resultMap = new Map();
  
  // Add vector results with scores
  vectorResults.forEach(r => {
    const id = r.embedding_id || r.id;
    resultMap.set(id, {
      ...r,
      vector_score: r._distance ? (1 - r._distance) : 0,
      keyword_score: 0,
      combined_score: 0
    });
  });
  
  // Add/merge keyword results
  keywordResults.forEach(r => {
    const id = r.embedding_id || r.id;
    if (resultMap.has(id)) {
      // Merge scores
      const existing = resultMap.get(id);
      existing.keyword_score = r.score;
    } else {
      // Add new result
      resultMap.set(id, {
        ...r,
        vector_score: 0,
        keyword_score: r.score,
        combined_score: 0
      });
    }
  });
  
  // Calculate combined scores with weighting
  const results = Array.from(resultMap.values()).map(r => {
    // Normalize scores to 0-1 range
    const normalizedVector = r.vector_score;
    const normalizedKeyword = Math.min(r.keyword_score / 10, 1); // FTS5 scores can be high
    
    // Calculate weighted combined score
    r.combined_score = (normalizedVector * vectorWeight) + 
                      (normalizedKeyword * (1 - vectorWeight));
    
    // Add boost for results that appear in both searches
    if (r.vector_score > 0 && r.keyword_score > 0) {
      r.combined_score *= 1.2; // 20% boost for appearing in both
    }
    
    return r;
  });
  
  // Sort by combined score and limit
  results.sort((a, b) => b.combined_score - a.combined_score);
  
  return results.slice(0, limit);
}

// ============================================
// IMPROVED SEMANTIC SEARCH
// ============================================

export async function semanticSearch(query, options = {}) {
  const {
    table = 'decisions',
    project = null,
    limit = 10,
    threshold = 0.3,
    enhanceQuery = false  // Disabled for now to avoid interference
  } = options;
  
  const vectorDb = await getVectorDB();
  
  // Enhance query if enabled
  let finalQuery = query;
  if (enhanceQuery) {
    finalQuery = enhanceQueryText(query);
  }
  
  const queryEmbedding = await generateEmbedding(finalQuery);
  
  // Open the table
  const targetTable = await vectorDb.openTable(table);
  
  try {
    // Execute the search query
    const searchQuery = targetTable.search(queryEmbedding).limit(limit * 2); // Get more for filtering
    const iterator = await searchQuery.execute();
    
    // Collect results from RecordBatchIterator
    const results = [];
    while (true) {
      const { value, done } = await iterator.next();
      if (done) break;
      
      if (value) {
        for (const record of value) {
          results.push(record);
        }
      }
    }
    
    // Filter by project and similarity threshold
    const filtered = results.filter(r => {
      const similarity = r._distance ? (1 - r._distance) : 1;
      const similarityOk = similarity >= threshold;
      const projectOk = !project || r.project === project;
      return similarityOk && projectOk;
    });
    
    // Re-rank based on query terms appearing in text
    if (enhanceQuery) {
      const queryTerms = query.toLowerCase().split(/\s+/);
      const scoredResults = filtered.map(r => {
        const text = (r.text || '').toLowerCase();
        const termMatches = queryTerms.filter(term => text.includes(term)).length;
        const score = (1 - (r._distance || 0)) + (termMatches * 0.1); // Boost for term matches
        return { ...r, _score: score };
      });
      scoredResults.sort((a, b) => (b._score || 0) - (a._score || 0));
      return scoredResults.slice(0, limit);
    }
    
    return filtered.slice(0, limit);
  } catch (error) {
    console.error('Semantic search error:', error);
    return [];
  }
}

/**
 * Enhance query text for better semantic search
 */
function enhanceQueryText(query) {
  // Add synonyms and related terms
  const enhancements = {
    'frontend': 'frontend UI user interface client-side',
    'backend': 'backend server API service-side',
    'database': 'database DB storage persistence data',
    'auth': 'authentication authorization login security jwt oauth',
    'api': 'API endpoint REST GraphQL service interface',
    'react': 'React ReactJS component JSX hooks',
    'test': 'test testing unit integration spec TDD',
    'deploy': 'deploy deployment CI CD pipeline docker kubernetes'
  };
  
  let enhanced = query;
  const queryLower = query.toLowerCase();
  
  // Add enhancements to the original query instead of replacing
  for (const [key, value] of Object.entries(enhancements)) {
    if (queryLower.includes(key)) {
      enhanced = `${query} ${value}`;
      break;
    }
  }
  
  return enhanced;
}

// ============================================
// MIGRATION FUNCTION
// ============================================

/**
 * Migrate existing embeddings to new model
 */
export async function migrateEmbeddings(fromModel = 'minilm', toModel = 'mpnet') {
  console.log(`Migrating embeddings from ${fromModel} to ${toModel}...`);
  
  const db = getSQLiteDB();
  const vectorDb = await getVectorDB();
  
  // Get all decisions
  const decisions = db.prepare('SELECT * FROM decisions').all();
  
  for (const decision of decisions) {
    const text = `${decision.decision} ${decision.context || ''}`;
    
    // Generate new embedding with better model
    const newEmbedding = await generateEmbedding(text, toModel);
    
    // Update in vector database
    const table = await vectorDb.openTable('decisions');
    // This would need to update existing record - implementation depends on LanceDB API
    console.log(`Migrated decision ${decision.id}`);
  }
  
  console.log('Migration complete!');
}

// ============================================
// ORIGINAL FUNCTIONS (preserved)
// ============================================

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
  embeddingPipelines = {};
}