# DevAssist Knowledge Absorption Guide

## How DevAssist Learns About Your Projects

DevAssist **automatically** absorbs and indexes information about your projects through several mechanisms:

### 🔄 Automatic Knowledge Absorption

1. **Real-time Decision Tracking**
   - When you make architectural decisions in Claude, DevAssist can record them
   - These are automatically indexed with semantic embeddings for future search
   - No manual entry required - just discuss your decisions with Claude

2. **Code Pattern Analysis**
   - DevAssist can scan your codebase and identify patterns
   - Automatically creates embeddings for code similarity detection
   - Helps identify duplicate implementations across your project

3. **Progress Tracking**
   - Milestones and progress updates are automatically indexed
   - Creates a searchable timeline of your project evolution

### 📝 How to Use It

You don't need to manually add knowledge! Instead:

1. **Through Claude Conversations**
   ```
   "Let's record a decision: We're using SuperCollider for audio synthesis 
   because it provides <15ms latency"
   ```
   Claude can then call DevAssist to record this automatically.

2. **Through Code Analysis**
   ```
   "Analyze the Performia codebase for duplicate patterns"
   ```
   DevAssist will scan and index your code automatically.

3. **Through Progress Updates**
   ```
   "Mark the audio engine integration as complete"
   ```
   DevAssist tracks this milestone automatically.

### 🎯 Integration with Claude

The key is that DevAssist works **through** Claude, not separately:

- Claude has tools to call DevAssist functions
- You describe what you want in natural language
- Claude translates this to DevAssist API calls
- Information is automatically stored and indexed

### 🔍 Semantic Search

All absorbed knowledge is:
- Converted to 384-dimensional embeddings
- Stored in LanceDB for vector similarity search
- Searchable by meaning, not just keywords

### 📊 Current Data Sources

DevAssist automatically tracks:
- **Architectural Decisions** - with context, alternatives, and impact
- **Code Patterns** - for duplicate detection and analysis
- **Project Progress** - milestones, blockers, and status
- **Project Structure** - automatically scans your Projects folder

### ⚡ Real-time Updates

- WebSocket connection keeps GUI updated in real-time
- Every decision, pattern, or progress update triggers instant UI refresh
- No need to manually refresh or re-index

### 🚀 Example Workflow

1. **Start a conversation with Claude about your project**
   ```
   "I'm working on Performia and need to decide between TCP and UDP 
   for agent communication"
   ```

2. **Discuss the decision**
   ```
   "After testing, UDP gives us 30ms lower latency, so let's use that"
   ```

3. **Claude records it automatically**
   ```
   Claude: "I'll record this architectural decision for the Performia project..."
   [DevAssist automatically indexes: UDP chosen for 30ms latency improvement]
   ```

4. **Later, search for it semantically**
   ```
   "What networking decisions did we make for low latency?"
   [DevAssist returns the UDP decision based on semantic similarity]
   ```

### 🔧 Manual Override

While not necessary, you can also:
- Use the GUI at http://localhost:3456 for manual entry
- Call the API directly for programmatic access
- Import existing documentation (planned feature)

### 📈 Benefits

- **No Context Switching** - Stay in your Claude conversation
- **Automatic Indexing** - Everything is searchable by meaning
- **Project Intelligence** - Builds understanding of your codebase over time
- **Zero Overhead** - Knowledge capture happens during normal development

## Summary

DevAssist is designed to be **invisible** during normal development. Just talk to Claude about your project, make decisions, track progress, and DevAssist automatically builds a searchable knowledge base in the background. No manual data entry required!
