# Roadmap to Premium: Architectural Upgrades

This document outlines the architectural changes required to elevate X-IDE to a professional-grade vector editing software, comparable to industry standards like Adobe Illustrator.

## 1. Robust Vector Engine (Path Parsing)
**Current State:** The application uses a naive regex split that only supports absolute `M`, `L`, `C`, `Z` commands. It fails on relative commands (`l`, `c`), shortcuts (`H`, `V`), and arcs (`A`), rendering most imported SVGs incorrectly.
**Goal:** Implement a spec-compliant SVG path parser.
**Strategy:**
-   Integrate a robust path parsing library (e.g., `svg-path-parser` or a custom robust implementation).
-   Normalize all path commands to absolute Cubic Beziers for easier editing and rendering.
-   Ensure full support for `M, L, H, V, C, S, Q, T, A, Z` (both absolute and relative).

## 2. Matrix-Based Transform System
**Current State:** Shapes use separate `x`, `y`, `rotation`, `scaleX`, `scaleY` properties. This prevents complex transformations like skewing/shearing and makes nested group transformations difficult to calculate correctly.
**Goal:** Adopt a 2x3 Affine Transformation Matrix model `[a, b, c, d, tx, ty]`.
**Strategy:**
-   Update `Shape` interface to include a `transform` matrix property.
-   Implement matrix math utilities (multiply, invert, decompose).
-   Update the Renderer (`KonvaCanvas`) to apply matrices directly.
-   Update the Properties Panel to decompose matrices into user-friendly values (Rotation, Position) for editing.

## 3. Delta-Based History System (Performance)
**Current State:** The Undo/Redo system stores a full deep copy of the entire document state for every action. This leads to $O(N)$ memory usage per action, causing crashes with large files or long sessions.
**Goal:** Implement a Patch/Delta system.
**Strategy:**
-   Refactor `useEditorState` to track *changes* (patches) rather than snapshots.
-   Store `forward` (do) and `backward` (undo) patches.
-   Example: Instead of saving the whole shape list, save `{ op: 'update', id: 'rect-1', prop: 'x', old: 10, new: 20 }`.

## 4. Spatial Indexing (Rendering Performance)
**Current State:** Hit-testing and rendering loops iterate through the entire shape array $O(N)$. This causes UI lag when the document contains thousands of objects.
**Goal:** Implement a Spatial Index (Quadtree).
**Strategy:**
-   Implement a `Quadtree` data structure.
-   Insert all shapes into the Quadtree based on their bounding boxes.
-   Query the Quadtree for "shapes under cursor" or "shapes in viewport" to minimize processing.

---

## Execution Plan
1.  **Fix Vector Engine**: Immediate priority to ensure imported assets render correctly.
2.  **Refactor History**: High priority to prevent memory leaks.
3.  **Matrix Transforms**: High priority for feature completeness.
4.  **Spatial Index**: Optimization priority for scalability.
