// DevAssist MCP GUI Server
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { promises as fsPromises } from 'fs';

// Import database functions from parent project
import { initDatabases } from '../src/database/init.js';
import {
  recordDecision,
  trackProgress,
  getProjectMemory,
  semanticSearch,
  identifyDuplicates,
  getAllProjects,
  getDecisionsByProject,
  getProgressByProject,
  addCodePattern,
  getOrCreateProject
} from '../src/database/dataAccess.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3456;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../gui-client')));

// Initialize databases
await initDatabases();
console.log('✅ Databases initialized');

// WebSocket server for real-time updates
const wss = new WebSocketServer({ port: 3457 });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('New WebSocket client connected');
  
  ws.on('close', () => {
    clients.delete(ws);
    console.log('WebSocket client disconnected');
  });
});

// Broadcast updates to all clients
function broadcastUpdate(type, data) {
  const message = JSON.stringify({ type, data, timestamp: new Date() });
  clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}

// Function to scan actual Projects folder
async function getRealProjects() {
  const projectsPath = '/Users/danielconnolly/Projects';
  const ignoreDirs = ['.DS_Store', 'node_modules', '.git', 'Custom_MCP', '.Trash'];
  
  try {
    const items = await fsPromises.readdir(projectsPath);
    const projects = [];
    
    for (const item of items) {
      if (ignoreDirs.includes(item)) continue;
      
      const itemPath = path.join(projectsPath, item);
      const stats = await fsPromises.stat(itemPath);
      
      if (stats.isDirectory()) {
        // Check if this project exists in DB, if not create it
        const projectData = getOrCreateProject(item.toLowerCase().replace(/[^a-z0-9]/g, '_'));
        
        projects.push({
          id: projectData.id,
          name: projectData.name,
          displayName: item, // Original folder name for display
          path: itemPath,
          created_at: projectData.created_at,
          metadata: projectData.metadata || {}
        });
      }
    }
    
    // Always include a "default" project for general notes
    const defaultProject = getOrCreateProject('default');
    projects.unshift({
      id: defaultProject.id,
      name: 'default',
      displayName: 'General Notes',
      path: null,
      created_at: defaultProject.created_at,
      metadata: defaultProject.metadata || {}
    });
    
    return projects.sort((a, b) => {
      if (a.name === 'default') return -1;
      if (b.name === 'default') return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  } catch (error) {
    console.error('Error scanning projects folder:', error);
    return [];
  }
}

// API Routes

// Get all projects (real projects from filesystem)
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await getRealProjects();
    res.json({ success: true, projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get decisions for a project
app.get('/api/projects/:project/decisions', (req, res) => {
  try {
    const { project } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const decisions = getDecisionsByProject(project, limit);
    res.json({ success: true, decisions });
  } catch (error) {
    console.error('Error fetching decisions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get progress for a project
app.get('/api/projects/:project/progress', (req, res) => {
  try {
    const { project } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const progress = getProgressByProject(project, limit);
    res.json({ success: true, progress });
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get project memory (combined data)
app.get('/api/projects/:project/memory', async (req, res) => {
  try {
    const { project } = req.params;
    const { query, category = 'all', limit = 10 } = req.query;
    const memories = await getProjectMemory(query, category, parseInt(limit), project);
    res.json({ success: true, memories });
  } catch (error) {
    console.error('Error fetching project memory:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Record a new decision
app.post('/api/decisions', async (req, res) => {
  try {
    const result = await recordDecision(req.body);
    broadcastUpdate('decision_added', { project: req.body.project || 'default', ...result });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error recording decision:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Track progress
app.post('/api/progress', (req, res) => {
  try {
    const id = trackProgress(req.body);
    broadcastUpdate('progress_updated', { project: req.body.project || 'default', id });
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error tracking progress:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Semantic search
app.post('/api/search', async (req, res) => {
  try {
    const { query, options = {} } = req.body;
    const results = await semanticSearch(query, options);
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error performing search:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Identify duplicates
app.post('/api/duplicates', async (req, res) => {
  try {
    const { feature, searchPath, threshold = 0.7 } = req.body;
    const result = await identifyDuplicates(feature, searchPath, threshold);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error identifying duplicates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add code pattern
app.post('/api/patterns', async (req, res) => {
  try {
    const { filePath, content, language, project = 'default' } = req.body;
    const result = await addCodePattern(filePath, content, language, project);
    broadcastUpdate('pattern_added', { project, ...result });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error adding pattern:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'healthy',
    websocket_clients: clients.size,
    timestamp: new Date()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 DevAssist GUI Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server running on ws://localhost:3457`);
});
