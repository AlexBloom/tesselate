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
- `src/core/`: UI-independent geometry and history.
- `tests/`: Node fixtures for transforms, culling, export and history.
- `PROJECT.md`: product requirements, geometry architecture and milestone acceptance criteria.
- `.github/workflows/ci.yml`: frozen dependency install, lint and production build.
- `dist/`: generated output, ignored by Git.

No environment variables or external services are required. Never commit secrets.

## Workflow

Work on `dev` or a short-lived branch from it. Promote to `main` only through a pull request. Never release to production unless the user explicitly asks. No deploy command is configured. Keep CI passing, preserve user changes, and update STATUS.md when infrastructure changes.

Keep geometry and document commands independent of the UI. Use the same transform engine for preview, export and eventual MCP operations. Do not label arbitrary repeated motifs as guaranteed seamless tessellations.

This is the isolated GPT comparison project. Do not modify ../tesselate or stop its preview.
