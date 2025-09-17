# DevAssist UI Module

Enhanced UI development mode for DevAssist MCP Server providing rapid visual iteration, design validation, and automated testing capabilities.

## Features

### 🎨 UI Development Mode
- **Split-screen interface** with code editor and live preview
- **Real-time browser refresh** on file changes
- **Persistent browser sessions** across mode switches
- **Visual design iteration tracking**

### 📱 Responsive Testing
- **Viewport presets** (Desktop, Tablet, Mobile, iPhone 15, iPad Pro)
- **Custom viewport sizes**
- **Device emulation** with touch support
- **Responsive design validation**

### ✅ Design Validation
- **WCAG accessibility compliance** (A, AA, AAA levels)
- **Color contrast checking**
- **Typography validation** against design tokens
- **Spacing consistency checks**
- **Performance metrics** (FCP, LCP, CLS, TBT)

### 📸 Visual History
- **Automatic screenshot capture** on changes
- **Design iteration timeline**
- **Visual diff comparison** between iterations
- **Annotation support** for design feedback

### 🔄 Smart File Watching
- **Debounced file change detection**
- **Pattern-based file filtering**
- **Categorized change events** (styles, components, HTML)
- **Automatic browser refresh**

## Installation

```bash
cd DevAssist/ui-module
npm install
```

## Usage

### Via MCP Tools

The UI module integrates seamlessly with DevAssist MCP server. Available commands:

```javascript
// Enter UI development mode
toggle_ui_mode mode="ui"

// Navigate to a component
ui_navigate url="http://localhost:3000/components/button"

// Change viewport
ui_set_viewport preset="mobile"
ui_set_viewport width=768 height=1024

// Run design validation
ui_validate_design

// Capture design iteration
ui_capture_iteration fullPage=true
```

### Programmatic API

```javascript
import { UIModeManager } from '@devassist/ui-module';

const uiManager = new UIModeManager({
  projectRoot: process.cwd(),
  autoStart: false
});

// Enter UI mode
await uiManager.enterUIMode();

// Navigate and validate
await uiManager.navigateTo('http://localhost:3000');
const report = await uiManager.runValidation();

// Capture iteration
await uiManager.captureScreenshot();

// Exit UI mode
await uiManager.exitUIMode();
```

## Configuration

### ui-mode-settings.json

```json
{
  "defaultMode": "standard",
  "uiMode": {
    "enabled": false,
    "layout": {
      "leftPanel": 40,
      "centerPanel": 40,
      "rightPanel": 20
    },
    "autoRefresh": true,
    "refreshDelay": 500,
    "fileWatcher": {
      "patterns": ["**/*.{tsx,jsx,css,scss,html}"],
      "ignore": ["**/node_modules/**"],
      "debounceMs": 500
    },
    "validation": {
      "autoRun": true,
      "wcagLevel": "AA"
    }
  }
}
```

### viewport-presets.json

Define custom viewport presets for testing:

```json
{
  "presets": {
    "custom": {
      "name": "Custom Device",
      "width": 414,
      "height": 896,
      "deviceScaleFactor": 3,
      "isMobile": true,
      "hasTouch": true
    }
  }
}
```

## Architecture

### Core Components

- **UIModeManager**: Main orchestrator for UI mode
- **PlaywrightManager**: Browser automation and control
- **FileWatcher**: File change detection and categorization
- **DesignValidator**: Validation engine for design compliance
- **IterationManager**: Visual history and diff management

### Services

```
ui-module/
├── services/
│   ├── PlaywrightManager.ts    # Browser control
│   ├── FileWatcher.ts          # File monitoring
│   ├── DesignValidator.ts      # Design validation
│   └── IterationManager.ts     # History tracking
├── config/
│   ├── ui-mode-settings.json   # Main configuration
│   └── viewport-presets.json   # Device presets
└── DevAssistIntegration.js     # MCP integration
```

## Event System

The UI module emits events for integration:

```javascript
uiManager.on('uiModeEntered', () => {});
uiManager.on('fileChanged', (change) => {});
uiManager.on('validationComplete', (report) => {});
uiManager.on('iterationSaved', (iteration) => {});
uiManager.on('browserError', (error) => {});
```

## Design Validation Rules

### Built-in Validations

1. **Accessibility**
   - WCAG 2.1 compliance
   - ARIA attributes
   - Keyboard navigation
   - Screen reader compatibility

2. **Visual Consistency**
   - Color contrast ratios
   - Typography scale adherence
   - Spacing grid compliance
   - Responsive breakpoints

3. **Performance**
   - First Contentful Paint (FCP)
   - Largest Contentful Paint (LCP)
   - Cumulative Layout Shift (CLS)
   - Total Blocking Time (TBT)

### Custom Rules

Add custom validation rules:

```javascript
designValidator.addCustomRule({
  name: 'brand-colors',
  category: 'branding',
  validate: (context) => {
    // Custom validation logic
    return {
      passed: true,
      category: 'branding',
      severity: 'info',
      message: 'Brand colors are consistent'
    };
  }
});
```

## Integration with DevAssist

The UI module extends DevAssist's capabilities:

1. **Architectural Decisions**: UI issues are recorded as ADRs
2. **Session Management**: UI mode sessions are tracked
3. **Project Context**: UI settings per project
4. **Knowledge Base**: Design patterns are captured

## Performance Considerations

- **Debounced file watching**: 500ms default delay
- **Smart screenshot compression**: JPEG with quality settings
- **Iteration limits**: Configurable max iterations (default 50)
- **Virtual scrolling**: For large design galleries
- **Lazy loading**: Component examples on demand

## Keyboard Shortcuts

When running in terminal mode:

- `Ctrl+U`: Toggle UI mode
- `Ctrl+S`: Capture screenshot
- `Ctrl+V`: Run validation
- `Ctrl+R`: Refresh browser
- `Ctrl+D`: Toggle device

## Troubleshooting

### Browser won't start
```bash
# Check Playwright installation
npx playwright install chromium
```

### File watching not working
```bash
# Check file patterns in config
# Ensure paths are relative to project root
```

### Validation errors
```bash
# Ensure design-tokens.json exists
# Check WCAG level in settings
```

## Future Enhancements

- [ ] Visual regression testing
- [ ] Component playground UI
- [ ] Design system integration
- [ ] Figma sync
- [ ] Performance budgets
- [ ] A/B testing support
- [ ] Collaboration features
- [ ] CI/CD integration

## License

Part of DevAssist MCP Server - MIT License