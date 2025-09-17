import { EventEmitter } from 'events';
import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs/promises';
import { minimatch } from 'minimatch';

export interface FileWatcherConfig {
  patterns: string[];
  ignore?: string[];
  debounceMs?: number;
  cwd?: string;
}

export interface FileChange {
  type: 'add' | 'change' | 'unlink';
  path: string;
  relativePath: string;
  timestamp: number;
  stats?: any;
}

export class FileWatcher extends EventEmitter {
  private watcher: chokidar.FSWatcher | null = null;
  private config: FileWatcherConfig;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private changeBuffer: Map<string, FileChange> = new Map();
  private isWatching = false;

  constructor(config: FileWatcherConfig) {
    super();
    this.config = {
      debounceMs: 500,
      cwd: process.cwd(),
      ...config
    };
  }

  async start(): Promise<void> {
    if (this.isWatching) {
      return;
    }

    const watchPaths = this.config.patterns.map(pattern =>
      path.join(this.config.cwd!, pattern)
    );

    this.watcher = chokidar.watch(watchPaths, {
      ignored: this.config.ignore || [],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100
      }
    });

    this.setupEventListeners();
    this.isWatching = true;
    this.emit('started');
  }

  private setupEventListeners(): void {
    if (!this.watcher) return;

    this.watcher
      .on('add', (filePath) => this.handleFileEvent('add', filePath))
      .on('change', (filePath) => this.handleFileEvent('change', filePath))
      .on('unlink', (filePath) => this.handleFileEvent('unlink', filePath))
      .on('error', (error) => this.emit('error', error));
  }

  private handleFileEvent(type: 'add' | 'change' | 'unlink', filePath: string): void {
    const relativePath = path.relative(this.config.cwd!, filePath);

    // Check if file matches our patterns and not ignored
    if (!this.shouldWatchFile(relativePath)) {
      return;
    }

    const change: FileChange = {
      type,
      path: filePath,
      relativePath,
      timestamp: Date.now()
    };

    // Add to buffer
    this.changeBuffer.set(filePath, change);

    // Clear existing debounce timer
    if (this.debounceTimers.has(filePath)) {
      clearTimeout(this.debounceTimers.get(filePath)!);
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.flushChanges(filePath);
      this.debounceTimers.delete(filePath);
    }, this.config.debounceMs);

    this.debounceTimers.set(filePath, timer);
  }

  private shouldWatchFile(relativePath: string): boolean {
    // Check if file matches any ignore pattern
    if (this.config.ignore) {
      for (const pattern of this.config.ignore) {
        if (minimatch(relativePath, pattern)) {
          return false;
        }
      }
    }

    // Check if file matches any watch pattern
    for (const pattern of this.config.patterns) {
      if (minimatch(relativePath, pattern)) {
        return true;
      }
    }

    return false;
  }

  private flushChanges(filePath: string): void {
    const change = this.changeBuffer.get(filePath);
    if (!change) return;

    this.changeBuffer.delete(filePath);

    // Emit specific event
    this.emit(change.type, change);

    // Emit generic change event
    this.emit('fileChanged', change);

    // Categorize by file type
    const ext = path.extname(filePath).toLowerCase();
    if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
      this.emit('styleChanged', change);
    } else if (['.tsx', '.jsx', '.js', '.ts'].includes(ext)) {
      this.emit('componentChanged', change);
    } else if (['.html', '.htm'].includes(ext)) {
      this.emit('htmlChanged', change);
    }
  }

  async getFileContent(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      this.emit('error', error);
      return '';
    }
  }

  async getChangedFiles(since: number): Promise<FileChange[]> {
    const changes: FileChange[] = [];

    for (const change of this.changeBuffer.values()) {
      if (change.timestamp >= since) {
        changes.push(change);
      }
    }

    return changes;
  }

  pause(): void {
    if (this.watcher) {
      this.watcher.unwatch('*');
      this.emit('paused');
    }
  }

  resume(): void {
    if (this.watcher && this.config.patterns) {
      const watchPaths = this.config.patterns.map(pattern =>
        path.join(this.config.cwd!, pattern)
      );
      this.watcher.add(watchPaths);
      this.emit('resumed');
    }
  }

  stop(): void {
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.changeBuffer.clear();

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    this.isWatching = false;
    this.emit('stopped');
  }

  isActive(): boolean {
    return this.isWatching;
  }

  getWatchedPatterns(): string[] {
    return this.config.patterns;
  }
}