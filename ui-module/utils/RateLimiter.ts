export class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastProcessTime = 0;
  private readonly minInterval: number;
  private readonly maxConcurrent: number;
  private activeCount = 0;

  constructor(options: {
    minInterval?: number;
    maxConcurrent?: number;
  } = {}) {
    this.minInterval = options.minInterval || 1000;
    this.maxConcurrent = options.maxConcurrent || 1;
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.processing || this.activeCount >= this.maxConcurrent) {
      return;
    }

    const now = Date.now();
    const timeSinceLastProcess = now - this.lastProcessTime;

    if (timeSinceLastProcess < this.minInterval) {
      setTimeout(() => this.process(), this.minInterval - timeSinceLastProcess);
      return;
    }

    const task = this.queue.shift();
    if (!task) {
      return;
    }

    this.processing = true;
    this.activeCount++;
    this.lastProcessTime = now;

    try {
      await task();
    } finally {
      this.activeCount--;
      this.processing = false;

      // Process next item if available
      if (this.queue.length > 0) {
        this.process();
      }
    }
  }

  get pending(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }
}