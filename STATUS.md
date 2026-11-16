# Current status

Updated November 16, 2026 (America/New_York).

## Project and preview

- Independent project: `/Users/alexbloom/Documents/GitHub/tesselate-gpt`; branch `dev`; repository https://github.com/AlexBloom/tesselate-gpt.
- Original `../tesselate` and port 5173 were not modified.
- Preview restarted at http://127.0.0.1:5174/. Command: `pnpm dev --host 127.0.0.1 --port 5174 --strictPort`; retained terminal session 6726. No production deployment or hosting changes.

## Object/layer update

- Schema v3 introduces real `layers[]` containers and `shape.layerId` membership. Multiple objects can occupy each layer; visibility, locking, renaming, reordering and deletion apply at the layer level. Objects retain independent geometry/style/visibility and can move between layers.
- Migrates v1/v2 documents into one initial layer with their objects preserved, including previous grid/radial transform behavior. Saves to a new v3 browser key and retains old keys as backups.
- Simplified creation to a Shape dropdown: rectangle/square, ellipse/circle, polygon with 3–100 sides and width/height controls.
- Arrow tool has eight resize handles, Shift proportional resizing, Alt center resizing, inspector W/H and optional proportion lock. Arrow double-click opens point editing. Pen supports contour insertion, point dragging and Alt-click removal, in addition to new paths. Gestures use one undo step.
- Tile-content controls provide pre-repeat reflection, rotation and offset, with configurable rotation increments by column/row/diagonal/alternating cells and 60°/90° shortcuts. Whole-pattern angle/translation separately moves lattice and guides. Preview, source coordinate inversion and export share these matrices.
- Removed motif/count slogans from the application.

## Validation

- Build, lint and 26 tests pass. Tests cover migrations, multiple objects per layer, visibility/locking and stacking, transfer/deletion with undo, primitive limits, modifier resize math, pen contour hit testing, matrix ordering, culling, guide alignment and SVG consistency.
- Browser QA ran on localhost origin, preserving the user's 127.0.0.1 composition. Verified grouped objects, transfer between layers, hide/lock behavior, free/proportional handle resize and undo, polygon with 100 points, pen insertion/Alt removal, arrow double-click and point dragging, combined tile transforms, whole-pattern placement, split consistency, PNG encoding and reload recovery. No browser console warnings/errors.
- Existing Escher/shared-boundary design notes remain in PROJECT.md. Constrained edge pairing, Boolean cuts, SVG import, manual Bézier handles, independent artboards, MCP and macOS packaging remain future work.
