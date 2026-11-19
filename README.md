# Tesselate GPT

A web-first vector pattern studio. Edit one source motif and watch its repeated context change immediately. This is the isolated GPT comparison project; `../tesselate` belongs to another agent.

## Run locally

Requires Node.js 24 and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1 --port 5174 --strictPort
pnpm build
pnpm lint
pnpm test
```

Open http://127.0.0.1:5174/. Documents autosave in this browser on this origin. Browser storage is the only document persistence in this first version; export artwork before clearing browser data. Undo history is session-only. Saved single-shape documents are automatically migrated to version 3; the old `tesselate-gpt.document.v1` key is retained as a backup. Version 3 saves layers, objects and repeat settings under `tesselate-gpt.document.v3`; both previous storage keys remain as backups.

## Objects and layers

Layers are containers for multiple objects. Add or rename layers, expand their object lists, hide/lock a whole layer, and move an object to another layer using its inspector dropdown. Visibility and stacking are applied first by layer, then by object. Existing drawings migrate into one layer with all their objects and styles preserved.

Use the **Shape** dropdown to choose a rectangle, ellipse, or polygon tool. Choosing a tool does not create an object: click the canvas to place it. Rectangle and ellipse clicks place a default 100×100 object. A polygon click opens a contextual sides dialog (3–100); confirm or press Enter to place it at that point, or cancel without changing the document. New objects go into the selected visible, unlocked layer. Documents support up to 32 layers and 64 objects.

Object controls live in the left menu. The **Transform** section always provides position, width, height and proportion lock for any selected object, including during point editing. Path editing and fill/stroke have their own sections. Click a layer name to rename it inline; Enter or blur commits, Escape cancels. The pattern title is editable in the canvas header, the logo lives in the left menu, and export is pinned to the bottom of the right sidebar (also when collapsed).

- **Arrow (V):** select and drag objects. Drag the eight bounding-box handles to resize. Hold Shift to preserve proportions; hold Alt to resize from the center. The inspector also provides W/H inputs and a persistent proportion lock.
- **Point editing:** double-click an object with the arrow, or use Direct Selection (A), to edit its points. Drag points, use arrow keys (Shift = 10 units), or enter X/Y coordinates.
- **Pen (P):** click empty space to draw a new closed path. Click its first point or press Enter to finish; Escape cancels. On existing contours, click near an edge to insert a point, drag points to adjust them, or Alt-click a point to remove it (minimum three points). Curves still use automatic handles controlled by Curve softness.
- **Pan (H):** drag the work area. Middle-button drag also pans. Scroll or use zoom controls to zoom; the split preview has independent navigation.

Duplicate an object with ⌘/Ctrl D. Undo with ⌘/Ctrl Z and redo with ⌘/Ctrl Shift Z. Delete removes a selected point in point-edit mode, or an object otherwise. Layer and object operations are undoable.

## Repeat controls

- **Repeat geometry:** grid, half-drop, regular hexagons, or radial sectors. The guide layer shows the corresponding cell geometry; hexagon row spacing derives from cell width.
- **Tile transforms:** optional effects with a master enable switch. Rotation, Mirror and Offset have separate enable switches that reveal their controls. Turning an effect off bypasses it without clearing its settings. Horizontal/vertical reflection, base rotation, and offset act inside each cell. Add a rotation increment by column, row, row + column, or alternating cells. Quick values include 0°, 60°, 90°, and 180°. Local offsets turn with the tile, and alternating mirroring is independently available.
- **Pattern placement:** rotate and translate the whole pattern, including the lattice and guides. Reset all transforms from this panel.

The transform sequence is local reflection → base rotation → local offset → per-cell rotation increment → cell placement → whole-pattern placement. Cell guides exclude artwork-only transforms. Radial sectors use their own sector rotations and reflection pairing.

All visible objects repeat and export using the same evaluated transforms. Export SVG or PNG with custom aspect ratio, dimensions and pattern scale. SVG retains vector paths and reusable instances with explicit crop clipping; PNG is encoded from that SVG. SVG dimensions are limited to 16000 per side, PNG to 8192 per side/32 MP, with bounded instance counts.

## Current boundaries

These are free motif repetitions, not guaranteed gap-free tessellations. There are no paired-edge constraints, Boolean paper cuts, imported SVGs, manually edited Bézier handles, multiple independently configured motifs/artboards, parameter-sweep generation, MCP server or macOS package yet. The export area is a single centered crop; its settings are session-only. See PROJECT.md for later milestones.

## Architecture

`src/core/geometry.ts` evaluates paths, affine transforms, conservative viewport culling, document validation and SVG output independently of React. `src/core/history.ts` groups gestures into undoable changes. `src/App.tsx` contains the editor, canvas interaction and browser export adapter. Thirty Node fixtures test transforms, culling, guide/lattice alignment, layer grouping, migration, resize modifiers, primitive limits, point hit testing, history, optional effect evaluation and SVG output; CI runs them with lint and the build. The canvas and shared motif rendering live in `src/components/Canvas.tsx`; shadcn Collapsible is in `src/components/ui/collapsible.tsx`.

Work on `dev`; promote to `main` by pull request. Production releases require explicit user instruction. No hosting or deployment is configured.

The Collapsible component uses the [official shadcn/ui Radix implementation](https://ui.shadcn.com/r/styles/new-york/collapsible.json), styled for this studio without introducing a separate CSS framework.

Legacy documents without explicit effect switches infer which effects are active, preserving existing artwork. Optional effect flags and the pattern title are backward-compatible fields in schema v3.

## Production

[Open Tesselate](https://alexbloom.github.io/tesselate/) (redirects to the account’s existing `alexbloom.design` Pages domain). Releases are manual from `main` after a green promotion PR from `dev`: `gh workflow run deploy.yml --ref main`. Production asset base: `/tesselate/`.

## Arrange objects and layers

New documents start with a square. Select a primitive and hover over the canvas for a placement outline; click to place it. Existing drawings retain their shapes.

Drag the dotted grips in Layers to reorder layers or objects. Top rows paint in front; the small position numbers increase toward the front. Drag objects onto another unlocked layer to move them there. Right-click objects (in the canvas or panel) or layer rows for Forward, Backward, Send to front, and Send to back. Use Cmd/Ctrl+] or [ to step forward/backward, and add Shift to send to front/back. Select a layer name to use these shortcuts for that layer. All stacking changes support undo.

Collapsed dock icons open control flyouts on hover; click to pin one while editing. Escape, an outside click, or the close button dismisses it. The canvas’s lower-left shortcut badge shows tool hints on hover, focus or tap. New shapes start with white fills and black 1.5px strokes; stroke color can be edited even at zero stroke width.
