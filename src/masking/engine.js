/**
 * Tool Masking Layer for DevAssist
 * Provides optimized, narrow tool surfaces for Claude
 */

import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tool mask schema definition
const ToolMaskSchema = z.object({
  name: z.string(),
  description: z.string(),
  namespace: z.string().default('devassist'),
  handler: z.string(),
  input: z.object({
    exposed: z.record(z.any()).optional(),  // Fields exposed to Claude
    hidden: z.record(z.any()).optional(),   // Fields hidden from Claude (system-injected)
    validation: z.any().optional(),          // Custom validation (can be null or function)
  }),
  output: z.object({
    transform: z.any().optional(),           // Transform handler output (can be null or function)
    filter: z.array(z.string()).optional(),  // Fields to include in output
  }).optional(),
  role: z.string().optional(),              // Role-based access
  priority: z.number().default(0),          // For conflict resolution
});

export class ToolMaskingEngine {
  constructor() {
    this.masks = new Map();
    this.handlers = new Map();
    this.metrics = {
      calls: 0,
      errors: 0,
      avgLatency: 0,
      tokensSaved: 0,
    };
  }

  /**
   * Register a tool handler (the actual implementation)
   */
  registerHandler(name, handler) {
    this.handlers.set(name, handler);
    console.error(`[Masking] Registered handler: ${name}`);
  }

  /**
   * Register a tool mask (the LLM-facing interface)
   */
  registerMask(mask) {
    const validated = ToolMaskSchema.parse(mask);
    const fullName = `${validated.namespace}:${validated.name}`;
    
    this.masks.set(fullName, validated);
    console.error(`[Masking] Registered mask: ${fullName} -> handler: ${validated.handler}`);
    
    return fullName;
  }

  /**
   * Get all masked tools for Claude
   */
  getMaskedTools(role = null) {
    const tools = [];
    
    for (const [fullName, mask] of this.masks) {
      // Check role-based access
      if (mask.role && mask.role !== role) continue;
      
      // Build the simplified tool definition for Claude
      const tool = {
        name: fullName,
        description: mask.description,
        inputSchema: {
          type: 'object',
          properties: mask.input.exposed || {},
          required: Object.keys(mask.input.exposed || {}).filter(
            key => mask.input.exposed[key].required
          ),
        },
      };
      
      tools.push(tool);
    }
    
    // Sort by priority
    tools.sort((a, b) => {
      const maskA = this.masks.get(a.name);
      const maskB = this.masks.get(b.name);
      return (maskB?.priority || 0) - (maskA?.priority || 0);
    });
    
    return tools;
  }

  /**
   * Execute a masked tool call
   */
  async execute(toolName, input, context = {}) {
    const startTime = Date.now();
    
    try {
      const mask = this.masks.get(toolName);
      if (!mask) {
        throw new Error(`Unknown masked tool: ${toolName}`);
      }
      
      const handler = this.handlers.get(mask.handler);
      if (!handler) {
        throw new Error(`Handler not found: ${mask.handler}`);
      }
      
      // Validate input if validation function provided
      if (mask.input.validation) {
        const validationResult = mask.input.validation(input);
        if (!validationResult.valid) {
          throw new Error(`Validation failed: ${validationResult.error}`);
        }
      }
      
      // Merge exposed input with hidden system values
      const processedHidden = {};
      if (mask.input.hidden) {
        for (const [key, value] of Object.entries(mask.input.hidden)) {
          // Process system variables and remapping
          if (typeof value === 'string' && value.includes('$')) {
            processedHidden[key] = this.processSystemVariables(value, input, context);
          } else {
            processedHidden[key] = value;
          }
        }
      }
      
      const fullInput = {
        ...input,
        ...processedHidden,
        context,
      };
      
      // Execute the handler
      const result = await handler(fullInput);
      
      // Transform output if transformer provided
      let output = result;
      if (mask.output?.transform) {
        output = mask.output.transform(result);
      }
      
      // Filter output fields if specified
      if (mask.output?.filter) {
        const filtered = {};
        for (const field of mask.output.filter) {
          if (field in output) {
            filtered[field] = output[field];
          }
        }
        output = filtered;
      }
      
      // Update metrics
      this.metrics.calls++;
      this.metrics.avgLatency = 
        (this.metrics.avgLatency * (this.metrics.calls - 1) + (Date.now() - startTime)) / 
        this.metrics.calls;
      
      // Estimate tokens saved (rough calculation)
      const fullToolDef = JSON.stringify({ input: fullInput, output: result });
      const maskedToolDef = JSON.stringify({ input, output });
      this.metrics.tokensSaved += Math.floor((fullToolDef.length - maskedToolDef.length) / 4);
      
      return {
        success: true,
        data: output,
        meta: {
          mask: toolName,
          handler: mask.handler,
          latency: Date.now() - startTime,
        },
      };
      
    } catch (error) {
      this.metrics.errors++;
      console.error(`[Masking] Error executing ${toolName}:`, error);
      
      return {
        success: false,
        error: error.message,
        meta: {
          mask: toolName,
          latency: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Process system variables and remapping in mask values
   */
  processSystemVariables(value, input = {}, context = {}) {
    if (typeof value !== 'string') return value;
    
    // Handle remapping first ($REMAP:fieldname$)
    const remapMatch = value.match(/\$\$REMAP:(.+?)\$\$/);
    if (remapMatch) {
      const fieldName = remapMatch[1];
      return input[fieldName] || value;
    }
    
    // Then handle system variables
    return value
      .replace('$TIMESTAMP$', new Date().toISOString())
      .replace('$GENERATE_ID$', Date.now().toString())
      .replace('$CURRENT_SESSION$', context.sessionId || 'none')
      .replace('$PROJECT_NAME$', context.projectName || 'unknown');
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.calls > 0 
        ? ((this.metrics.calls - this.metrics.errors) / this.metrics.calls * 100).toFixed(2) + '%'
        : 'N/A',
    };
  }

  /**
   * Load masks from YAML/JSON files
   */
  async loadMasksFromDirectory(dir) {
    try {
      const files = await fs.readdir(dir);
      const maskFiles = files.filter(f => f.endsWith('.json') || f.endsWith('.yaml'));
      
      for (const file of maskFiles) {
        const content = await fs.readFile(path.join(dir, file), 'utf-8');
        const masks = JSON.parse(content);
        
        for (const mask of Array.isArray(masks) ? masks : [masks]) {
          this.registerMask(mask);
        }
      }
      
      console.error(`[Masking] Loaded ${maskFiles.length} mask files from ${dir}`);
    } catch (error) {
      console.error(`[Masking] Error loading masks from ${dir}:`, error);
    }
  }
}

// Singleton instance
export const maskingEngine = new ToolMaskingEngine();
