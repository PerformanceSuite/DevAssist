# DevAssist Tools Reference

## Available Tools

### 1. analyze_codebase
**Purpose**: Analyze project structure and identify patterns  
**When to use**: Understanding code organization, finding patterns

**Parameters**:
- `path` (string): Directory to analyze (default: ".")
- `depth` (number): How deep to scan (default: 3)
- `pattern` (string): File pattern like "*.js" (default: "*")
- `index_patterns` (boolean): Index for duplicate detection (default: false)

**Example**:
```json
{
  "path": "./src",
  "depth": 5,
  "pattern": "*.ts",
  "index_patterns": true
}
```

---

### 2. record_architectural_decision
**Purpose**: Document important design decisions  
**When to use**: After making architectural choices

**Parameters**:
- `decision` (string, required): The decision made
- `context` (string, required): Why this decision
- `alternatives` (array): Other options considered
- `impact` (string): Expected effects
- `project` (string): Project name (default: "default")

**Example**:
```json
{
  "decision": "Use React for frontend",
  "context": "Team has React expertise, large ecosystem",
  "alternatives": ["Vue", "Angular", "Svelte"],
  "impact": "Faster development, easier hiring"
}
```

---

### 3. get_project_memory
**Purpose**: Retrieve past decisions and knowledge  
**When to use**: Need to recall project history

**Parameters**:
- `query` (string): Search terms
- `category` (string): Filter by type ["decisions", "progress", "lessons", "architecture", "all"]
- `limit` (number): Max results (default: 10)
- `project` (string): Project name

**Example**:
```json
{
  "query": "database choices",
  "category": "decisions",
  "limit": 5
}
```

---

### 4. track_progress
**Purpose**: Monitor development milestones  
**When to use**: Update feature progress

**Parameters**:
- `milestone` (string, required): Feature/milestone name
- `status` (string, required): ["not_started", "in_progress", "testing", "completed", "blocked"]
- `notes` (string): Additional context
- `blockers` (array): List of blocking issues
- `project` (string): Project name

**Example**:
```json
{
  "milestone": "User authentication",
  "status": "in_progress",
  "notes": "JWT implementation complete, testing OAuth",
  "blockers": ["Waiting for OAuth credentials"]
}
```

---

### 5. identify_duplicate_effort
**Purpose**: Find similar code patterns  
**When to use**: Before implementing new features

**Parameters**:
- `feature` (string, required): Description of functionality
- `path` (string): Where to search (default: ".")
- `similarity_threshold` (number): 0.0-1.0 (default: 0.7)

**Example**:
```json
{
  "feature": "user input validation",
  "path": "./src",
  "similarity_threshold": 0.8
}
```

---

### 6. semantic_search
**Purpose**: Search using natural language  
**When to use**: Finding relevant code or decisions

**Parameters**:
- `query` (string, required): Search query
- `search_type` (string): ["decisions", "code_patterns", "all"]
- `min_similarity` (number): Threshold 0-1 (default: 0.5)
- `limit` (number): Max results (default: 10)
- `project` (string): Project name

**Example**:
```json
{
  "query": "how do we handle user sessions",
  "search_type": "all",
  "min_similarity": 0.6
}
```

---

### 7. get_documentation
**Purpose**: Search and retrieve documentation  
**When to use**: Need technical documentation

**Parameters**:
- `topic` (string, required): What to search for
- `source` (string): ["supercollider", "claude_code", "project", "all"]
- `search_depth` (number): How deep to search (default: 3)

**Example**:
```json
{
  "topic": "DevAssist configuration",
  "source": "all"
}
```

---

### 8. analyze_dependencies
**Purpose**: Analyze project dependencies  
**When to use**: Understanding project requirements

**Parameters**:
- `path` (string): Project path (default: ".")
- `include_dev` (boolean): Include dev dependencies (default: true)
- `check_updates` (boolean): Check for updates (default: false)

**Example**:
```json
{
  "path": "./",
  "include_dev": true,
  "check_updates": true
}
```

---

### 9. generate_summary
**Purpose**: Create development summary  
**When to use**: Status reports, sprint reviews

**Parameters**:
- `days_back` (number): Days to look back (default: 7)
- `include_commits` (boolean): Include git history (default: true)
- `project` (string): Project name (default: "default")

**Example**:
```json
{
  "days_back": 14,
  "include_commits": true,
  "project": "my-app"
}
```

---

## Usage Tips

### Effective Semantic Search
- Use natural language questions
- Be specific about what you're looking for
- Adjust similarity threshold if too few/many results

### Recording Decisions
- Document decisions immediately after making them
- Include context about why, not just what
- List alternatives to show thinking process

### Progress Tracking
- Update status regularly
- Document blockers immediately
- Use consistent milestone names

### Code Analysis
- Index patterns when starting new features
- Check for duplicates before implementing
- Use appropriate file patterns for language

---

## Common Workflows

### 1. Starting a New Feature
```
1. identify_duplicate_effort - Check if similar exists
2. record_architectural_decision - Document approach
3. track_progress - Set milestone as "in_progress"
```

### 2. Understanding Existing Code
```
1. analyze_codebase - Get structure overview
2. semantic_search - Find relevant code
3. get_project_memory - Understand past decisions
```

### 3. Project Status Review
```
1. generate_summary - Get recent activity
2. get_project_memory - Review decisions
3. track_progress - Update milestones
```

---

*Use these tools to build intelligent project knowledge over time*
