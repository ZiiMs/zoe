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

Install dependencies, then start the services you need from the repository root:

```powershell
bun install
bun run dev
```

Postgres is optional for fixture-backed local development. Start it when you want
persisted build intelligence reads or worker output stored locally:

```powershell
docker compose up -d postgres
```

By default, the API, web app, desktop renderer, and worker commands can run
without a database. Zoe falls back to checked-in fixture build data for local
summaries, heatmaps, build search, and worker jobs when persisted data or
upstream reads are unavailable. Set `ZOE_API_PERSISTED_READS=true` for API reads
from the configured `DATABASE_URL`.

## Local Development

Run all persistent dev tasks:

```powershell
bun run dev
```

Run one surface at a time:

```powershell
bun run dev:api
bun run dev:web
bun run dev:desktop
bun run dev:desktop:renderer
bun run dev:worker
```

Default local URLs:

- API health: http://localhost:4000/health
- API build search: http://localhost:4000/builds
- API summaries: http://localhost:4000/summaries
- API passive heatmap: http://localhost:4000/heatmaps/passives
- Web app: http://localhost:3000
- Desktop renderer without Tauri: http://127.0.0.1:5173

`dev:desktop` launches the full Tauri overlay. Use
`dev:desktop:renderer` for Vite-only overlay work without the native shell.

## Validation

Run repo-wide checks before sharing changes:

```powershell
bun run typecheck
bun run lint
bun run test
bun run build
bun run format:check
```

## Root Commands

Run common workspace tasks from the repository root:

```powershell
bun run build:api
bun run build:web
bun run build:desktop
bun run build:worker

bun run test:api
bun run test:desktop
bun run test:domain
```

Worker jobs:

```powershell
bun run worker:ingest:poe-ninja
bun run worker:summarize:builds
bun run worker:aggregate:heatmaps
```

The worker scripts print JSON or count summaries using fixture data by default,
which makes them safe to run before a local database is populated.

## Architecture Notes

For the fuller system map and tradeoffs, see:

- [System overview](docs/architecture/system-overview.md)
- [Trade flow](docs/architecture/trade-flow.md)
- [Build intelligence flow](docs/architecture/build-intelligence-flow.md)
- [Fixture-first development ADR](docs/decisions/adr-001-fixture-first-development.md)
- [Local API overlay gateway ADR](docs/decisions/adr-002-local-api-as-overlay-gateway.md)
