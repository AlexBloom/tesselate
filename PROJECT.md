# Tesselate GPT

A vector pattern studio for rapidly exploring and refining motifs through live geometric repetition.

## Product brief

Web first, with a future macOS package. Draw or import one vector motif and see every edit propagate through a repeat. The primary view is a focused motif surrounded by a live pattern, like a bullseye; an optional split pane shows the complete pattern independently. A folded wedge and its unfolded snowflake are another expression of the same workflow.

Support translation, rotation, reflection, rectangular grids, triangle and hexagon arrangements. Provide core pen, node editing and drawing tools, multiple artboards, independently scaled pattern fills, and PNG and production-quality SVG export at arbitrary dimensions and aspect ratios.

Deterministic generation must work without language models or usage credits. Let users vary translation, rotation, scale and color over a specified number of versions. Optional agent access should expose document operations through MCP without making the editor depend on an agent service.

## Proposed stack

- React, TypeScript and Vite; pnpm. Confirmed by user.
- Pure TypeScript geometry and document commands, independent of React and browser APIs.
- SVG for initial editable vectors and preview. Consider a separate accelerated preview renderer only after profiling.
- Browser-local documents initially. No account or backend required for core editing.
- Investigate Tauri for macOS packaging after the web interaction is validated.
- GitHub: independent public repository AlexBloom/tesselate-gpt. Local preview first; no hosting or domain yet. No production release is authorized.

## Geometry and interaction model

Keep the source motif, repeat definition, artboards and generated instances separate. An instance references a motif and an affine transform; it is not an independently edited copy. Store source coordinates without rounding them to screen pixels. Use the same transform evaluation for previews and exports.

Distinguish arbitrary motif repetition from a seamless tile. Translating or rotating a freeform shape does not guarantee gap-free tessellation. A constrained mode must pair tile edges and propagate edits through their corresponding transforms. Begin with paired opposite edges for translation, then explicitly model triangle and hexagon adjacency. Do not present an unconstrained motif as a proven seamless tile.

Represent cuts in a snowflake wedge as vector paths and Boolean operations, reflected/rotated around the center. Define supported path operations and numeric tolerance before selecting a Boolean geometry library.

The focused canvas shows a strong source motif and subdued surrounding instances. Make boundary crossings and paired-edge consequences visible during pointer movement. The optional split pane shares document state but has independent pan and zoom. Suggestions begin as geometry-derived overlays: edge partners, repeat offsets, overlap/gap indicators where computable, and ghost transformations. Avoid implying semantic recognition of animals or artwork without an optional model.

## First-build sequence

1. **Interaction proof:** editable closed motif, node dragging, undo/redo, pan/zoom, rectangular repeat, live bullseye context and optional split preview. Provide clear source/instance styling.
2. **Repeat engine:** translation, rotation and reflection, then triangle/hexagon presets with explicit edge constraints. Add wedge editing and unfolded snowflake preview.
3. **Drawing:** cubic Bézier pen, node handles, insertion/deletion, open/closed paths, fill/stroke, snapping, selection and SVG import with a documented supported subset. Reject scripts and external resources; preserve editable vectors.
4. **Documents and production output:** multiple artboards, dimensions and pattern transforms; local save/load; autosave/recovery; SVG and PNG export with explicit crop, background, units and output dimensions. Avoid rasterizing vector artwork inside SVG.
5. **Deterministic variations:** seeded parameter sweeps, requested version counts, palette variations, thumbnail comparison and promote-a-variant actions. Cap work and allow cancellation.
6. **Automation and desktop:** expose the same validated, undoable document commands through an optional MCP adapter. Agent actions should be inspectable and use no different geometry engine. Add a macOS shell only after the web editor is stable.

## Acceptance criteria for the interaction proof

- Dragging a source node updates all visible instances without a separate Apply step.
- Editing, undo and redo restore both source and repeated views consistently.
- Preview density stays bounded by viewport culling.
- Changing repeat spacing or angle does not change source path geometry.
- Split preview and focused canvas render the same repeat definition.
- Keyboard users can select nodes and adjust coordinates numerically.

## Export quality gates for the export milestone

- SVG uses a correct namespace, viewBox, explicit artboard bounds, resolvable local definitions and deterministic IDs.
- No editor UI, guides, scripts, remote resources or unintended raster replacements enter exports.
- Transformed bounds, clipping, stroke scaling, negative coordinates, transparency and seams have fixture coverage.
- PNG uses requested pixel dimensions independently of preview zoom; oversized requests show a practical limit.
- Imported SVG behavior, fonts and unsupported effects are documented rather than silently changed.

## Setup scope

The new-project workflow covers a starter, build/preview verification, CI configuration and handoff records. Product features above are a subsequent build, as required by the setup skill. No product functionality has been implemented yet.

## Model comparison isolation

Restarted from the original brief on November 14, 2026. This folder is independent of the other agent’s tesselate project. Do not edit or reuse its active working files. Preview uses port 5174.
