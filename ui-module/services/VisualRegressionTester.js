/**
 * Visual Regression Testing System
 * Provides pixel-by-pixel comparison, diff generation, and visual testing
 */

import { createCanvas, loadImage } from 'canvas';
import pixelmatch from 'pixelmatch';
import fs from 'fs/promises';
import path from 'path';

export class VisualRegressionTester {
  constructor(config = {}) {
    this.threshold = config.threshold || 0.1; // 10% difference threshold
    this.outputPath = config.outputPath || '.devassist/visual-tests';
    this.baselinePath = path.join(this.outputPath, 'baselines');
    this.diffPath = path.join(this.outputPath, 'diffs');
    this.reportPath = path.join(this.outputPath, 'reports');
    
    this.testResults = [];
    this.currentSuite = null;
  }

  /**
   * Initialize visual testing directories
   */
  async initialize() {
    await fs.mkdir(this.baselinePath, { recursive: true });
    await fs.mkdir(this.diffPath, { recursive: true });
    await fs.mkdir(this.reportPath, { recursive: true });
  }

  /**
   * Compare two screenshots pixel by pixel
   */
  async compareScreenshots(baseline, current, options = {}) {
    const testId = options.testId || `test_${Date.now()}`;
    const component = options.component || 'unknown';
    
    try {
      // Load images
      const baselineImg = await loadImage(baseline);
      const currentImg = await loadImage(current);
      
      // Check dimensions match
      if (baselineImg.width !== currentImg.width || 
          baselineImg.height !== currentImg.height) {
        return {
          passed: false,
          error: 'Image dimensions do not match',
          baseline: { width: baselineImg.width, height: baselineImg.height },
          current: { width: currentImg.width, height: currentImg.height }
        };
      }
      
      // Create canvases for pixel data
      const width = baselineImg.width;
      const height = baselineImg.height;
      
      const baselineCanvas = createCanvas(width, height);
      const currentCanvas = createCanvas(width, height);
      const diffCanvas = createCanvas(width, height);
      
      const baselineCtx = baselineCanvas.getContext('2d');
      const currentCtx = currentCanvas.getContext('2d');
      const diffCtx = diffCanvas.getContext('2d');
      
      baselineCtx.drawImage(baselineImg, 0, 0);
      currentCtx.drawImage(currentImg, 0, 0);
      
      // Get image data
      const baselineData = baselineCtx.getImageData(0, 0, width, height);
      const currentData = currentCtx.getImageData(0, 0, width, height);
      const diffData = diffCtx.createImageData(width, height);
      
      // Perform pixel comparison
      const numDiffPixels = pixelmatch(
        baselineData.data,
        currentData.data,
        diffData.data,
        width,
        height,
        {
          threshold: options.threshold || this.threshold,
          includeAA: options.includeAntialiasing !== false,
          alpha: options.alpha || 0.1,
          aaColor: options.aaColor || [255, 255, 0], // Yellow for anti-aliasing
          diffColor: options.diffColor || [255, 0, 0], // Red for differences
          diffColorAlt: options.diffColorAlt || [0, 255, 0], // Green for additions
          diffMask: options.diffMask || false
        }
      );
      
      // Calculate difference percentage
      const totalPixels = width * height;
      const diffPercentage = (numDiffPixels / totalPixels) * 100;
      
      // Put diff data on canvas
      diffCtx.putImageData(diffData, 0, 0);
      
      // Save diff image
      const diffPath = await this.saveDiffImage(diffCanvas, testId, component);
      
      // Analyze differences
      const analysis = await this.analyzeDifferences(
        baselineData, 
        currentData, 
        numDiffPixels,
        { width, height }
      );
      
      // Create test result
      const result = {
        testId,
        component,
        timestamp: new Date().toISOString(),
        passed: diffPercentage <= (options.tolerance || 1.0),
        diffPercentage: diffPercentage.toFixed(4),
        numDiffPixels,
        totalPixels,
        diffImage: diffPath,
        analysis,
        threshold: options.threshold || this.threshold,
        dimensions: { width, height }
      };
      
      this.testResults.push(result);
      
      // Generate detailed report if significant differences
      if (!result.passed) {
        await this.generateDetailedReport(result, options);
      }
      
      return result;
      
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        testId,
        component
      };
    }
  }

  /**
   * Analyze differences to identify patterns
   */
  async analyzeDifferences(baselineData, currentData, numDiffPixels, dimensions) {
    const analysis = {
      regions: [],
      patterns: [],
      summary: {
        totalDifferences: numDiffPixels,
        affectedArea: 0
      }
    };

    // Find regions with differences
    const regions = this.findDifferenceRegions(baselineData, currentData, dimensions);
    analysis.regions = regions;

    // Identify patterns
    if (numDiffPixels > 0) {
      analysis.patterns = this.identifyPatterns(regions);
      analysis.summary.affectedArea = this.calculateAffectedArea(regions, dimensions);
    }

    return analysis;
  }
  /**
   * Find regions with differences
   */
  findDifferenceRegions(baselineData, currentData, dimensions) {
    const regions = [];
    const blockSize = 50; // Analyze in 50x50 blocks
    
    for (let y = 0; y < dimensions.height; y += blockSize) {
      for (let x = 0; x < dimensions.width; x += blockSize) {
        let hasDifference = false;
        
        // Check block for differences
        for (let dy = 0; dy < blockSize && y + dy < dimensions.height; dy++) {
          for (let dx = 0; dx < blockSize && x + dx < dimensions.width; dx++) {
            const idx = ((y + dy) * dimensions.width + (x + dx)) * 4;
            
            if (baselineData.data[idx] !== currentData.data[idx] ||
                baselineData.data[idx + 1] !== currentData.data[idx + 1] ||
                baselineData.data[idx + 2] !== currentData.data[idx + 2]) {
              hasDifference = true;
              break;
            }
          }
          if (hasDifference) break;
        }
        
        if (hasDifference) {
          regions.push({
            x, y,
            width: Math.min(blockSize, dimensions.width - x),
            height: Math.min(blockSize, dimensions.height - y)
          });
        }
      }
    }
    
    return this.mergeAdjacentRegions(regions);
  }

  /**
   * Merge adjacent regions for cleaner reporting
   */
  mergeAdjacentRegions(regions) {
    if (regions.length === 0) return regions;
    
    const merged = [];
    let current = regions[0];
    
    for (let i = 1; i < regions.length; i++) {
      const region = regions[i];
      
      // Check if adjacent
      if (this.areAdjacent(current, region)) {
        // Merge regions
        current = {
          x: Math.min(current.x, region.x),
          y: Math.min(current.y, region.y),
          width: Math.max(current.x + current.width, region.x + region.width) - 
                 Math.min(current.x, region.x),
          height: Math.max(current.y + current.height, region.y + region.height) - 
                  Math.min(current.y, region.y)
        };
      } else {
        merged.push(current);
        current = region;
      }
    }
    
    merged.push(current);
    return merged;
  }

  /**
   * Check if two regions are adjacent
   */
  areAdjacent(r1, r2) {
    const threshold = 10; // Pixels apart to consider adjacent
    
    return Math.abs(r1.x - (r2.x + r2.width)) <= threshold ||
           Math.abs(r2.x - (r1.x + r1.width)) <= threshold ||
           Math.abs(r1.y - (r2.y + r2.height)) <= threshold ||
           Math.abs(r2.y - (r1.y + r1.height)) <= threshold;
  }

  /**
   * Identify patterns in differences
   */
  identifyPatterns(regions) {
    const patterns = [];
    
    // Check for layout shifts
    if (regions.length > 5) {
      const avgY = regions.reduce((sum, r) => sum + r.y, 0) / regions.length;
      if (avgY < 100) {
        patterns.push('header-shift');
      } else if (avgY > 500) {
        patterns.push('footer-shift');
      }
    }
    
    // Check for color changes
    const colorChangeRegions = regions.filter(r => r.width * r.height < 1000);
    if (colorChangeRegions.length > 10) {
      patterns.push('color-change');
    }
    
    // Check for text changes
    const textRegions = regions.filter(r => r.width > r.height * 3);
    if (textRegions.length > 0) {
      patterns.push('text-change');
    }
    
    return patterns;
  }

  /**
   * Calculate affected area percentage
   */
  calculateAffectedArea(regions, dimensions) {
    const totalArea = dimensions.width * dimensions.height;
    const affectedArea = regions.reduce((sum, r) => sum + (r.width * r.height), 0);
    return (affectedArea / totalArea) * 100;
  }

  /**
   * Save diff image
   */
  async saveDiffImage(canvas, testId, component) {
    const buffer = canvas.toBuffer('image/png');
    const filename = `${testId}_${component}_diff.png`;
    const filepath = path.join(this.diffPath, filename);
    
    await fs.writeFile(filepath, buffer);
    return filepath;
  }

  /**
   * Generate detailed report for failed tests
   */
  async generateDetailedReport(result, options) {
    const report = {
      testId: result.testId,
      component: result.component,
      timestamp: result.timestamp,
      diffPercentage: result.diffPercentage,
      threshold: result.threshold,
      analysis: result.analysis,
      recommendations: []
    };
    
    // Add recommendations based on patterns
    if (result.analysis.patterns.includes('layout-shift')) {
      report.recommendations.push('Check responsive breakpoints and container sizing');
    }
    
    if (result.analysis.patterns.includes('color-change')) {
      report.recommendations.push('Verify color tokens and theme consistency');
    }
    
    if (result.analysis.patterns.includes('text-change')) {
      report.recommendations.push('Review text content and typography settings');
    }
    
    // Save report
    const reportPath = path.join(this.reportPath, `${result.testId}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    return report;
  }

  /**
   * Run test suite
   */
  async runSuite(suiteName, tests) {
    this.currentSuite = suiteName;
    const suiteResults = [];
    
    console.log(`🧪 Running visual regression suite: ${suiteName}`);
    
    for (const test of tests) {
      const result = await this.compareScreenshots(
        test.baseline,
        test.current,
        test.options
      );
      
      suiteResults.push(result);
      console.log(`  ${result.passed ? '✅' : '❌'} ${test.name}`);
    }
    
    const summary = {
      suite: suiteName,
      timestamp: new Date().toISOString(),
      total: suiteResults.length,
      passed: suiteResults.filter(r => r.passed).length,
      failed: suiteResults.filter(r => !r.passed).length,
      results: suiteResults
    };
    
    // Save suite report
    const reportPath = path.join(this.reportPath, `suite_${suiteName}_${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(summary, null, 2));
    
    return summary;
  }

  /**
   * Update baseline images
   */
  async updateBaseline(component, newImage) {
    const baselinePath = path.join(this.baselinePath, `${component}.png`);
    await fs.copyFile(newImage, baselinePath);
    
    console.log(`📸 Updated baseline for ${component}`);
    return baselinePath;
  }
}
