/**
 * DevAssist UI Module
 * Enhanced UI development mode for rapid visual iteration
 */

export { UIModeManager } from './UIModeManager.js';
export { PlaywrightManager } from './services/PlaywrightManager.js';
export { FileWatcher } from './services/FileWatcher.js';
export { DesignValidator } from './services/DesignValidator.js';
export { IterationManager } from './services/IterationManager.js';
export { DevAssistUIIntegration, createUIIntegration } from './DevAssistIntegration.js';

/**
 * Quick start function to initialize UI mode
 */
export async function initializeUIMode(config = {}) {
  const { UIModeManager } = await import('./UIModeManager.js');

  const manager = new UIModeManager({
    projectRoot: process.cwd(),
    autoStart: true,
    ...config
  });

  // Set up default keyboard shortcuts if in terminal environment
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.on('data', async (key) => {
      const char = key.toString();

      // Ctrl+U to toggle UI mode
      if (char === '\u0015') {
        const state = manager.getState();
        if (state.mode === 'ui') {
          await manager.exitUIMode();
          console.log('Exited UI Mode');
        } else {
          await manager.enterUIMode();
          console.log('Entered UI Mode');
        }
      }

      // Ctrl+S to take screenshot
      if (char === '\u0013' && manager.getState().mode === 'ui') {
        await manager.captureScreenshot();
        console.log('Screenshot captured');
      }

      // Ctrl+V to run validation
      if (char === '\u0016' && manager.getState().mode === 'ui') {
        const report = await manager.runValidation();
        console.log(`Validation score: ${report.score.percentage}%`);
      }

      // Ctrl+C to exit
      if (char === '\u0003') {
        await manager.cleanup();
        process.exit(0);
      }
    });
  }

  return manager;
}

// Default export for convenience
export default {
  initializeUIMode,
  UIModeManager,
  DevAssistUIIntegration
};