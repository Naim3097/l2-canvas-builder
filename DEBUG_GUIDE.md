# Debugging & Stability Guide

## Recent Fixes (Dec 6, 2025)

### 1. Color & Gradient Updates
**Issue:** Changing colors or gradients caused visual glitches or no updates.
**Fix:** Updated `updateNodeProperties` in `KonvaCanvas.tsx` to correctly handle:
- Linear and Radial Gradients
- Stroke properties (width, color, dash, cap, join)
- Fill visibility toggles
- Return `false` if update fails, triggering a safe node recreation.

### 2. State Synchronization ("Stuck State")
**Issue:** Rapid editing caused the selection state to desync, making the app unresponsive to clicks.
**Fix:**
- Added `resetStateTrigger` plumbing to force a complete canvas reset.
- Added "Reset State" button in the Toolbar (next to Reset View).
- Improved error handling in `useEffect` hooks to catch and log errors without crashing the render loop.
- Added `transformer.detach()` to ensure clean state between renders.

### 3. Selection Logic
**Issue:** `CanvasArea` was receiving `onSelect` but `KonvaCanvas` expected `onSelectionChange`.
**Fix:** Verified that `page.tsx` correctly passes `onSelectionChange`. (Note: `CanvasArea` acts as a pass-through).

## How to Debug "Stuck" States

If the application gets stuck again:

1.  **Check Console Logs:** Look for "Emergency: Detected render loop" or "Critical error in selection effect".
2.  **Use "Reset State":** Click the new "Reset State" button in the top toolbar. This clears the internal node map and forces a fresh render from the React state.
3.  **Verify `selectedIds`:** In the React DevTools, check if `selectedIds` in `Workspace` component matches what you see on screen.
4.  **Check Transformer:** If selection box is missing but item is selected, the transformer might be detached. The "Reset State" button fixes this.

## Key Files Modified

-   `src/components/KonvaCanvas.tsx`: Core rendering logic, reconciliation, and error handling.
-   `src/components/Toolbar.tsx`: Added Reset State button.
-   `src/app/page.tsx`: State plumbing for reset trigger.
-   `src/components/CanvasArea.tsx`: Prop plumbing.

## Future Improvements

-   **Debounce Color Inputs:** The color picker fires `onChange` very rapidly. Debouncing this in `AppearancePanel` would reduce load on the canvas.
-   **Strict Type Checking:** Ensure `CanvasArea` props strictly match `KonvaCanvas` to avoid prop mismatch confusion.
