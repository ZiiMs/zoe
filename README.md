# Zoe

Zoe is a TypeScript monorepo for Path of Exile 2 build intelligence:

- `apps/web`: Next.js website for build summaries and heatmaps.
- `apps/desktop`: Tauri desktop overlay shell.
- `apps/api`: Fastify HTTP API.
- `apps/worker`: background ingestion and aggregation commands.
- `packages/domain`: shared PoE2 build models and analysis logic.
- `packages/db`: Postgres schema and connection helpers.
- `packages/api-client`: typed API client used by UI apps.
- `packages/ui`: shared React UI primitives.
- `packages/config`: shared environment parsing.

## Getting Started

```powershell
bun install
docker compose up -d postgres
bun run dev
```

Useful checks:

```powershell
bun run typecheck
bun run lint
bun run test
```

## Root Commands

Run common workspace tasks from the repository root:

```powershell
bun run dev:api
bun run dev:web
bun run dev:desktop
bun run dev:desktop:renderer
bun run dev:worker

bun run build:api
bun run build:web
bun run build:desktop
bun run build:worker

bun run test:api
bun run test:desktop
bun run test:domain
```

Desktop overlay commands:

```powershell
bun run dev:desktop
bun run dev:desktop:renderer
bun run build:desktop
```

`dev:desktop` runs `@zoe/desktop` through Turbo's `--filter` and launches the full Tauri overlay via the package `dev` script. Use `dev:desktop:renderer` only when you want the Vite renderer without the native shell.

Worker jobs:

```powershell
bun run worker:ingest:poe-ninja
bun run worker:summarize:builds
bun run worker:aggregate:heatmaps
```
