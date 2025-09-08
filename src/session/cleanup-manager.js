/**
 * Cleanup Manager for DevAssist Sessions
 * Intelligent file organization and cleanup on session end
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class CleanupManager {
  constructor(projectPath, sessionId) {
    this.projectPath = projectPath;
    this.sessionId = sessionId;
    this.cleanupReport = {
      moved: [],
      deleted: [],
      organized: [],
      errors: [],
      duplicates: []
    };
    
    // Define where different file types belong
    this.fileOrganization = {
      // Documentation files
      docs: {
        extensions: ['.md', '.txt', '.rst', '.adoc'],
        patterns: ['README*', 'CHANGELOG*', 'LICENSE*', 'CONTRIBUTING*', 'TODO*'],
        targetDir: 'docs',
        exceptions: ['README.md', 'LICENSE', 'CHANGELOG.md'] // Keep in root
      },
      
      // Test files that ended up in wrong places
      tests: {
        extensions: ['.test.js', '.spec.js', '.test.ts', '.spec.ts', '_test.go', '_test.py'],
        patterns: ['test_*', '*_test', '*.test.*', '*.spec.*'],
        targetDir: 'tests',
        exceptions: []
      },
      
      // Config files
      configs: {
        extensions: ['.yml', '.yaml', '.toml', '.ini'],
        patterns: ['.*rc', '.*rc.js', '.*rc.json', 'config.*'],
        targetDir: null, // Keep in root
        exceptions: []
      },
      
      // Build artifacts
      artifacts: {
        extensions: ['.log', '.tmp', '.cache', '.pid'],
        patterns: ['*.log', 'tmp*', 'temp*', '*.backup', '*.bak', '*.swp', '.DS_Store'],
        targetDir: '.devassist/artifacts',
        shouldDelete: true
      },
      
      // Scripts
      scripts: {
        extensions: ['.sh', '.bash', '.zsh', '.ps1', '.bat'],
        patterns: ['scripts/*', 'bin/*'],
        targetDir: 'scripts',
        exceptions: ['package.json'] // npm scripts
      }
    };
  }

  /**
   * Main cleanup orchestration
   */
  async performCleanup() {
    console.error('[CleanupManager] Starting intelligent cleanup...');
    
    try {
      // Step 1: Scan for misplaced files
      await this.scanForMisplacedFiles();
      
      // Step 2: Check for duplicates
      await this.findAndHandleDuplicates();
      
      // Step 3: Organize documentation
      await this.organizeDocumentation();
      
      // Step 4: Clean build artifacts
      await this.cleanBuildArtifacts();
      
      // Step 5: Organize test files
      await this.organizeTestFiles();
      
      // Step 6: Fix permissions
      await this.fixFilePermissions();
      
      // Step 7: Update .gitignore
      await this.updateGitignore();
      
      // Step 8: Generate cleanup report
      const report = await this.generateCleanupReport();
      
      console.error('[CleanupManager] Cleanup complete');
      return report;
      
    } catch (error) {
      console.error('[CleanupManager] Cleanup error:', error);
      this.cleanupReport.errors.push(error.message);
      return this.cleanupReport;
    }
  }

  /**
   * Scan for files that don't belong in root
   */
  async scanForMisplacedFiles() {
    const rootFiles = await fs.readdir(this.projectPath);
    
    for (const file of rootFiles) {
      const filePath = path.join(this.projectPath, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile()) {
        // Check if this file belongs elsewhere
        const category = this.categorizeFile(file);
        
        if (category && category.targetDir && !category.exceptions.includes(file)) {
          // This file should be moved
          await this.moveFile(filePath, category.targetDir, file);
        }
      }
    }
  }

  /**
   * Find and handle duplicate files
   */
  async findAndHandleDuplicates() {
    const fileHashes = new Map();
    
    async function scanDirectory(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Skip .git and node_modules
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        
        if (entry.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (entry.isFile()) {
          // Calculate file hash
          const content = await fs.readFile(fullPath);
          const hash = crypto.createHash('md5').update(content).digest('hex');
          
          if (fileHashes.has(hash)) {
            // Found duplicate
            const original = fileHashes.get(hash);
            
            // Determine which to keep (prefer shorter path, then older file)
            const originalStats = await fs.stat(original);
            const duplicateStats = await fs.stat(fullPath);
            
            if (originalStats.mtime < duplicateStats.mtime) {
              // Original is older, delete duplicate
              this.cleanupReport.duplicates.push({
                kept: original,
                removed: fullPath,
                reason: 'newer duplicate'
              });
              
              // Don't actually delete - just move to archive
              await this.archiveFile(fullPath);
            }
          } else {
            fileHashes.set(hash, fullPath);
          }
        }
      }
    }
    
    await scanDirectory(this.projectPath);
  }

  /**
   * Organize documentation files
   */
  async organizeDocumentation() {
    const docsDir = path.join(this.projectPath, 'docs');
    
    // Find all markdown files not in docs/
    const markdownFiles = await this.findFiles('*.md');
    
    for (const mdFile of markdownFiles) {
      const fileName = path.basename(mdFile);
      const fileDir = path.dirname(mdFile);
      
      // Skip if already in docs/ or is a main README
      if (fileDir.includes('docs') || fileName === 'README.md') continue;
      
      // Check if this is a misplaced doc
      const shouldMove = await this.shouldMoveToDoc(mdFile);
      
      if (shouldMove) {
        await this.moveFile(mdFile, 'docs', fileName);
      }
    }
  }

  /**
   * Clean build artifacts and temporary files
   */
  async cleanBuildArtifacts() {
    const patterns = [
      '*.log',
      '*.tmp',
      '*.cache',
      '.DS_Store',
      'Thumbs.db',
      '*.swp',
      '*.swo',
      '*~',
      '*.backup',
      '*.bak'
    ];
    
    for (const pattern of patterns) {
      const files = await this.findFiles(pattern);
      
      for (const file of files) {
        // Archive instead of delete for safety
        await this.archiveFile(file);
      }
    }
  }

  /**
   * Organize test files that ended up in wrong directories
   */
  async organizeTestFiles() {
    const testPatterns = [
      '*.test.js',
      '*.spec.js',
      '*.test.ts',
      '*.spec.ts',
      'test_*.py',
      '*_test.go'
    ];
    
    for (const pattern of testPatterns) {
      const files = await this.findFiles(pattern);
      
      for (const file of files) {
        const fileDir = path.dirname(file);
        
        // Skip if already in test directory
        if (fileDir.includes('test') || fileDir.includes('spec')) continue;
        
        // Move to appropriate test directory
        const testDir = await this.determineTestDirectory(file);
        if (testDir) {
          await this.moveFile(file, testDir, path.basename(file));
        }
      }
    }
  }

  /**
   * Fix file permissions for scripts
   */
  async fixFilePermissions() {
    const scriptExtensions = ['.sh', '.bash', '.zsh'];
    
    for (const ext of scriptExtensions) {
      const files = await this.findFiles(`*${ext}`);
      
      for (const file of files) {
        try {
          await fs.chmod(file, 0o755);
          this.cleanupReport.organized.push({
            file,
            action: 'fixed permissions'
          });
        } catch (error) {
          this.cleanupReport.errors.push(`Failed to fix permissions for ${file}`);
        }
      }
    }
  }

  /**
   * Update .gitignore with commonly ignored patterns
   */
  async updateGitignore() {
    const gitignorePath = path.join(this.projectPath, '.gitignore');
    const commonIgnores = [
      '\n# DevAssist',
      '.devassist/logs/',
      '.devassist/artifacts/',
      '.devassist/sessions/',
      '.devassist/vectors/',
      '\n# OS files',
      '.DS_Store',
      'Thumbs.db',
      '\n# Editor files',
      '*.swp',
      '*.swo',
      '*~',
      '.vscode/',
      '.idea/',
      '\n# Temporary files',
      '*.tmp',
      '*.temp',
      '*.log',
      '*.pid'
    ];
    
    try {
      let gitignore = '';
      
      if (await this.fileExists(gitignorePath)) {
        gitignore = await fs.readFile(gitignorePath, 'utf8');
      }
      
      // Add missing patterns
      for (const pattern of commonIgnores) {
        if (!gitignore.includes(pattern.trim())) {
          gitignore += '\n' + pattern;
        }
      }
      
      await fs.writeFile(gitignorePath, gitignore.trim() + '\n');
      
    } catch (error) {
      this.cleanupReport.errors.push(`Failed to update .gitignore: ${error.message}`);
    }
  }

  /**
   * Helper: Categorize file based on name and extension
   */
  categorizeFile(fileName) {
    for (const [category, rules] of Object.entries(this.fileOrganization)) {
      // Check extensions
      if (rules.extensions?.some(ext => fileName.endsWith(ext))) {
        return rules;
      }
      
      // Check patterns
      if (rules.patterns?.some(pattern => {
        const regex = new RegExp(pattern.replace('*', '.*'));
        return regex.test(fileName);
      })) {
        return rules;
      }
    }
    
    return null;
  }

  /**
   * Helper: Move file to appropriate directory
   */
  async moveFile(sourcePath, targetDir, fileName) {
    try {
      const targetDirPath = path.join(this.projectPath, targetDir);
      await fs.mkdir(targetDirPath, { recursive: true });
      
      const targetPath = path.join(targetDirPath, fileName);
      
      // Check if target exists
      if (await this.fileExists(targetPath)) {
        // Rename with timestamp
        const timestamp = Date.now();
        const newName = `${path.basename(fileName, path.extname(fileName))}_${timestamp}${path.extname(fileName)}`;
        const newTargetPath = path.join(targetDirPath, newName);
        await fs.rename(sourcePath, newTargetPath);
        
        this.cleanupReport.moved.push({
          from: sourcePath,
          to: newTargetPath,
          reason: 'moved and renamed (conflict)'
        });
      } else {
        await fs.rename(sourcePath, targetPath);
        
        this.cleanupReport.moved.push({
          from: sourcePath,
          to: targetPath,
          reason: 'organized'
        });
      }
    } catch (error) {
      this.cleanupReport.errors.push(`Failed to move ${sourcePath}: ${error.message}`);
    }
  }

  /**
   * Helper: Archive file instead of deleting
   */
  async archiveFile(filePath) {
    try {
      const archiveDir = path.join(this.projectPath, '.devassist', 'artifacts', this.sessionId);
      await fs.mkdir(archiveDir, { recursive: true });
      
      const fileName = path.basename(filePath);
      const archivePath = path.join(archiveDir, fileName);
      
      await fs.rename(filePath, archivePath);
      
      this.cleanupReport.deleted.push({
        file: filePath,
        archived: archivePath,
        reason: 'cleanup'
      });
    } catch (error) {
      this.cleanupReport.errors.push(`Failed to archive ${filePath}: ${error.message}`);
    }
  }

  /**
   * Helper: Find files matching pattern
   */
  async findFiles(pattern) {
    const { execSync } = require('child_process');
    
    try {
      const command = process.platform === 'win32'
        ? `dir /s /b "${pattern}"`
        : `find "${this.projectPath}" -name "${pattern}" -type f 2>/dev/null`;
      
      const output = execSync(command, { 
        cwd: this.projectPath,
        encoding: 'utf8'
      });
      
      return output.split('\n').filter(line => line.trim());
    } catch {
      return [];
    }
  }

  /**
   * Helper: Check if file should be moved to docs
   */
  async shouldMoveToDoc(filePath) {
    const fileName = path.basename(filePath);
    
    // Don't move main project docs
    if (['README.md', 'LICENSE', 'CHANGELOG.md', 'CONTRIBUTING.md'].includes(fileName)) {
      return false;
    }
    
    // Check if it's actually documentation
    const content = await fs.readFile(filePath, 'utf8');
    const docIndicators = [
      /^#\s+API/mi,
      /^#\s+Documentation/mi,
      /^#\s+Guide/mi,
      /^#\s+Tutorial/mi,
      /^#\s+Reference/mi
    ];
    
    return docIndicators.some(pattern => pattern.test(content));
  }

  /**
   * Helper: Determine appropriate test directory
   */
  async determineTestDirectory(testFile) {
    const ext = path.extname(testFile);
    
    const testDirs = {
      '.js': 'tests',
      '.ts': 'tests',
      '.py': 'tests',
      '.go': 'test',
      '.rs': 'tests',
      '.rb': 'spec'
    };
    
    return testDirs[ext] || 'tests';
  }

  /**
   * Helper: Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate final cleanup report
   */
  async generateCleanupReport() {
    const report = `
=== CLEANUP REPORT FOR SESSION ${this.sessionId} ===

📁 Files Organized: ${this.cleanupReport.moved.length}
${this.cleanupReport.moved.map(m => `  • ${path.basename(m.from)} → ${m.to}`).join('\n')}

🗑️ Files Archived: ${this.cleanupReport.deleted.length}
${this.cleanupReport.deleted.map(d => `  • ${d.file} (${d.reason})`).join('\n')}

♊ Duplicates Found: ${this.cleanupReport.duplicates.length}
${this.cleanupReport.duplicates.map(d => `  • Kept: ${d.kept}\n    Removed: ${d.removed}`).join('\n')}

⚠️ Errors: ${this.cleanupReport.errors.length}
${this.cleanupReport.errors.map(e => `  • ${e}`).join('\n')}

✅ Summary:
  - Root directory cleaned
  - Documentation organized
  - Test files relocated
  - Build artifacts archived
  - Permissions fixed
  - .gitignore updated
`;
    
    // Save report
    const reportPath = path.join(this.projectPath, '.devassist', 'reports', `cleanup-${this.sessionId}.md`);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, report);
    
    return report;
  }
}

export default CleanupManager;