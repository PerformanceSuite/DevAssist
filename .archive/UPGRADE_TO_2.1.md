# Upgrade Guide: DevAssist MCP v2.0 → v2.1

## Overview
Version 2.1 adds native MCP resource support for serving documentation directly to Claude Code without web fetches.

## What's New
- Documentation resources accessible via MCP protocol
- Auto-discovery of docs in `.devassist/docs/`
- Zero-latency documentation access (<1ms vs ~500ms)

## Upgrade Steps

### 1. Update DevAssist MCP
```bash
cd /Users/danielconnolly/Projects/Custom_MCP/DevAssist_MCP
git pull  # or manually update files
npm install  # Ensure dependencies are current
```

### 2. Create Documentation Structure (Optional)
Create a `.devassist/docs/` directory in your project:

```bash
mkdir -p .devassist/docs/{juce,supercollider,project}
```

Add markdown documentation files:
- `.devassist/docs/README.md` - Main index
- `.devassist/docs/juce/` - JUCE framework docs
- `.devassist/docs/supercollider/` - SuperCollider docs
- `.devassist/docs/project/` - Project-specific docs

### 3. Restart Claude Code
**IMPORTANT**: Claude Code must be restarted to load the updated MCP server.

1. Save all work in Claude Code
2. Quit Claude Code completely (Cmd+Q on macOS)
3. Restart Claude Code
4. DevAssist will now serve documentation as resources

### 4. Verify Resources
After restart, DevAssist should:
- List documentation resources when queried
- Allow reading docs via `docs://` URIs
- Show "Documentation resources available" in logs

## Documentation Structure Example

```
.devassist/docs/
├── README.md                    # Index with quick links
├── juce/
│   ├── AudioAppComponent.md    # JUCE audio basics
│   └── macOS_CoreAudio.md      # Platform-specific
├── supercollider/
│   ├── OSC_Commands.md         # OSC protocol reference
│   └── SynthDef_Patterns.md    # Synthesis patterns
└── project/
    ├── architecture.md         # Your project architecture
    └── api.md                  # API documentation
```

## Benefits
- **Instant Access**: No network latency
- **Offline Support**: Works without internet
- **Project-Specific**: Each project has its own docs
- **Version Control**: Docs tracked with code
- **Claude Integration**: Seamless access in Claude Code

## Compatibility
- Backward compatible with v2.0
- All existing tools continue to work
- Resources are additive (won't break existing functionality)

## Troubleshooting

### Resources Not Showing
1. Check `.devassist/docs/` exists in project
2. Verify markdown files have `.md` extension
3. Restart Claude Code (required for MCP changes)
4. Check DevAssist logs for errors

### Path Issues
DevAssist searches for docs in:
1. Current working directory `.devassist/docs/`
2. `~/Projects/Performia-system/.devassist/docs/` (fallback)
3. DevAssist installation `docs/` directory

## Support
Report issues at: https://github.com/yourusername/DevAssist_MCP/issues

---
*Updated: 2025-08-30 for DevAssist MCP v2.1.0*