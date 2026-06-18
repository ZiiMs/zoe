---
type: reference
title: Zoe Build Intelligence Flow
created: 2026-06-18
tags:
  - architecture
  - poe2
  - zoe
  - builds
related:
  - "[[Zoe-System-Overview]]"
---

# Zoe Build Intelligence Flow

Zoe's build intelligence flow converts poe.ninja build data into normalized
snapshots, summaries, heatmaps, API responses, and web dashboard views. It is
implemented across the worker, domain, database, API, API client, and Next.js
web app.

## poe.ninja Ingestion

`apps/worker` exposes job functions for ingesting poe.ninja payloads. The
default ingestion path uses fixture data so jobs and tests run without network
access. Callers can inject a custom `fetchBuilds` function to provide live or
test payloads.

`normalizePoeNinjaBuild` in `packages/domain` converts raw payloads into
`BuildSnapshot` records. It normalizes character metadata, class and ascendancy,
level, league, rank, main skills, gear, passive points, metrics, capture time,
and source.

## Normalization Outputs

Normalized build snapshots are the shared record type for the API, database,
worker summaries, heatmap aggregation, and web rendering. Skills are sorted by
usage count, items are normalized by slot/name/base type/rarity, and passives are
reduced to passive IDs, optional names, coordinates, and weights.

The API also contains live poe.ninja readers for build search and build detail.
Search responses decode poe.ninja protobuf payloads, load dictionary data,
normalize build rows into the same domain snapshot shape, and normalize filter
groups for classes, keystones, skills, supports, and gear.

## Summaries

`summarizeBuild` creates a concise `BuildSummary` for each snapshot. It records a
summary ID, build ID, title, primary skill, highlights, inferred defensive
layers, and generation time. Defensive layers are inferred from known item text
signals such as shield, armour, plate, evasion, and leather.

The API serves summaries from Postgres when available. Without persisted
summaries, `/summaries` returns fixture summaries.

## Heatmaps

`aggregatePassiveHeatmap` combines normalized passive points across builds into
a league-level passive heatmap. Points with the same passive ID are merged and
their weights summed, then sorted by descending weight.

The worker can aggregate heatmaps directly from provided builds or from an
ingestion run. The database package stores both the complete heatmap aggregate
payload and individual passive heatmap point rows for query-friendly access.

## Persistence

`packages/db` stores build snapshots, summaries, and heatmaps in Postgres.
Snapshots are upserted by build ID and league; summaries are upserted by build,
league, and generation time; heatmap aggregates are upserted by league, kind,
and class bucket.

`persistFixtureBuildIntelligence` in the worker runs the fixture ingestion,
summary generation, passive heatmap aggregation, and `storeBuildIntelligence`
write path as a local persistence workflow.

## API Reads

`apps/api` exposes `/builds`, `/builds/:id`, `/summaries`,
`/heatmaps/passives`, and `/heatmaps/items`. Build search reads from Postgres
when configured, applies in-process filters and sorting, and enriches the
response with league metadata. If persisted build data is unavailable, the API
falls back to live poe.ninja search and then fixtures if upstream reads fail.

Build detail reads from Postgres first and turns a snapshot into a detail shape.
If no persisted detail exists, the API fetches live poe.ninja character detail
and falls back to fixture detail where possible.

## Web Rendering

`apps/web` uses `createZoeApiClient` to load build search data from the API.
The home page server-loads initial data from query parameters. The client build
explorer then refreshes data as filters, search, league, sort, and order change.

The dashboard renders source status, league statistics, filter groups, build
rows, primary skill and defensive metrics, gear chips, freshness, class
distribution, and top skill/support/gear summaries. If the API is unreachable
during the initial load, the page renders an offline fixture-shaped response so
the UI remains stable.

This flow is the build-data counterpart to [[Zoe-Trade-Flow]] and shares the
runtime boundaries documented in [[Zoe-System-Overview]].
