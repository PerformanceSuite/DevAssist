import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { PlaywrightManager } from '../services/PlaywrightManager.js';
import { EventEmitter } from 'events';

describe('PlaywrightManager', () => {
  let manager;

  beforeEach(() => {
    manager = new PlaywrightManager({
      headless: true,
      persistent: false
    });
  });

  afterEach(async () => {
    if (manager) {
      await manager.close();
    }
  });

  describe('URL Validation', () => {
    it('should reject invalid URLs', async () => {
      await assert.rejects(
        async () => await manager.navigateTo('not-a-url'),
        /Invalid URL provided/
      );
    });

    it('should reject dangerous protocols', async () => {
      await assert.rejects(
        async () => await manager.navigateTo('file:///etc/passwd'),
        /Invalid protocol/
      );
    });

    it('should accept valid HTTP URLs', async () => {
      // This would need a mock or test server
      // For now, just test that it doesn't throw on valid URL format
      try {
        await manager.navigateTo('http://example.com');
      } catch (error) {
        // Navigation might fail, but URL validation should pass
        assert(!error.message.includes('Invalid URL'));
      }
    });
  });

  describe('Initialization', () => {
    it('should emit initialized event', (done) => {
      const testManager = new PlaywrightManager({ headless: true });

      testManager.on('initialized', () => {
        assert(testManager.isReady());
        testManager.close().then(() => done());
      });

      testManager.initialize().catch(done);
    });

    it('should clean up on initialization failure', async () => {
      const badManager = new PlaywrightManager({
        headless: true,
        // Force an error by using invalid browser args
        browserArgs: ['--invalid-arg-that-will-fail']
      });

      try {
        await badManager.initialize();
      } catch (error) {
        // Should have cleaned up
        assert(!badManager.isReady());
      }
    });
  });

  describe('Event Emitter', () => {
    it('should extend EventEmitter', () => {
      assert(manager instanceof EventEmitter);
    });

    it('should remove listeners on close', async () => {
      manager.on('test', () => {});
      assert(manager.listenerCount('test') === 1);

      await manager.close();
      assert(manager.listenerCount('test') === 0);
    });
  });
});

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Running PlaywrightManager tests...');
}