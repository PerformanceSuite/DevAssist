#!/usr/bin/env node
import { performance } from 'perf_hooks';
import { initDatabases } from '../database/init.js';
import {
  recordDecision,
  trackProgress,
  getProjectMemory,
  semanticSearch,
  identifyDuplicates,
  addCodePattern,
  generateEmbedding,
  closeConnections
} from '../database/dataAccess.js';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

// Benchmark utilities
class Benchmark {
  constructor(name) {
    this.name = name;
    this.results = [];
  }

  async run(fn, iterations = 100) {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }
    
    // Calculate statistics
    times.sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = times[0];
    const max = times[times.length - 1];
    const median = times[Math.floor(times.length / 2)];
    const p95 = times[Math.floor(times.length * 0.95)];
    const p99 = times[Math.floor(times.length * 0.99)];
    
    this.results.push({
      name: this.name,
      iterations,
      avg: avg.toFixed(2),
      min: min.toFixed(2),
      max: max.toFixed(2),
      median: median.toFixed(2),
      p95: p95.toFixed(2),
      p99: p99.toFixed(2)
    });
    
    return this.results[this.results.length - 1];
  }
  
  report() {
    // console.log(`\n📊 Benchmark: ${this.name}`);
    // console.log('━'.repeat(60));
    
    for (const result of this.results) {
      // console.log(`
Iterations: ${result.iterations}
Average:    ${result.avg}ms
Minimum:    ${result.min}ms
Maximum:    ${result.max}ms
Median:     ${result.median}ms
P95:        ${result.p95}ms
P99:        ${result.p99}ms`);
    }
  }
}

// Benchmark tests
async function runBenchmarks() {
  // console.log('🚀 DevAssist Performance Benchmarks');
  // console.log('═'.repeat(60));
  
  // Initialize databases
  // console.log('\n⚙️ Initializing databases...');
  await initDatabases();
  
  const results = {};
  
  // Test 1: Embedding Generation
  // console.log('\n🧪 Testing embedding generation...');
  const embeddingBench = new Benchmark('Embedding Generation');
  
  const testTexts = [
    'Use TypeScript for type safety in the frontend application',
    'Implement REST API with Express.js framework',
    'Add authentication using JWT tokens',
    'Database migration from MongoDB to PostgreSQL',
    'Refactor legacy code to use modern React hooks'
  ];
  
  let textIndex = 0;
  const embeddingResult = await embeddingBench.run(async () => {
    await generateEmbedding(testTexts[textIndex % testTexts.length]);
    textIndex++;
  }, 50);
  
  embeddingBench.report();
  results.embedding = embeddingResult;
  
  // Test 2: Decision Recording
  // console.log('\n🧪 Testing decision recording...');
  const decisionBench = new Benchmark('Decision Recording');
  
  let decisionCount = 0;
  const decisionResult = await decisionBench.run(async () => {
    await recordDecision({
      decision: `Test decision ${decisionCount}`,
      context: `Performance test context ${decisionCount}`,
      alternatives: ['Option A', 'Option B'],
      impact: 'Testing performance',
      project: 'benchmark'
    });
    decisionCount++;
  }, 20);
  
  decisionBench.report();
  results.decisionRecording = decisionResult;
  
  // Test 3: Progress Tracking
  // console.log('\n🧪 Testing progress tracking...');
  const progressBench = new Benchmark('Progress Tracking');
  
  let progressCount = 0;
  const progressResult = await progressBench.run(async () => {
    await trackProgress({
      milestone: `Milestone ${progressCount}`,
      status: 'in_progress',
      notes: `Performance test ${progressCount}`,
      blockers: [],
      project: 'benchmark'
    });
    progressCount++;
  }, 50);
  
  progressBench.report();
  results.progressTracking = progressResult;
  
  // Test 4: Semantic Search
  // console.log('\n🧪 Testing semantic search...');
  const searchBench = new Benchmark('Semantic Search');
  
  const searchQueries = [
    'type safety typescript',
    'authentication security',
    'database migration',
    'REST API design',
    'performance optimization'
  ];
  
  let queryIndex = 0;
  const searchResult = await searchBench.run(async () => {
    await semanticSearch(searchQueries[queryIndex % searchQueries.length], {
      table: 'decisions',
      limit: 10,
      threshold: 0.5
    });
    queryIndex++;
  }, 30);
  
  searchBench.report();
  results.semanticSearch = searchResult;
  
  // Test 5: Project Memory Retrieval
  // console.log('\n🧪 Testing project memory retrieval...');
  const memoryBench = new Benchmark('Project Memory');
  
  const memoryResult = await memoryBench.run(async () => {
    await getProjectMemory('performance', 'all', 10, 'benchmark');
  }, 30);
  
  memoryBench.report();
  results.projectMemory = memoryResult;
  
  // Test 6: Duplicate Detection
  // console.log('\n🧪 Testing duplicate detection...');
  const duplicateBench = new Benchmark('Duplicate Detection');
  
  const features = [
    'user authentication',
    'data validation',
    'error handling',
    'logging system',
    'cache management'
  ];
  
  let featureIndex = 0;
  const duplicateResult = await duplicateBench.run(async () => {
    await identifyDuplicates(features[featureIndex % features.length], '.', 0.7);
    featureIndex++;
  }, 20);
  
  duplicateBench.report();
  results.duplicateDetection = duplicateResult;
  
  // Test 7: Code Pattern Indexing
  // console.log('\n🧪 Testing code pattern indexing...');
  const patternBench = new Benchmark('Code Pattern Indexing');
  
  const sampleCode = `
function authenticate(user, password) {
  if (!user || !password) {
    throw new Error('Missing credentials');
  }
  return jwt.sign({ user }, SECRET_KEY);
}`;
  
  let patternCount = 0;
  const patternResult = await patternBench.run(async () => {
    await addCodePattern(
      `/test/file${patternCount}.js`,
      sampleCode,
      'javascript',
      'benchmark'
    );
    patternCount++;
  }, 20);
  
  patternBench.report();
  results.codePatternIndexing = patternResult;
  
  // Compare with JSON baseline
  // console.log('\n📈 Comparison with JSON Baseline');
  // console.log('━'.repeat(60));
  
  // Simulate JSON operations for comparison
  const jsonBench = new Benchmark('JSON Operations');
  
  const jsonData = [];
  for (let i = 0; i < 100; i++) {
    jsonData.push({
      id: i,
      decision: `Decision ${i}`,
      context: `Context for decision ${i}`,
      timestamp: new Date().toISOString()
    });
  }
  
  // JSON write
  const jsonWriteResult = await jsonBench.run(async () => {
    const newItem = {
      id: jsonData.length,
      decision: `New decision`,
      context: `New context`,
      timestamp: new Date().toISOString()
    };
    jsonData.push(newItem);
  }, 100);
  
  // console.log('\nJSON Write (baseline): ', jsonWriteResult.avg, 'ms avg');
  
  // JSON search
  const jsonSearchResult = await jsonBench.run(async () => {
    const query = 'decision';
    jsonData.filter(item => 
      JSON.stringify(item).toLowerCase().includes(query.toLowerCase())
    );
  }, 100);
  
  // console.log('JSON Search (baseline):', jsonSearchResult.avg, 'ms avg');
  
  // Summary Report
  // console.log('\n📊 Performance Summary');
  // console.log('═'.repeat(60));
  // console.log('\nOperation                    | Avg (ms) | P95 (ms) | P99 (ms)');
  // console.log('─'.repeat(60));
  
  for (const [key, value] of Object.entries(results)) {
    const name = key.replace(/([A-Z])/g, ' $1').trim();
    // console.log(
      `${name.padEnd(28)} | ${value.avg.padStart(8)} | ${value.p95.padStart(8)} | ${value.p99.padStart(8)}`
    );
  }
  
  // Performance improvements
  // console.log('\n🚀 Performance Improvements vs JSON:');
  const searchImprovement = ((parseFloat(jsonSearchResult.avg) / parseFloat(results.semanticSearch.avg)) * 100 - 100).toFixed(1);
  // console.log(`  • Semantic Search: ${searchImprovement}% ${searchImprovement > 0 ? 'faster' : 'slower'} than JSON grep`);
  // console.log(`  • Real similarity scoring vs keyword matching`);
  // console.log(`  • Concurrent access with SQLite WAL mode`);
  // console.log(`  • Indexed queries vs linear search`);
  
  // Save results to file
  const reportPath = path.join(process.cwd(), 'benchmark-results.json');
  writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    results: results,
    comparison: {
      jsonWrite: jsonWriteResult,
      jsonSearch: jsonSearchResult
    }
  }, null, 2));
  
  // console.log(`\n💾 Results saved to: ${reportPath}`);
  
  // Cleanup
  await closeConnections();
  // console.log('\n✅ Benchmarks complete!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBenchmarks()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Benchmark failed:', error);
      process.exit(1);
    });
}