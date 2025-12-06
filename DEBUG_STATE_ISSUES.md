# Debugging State Synchronization Issues

## Problem Description
When rapidly switching between editing properties (appearance panel) and clicking on the canvas, the application sometimes gets "stuck":
- Property panel won't appear
- Can't select shapes
- Requires page refresh to recover

## Root Cause Analysis
The issue stems from state synchronization between:
1. **React State** (shapes array managed by Immer in useEditorState)
2. **Konva Nodes** (imperative canvas objects in nodeMapRef)
3. **Transformer State** (selection handles managed by Konva.Transformer)

When properties are updated:
- Immer creates a NEW shapes array (immutable update)
- The nodeMapRef still has Konva nodes pointing to OLD shape data
- Event listeners on nodes may have stale closures
- Transformer may be attached to detached/destroyed nodes

## Fixes Implemented (Latest Commit)

### 1. Comprehensive Error Handling
- Added try-catch blocks around ALL node operations
- Safe cleanup for destroyed/invalid nodes
- Validation before every node operation

### 2. Node Health Validation
```typescript
// Before reusing a node, check if it's still valid
const nodeIsValid = existingNode && existingNode.getLayer();
```

### 3. Transformer State Management
- Added `transformer.detach()` at start of render cycle
- Revalidate transformer attachment in selection effect
- Automatic reattachment if detached

### 4. Emergency State Reset
- Detects render loops (>10 consecutive renders within 100ms)
- Automatically clears node map and resets transformer
- Prevents infinite stuck states

### 5. Diagnostic Logging
- `updateShape` logs every property update
- Selection effect logs node map state
- Console warnings for all recovery actions

## How to Debug When Issue Occurs

### Step 1: Open Browser Console
Press F12 and check the Console tab.

### Step 2: Reproduce the Issue
1. Select a shape
2. Edit a property (color, stroke, etc.) in Appearance Panel
3. Click on canvas
4. Edit another property
5. Click on canvas again
6. Repeat until it gets stuck

### Step 3: Check Console Logs
Look for these patterns:

**Normal Operation:**
```
updateShape called: shape-123 {fill: "#ff0000"}
Selection effect triggered: {selectedIds: [...], nodeMapSize: 5, transformerAttached: "yes"}
```

**Warning Signs:**
```
Failed to update node properties, recreating: [error]
Error selecting node shape-123: [error]
Transformer detached from layer, reattaching
```

**Critical Issues:**
```
EMERGENCY: Detected render loop, clearing node map
Critical error rendering shape: shape-123
```

### Step 4: Manual Recovery (Without Page Refresh)
If stuck, open browser console and run:
```javascript
// Emergency reset - clears all Konva state
window.location.hash = 'reset-canvas'
```

## Known Edge Cases

### 1. Multiple Fills/Strokes
When shapes have multiple fills or strokes, we MUST recreate the node (can't just update properties). This triggers more destroy/create cycles.

### 2. Rapid Property Changes
If properties change faster than render cycle (16ms), updates queue up and can cause race conditions.

### 3. Gradient Editing
Gradient controls create additional Konva nodes that need to stay in sync with transformer state.

## Next Steps If Issue Persists

### Option A: Add State Snapshots
Store a snapshot of shapes array reference and invalidate entire node map when reference changes:
```typescript
const shapesRefPrev = useRef(shapes);
if (shapesRefPrev.current !== shapes) {
  // Reference changed, clear entire map
  nodeMapRef.current.clear();
}
```

### Option B: Separate Selection State
Move selectedIds out of Immer state into separate useState to prevent coupling:
```typescript
const [localSelectedIds, setLocalSelectedIds] = useState<string[]>([]);
```

### Option C: Switch to react-konva
Use react-konva library which handles React↔Konva synchronization automatically (but requires major refactor).

### Option D: Debounce Property Updates
Add debouncing to updateShape calls to batch rapid changes:
```typescript
const debouncedUpdate = useMemo(
  () => debounce(updateShape, 50),
  [updateShape]
);
```

## Testing Checklist
- [ ] Click shape → Edit fill → Click canvas → Edit stroke → Click canvas (5x rapid)
- [ ] Select multiple shapes → Edit properties → Click canvas
- [ ] Edit gradient stops → Click canvas → Edit more stops
- [ ] Drag shape → Edit properties immediately after drag ends
- [ ] Zoom/pan → Select shape → Edit properties

## Contact
If you encounter the stuck state issue:
1. Save console logs
2. Note exact sequence of actions
3. Check if emergency reset was triggered
4. Report with steps to reproduce
