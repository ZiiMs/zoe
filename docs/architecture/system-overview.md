---
type: reference
title: Zoe System Overview
created: 2026-06-18
tags:
  - architecture
  - poe2
  - zoe
related:
  - "[[Zoe-Trade-Flow]]"
  - "[[Zoe-Build-Intelligence-Flow]]"
---

# Zoe System Overview

Zoe is a Bun and Turbo TypeScript monorepo for Path of Exile 2 trade checks,
build intelligence, and local overlay workflows. The main runtime boundary is a
local Fastify API that serves both persisted build data and live upstream reads
to the web dashboard and desktop overlay.

## Workspace Boundaries

- `apps/api` owns the Fastify server, CORS policy, trade proxy endpoints,
  poe.ninja build endpoints, database read fallbacks, and fixture fallbacks.
- `apps/desktop` owns the Tauri and Vite React overlay that captures item text,
  parses it with shared domain logic, and calls the local Zoe API for trade
  metadata and price checks.
- `apps/web` owns the Next.js build explorer. It server-loads initial build
  search data, then refreshes client-side through the shared API client as query
  filters change.
- `apps/worker` owns command-style build intelligence jobs for ingesting
  poe.ninja payloads, summarizing builds, aggregating passive heatmaps, and
  persisting fixture intelligence to Postgres.
- `packages/domain` owns shared POE2 types, poe.ninja normalization, build
  summaries, heatmap aggregation, item text parsing, trade stat candidates, and
  official-trade request construction.
- `packages/api-client` owns typed HTTP calls used by UI apps.
- `packages/db` owns Postgres connection helpers, read models, and write helpers
  for build snapshots, summaries, and heatmaps.
- `packages/config` owns environment parsing for API, desktop, and web runtimes.
- `packages/ui` owns reusable React UI primitives used by the web app.

## Runtime Data Sources

The API prefers local Postgres for build searches, build details, summaries, and
heatmaps when a database client is configured and the query returns data. If
database reads fail or return no usable records, the API falls back to live
poe.ninja reads for build search/detail paths and fixture data for summary and
heatmap paths.

Trade pricing is routed through the API rather than directly from the overlay.
The API fetches official trade stats and leagues, caches metadata in memory, rate
limits price checks, posts searches to the official trade endpoint, fetches
listing batches, and normalizes the listing response into Zoe domain types.

## UI Surfaces

The web app focuses on build exploration: league selection, search, filters,
sorting, build rows, class distribution, and top skill/gear summaries. The
desktop app focuses on in-game item price checks: hotkeys, clipboard capture,
modifier toggles, quick listing display, debug state, and a settings panel.

## Reliability Patterns

Zoe favors fixture-first behavior for local development and tests. Worker jobs
default to fixture build payloads. API build and trade tests inject fetchers.
Database access is optional at runtime, so local UI workflows can still render
meaningful fallback data while Postgres or upstream services are unavailable.

See [[Zoe-Trade-Flow]] for the item price-check path and
[[Zoe-Build-Intelligence-Flow]] for ingestion, persistence, and dashboard reads.
