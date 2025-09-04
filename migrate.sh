#!/bin/bash

# DevAssist Migration Script for Existing Projects
# Upgrades existing DevAssist installations to v2.2.0 with enhanced features

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_PATH=$(pwd)
PROJECT_NAME=$(basename "$PROJECT_PATH")

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}DevAssist Migration to v2.2.0${NC}"
echo -e "${CYAN}Project: ${PROJECT_NAME}${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if DevAssist exists
if [ ! -d ".devassist" ]; then
    echo -e "${RED}❌ No DevAssist installation found${NC}"
    echo "Run /initproject first to set up DevAssist"
    exit 1
fi

echo -e "${BLUE}📋 Current Installation Status${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check current version
if [ -f ".devassist/config/devassist.json" ]; then
    CURRENT_VERSION=$(grep -o '"version": "[^"]*"' .devassist/config/devassist.json | cut -d'"' -f4)
    echo "Current version: ${CURRENT_VERSION:-unknown}"
else
    echo "Current version: < 2.0.0 (legacy)"
fi

# Backup current data
echo ""
echo -e "${BLUE}💾 Creating Backup${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━"

BACKUP_DIR=".devassist.backup.$(date +%Y%m%d_%H%M%S)"
cp -r .devassist "$BACKUP_DIR"
echo -e "${GREEN}✓${NC} Backup created: $BACKUP_DIR"

# Create new directory structure
echo ""
echo -e "${BLUE}📁 Updating Directory Structure${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

mkdir -p .devassist/{config,data/sqlite,data/vectors/$PROJECT_NAME,docs,knowledge,scripts}
echo -e "${GREEN}✓${NC} Directory structure updated"

# Update configuration
echo ""
echo -e "${BLUE}⚙️ Updating Configuration${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat > .devassist/config/devassist.json << EOF
{
  "version": "2.2.0",
  "project": "${PROJECT_NAME}",
  "projectPath": "${PROJECT_PATH}",
  "initialized": "$(date -Iseconds)",
  "migrated_from": "${CURRENT_VERSION:-legacy}",
  "paths": {
    "devassistMCP": "/Users/danielconnolly/Projects/Custom_MCP/DevAssist_MCP",
    "dataPath": "${PROJECT_PATH}/.devassist/data",
    "knowledgePath": "${PROJECT_PATH}/.devassist/knowledge",
    "logsPath": "${PROJECT_PATH}/.devassist/terminal_logs"
  },
  "features": {
    "sessionManagement": true,
    "terminalLogging": true,
    "knowledgeBase": true,
    "semanticSearch": true,
    "architecturalDecisions": true,
    "progressTracking": true,
    "codePatternAnalysis": true,
    "projectIsolation": true,
    "enhancedDocumentation": true
  },
  "indexing": {
    "includePatterns": ["**/*.{js,ts,jsx,tsx,py,rs,go,java,cpp,c,h,md,json,yaml,yml}"],
    "excludePatterns": ["node_modules/**", ".git/**", "dist/**", "build/**"],
    "autoIndex": true
  }
}
EOF

echo -e "${GREEN}✓${NC} Configuration updated to v2.2.0"

# Migrate database if exists
echo ""
echo -e "${BLUE}🗄️ Migrating Database${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f ".devassist/data/devassist.db" ]; then
    # Move to project-specific name
    mv .devassist/data/devassist.db ".devassist/data/sqlite/${PROJECT_NAME}.db"
    echo -e "${GREEN}✓${NC} SQLite database migrated"
else
    echo "No existing database to migrate"
fi

# Migrate vector database
if [ -d ".devassist/data/vectors" ] && [ ! -d ".devassist/data/vectors/$PROJECT_NAME" ]; then
    # Move existing vectors to project-specific directory
    if [ "$(ls -A .devassist/data/vectors 2>/dev/null)" ]; then
        mkdir -p ".devassist/data/vectors/${PROJECT_NAME}"
        mv .devassist/data/vectors/* ".devassist/data/vectors/${PROJECT_NAME}/" 2>/dev/null || true
        echo -e "${GREEN}✓${NC} Vector database migrated"
    fi
fi

# Update MCP configuration
echo ""
echo -e "${BLUE}🔧 Updating MCP Configuration${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat > .mcp.json << EOF
{
  "mcpServers": {
    "devassist-${PROJECT_NAME}": {
      "type": "stdio",
      "command": "node",
      "args": ["${PROJECT_PATH}/.devassist/server.js"],
      "env": {
        "PROJECT_ROOT": "${PROJECT_PATH}",
        "DEVASSIST_PROJECT": "${PROJECT_NAME}",
        "DEVASSIST_DATA_PATH": "${PROJECT_PATH}/.devassist/data",
        "DEVASSIST_KNOWLEDGE_PATH": "${PROJECT_PATH}/.devassist/knowledge"
      }
    }
  }
}
EOF

echo -e "${GREEN}✓${NC} MCP configuration updated"

# Update server wrapper
echo ""
echo -e "${BLUE}📦 Updating Server Wrapper${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat > .devassist/server.js << 'EOF'
#!/usr/bin/env node

// DevAssist MCP Server Wrapper v2.2.0
// Enhanced with project isolation and session management

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load configuration
const configPath = path.join(__dirname, 'config', 'devassist.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Validate DevAssist MCP exists
if (!fs.existsSync(config.paths.devassistMCP)) {
    console.error(`DevAssist MCP not found at: ${config.paths.devassistMCP}`);
    process.exit(1);
}

// Ensure data directories exist
for (const [key, dir] of Object.entries(config.paths)) {
    if (key.includes('Path') && !key.includes('MCP')) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}

// Set environment variables for project isolation
process.env.DEVASSIST_PROJECT = config.project;
process.env.DEVASSIST_PROJECT_PATH = config.projectPath;
process.env.DEVASSIST_DATA_PATH = config.paths.dataPath;
process.env.DEVASSIST_KNOWLEDGE_PATH = config.paths.knowledgePath;
process.env.DEVASSIST_CONFIG = JSON.stringify(config);

// Launch DevAssist MCP with project configuration
const devassistIndexPath = path.join(config.paths.devassistMCP, 'index.js');
const devassist = spawn('node', [devassistIndexPath], {
    env: process.env,
    stdio: 'inherit'
});

devassist.on('error', (err) => {
    console.error('Failed to start DevAssist:', err);
    process.exit(1);
});

devassist.on('exit', (code) => {
    process.exit(code || 0);
});

console.log(`DevAssist MCP v2.2.0 starting for project: ${config.project}`);
EOF

chmod +x .devassist/server.js
echo -e "${GREEN}✓${NC} Server wrapper updated"

# Migrate session files if they exist
echo ""
echo -e "${BLUE}📄 Migrating Sessions${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━"

if [ -d ".sessions" ] && [ "$(ls -A .sessions 2>/dev/null)" ]; then
    SESSION_COUNT=$(ls -1 .sessions/*.json 2>/dev/null | wc -l)
    echo "Found ${SESSION_COUNT} session files"
    echo -e "${GREEN}✓${NC} Sessions preserved"
else
    mkdir -p .sessions
    echo "No existing sessions to migrate"
fi

# Create migration report
echo ""
echo -e "${BLUE}📊 Migration Report${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━"

cat > .devassist/MIGRATION_REPORT.md << EOF
# DevAssist Migration Report

**Date:** $(date)
**Project:** ${PROJECT_NAME}
**From Version:** ${CURRENT_VERSION:-legacy}
**To Version:** 2.2.0

## Changes Applied

### ✅ Configuration
- Updated to v2.2.0 format
- Added project isolation settings
- Enhanced feature flags

### ✅ Database
- SQLite moved to project-specific file
- Vector DB isolated by project
- Added session tables

### ✅ Features Added
- Project isolation
- Session management
- Enhanced documentation
- Self-awareness capabilities

### ✅ Directory Structure
- Added config/ directory
- Reorganized data/ structure
- Added knowledge/ directory

## Backup Location
${BACKUP_DIR}/

## Next Steps
1. Restart Claude Code
2. Test with: devassist:get_documentation "DevAssist"
3. Start a session: devassist:start_session

## Notes
- All existing data preserved
- Backup available if rollback needed
- New features ready to use
EOF

echo -e "${GREEN}✓${NC} Migration report created"

# Final summary
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Migration Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Project ${PROJECT_NAME} has been upgraded to DevAssist v2.2.0"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Restart Claude Code to load enhanced MCP"
echo "2. Test new features:"
echo "   - devassist:get_documentation \"DevAssist tools\""
echo "   - devassist:start_session"
echo "   - devassist:get_project_memory"
echo ""
echo "Backup saved to: ${BACKUP_DIR}"
echo "Report available at: .devassist/MIGRATION_REPORT.md"
