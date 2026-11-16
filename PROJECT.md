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
- GitHub: independent public repository AlexBloom/tesselate-gpt. GitHub Pages production release authorized November 16, 2026. No custom domain; deployment is manual from main.

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

The new-project workflow covers a starter, build/preview verification, CI configuration and handoff records. Product features above are a subsequent build, as required by the setup skill. Setup is complete. The first interactive product build now implements motif editing, polygon drawing, live repeats, split preview, local saving and single-crop SVG/PNG export. README.md documents the exact limits; later milestones below remain the roadmap.

## Model comparison isolation

Restarted from the original brief on November 14, 2026. This folder is independent of the other agent’s tesselate project. Do not edit or reuse its active working files. Preview uses port 5174.

## Layered editing milestone

Implemented additive shapes with per-layer geometry/style/visibility, whole-shape positioning, duplicate/delete/stacking operations, versioned document migration and multi-shape exports. Guides now match each repeat geometry and hex mode uses a regular lattice. Studio panels use shadcn/ui Collapsible, with independent section expansion and dock icon rails. Constrained edge pairing and multiple independently configured artboards remain future milestones.

## Shared-boundary drawing: Escher reference workflow

The user-supplied fish/bird sketch and process note (November 14, 2026) establish a product goal: help an artist discover interlocking figures while preserving their control over the drawing. Treat the note as a design reference, not as verified historical research.

The central interaction is a shared boundary. Moving an edge to shape one creature immediately changes the neighboring creature's complementary outline. Show both consequences under the pointer, with matching colors on linked edges and clear translation/rotation/reflection arrows. Offer a negative-space view so the neighboring figure is as easy to study as the selected one.

### Intended workflow

1. Choose a supported tile construction and see its polygon, symmetry centers and linked edges. Keep the original construction visible as an optional scaffold.
2. Sketch over the scaffold on a reference layer. The user interprets possible animals or figures; automatic semantic recognition is optional and is not required for the core workflow.
3. Draw or reshape a boundary segment. Generate its linked counterpart through the construction's transform, including correct endpoint order and Bézier handles. One gesture updates the source, immediate neighbors and full repeat, and produces one undo step.
4. Inspect positive and negative shapes together. A two-color view, silhouette view and isolated-neighbor view help reveal the emerging figures. Support multiple tile types sharing boundaries as a later extension; the current free shape layers do not establish a partition of the plane.
5. Validate the construction. Edge correspondence alone does not prove a valid tiling: check endpoint closure, self-intersections, overlaps and gaps using defined tolerances and a sufficient neighbor set. Distinguish valid, invalid and unchecked states. Highlight the implicated region and provide a clear recovery action.
6. Lock the tile silhouette and add interior artwork (eyes, feathers, scales, etc.) in separate layers, optionally clipped to its tile. Boundary construction, interior detail and repeat styling need separate ownership in the document model.
7. Branch experiments into a visual sketchbook. Keep the selected drawing and create bounded deterministic variations of edge profiles, proportions, symmetry-compatible placements and coloring. Let users compare/pin/restore candidates. Show fit status for each; do not silently replace the source or claim a machine recognized an animal.

### Next implementation priority

Implement a constrained translation-tile mode first: four directed edge chains, paired opposite edges and explicit vertex constraints. Preserve the existing free-composition mode and saved documents. Establish a shared-edge graph and construction-specific transforms before extending to triangle/hexagon constructions, rotation, reflection or glide reflection. A polygon shape alone does not determine a valid edge-pairing scheme.

Acceptance: pulling a boundary shows the paired edge and adjacent tile change live; positive/negative space can be inspected; undo restores the whole relationship; invalid contours are identified; preview and SVG export use the same evaluated boundary. Do not label a tile seamless until its construction and contour have passed the relevant checks.

## Object/layer and repeat-transform refinement — November 16, 2026

Layers are containers, with multiple independent objects per layer. Version 3 preserves old drawings as objects in one initial layer. New shapes are created through one compact dropdown with rectangle, ellipse and 3–100-sided polygon options. Arrow selection includes eight resize handles, Shift proportion lock, Alt center scaling, and double-click point editing. The pen can add/move/remove points on existing contours as well as draw new objects.

Separate local tile transforms from whole-pattern placement. Reflection, base rotation and local translation define the tile contents; a progressive rotation can vary by column, row, diagonal or alternating cells. Cell placement follows the selected lattice, then whole-pattern rotation/translation moves the lattice and artwork together. This gives explicit 60° hexagon and 90° block rotation cycles without conflating artwork rotation with guide geometry.

The UI avoids repeated object-count/motif slogans. The hierarchy and inspector labels explain ownership directly. Constrained shared-edge construction from the Escher reference remains a subsequent geometry feature; these transforms do not establish seamless boundaries.

## Focused workspace and placement refinement

The left menu owns the logo and all object-related controls; repeat geometry, pattern background, optional tile effects and pattern placement live on the right. Pattern title sits in the canvas header and export stays at the lower right. Layer names are edited directly inline.

The shape dropdown only chooses a primitive tool. A canvas click supplies the placement position. Rectangle/ellipse tools place a default object; polygon placement asks for sides at the clicked location before committing. Dimensions live in a separate object Transform section and remain accessible during point editing.

Tile effects are opt-in, with a master enable switch and separate Rotation, Mirror and Offset switches. Revealed controls belong to their enabled category; disabling bypasses the effect while preserving values. Legacy documents infer active switches from prior settings so existing artwork does not change. These optional fields and the pattern title remain backward-compatible with schema v3.
