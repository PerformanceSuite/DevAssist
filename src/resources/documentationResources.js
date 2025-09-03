/**
 * Documentation Resources for DevAssist MCP
 * Provides JUCE and SuperCollider documentation as MCP resources
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Look for docs in multiple locations
const possibleDocPaths = [
  path.join(process.cwd(), '.devassist', 'docs'),
  path.join(process.env.HOME, 'Projects', 'Performia-system', '.devassist', 'docs'),
  path.join(__dirname, '..', '..', 'docs')
];

function findDocsPath() {
  for (const docPath of possibleDocPaths) {
    if (existsSync(docPath)) {
      return docPath;
    }
  }
  return null;
}

export function getDocumentationResources() {
  const docsPath = findDocsPath();
  
  if (!docsPath) {
    return [];
  }

  const resources = [];
  
  // Helper to recursively find markdown files
  function scanDirectory(dir, baseUri = '') {
    try {
      const items = readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stats = statSync(fullPath);
        
        if (stats.isDirectory()) {
          // Recurse into subdirectories
          scanDirectory(fullPath, path.join(baseUri, item));
        } else if (item.endsWith('.md')) {
          // Create resource for markdown file
          const uri = `docs://${path.join(baseUri, item)}`;
          const name = item.replace('.md', '').replace(/_/g, ' ');
          
          // Determine category based on path
          let category = 'Documentation';
          if (baseUri.includes('juce')) {
            category = 'JUCE Documentation';
          } else if (baseUri.includes('supercollider')) {
            category = 'SuperCollider Documentation';
          }
          
          resources.push({
            uri,
            name,
            description: `${category}: ${name}`,
            mimeType: 'text/markdown',
            metadata: {
              category,
              path: fullPath,
              relativePath: path.join(baseUri, item)
            }
          });
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dir}:`, error.message);
    }
  }
  
  scanDirectory(docsPath);
  
  // Add special resource for the index
  if (existsSync(path.join(docsPath, 'README.md'))) {
    resources.unshift({
      uri: 'docs://index',
      name: 'Documentation Index',
      description: 'Main documentation index with quick references',
      mimeType: 'text/markdown',
      metadata: {
        category: 'Documentation',
        path: path.join(docsPath, 'README.md'),
        relativePath: 'README.md'
      }
    });
  }
  
  return resources;
}

export function readDocumentationResource(uri) {
  if (!uri.startsWith('docs://')) {
    throw new Error('Invalid documentation URI');
  }
  
  const docsPath = findDocsPath();
  if (!docsPath) {
    throw new Error('Documentation directory not found');
  }
  
  // Handle special case for index
  if (uri === 'docs://index') {
    const indexPath = path.join(docsPath, 'README.md');
    if (existsSync(indexPath)) {
      return {
        uri,
        mimeType: 'text/markdown',
        text: readFileSync(indexPath, 'utf-8')
      };
    }
  }
  
  // Extract relative path from URI
  const relativePath = uri.replace('docs://', '');
  const fullPath = path.join(docsPath, relativePath);
  
  // Security check - ensure we're not reading outside docs directory
  if (!fullPath.startsWith(docsPath)) {
    throw new Error('Invalid resource path');
  }
  
  if (!existsSync(fullPath)) {
    throw new Error(`Resource not found: ${uri}`);
  }
  
  return {
    uri,
    mimeType: 'text/markdown',
    text: readFileSync(fullPath, 'utf-8')
  };
}

// Export functions to check if docs are available
export function hasDocumentation() {
  return findDocsPath() !== null;
}

export function getDocumentationPath() {
  return findDocsPath();
}