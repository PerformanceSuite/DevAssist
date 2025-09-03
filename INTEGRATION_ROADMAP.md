# DevAssist Integration Roadmap

## Current State (v2.0)
DevAssist currently works as an MCP server that:
- ✅ Responds to Claude Desktop conversations
- ✅ Records decisions when explicitly called
- ✅ Has a GUI for manual entry
- ❌ Does NOT automatically listen to other tools

## Potential Integrations

### 1. 🤖 Claude Code Integration
**Challenge:** Claude Code runs in terminal, separate from DevAssist

**Solution Options:**
```bash
# Option A: Wrapper script
#!/bin/bash
# claude-code-wrapper.sh
claude-code "$@" | tee -a ~/.claude-code-history.log
# Parse log and send to DevAssist API

# Option B: File watcher
# Watch .claude-code directory for changes
fswatch ~/.claude-code | node devassist-watcher.js
```

**Implementation:**
```javascript
// devassist-watcher.js
import { watch } from 'fs';
import axios from 'axios';

watch('/Users/danielconnolly/.claude-code', async (event, filename) => {
  if (filename.endsWith('.md')) {
    const content = await fs.readFile(filename);
    // Extract decisions/code from Claude Code output
    await axios.post('http://localhost:3456/api/decisions', {
      decision: extractedDecision,
      context: 'Via Claude Code',
      project: detectProjectFromPath()
    });
  }
});
```

### 2. 🌟 Gemini Integration
**Challenge:** Gemini doesn't have MCP support

**Solution:** Browser extension or API proxy
```javascript
// Chrome extension content script
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    const geminiResponse = extractGeminiResponse(mutation);
    if (containsArchitecturalDecision(geminiResponse)) {
      chrome.runtime.sendMessage({
        type: 'RECORD_DECISION',
        data: parseDecision(geminiResponse)
      });
    }
  });
});
```

### 3. 💻 IDE Integration (VS Code/Cursor)

**Option A: VS Code Extension**
```typescript
// extension.ts
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  // Listen to AI assistant responses
  vscode.workspace.onDidChangeTextDocument((e) => {
    if (e.document.fileName.includes('.ai-chat')) {
      const decision = extractDecision(e.contentChanges);
      recordToDevAssist(decision);
    }
  });
  
  // Listen to git commits
  const gitExtension = vscode.extensions.getExtension('vscode.git');
  gitExtension.exports.onDidCommit((commit) => {
    recordCommitDecision(commit.message);
  });
}
```

**Option B: File System Watcher**
```javascript
// Watch for AI-generated files
import chokidar from 'chokidar';

const watcher = chokidar.watch([
  '**/.cursor/*',
  '**/.continue/*',
  '**/.github/copilot/*'
], {
  ignored: /node_modules/,
  persistent: true
});

watcher.on('add', (path) => {
  processAIFile(path);
});
```

### 4. 🔄 Git Integration
**Auto-capture from commit messages:**
```javascript
// git-hook.js (post-commit hook)
const commitMsg = process.argv[2];
const decisonPattern = /^(feat|fix|refactor|perf):\s*(.+)/;

if (decisionPattern.test(commitMsg)) {
  const [, type, description] = commitMsg.match(decisionPattern);
  fetch('http://localhost:3456/api/decisions', {
    method: 'POST',
    body: JSON.stringify({
      decision: description,
      context: `Git commit: ${type}`,
      project: getCurrentProject()
    })
  });
}
```

### 5. 🌐 Universal Listener Service

**Create a background service that monitors multiple sources:**

```javascript
// devassist-listener.js
import { FSWatcher } from 'chokidar';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';

class DevAssistListener {
  constructor() {
    this.sources = new Map();
    this.initializeListeners();
  }

  initializeListeners() {
    // 1. File system watcher for AI tool outputs
    this.watchAITools();
    
    // 2. Process monitor for claude-code
    this.monitorClaudeCode();
    
    // 3. Git hooks
    this.setupGitHooks();
    
    // 4. Browser extension WebSocket
    this.setupBrowserBridge();
    
    // 5. IDE extension bridge
    this.setupIDEBridge();
  }

  watchAITools() {
    const paths = [
      '~/.claude-code/',
      '~/.continue/',
      '~/.cursor/',
      '~/.aider/',
      '**/ai-decisions.md'
    ];
    
    this.watcher = chokidar.watch(paths, {
      persistent: true,
      ignoreInitial: true
    });
    
    this.watcher.on('change', this.processFile.bind(this));
  }

  monitorClaudeCode() {
    // Intercept claude-code commands
    const claudeCode = spawn('claude-code', ['--json-output'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    claudeCode.stdout.on('data', (data) => {
      this.processClaudeCodeOutput(data.toString());
    });
  }

  async processFile(filepath) {
    const content = await fs.readFile(filepath, 'utf-8');
    const decisions = this.extractDecisions(content);
    
    for (const decision of decisions) {
      await this.recordToDevAssist(decision);
    }
  }

  extractDecisions(content) {
    // AI to identify decisions using NLP
    const patterns = [
      /decided to use (\w+) because (.+)/gi,
      /choosing (\w+) over (\w+) for (.+)/gi,
      /architectural decision: (.+)/gi
    ];
    
    const decisions = [];
    for (const pattern of patterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        decisions.push({
          decision: match[1],
          context: match[2] || match[3],
          source: 'auto-detected'
        });
      }
    }
    return decisions;
  }
}
```

## Implementation Priority

### Phase 1: Low-Hanging Fruit (1 week)
1. **Git commit hooks** - Easy to implement
2. **File watchers** for known AI tool directories
3. **Simple pattern matching** for decisions

### Phase 2: IDE Integration (2-3 weeks)  
1. **VS Code extension** 
2. **Cursor integration**
3. **Continue.dev plugin**

### Phase 3: Browser Integration (3-4 weeks)
1. **Chrome extension** for Gemini/ChatGPT
2. **WebSocket bridge** for real-time capture
3. **Universal browser bookmarklet**

### Phase 4: Advanced Integration (1+ month)
1. **NLP-based decision extraction**
2. **Multi-source correlation**
3. **Automatic project detection**
4. **Conflict resolution** for duplicate decisions

## Quick Start: Add Git Integration Today

```bash
# 1. Create git hook
cat > .git/hooks/post-commit << 'EOF'
#!/bin/bash
COMMIT_MSG=$(git log -1 --pretty=%B)
PROJECT=$(basename $(git rev-parse --show-toplevel))

# Check if commit contains decision markers
if echo "$COMMIT_MSG" | grep -qE "(decision:|chose:|selected:|using:)"; then
  curl -X POST http://localhost:3456/api/decisions \
    -H "Content-Type: application/json" \
    -d "{
      \"decision\": \"$COMMIT_MSG\",
      \"context\": \"Git commit\",
      \"project\": \"$PROJECT\"
    }"
fi
EOF

chmod +x .git/hooks/post-commit
```

## Configuration File Concept

```yaml
# ~/.devassist/config.yaml
listeners:
  git:
    enabled: true
    patterns:
      - "decision:"
      - "architecture:"
      - "chose:"
  
  claude_code:
    enabled: true
    watch_path: ~/.claude-code
  
  vscode:
    enabled: false
    extension_id: "devassist.vscode"
  
  browser:
    enabled: false
    port: 9876
    
  file_watchers:
    - path: "**/*.decisions.md"
      format: markdown
    - path: "**/ADR-*.md"  # Architecture Decision Records
      format: adr

auto_project_detection:
  enabled: true
  use_git_root: true
  use_package_json: true

semantic_triggers:
  - "decided to"
  - "choosing"
  - "will use"
  - "implemented"
  - "refactored to"
```

## Summary

DevAssist currently **only** listens to:
- Direct Claude Desktop conversations (via MCP)
- Manual API calls
- Manual GUI inputs

To listen to other sources, we would need to implement:
1. **File watchers** for AI tool outputs
2. **Git hooks** for commit messages  
3. **IDE extensions** for VS Code/Cursor
4. **Browser extensions** for Gemini/ChatGPT
5. **Process monitors** for Claude Code

The easiest starting point would be git hooks and file watchers, which could be added in a few hours of work.
