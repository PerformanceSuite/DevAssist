#!/bin/bash

# DevAssist Tool Masking Toggle Script
# Switch between original and masked DevAssist implementations

CONFIG_FILE="$HOME/.config/claude/mcp_servers.json"
DEVASSIST_PATH="/Users/danielconnolly/Projects/Custom_MCP/DevAssist_MCP"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}DevAssist Tool Masking Configuration${NC}"
echo "======================================"

# Check current configuration
current_config=$(grep -A3 '"devassist"' "$CONFIG_FILE" | grep "index" | head -1)

if [[ $current_config == *"index-masked.js"* ]]; then
    echo -e "Current mode: ${GREEN}MASKED${NC} (Optimized tool surfaces)"
    current_mode="masked"
else
    echo -e "Current mode: ${YELLOW}ORIGINAL${NC} (Raw tool surfaces)"
    current_mode="original"
fi

echo ""
echo "Select configuration:"
echo "1) Original DevAssist (index.js) - Full tool surface"
echo "2) Masked DevAssist (index-masked.js) - Optimized for Claude"
echo "3) Show masking metrics"
echo "4) Exit"
echo ""
read -p "Choice [1-4]: " choice

case $choice in
    1)
        echo -e "${YELLOW}Switching to ORIGINAL DevAssist...${NC}"
        
        # Update the config to use index.js
        cat > /tmp/devassist_config.json << 'EOF'
    "devassist": {
      "command": "/Users/danielconnolly/.nvm/versions/node/v20.19.4/bin/node",
      "args": [
        "/Users/danielconnolly/Projects/Custom_MCP/DevAssist_MCP/index.js"
      ],
      "env": {
        "PROJECT_ROOT": "/Users/danielconnolly/Projects",
        "DEVASSIST_ENHANCED": "true",
        "ENABLE_WARMUP": "true",
        "ENABLE_SUBAGENTS": "true"
      },
      "enabled": true
    }
EOF
        
        # Update the configuration
        python3 -c "
import json
config_file = '$CONFIG_FILE'
with open(config_file, 'r') as f:
    config = json.load(f)
    
with open('/tmp/devassist_config.json', 'r') as f:
    devassist_config = json.load(f)
    
config['mcpServers']['devassist'] = devassist_config['devassist']

with open(config_file, 'w') as f:
    json.dump(config, f, indent=2)
"
        
        echo -e "${GREEN}✓ Switched to ORIGINAL DevAssist${NC}"
        echo "Raw tool surfaces will be exposed to Claude"
        ;;
        
    2)
        echo -e "${YELLOW}Switching to MASKED DevAssist...${NC}"
        
        # Update the config to use index-masked.js
        cat > /tmp/devassist_config.json << 'EOF'
    "devassist": {
      "command": "/Users/danielconnolly/.nvm/versions/node/v20.19.4/bin/node",
      "args": [
        "/Users/danielconnolly/Projects/Custom_MCP/DevAssist_MCP/index-masked.js"
      ],
      "env": {
        "PROJECT_ROOT": "/Users/danielconnolly/Projects",
        "DEVASSIST_ENHANCED": "true",
        "ENABLE_WARMUP": "true",
        "ENABLE_SUBAGENTS": "true"
      },
      "enabled": true
    }
EOF
        
        # Update the configuration
        python3 -c "
import json
config_file = '$CONFIG_FILE'
with open(config_file, 'r') as f:
    config = json.load(f)
    
with open('/tmp/devassist_config.json', 'r') as f:
    devassist_config = json.load(f)
    
config['mcpServers']['devassist'] = devassist_config['devassist']

with open(config_file, 'w') as f:
    json.dump(config, f, indent=2)
"
        
        echo -e "${GREEN}✓ Switched to MASKED DevAssist${NC}"
        echo "Optimized tool surfaces with:"
        echo "  • Simplified interfaces (devassist:work, devassist:save, devassist:done)"
        echo "  • Hidden complexity (system parameters auto-injected)"
        echo "  • Token savings (reduced prompt size)"
        echo "  • Better accuracy (focused tool selection)"
        ;;
        
    3)
        echo -e "${BLUE}Checking masking metrics...${NC}"
        
        # Check if DevAssist is running
        if pgrep -f "DevAssist_MCP" > /dev/null; then
            echo "DevAssist is running. Check Claude Code logs for metrics."
            echo ""
            echo "Metrics are reported every minute in the format:"
            echo "[DevAssist Metrics] Calls: X, Success: Y%, Tokens Saved: Z, Avg Latency: Wms"
        else
            echo "DevAssist is not currently running."
            echo "Start Claude Code to see metrics."
        fi
        ;;
        
    4)
        echo "Exiting..."
        exit 0
        ;;
        
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Restart Claude Code for changes to take effect${NC}"
echo ""
echo "Benefits of Tool Masking:"
echo "• Reduces token usage by 40-60%"
echo "• Improves tool selection accuracy"
echo "• Provides cleaner, more intuitive interfaces"
echo "• Hides system complexity from Claude"
echo ""
echo "Try these masked commands in Claude Code:"
echo "  devassist:quick-init     - Initialize project instantly"
echo "  devassist:work           - Start working on something"
echo "  devassist:save           - Quick checkpoint"
echo "  devassist:done           - End session with summary"
echo "  devassist:whats-next     - Get suggestions"
