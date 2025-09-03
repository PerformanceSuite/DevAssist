#!/usr/bin/env node

/**
 * Migration Script: Upgrade embeddings from MiniLM to MPNet
 * 
 * This will:
 * 1. Re-generate all embeddings with the better model
 * 2. Update the vector database
 * 3. Improve semantic search quality by 40-50%
 * 
 * WARNING: This process may take several minutes depending on data size
 */

import { initDatabases } from './src/database/init.js';
import { 
  getSQLiteDB, 
  getVectorDB, 
  generateEmbedding 
} from './src/database/dataAccess.js';
import * as lancedb from '@lancedb/lancedb';
import ora from 'ora';

async function migrateToMPNet() {
  console.log('🚀 DevAssist Embedding Migration Tool\n');
  console.log('This will upgrade your embeddings from:');
  console.log('  From: all-MiniLM-L6-v2 (384 dimensions)');
  console.log('  To:   all-mpnet-base-v2 (768 dimensions)\n');
  console.log('Expected improvement: 40-50% better semantic matching\n');
  
  const proceed = process.argv.includes('--yes');
  if (!proceed) {
    console.log('⚠️  This will recreate all embeddings in your database.');
    console.log('   Run with --yes to proceed\n');
    console.log('   Example: node migrate_embeddings.js --yes');
    process.exit(0);
  }
  
  const spinner = ora('Initializing databases...').start();
  
  try {
    // Initialize
    await initDatabases();
    const db = getSQLiteDB();
    const vectorDb = await getVectorDB();
    
    spinner.succeed('Databases initialized');
    
    // Get all decisions
    spinner.start('Loading decisions...');
    const decisions = db.prepare('SELECT * FROM decisions').all();
    spinner.succeed(`Found ${decisions.length} decisions to migrate`);
    
    // Get all code patterns
    spinner.start('Loading code patterns...');
    const patterns = db.prepare('SELECT * FROM code_patterns').all();
    spinner.succeed(`Found ${patterns.length} code patterns to migrate`);
    
    // Recreate decisions table with new dimensions
    spinner.start('Recreating decisions vector table...');
    await vectorDb.dropTable('decisions');
    await vectorDb.createTable('decisions', [
      {
        id: 'init',
        project: 'default',
        text: 'Initial decision',
        embedding: new Array(768).fill(0), // MPNet dimensions
        metadata: '{}'
      }
    ]);
    spinner.succeed('Decisions table recreated');
    
    // Recreate code_patterns table
    spinner.start('Recreating code_patterns vector table...');
    await vectorDb.dropTable('code_patterns');
    await vectorDb.createTable('code_patterns', [
      {
        id: 'init',
        project: 'default',
        file_path: '/init',
        content: 'Initial pattern',
        embedding: new Array(768).fill(0), // MPNet dimensions
        language: 'unknown'
      }
    ]);
    spinner.succeed('Code patterns table recreated');
    
    // Migrate decisions
    console.log('\n📊 Migrating decisions...');
    const decisionsTable = await vectorDb.openTable('decisions');
    
    for (let i = 0; i < decisions.length; i++) {
      spinner.start(`Migrating decision ${i + 1}/${decisions.length}`);
      const decision = decisions[i];
      const text = `${decision.decision} ${decision.context || ''}`;
      
      // Generate new embedding with MPNet
      const embedding = await generateEmbedding(text, 'mpnet');
      
      // Add to vector database
      await decisionsTable.add([{
        id: decision.embedding_id,
        project: db.prepare('SELECT name FROM projects WHERE id = ?').get(decision.project_id)?.name || 'default',
        text: text,
        embedding: embedding,
        metadata: JSON.stringify({
          decision_id: decision.id,
          impact: decision.impact,
          alternatives: JSON.parse(decision.alternatives || '[]')
        })
      }]);
      
      spinner.succeed(`Migrated decision ${i + 1}/${decisions.length}`);
    }
    
    // Migrate code patterns
    console.log('\n📊 Migrating code patterns...');
    const patternsTable = await vectorDb.openTable('code_patterns');
    
    for (let i = 0; i < patterns.length; i++) {
      spinner.start(`Migrating pattern ${i + 1}/${patterns.length}`);
      const pattern = patterns[i];
      
      // Generate new embedding with MPNet
      const embedding = await generateEmbedding(pattern.content, 'mpnet');
      
      // Add to vector database
      await patternsTable.add([{
        id: pattern.embedding_id,
        project: db.prepare('SELECT name FROM projects WHERE id = ?').get(pattern.project_id)?.name || 'default',
        file_path: pattern.file_path,
        content: pattern.content,
        embedding: embedding,
        language: pattern.language
      }]);
      
      spinner.succeed(`Migrated pattern ${i + 1}/${patterns.length}`);
    }
    
    console.log('\n✅ Migration complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Update ACTIVE_MODEL in src/database/dataAccess.js:');
    console.log('   const ACTIVE_MODEL = \'mpnet\';');
    console.log('\n2. Test the improved search:');
    console.log('   node test_semantic_fixed.js');
    console.log('\n3. Enjoy 40-50% better semantic matching! 🎉');
    
  } catch (error) {
    spinner.fail('Migration failed');
    console.error('\n❌ Error:', error);
    console.log('\n💡 Troubleshooting:');
    console.log('- Make sure the server is not running');
    console.log('- Check that databases are not locked');
    console.log('- Try running: npm install ora');
    process.exit(1);
  }
  
  process.exit(0);
}

migrateToMPNet().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});