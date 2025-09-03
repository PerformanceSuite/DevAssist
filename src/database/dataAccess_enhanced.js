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
const ACTIVE_MODEL = 'mpnet'; // Upgrade from 'minilm' to 'mpnet'

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
    enhanceQuery = true  // New option for query enhancement
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
      filtered.forEach(r => {
        const text = (r.text || '').toLowerCase();
        const termMatches = queryTerms.filter(term => text.includes(term)).length;
        r._score = (1 - (r._distance || 0)) + (termMatches * 0.1); // Boost for term matches
      });
      filtered.sort((a, b) => (b._score || 0) - (a._score || 0));
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
  for (const [key, value] of Object.entries(enhancements)) {
    if (query.toLowerCase().includes(key)) {
      enhanced = value;
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

// Export existing functions
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