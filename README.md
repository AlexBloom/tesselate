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

Open http://127.0.0.1:5174/. Documents autosave in this browser on this origin. Browser storage is the only document persistence in this first version; export artwork before clearing browser data. Undo history is session-only.

## First editor build

- Drag motif nodes, use arrow keys to nudge (Shift = 10 units), or enter X/Y coordinates. Add a node after the selection; remove nodes down to a minimum of three.
- Use the polygon pen to place points. Close using the first point, Enter, or Finish contour. Escape cancels; Undo removes the last draft point. Curve softness converts the closed contour into cubic Bézier segments with automatic handles.
- Explore rectangular, staggered, hexagonal-center lattice, or radial layouts. Adjust spacing, motif rotation and alternating reflection. The radial mode includes a snowflake wedge starter.
- Toggle Split preview for another view of the same document, with independent pan and zoom. Use the Hand tool or middle-button drag to pan the main canvas; scroll or use the zoom controls to zoom.
- Choose colors, outlines and six deterministic palettes. No language model, account or backend is involved.
- Export SVG or PNG with arbitrary aspect ratio, dimensions and pattern scale. SVG contains one reusable vector path, transformed instances and explicit artboard clipping; PNG is rendered from that same SVG. SVG dimensions are limited to 16000 per side, PNG to 8192 per side/32 MP, with bounded instance counts.

Keyboard: V = nodes, P = polygon pen, H = pan, ⌘/Ctrl Z = undo, ⌘/Ctrl Shift Z = redo, Delete = remove selected node.

## Current boundaries

These are free motif repetitions, not guaranteed gap-free tessellations. There are no paired-edge constraints, Boolean paper cuts, imported SVGs, manually edited Bézier handles, multiple motifs/artboards, parameter-sweep generation, MCP server or macOS package yet. The export area is a single centered crop; its settings are session-only. See PROJECT.md for later milestones.

## Architecture

`src/core/geometry.ts` evaluates paths, affine transforms, conservative viewport culling, document validation and SVG output independently of React. `src/core/history.ts` groups gestures into undoable changes. `src/App.tsx` contains the editor, canvas interaction and browser export adapter. Nine Node fixtures test transforms, culling, radial reflection, SVG output, validation and gesture history; CI runs them with lint and the build.

Work on `dev`; promote to `main` by pull request. Production releases require explicit user instruction. No hosting or deployment is configured.
