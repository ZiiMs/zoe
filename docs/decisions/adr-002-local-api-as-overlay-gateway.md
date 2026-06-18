---
type: analysis
title: Local API as Overlay Gateway
created: 2026-06-18
tags:
  - adr
  - trade
  - overlay
  - reliability
related:
  - "[[Zoe-System-Overview]]"
  - "[[Zoe-Trade-Flow]]"
---

# ADR 002: Local API as Overlay Gateway

## Status

Accepted.

## Context

The desktop overlay captures item text, parses modifiers, maps trade stats, and
shows price-check results in a latency-sensitive in-game workflow. Official POE2
trade calls require metadata lookup, query construction, result fetching,
normalization, caching, rate limiting, and error formatting.

Putting those concerns directly in the overlay would duplicate server behavior,
make browser-only renderer development harder, and couple UI state to upstream
trade API details.

## Decision

The desktop overlay calls the local Zoe API for trade metadata and price checks
instead of calling official trade APIs directly.

The overlay remains responsible for capture, parsing, filter selection, request
assembly, and rendering. The API owns official trade stats and league metadata,
official search and fetch requests, upstream response normalization, cache
lifetimes, rate limiting, and error shaping.

## Consequences

- The overlay can use the same typed `createZoeApiClient` boundary as the web
  app and avoid embedding upstream trade transport details.
- Official trade behavior is centralized in `apps/api`, where tests can inject
  fetchers and cover success, empty-result, cache, malformed-response, and
  upstream-failure paths.
- The overlay depends on a local API process for full price checks. The
  renderer can still load for UI development, but market searches require the
  gateway to be reachable.
- Future trade API changes should usually be handled in the API and domain
  layers before touching overlay rendering code.

This decision formalizes the runtime boundary described in
[[Zoe-System-Overview]] and the price-check path in [[Zoe-Trade-Flow]].
