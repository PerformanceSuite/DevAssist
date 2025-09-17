/**
 * UI Module Coordinator
 * Main orchestrator for the enhanced UI development module
 */

import { EventEmitter } from 'events';
import { UISessionManager } from './services/UISessionManager.js';
import { UIDataCache } from './services/UIDataCache.js';
import { VisualRegressionTester } from './services/VisualRegressionTester.js';
import { DesignSystemValidator } from './services/DesignSystemValidator.js';
import { UIModuleErrorHandler } from './services/UIModuleErrorHandler.js';
import { UIMetricsCollector } from './services/UIMetricsCollector.js';
import { PlaywrightManager } from './services/PlaywrightManager.js';
import { MacOSIntegration } from './services/MacOSIntegration.js';
import fs from 'fs/promises';
import path from 'path';

export class UIModuleCoordinator extends EventEmitter {
  constructor(projectPath, devAssistPath) {
    super();
    
    this.projectPath = projectPath;
    this.devAssistPath = devAssistPath;
    this.config = null;
    this.isActive = false;
    
    // Initialize all services
    this.sessionManager = new UISessionManager(devAssistPath, projectPath);
    this.cache = new UIDataCache(50);
    this.regressionTester = new VisualRegressionTester({ 
      outputPath: path.join(projectPath, '.devassist/visual-tests')
    });
    this.designValidator = new DesignSystemValidator();
    this.errorHandler = new UIModuleErrorHandler();
    this.metricsCollector = new UIMetricsCollector();
    this.playwrightManager = new PlaywrightManager();
    this.macOS = new MacOSIntegration();
    
    this.setupEventHandlers();
  }
  /**
   * Initialize UI Module with configuration
   */
  async initialize() {
    console.log('🎨 Initializing UI Module...');
    
    try {
      // Load configuration
      await this.loadConfiguration();
      
      // Initialize services
      await this.playwrightManager.initialize();
      await this.regressionTester.initialize();
      await this.designValidator.loadDesignSystem(
        path.join(this.projectPath, '.devassist/design-system.json')
      );
      
      // Start session
      await this.sessionManager.initializeSession();
      
      // Load cached data
      await this.warmupCache();
      
      this.isActive = true;
      console.log('✅ UI Module initialized successfully');
      
      this.emit('initialized', {
        profile: this.config.activeProfile,
        features: this.config.features
      });
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize UI Module:', error);
      await this.errorHandler.handle(error, 'INIT_FAILURE', { module: 'coordinator' });
      throw error;
    }
  }

  /**
   * Enter UI Focus Mode
   */
  async enterUIMode(options = {}) {
    if (!this.isActive) {
      await this.initialize();
    }
    
    const profile = options.profile || this.config.activeProfile;
    const component = options.component || null;
    const viewport = options.viewport || 'desktop';
    
    console.log(`🚀 Entering UI Focus Mode (Profile: ${profile})`);
    
    // Apply profile settings
    await this.applyProfile(profile);
    
    // Setup workspace
    const workspace = await this.setupWorkspace(component, viewport);
    
    // Start file watchers
    await this.startFileWatchers();
    
    // Open initial preview
    if (component) {
      await this.loadComponent(component);
    }
    
    this.emit('ui-mode:entered', {
      profile,
      component,
      viewport,
      workspace
    });
    
    return workspace;
  }
  /**
   * Setup event handlers for all services
   */
  setupEventHandlers() {
    // Session manager events
    this.sessionManager.on('decision:recorded', (decision) => {
      this.emit('decision:recorded', decision);
      this.metricsCollector.trackDesignIteration({
        component: decision.component,
        changeType: 'decision',
        duration: decision.metrics.timeSpent
      });
    });
    
    // Error handler events
    this.errorHandler.on('recovery:success', (data) => {
      this.emit('recovery:success', data);
    });
    
    this.errorHandler.on('recovery:fallback', (data) => {
      this.emit('recovery:fallback', data);
    });
    
    // Metrics events
    this.metricsCollector.on('insight:generated', (insight) => {
      this.emit('insight:generated', insight);
    });
  }

  /**
   * Load configuration
   */
  async loadConfiguration() {
    const configPath = path.join(this.devAssistPath, 'config', 'ui-module-config.json');
    try {
      const configData = await fs.readFile(configPath, 'utf-8');
      this.config = JSON.parse(configData).uiModule;
      return this.config;
    } catch (error) {
      // Use default config
      this.config = {
        activeProfile: 'development',
        profiles: {
          development: {
            autoRefresh: true,
            validationLevel: 'basic',
            debounceDelay: 500
          }
        },
        features: {
          playwrightIntegration: true,
          visualFeedback: true
        }
      };
      return this.config;
    }
  }

  /**
   * Apply configuration profile
   */
  async applyProfile(profileName) {
    const profile = this.config.profiles[profileName];
    if (!profile) {
      throw new Error(`Profile '${profileName}' not found`);
    }
    
    // Apply settings to services
    this.playwrightManager.config.debounceDelay = profile.debounceDelay;
    this.cache.cacheTTL = profile.cacheTTL || 60000;
    
    this.config.activeProfile = profileName;
    
    console.log(`✅ Applied profile: ${profileName}`);
    return profile;
  }

  /**
   * Setup workspace for UI development
   */
  async setupWorkspace(component, viewport) {
    const workspace = {
      component,
      viewport,
      browserReady: false,
      validationEnabled: true,
      cacheEnabled: true
    };
    
    // Start Playwright browser
    if (this.config.features.playwrightIntegration) {
      const page = await this.playwrightManager.getActivePage();
      if (page) {
        workspace.browserReady = true;
        await this.setViewport(viewport);
      }
    }
    
    return workspace;
  }

  /**
   * Start file watchers with debouncing
   */
  async startFileWatchers() {
    const chokidar = await import('chokidar');
    
    const watchPaths = [
      path.join(this.projectPath, 'src/**/*.{js,jsx,ts,tsx,css,scss}'),
      path.join(this.projectPath, 'components/**/*.{js,jsx,ts,tsx,css,scss}'),
      path.join(this.projectPath, 'styles/**/*.{css,scss}')
    ];
    
    this.watcher = chokidar.watch(watchPaths, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: true
    });
    
    // Debounced refresh handler
    const handleChange = this.playwrightManager.debouncedRefresh;
    
    this.watcher
      .on('change', async (path) => {
        console.log(`📝 File changed: ${path}`);
        this.emit('file:changed', path);
        
        // Refresh preview if auto-refresh is enabled
        const profile = this.config.profiles[this.config.activeProfile];
        if (profile.autoRefresh) {
          await handleChange();
        }
        
        // Run validation if enabled
        if (profile.validationLevel !== 'none') {
          await this.validateCurrentView();
        }
      })
      .on('add', (path) => console.log(`✨ File added: ${path}`))
      .on('unlink', (path) => console.log(`🗑️ File removed: ${path}`));
    
    console.log('👀 File watchers started');
  }

  /**
   * Load a specific component
   */
  async loadComponent(componentName) {
    // Navigate to component URL
    const componentUrl = `http://localhost:3000/components/${componentName}`;
    await this.playwrightManager.debouncedNavigate(componentUrl);
    
    // Track component load
    await this.sessionManager.trackIteration({
      type: 'load',
      component: componentName,
      description: `Loaded component: ${componentName}`
    });
    
    return { component: componentName, url: componentUrl };
  }

  /**
   * Set viewport size
   */
  async setViewport(viewport) {
    const sizes = {
      mobile: { width: 375, height: 812 },
      tablet: { width: 768, height: 1024 },
      desktop: { width: 1440, height: 900 },
      wide: { width: 1920, height: 1080 }
    };
    
    const size = typeof viewport === 'string' ? sizes[viewport] : viewport;
    
    if (this.playwrightManager.activePage) {
      await this.playwrightManager.activePage.setViewportSize(size);
    }
    
    this.emit('viewport:changed', size);
    return size;
  }

  /**
   * Navigate to URL
   */
  async navigate(url) {
    return await this.playwrightManager.debouncedNavigate(url);
  }

  /**
   * Validate current view
   */
  async validateCurrentView() {
    const profile = this.config.profiles[this.config.activeProfile];
    
    // Get current page content
    if (!this.playwrightManager.activePage) {
      return { error: 'No active page' };
    }
    
    const page = this.playwrightManager.activePage;
    
    // Take screenshot for validation
    const screenshot = await page.screenshot({ fullPage: true });
    
    // Run validations based on level
    const validations = [];
    
    if (profile.validationLevel === 'comprehensive' || profile.validationLevel === 'basic') {
      // Accessibility check
      const accessibilityResult = await this.validateAccessibility(page);
      validations.push({ type: 'accessibility', ...accessibilityResult });
      
      // Design system check
      const designResult = await this.validateDesignSystem(page);
      validations.push({ type: 'design', ...designResult });
    }
    
    if (profile.validationLevel === 'comprehensive') {
      // Performance check
      const performanceResult = await this.validatePerformance(page);
      validations.push({ type: 'performance', ...performanceResult });
      
      // Visual regression if enabled
      if (this.config.features.visualRegression) {
        const regressionResult = await this.runVisualRegression(screenshot);
        validations.push({ type: 'regression', ...regressionResult });
      }
    }
    
    return {
      timestamp: new Date().toISOString(),
      level: profile.validationLevel,
      validations,
      passed: validations.every(v => v.passed !== false)
    };
  }

  /**
   * Validate accessibility
   */
  async validateAccessibility(page) {
    try {
      // Run axe-core accessibility checks
      await page.addScriptTag({ 
        url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.0/axe.min.js' 
      });
      
      const results = await page.evaluate(() => {
        return new Promise((resolve) => {
          window.axe.run().then(results => resolve(results));
        });
      });
      
      return {
        passed: results.violations.length === 0,
        violations: results.violations,
        score: results.passes.length / (results.passes.length + results.violations.length)
      };
    } catch (error) {
      return { passed: false, error: error.message };
    }
  }

  /**
   * Validate against design system
   */
  async validateDesignSystem(page) {
    try {
      // Extract CSS from page
      const styles = await page.evaluate(() => {
        const styleSheets = Array.from(document.styleSheets);
        return styleSheets.map(sheet => {
          try {
            return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
          } catch (e) {
            return '';
          }
        }).join('\n');
      });
      
      // Validate with design system validator
      const result = await this.designValidator.validateCSS(styles, 'current-page');
      
      return result;
    } catch (error) {
      return { passed: false, error: error.message };
    }
  }

  /**
   * Validate performance metrics
   */
  async validatePerformance(page) {
    try {
      const metrics = await page.evaluate(() => {
        const perfData = window.performance.getEntriesByType('navigation')[0];
        return {
          domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
          loadComplete: perfData.loadEventEnd - perfData.loadEventStart,
          domInteractive: perfData.domInteractive,
          firstPaint: window.performance.getEntriesByName('first-paint')[0]?.startTime,
          firstContentfulPaint: window.performance.getEntriesByName('first-contentful-paint')[0]?.startTime
        };
      });
      
      const profile = this.config.profiles[this.config.activeProfile];
      const budget = profile.performanceBudget || {};
      
      return {
        passed: metrics.loadComplete < (budget.renderTime || 1000),
        metrics,
        budget
      };
    } catch (error) {
      return { passed: false, error: error.message };
    }
  }

  /**
   * Run visual regression test
   */
  async runVisualRegression(currentScreenshot) {
    try {
      // Get baseline screenshot path
      const baselinePath = path.join(
        this.projectPath,
        '.devassist/visual-tests/baselines/current.png'
      );
      
      // Check if baseline exists
      const baselineExists = await fs.access(baselinePath).then(() => true).catch(() => false);
      
      if (!baselineExists) {
        // Save as new baseline
        await fs.writeFile(baselinePath, currentScreenshot);
        return { passed: true, message: 'Baseline created' };
      }
      
      // Compare with baseline
      const result = await this.regressionTester.compareScreenshots(
        baselinePath,
        currentScreenshot,
        { component: 'current-view' }
      );
      
      return result;
    } catch (error) {
      return { passed: false, error: error.message };
    }
  }

  /**
   * Create checkpoint
   */
  async createCheckpoint(params) {
    const checkpoint = {
      id: `checkpoint_${Date.now()}`,
      timestamp: new Date().toISOString(),
      message: params.message,
      viewports: params.viewports || ['desktop'],
      validations: {}
    };
    
    // Run validation if requested
    if (params.validate) {
      checkpoint.validations = await this.validateCurrentView();
    }
    
    // Capture screenshots for each viewport
    checkpoint.screenshots = {};
    for (const viewport of checkpoint.viewports) {
      await this.setViewport(viewport);
      const screenshot = await this.playwrightManager.activePage.screenshot({ fullPage: true });
      
      const screenshotPath = path.join(
        this.projectPath,
        '.devassist/checkpoints',
        checkpoint.id,
        `${viewport}.png`
      );
      
      await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
      await fs.writeFile(screenshotPath, screenshot);
      
      checkpoint.screenshots[viewport] = screenshotPath;
    }
    
    // Record checkpoint in session
    await this.sessionManager.recordDesignDecision({
      description: `Checkpoint: ${params.message}`,
      component: 'checkpoint',
      screenshot: checkpoint.screenshots.desktop,
      performanceMetrics: checkpoint.validations.metrics
    });
    
    // Git commit if available
    if (params.commit !== false) {
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        
        await execAsync(`git add -A && git commit -m "UI Checkpoint: ${params.message}"`, {
          cwd: this.projectPath
        });
        
        checkpoint.gitCommit = true;
      } catch (error) {
        console.warn('Could not create git commit:', error.message);
        checkpoint.gitCommit = false;
      }
    }
    
    this.emit('checkpoint:created', checkpoint);
    return checkpoint;
  }

  /**
   * Capture design iteration
   */
  async captureIteration(description) {
    const page = this.playwrightManager.activePage;
    if (!page) {
      throw new Error('No active page');
    }
    
    const screenshot = await page.screenshot({ fullPage: true });
    const metrics = await this.validatePerformance(page);
    
    const iteration = await this.sessionManager.trackIteration({
      description,
      component: 'current',
      screenshot,
      performanceMetrics: metrics.metrics
    });
    
    return iteration;
  }

  /**
   * Validate design
   */
  async validateDesign(options = {}) {
    return await this.validateCurrentView();
  }

  /**
   * Warmup cache with frequently used data
   */
  async warmupCache() {
    // Preload design principles
    await this.cache.getDesignPrinciples(async () => {
      const principlesPath = path.join(this.projectPath, '.devassist/docs/design-principles.md');
      try {
        return await fs.readFile(principlesPath, 'utf-8');
      } catch {
        return '';
      }
    });
    
    console.log('♨️ Cache warmed up');
  }

  /**
   * Get session summary
   */
  async getSessionSummary() {
    if (!this.sessionManager.sessionId) {
      return null;
    }
    
    return await this.sessionManager.endSession();
  }

  /**
   * Exit UI mode and cleanup
   */
  async exitUIMode() {
    // Stop file watchers
    if (this.watcher) {
      await this.watcher.close();
    }
    
    // End session
    if (this.sessionManager.sessionId) {
      await this.sessionManager.endSession();
    }
    
    // Close browser
    if (this.playwrightManager.activePage) {
      await this.playwrightManager.cleanup();
    }
    
    // Clear cache
    this.cache.clearAll();
    
    this.isActive = false;
    this.emit('ui-mode:exited');
    
    console.log('✅ UI Mode exited');
  }
}
