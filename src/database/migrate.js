#!/usr/bin/env node
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabases } from './init.js';
import { recordDecision, trackProgress } from './dataAccess.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

// Migrate JSON data to new databases
export async function migrateFromJSON() {
  console.log('🚀 Starting migration from JSON to SQLite + LanceDB...\n');
  
  // Initialize databases
  console.log('📊 Initializing databases...');
  await initDatabases();
  
  // Get all JSON files
  const jsonFiles = readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  
  if (jsonFiles.length === 0) {
    console.log('ℹ️ No JSON files to migrate');
    return { migrated: 0, errors: [] };
  }
  
  let totalMigrated = 0;
  const errors = [];
  
  for (const file of jsonFiles) {
    const filePath = path.join(DATA_DIR, file);
    console.log(`\n📄 Processing ${file}...`);
    
    try {
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      
      // Determine file type and project
      const parts = file.replace('.json', '').split('_');
      const project = parts[0] || 'default';
      const dataType = parts[1] || 'unknown';
      
      if (dataType === 'decisions' && Array.isArray(data)) {
        console.log(`  → Migrating ${data.length} decisions for project "${project}"`);
        
        for (const decision of data) {
          try {
            await recordDecision({
              decision: decision.decision,
              context: decision.context,
              alternatives: decision.alternatives,
              impact: decision.impact,
              project: project
            });
            totalMigrated++;
            process.stdout.write('.');
          } catch (err) {
            errors.push({
              file: file,
              item: decision.decision,
              error: err.message
            });
            process.stdout.write('x');
          }
        }
        console.log('\n  ✅ Decisions migrated');
      }
      
      else if (dataType === 'progress' && Array.isArray(data)) {
        console.log(`  → Migrating ${data.length} progress items for project "${project}"`);
        
        for (const progress of data) {
          try {
            await trackProgress({
              milestone: progress.milestone,
              status: progress.status,
              notes: progress.notes,
              blockers: progress.blockers,
              project: project
            });
            totalMigrated++;
            process.stdout.write('.');
          } catch (err) {
            errors.push({
              file: file,
              item: progress.milestone,
              error: err.message
            });
            process.stdout.write('x');
          }
        }
        console.log('\n  ✅ Progress items migrated');
      }
      
      else {
        console.log(`  ⚠️ Unknown data type: ${dataType}`);
      }
      
      // Create backup of original JSON
      const backupPath = path.join(DATA_DIR, 'backups', file);
      const backupDir = path.join(DATA_DIR, 'backups');
      
      if (!existsSync(backupDir)) {
        const { mkdirSync } = await import('fs');
        mkdirSync(backupDir, { recursive: true });
      }
      
      writeFileSync(backupPath, readFileSync(filePath));
      console.log(`  📦 Backup created: backups/${file}`);
      
    } catch (error) {
      console.error(`  ❌ Error processing ${file}:`, error.message);
      errors.push({
        file: file,
        error: error.message
      });
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Summary:');
  console.log(`  ✅ Successfully migrated: ${totalMigrated} items`);
  console.log(`  ❌ Errors: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log('\n⚠️ Migration errors:');
    errors.forEach(e => {
      console.log(`  - ${e.file}: ${e.item || 'N/A'} - ${e.error}`);
    });
  }
  
  console.log('\n✨ Migration complete!');
  console.log('💡 Original JSON files have been backed up to data/backups/');
  
  return {
    migrated: totalMigrated,
    errors: errors
  };
}

// Test migration with sample data
export async function testMigration() {
  console.log('🧪 Testing migration with sample data...\n');
  
  // Create test data
  const testDecisions = [
    {
      decision: 'Use TypeScript for type safety',
      context: 'Team needs better code reliability',
      alternatives: ['JavaScript with JSDoc', 'Flow'],
      impact: 'Improved developer experience',
      project: 'test_project'
    },
    {
      decision: 'Implement REST API',
      context: 'Need standard API architecture',
      alternatives: ['GraphQL', 'gRPC'],
      impact: 'Simple integration for clients',
      project: 'test_project'
    }
  ];
  
  const testProgress = [
    {
      milestone: 'Authentication System',
      status: 'completed',
      notes: 'OAuth2 integration complete',
      blockers: [],
      project: 'test_project'
    },
    {
      milestone: 'Database Migration',
      status: 'in_progress',
      notes: 'Moving from JSON to SQLite',
      blockers: ['Need to test performance'],
      project: 'test_project'
    }
  ];
  
  // Initialize databases
  await initDatabases();
  
  console.log('📝 Inserting test decisions...');
  for (const decision of testDecisions) {
    const result = await recordDecision(decision);
    console.log(`  ✅ Decision recorded: ID ${result.id}`);
  }
  
  console.log('\n📊 Inserting test progress...');
  for (const progress of testProgress) {
    const result = await trackProgress(progress);
    console.log(`  ✅ Progress tracked: ID ${result}`);
  }
  
  console.log('\n✨ Test migration complete!');
  console.log('💡 Check data/devassist.db and data/vectors/ for results');
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  if (command === 'test') {
    testMigration()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('❌ Test migration failed:', error);
        process.exit(1);
      });
  } else {
    migrateFromJSON()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('❌ Migration failed:', error);
        process.exit(1);
      });
  }
}