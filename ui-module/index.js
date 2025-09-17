/**
 * UI Module Main Entry Point
 * Exports the UIModeManager for DevAssist integration
 */

import { UIModuleCoordinator } from './UIModuleCoordinator.js';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';

export class UIModeManager extends EventEmitter {
  constructor() {
    super();
    this.coordinator = null;
    this.isActive = false;
    this.currentMode = 'standard';
    this.config = null;
  }

  /**
   * Initialize UI Mode Manager
   */
  async initialize(projectPath, devAssistPath) {
    if (this.coordinator) return true;
    
    try {
      this.coordinator = new UIModuleCoordinator(projectPath, devAssistPath);
      await this.coordinator.initialize();
      
      // Load configuration
      const configPath = path.join(devAssistPath, 'config', 'ui-module-config.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      this.config = JSON.parse(configData);
      
      this.isActive = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize UI Mode Manager:', error);
      return false;
    }
  }

  /**
   * Toggle between UI and standard mode
   */
  async toggleMode(mode) {
    if (!this.coordinator) {
      throw new Error('UI Module not initialized');
    }
    
    if (mode === 'ui' && this.currentMode !== 'ui') {
      await this.enterUIMode();
    } else if (mode === 'standard' && this.currentMode === 'ui') {
      await this.exitUIMode();
    }
    
    return {
      currentMode: this.currentMode,
      active: this.isActive
    };
  }

  /**
   * Enter UI development mode
   */
  async enterUIMode(options = {}) {
    console.log('🎨 Entering UI Development Mode...');
    
    const result = await this.coordinator.enterUIMode(options);
    this.currentMode = 'ui';
    
    this.emit('mode:changed', { mode: 'ui', workspace: result });
    
    return {
      mode: 'ui',
      workspace: result,
      features: this.config.uiModule.features,
      shortcuts: this.config.uiModule.shortcuts
    };
  }

  /**
   * Exit UI mode and return to standard mode
   */
  async exitUIMode() {
    console.log('👋 Exiting UI Mode...');
    
    if (this.coordinator) {
      await this.coordinator.exitUIMode();
    }
    
    this.currentMode = 'standard';
    this.emit('mode:changed', { mode: 'standard' });
    
    return {
      mode: 'standard',
      sessionSummary: await this.coordinator.getSessionSummary()
    };
  }

  /**
   * Navigate to URL or component
   */
  async navigate(url) {
    if (!this.coordinator || this.currentMode !== 'ui') {
      throw new Error('UI Mode not active');
    }
    
    return await this.coordinator.navigate(url);
  }

  /**
   * Set viewport size
   */
  async setViewport(viewport) {
    if (!this.coordinator || this.currentMode !== 'ui') {
      throw new Error('UI Mode not active');
    }
    
    const viewportSizes = {
      mobile: { width: 375, height: 812 },
      tablet: { width: 768, height: 1024 },
      desktop: { width: 1440, height: 900 },
      wide: { width: 1920, height: 1080 }
    };
    
    const size = typeof viewport === 'string' 
      ? viewportSizes[viewport] 
      : viewport;
    
    return await this.coordinator.setViewport(size);
  }

  /**
   * Validate current design
   */
  async validateDesign(options = {}) {
    if (!this.coordinator || this.currentMode !== 'ui') {
      throw new Error('UI Mode not active');
    }
    
    return await this.coordinator.validateDesign(options);
  }

  /**
   * Capture design iteration
   */
  async captureIteration(description) {
    if (!this.coordinator || this.currentMode !== 'ui') {
      throw new Error('UI Mode not active');
    }
    
    return await this.coordinator.captureIteration(description);
  }
}

// Export for DevAssist
export { UIModeManager };
export default UIModeManager;
