/**
 * Design System Validator
 * Enforces design tokens, spacing scale, and brand consistency
 */

import fs from 'fs/promises';
import path from 'path';
import { parse } from 'css';

export class DesignSystemValidator {
  constructor(config = {}) {
    this.designTokens = config.designTokens || {};
    this.spacingScale = config.spacingScale || [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64];
    this.colorPalette = config.colorPalette || {};
    this.typography = config.typography || {};
    this.breakpoints = config.breakpoints || {
      mobile: 375,
      tablet: 768,
      desktop: 1440,
      wide: 1920
    };
    
    this.violations = [];
    this.warnings = [];
    this.suggestions = [];
  }

  /**
   * Load design system configuration
   */
  async loadDesignSystem(configPath) {
    try {
      const configFile = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configFile);
      
      this.designTokens = config.tokens || this.designTokens;
      this.spacingScale = config.spacing || this.spacingScale;
      this.colorPalette = config.colors || this.colorPalette;
      this.typography = config.typography || this.typography;
      this.breakpoints = config.breakpoints || this.breakpoints;
      
      return true;
    } catch (error) {
      console.warn('Could not load design system config:', error);
      return false;
    }
  }
  /**
   * Validate CSS against design system
   */
  async validateCSS(cssContent, componentName = 'unknown') {
    this.violations = [];
    this.warnings = [];
    this.suggestions = [];
    
    try {
      const ast = parse(cssContent);
      
      // Validate each rule
      for (const rule of ast.stylesheet.rules) {
        if (rule.type === 'rule') {
          await this.validateRule(rule, componentName);
        }
      }
      
      return {
        valid: this.violations.length === 0,
        violations: this.violations,
        warnings: this.warnings,
        suggestions: this.suggestions,
        summary: this.generateSummary()
      };
      
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Validate individual CSS rule
   */
  async validateRule(rule, componentName) {
    for (const declaration of rule.declarations || []) {
      if (declaration.type !== 'declaration') continue;
      
      const property = declaration.property;
      const value = declaration.value;
      
      // Validate based on property type
      switch (property) {
        case 'color':
        case 'background-color':
        case 'border-color':
          this.validateColorUsage(value, property, componentName);
          break;
          
        case 'margin':
        case 'margin-top':
        case 'margin-right':
        case 'margin-bottom':
        case 'margin-left':
        case 'padding':
        case 'padding-top':
        case 'padding-right':
        case 'padding-bottom':
        case 'padding-left':
        case 'gap':
          this.validateSpacing(value, property, componentName);
          break;
          
        case 'font-size':
        case 'line-height':
        case 'font-weight':
          this.validateTypography(value, property, componentName);
          break;
          
        case 'border-radius':
          this.validateBorderRadius(value, property, componentName);
          break;
      }
    }
  }

  /**
   * Validate color usage against palette
   */
  validateColorUsage(value, property, componentName) {
    // Skip CSS variables (they're likely from design system)
    if (value.startsWith('var(--')) return;
    
    // Check if color is in palette
    const isInPalette = Object.values(this.colorPalette).some(paletteColor => {
      if (typeof paletteColor === 'object') {
        return Object.values(paletteColor).includes(value);
      }
      return paletteColor === value;
    });
    
    if (!isInPalette) {
      this.violations.push({
        type: 'color',
        property,
        value,
        component: componentName,
        message: `Color '${value}' not in design system palette`,
        severity: 'high'
      });
    }
  }

  /**
   * Validate spacing against scale
   */
  validateSpacing(value, property, componentName) {
    // Skip CSS variables and auto/inherit
    if (value.startsWith('var(--') || value === 'auto' || value === 'inherit') return;
    
    // Parse numeric value
    const match = value.match(/^(\d+(?:\.\d+)?)(px|rem|em)$/);
    if (!match) return;
    
    const numValue = parseFloat(match[1]);
    const unit = match[2];
    
    // Convert to pixels for comparison
    let pxValue = numValue;
    if (unit === 'rem') pxValue = numValue * 16;
    if (unit === 'em') pxValue = numValue * 16; // Approximate
    
    // Check if value is in spacing scale
    const isInScale = this.spacingScale.includes(pxValue);
    
    if (!isInScale) {
      // Find closest valid value
      const closest = this.spacingScale.reduce((prev, curr) => 
        Math.abs(curr - pxValue) < Math.abs(prev - pxValue) ? curr : prev
      );
      
      this.warnings.push({
        type: 'spacing',
        property,
        value,
        component: componentName,
        message: `Spacing '${value}' not in scale. Consider using '${closest}px'`,
        severity: 'medium',
        suggestion: `${closest}px`
      });
    }
  }

  /**
   * Validate typography settings
   */
  validateTypography(value, property, componentName) {
    if (!this.typography.sizes && !this.typography.weights) return;
    
    if (property === 'font-size' && this.typography.sizes) {
      const isValid = Object.values(this.typography.sizes).includes(value);
      if (!isValid) {
        this.warnings.push({
          type: 'typography',
          property,
          value,
          component: componentName,
          message: `Font size '${value}' not in typography scale`,
          severity: 'low'
        });
      }
    }
    
    if (property === 'font-weight' && this.typography.weights) {
      const isValid = this.typography.weights.includes(value);
      if (!isValid) {
        this.warnings.push({
          type: 'typography',
          property,
          value,
          component: componentName,
          message: `Font weight '${value}' not in approved weights`,
          severity: 'low'
        });
      }
    }
  }

  /**
   * Validate border radius
   */
  validateBorderRadius(value, property, componentName) {
    if (!this.designTokens.borderRadius) return;
    
    const validRadii = Object.values(this.designTokens.borderRadius);
    if (!validRadii.includes(value)) {
      this.suggestions.push({
        type: 'border-radius',
        property,
        value,
        component: componentName,
        message: `Consider using standard border radius`,
        severity: 'info'
      });
    }
  }

  /**
   * Generate validation summary
   */
  generateSummary() {
    return {
      violationCount: this.violations.length,
      warningCount: this.warnings.length,
      suggestionCount: this.suggestions.length,
      score: this.calculateScore(),
      topIssues: this.getTopIssues()
    };
  }

  /**
   * Calculate design system compliance score
   */
  calculateScore() {
    const baseScore = 100;
    const violationPenalty = 10;
    const warningPenalty = 5;
    const suggestionPenalty = 1;
    
    const score = baseScore - 
      (this.violations.length * violationPenalty) -
      (this.warnings.length * warningPenalty) -
      (this.suggestions.length * suggestionPenalty);
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get top issues for reporting
   */
  getTopIssues() {
    const issues = [
      ...this.violations.map(v => ({ ...v, level: 'violation' })),
      ...this.warnings.map(w => ({ ...w, level: 'warning' }))
    ];
    
    // Group by type
    const grouped = issues.reduce((acc, issue) => {
      if (!acc[issue.type]) acc[issue.type] = [];
      acc[issue.type].push(issue);
      return acc;
    }, {});
    
    // Return top 3 issue types
    return Object.entries(grouped)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 3)
      .map(([type, issues]) => ({
        type,
        count: issues.length,
        examples: issues.slice(0, 2)
      }));
  }

  /**
   * Validate component against design system
   */
  async validateComponent(componentPath, componentName) {
    try {
      const cssContent = await fs.readFile(componentPath, 'utf-8');
      return await this.validateCSS(cssContent, componentName);
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Auto-fix common violations
   */
  async autoFix(cssContent, violations) {
    let fixed = cssContent;
    
    for (const violation of violations) {
      if (violation.suggestion) {
        // Simple replacement
        const regex = new RegExp(
          `${violation.property}\\s*:\\s*${violation.value}`,
          'g'
        );
        fixed = fixed.replace(
          regex,
          `${violation.property}: ${violation.suggestion}`
        );
      }
    }
    
    return fixed;
  }
}
