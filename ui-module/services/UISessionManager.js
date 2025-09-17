/**
 * UI Session Manager - Integrates UI Module with DevAssist
 * Handles design decisions, component search, and session management
 */

import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';

export class UISessionManager extends EventEmitter {
  constructor(devAssistPath, projectPath) {
    super();
    this.devAssistPath = devAssistPath;
    this.projectPath = projectPath;
    this.sessionId = null;
    this.sessionStartTime = null;
    this.designIterations = [];
    this.componentCache = new Map();
  }

  /**
   * Initialize UI session with DevAssist integration
   */
  async initializeSession() {
    this.sessionId = `ui_${Date.now()}`;
    this.sessionStartTime = new Date();
    
    // Create session in DevAssist
    await this.callDevAssist('start_session', {
      sessionId: this.sessionId,
      type: 'ui_development',
      timestamp: this.sessionStartTime
    });

    this.emit('session:started', { sessionId: this.sessionId });
    return this.sessionId;
  }

  /**
   * Record design decision to DevAssist architectural memory
   */
  async recordDesignDecision(decision) {
    const enhancedDecision = {
      ...decision,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      category: 'ui/ux',
      visualContext: decision.screenshot ? await this.storeScreenshot(decision.screenshot) : null,
      metrics: {
        ...decision.performanceMetrics,
        iterationNumber: this.designIterations.length + 1,
        timeSpent: this.calculateTimeSpent()
      }
    };

    // Record to DevAssist
    const result = await this.callDevAssist('record_architectural_decision', {
      decision: enhancedDecision.description,
      context: JSON.stringify({
        component: enhancedDecision.component,
        changes: enhancedDecision.changes,
        rationale: enhancedDecision.rationale,
        visualContext: enhancedDecision.visualContext,
        metrics: enhancedDecision.metrics
      }),
      category: 'ui/ux',
      alternatives: enhancedDecision.alternatives || [],
      impact: enhancedDecision.impact || 'visual'
    });

    // Store locally for quick access
    this.designIterations.push(enhancedDecision);
    
    this.emit('decision:recorded', enhancedDecision);
    return result;
  }

  /**
   * Search for similar components using DevAssist semantic search
   */
  async searchSimilarComponents(component) {
    const cacheKey = `${component.type}_${component.description}`;
    
    // Check cache first
    if (this.componentCache.has(cacheKey)) {
      const cached = this.componentCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5 min cache
        return cached.results;
      }
    }

    // Perform semantic search
    const results = await this.callDevAssist('semantic_search', {
      query: `${component.type} ${component.description} ${component.props?.join(' ')}`,
      filter: 'component_type',
      limit: 10
    });

    // Process and enhance results
    const enhanced = await this.enhanceSearchResults(results, component);
    
    // Cache results
    this.componentCache.set(cacheKey, {
      results: enhanced,
      timestamp: Date.now()
    });

    return enhanced;
  }

  /**
   * Track design iteration with metrics
   */
  async trackIteration(iterationData) {
    const iteration = {
      id: `iter_${Date.now()}`,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      ...iterationData,
      metrics: await this.collectMetrics(iterationData)
    };

    // Store in DevAssist
    await this.callDevAssist('track_progress', {
      milestone: `UI Iteration: ${iteration.description}`,
      status: 'in_progress',
      metadata: JSON.stringify(iteration)
    });

    this.designIterations.push(iteration);
    this.emit('iteration:tracked', iteration);
    
    return iteration;
  }

  /**
   * Get design history for component
   */
  async getComponentHistory(componentName) {
    const history = await this.callDevAssist('get_project_memory', {
      query: `component:${componentName} category:ui/ux`,
      limit: 50
    });

    return this.processHistory(history);
  }

  /**
   * Store screenshot with optimization
   */
  async storeScreenshot(screenshotData) {
    const filename = `screenshot_${Date.now()}.png`;
    const screenshotPath = path.join(
      this.projectPath,
      '.devassist',
      'artifacts',
      'screenshots',
      this.sessionId,
      filename
    );

    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    
    // Store compressed version
    const compressed = await this.compressImage(screenshotData);
    await fs.writeFile(screenshotPath, compressed);

    return screenshotPath;
  }

  /**
   * Collect performance metrics for iteration
   */
  async collectMetrics(iterationData) {
    return {
      renderTime: iterationData.renderTime || 0,
      paintTime: iterationData.paintTime || 0,
      interactionTime: iterationData.interactionTime || 0,
      accessibilityScore: iterationData.accessibilityScore || null,
      lighthouseScore: iterationData.lighthouseScore || null,
      bundleSize: await this.calculateBundleSize(),
      cssSize: await this.calculateCSSSize()
    };
  }

  /**
   * End UI session with cleanup
   */
  async endSession() {
    const summary = {
      sessionId: this.sessionId,
      duration: Date.now() - this.sessionStartTime.getTime(),
      iterations: this.designIterations.length,
      decisions: this.designIterations.filter(i => i.decision).length,
      componentsModified: [...new Set(this.designIterations.map(i => i.component))],
      finalMetrics: await this.collectFinalMetrics()
    };

    // Record session summary
    await this.callDevAssist('record_architectural_decision', {
      decision: `UI Session Summary: ${summary.iterations} iterations, ${summary.decisions} decisions`,
      context: JSON.stringify(summary),
      category: 'ui/ux/session'
    });

    // End DevAssist session
    await this.callDevAssist('end_session', {
      sessionId: this.sessionId,
      summary
    });

    this.emit('session:ended', summary);
    return summary;
  }

  /**
   * Helper: Call DevAssist function
   */
  async callDevAssist(tool, params) {
    // This would integrate with actual DevAssist MCP
    // For now, returning mock success
    console.log(`DevAssist call: ${tool}`, params);
    return { success: true, tool, params };
  }

  /**
   * Helper: Compress image data
   */
  async compressImage(imageData) {
    // Implement image compression
    // For now, return original
    return imageData;
  }

  /**
   * Helper: Calculate time spent in session
   */
  calculateTimeSpent() {
    if (!this.sessionStartTime) return 0;
    return Math.floor((Date.now() - this.sessionStartTime.getTime()) / 1000);
  }

  /**
   * Helper: Enhance search results with additional context
   */
  async enhanceSearchResults(results, component) {
    return results.map(result => ({
      ...result,
      similarity: this.calculateSimilarity(result, component),
      lastModified: result.lastModified || null,
      usage: result.usage || []
    }));
  }

  /**
   * Helper: Calculate component similarity
   */
  calculateSimilarity(result, component) {
    // Implement similarity calculation
    return 0.85; // Mock value
  }

  /**
   * Helper: Process component history
   */
  processHistory(rawHistory) {
    return rawHistory.map(entry => ({
      ...entry,
      formattedDate: new Date(entry.timestamp).toLocaleDateString(),
      changeType: this.categorizeChange(entry)
    }));
  }

  /**
   * Helper: Categorize change type
   */
  categorizeChange(entry) {
    if (entry.description?.includes('color')) return 'styling';
    if (entry.description?.includes('layout')) return 'layout';
    if (entry.description?.includes('responsive')) return 'responsive';
    return 'general';
  }

  /**
   * Helper: Calculate bundle size
   */
  async calculateBundleSize() {
    // Implement bundle size calculation
    return 0;
  }

  /**
   * Helper: Calculate CSS size
   */
  async calculateCSSSize() {
    // Implement CSS size calculation
    return 0;
  }

  /**
   * Helper: Collect final metrics
   */
  async collectFinalMetrics() {
    return {
      totalIterations: this.designIterations.length,
      averageIterationTime: this.calculateAverageIterationTime(),
      componentsCreated: this.countComponentsCreated(),
      performanceImprovement: this.calculatePerformanceImprovement()
    };
  }

  /**
   * Helper: Calculate average iteration time
   */
  calculateAverageIterationTime() {
    if (this.designIterations.length === 0) return 0;
    const totalTime = this.calculateTimeSpent();
    return Math.floor(totalTime / this.designIterations.length);
  }

  /**
   * Helper: Count components created
   */
  countComponentsCreated() {
    return this.designIterations.filter(i => i.type === 'create').length;
  }

  /**
   * Helper: Calculate performance improvement
   */
  calculatePerformanceImprovement() {
    // Compare first and last iteration metrics
    if (this.designIterations.length < 2) return 0;
    
    const first = this.designIterations[0].metrics;
    const last = this.designIterations[this.designIterations.length - 1].metrics;
    
    if (!first || !last) return 0;
    
    return {
      renderTime: ((first.renderTime - last.renderTime) / first.renderTime) * 100,
      bundleSize: ((first.bundleSize - last.bundleSize) / first.bundleSize) * 100
    };
  }
}
