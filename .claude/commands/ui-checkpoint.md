---
name: ui-checkpoint
description: Create a visual checkpoint with automatic screenshots and metrics
tools:
  - DevAssist
  - Git
  - Playwright
---

# UI Checkpoint

Creates a comprehensive visual checkpoint that includes:
- Screenshots across all viewports
- Performance metrics snapshot
- Accessibility scores
- Design validation results
- Automatic git commit with visual diff

## Usage

```
/ui-checkpoint [message]
```

### Options
- `--viewports all|mobile|tablet|desktop` - Viewports to capture (default: all)
- `--validate` - Run validation before checkpoint
- `--compare` - Compare with previous checkpoint
- `--tag <name>` - Add a tag to this checkpoint

## What Gets Captured

1. **Visual Assets**
   - Full page screenshots
   - Component-level captures
   - Interactive state screenshots
   - Device frame mockups

2. **Metrics**
   - Render performance (LCP, FID, CLS)
   - Bundle size changes
   - CSS complexity metrics
   - Accessibility scores

3. **Validation Results**
   - Design system compliance
   - Color contrast checks
   - Spacing consistency
   - Typography adherence

4. **Git Integration**
   - Automatic commit with description
   - Visual diff in commit message
   - Branch protection if issues found
   - PR annotation with screenshots

## Checkpoint Structure

```
.devassist/checkpoints/
├── 2024-01-15-14-30/
│   ├── screenshots/
│   │   ├── desktop-1440.png
│   │   ├── tablet-768.png
│   │   └── mobile-375.png
│   ├── metrics.json
│   ├── validation.json
│   ├── diff-report.html
│   └── checkpoint.json
```

## Examples

### Basic checkpoint
```
/ui-checkpoint "Updated button styles"
```

### Comprehensive checkpoint with validation
```
/ui-checkpoint "Major redesign of dashboard" --validate --compare --tag v2.0
```

### Mobile-only checkpoint
```
/ui-checkpoint "Mobile navigation improvements" --viewports mobile
```

## Integration

Checkpoints are automatically:
- Stored in DevAssist memory
- Committed to git with visual context
- Available for regression testing
- Included in design review reports
