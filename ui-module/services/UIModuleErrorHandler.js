/**
 * UI Module Error Handler
 * Provides robust error recovery and graceful degradation
 */

import { EventEmitter } from 'events';

export class UIModuleErrorHandler extends EventEmitter {
  constructor(config = {}) {
    super();
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
    this.errorLog = [];
    this.recoveryStrategies = new Map();
    
    this.initializeStrategies();
  }

  /**
   * Initialize recovery strategies for different error types
   */
  initializeStrategies() {
    // Playwright browser crash recovery
    this.recoveryStrategies.set('PLAYWRIGHT_CRASH', async (error, context) => {
      console.log('🔄 Playwright browser crashed, attempting recovery...');
      
      for (let i = 0; i < this.maxRetries; i++) {
        try {
          await this.delay(this.retryDelay * (i + 1));
          
          // Attempt to restart browser
          if (context.playwrightManager) {
            await context.playwrightManager.restart();
            
            // Restore last known state
            if (context.lastUrl) {
              await context.playwrightManager.navigateTo(context.lastUrl);
            }
            
            console.log('✅ Playwright browser recovered successfully');
            this.emit('recovery:success', { type: 'PLAYWRIGHT_CRASH' });
            return { recovered: true };
          }
        } catch (retryError) {
          console.log(`❌ Recovery attempt ${i + 1} failed:`, retryError.message);
        }
      }
      
      // Fallback to manual mode
      console.log('⚠️ Switching to manual refresh mode');
      this.emit('recovery:fallback', { type: 'PLAYWRIGHT_CRASH', mode: 'manual' });
      return { recovered: false, fallback: 'manual' };
    });
    
    // File watcher failure recovery
    this.recoveryStrategies.set('FILE_WATCHER_FAILURE', async (error, context) => {
      console.log('🔄 File watcher failed, attempting recovery...');
      
      // Try to restart watcher
      for (let i = 0; i < this.maxRetries; i++) {
        try {
          await this.delay(this.retryDelay);
          
          if (context.restartWatcher) {
            await context.restartWatcher();
            console.log('✅ File watcher recovered');
            this.emit('recovery:success', { type: 'FILE_WATCHER_FAILURE' });
            return { recovered: true };
          }
        } catch (retryError) {
          console.log(`❌ Recovery attempt ${i + 1} failed`);
        }
      }
      
      // Fallback to manual refresh
      console.log('⚠️ Falling back to manual refresh mode');
      this.emit('recovery:fallback', { 
        type: 'FILE_WATCHER_FAILURE', 
        mode: 'manual-refresh' 
      });
      return { recovered: false, fallback: 'manual-refresh' };
    });

    // Cache corruption recovery
    this.recoveryStrategies.set('CACHE_CORRUPTION', async (error, context) => {
      console.log('🔄 Cache corrupted, clearing and rebuilding...');
      
      try {
        if (context.cache) {
          context.cache.clearAll();
          await context.warmupCache();
          console.log('✅ Cache rebuilt successfully');
          this.emit('recovery:success', { type: 'CACHE_CORRUPTION' });
          return { recovered: true };
        }
      } catch (cacheError) {
        console.log('❌ Failed to rebuild cache:', cacheError.message);
      }
      
      return { recovered: false };
    });

    // Network failure recovery
    this.recoveryStrategies.set('NETWORK_FAILURE', async (error, context) => {
      console.log('🔄 Network failure detected, implementing retry strategy...');
      
      for (let i = 0; i < this.maxRetries; i++) {
        try {
          await this.delay(this.retryDelay * Math.pow(2, i)); // Exponential backoff
          
          // Test network connectivity
          const response = await fetch('http://localhost:3000/health');
          if (response.ok) {
            console.log('✅ Network recovered');
            this.emit('recovery:success', { type: 'NETWORK_FAILURE' });
            return { recovered: true };
          }
        } catch (netError) {
          console.log(`⚠️ Network still unavailable (attempt ${i + 1})`);
        }
      }
      
      return { recovered: false, fallback: 'offline-mode' };
    });
  }

  /**
   * Handle error with appropriate recovery strategy
   */
  async handle(error, errorType, context = {}) {
    // Log error
    this.logError(error, errorType, context);
    
    // Get recovery strategy
    const strategy = this.recoveryStrategies.get(errorType);
    
    if (strategy) {
      console.log(`🔧 Attempting recovery for ${errorType}...`);
      const result = await strategy(error, context);
      
      if (result.recovered) {
        this.emit('error:recovered', { 
          type: errorType, 
          attempts: result.attempts || 1 
        });
      } else {
        this.emit('error:unrecoverable', { 
          type: errorType, 
          fallback: result.fallback 
        });
      }
      
      return result;
    }
    
    // No strategy available
    console.error(`❌ No recovery strategy for ${errorType}`);
    this.emit('error:unhandled', { type: errorType, error });
    
    return { recovered: false };
  }

  /**
   * Log error for analysis
   */
  logError(error, type, context) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      type,
      message: error.message,
      stack: error.stack,
      context
    };
    
    this.errorLog.push(errorEntry);
    
    // Keep only last 100 errors
    if (this.errorLog.length > 100) {
      this.errorLog.shift();
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {};
    
    this.errorLog.forEach(entry => {
      if (!stats[entry.type]) {
        stats[entry.type] = {
          count: 0,
          lastOccurred: null
        };
      }
      
      stats[entry.type].count++;
      stats[entry.type].lastOccurred = entry.timestamp;
    });
    
    return stats;
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear error log
   */
  clearErrorLog() {
    this.errorLog = [];
  }
}
