---
type: analysis
title: Fixture First Development
created: 2026-06-18
tags:
  - adr
  - testing
  - reliability
related:
  - "[[Zoe-System-Overview]]"
  - "[[Zoe-Build-Intelligence-Flow]]"
  - "[[Zoe-Trade-Flow]]"
---

# ADR 001: Fixture First Development

## Status

Accepted.

## Context

Zoe depends on upstream Path of Exile 2 data sources, official trade responses,
optional local Postgres state, and desktop capture behavior. Those dependencies
are useful in real workflows but make tests and first-run development fragile if
they are required for every path.

The repository already includes fixture build snapshots, trade parser fixtures,
mocked API fetchers, and worker fixture jobs. The web app and API also expose
fallback behavior when external reads are unavailable.

## Decision

Prefer fixture-backed defaults and injectable fetchers for local development,
tests, and smoke workflows.

Fixture data should stay representative enough to exercise parsing,
normalization, API responses, summary generation, heatmap aggregation, and UI
rendering. Live network and database paths remain part of the product, but they
should be isolated behind explicit runtime configuration or injectable
dependencies so tests can assert behavior without upstream availability.

## Consequences

- Developers can run most validation commands without official service access
  or a populated database.
- API, worker, domain, and UI tests can focus on deterministic behavior and
  mocked failure modes.
- Fixture drift is a real maintenance cost; fixture payloads need updates when
  supported POE2 data shapes, parser coverage, or UI assumptions change.
- Release validation still needs live-path checks because fixture success does
  not prove upstream API compatibility.

This decision supports the reliability patterns in [[Zoe-System-Overview]] and
the ingestion path in [[Zoe-Build-Intelligence-Flow]].
