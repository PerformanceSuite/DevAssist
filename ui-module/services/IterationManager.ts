import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import sharp from 'sharp';

export interface DesignIteration {
  id: string;
  timestamp: number;
  componentPath?: string;
  url: string;
  viewport: {
    width: number;
    height: number;
  };
  screenshot: {
    path: string;
    thumbnail: string;
  };
  changes?: string[];
  annotations?: Annotation[];
  validationScore?: number;
  metadata?: any;
}

export interface Annotation {
  id: string;
  x: number;
  y: number;
  text: string;
  author?: string;
  timestamp: number;
  resolved?: boolean;
}

export interface DiffResult {
  pixelsDifferent: number;
  percentDifferent: number;
  diffImagePath: string;
}

export class IterationManager extends EventEmitter {
  private storageDir: string;
  private iterations: Map<string, DesignIteration[]> = new Map();
  private maxIterations: number;
  private currentComponent: string | null = null;

  constructor(storageDir: string = '.ui-mode/iterations', maxIterations: number = 50) {
    super();
    this.storageDir = path.resolve(storageDir);
    this.maxIterations = maxIterations;
    this.initialize();
  }

  private validatePath(filePath: string): void {
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(this.storageDir)) {
      throw new Error(`Path traversal attempt detected: ${filePath}`);
    }
  }

  private async initialize(): Promise<void> {
    // Create storage directories
    await fs.mkdir(path.join(this.storageDir, 'screenshots'), { recursive: true });
    await fs.mkdir(path.join(this.storageDir, 'thumbnails'), { recursive: true });
    await fs.mkdir(path.join(this.storageDir, 'diffs'), { recursive: true });
    await fs.mkdir(path.join(this.storageDir, 'data'), { recursive: true });

    // Load existing iterations
    await this.loadIterations();
  }

  private async loadIterations(): Promise<void> {
    try {
      const dataDir = path.join(this.storageDir, 'data');
      const files = await fs.readdir(dataDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(dataDir, file), 'utf-8');
          const data = JSON.parse(content);
          const componentId = file.replace('.json', '');
          this.iterations.set(componentId, data.iterations || []);
        }
      }
    } catch (error) {
      // Directory might not exist yet
      this.emit('error', error);
    }
  }

  async saveIteration(params: {
    componentPath?: string;
    url: string;
    screenshot: Buffer;
    viewport: { width: number; height: number };
    changes?: string[];
    validationScore?: number;
    metadata?: any;
  }): Promise<DesignIteration> {
    const id = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();

    // Determine component ID
    const componentId = params.componentPath || this.getComponentFromUrl(params.url);
    this.currentComponent = componentId;

    // Save screenshot
    const screenshotPath = path.join(this.storageDir, 'screenshots', `${id}.jpg`);
    await sharp(params.screenshot)
      .jpeg({ quality: 80 })
      .toFile(screenshotPath);

    // Create thumbnail
    const thumbnailPath = path.join(this.storageDir, 'thumbnails', `${id}.jpg`);
    await sharp(params.screenshot)
      .resize(200, 150, { fit: 'contain' })
      .jpeg({ quality: 60 })
      .toFile(thumbnailPath);

    // Create iteration object
    const iteration: DesignIteration = {
      id,
      timestamp,
      componentPath: params.componentPath,
      url: params.url,
      viewport: params.viewport,
      screenshot: {
        path: screenshotPath,
        thumbnail: thumbnailPath
      },
      changes: params.changes,
      validationScore: params.validationScore,
      metadata: params.metadata,
      annotations: []
    };

    // Add to iterations
    if (!this.iterations.has(componentId)) {
      this.iterations.set(componentId, []);
    }

    const componentIterations = this.iterations.get(componentId)!;
    componentIterations.push(iteration);

    // Limit iterations
    if (componentIterations.length > this.maxIterations) {
      const removed = componentIterations.shift();
      if (removed) {
        await this.deleteIterationFiles(removed);
      }
    }

    // Save to disk
    await this.saveIterationsToDisk(componentId);

    this.emit('iterationSaved', iteration);
    return iteration;
  }

  private async deleteIterationFiles(iteration: DesignIteration): Promise<void> {
    try {
      await fs.unlink(iteration.screenshot.path);
      await fs.unlink(iteration.screenshot.thumbnail);
    } catch (error) {
      // Files might already be deleted
      this.emit('error', error);
    }
  }

  private async saveIterationsToDisk(componentId: string): Promise<void> {
    const dataPath = path.join(this.storageDir, 'data', `${componentId}.json`);
    const data = {
      componentId,
      lastUpdated: Date.now(),
      iterations: this.iterations.get(componentId) || []
    };

    await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
  }

  async compareIterations(iteration1Id: string, iteration2Id: string): Promise<DiffResult> {
    const iter1 = this.findIteration(iteration1Id);
    const iter2 = this.findIteration(iteration2Id);

    if (!iter1 || !iter2) {
      throw new Error('Iteration not found');
    }

    // Load images
    const img1 = await sharp(iter1.screenshot.path).raw().toBuffer({ resolveWithObject: true });
    const img2 = await sharp(iter2.screenshot.path).raw().toBuffer({ resolveWithObject: true });

    // Ensure images are same size
    if (img1.info.width !== img2.info.width || img1.info.height !== img2.info.height) {
      throw new Error('Images must be same size for comparison');
    }

    // Create diff image
    const diffBuffer = Buffer.alloc(img1.data.length);
    let differentPixels = 0;

    for (let i = 0; i < img1.data.length; i += 4) {
      const r1 = img1.data[i];
      const g1 = img1.data[i + 1];
      const b1 = img1.data[i + 2];
      const a1 = img1.data[i + 3];

      const r2 = img2.data[i];
      const g2 = img2.data[i + 1];
      const b2 = img2.data[i + 2];
      const a2 = img2.data[i + 3];

      const isDifferent = Math.abs(r1 - r2) > 5 ||
                         Math.abs(g1 - g2) > 5 ||
                         Math.abs(b1 - b2) > 5 ||
                         Math.abs(a1 - a2) > 5;

      if (isDifferent) {
        // Highlight difference in red
        diffBuffer[i] = 255;     // R
        diffBuffer[i + 1] = 0;   // G
        diffBuffer[i + 2] = 0;   // B
        diffBuffer[i + 3] = 255; // A
        differentPixels++;
      } else {
        // Keep original pixel (grayscale)
        const gray = Math.round(0.299 * r1 + 0.587 * g1 + 0.114 * b1);
        diffBuffer[i] = gray;
        diffBuffer[i + 1] = gray;
        diffBuffer[i + 2] = gray;
        diffBuffer[i + 3] = a1;
      }
    }

    // Save diff image
    const diffId = crypto.randomBytes(8).toString('hex');
    const diffPath = path.join(this.storageDir, 'diffs', `${diffId}.jpg`);

    await sharp(diffBuffer, {
      raw: {
        width: img1.info.width,
        height: img1.info.height,
        channels: 4
      }
    })
    .jpeg({ quality: 80 })
    .toFile(diffPath);

    const totalPixels = img1.info.width * img1.info.height;
    const percentDifferent = (differentPixels / totalPixels) * 100;

    const result: DiffResult = {
      pixelsDifferent: differentPixels,
      percentDifferent: parseFloat(percentDifferent.toFixed(2)),
      diffImagePath: diffPath
    };

    this.emit('comparisonComplete', result);
    return result;
  }

  private findIteration(iterationId: string): DesignIteration | null {
    for (const iterations of this.iterations.values()) {
      const found = iterations.find(it => it.id === iterationId);
      if (found) return found;
    }
    return null;
  }

  async addAnnotation(iterationId: string, annotation: Omit<Annotation, 'id' | 'timestamp'>): Promise<Annotation> {
    const iteration = this.findIteration(iterationId);
    if (!iteration) {
      throw new Error('Iteration not found');
    }

    const fullAnnotation: Annotation = {
      ...annotation,
      id: crypto.randomBytes(4).toString('hex'),
      timestamp: Date.now(),
      resolved: false
    };

    if (!iteration.annotations) {
      iteration.annotations = [];
    }
    iteration.annotations.push(fullAnnotation);

    // Save updated iteration
    const componentId = this.findComponentId(iterationId);
    if (componentId) {
      await this.saveIterationsToDisk(componentId);
    }

    this.emit('annotationAdded', fullAnnotation);
    return fullAnnotation;
  }

  private findComponentId(iterationId: string): string | null {
    for (const [componentId, iterations] of this.iterations.entries()) {
      if (iterations.find(it => it.id === iterationId)) {
        return componentId;
      }
    }
    return null;
  }

  async resolveAnnotation(iterationId: string, annotationId: string): Promise<void> {
    const iteration = this.findIteration(iterationId);
    if (!iteration || !iteration.annotations) {
      throw new Error('Iteration or annotations not found');
    }

    const annotation = iteration.annotations.find(a => a.id === annotationId);
    if (annotation) {
      annotation.resolved = true;
      const componentId = this.findComponentId(iterationId);
      if (componentId) {
        await this.saveIterationsToDisk(componentId);
      }
      this.emit('annotationResolved', annotation);
    }
  }

  getIterations(componentId?: string, limit: number = 10): DesignIteration[] {
    if (componentId) {
      const iterations = this.iterations.get(componentId) || [];
      return iterations.slice(-limit);
    }

    // Return recent iterations from all components
    const allIterations: DesignIteration[] = [];
    for (const iterations of this.iterations.values()) {
      allIterations.push(...iterations);
    }

    return allIterations
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  getTimeline(componentId: string): DesignIteration[] {
    return this.iterations.get(componentId) || [];
  }

  private getComponentFromUrl(url: string): string {
    // Extract component name from URL
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    return pathname.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'index';
  }

  async generateDesignReport(componentId: string): Promise<string> {
    const iterations = this.iterations.get(componentId) || [];
    if (iterations.length === 0) {
      return 'No iterations found';
    }

    const report: string[] = [
      `# Design Evolution Report`,
      `Component: ${componentId}`,
      `Total Iterations: ${iterations.length}`,
      `Period: ${new Date(iterations[0].timestamp).toLocaleDateString()} - ${new Date(iterations[iterations.length - 1].timestamp).toLocaleDateString()}`,
      '',
      '## Iterations',
      ''
    ];

    for (let i = 0; i < iterations.length; i++) {
      const iter = iterations[i];
      report.push(`### Iteration ${i + 1} - ${new Date(iter.timestamp).toLocaleString()}`);
      report.push(`- Viewport: ${iter.viewport.width}x${iter.viewport.height}`);

      if (iter.validationScore !== undefined) {
        report.push(`- Validation Score: ${iter.validationScore}%`);
      }

      if (iter.changes && iter.changes.length > 0) {
        report.push('- Changes:');
        iter.changes.forEach(change => report.push(`  - ${change}`));
      }

      if (iter.annotations && iter.annotations.length > 0) {
        report.push('- Annotations:');
        iter.annotations.forEach(ann => {
          report.push(`  - ${ann.text} ${ann.resolved ? '✓' : '⏳'}`);
        });
      }

      report.push('');
    }

    return report.join('\n');
  }

  async cleanupOldIterations(daysOld: number = 30): Promise<number> {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const [componentId, iterations] of this.iterations.entries()) {
      const toKeep = iterations.filter(iter => iter.timestamp > cutoffTime);
      const toDelete = iterations.filter(iter => iter.timestamp <= cutoffTime);

      for (const iter of toDelete) {
        await this.deleteIterationFiles(iter);
        deletedCount++;
      }

      this.iterations.set(componentId, toKeep);
      await this.saveIterationsToDisk(componentId);
    }

    this.emit('cleanupComplete', deletedCount);
    return deletedCount;
  }
}