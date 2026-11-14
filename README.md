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

Open http://127.0.0.1:5174/. Documents autosave in this browser on this origin. Browser storage is the only document persistence in this first version; export artwork before clearing browser data. Undo history is session-only. Saved single-shape documents are automatically migrated to version 2; the old `tesselate-gpt.document.v1` key is retained as a backup. Version 2 saves shapes and repeat configuration under `tesselate-gpt.document.v2`.

## Layered pattern editor

- Build a motif from up to 64 shapes. Preset buttons and the polygon pen add to the composition instead of replacing it. Select a shape on the canvas or in Layers; drag its body to move it, or enter its position numerically.
- Each shape has its own fill, outline, curve softness and visibility. Rename layers, duplicate/delete them, and bring them forward or send them backward. Hidden layers are excluded from repetitions and exports.
- Switch to Nodes (A), or double-click a shape, to edit its contour. Drag nodes, nudge with arrow keys (Shift = 10 units), or enter X/Y coordinates. Add a node after the selection; remove nodes down to a minimum of three.
- Use the polygon pen to place points. Close using the first point, Enter, or Finish contour. Escape cancels; Undo removes the last draft point. Curve softness converts the closed contour into cubic Bézier segments with automatic handles.
- Explore rectangular, half-drop, regular hexagon, or radial layouts. The guides match the actual repeat cells: rectangles, parallelograms, hexagons, or radial sectors. Hexagon mode uses one cell-width control with the correct derived row spacing; the other modes retain independent horizontal/vertical spacing. Motif rotation rotates the composition within lattice cells. Radial mode includes an additive snowflake wedge starter.
- Toggle the independent geometry guide layer in Layers or the inspector. Guides are excluded from exports.
- Inspector sections use the shadcn/ui Radix Collapsible component. Collapse individual sections or either whole dock into an icon rail; rail icons reopen their corresponding sections.
- Toggle Split preview for another view of the same document, with independent pan and zoom. Use the Hand tool or middle-button drag to pan the main canvas; scroll or use the zoom controls to zoom.
- Choose colors, outlines and six deterministic palettes. No language model, account or backend is involved.
- Export SVG or PNG with arbitrary aspect ratio, dimensions and pattern scale. SVG contains one reusable vector path, transformed instances and explicit artboard clipping; PNG is rendered from that same SVG. SVG dimensions are limited to 16000 per side, PNG to 8192 per side/32 MP, with bounded instance counts.

Keyboard: V = move shapes, A = edit nodes, P = polygon pen, H = pan, ⌘/Ctrl D = duplicate shape, ⌘/Ctrl Z = undo, ⌘/Ctrl Shift Z = redo. Delete removes the selected node in node-edit mode, or the selected shape otherwise.

## Current boundaries

These are free motif repetitions, not guaranteed gap-free tessellations. There are no paired-edge constraints, Boolean paper cuts, imported SVGs, manually edited Bézier handles, multiple independently configured motifs/artboards, parameter-sweep generation, MCP server or macOS package yet. The export area is a single centered crop; its settings are session-only. See PROJECT.md for later milestones.

## Architecture

`src/core/geometry.ts` evaluates paths, affine transforms, conservative viewport culling, document validation and SVG output independently of React. `src/core/history.ts` groups gestures into undoable changes. `src/App.tsx` contains the editor, canvas interaction and browser export adapter. Fourteen Node fixtures test transforms, culling, guide/lattice alignment, layer isolation and history, migration, validation and multi-shape SVG output; CI runs them with lint and the build. The canvas and shared motif rendering live in `src/components/Canvas.tsx`; shadcn Collapsible is in `src/components/ui/collapsible.tsx`.

Work on `dev`; promote to `main` by pull request. Production releases require explicit user instruction. No hosting or deployment is configured.

The Collapsible component uses the [official shadcn/ui Radix implementation](https://ui.shadcn.com/r/styles/new-york/collapsible.json), styled for this studio without introducing a separate CSS framework.
