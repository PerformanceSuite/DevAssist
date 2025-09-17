/**
 * UI Metrics Collector
 * Tracks design patterns, performance metrics, and generates insights
 */

import { EventEmitter } from 'events';

export class UIMetricsCollector extends EventEmitter {
  constructor(config = {}) {
    super();
    this.metrics = {
      iterations: [],
      components: new Map(),
      patterns: new Map(),
      performance: [],
      errors: [],
      timeSpent: new Map()
    };
    
    this.insights = [];
    this.thresholds = config.thresholds || {
      iterationTime: 300000, // 5 minutes
      errorRate: 0.1, // 10%
      performanceRegression: 0.2 // 20%
    };
    
    this.sessionStartTime = Date.now();
  }

  /**
   * Track design iteration metrics
   */
  trackDesignIteration(data) {
    const iteration = {
      id: `iter_${Date.now()}`,
      timestamp: new Date().toISOString(),
      component: data.component,
      changeType: data.changeType,
      duration: data.duration || 0,
      metrics: {
        renderTime: data.renderTime,
        interactionTime: data.interactionTime,
        bundleSize: data.bundleSize,
        cssSize: data.cssSize
      },
      errors: data.errors || []
    };
    
    this.metrics.iterations.push(iteration);
    
    // Update component metrics
    this.updateComponentMetrics(data.component, iteration);
    
    // Track patterns
    this.trackPattern(data.changeType, data.component);
    
    // Check for insights
    this.generateIterationInsights(iteration);
    
    this.emit('iteration:tracked', iteration);
    
    return iteration;
  }
  /**
   * Update component metrics
   */
  updateComponentMetrics(componentName, iteration) {
    if (!this.metrics.components.has(componentName)) {
      this.metrics.components.set(componentName, {
        iterations: 0,
        totalTime: 0,
        errors: 0,
        changes: []
      });
    }
    
    const component = this.metrics.components.get(componentName);
    component.iterations++;
    component.totalTime += iteration.duration || 0;
    component.errors += iteration.errors.length;
    component.changes.push(iteration.changeType);
  }

  /**
   * Track design pattern
   */
  trackPattern(pattern, component) {
    const key = `${pattern}_${component}`;
    
    if (!this.metrics.patterns.has(key)) {
      this.metrics.patterns.set(key, {
        pattern,
        component,
        count: 0,
        firstSeen: Date.now(),
        lastSeen: Date.now()
      });
    }
    
    const patternData = this.metrics.patterns.get(key);
    patternData.count++;
    patternData.lastSeen = Date.now();
  }

  /**
   * Generate insights based on iteration
   */
  generateIterationInsights(iteration) {
    const insights = [];
    
    // Check for performance regression
    if (this.metrics.performance.length > 0) {
      const lastPerf = this.metrics.performance[this.metrics.performance.length - 1];
      if (iteration.metrics.renderTime > lastPerf.renderTime * 1.2) {
        insights.push({
          type: 'performance-regression',
          message: `Render time increased by ${Math.round((iteration.metrics.renderTime / lastPerf.renderTime - 1) * 100)}%`,
          severity: 'high',
          suggestion: 'Review recent changes for performance impact'
        });
      }
    }
    
    // Track performance
    this.metrics.performance.push({
      timestamp: iteration.timestamp,
      renderTime: iteration.metrics.renderTime,
      bundleSize: iteration.metrics.bundleSize
    });
    
    // Check for repeated patterns
    const componentData = this.metrics.components.get(iteration.component);
    if (componentData && componentData.iterations > 5) {
      const changeTypes = componentData.changes.slice(-5);
      const uniqueChanges = new Set(changeTypes).size;
      
      if (uniqueChanges === 1) {
        insights.push({
          type: 'repetitive-pattern',
          message: `You've made ${changeTypes.length} ${changeTypes[0]} changes to ${iteration.component}`,
          severity: 'info',
          suggestion: `Consider creating a reusable variant or abstracting this pattern`
        });
      }
    }
    
    // Check iteration time
    if (iteration.duration > this.thresholds.iterationTime) {
      insights.push({
        type: 'slow-iteration',
        message: `This iteration took ${Math.round(iteration.duration / 60000)} minutes`,
        severity: 'medium',
        suggestion: 'Consider breaking down changes into smaller iterations'
      });
    }
    
    insights.forEach(insight => {
      this.insights.push(insight);
      this.emit('insight:generated', insight);
    });
    
    return insights;
  }

  /**
   * Generate comprehensive insights
   */
  generateInsights() {
    const insights = [];
    
    // Time spent analysis
    const timeByComponent = this.getTimeSpentByComponent();
    const topComponent = [...timeByComponent.entries()]
      .sort((a, b) => b[1] - a[1])[0];
    
    if (topComponent) {
      const percentage = (topComponent[1] / this.getTotalTimeSpent()) * 100;
      insights.push({
        type: 'time-analysis',
        message: `You spend ${Math.round(percentage)}% of time on ${topComponent[0]}`,
        suggestion: percentage > 40 ? 
          'Consider breaking this component into smaller parts' : 
          'Good distribution of effort'
      });
    }
    
    // Pattern analysis
    const commonPatterns = this.getCommonPatterns();
    if (commonPatterns.length > 0) {
      const topPattern = commonPatterns[0];
      insights.push({
        type: 'pattern-analysis',
        message: `"${topPattern.pattern}" appears ${topPattern.count} times`,
        suggestion: topPattern.count > 3 ? 
          `Consider creating a ${topPattern.pattern} component variant` :
          'Pattern frequency is acceptable'
      });
    }
    
    // Error rate analysis
    const errorRate = this.getErrorRate();
    if (errorRate > this.thresholds.errorRate) {
      insights.push({
        type: 'error-rate',
        message: `Error rate is ${Math.round(errorRate * 100)}%`,
        severity: 'high',
        suggestion: 'Review error logs and add better error handling'
      });
    }
    
    // Performance trend
    const perfTrend = this.getPerformanceTrend();
    if (perfTrend.regression) {
      insights.push({
        type: 'performance-trend',
        message: `Performance degraded by ${Math.round(perfTrend.change * 100)}% over session`,
        severity: 'high',
        suggestion: 'Profile recent changes and optimize critical paths'
      });
    }
    
    return insights;
  }

  /**
   * Get time spent by component
   */
  getTimeSpentByComponent() {
    const timeMap = new Map();
    
    this.metrics.components.forEach((data, component) => {
      timeMap.set(component, data.totalTime);
    });
    
    return timeMap;
  }

  /**
   * Get total time spent
   */
  getTotalTimeSpent() {
    return Date.now() - this.sessionStartTime;
  }

  /**
   * Get common patterns
   */
  getCommonPatterns() {
    return [...this.metrics.patterns.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  /**
   * Get error rate
   */
  getErrorRate() {
    if (this.metrics.iterations.length === 0) return 0;
    
    const iterationsWithErrors = this.metrics.iterations
      .filter(i => i.errors && i.errors.length > 0).length;
    
    return iterationsWithErrors / this.metrics.iterations.length;
  }

  /**
   * Get performance trend
   */
  getPerformanceTrend() {
    if (this.metrics.performance.length < 2) {
      return { regression: false, change: 0 };
    }
    
    const first = this.metrics.performance[0];
    const last = this.metrics.performance[this.metrics.performance.length - 1];
    
    const change = (last.renderTime - first.renderTime) / first.renderTime;
    
    return {
      regression: change > this.thresholds.performanceRegression,
      change
    };
  }

  /**
   * Get session summary
   */
  getSessionSummary() {
    return {
      duration: this.getTotalTimeSpent(),
      iterations: this.metrics.iterations.length,
      componentsModified: this.metrics.components.size,
      patternsIdentified: this.metrics.patterns.size,
      insights: this.insights,
      errorRate: this.getErrorRate(),
      performanceTrend: this.getPerformanceTrend(),
      topComponents: [...this.metrics.components.entries()]
        .sort((a, b) => b[1].iterations - a[1].iterations)
        .slice(0, 3)
        .map(([name, data]) => ({ name, iterations: data.iterations }))
    };
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      iterations: [],
      components: new Map(),
      patterns: new Map(),
      performance: [],
      errors: [],
      timeSpent: new Map()
    };
    
    this.insights = [];
    this.sessionStartTime = Date.now();
  }
}
