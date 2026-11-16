# Agent guidance

Read PROJECT.md and STATUS.md first. This is a React + TypeScript + Vite vector pattern editor. The first interactive editor is implemented; read README.md for supported workflows and limitations.

## Commands

- Install: `pnpm install --frozen-lockfile`
- Run: `pnpm dev --host 127.0.0.1 --port 5174`
- Build/typecheck: `pnpm build`
- Lint: `pnpm lint`
- Test: `pnpm test` (Node geometry, export and history fixtures).

## Layout

- `src/`: React frontend and styling.
- `src/core/`: UI-independent geometry, multi-shape document operations, migration and history.
- `src/components/`: Canvas, shared controls and shadcn/ui Collapsible.
- `tests/`: Node fixtures for transforms, culling, export and history.
- `PROJECT.md`: product requirements, geometry architecture and milestone acceptance criteria.
- `.github/workflows/ci.yml`: frozen dependency install, lint and production build.
- `dist/`: generated output, ignored by Git.

No environment variables or external services are required. Never commit secrets.

## Workflow

Work on `dev` or a short-lived branch from it. Promote to `main` only through a pull request. Never release to production unless the user explicitly asks. No deploy command is configured. Keep CI passing, preserve user changes, and update STATUS.md when infrastructure changes.

Keep geometry and document commands independent of the UI. Use the same transform engine for preview, export and eventual MCP operations. Do not label arbitrary repeated motifs as guaranteed seamless tessellations.

This is the isolated GPT comparison project. Do not modify ../tesselate or stop its preview.

The document schema is version 3: `layers[]` are containers and each object in `shapes[]` references a `layerId`. Keep migrations from v1/v2 and retain the old browser storage keys as backups. Render/export objects by layer order and then object order. A layer's visibility hides all its objects; locking blocks editing without hiding artwork. Keep shape creation additive into the selected layer.

`src/core/objects.ts` owns primitive creation, point hit testing and resize math. The arrow tool resizes objects; Shift locks proportions and Alt resizes from the center. Pen clicks near edges insert points and Alt-click removes them. Keep each gesture as one undo step.

Repeat transforms have separate cell and content matrices. Base content reflection/rotation/offset precede repetition; per-cell rotation increments vary by row/column/diagonal/checkerboard. Whole-pattern placement rotates/translates the lattice and its guides together. Preview, pointer-coordinate inversion and SVG export must evaluate the same transform pipeline. Hexagon pitch derives from cell width.

UI ownership: the left dock owns tools, objects/layers, object Transform, path editing and fill/stroke. The right dock owns repeat geometry/background, optional tile effects and pattern placement. Export is pinned to its bottom; pattern title is in the canvas header. Layer names edit inline.

Shape menu selections arm a placement tool without modifying the document. Canvas clicks place rectangles/ellipses; polygon clicks open a contextual side-count dialog, which commits only on confirmation. Keep object size controls available during point editing. Optional `tileOptions` and `title` fields extend schema v3 compatibly. Use `tileOptions()` / `effectiveTile()` so disabling effects bypasses their transforms without discarding their values, and legacy artwork keeps its appearance. Materialize inferred effect flags before changing legacy effect values so zeroing a slider does not close its controls.
