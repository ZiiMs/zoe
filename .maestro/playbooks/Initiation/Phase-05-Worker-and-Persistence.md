# Phase 05: Worker and Persistence

This phase builds Zoe's background intelligence pipeline: ingesting build data, normalizing it, generating summaries and heatmaps, and preparing the database layer for repeatable local storage. It keeps the work fixture-safe first, then makes room for live upstream runs.

## Tasks

- [x] Audit worker and database packages before editing:
  - Review `apps/worker/src/cli.ts`, `apps/worker/src/jobs.ts`, `apps/worker/src/fixture.ts`, `apps/worker/src/jobs.test.ts`, `packages/db/src/index.ts`, `packages/domain/src/normalize.ts`, `packages/domain/src/summarize.ts`, and `packages/domain/src/types.ts`.
  - Search for existing database helpers, environment parsing, worker scripts, and heatmap aggregation before adding new modules.
  - Keep worker jobs runnable without Postgres when operating in fixture mode.
  - Completion note: reviewed the named worker/domain/db files plus `packages/db/migrations/001_initial.sql`, `packages/config/src/index.ts`, `apps/worker/package.json`, root `package.json`, and `turbo.json`. Existing worker jobs are fixture-first and do not require Postgres; CLI currently prints JSON for known jobs and falls through to usage text for unknown jobs. Database code currently exposes only `createPool` and `checkDatabase`; the SQL migration already defines build snapshot, summary, and passive heatmap tables. Existing environment parsing lives in `packages/config`, and passive aggregation lives in `packages/domain/src/summarize.ts`.

- [x] Strengthen worker CLI behavior:
  - Ensure `worker:ingest:poe-ninja`, `worker:summarize:builds`, and `worker:aggregate:heatmaps` produce useful console output and non-zero exits on real failures.
  - Add clear command handling in `apps/worker/src/cli.ts` for known jobs and unknown job names.
  - Avoid long-running daemon behavior unless an existing script already expects it.
  - Completion note: added a testable `apps/worker/src/cli-runner.ts` dispatcher used by `apps/worker/src/cli.ts`. Known worker commands now print a human-readable summary before their JSON payload, unknown commands print usage to stderr and return exit code 1, and thrown job errors return exit code 1. Added `apps/worker/src/cli-runner.test.ts` coverage for known command output, unknown command handling, and job failure handling. Added the missing root `test:worker` script for the documented validation command. Verified `bun run test:worker`, `bun run --filter @zoe/worker typecheck`, `bun run build:worker`, all three root worker scripts, and a direct unknown-command exit-code check.

- [x] Implement fixture-first persistence boundaries:
  - Define or extend `packages/db` helpers for connecting to Postgres, checking health, and storing normalized builds, summaries, and heatmap aggregates.
  - Keep database writes behind explicit worker code paths so tests can use in-memory fixtures and mocks.
  - Do not require Docker or Postgres for unit tests.
  - Completion note: extended `packages/db/src/index.ts` with a generic query-client boundary, health checks, and fixture-safe store helpers for build snapshots, summaries, passive heatmap aggregates, and grouped build intelligence writes. Added `apps/worker/src/jobs.ts` `persistFixtureBuildIntelligence` as the explicit worker persistence path while leaving the default fixture CLI jobs Postgres-free. Added mock-query tests in `packages/db/src/index.test.ts` and `apps/worker/src/jobs.test.ts`; no Docker or live Postgres is required. Verified `bun run --filter @zoe/db test`, `bun run test:worker`, `bun run --filter @zoe/db typecheck`, `bun run --filter @zoe/worker typecheck`, `bun run --filter @zoe/db build`, and `bun run build:worker`.

- [x] Add idempotent storage behavior for build intelligence:
  - Upsert builds by stable metadata ID and league.
  - Upsert summaries by build ID and generated timestamp or source snapshot.
  - Upsert passive and item heatmap aggregates by league and kind.
  - Preserve enough raw source metadata to debug normalization mismatches later.
  - Completion note: updated `packages/db/migrations/001_initial.sql` so build snapshots use `(id, league)`, summaries use `(build_id, build_league, generated_at)`, generic heatmap aggregates use `(league, kind, class_name)`, and source/debug JSONB is retained. Updated `packages/db/src/index.ts` to match those idempotent upsert keys, preserve compact build/source snapshot metadata, and store item heatmap aggregates without requiring passive-point rows. Expanded `packages/db/src/index.test.ts` and adjusted `apps/worker/src/jobs.test.ts` for the additional aggregate upsert. Verified `bun run --filter @zoe/db test`, `bun run test:worker`, `bun run --filter @zoe/db typecheck`, `bun run --filter @zoe/worker typecheck`, `bun run --filter @zoe/db build`, and `bun run build:worker`.

- [x] Add worker tests around ingestion and aggregation:
  - Cover fixture ingestion, summary generation, passive heatmap aggregation, unknown CLI command behavior, and mocked persistence calls.
  - Keep tests deterministic by using fixed timestamps.
  - Mock upstream poe.ninja calls and database calls.
  - Completion note: added optional source/timestamp injection points to `apps/worker/src/jobs.ts` so worker jobs remain fixture-first by default while tests can use mocked poe.ninja payloads and fixed generated timestamps. Expanded `apps/worker/src/jobs.test.ts` to cover deterministic fixture ingestion, mocked upstream normalization, summary generation, passive heatmap aggregation, and mocked persistence query calls. Existing `apps/worker/src/cli-runner.test.ts` continues to cover unknown CLI command behavior and job failure exits. Verified `bun run test:worker`, `bun run --filter @zoe/worker typecheck`, `bun run build:worker`, `bun run test`, and `bun run typecheck`.

- [x] Connect API reads to persisted data only when safe:
  - If the database layer is ready and optional, allow API routes to prefer persisted builds/summaries/heatmaps while falling back to fixtures or live upstream.
  - If persistence is not ready by the end of this phase, leave API behavior unchanged and report the exact remaining boundary.
  - Completion note: added optional `@zoe/db` read helpers for build snapshots, build details, summaries, and heatmap aggregates, then wired `apps/api` to prefer those rows only when a database query client is explicitly provided. Startup keeps persisted reads disabled by default behind `ZOE_API_PERSISTED_READS=1`, so missing Postgres still falls back to live poe.ninja or fixtures. Updated web build source labels for the new `database` source. Added mocked coverage for persisted API reads, fallback-on-db-failure, db read helpers, and env opt-in behavior. Verified `bun run test:api`, `bun run --filter @zoe/db test`, `bun run --filter @zoe/config test`, `bun run --filter @zoe/web test`, `bun run --filter @zoe/db typecheck`, `bun run --filter @zoe/config typecheck`, `bun run --filter @zoe/api typecheck`, `bun run --filter @zoe/web typecheck`, and `bun run build:api`.

- [ ] Run worker and persistence validation and fix failures:
  - `bun run test:worker`
  - `bun run typecheck`
  - `bun run build:worker`
  - Optionally run `docker compose up -d postgres` followed by the worker scripts if local Docker is available; skip gracefully if Docker is unavailable.
