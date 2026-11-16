# Current status

Updated November 16, 2026 (America/New_York).

## Project and preview

- Independent project: `/Users/alexbloom/Documents/GitHub/tesselate-gpt`; branch `dev`; repository https://github.com/AlexBloom/tesselate-gpt.
- Original `../tesselate` and port 5173 remain untouched.
- Preview opened on a new port: http://127.0.0.1:5175/. Restart with `pnpm dev --host 127.0.0.1 --port 5175 --strictPort`; retained session 11889. Previous port 5174 was left running. No production deployment.

## Focused workspace update

- Removed the full-width app header. Logo is in the left dock; editable pattern title and save state are in the canvas header; export is pinned to the lower right, including when the right dock is collapsed.
- Left dock owns tools, layers/objects, dedicated object Transform, path editing and fill/stroke. Size and position remain available while editing points. Right dock owns geometry/background, optional tile effects and pattern placement.
- Layer names become inline inputs on click. Enter/blur commits; Escape cancels. Removed the separate layer-name field.
- Shape dropdown only chooses rectangle, ellipse or polygon placement. No document changes occur until a canvas click. Rectangle/ellipse clicks create a default 100×100 object at the clicked location; polygon clicks open a contextual sides dialog (3–100), with preview, confirm and cancel. Placement uses the inverse source matrix so it also works with active repeat transforms.
- Tile effects now have a master switch and separate Rotation, Mirror and Offset switches, with progressive disclosure. Disabled effects are bypassed in preview/export without losing configured values. Optional flags and title are compatible extensions to schema v3; legacy settings retain their prior appearance.

## Verification

- Build and lint pass; 30 Node tests pass, including disabled effects, independent category flags, legacy inference, export behavior and undo.
- Browser checks on the isolated localhost origin confirmed: selection-only shape menu, exact rectangle placement under transformed coordinates, polygon-only contextual sides/confirmation, size changes during point editing, inline rename commit/cancel, switches hiding controls and changing evaluated artwork, setting restoration after re-enable, title/effect-state reload recovery, object-only controls on the left, and bottom-pinned export in both expanded/collapsed right docks.
- Browser console had no errors/warnings. The user's 127.0.0.1 composition was not edited by QA.

## Future work

Existing shared-edge/Escher design goals remain in PROJECT.md. Constrained edge pairing, Boolean cuts, SVG import, manual Bézier handles, independent artboards, MCP and macOS packaging remain pending. No seamless-tiling guarantee is made for free compositions.

## Neutral interface and production release

- Neutral grayscale interface with stronger control labels, borders, active states and selection handles. Artwork palettes and saved drawing colors are preserved.
- Manual Pages workflow added with lint, geometry tests and production build. Production assets use `/tesselate-gpt/`; local development retains `/`.
- Release authorized November 16, 2026. Deployment verification pending.
