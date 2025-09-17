import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { RateLimiter } from '../utils/RateLimiter.js';

export interface ValidationResult {
  passed: boolean;
  category: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  element?: string;
  suggestion?: string;
}

export interface ValidationReport {
  timestamp: number;
  url: string;
  results: ValidationResult[];
  score: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  wcagCompliance?: {
    level: 'A' | 'AA' | 'AAA';
    passed: boolean;
    violations: any[];
  };
  performance?: {
    FCP: number;
    LCP: number;
    CLS: number;
    TBT: number;
  };
}

export interface DesignValidatorConfig {
  wcagLevel: 'A' | 'AA' | 'AAA';
  customRules?: ValidationRule[];
  designTokensPath?: string;
  styleguideRules?: any;
}

export interface ValidationRule {
  name: string;
  category: string;
  validate: (context: any) => ValidationResult | null;
}

export class DesignValidator extends EventEmitter {
  private config: DesignValidatorConfig;
  private designTokens: any = null;
  private customRules: ValidationRule[] = [];
  private rateLimiter: RateLimiter;

  constructor(config: DesignValidatorConfig) {
    super();
    this.config = config;
    this.customRules = config.customRules || [];
    this.rateLimiter = new RateLimiter({
      minInterval: 1000, // Minimum 1 second between validations
      maxConcurrent: 1   // Only one validation at a time
    });
    this.loadDesignTokens();
  }

  private async loadDesignTokens(): Promise<void> {
    if (this.config.designTokensPath) {
      try {
        const tokensContent = await fs.readFile(this.config.designTokensPath, 'utf-8');
        this.designTokens = JSON.parse(tokensContent);
      } catch (error) {
        this.emit('error', error);
      }
    }
  }

  async validatePage(page: any): Promise<ValidationReport> {
    // Apply rate limiting
    return this.rateLimiter.add(async () => {
      const results: ValidationResult[] = [];
      const url = await page.url();

      try {
      // Run WCAG compliance check
      const wcagResults = await this.validateWCAGCompliance(page);
      results.push(...wcagResults);

      // Run color contrast validation
      const contrastResults = await this.validateColorContrast(page);
      results.push(...contrastResults);

      // Run typography validation
      const typographyResults = await this.validateTypography(page);
      results.push(...typographyResults);

      // Run spacing validation
      const spacingResults = await this.validateSpacing(page);
      results.push(...spacingResults);

      // Run responsive design validation
      const responsiveResults = await this.validateResponsiveDesign(page);
      results.push(...responsiveResults);

      // Run custom rules
      for (const rule of this.customRules) {
        const result = await rule.validate({ page, designTokens: this.designTokens });
        if (result) {
          results.push(result);
        }
      }

      // Get performance metrics
      const performance = await this.getPerformanceMetrics(page);

      // Calculate scores
      const score = this.calculateScore(results);

      const report: ValidationReport = {
        timestamp: Date.now(),
        url,
        results,
        score,
        performance
      };

      this.emit('validationComplete', report);
      return report;

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
    });
  }

  private async validateWCAGCompliance(page: any): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Inject axe-core if not already present
    await page.evaluate(() => {
      if (!window.axe) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.2/axe.min.js';
        document.head.appendChild(script);
      }
    });

    // Wait for axe to load
    await page.waitForFunction(() => window.axe, { timeout: 5000 });

    const axeResults = await page.evaluate((wcagLevel: string) => {
      return window.axe.run(document, {
        runOnly: {
          type: 'tag',
          values: [`wcag2${wcagLevel.toLowerCase()}`]
        }
      });
    }, this.config.wcagLevel);

    // Convert axe violations to our format
    for (const violation of axeResults.violations) {
      results.push({
        passed: false,
        category: 'accessibility',
        severity: violation.impact as 'error' | 'warning' | 'info',
        message: `${violation.description} (${violation.id})`,
        element: violation.nodes[0]?.target[0],
        suggestion: violation.helpUrl
      });
    }

    return results;
  }

  private async validateColorContrast(page: any): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    const contrastIssues = await page.evaluate(() => {
      const issues: any[] = [];
      const elements = document.querySelectorAll('*');

      elements.forEach((element) => {
        const style = window.getComputedStyle(element);
        const bgColor = style.backgroundColor;
        const textColor = style.color;

        // Skip if colors are transparent or inherit
        if (bgColor === 'rgba(0, 0, 0, 0)' || textColor === 'rgba(0, 0, 0, 0)') {
          return;
        }

        // Calculate contrast ratio (simplified - in production use a proper library)
        const getLuminance = (color: string) => {
          // Parse RGB values from color string
          const rgb = color.match(/\d+/g);
          if (!rgb) return 0;

          const [r, g, b] = rgb.map(n => {
            const val = parseInt(n) / 255;
            return val <= 0.03928
              ? val / 12.92
              : Math.pow((val + 0.055) / 1.055, 2.4);
          });

          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };

        const bgLuminance = getLuminance(bgColor);
        const textLuminance = getLuminance(textColor);
        const ratio = (Math.max(bgLuminance, textLuminance) + 0.05) /
                     (Math.min(bgLuminance, textLuminance) + 0.05);

        // Check WCAG AA requirements
        const fontSize = parseFloat(style.fontSize);
        const fontWeight = style.fontWeight;
        const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight === 'bold');
        const requiredRatio = isLargeText ? 3 : 4.5;

        if (ratio < requiredRatio) {
          issues.push({
            element: element.tagName + (element.id ? `#${element.id}` : ''),
            ratio: ratio.toFixed(2),
            required: requiredRatio,
            fontSize: fontSize,
            bgColor,
            textColor
          });
        }
      });

      return issues;
    });

    for (const issue of contrastIssues) {
      results.push({
        passed: false,
        category: 'color-contrast',
        severity: 'error',
        message: `Insufficient color contrast ratio: ${issue.ratio} (required: ${issue.required})`,
        element: issue.element,
        suggestion: `Increase contrast between ${issue.bgColor} and ${issue.textColor}`
      });
    }

    return results;
  }

  private async validateTypography(page: any): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    if (!this.designTokens?.typography) {
      return results;
    }

    const typographyIssues = await page.evaluate((tokens: any) => {
      const issues: any[] = [];
      const validFonts = tokens.typography?.fonts || [];
      const validSizes = tokens.typography?.sizes || [];

      const elements = document.querySelectorAll('*');
      elements.forEach((element) => {
        const style = window.getComputedStyle(element);
        const fontFamily = style.fontFamily;
        const fontSize = style.fontSize;

        // Check font family
        if (fontFamily && validFonts.length > 0) {
          const fontUsed = fontFamily.split(',')[0].trim().replace(/['"]/g, '');
          if (!validFonts.includes(fontUsed)) {
            issues.push({
              type: 'font-family',
              element: element.tagName,
              value: fontUsed,
              valid: validFonts
            });
          }
        }

        // Check font size
        if (fontSize && validSizes.length > 0) {
          const sizeValue = parseFloat(fontSize);
          if (!validSizes.includes(sizeValue)) {
            issues.push({
              type: 'font-size',
              element: element.tagName,
              value: sizeValue,
              valid: validSizes
            });
          }
        }
      });

      return issues;
    }, this.designTokens);

    for (const issue of typographyIssues) {
      results.push({
        passed: false,
        category: 'typography',
        severity: 'warning',
        message: `Invalid ${issue.type}: ${issue.value}`,
        element: issue.element,
        suggestion: `Use one of: ${issue.valid.join(', ')}`
      });
    }

    return results;
  }

  private async validateSpacing(page: any): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    if (!this.designTokens?.spacing) {
      return results;
    }

    const spacingIssues = await page.evaluate((tokens: any) => {
      const issues: any[] = [];
      const validSpacing = tokens.spacing?.values || [];

      const elements = document.querySelectorAll('*');
      elements.forEach((element) => {
        const style = window.getComputedStyle(element);
        const properties = ['margin', 'padding', 'gap'];

        properties.forEach(prop => {
          const value = style[prop as keyof CSSStyleDeclaration];
          if (value && value !== '0px') {
            const numValue = parseFloat(value as string);
            if (!validSpacing.includes(numValue)) {
              issues.push({
                property: prop,
                element: element.tagName,
                value: numValue,
                valid: validSpacing
              });
            }
          }
        });
      });

      return issues;
    }, this.designTokens);

    for (const issue of spacingIssues) {
      results.push({
        passed: false,
        category: 'spacing',
        severity: 'info',
        message: `Non-standard ${issue.property}: ${issue.value}px`,
        element: issue.element,
        suggestion: `Use spacing from design system: ${issue.valid.join(', ')}`
      });
    }

    return results;
  }

  private async validateResponsiveDesign(page: any): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Check for horizontal scrolling
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    if (hasHorizontalScroll) {
      results.push({
        passed: false,
        category: 'responsive',
        severity: 'error',
        message: 'Page has horizontal scrolling',
        suggestion: 'Check for fixed-width elements or overflow issues'
      });
    }

    // Check for viewport meta tag
    const hasViewportMeta = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="viewport"]');
      return meta !== null;
    });

    if (!hasViewportMeta) {
      results.push({
        passed: false,
        category: 'responsive',
        severity: 'error',
        message: 'Missing viewport meta tag',
        suggestion: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">'
      });
    }

    // Check for responsive images
    const unresponsiveImages = await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      const issues: any[] = [];

      images.forEach(img => {
        const style = window.getComputedStyle(img);
        if (style.maxWidth !== '100%' && style.width.includes('px')) {
          issues.push({
            src: img.src,
            width: style.width
          });
        }
      });

      return issues;
    });

    for (const img of unresponsiveImages) {
      results.push({
        passed: false,
        category: 'responsive',
        severity: 'warning',
        message: `Fixed-width image: ${img.width}`,
        element: img.src,
        suggestion: 'Use max-width: 100% for responsive images'
      });
    }

    return results;
  }

  private async getPerformanceMetrics(page: any): Promise<any> {
    const metrics = await page.evaluate(() => {
      const paint = performance.getEntriesByType('paint');
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      // Get Largest Contentful Paint
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      const lcp = lcpEntries[lcpEntries.length - 1];

      // Calculate Total Blocking Time (simplified)
      let tbt = 0;
      const longTasks = performance.getEntriesByType('longtask');
      longTasks.forEach((task: any) => {
        if (task.duration > 50) {
          tbt += task.duration - 50;
        }
      });

      return {
        FCP: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        LCP: lcp?.startTime || 0,
        CLS: 0, // Would need observer API for accurate CLS
        TBT: tbt
      };
    });

    return metrics;
  }

  private calculateScore(results: ValidationResult[]): any {
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed && r.severity === 'error').length;
    const warnings = results.filter(r => !r.passed && r.severity === 'warning').length;

    return {
      total,
      passed,
      failed,
      warnings,
      percentage: total > 0 ? Math.round((passed / total) * 100) : 100
    };
  }

  async validateAgainstStyleGuide(page: any, styleguideContent: string): Promise<ValidationResult[]> {
    // Parse style guide and extract rules
    // This would be implemented based on your style guide format
    return [];
  }

  addCustomRule(rule: ValidationRule): void {
    this.customRules.push(rule);
  }

  removeCustomRule(name: string): void {
    this.customRules = this.customRules.filter(r => r.name !== name);
  }
}