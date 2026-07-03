# PDFEditor Testing Guide

## Overview
This guide provides a comprehensive checklist to test the PDFEditor component after refactoring. Use this to verify that all functionality remains intact.

## Quick Smoke Test (5 minutes)
Use this for rapid verification after each component extraction:

### ✅ Basic Functionality
- [ ] PDF loads and displays correctly
- [ ] Page navigation works (next/previous buttons)
- [ ] Can type page number and jump to page
- [ ] Zoom in/out buttons work
- [ ] Save button is clickable
- [ ] Done button is clickable

### ✅ Core Tools
- [ ] Add Text: Click "Add Text" → Click on PDF → Text box appears
- [ ] Draw: Click "Draw" → Draw on PDF → Line appears
- [ ] Erase: Click "Erase" → Draw over existing annotation → It disappears
- [ ] Highlight: Click "Highlight" → Draw on PDF → Highlighted area appears

## Comprehensive Test Suite (20 minutes)

### 1. Initial Load
**Test:** Open a page with PDFEditor component

- [ ] PDF renders correctly
- [ ] All toolbar buttons are visible
- [ ] Save status shows "Idle" or appropriate state
- [ ] Page counter shows correct page (e.g., "1 / 5")
- [ ] No console errors

**Expected:** Clean load with all UI elements visible

---

### 2. Save State Indicator
**Test:** Observe save state changes

- [ ] Shows "Idle" initially
- [ ] Shows "Saving..." with spinner when saving
- [ ] Shows "Saved" with checkmark after successful save
- [ ] Shows "Local Saved" when saved locally
- [ ] Shows "Cloud Saved" when saved to cloud
- [ ] Shows "Not saved" with warning icon on failure
- [ ] Retry button appears on failure
- [ ] Last save timestamp displays correctly

**Expected:** All save states display with correct icons and colors

---

### 3. Page Navigation
**Test:** Navigate between pages

- [ ] **Next button:** Advances to next page
- [ ] **Previous button:** Goes to previous page
- [ ] **Next button disabled** on last page
- [ ] **Previous button disabled** on first page
- [ ] **Type page number:** Can type "3" and jumps to page 3
- [ ] **Invalid page number:** Clamps to valid range
- [ ] **Empty input:** Can clear input, then on blur resets to current page
- [ ] **Loading indicator** appears during page change (if debounced)
- [ ] Page change triggers `handlePageChange` callback

**Expected:** Smooth navigation with proper disabled states

---

### 4. Text Tool
**Test:** Add and edit text annotations

#### Adding Text
- [ ] Click "Add Text" button → Button text changes to "Click anywhere to add text"
- [ ] Click on PDF → Text box appears at click location
- [ ] Can type text immediately
- [ ] Text box has focus
- [ ] Clicking "Add Text" again toggles off the mode

#### Editing Text
- [ ] Click on existing text → Text toolbar appears
- [ ] **Font size:** Click +/- buttons → Size changes
- [ ] **Color picker:** Click color → Text color changes
- [ ] **Line height:** Click +/- buttons → Line spacing changes
- [ ] **Font family:** Select from dropdown → Font changes
- [ ] **Delete button:** Deletes the text box
- [ ] **Close button:** Closes toolbar

#### Text Ownership
- [ ] Can only edit own text (if user owns it)
- [ ] Cannot edit other users' text (viewOnly mode)

**Expected:** Full text editing capabilities with proper ownership

---

### 5. Drawing Tool
**Test:** Draw freehand annotations

- [ ] Click "Draw" button → Activates drawing mode
- [ ] Drawing tool panel appears below toolbar
- [ ] **Brush size slider:** Changes brush thickness (0.1 - 13)
- [ ] **Brush size +/- buttons:** Increment/decrement size
- [ ] **Color palette:** Can select colors (black, red, blue, green, yellow, etc.)
- [ ] Draw on PDF with mouse → Line appears
- [ ] Draw on PDF with touch → Line appears (mobile/tablet)
- [ ] **Pen mode:** Touch drawing doesn't scroll page
- [ ] Drawing respects brush size and color
- [ ] Multiple strokes can be added
- [ ] Close button exits drawing mode

**Expected:** Smooth drawing with customizable brush

---

### 6. Highlight Tool
**Test:** Add highlighted annotations

- [ ] Click "Highlight" button → Activates highlight mode
- [ ] Highlight tool panel appears
- [ ] **Highlight size:** Can change with +/- buttons (increments of 5)
- [ ] **Color palette:** Can select highlight colors
- [ ] Draw on PDF → Semi-transparent highlight appears
- [ ] Highlight has 50% opacity
- [ ] Can add multiple highlights
- [ ] Close button exits highlight mode

**Expected:** Semi-transparent highlighting with size/color control

---

### 7. Eraser Tool
**Test:** Remove annotations

- [ ] Click "Erase" button → Activates eraser mode
- [ ] Eraser tool panel appears
- [ ] **Eraser size:** Can change with +/- buttons
- [ ] Hover over eraser cursor → Shows eraser indicator
- [ ] Draw over own annotation → Annotation disappears
- [ ] **Cannot erase** other users' annotations
- [ ] Eraser detects overlapping strokes accurately
- [ ] Close button exits eraser mode

**Expected:** Accurate erasing with ownership restrictions

---

### 8. Line Tool
**Test:** Draw straight lines

#### Adding Lines
- [ ] Click "Line" button → Activates line mode
- [ ] Line tool panel appears
- [ ] **Stroke width:** Can adjust with +/- buttons
- [ ] **Color palette:** Can select line colors
- [ ] Click and drag on PDF → Straight line appears
- [ ] Line follows mouse/touch accurately
- [ ] After adding line → Line is auto-selected

#### Editing Selected Line
- [ ] Click on existing line → Line toolbar appears
- [ ] Shows current stroke width
- [ ] **Stroke width:** Can change with +/- buttons
- [ ] **Color:** Can change from palette
- [ ] **Delete button:** Removes the line
- [ ] Close button deselects line

#### Line Ownership
- [ ] Can only select and edit own lines

**Expected:** Precise line drawing with full editing capabilities

---

### 9. Pointer Mode
**Test:** Temporary pointer annotations

- [ ] Click "Pointer" button → Activates pointer mode
- [ ] Draw on PDF → Red stroke appears
- [ ] Stroke starts fading after 2.5 seconds
- [ ] Stroke disappears completely after 3 seconds
- [ ] Multiple pointer strokes can exist simultaneously
- [ ] Each stroke fades independently

**Expected:** Temporary pointing with auto-fade

---

### 10. Selection Mode
**Test:** Select and move annotations

#### Lasso Selection
- [ ] Click "Select" button → Activates selection mode
- [ ] Draw a lasso around objects → Objects get selected
- [ ] Selection toolbar appears showing count (e.g., "2 Selected")
- [ ] Selected objects show visual indication

#### Click Selection
- [ ] Click on single object → Selects it
- [ ] Click on empty space → Deselects all
- [ ] **Shift/Ctrl/Cmd + Click:** Adds to selection
- [ ] Click on selected object → Deselects it (with modifier)

#### Moving Selected Objects
- [ ] Click and drag selected objects → They move together
- [ ] Release mouse → Objects stay at new position
- [ ] Movement respects zoom level

#### Selection Actions
- [ ] **Delete button:** Removes all selected objects
- [ ] **Close button:** Clears selection
- [ ] Can only select and delete own objects

**Expected:** Intuitive multi-select with drag and delete

---

### 11. Zoom Controls
**Test:** Zoom in/out functionality

- [ ] Click "Zoom" button → Zoom panel appears
- [ ] **Zoom in (+):** Increases zoom (up to 300%)
- [ ] **Zoom out (-):** Decreases zoom (down to 12.5%)
- [ ] **Reset button:** Returns to 100% zoom
- [ ] **Touch toggle:** Enables/disables pinch zoom
- [ ] Current zoom percentage displays correctly
- [ ] Zoom in disabled at max zoom
- [ ] Zoom out disabled at min zoom

#### Touch Gestures (Mobile/Tablet)
- [ ] Pinch to zoom works (if touch enabled)
- [ ] Two-finger pan works
- [ ] Gesture detection (pinch vs pan) works correctly

#### Zoom Behavior
- [ ] Zooming preserves center point
- [ ] Annotations scale with zoom
- [ ] Drawing tools respect zoom level

**Expected:** Smooth zoom with gesture support

---

### 12. Undo/Redo
**Test:** Undo and redo actions

- [ ] Add annotation → Click "Undo" → Annotation disappears
- [ ] Click "Redo" → Annotation reappears
- [ ] Undo only affects own annotations (not others')
- [ ] Undo works within 60-second time window
- [ ] Undo respects creation order
- [ ] Multiple undo/redo works correctly

**Expected:** Accurate undo/redo with ownership restrictions

---

### 13. Fullscreen Mode
**Test:** Fullscreen toggle

- [ ] Click fullscreen button → Enters fullscreen
- [ ] Button icon changes to minimize icon
- [ ] Click again → Exits fullscreen
- [ ] ESC key exits fullscreen
- [ ] All tools work in fullscreen

**Expected:** Seamless fullscreen toggle

---

### 14. Stroke Visibility Filter
**Test:** Filter annotations by owner

- [ ] **"All Notes":** Shows all annotations
- [ ] **"My Notes":** Shows only own annotations
- [ ] **"Others":** Shows only others' annotations
- [ ] Filter applies immediately
- [ ] Tools still work with filtered view

**Expected:** Proper filtering without breaking tools

---

### 15. Homework Info (if applicable)
**Test:** Homework info modal

- [ ] "Homework Info" button visible (if homework_info prop provided)
- [ ] Click button → Modal opens
- [ ] Modal shows correct homework information
- [ ] Can close modal

**Expected:** Modal displays correctly

---

### 16. Save and Done Buttons
**Test:** Save/Done actions

#### Save Button
- [ ] Enabled when pdfFile is loaded
- [ ] Disabled while saving
- [ ] Disabled if no pdfFile
- [ ] Triggers `handleSave` callback
- [ ] Save status updates accordingly

#### Done Button
- [ ] Enabled when pdfFile is loaded
- [ ] Disabled while saving
- [ ] Triggers `handleComplete` callback with allObjects
- [ ] All annotations are passed correctly

**Expected:** Proper callback execution

---

### 17. Print Button (if allowPrinting = true)
**Test:** Print functionality

- [ ] Button visible when `allowPrinting={true}`
- [ ] Click button → Triggers print/save PDF
- [ ] Disabled while saving
- [ ] Disabled if no PDF loaded

**Expected:** Print functionality works

---

### 18. Disabled Pages
**Test:** Page restrictions

- [ ] Navigate to disabled page
- [ ] All tool buttons disabled
- [ ] Cannot add annotations
- [ ] Existing annotations visible
- [ ] Can still navigate and zoom

**Expected:** Tools disabled on restricted pages

---

### 19. Touch/Pen Mode
**Test:** Touch device behavior

- [ ] Touch drawing activates pen mode
- [ ] "Pen Mode" notification appears
- [ ] Touch doesn't scroll page while drawing
- [ ] Can close pen mode notification
- [ ] Touch scrolling resumes after closing pen mode

**Expected:** Touch drawing without page scroll

---

### 20. Mobile Responsiveness
**Test:** Layout on small screens

- [ ] Toolbar buttons stack/wrap correctly
- [ ] Tool panels position correctly
- [ ] Touch targets are adequate size
- [ ] Page navigation visible and usable
- [ ] Zoom controls accessible

**Expected:** Usable interface on mobile devices

---

## Edge Cases & Error Scenarios

### 21. Empty/Invalid States
- [ ] No PDF loaded → Tools disabled appropriately
- [ ] PDF load failure → Shows error state
- [ ] Invalid page number → Clamps to valid range
- [ ] Empty annotation data → No errors
- [ ] Corrupted annotation data → Graceful handling

### 22. Performance
- [ ] Large PDFs (100+ pages) → Pagination works
- [ ] Many annotations (100+) → Renders smoothly
- [ ] Rapid tool switching → No lag
- [ ] Fast drawing → Strokes render correctly

### 23. Concurrent Editing (if multi-user)
- [ ] Other user adds annotation → Appears in real-time
- [ ] Other user deletes annotation → Disappears
- [ ] Cannot edit others' annotations
- [ ] Save conflicts handled gracefully

---

## Regression Testing After Each Component Extraction

After extracting each component, run this **quick checklist**:

### 🟢 Phase 1: Context + Composables
- [ ] Run Quick Smoke Test
- [ ] Check console for errors
- [ ] Verify state updates correctly

### 🟢 Phase 2: SaveStatusIndicator
- [ ] Test section #2 (Save State Indicator)
- [ ] All states display correctly

### 🟢 Phase 3: PageNavigation
- [ ] Test section #3 (Page Navigation)
- [ ] Navigation works smoothly

### 🟢 Phase 4: ActionButtons
- [ ] Test sections #13, #16, #17 (Fullscreen, Save/Done, Print)
- [ ] All buttons work

### 🟢 Phase 5: ToolButtons
- [ ] Test sections #4-10 (All tools activate correctly)
- [ ] Mode switching works

### 🟢 Phase 6: Tool Panels
- [ ] Test all relevant tool sections
- [ ] Each panel displays and functions correctly

### 🟢 Phase 7: Overlays
- [ ] Test sections #19 (Pen mode notification)
- [ ] Test section #10 (Selection toolbar)

### 🟢 Phase 8: PDFCanvas
- [ ] **CRITICAL:** Run full comprehensive test suite
- [ ] All drawing/interaction works
- [ ] All annotations render correctly

### 🟢 Phase 9: Final Integration
- [ ] Run **FULL** comprehensive test suite
- [ ] Test on multiple devices/browsers
- [ ] Performance testing with large PDFs

---

## Automated Testing (Future)

Consider adding automated tests for:
- Component rendering (Vitest + @testing-library/svelte)
- User interactions (Playwright)
- Visual regression testing (Percy/Chromatic)

---

## Browser Compatibility

Test on:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## Sign-off Checklist

Before considering refactoring complete:

- [ ] All items in comprehensive test suite pass
- [ ] No console errors or warnings
- [ ] Performance is equal or better than before
- [ ] Code is properly typed (no `any` types)
- [ ] All components have proper prop validation
- [ ] Documentation is updated
- [ ] Git commit messages are clear

---

## Troubleshooting Common Issues

### Issue: Annotations not appearing
**Check:**
- Is the object in `allObjects` array?
- Is `stroke_visibility` filtering it out?
- Is the page disabled?
- Is zoom causing it to be off-screen?

### Issue: Tools not activating
**Check:**
- Is page disabled?
- Is `isPageDisabled` true?
- Is `selectedPageIndex` valid?
- Check mode state in context

### Issue: State not updating
**Check:**
- Is context properly initialized?
- Are event handlers bound correctly?
- Is reactivity triggered (using `$state`)?

### Issue: Touch not working
**Check:**
- Is pen mode active?
- Are touch events prevented?
- Is zoom/pan interfering?

---

## Success Criteria

✅ **Refactoring is successful when:**
1. All tests pass
2. No functionality is lost
3. No performance regression
4. Code is more maintainable
5. No breaking changes to parent components

---

## Notes for Testers

- **Take your time:** Thorough testing prevents production bugs
- **Test on real devices:** Simulators don't catch everything
- **Document issues:** Screenshot + steps to reproduce
- **Check browser console:** Errors may be silent to users
- **Test with different PDFs:** Some bugs only appear with specific content

---

## Quick Test Script (Copy-Paste)

```
1. Load PDF → ✅/❌
2. Next/Prev page → ✅/❌
3. Add text → ✅/❌
4. Draw line → ✅/❌
5. Erase → ✅/❌
6. Highlight → ✅/❌
7. Add line → ✅/❌
8. Pointer mode → ✅/❌
9. Selection → ✅/❌
10. Zoom in/out → ✅/❌
11. Undo/Redo → ✅/❌
12. Save → ✅/❌
13. Done → ✅/❌
14. Fullscreen → ✅/❌

All passing? Ship it! 🚀
```
