/**
 * UI Data Cache - Performance optimization layer
 * Implements LRU caching for screenshots, validation results, and design principles
 */

export class UIDataCache {
  constructor(maxSize = 50) {
    this.maxSize = maxSize;
    this.screenshotCache = new Map();
    this.validationCache = new Map();
    this.designPrinciplesCache = null;
    this.componentCache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }

  /**
   * Get or fetch screenshot with caching
   */
  async getScreenshot(url, viewport, fetchFunction) {
    const key = `${url}-${viewport.width}x${viewport.height}`;
    
    if (this.screenshotCache.has(key)) {
      const cached = this.screenshotCache.get(key);
      if (Date.now() - cached.timestamp < 60000) { // 1 minute cache
        this.cacheStats.hits++;
        // Move to end (most recently used)
        this.screenshotCache.delete(key);
        this.screenshotCache.set(key, cached);
        return cached.data;
      }
    }
    
    this.cacheStats.misses++;
    const screenshot = await fetchFunction(url, viewport);
    
    // Add to cache with LRU eviction
    if (this.screenshotCache.size >= this.maxSize) {
      const firstKey = this.screenshotCache.keys().next().value;
      this.screenshotCache.delete(firstKey);
      this.cacheStats.evictions++;
    }
    
    this.screenshotCache.set(key, {
      data: screenshot,
      timestamp: Date.now(),
      url,
      viewport
    });
    
    return screenshot;
  }
  /**
   * Get or fetch validation results with caching
   */
  async getValidation(component, validationType, validateFunction) {
    const key = `${component}-${validationType}`;
    
    if (this.validationCache.has(key)) {
      const cached = this.validationCache.get(key);
      if (Date.now() - cached.timestamp < 300000) { // 5 minute cache
        this.cacheStats.hits++;
        return cached.data;
      }
    }
    
    this.cacheStats.misses++;
    const result = await validateFunction(component, validationType);
    
    this.validationCache.set(key, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
  }

  /**
   * Cache design principles for session
   */
  async getDesignPrinciples(fetchFunction) {
    if (this.designPrinciplesCache && 
        Date.now() - this.designPrinciplesCache.timestamp < 3600000) { // 1 hour cache
      this.cacheStats.hits++;
      return this.designPrinciplesCache.data;
    }
    
    this.cacheStats.misses++;
    const principles = await fetchFunction();
    
    this.designPrinciplesCache = {
      data: principles,
      timestamp: Date.now()
    };
    
    return principles;
  }
  /**
   * Cache component data with automatic invalidation
   */
  async getComponent(componentId, fetchFunction) {
    if (this.componentCache.has(componentId)) {
      const cached = this.componentCache.get(componentId);
      if (Date.now() - cached.timestamp < 120000) { // 2 minute cache
        this.cacheStats.hits++;
        return cached.data;
      }
    }
    
    this.cacheStats.misses++;
    const component = await fetchFunction(componentId);
    
    // LRU eviction for component cache
    if (this.componentCache.size >= this.maxSize) {
      const oldestKey = this.getOldestCacheKey(this.componentCache);
      this.componentCache.delete(oldestKey);
      this.cacheStats.evictions++;
    }
    
    this.componentCache.set(componentId, {
      data: component,
      timestamp: Date.now()
    });
    
    return component;
  }

  /**
   * Invalidate specific cache entry
   */
  invalidate(cacheType, key) {
    switch(cacheType) {
      case 'screenshot':
        return this.screenshotCache.delete(key);
      case 'validation':
        return this.validationCache.delete(key);
      case 'component':
        return this.componentCache.delete(key);
      case 'principles':
        this.designPrinciplesCache = null;
        return true;
      default:
        return false;
    }
  }
  /**
   * Clear all caches
   */
  clearAll() {
    this.screenshotCache.clear();
    this.validationCache.clear();
    this.componentCache.clear();
    this.designPrinciplesCache = null;
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.cacheStats.hits / 
      (this.cacheStats.hits + this.cacheStats.misses) * 100 || 0;
    
    return {
      ...this.cacheStats,
      hitRate: hitRate.toFixed(2) + '%',
      screenshotCacheSize: this.screenshotCache.size,
      validationCacheSize: this.validationCache.size,
      componentCacheSize: this.componentCache.size,
      totalSize: this.screenshotCache.size + 
                 this.validationCache.size + 
                 this.componentCache.size
    };
  }

  /**
   * Helper: Get oldest cache key for LRU eviction
   */
  getOldestCacheKey(cache) {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, value] of cache.entries()) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }
    
    return oldestKey;
  }

  /**
   * Preload frequently used components
   */
  async preloadFrequent(componentIds, fetchFunction) {
    const promises = componentIds.map(id => 
      this.getComponent(id, fetchFunction)
    );
    
    await Promise.all(promises);
    return this.getStats();
  }
}
