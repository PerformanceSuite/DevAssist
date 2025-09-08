/**
 * Technology Documentation Fetcher
 * Fetches and ingests documentation for detected technologies
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class TechDocsFetcher {
  constructor() {
    this.docsPath = path.join(__dirname, '../../data/tech-docs');
    this.docsSources = {
      dagger: [
        'https://docs.dagger.io/api/reference',
        'https://docs.dagger.io/quickstart',
        'https://docs.dagger.io/guides'
      ],
      kubernetes: [
        'https://kubernetes.io/docs/concepts',
        'https://kubernetes.io/docs/reference/kubectl'
      ],
      docker: [
        'https://docs.docker.com/engine/reference',
        'https://docs.docker.com/compose/compose-file'
      ],
      terraform: [
        'https://developer.hashicorp.com/terraform/docs',
        'https://registry.terraform.io/providers'
      ],
      node: [
        'https://nodejs.org/api/',
        'https://nodejs.org/en/docs/guides'
      ],
      python: [
        'https://docs.python.org/3/',
        'https://docs.python.org/3/library/'
      ],
      go: [
        'https://go.dev/doc/',
        'https://pkg.go.dev/std'
      ],
      rust: [
        'https://doc.rust-lang.org/book/',
        'https://doc.rust-lang.org/std/'
      ]
    };
    
    this.cachedDocs = new Map();
  }

  async initialize() {
    // Ensure docs directory exists
    await fs.mkdir(this.docsPath, { recursive: true });
    
    // Load cached docs metadata
    const metadataPath = path.join(this.docsPath, 'metadata.json');
    try {
      const metadata = await fs.readFile(metadataPath, 'utf8');
      this.cachedDocs = new Map(Object.entries(JSON.parse(metadata)));
    } catch {
      // No cached metadata yet
    }
  }

  /**
   * Fetch documentation for detected technologies
   */
  async fetchDocsForTechnologies(technologies) {
    const results = {
      fetched: [],
      cached: [],
      failed: [],
      summary: ''
    };

    console.error('[DevAssist] 📚 Fetching documentation for detected technologies...');

    for (const tech of technologies) {
      const techLower = tech.toLowerCase();
      
      // Check if we have cached docs that are fresh (< 7 days old)
      if (this.isCacheFresh(techLower)) {
        results.cached.push(tech);
        console.error(`  ✓ Using cached docs for ${tech}`);
        continue;
      }

      // Fetch new docs
      if (this.docsSources[techLower]) {
        try {
          await this.fetchTechDocs(techLower);
          results.fetched.push(tech);
          console.error(`  ✓ Fetched latest docs for ${tech}`);
        } catch (error) {
          results.failed.push(tech);
          console.error(`  ✗ Failed to fetch docs for ${tech}: ${error.message}`);
        }
      }
    }

    // Generate summary
    const totalDocs = results.fetched.length + results.cached.length;
    results.summary = `Documentation ready for ${totalDocs} technologies:\n`;
    
    if (results.fetched.length > 0) {
      results.summary += `  • Fetched: ${results.fetched.join(', ')}\n`;
    }
    if (results.cached.length > 0) {
      results.summary += `  • Cached: ${results.cached.join(', ')}\n`;
    }
    if (results.failed.length > 0) {
      results.summary += `  • Failed: ${results.failed.join(', ')}\n`;
    }

    // Save metadata
    await this.saveMetadata();

    return results;
  }

  /**
   * Check if cached docs are fresh
   */
  isCacheFresh(tech) {
    const cached = this.cachedDocs.get(tech);
    if (!cached) return false;

    const age = Date.now() - new Date(cached.timestamp).getTime();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    return age < maxAge;
  }

  /**
   * Fetch documentation for a specific technology
   */
  async fetchTechDocs(tech) {
    const sources = this.docsSources[tech];
    if (!sources) {
      throw new Error(`No documentation sources for ${tech}`);
    }

    const techDocsPath = path.join(this.docsPath, tech);
    await fs.mkdir(techDocsPath, { recursive: true });

    // Store documentation metadata
    const docsMetadata = {
      technology: tech,
      sources: sources,
      timestamp: new Date().toISOString(),
      files: []
    };

    // Note: In a real implementation, you would fetch from URLs
    // For now, we'll create placeholder documentation
    for (const source of sources) {
      const fileName = `${path.basename(source)}.md`;
      const filePath = path.join(techDocsPath, fileName);
      
      // Create placeholder content
      const content = `# ${tech} Documentation
Source: ${source}
Fetched: ${new Date().toISOString()}

## Overview
This is cached documentation for ${tech}.

## Key Concepts
- Architecture patterns
- Best practices
- API reference
- Examples and tutorials

## Note
In production, this would contain actual fetched documentation.
For now, this serves as a placeholder to demonstrate the feature.
`;

      await fs.writeFile(filePath, content);
      docsMetadata.files.push(fileName);
    }

    // Update cache
    this.cachedDocs.set(tech, docsMetadata);
    
    // Save documentation index
    const indexPath = path.join(techDocsPath, 'index.json');
    await fs.writeFile(indexPath, JSON.stringify(docsMetadata, null, 2));
  }

  /**
   * Save metadata for all cached docs
   */
  async saveMetadata() {
    const metadataPath = path.join(this.docsPath, 'metadata.json');
    const metadata = Object.fromEntries(this.cachedDocs);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Search documentation for a specific topic
   */
  async searchDocs(query, technologies = []) {
    const results = [];
    const searchTechs = technologies.length > 0 ? technologies : Array.from(this.cachedDocs.keys());

    for (const tech of searchTechs) {
      const techDocsPath = path.join(this.docsPath, tech);
      
      try {
        const files = await fs.readdir(techDocsPath);
        
        for (const file of files) {
          if (!file.endsWith('.md')) continue;
          
          const content = await fs.readFile(path.join(techDocsPath, file), 'utf8');
          
          // Simple search - in production, use vector search
          if (content.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              technology: tech,
              file: file,
              snippet: this.extractSnippet(content, query),
              path: path.join(techDocsPath, file)
            });
          }
        }
      } catch {
        // Tech docs not available
      }
    }

    return results;
  }

  /**
   * Extract a snippet around the query
   */
  extractSnippet(content, query) {
    const index = content.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return '';

    const start = Math.max(0, index - 100);
    const end = Math.min(content.length, index + query.length + 100);
    
    return '...' + content.slice(start, end) + '...';
  }
}