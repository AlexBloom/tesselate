# Tesselate GPT

A web-first vector pattern studio for exploring motifs through geometric repetition.

This repository currently contains a verified React/TypeScript/Vite **starter**, not the drawing application. See [PROJECT.md](PROJECT.md) for the product specification and first-build sequence, and [STATUS.md](STATUS.md) for setup verification.

## Development

Requires Node.js 24 and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1 --port 5174
pnpm build
pnpm lint
```

Work on `dev`; promote to `main` by pull request. Production releases require explicit user instruction. No hosting or deployment has been configured.
