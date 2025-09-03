#!/bin/bash

# DevAssist MCP GUI Launcher

echo "🚀 Starting DevAssist MCP GUI..."
echo "================================"

cd /Users/danielconnolly/Projects/DevAssist_MCP

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install express cors ws
fi

# Check if databases exist
if [ ! -d "data" ]; then
    echo "🗄️ Initializing databases..."
    node src/database/init.js
fi

# Start the GUI server
echo "🌐 Starting GUI server on http://localhost:3456"
node gui-server/index.js &
SERVER_PID=$!

# Wait a moment for server to start
sleep 2

# Open in browser
echo "🌍 Opening browser..."
open http://localhost:3456/gui-client/

echo ""
echo "✅ DevAssist GUI is running!"
echo "   Web UI: http://localhost:3456/gui-client/"
echo "   API: http://localhost:3456/api/health"
echo "   WebSocket: ws://localhost:3457"
echo ""
echo "Press Ctrl+C to stop the server"

# Wait for user to stop
wait $SERVER_PID
