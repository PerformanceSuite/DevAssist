/**
 * Enhanced Documentation Module for DevAssist
 * Provides intelligent documentation search and retrieval
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateEmbedding } from '../database/dataAccess.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Documentation source paths
const DOC_SOURCES = {
  devassist: [
    path.join(__dirname, '../../docs'),                    // DevAssist's own docs
    path.join(__dirname, '../../README.md'),              // DevAssist README
    path.join(__dirname, '../../DEVASSIST_PRD.md'),      // Product docs
  ],
  project: [
    path.join(process.env.DEVASSIST_PROJECT_PATH || process.cwd(), '.devassist/docs'),
    path.join(process.env.DEVASSIST_PROJECT_PATH || process.cwd(), 'docs'),
    path.join(process.env.DEVASSIST_PROJECT_PATH || process.cwd(), 'README.md'),
    path.join(process.env.DEVASSIST_PROJECT_PATH || process.cwd(), 'CLAUDE.md'),
  ],
  knowledge: [
    path.join(process.env.DEVASSIST_KNOWLEDGE_PATH || '.devassist/knowledge'),
  ]
};

/**
 * Documentation index for fast search
 */
class DocumentationIndex {
  constructor() {
    this.documents = new Map();
    this.embeddings = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    console.log('Initializing documentation index...');
    
    // Index all documentation sources
    for (const [source, paths] of Object.entries(DOC_SOURCES)) {
      for (const docPath of paths) {
        if (existsSync(docPath)) {
          await this.indexPath(docPath, source);
        }
      }
    }
    
    this.initialized = true;
    console.log(`Documentation index ready: ${this.documents.size} documents`);
  }

  async indexPath(docPath, source) {
    const stats = statSync(docPath);
    
    if (stats.isDirectory()) {
      // Recursively index directory
      const files = readdirSync(docPath);
      for (const file of files) {
        if (file.endsWith('.md') || file.endsWith('.txt')) {
          const fullPath = path.join(docPath, file);
          await this.indexFile(fullPath, source);
        }
      }
    } else if (stats.isFile()) {
      // Index single file
      await this.indexFile(docPath, source);
    }
  }

  async indexFile(filePath, source) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const relativePath = path.basename(filePath);
      
      // Extract metadata from content
      const metadata = this.extractMetadata(content);
      
      // Store document
      const docId = `${source}:${relativePath}`;
      this.documents.set(docId, {
        id: docId,
        path: filePath,
        source,
        title: metadata.title || relativePath.replace(/\.(md|txt)$/, ''),
        content,
        sections: this.extractSections(content),
        metadata
      });
      
      // Generate embedding for semantic search
      if (content.length > 0) {
        const embedding = await generateEmbedding(
          `${metadata.title || ''} ${metadata.description || ''} ${content.substring(0, 1000)}`
        );
        this.embeddings.set(docId, embedding);
      }
    } catch (error) {
      console.error(`Error indexing ${filePath}:`, error.message);
    }
  }

  extractMetadata(content) {
    const metadata = {};
    
    // Extract title from first # heading
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      metadata.title = titleMatch[1];
    }
    
    // Extract description from first paragraph
    const descMatch = content.match(/^#{1,6}\s+.+\n\n(.+)$/m);
    if (descMatch) {
      metadata.description = descMatch[1];
    }
    
    // Extract tags if present
    const tagsMatch = content.match(/tags:\s*(.+)$/mi);
    if (tagsMatch) {
      metadata.tags = tagsMatch[1].split(',').map(t => t.trim());
    }
    
    return metadata;
  }

  extractSections(content) {
    const sections = [];
    const lines = content.split('\n');
    let currentSection = null;
    let sectionContent = [];
    
    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headingMatch) {
        // Save previous section
        if (currentSection) {
          sections.push({
            ...currentSection,
            content: sectionContent.join('\n').trim()
          });
        }
        
        // Start new section
        currentSection = {
          level: headingMatch[1].length,
          title: headingMatch[2],
          line: lines.indexOf(line)
        };
        sectionContent = [];
      } else if (currentSection) {
        sectionContent.push(line);
      }
    }
    
    // Save last section
    if (currentSection) {
      sections.push({
        ...currentSection,
        content: sectionContent.join('\n').trim()
      });
    }
    
    return sections;
  }

  async search(query, options = {}) {
    const { source = 'all', limit = 5, threshold = 0.6 } = options;
    
    // Ensure index is initialized
    await this.initialize();
    
    const results = [];
    
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);
    
    // Search through documents
    for (const [docId, doc] of this.documents.entries()) {
      // Filter by source if specified
      if (source !== 'all' && doc.source !== source) {
        continue;
      }
      
      // Calculate relevance score
      let score = 0;
      
      // 1. Semantic similarity (if embedding exists)
      if (this.embeddings.has(docId)) {
        const docEmbedding = this.embeddings.get(docId);
        const similarity = this.cosineSimilarity(queryEmbedding, docEmbedding);
        score += similarity * 0.5;
      }
      
      // 2. Keyword matching
      const keywords = query.toLowerCase().split(/\s+/);
      const contentLower = doc.content.toLowerCase();
      const titleLower = doc.title.toLowerCase();
      
      let keywordScore = 0;
      for (const keyword of keywords) {
        if (titleLower.includes(keyword)) keywordScore += 0.3;
        if (contentLower.includes(keyword)) keywordScore += 0.2;
      }
      score += Math.min(keywordScore, 0.5);
      
      // 3. Check section titles
      for (const section of doc.sections) {
        if (section.title.toLowerCase().includes(query.toLowerCase())) {
          score += 0.2;
          break;
        }
      }
      
      if (score >= threshold) {
        results.push({
          ...doc,
          score,
          excerpt: this.getRelevantExcerpt(doc, query)
        });
      }
    }
    
    // Sort by score and limit
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  cosineSimilarity(vec1, vec2) {
    let dot = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dot += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    return dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  getRelevantExcerpt(doc, query) {
    const keywords = query.toLowerCase().split(/\s+/);
    const sentences = doc.content.split(/[.!?]\s+/);
    
    // Find most relevant sentence
    let bestSentence = '';
    let bestScore = 0;
    
    for (const sentence of sentences) {
      const sentLower = sentence.toLowerCase();
      let score = 0;
      
      for (const keyword of keywords) {
        if (sentLower.includes(keyword)) {
          score++;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestSentence = sentence;
      }
    }
    
    // Return best sentence or first paragraph
    return bestSentence || doc.content.substring(0, 200) + '...';
  }

  getByPath(filePath) {
    for (const [_, doc] of this.documents.entries()) {
      if (doc.path === filePath) {
        return doc;
      }
    }
    return null;
  }
}

// Singleton instance
const documentationIndex = new DocumentationIndex();

/**
 * Search documentation with enhanced capabilities
 */
export async function searchDocumentation(topic, options = {}) {
  return await documentationIndex.search(topic, options);
}

/**
 * Get specific documentation by path
 */
export function getDocumentationByPath(filePath) {
  return documentationIndex.getByPath(filePath);
}

/**
 * List all available documentation
 */
export async function listDocumentation(source = 'all') {
  await documentationIndex.initialize();
  
  const docs = [];
  for (const [_, doc] of documentationIndex.documents.entries()) {
    if (source === 'all' || doc.source === source) {
      docs.push({
        title: doc.title,
        source: doc.source,
        path: doc.path,
        sections: doc.sections.length
      });
    }
  }
  
  return docs;
}

/**
 * Get DevAssist's self-documentation
 */
export async function getSelfDocumentation() {
  const selfDocs = await searchDocumentation('DevAssist', { source: 'devassist' });
  
  if (selfDocs.length === 0) {
    // Return hardcoded self-documentation as fallback
    return {
      title: 'DevAssist MCP',
      content: `# DevAssist MCP - Intelligent Development Assistant

## Version: 2.1.0

DevAssist is a Model Context Protocol (MCP) server that provides:
- **Semantic Search**: Find code and decisions using natural language
- **Knowledge Management**: Build project understanding over time
- **Session Continuity**: Maintain context between Claude restarts
- **Architectural Decisions**: Track why choices were made
- **Progress Tracking**: Monitor development milestones

## Available Tools

1. **analyze_codebase** - Analyze project structure
2. **record_architectural_decision** - Document decisions
3. **get_project_memory** - Retrieve past knowledge
4. **track_progress** - Monitor milestones
5. **identify_duplicate_effort** - Find similar code
6. **semantic_search** - Natural language search
7. **get_documentation** - Search documentation
8. **analyze_dependencies** - Review dependencies
9. **generate_summary** - Create status reports

## How It Works

DevAssist uses:
- **MPNet embeddings** for semantic understanding
- **LanceDB** for vector search
- **SQLite** for structured data
- **Project isolation** for data security

Each project gets its own isolated instance with separate databases.

## Configuration

Set environment variables:
- DEVASSIST_PROJECT - Project name
- DEVASSIST_PROJECT_PATH - Project location
- DEVASSIST_DATA_PATH - Data storage

## Learn More

Use get_documentation with specific topics:
- "DevAssist tools" - Tool reference
- "DevAssist configuration" - Setup guide
- "DevAssist sessions" - Session management`
    };
  }
  
  return selfDocs[0];
}

/**
 * Format documentation results for display
 */
export function formatDocumentationResults(results) {
  if (!results || results.length === 0) {
    return 'No documentation found. Try different search terms or check available docs with listDocumentation().';
  }
  
  let formatted = `📚 Found ${results.length} documentation results:\n\n`;
  
  for (const [idx, doc] of results.entries()) {
    formatted += `### ${idx + 1}. ${doc.title}\n`;
    formatted += `**Source**: ${doc.source}\n`;
    formatted += `**Score**: ${(doc.score * 100).toFixed(1)}%\n`;
    formatted += `**Excerpt**: ${doc.excerpt}\n`;
    
    if (doc.sections && doc.sections.length > 0) {
      formatted += `**Sections**: ${doc.sections.slice(0, 3).map(s => s.title).join(', ')}\n`;
    }
    
    formatted += `\n---\n\n`;
  }
  
  return formatted;
}

// Initialize on module load
(async () => {
  try {
    await documentationIndex.initialize();
  } catch (error) {
    console.error('Documentation index initialization error:', error);
  }
})();

export { documentationIndex };
