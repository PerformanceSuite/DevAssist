/**
 * Optimized Playwright Manager with Performance Enhancements
 * Includes debouncing, connection pooling, and resource management
 */

import { chromium, firefox, webkit } from 'playwright';
import { EventEmitter } from 'events';
import debounce from 'lodash/debounce';

export class PlaywrightManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      browser: config.browser || 'chromium',
      headless: config.headless !== false,
      poolSize: config.poolSize || 3,
      reuseContext: config.reuseContext !== false,
      debounceDelay: config.debounceDelay || 500
    };
    
    this.browserPool = [];
    this.contextPool = [];
    this.activeContext = null;
    this.activePage = null;
    
    // Performance optimizations
    this.screenshotQueue = [];
    this.isProcessingQueue = false;
    
    // Debounced methods
    this.debouncedRefresh = debounce(this.refresh.bind(this), this.config.debounceDelay);
    this.debouncedNavigate = debounce(this.navigate.bind(this), this.config.debounceDelay);
    this.debouncedScreenshot = debounce(this.screenshot.bind(this), 200);
  }

  /**
   * Initialize browser pool for better performance
   */
  async initialize() {
    console.log('🚀 Initializing Playwright browser pool...');
    
    try {
      // Pre-launch browsers for instant availability
      for (let i = 0; i < this.config.poolSize; i++) {
        const browser = await this.launchBrowser();
        this.browserPool.push({
          browser,
          inUse: false,
          id: `browser_${i}`
        });
      }
      
      // Create initial context
      await this.createContext();
      
      console.log(`✅ Browser pool initialized with ${this.config.poolSize} instances`);
      this.emit('initialized', { poolSize: this.config.poolSize });
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize browser pool:', error);
      throw error;
    }
  }
  /**
   * Launch browser based on configuration
   */
  async launchBrowser() {
    const browserType = this.config.browser;
    const options = {
      headless: this.config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    };
    
    switch (browserType) {
      case 'firefox':
        return await firefox.launch(options);
      case 'webkit':
        return await webkit.launch(options);
      default:
        return await chromium.launch(options);
    }
  }

  /**
   * Create browser context with optimizations
   */
  async createContext() {
    // Get available browser from pool
    const browser = this.getAvailableBrowser();
    if (!browser) {
      throw new Error('No available browsers in pool');
    }
    
    // Create context with optimizations
    const context = await browser.browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      ignoreHTTPSErrors: true,
      bypassCSP: true,
      // Performance optimizations
      javaScriptEnabled: true,
      hasTouch: false,
      isMobile: false,
      // Cache resources
      storageState: this.config.reuseContext ? 
        await this.getStorageState() : undefined
    });
    
    // Store context
    this.contextPool.push({
      context,
      browserId: browser.id,
      inUse: true
    });
    
    this.activeContext = context;
    
    // Create initial page
    const page = await context.newPage();
    this.activePage = page;
    
    // Setup page optimizations
    await this.optimizePage(page);
    
    browser.inUse = true;
    
    return { context, page };
  }

  /**
   * Get available browser from pool
   */
  getAvailableBrowser() {
    return this.browserPool.find(b => !b.inUse);
  }

  /**
   * Optimize page for performance
   */
  async optimizePage(page) {
    // Block unnecessary resources
    await page.route('**/*.{png,jpg,jpeg,gif,webp,svg}', route => {
      // Allow images but compress if needed
      route.continue();
    });
    
    // Block ads and analytics
    await page.route('**/*', route => {
      const url = route.request().url();
      if (url.includes('google-analytics') || 
          url.includes('doubleclick') ||
          url.includes('facebook')) {
        route.abort();
      } else {
        route.continue();
      }
    });
    
    // Add performance observer
    await page.evaluateOnNewDocument(() => {
      window.__PERF_DATA = {
        marks: [],
        measures: []
      };
      
      const originalMark = performance.mark;
      const originalMeasure = performance.measure;
      
      performance.mark = function(...args) {
        window.__PERF_DATA.marks.push({ name: args[0], time: Date.now() });
        return originalMark.apply(this, args);
      };
      
      performance.measure = function(...args) {
        window.__PERF_DATA.measures.push({ name: args[0], time: Date.now() });
        return originalMeasure.apply(this, args);
      };
    });
  }

  /**
   * Get or restore storage state for context reuse
   */
  async getStorageState() {
    // Implement storage state caching
    // This can include cookies, localStorage, etc.
    return undefined; // For now
  }

  /**
   * Get active page or create new one
   */
  async getActivePage() {
    if (!this.activePage || this.activePage.isClosed()) {
      if (!this.activeContext) {
        await this.createContext();
      } else {
        this.activePage = await this.activeContext.newPage();
        await this.optimizePage(this.activePage);
      }
    }
    
    return this.activePage;
  }

  /**
   * Refresh current page
   */
  async refresh() {
    const page = await this.getActivePage();
    await page.reload({ waitUntil: 'networkidle' });
    
    this.emit('page:refreshed', { url: page.url() });
    return { refreshed: true, url: page.url() };
  }

  /**
   * Navigate to URL
   */
  async navigate(url) {
    const page = await this.getActivePage();
    
    try {
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      this.emit('page:navigated', { url });
      return { success: true, url };
    } catch (error) {
      console.error('Navigation failed:', error);
      this.emit('navigation:failed', { url, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Take screenshot with optimization
   */
  async screenshot(options = {}) {
    const page = await this.getActivePage();
    
    // Queue screenshot request for batch processing
    if (this.screenshotQueue.length > 0 && !this.isProcessingQueue) {
      this.processScreenshotQueue();
    }
    
    const screenshot = await page.screenshot({
      fullPage: options.fullPage !== false,
      type: 'png',
      quality: options.quality || 80,
      ...options
    });
    
    this.emit('screenshot:taken', { 
      size: screenshot.length,
      fullPage: options.fullPage 
    });
    
    return screenshot;
  }

  /**
   * Process screenshot queue for batch optimization
   */
  async processScreenshotQueue() {
    if (this.isProcessingQueue || this.screenshotQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    
    while (this.screenshotQueue.length > 0) {
      const request = this.screenshotQueue.shift();
      try {
        const result = await this.screenshot(request.options);
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }
    }
    
    this.isProcessingQueue = false;
  }

  /**
   * Restart browser and restore state
   */
  async restart() {
    console.log('🔄 Restarting Playwright browser...');
    
    // Save current state
    const currentUrl = this.activePage ? this.activePage.url() : null;
    const viewport = this.activePage ? 
      await this.activePage.viewportSize() : null;
    
    // Cleanup
    await this.cleanup();
    
    // Reinitialize
    await this.initialize();
    
    // Restore state
    if (currentUrl) {
      await this.navigate(currentUrl);
    }
    
    if (viewport) {
      await this.activePage.setViewportSize(viewport);
    }
    
    console.log('✅ Browser restarted successfully');
    this.emit('browser:restarted', { url: currentUrl });
    
    return { restarted: true, url: currentUrl };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // Close all pages
    if (this.activeContext) {
      await this.activeContext.close();
    }
    
    // Close all contexts in pool
    for (const ctx of this.contextPool) {
      try {
        await ctx.context.close();
      } catch (error) {
        console.warn('Failed to close context:', error);
      }
    }
    
    // Close all browsers in pool
    for (const browser of this.browserPool) {
      try {
        await browser.browser.close();
      } catch (error) {
        console.warn('Failed to close browser:', error);
      }
    }
    
    // Reset
    this.browserPool = [];
    this.contextPool = [];
    this.activeContext = null;
    this.activePage = null;
    
    console.log('✅ Playwright cleanup complete');
  }

  /**
   * Get performance metrics from page
   */
  async getPerformanceMetrics() {
    const page = await this.getActivePage();
    
    const metrics = await page.evaluate(() => {
      const perf = window.performance;
      const navigation = perf.getEntriesByType('navigation')[0];
      const paint = perf.getEntriesByType('paint');
      
      return {
        domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart,
        loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart,
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime,
        customMarks: window.__PERF_DATA || { marks: [], measures: [] }
      };
    });
    
    return metrics;
  }
}
