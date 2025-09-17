---
name: ui-mode
description: Enter UI Focus Mode for visual development with live preview
tools:
  - DevAssist
  - Playwright
---

# UI Focus Mode

Activates the specialized UI development environment with:
- Split-screen interface (code + live preview)
- Automatic refresh on file changes
- Design validation checks
- Visual regression testing
- Component iteration tracking

## Usage

```
/ui-mode [options]
```

### Options
- `--component <n>` - Focus on specific component
- `--viewport <size>` - Set initial viewport (mobile/tablet/desktop)
- `--validation <level>` - Set validation level (basic/comprehensive)
- `--persistent` - Keep browser open between sessions

## Features Activated

1. **Live Preview**
   - Playwright browser with auto-refresh
   - Multiple viewport testing
   - Device emulation

2. **Design Validation**
   - Real-time design system checks
   - Accessibility scanning
   - Performance metrics

3. **Iteration Tracking**
   - Automatic screenshot capture
   - Design decision recording
   - Component history

4. **Visual Testing**
   - Regression detection
   - Pixel-perfect comparisons
   - Diff generation

## Workflow

1. Enter UI mode: `/ui-mode`
2. Make changes in code panel
3. Preview updates automatically
4. Run validations: `/ui-validate`
5. Create checkpoint: `/ui-checkpoint`
6. Exit UI mode: `/ui-mode --exit`

## Integration

UI Mode integrates with:
- DevAssist for session management
- Design review agent for validation
- Git for version control
- Performance monitoring tools

## Keyboard Shortcuts

- `Cmd+R` - Refresh preview
- `Cmd+S` - Save and validate
- `Cmd+D` - Toggle device mode
- `Cmd+V` - Run validation
- `Cmd+P` - Take screenshot
- `Cmd+H` - Show/hide history

## Example

```
/ui-mode --component Button --viewport mobile --validation comprehensive
```

This starts UI mode focused on the Button component with mobile viewport and comprehensive validation enabled.
