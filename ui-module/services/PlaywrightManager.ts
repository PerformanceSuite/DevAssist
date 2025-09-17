import { Browser, BrowserContext, Page, chromium } from '@playwright/test';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ViewportConfig {
  width: number;
  height: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
}

export interface PlaywrightManagerConfig {
  headless?: boolean;
  persistent?: boolean;
  defaultViewport?: ViewportConfig;
  userDataDir?: string;
}

export class PlaywrightManager extends EventEmitter {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: PlaywrightManagerConfig;
  private isInitialized = false;
  private url: string | null = null;

  constructor(config: PlaywrightManagerConfig = {}) {
    super();
    this.config = {
      headless: false,
      persistent: true,
      defaultViewport: { width: 1440, height: 900 },
      userDataDir: path.join(process.cwd(), '.ui-mode', 'browser-data'),
      ...config
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Ensure user data directory exists
      if (this.config.persistent && this.config.userDataDir) {
        await fs.mkdir(this.config.userDataDir, { recursive: true });
      }

      // Launch browser
      this.browser = await chromium.launch({
        headless: this.config.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      // Create context with persistent storage if enabled
      if (this.config.persistent && this.config.userDataDir) {
        this.context = await this.browser.newContext({
          viewport: this.config.defaultViewport,
          storageState: await this.loadStorageState()
        });
      } else {
        this.context = await this.browser.newContext({
          viewport: this.config.defaultViewport
        });
      }

      // Create initial page
      this.page = await this.context.newPage();

      // Set up event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      // Clean up any partially initialized resources
      await this.cleanup();

      this.emit('error', {
        message: `Failed to initialize Playwright: ${error.message}`,
        recovery: 'Ensure Playwright is installed: npx playwright install chromium',
        error
      });
      throw error;
    }
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.isInitialized = false;
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError);
    }
  }

  private setupEventListeners(): void {
    if (!this.page) return;

    this.page.on('console', (msg) => {
      this.emit('console', {
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
    });

    this.page.on('pageerror', (error) => {
      this.emit('pageError', error);
    });

    this.page.on('response', (response) => {
      if (response.status() >= 400) {
        this.emit('networkError', {
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
      }
    });
  }

  async navigateTo(url: string): Promise<void> {
    // Validate URL
    try {
      const urlObj = new URL(url);
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error(`Invalid protocol: ${urlObj.protocol}`);
      }
    } catch (error) {
      throw new Error(`Invalid URL provided: ${url}. ${error.message}`);
    }

    if (!this.page) {
      await this.initialize();
    }

    try {
      this.url = url;
      await this.page!.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      this.emit('navigated', url);
    } catch (error) {
      this.emit('error', {
        message: `Failed to navigate to ${url}: ${error.message}`,
        recovery: 'Check if the URL is accessible and the server is running',
        error
      });
      throw error;
    }
  }

  async reload(): Promise<void> {
    if (!this.page) return;

    await this.page.reload({ waitUntil: 'networkidle' });
    this.emit('reloaded');
  }

  async setViewport(viewport: ViewportConfig): Promise<void> {
    if (!this.page) return;

    await this.page.setViewportSize({
      width: viewport.width,
      height: viewport.height
    });

    this.emit('viewportChanged', viewport);
  }

  async screenshot(options: {
    fullPage?: boolean;
    path?: string;
    quality?: number;
  } = {}): Promise<Buffer> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    const screenshotBuffer = await this.page.screenshot({
      fullPage: options.fullPage ?? true,
      type: 'jpeg',
      quality: options.quality ?? 80
    });

    if (options.path) {
      await fs.writeFile(options.path, screenshotBuffer);
    }

    this.emit('screenshotTaken', options.path);
    return screenshotBuffer;
  }

  async evaluateAccessibility(): Promise<any> {
    if (!this.page) return null;

    // Inject axe-core for accessibility testing
    await this.page.addScriptTag({
      url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.2/axe.min.js'
    });

    const results = await this.page.evaluate(() => {
      // @ts-ignore
      return window.axe.run();
    });

    return results;
  }

  async getPerformanceMetrics(): Promise<any> {
    if (!this.page) return null;

    const metrics = await this.page.evaluate(() => {
      const paint = performance.getEntriesByType('paint');
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      return {
        FCP: paint.find(p => p.name === 'first-contentful-paint')?.startTime,
        LCP: performance.getEntriesByType('largest-contentful-paint')[0]?.startTime,
        domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart,
        loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart
      };
    });

    return metrics;
  }

  async emulateDevice(deviceName: string): Promise<void> {
    // This would integrate with viewport presets
    const devices = {
      'iPhone15': { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
      'iPadPro': { width: 1024, height: 1366, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
      // Add more devices as needed
    };

    const device = devices[deviceName as keyof typeof devices];
    if (device) {
      await this.setViewport(device);
    }
  }

  async triggerInteraction(selector: string, type: 'click' | 'hover' | 'focus'): Promise<void> {
    if (!this.page) return;

    switch (type) {
      case 'click':
        await this.page.click(selector);
        break;
      case 'hover':
        await this.page.hover(selector);
        break;
      case 'focus':
        await this.page.focus(selector);
        break;
    }

    this.emit('interactionTriggered', { selector, type });
  }

  private async loadStorageState(): Promise<any> {
    const statePath = path.join(this.config.userDataDir!, 'state.json');
    try {
      const state = await fs.readFile(statePath, 'utf-8');
      return JSON.parse(state);
    } catch {
      return undefined;
    }
  }

  async saveStorageState(): Promise<void> {
    if (!this.context || !this.config.userDataDir) return;

    const state = await this.context.storageState();
    const statePath = path.join(this.config.userDataDir, 'state.json');
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  }

  async close(): Promise<void> {
    if (this.config.persistent) {
      await this.saveStorageState();
    }

    // Remove all listeners before cleanup
    this.removeAllListeners();

    await this.cleanup();
    this.emit('closed');
  }

  getPage(): Page | null {
    return this.page;
  }

  getCurrentUrl(): string | null {
    return this.url;
  }

  isReady(): boolean {
    return this.isInitialized && this.page !== null;
  }
}