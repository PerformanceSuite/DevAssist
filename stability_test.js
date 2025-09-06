#!/usr/bin/env node
/**
 * DevAssist Stability & Integration Test
 * Tests actual MCP communication and tool functionality
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// console.log('═══════════════════════════════════════════════════════════');
// console.log('         DevAssist Stability & Integration Test            ');
// console.log('═══════════════════════════════════════════════════════════\n');

const tests = [];

// Test 1: MCP Server Launch Test
async function testMCPServerLaunch() {
  // console.log('Test 1: MCP Server Launch');
  // console.log('─────────────────────────');
  
  return new Promise((resolve) => {
    const devassist = spawn('node', [path.join(__dirname, 'index.js')], {
      env: {
        ...process.env,
        DEVASSIST_PROJECT: 'test',
        DEVASSIST_PROJECT_PATH: __dirname,
        DEVASSIST_DATA_PATH: path.join(__dirname, '.devassist-test')
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    let hasError = false;
    
    devassist.stdout.on('data', (data) => {
      stdout += data.toString();
      
      // Check if it's valid JSON-RPC
      const lines = data.toString().split('\n').filter(l => l.trim());
      lines.forEach(line => {
        if (line.trim()) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.jsonrpc) {
              // console.log('  ✓ Valid JSON-RPC response received');
            }
          } catch (e) {
            if (!line.includes('Content-Length:')) {
              // console.log(`  ✗ Invalid JSON output: ${line.substring(0, 50)}...`);
              hasError = true;
            }
          }
        }
      });
    });
    
    devassist.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Send initialization message
    setTimeout(() => {
      const initMessage = JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '1.0.0',
          capabilities: {}
        },
        id: 1
      });
      
      const message = `Content-Length: ${Buffer.byteLength(initMessage)}\r\n\r\n${initMessage}`;
      devassist.stdin.write(message);
    }, 500);
    
    // Check results after 2 seconds
    setTimeout(() => {
      devassist.kill();
      
      if (hasError) {
        // console.log('  Result: FAILED - Protocol violations detected');
        tests.push({ name: 'MCP Server Launch', status: 'FAILED' });
      } else if (stdout.includes('"result"')) {
        // console.log('  Result: PASSED - Server responds correctly');
        tests.push({ name: 'MCP Server Launch', status: 'PASSED' });
      } else {
        // console.log('  Result: WARNING - No response received');
        tests.push({ name: 'MCP Server Launch', status: 'WARNING' });
      }
      
      if (stderr) {
        // console.log(`  Stderr output: ${stderr.split('\n')[0]}...`);
      }
      
      resolve();
    }, 2000);
  });
}

// Test 2: Database Operations Test
async function testDatabaseOperations() {
  // console.log('\nTest 2: Database Operations');
  // console.log('────────────────────────────');
  
  try {
    const { execSync } = await import('child_process');
    
    // Test database write
    const testDb = '/Users/danielconnolly/Projects/Veria/.devassist/data/sqlite/test.db';
    
    // Create test table and insert data
    execSync(`sqlite3 "${testDb}" "CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, data TEXT);"`);
    execSync(`sqlite3 "${testDb}" "INSERT INTO test (data) VALUES ('test_${Date.now()}');"`);
    
    // Query data
    const result = execSync(`sqlite3 "${testDb}" "SELECT COUNT(*) FROM test;"`, { encoding: 'utf-8' });
    
    if (parseInt(result) > 0) {
      // console.log('  ✓ Database write/read successful');
      tests.push({ name: 'Database Operations', status: 'PASSED' });
    } else {
      // console.log('  ✗ Database operations failed');
      tests.push({ name: 'Database Operations', status: 'FAILED' });
    }
    
    // Clean up
    fs.unlinkSync(testDb);
  } catch (error) {
    // console.log(`  ✗ Database test error: ${error.message}`);
    tests.push({ name: 'Database Operations', status: 'FAILED' });
  }
}

// Test 3: Memory Usage Test
async function testMemoryUsage() {
  // console.log('\nTest 3: Memory Usage');
  // console.log('─────────────────────');
  
  const devassist = spawn('node', ['--expose-gc', path.join(__dirname, 'index.js')], {
    env: {
      ...process.env,
      DEVASSIST_PROJECT: 'test',
      DEVASSIST_PROJECT_PATH: __dirname
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        const { execSync } = require('child_process');
        const psOutput = execSync(`ps aux | grep ${devassist.pid} | grep -v grep`, { encoding: 'utf-8' });
        const memoryUsage = psOutput.split(/\s+/)[4]; // RSS column
        
        // console.log(`  Memory usage: ${memoryUsage}`);
        
        if (parseFloat(memoryUsage) < 5.0) {
          // console.log('  ✓ Memory usage acceptable');
          tests.push({ name: 'Memory Usage', status: 'PASSED' });
        } else {
          // console.log('  ⚠ High memory usage detected');
          tests.push({ name: 'Memory Usage', status: 'WARNING' });
        }
      } catch (error) {
        // console.log('  ⚠ Could not measure memory');
        tests.push({ name: 'Memory Usage', status: 'SKIPPED' });
      }
      
      devassist.kill();
      resolve();
    }, 1000);
  });
}

// Test 4: Tool Response Time Test
async function testToolResponseTime() {
  // console.log('\nTest 4: Tool Response Time');
  // console.log('───────────────────────────');
  
  const devassist = spawn('node', [path.join(__dirname, 'index.js')], {
    env: {
      ...process.env,
      DEVASSIST_PROJECT: 'test',
      DEVASSIST_PROJECT_PATH: __dirname
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    let responseReceived = false;
    
    devassist.stdout.on('data', (data) => {
      if (!responseReceived && data.toString().includes('result')) {
        responseReceived = true;
        const responseTime = Date.now() - startTime;
        
        // console.log(`  Response time: ${responseTime}ms`);
        
        if (responseTime < 100) {
          // console.log('  ✓ Excellent response time');
          tests.push({ name: 'Tool Response Time', status: 'PASSED' });
        } else if (responseTime < 500) {
          // console.log('  ✓ Acceptable response time');
          tests.push({ name: 'Tool Response Time', status: 'PASSED' });
        } else {
          // console.log('  ⚠ Slow response time');
          tests.push({ name: 'Tool Response Time', status: 'WARNING' });
        }
      }
    });
    
    // Send list tools request
    setTimeout(() => {
      const request = JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 1
      });
      
      const message = `Content-Length: ${Buffer.byteLength(request)}\r\n\r\n${request}`;
      devassist.stdin.write(message);
    }, 500);
    
    setTimeout(() => {
      if (!responseReceived) {
        // console.log('  ✗ No response received');
        tests.push({ name: 'Tool Response Time', status: 'FAILED' });
      }
      devassist.kill();
      resolve();
    }, 2000);
  });
}

// Run all tests
async function runAllTests() {
  await testMCPServerLaunch();
  await testDatabaseOperations();
  await testMemoryUsage();
  await testToolResponseTime();
  
  // Summary
  // console.log('\n═══════════════════════════════════════════════════════════');
  // console.log('                      Test Summary                          ');
  // console.log('═══════════════════════════════════════════════════════════');
  
  const passed = tests.filter(t => t.status === 'PASSED').length;
  const failed = tests.filter(t => t.status === 'FAILED').length;
  const warnings = tests.filter(t => t.status === 'WARNING').length;
  
  // console.log(`\nTotal: ${tests.length} tests`);
  // console.log(`  ✓ Passed: ${passed}`);
  // console.log(`  ✗ Failed: ${failed}`);
  // console.log(`  ⚠ Warnings: ${warnings}`);
  
  tests.forEach(test => {
    const symbol = test.status === 'PASSED' ? '✓' : test.status === 'FAILED' ? '✗' : '⚠';
    // console.log(`    ${symbol} ${test.name}: ${test.status}`);
  });
  
  if (failed > 0) {
    // console.log('\n⚠️  Critical issues detected. DevAssist may not function correctly.');
    // console.log('Run the auto-fix.sh script to resolve issues.');
  } else if (warnings > 0) {
    // console.log('\n⚠️  Some warnings detected. DevAssist should work but may have issues.');
  } else {
    // console.log('\n✅ All tests passed! DevAssist is stable and ready to use.');
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch(console.error);
