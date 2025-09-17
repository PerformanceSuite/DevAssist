import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PlaywrightManager } from './services/PlaywrightManager';
import { FileWatcher } from './services/FileWatcher';
import { DesignValidator } from './services/DesignValidator';
import { IterationManager } from './services/IterationManager';

export interface UIModeConfig {
  enabled: boolean;
  configPath?: string;
  projectRoot?: string;
  autoStart?: boolean;
}

export interface UIModeState {
  mode: 'standard' | 'ui';
  isActive: boolean;
  browserReady: boolean;
  watcherActive: boolean;
  currentUrl?: string;
  currentComponent?: string;
  validationEnabled: boolean;
  lastValidationScore?: number;
}

export class UIModeManager extends EventEmitter {
  private config: UIModeConfig;
  private state: UIModeState;
  private playwrightManager: PlaywrightManager | null = null;
  private fileWatcher: FileWatcher | null = null;
  private designValidator: DesignValidator | null = null;
  private iterationManager: IterationManager | null = null;
  private settings: any = {};
  private contextFiles: Map<string, string> = new Map();

  constructor(config: UIModeConfig = {}) {
    super();
    this.config = {
      configPath: path.join(process.cwd(), 'ui-module', 'config', 'ui-mode-settings.json'),
      projectRoot: process.cwd(),
      autoStart: false,
      ...config
    };

    this.state = {
      mode: 'standard',
      isActive: false,
      browserReady: false,
      watcherActive: false,
      validationEnabled: true
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Load settings
      await this.loadSettings();

      // Initialize iteration manager
      this.iterationManager = new IterationManager(
        path.join(this.config.projectRoot!, '.ui-mode', 'iterations'),
        this.settings.uiMode?.screenshotHistory?.maxItems || 50
      );

      // Set up event listeners
      this.setupEventListeners();

      if (this.config.autoStart && this.settings.defaultMode === 'ui') {
        await this.enterUIMode();
      }

      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const settingsContent = await fs.readFile(this.config.configPath!, 'utf-8');
      this.settings = JSON.parse(settingsContent);
    } catch (error) {
      // Use default settings if file doesn't exist
      this.settings = {
        defaultMode: 'standard',
        uiMode: {
          enabled: false,
          layout: { leftPanel: 40, centerPanel: 40, rightPanel: 20 },
          autoRefresh: true,
          refreshDelay: 500,
          fileWatcher: {
            patterns: ['**/*.{tsx,jsx,css,scss,html}'],
            ignore: ['**/node_modules/**', '**/dist/**']
          },
          validation: {
            autoRun: true,
            wcagLevel: 'AA'
          },
          contextFiles: ['design-principles.md', 'style-guide.md']
        },
        browserSession: {
          persistent: true,
          headless: false,
          defaultViewport: { width: 1440, height: 900 }
        }
      };
    }
  }

  private setupEventListeners(): void {
    // Iteration manager events
    if (this.iterationManager) {
      this.iterationManager.on('iterationSaved', (iteration) => {
        this.emit('iterationSaved', iteration);
      });

      this.iterationManager.on('comparisonComplete', (result) => {
        this.emit('visualDiff', result);
      });
    }
  }

  async enterUIMode(): Promise<void> {
    if (this.state.mode === 'ui' && this.state.isActive) {
      return;
    }

    try {
      this.emit('enteringUIMode');

      // Load context files
      await this.loadContextFiles();

      // Initialize Playwright
      await this.initializePlaywright();

      // Initialize File Watcher
      await this.initializeFileWatcher();

      // Initialize Design Validator
      await this.initializeValidator();

      // Update state
      this.state.mode = 'ui';
      this.state.isActive = true;

      // Save state
      await this.saveState();

      this.emit('uiModeEntered');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async exitUIMode(): Promise<void> {
    if (this.state.mode === 'standard') {
      return;
    }

    try {
      this.emit('exitingUIMode');

      // Stop file watcher
      if (this.fileWatcher) {
        this.fileWatcher.stop();
        this.fileWatcher = null;
      }

      // Close browser
      if (this.playwrightManager) {
        await this.playwrightManager.close();
        this.playwrightManager = null;
      }

      // Clear context files
      this.contextFiles.clear();

      // Update state
      this.state.mode = 'standard';
      this.state.isActive = false;
      this.state.browserReady = false;
      this.state.watcherActive = false;

      // Save state
      await this.saveState();

      this.emit('uiModeExited');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private async loadContextFiles(): Promise<void> {
    const contextFiles = this.settings.uiMode?.contextFiles || [];

    for (const file of contextFiles) {
      try {
        const filePath = path.join(this.config.projectRoot!, file);
        const content = await fs.readFile(filePath, 'utf-8');
        this.contextFiles.set(file, content);
        this.emit('contextFileLoaded', file);
      } catch (error) {
        // File might not exist
        this.emit('warning', `Could not load context file: ${file}`);
      }
    }
  }

  private async initializePlaywright(): Promise<void> {
    this.playwrightManager = new PlaywrightManager({
      headless: this.settings.browserSession?.headless || false,
      persistent: this.settings.browserSession?.persistent || true,
      defaultViewport: this.settings.browserSession?.defaultViewport || { width: 1440, height: 900 },
      userDataDir: path.join(this.config.projectRoot!, '.ui-mode', 'browser-data')
    });

    // Set up Playwright event listeners
    this.playwrightManager.on('initialized', () => {
      this.state.browserReady = true;
      this.emit('browserReady');
    });

    this.playwrightManager.on('console', (msg) => {
      this.emit('browserConsole', msg);
    });

    this.playwrightManager.on('pageError', (error) => {
      this.emit('browserError', error);
    });

    this.playwrightManager.on('navigated', (url) => {
      this.state.currentUrl = url;
      this.emit('navigated', url);
    });

    await this.playwrightManager.initialize();
  }

  private async initializeFileWatcher(): Promise<void> {
    const watcherConfig = this.settings.uiMode?.fileWatcher || {
      patterns: ['**/*.{tsx,jsx,css,scss,html}'],
      ignore: ['**/node_modules/**'],
      debounceMs: 500
    };

    this.fileWatcher = new FileWatcher({
      ...watcherConfig,
      cwd: this.config.projectRoot
    });

    // Set up file watcher event listeners
    this.fileWatcher.on('fileChanged', async (change) => {
      this.emit('fileChanged', change);

      if (this.settings.uiMode?.autoRefresh && this.playwrightManager?.isReady()) {
        await this.handleFileChange(change);
      }
    });

    this.fileWatcher.on('started', () => {
      this.state.watcherActive = true;
      this.emit('watcherStarted');
    });

    await this.fileWatcher.start();
  }

  private async initializeValidator(): Promise<void> {
    const validationConfig = this.settings.uiMode?.validation || {
      wcagLevel: 'AA'
    };

    this.designValidator = new DesignValidator({
      wcagLevel: validationConfig.wcagLevel,
      designTokensPath: path.join(this.config.projectRoot!, 'design-tokens.json')
    });

    this.designValidator.on('validationComplete', (report) => {
      this.state.lastValidationScore = report.score.percentage;
      this.emit('validationComplete', report);
    });
  }

  private async handleFileChange(change: any): Promise<void> {
    if (!this.playwrightManager?.isReady()) return;

    try {
      // Reload the page
      await this.playwrightManager.reload();

      // Take screenshot for history
      if (this.iterationManager) {
        const screenshot = await this.playwrightManager.screenshot();
        const viewport = this.settings.browserSession?.defaultViewport || { width: 1440, height: 900 };

        const iteration = await this.iterationManager.saveIteration({
          url: this.state.currentUrl || 'unknown',
          screenshot,
          viewport,
          changes: [change.relativePath],
          validationScore: this.state.lastValidationScore
        });

        this.emit('iterationSaved', iteration);
      }

      // Run validation if enabled
      if (this.state.validationEnabled && this.designValidator) {
        const page = this.playwrightManager.getPage();
        if (page) {
          const report = await this.designValidator.validatePage(page);
          this.emit('validationComplete', report);
        }
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  async navigateTo(url: string): Promise<void> {
    if (!this.playwrightManager?.isReady()) {
      throw new Error('Browser not ready');
    }

    await this.playwrightManager.navigateTo(url);
    this.state.currentUrl = url;

    // Take initial screenshot
    if (this.iterationManager) {
      const screenshot = await this.playwrightManager.screenshot();
      const viewport = this.settings.browserSession?.defaultViewport || { width: 1440, height: 900 };

      await this.iterationManager.saveIteration({
        url,
        screenshot,
        viewport
      });
    }
  }

  async setViewport(preset: string | { width: number; height: number }): Promise<void> {
    if (!this.playwrightManager?.isReady()) {
      throw new Error('Browser not ready');
    }

    let viewport: { width: number; height: number };

    if (typeof preset === 'string') {
      // Load viewport presets
      const presetsPath = path.join(this.config.projectRoot!, 'ui-module', 'config', 'viewport-presets.json');
      const presetsContent = await fs.readFile(presetsPath, 'utf-8');
      const presets = JSON.parse(presetsContent);

      if (presets.presets[preset]) {
        viewport = presets.presets[preset];
      } else {
        throw new Error(`Unknown viewport preset: ${preset}`);
      }
    } else {
      viewport = preset;
    }

    await this.playwrightManager.setViewport(viewport);
    this.emit('viewportChanged', viewport);
  }

  async captureScreenshot(fullPage: boolean = true): Promise<Buffer> {
    if (!this.playwrightManager?.isReady()) {
      throw new Error('Browser not ready');
    }

    const screenshot = await this.playwrightManager.screenshot({ fullPage });

    if (this.iterationManager) {
      const viewport = this.settings.browserSession?.defaultViewport || { width: 1440, height: 900 };

      await this.iterationManager.saveIteration({
        url: this.state.currentUrl || 'unknown',
        screenshot,
        viewport,
        metadata: { manual: true }
      });
    }

    return screenshot;
  }

  async runValidation(): Promise<any> {
    if (!this.playwrightManager?.isReady() || !this.designValidator) {
      throw new Error('Validation not ready');
    }

    const page = this.playwrightManager.getPage();
    if (!page) {
      throw new Error('No active page');
    }

    const report = await this.designValidator.validatePage(page);
    return report;
  }

  async compareIterations(id1: string, id2: string): Promise<any> {
    if (!this.iterationManager) {
      throw new Error('Iteration manager not initialized');
    }

    return await this.iterationManager.compareIterations(id1, id2);
  }

  async triggerInteraction(selector: string, type: 'click' | 'hover' | 'focus'): Promise<void> {
    if (!this.playwrightManager?.isReady()) {
      throw new Error('Browser not ready');
    }

    await this.playwrightManager.triggerInteraction(selector, type);
  }

  async getPerformanceMetrics(): Promise<any> {
    if (!this.playwrightManager?.isReady()) {
      throw new Error('Browser not ready');
    }

    return await this.playwrightManager.getPerformanceMetrics();
  }

  getIterations(limit: number = 10): any[] {
    if (!this.iterationManager) return [];
    return this.iterationManager.getIterations(this.state.currentComponent, limit);
  }

  getState(): UIModeState {
    return { ...this.state };
  }

  getContextFiles(): Map<string, string> {
    return new Map(this.contextFiles);
  }

  toggleValidation(enabled?: boolean): void {
    this.state.validationEnabled = enabled !== undefined ? enabled : !this.state.validationEnabled;
    this.emit('validationToggled', this.state.validationEnabled);
  }

  async triggerDesignReview(): Promise<void> {
    // This would integrate with the design-review agent
    const state = {
      url: this.state.currentUrl,
      mode: this.state.mode,
      validationScore: this.state.lastValidationScore,
      iterations: this.getIterations(5),
      contextFiles: Array.from(this.contextFiles.keys())
    };

    this.emit('designReviewTriggered', state);

    // Here you would invoke the design-review subagent
    // For now, we'll just emit an event
  }

  private async saveState(): Promise<void> {
    const statePath = path.join(this.config.projectRoot!, '.ui-mode', 'state.json');
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await fs.writeFile(statePath, JSON.stringify(this.state, null, 2));
  }

  private async loadState(): Promise<void> {
    try {
      const statePath = path.join(this.config.projectRoot!, '.ui-mode', 'state.json');
      const stateContent = await fs.readFile(statePath, 'utf-8');
      const savedState = JSON.parse(stateContent);
      this.state = { ...this.state, ...savedState };
    } catch (error) {
      // State file might not exist yet
    }
  }

  async cleanup(): Promise<void> {
    await this.exitUIMode();

    if (this.iterationManager) {
      // Clean up old iterations (older than 30 days)
      await this.iterationManager.cleanupOldIterations(30);
    }

    this.emit('cleanup');
  }
}