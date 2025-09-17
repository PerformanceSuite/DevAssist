import { describe, it } from 'node:test';
import assert from 'node:assert';
import { RateLimiter } from '../utils/RateLimiter.js';

describe('RateLimiter', () => {
  describe('Rate Limiting', () => {
    it('should enforce minimum interval between tasks', async () => {
      const limiter = new RateLimiter({ minInterval: 100, maxConcurrent: 1 });
      const startTime = Date.now();
      const results = [];

      // Queue two tasks
      const task1 = limiter.add(async () => {
        results.push(1);
        return 1;
      });

      const task2 = limiter.add(async () => {
        results.push(2);
        return 2;
      });

      await Promise.all([task1, task2]);

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should take at least 100ms due to rate limiting
      assert(elapsed >= 100, `Expected at least 100ms, got ${elapsed}ms`);
      assert.deepStrictEqual(results, [1, 2]);
    });

    it('should process tasks in order', async () => {
      const limiter = new RateLimiter({ minInterval: 10 });
      const results = [];

      const tasks = [1, 2, 3, 4, 5].map(n =>
        limiter.add(async () => {
          results.push(n);
          return n;
        })
      );

      await Promise.all(tasks);
      assert.deepStrictEqual(results, [1, 2, 3, 4, 5]);
    });

    it('should handle task errors', async () => {
      const limiter = new RateLimiter();

      await assert.rejects(
        async () => {
          await limiter.add(async () => {
            throw new Error('Task failed');
          });
        },
        /Task failed/
      );

      // Should still be able to process next task
      const result = await limiter.add(async () => 'success');
      assert.strictEqual(result, 'success');
    });
  });

  describe('Queue Management', () => {
    it('should report pending tasks', async () => {
      const limiter = new RateLimiter({ minInterval: 50 });

      assert.strictEqual(limiter.pending, 0);

      const tasks = [];
      for (let i = 0; i < 3; i++) {
        tasks.push(limiter.add(async () => i));
      }

      // Should have tasks in queue
      assert(limiter.pending > 0);

      await Promise.all(tasks);
      assert.strictEqual(limiter.pending, 0);
    });

    it('should clear queue', () => {
      const limiter = new RateLimiter();

      // Add tasks but don't await
      limiter.add(async () => 1);
      limiter.add(async () => 2);

      assert(limiter.pending > 0);

      limiter.clear();
      assert.strictEqual(limiter.pending, 0);
    });
  });
});

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Running RateLimiter tests...');
}