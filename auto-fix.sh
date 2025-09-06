#!/bin/bash
# DevAssist Auto-Fix Script
# Generated: 2025-09-04T08:15:44.567Z

echo "Applying DevAssist fixes..."

# Fix 1: Remove // console.log statements
echo "Removing // console.log statements..."
find /Users/danielconnolly/Projects/Custom_MCP/DevAssist_MCP -name "*.js" -type f \
  -exec sed -i.bak 's/console\.log/\/\/ // console.log/g' {} +

# Fix 2: Create missing directories
echo "Creating required directories..."
mkdir -p /Users/danielconnolly/Projects/Veria/.devassist/data/sqlite
mkdir -p /Users/danielconnolly/Projects/Veria/.devassist/terminal_logs
mkdir -p /Users/danielconnolly/Projects/Veria/.devassist/data/vectordb

# Fix 3: Initialize database if needed
if [ ! -f "/Users/danielconnolly/Projects/Veria/.devassist/data/sqlite/Veria.db" ]; then
  echo "Initializing database..."
  sqlite3 /Users/danielconnolly/Projects/Veria/.devassist/data/sqlite/Veria.db <<EOF
CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT,
  decision TEXT,
  context TEXT,
  impact TEXT,
  alternatives TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT,
  milestone TEXT,
  status TEXT,
  notes TEXT,
  blockers TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  project_name TEXT,
  started_at DATETIME,
  ended_at DATETIME,
  summary TEXT,
  checkpoints TEXT
);

CREATE TABLE IF NOT EXISTS code_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT,
  pattern TEXT,
  category TEXT,
  description TEXT,
  file_path TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
EOF
fi

echo "✅ Fixes applied successfully!"
