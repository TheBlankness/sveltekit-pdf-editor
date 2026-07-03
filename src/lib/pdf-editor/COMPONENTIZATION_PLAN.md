# PDFEditor Componentization Plan

## Overview
This document outlines the strategy to break down `PDFEditor.svelte` (~2600 lines) into smaller, manageable, and reusable components while maintaining all existing functionality.

## Current Issues
- Single file with 2600+ lines
- Difficult to navigate and maintain
- Multiple responsibilities mixed together
- Hard to test individual features
- State management scattered throughout

## Proposed Structure

```
src/lib/pdf-editor/
├── PDFEditor.svelte                    # Main orchestrator (< 300 lines)
├── COMPONENTIZATION_PLAN.md            # This file
│
├── context/
│   └── pdfEditorContext.ts            # Svelte context for shared state
│
├── composables/
│   ├── usePDFModes.ts                 # Mode management (drawing, erasing, etc.)
│   ├── usePDFObjects.ts               # Object CRUD, undo/redo
│   └── useZoomAndPan.ts               # Zoom and touch handling
│
├── components/
│   ├── PDFCanvas.svelte               # Main PDF rendering area with canvas layers
│   │
│   ├── toolbar/
│   │   ├── PDFEditorToolbar.svelte    # Main toolbar container
│   │   ├── SaveStatusIndicator.svelte # Save state display
│   │   ├── PageNavigation.svelte      # Page navigation controls
│   │   ├── ActionButtons.svelte       # Save/Done/Fullscreen buttons
│   │   └── ToolButtons.svelte         # Drawing/Text/Eraser/etc buttons
│   │
│   ├── tool-panels/
│   │   ├── DrawingToolPanel.svelte    # Drawing tool settings
│   │   ├── HighlightToolPanel.svelte  # Highlight tool settings
│   │   ├── EraserToolPanel.svelte     # Eraser tool settings
│   │   ├── ZoomToolPanel.svelte       # Zoom controls panel
│   │   ├── TextToolPanel.svelte       # Text editing toolbar
│   │   ├── LineToolPanel.svelte       # Line creation toolbar
│   │   └── SelectedLineToolPanel.svelte # Line editing toolbar
│   │
│   └── overlays/
│       ├── PenModeNotification.svelte # Pen mode indicator
│       └── SelectionToolbar.svelte    # Selection mode toolbar
│
└── [existing canvas components]
    ├── DrawingCanvas.svelte
    ├── ErasingCanvas.svelte
    ├── HighlightCanvas.svelte
    ├── LineCanvas.svelte
    ├── PointerCanvas.svelte
    ├── SelectionCanvas.svelte
    ├── PDFPage.svelte
    └── [object components]
        ├── Drawing.svelte
        ├── Line.svelte
        ├── Text.svelte
        └── PointerStroke.svelte
```

## Implementation Strategy

### Phase 1: Shared State Management
**File:** `context/pdfEditorContext.ts`

Create a Svelte context to share state between components:
- PDF state (pages, zoom, currentPage, PDFReady)
- Tool modes (addingDrawing, isErasing, isHighlighting, etc.)
- Tool settings (brushSize, brushColor, lineStrokeWidth, etc.)
- Objects and selection state
- Save state
- User information

**Benefits:**
- Centralized state management
- Easy to access from any child component
- Type-safe with TypeScript
- No prop drilling

### Phase 2: Composable Functions
**Files:** `composables/usePDFModes.ts`, `usePDFObjects.ts`, `useZoomAndPan.ts`

Extract reusable logic into composable functions:

**`usePDFModes.ts`**
- Mode switching logic (onAddDrawing, onErasing, onHighlighting, etc.)
- Mode state validation
- Mode transitions

**`usePDFObjects.ts`**
- Object CRUD operations (addDrawing, addLine, addTextField)
- Update/delete objects
- Undo/redo logic
- Object sorting

**`useZoomAndPan.ts`**
- Zoom controls (handleZoomIn, handleZoomOut, handleResetZoom)
- Touch gesture handling (onTouchMove, onTouchEnd)
- Zoom at point calculation

### Phase 3: Toolbar Components

**3.1: `SaveStatusIndicator.svelte`**
Props:
- `saveState: SaveState`
- `onRetry: () => void`

Displays the current save status with appropriate icon and retry button.

**3.2: `PageNavigation.svelte`**
Props:
- `currentPage: number`
- `minPage: number`
- `maxPage: number`
- `isChangingPage: boolean`
- `onPageChange: (page: number) => void`
- `onNext: () => void`
- `onPrev: () => void`

Handles page input and navigation.

**3.3: `ActionButtons.svelte`**
Props:
- `saveState: SaveState`
- `homework_info: any`
- `allowPrinting: boolean`
- `pdfFile: File | undefined`
- `saving: boolean`
- `isFullscreen: boolean`
- `onSave: () => void`
- `onDone: () => void`
- `onToggleFullscreen: () => void`
- `onViewHomeworkInfo: () => void`
- `onPrint: () => void`

Groups Save, Done, Fullscreen, and Homework Info buttons.

**3.4: `ToolButtons.svelte`**
Props:
- Mode states (addingDrawing, isErasing, isHighlighting, etc.)
- `isPageDisabled: boolean`
- `selectedPageIndex: number`
- Mode handlers (onAddDrawing, onErasing, etc.)

Groups all tool buttons (Draw, Erase, Line, Highlight, Pointer, Select, Zoom, Text).

**3.5: `PDFEditorToolbar.svelte`**
Main toolbar that orchestrates all sub-toolbars.

### Phase 4: Tool Panel Components

Each tool panel will be extracted into its own component with minimal props:

**`DrawingToolPanel.svelte`**
- Props: `brushSize`, `brushColor`, `brushOpacity`, `onClose`, `onBrushSizeChange`, `onColorChange`
- Shows brush size slider and color palette

**`HighlightToolPanel.svelte`**
- Props: `highlightSize`, `highlightColor`, `onClose`, `onSizeChange`, `onColorChange`

**`EraserToolPanel.svelte`**
- Props: `ErasingBrushSize`, `onClose`, `onSizeChange`

**`ZoomToolPanel.svelte`**
- Props: `zoom`, `zoomEnabled`, `isPageDisabled`, handlers
- Contains zoom in/out/reset/toggle touch controls

**`TextToolPanel.svelte`**
- Props: text properties, handlers
- Font size, color, line height, font family controls

**`LineToolPanel.svelte` & `SelectedLineToolPanel.svelte`**
- Props: line properties, handlers
- Stroke width and color controls

### Phase 5: Canvas Container

**`PDFCanvas.svelte`**

A single component that encapsulates:
- The PDF page rendering
- All canvas overlays (drawing, erasing, highlighting, etc.)
- Object rendering (drawings, lines, text)
- Selection and dragging logic

Props:
- `allObjects`
- `zoom`
- `currentPage`
- `paginatedPages`
- Mode states
- Tool settings
- Event handlers

This significantly cleans up the main component.

### Phase 6: Overlay Components

**`PenModeNotification.svelte`**
- Props: `isPenMode`, `onClose`
- Shows pen mode notification

**`SelectionToolbar.svelte`**
- Props: `isSelectionMode`, `selectedObjectIds`, `onDelete`, `onClearSelection`
- Shows selection count and delete button

### Phase 7: Updated PDFEditor.svelte

The main file becomes an orchestrator:
1. Initialize context with state
2. Render toolbar
3. Render canvas
4. Render overlays
5. Handle homework info modal

Expected size: ~250-300 lines (vs. current 2600+ lines)

## Migration Plan

1. ✅ **Create plan document** (this file)
2. **Phase 1:** Create context (non-breaking)
3. **Phase 2:** Create composables (non-breaking)
4. **Phase 3-6:** Extract components one by one
   - Each extraction will be tested immediately
   - Maintain backward compatibility during transition
5. **Phase 7:** Refactor main PDFEditor.svelte
6. **Testing:** Verify all features work identically

## Testing Strategy

After each component extraction:
1. Visual regression testing (all tools should look the same)
2. Functional testing (all interactions should work)
3. State synchronization testing (all components should share state correctly)
4. Touch/mouse event testing
5. Edge case testing (disabled states, page changes, etc.)

## Benefits

### Maintainability
- Each component has a single responsibility
- Easy to locate and fix bugs
- Clear separation of concerns

### Testability
- Individual components can be unit tested
- Easier to mock dependencies
- Better test coverage

### Reusability
- Tool panels can be reused in other contexts
- Composables can be shared across features
- Components are self-contained

### Performance
- Smaller components = better tree-shaking
- Easier to optimize individual pieces
- Better code splitting opportunities

### Developer Experience
- Easier to understand code structure
- Faster to onboard new developers
- Better IDE support and autocomplete
- Reduced cognitive load

## Implementation Notes

### State Management Approach
We'll use Svelte's built-in context API with TypeScript:
```typescript
// context/pdfEditorContext.ts
export const pdfEditorContextKey = Symbol('pdfEditor');

export function createPDFEditorContext() {
  // Create all state with $state runes
  // Return getters and setters
}

export function getPDFEditorContext() {
  return getContext<ReturnType<typeof createPDFEditorContext>>(pdfEditorContextKey);
}
```

### Props vs Context Decision
- **Props:** When component needs explicit control (e.g., callbacks)
- **Context:** For deeply nested shared state (e.g., zoom level, mode states)

### Backward Compatibility
- Keep all existing props in PDFEditor.svelte
- Internal refactoring only
- No changes to parent components needed

## Next Steps

1. Get approval for this plan
2. Start with Phase 1 (context creation)
3. Proceed incrementally through phases
4. Test thoroughly after each phase

## Questions for Review

1. Is this structure clear and logical?
2. Are there any specific components you'd like prioritized?
3. Should we add any additional components or split any further?
4. Any concerns about the approach?
