#!/bin/bash

# This wrapper ensures DevAssist dies when Claude Code quits

# Trap signals to ensure cleanup
trap 'echo "[DevAssist] Received signal, exiting..."; exit 0' SIGTERM SIGINT SIGHUP

# Start DevAssist
exec node /Users/danielconnolly/Projects/Custom_MCP/DevAssist_MCP/index.js
