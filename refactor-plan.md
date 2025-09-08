# DevAssist Refactoring Plan

## Current Problems:
1. Multiple project servers importing main DevAssist causing conflicts
2. No proper project context isolation
3. Command namespace collisions
4. Shared memory/state between projects

## New Architecture:

### Core Principles:
1. **Single DevAssist Server** - One server handles all projects
2. **Project Context Detection** - Automatically detect which project based on:
   - Current working directory (for CLI)
   - Explicit project parameter in commands
   - Session context
3. **Isolated Data Stores** - Each project has its own:
   - Vector database partition
   - Session history
   - Decision records
   - Knowledge base
4. **Smart Command Routing** - Commands work in project context:
   - `/session-start` → starts session for current project
   - `/session-start project:performia` → explicit project
   - `/initproject` → works in current directory

### Implementation Steps:

1. **Create ProjectManager class**
   - Manages all projects
   - Handles context switching
   - Isolates data per project

2. **Refactor command handlers**
   - Add project context detection
   - Route to project-specific handlers
   - Maintain backward compatibility

3. **Update data storage**
   - Partition databases by project
   - Separate vector stores
   - Isolated session management

4. **Remove project-specific servers**
   - Clean up all `.devassist/*-server.js` files
   - Single entry point: main DevAssist

5. **Add project discovery**
   - Auto-detect projects in PROJECT_ROOT
   - Register new projects automatically
   - Track project metadata

### Benefits:
- No more conflicts
- True isolation while sharing code
- Better performance
- Easier maintenance
- Cross-project intelligence
