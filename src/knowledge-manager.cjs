#!/usr/bin/env node
/**
 * DevAssist Knowledge Management System
 * Handles export, import, backup, and migration of project knowledge
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class KnowledgeManager {
  constructor(projectPath = process.cwd()) {
    this.projectPath = projectPath;
    this.devassistPath = path.join(projectPath, '.devassist');
    this.knowledgePath = path.join(this.devassistPath, 'knowledge');
    this.backupPath = path.join(this.devassistPath, 'backups');
  }

  /**
   * Export all knowledge to a portable format
   */
  async exportKnowledge(outputPath) {
    const timestamp = new Date().toISOString();
    const exportData = {
      version: '2.1',
      exported_at: timestamp,
      project: path.basename(this.projectPath),
      knowledge: {},
      statistics: {}
    };

    // Read all knowledge files
    const knowledgeFiles = [
      'decisions.json',
      'patterns.json', 
      'lessons.json',
      'progress.json'
    ];

    for (const file of knowledgeFiles) {
      const filePath = path.join(this.knowledgePath, file);
      try {
        const data = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(data);
        const key = file.replace('.json', '');
        
        exportData.knowledge[key] = parsed[key] || parsed;
        exportData.statistics[key] = Array.isArray(parsed[key]) ? parsed[key].length : 0;
      } catch (error) {
        console.log(`  ⚠ Could not export ${file}: ${error.message}`);
        exportData.knowledge[file.replace('.json', '')] = [];
      }
    }

    // Add metadata
    exportData.metadata = await this.gatherMetadata();

    // Calculate checksum
    exportData.checksum = this.calculateChecksum(exportData.knowledge);

    // Write export file
    const exportPath = outputPath || path.join(
      this.projectPath,
      `devassist-export-${Date.now()}.json`
    );

    await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));

    console.log(`\n✅ Knowledge exported to: ${exportPath}`);
    console.log(`   Total items: ${Object.values(exportData.statistics).reduce((a, b) => a + b, 0)}`);
    
    return exportPath;
  }

  /**
   * Import knowledge from an export file
   */
  async importKnowledge(importPath, options = {}) {
    const { merge = true, overwrite = false, backup = true } = options;

    console.log('\n📥 Importing knowledge...');

    // Read import file
    const importData = JSON.parse(await fs.readFile(importPath, 'utf8'));

    // Verify checksum
    const calculatedChecksum = this.calculateChecksum(importData.knowledge);
    if (calculatedChecksum !== importData.checksum) {
      console.warn('  ⚠ Checksum mismatch - data may have been modified');
    }

    // Backup existing if requested
    if (backup && await this.hasExistingKnowledge()) {
      await this.backupKnowledge();
    }

    // Ensure knowledge directory exists
    await fs.mkdir(this.knowledgePath, { recursive: true });

    // Import each knowledge type
    for (const [type, data] of Object.entries(importData.knowledge)) {
      const filePath = path.join(this.knowledgePath, `${type}.json`);
      
      let finalData = data;

      if (!overwrite && merge) {
        // Merge with existing
        try {
          const existing = JSON.parse(await fs.readFile(filePath, 'utf8'));
          finalData = await this.mergeKnowledge(existing[type] || existing, data);
          console.log(`  ✓ Merged ${type}: ${finalData.length} items`);
        } catch (error) {
          // No existing file, use import data
          console.log(`  ✓ Imported ${type}: ${Array.isArray(data) ? data.length : 0} items`);
        }
      } else {
        console.log(`  ✓ ${overwrite ? 'Replaced' : 'Imported'} ${type}: ${Array.isArray(data) ? data.length : 0} items`);
      }

      // Write to file
      const fileData = {
        [type]: Array.isArray(finalData) ? finalData : [],
        last_updated: new Date().toISOString(),
        imported_from: importData.project,
        import_date: new Date().toISOString()
      };

      await fs.writeFile(filePath, JSON.stringify(fileData, null, 2));
    }

    console.log('\n✅ Knowledge import complete!');
  }

  /**
   * Backup current knowledge
   */
  async backupKnowledge() {
    await fs.mkdir(this.backupPath, { recursive: true });

    const timestamp = Date.now();
    const backupDir = path.join(this.backupPath, `backup-${timestamp}`);
    await fs.mkdir(backupDir);

    // Copy all knowledge files
    try {
      const files = await fs.readdir(this.knowledgePath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const src = path.join(this.knowledgePath, file);
          const dest = path.join(backupDir, file);
          await fs.copyFile(src, dest);
        }
      }
      console.log(`  ✓ Backup created: ${backupDir}`);
      return backupDir;
    } catch (error) {
      console.error(`  ✗ Backup failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupDir) {
    console.log(`\n♻️ Restoring from backup: ${backupDir}`);

    // Verify backup exists
    try {
      await fs.access(backupDir);
    } catch {
      throw new Error(`Backup directory not found: ${backupDir}`);
    }

    // Backup current state first
    const currentBackup = await this.backupKnowledge();
    
    // Restore files
    const files = await fs.readdir(backupDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const src = path.join(backupDir, file);
        const dest = path.join(this.knowledgePath, file);
        await fs.copyFile(src, dest);
        console.log(`  ✓ Restored ${file}`);
      }
    }

    console.log('\n✅ Restore complete!');
    if (currentBackup) {
      console.log(`   Previous state backed up to: ${currentBackup}`);
    }
  }

  /**
   * List all backups
   */
  async listBackups() {
    try {
      const backups = await fs.readdir(this.backupPath);
      const backupInfo = [];

      for (const backup of backups) {
        if (backup.startsWith('backup-')) {
          const backupDir = path.join(this.backupPath, backup);
          const stats = await fs.stat(backupDir);
          
          // Count items
          let itemCount = 0;
          try {
            const files = await fs.readdir(backupDir);
            for (const file of files) {
              if (file.endsWith('.json')) {
                const content = await fs.readFile(path.join(backupDir, file), 'utf8');
                const data = JSON.parse(content);
                const key = file.replace('.json', '');
                itemCount += Array.isArray(data[key]) ? data[key].length : 0;
              }
            }
          } catch {}

          backupInfo.push({
            name: backup,
            date: stats.mtime,
            items: itemCount,
            path: backupDir
          });
        }
      }

      return backupInfo.sort((a, b) => b.date - a.date);
    } catch {
      return [];
    }
  }

  /**
   * Merge knowledge intelligently (deduplication)
   */
  async mergeKnowledge(existing, incoming) {
    const merged = [...existing];
    const seen = new Set();

    // Create hashes of existing items
    for (const item of existing) {
      seen.add(this.hashItem(item));
    }

    // Add non-duplicate incoming items
    for (const item of incoming) {
      const hash = this.hashItem(item);
      if (!seen.has(hash)) {
        seen.add(hash);
        merged.push({
          ...item,
          imported: true,
          import_date: new Date().toISOString()
        });
      }
    }

    return merged;
  }

  /**
   * Calculate checksum for integrity
   */
  calculateChecksum(data) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }

  /**
   * Hash item for deduplication
   */
  hashItem(item) {
    // Remove timestamps for comparison
    const itemCopy = { ...item };
    delete itemCopy.timestamp;
    delete itemCopy.created_at;
    delete itemCopy.updated_at;
    delete itemCopy.imported;
    delete itemCopy.import_date;
    
    const hash = crypto.createHash('md5');
    hash.update(JSON.stringify(itemCopy));
    return hash.digest('hex');
  }

  /**
   * Check if knowledge exists
   */
  async hasExistingKnowledge() {
    try {
      await fs.access(this.knowledgePath);
      const files = await fs.readdir(this.knowledgePath);
      return files.some(f => f.endsWith('.json'));
    } catch {
      return false;
    }
  }

  /**
   * Gather project metadata
   */
  async gatherMetadata() {
    const metadata = {
      project_path: this.projectPath,
      project_name: path.basename(this.projectPath),
      export_date: new Date().toISOString()
    };

    // Try to read project.json
    try {
      const projectJson = await fs.readFile(
        path.join(this.devassistPath, 'project.json'),
        'utf8'
      );
      const projectData = JSON.parse(projectJson);
      metadata.project_type = projectData.type;
      metadata.devassist_version = projectData.version;
    } catch {}

    return metadata;
  }

  /**
   * Generate knowledge statistics
   */
  async getStatistics() {
    const stats = {
      decisions: 0,
      patterns: 0,
      lessons: 0,
      progress: 0,
      total: 0,
      oldest: null,
      newest: null
    };

    const knowledgeFiles = ['decisions', 'patterns', 'lessons', 'progress'];

    for (const type of knowledgeFiles) {
      try {
        const filePath = path.join(this.knowledgePath, `${type}.json`);
        const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
        const items = data[type] || [];
        stats[type] = items.length;
        stats.total += items.length;

        // Find oldest and newest
        for (const item of items) {
          const date = item.timestamp || item.created_at || item.date;
          if (date) {
            if (!stats.oldest || date < stats.oldest) stats.oldest = date;
            if (!stats.newest || date > stats.newest) stats.newest = date;
          }
        }
      } catch {}
    }

    return stats;
  }
}

// CLI Interface
if (require.main === module) {
  const manager = new KnowledgeManager();
  const command = process.argv[2];
  const arg = process.argv[3];

  (async () => {
    try {
      switch (command) {
        case 'export':
          await manager.exportKnowledge(arg);
          break;
          
        case 'import':
          if (!arg) throw new Error('Import file path required');
          await manager.importKnowledge(arg);
          break;
          
        case 'backup':
          await manager.backupKnowledge();
          break;
          
        case 'restore':
          if (!arg) throw new Error('Backup directory required');
          await manager.restoreFromBackup(arg);
          break;
          
        case 'list-backups':
          const backups = await manager.listBackups();
          console.log('\n📦 Available Backups:');
          for (const backup of backups) {
            console.log(`  • ${backup.name} - ${backup.date.toLocaleString()} (${backup.items} items)`);
          }
          break;
          
        case 'stats':
          const stats = await manager.getStatistics();
          console.log('\n📊 Knowledge Statistics:');
          console.log(`  • Decisions: ${stats.decisions}`);
          console.log(`  • Patterns: ${stats.patterns}`);
          console.log(`  • Lessons: ${stats.lessons}`);
          console.log(`  • Progress: ${stats.progress}`);
          console.log(`  • Total: ${stats.total} items`);
          if (stats.oldest) {
            console.log(`  • Date range: ${stats.oldest} to ${stats.newest}`);
          }
          break;
          
        default:
          console.log(`
DevAssist Knowledge Manager

Usage:
  node knowledge-manager.js export [output-file]     Export knowledge
  node knowledge-manager.js import <input-file>      Import knowledge
  node knowledge-manager.js backup                   Backup current knowledge
  node knowledge-manager.js restore <backup-dir>     Restore from backup
  node knowledge-manager.js list-backups             List available backups
  node knowledge-manager.js stats                    Show knowledge statistics
          `);
      }
    } catch (error) {
      console.error(`\n❌ Error: ${error.message}`);
      process.exit(1);
    }
  })();
}

module.exports = { KnowledgeManager };
