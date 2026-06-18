# Phase 03: API Reliability

This phase hardens the Fastify API as the stable bridge between Zoe clients and upstream PoE services. It adds resilience, consistent response shapes, caching behavior, and diagnostics so both the web app and desktop overlay can depend on the API during live play.

## Tasks

- [x] Audit current API routes and upstream adapters before editing:
  - Review `apps/api/src/server.ts`, `apps/api/src/poe-ninja.ts`, `apps/api/src/trade.ts`, `apps/api/src/fixtures.ts`, `packages/api-client/src/index.ts`, and `packages/config/src/index.ts`.
  - Search for existing error handling, cache reset helpers, fixture fallbacks, and typed client methods before adding new helpers.
  - Preserve existing route paths unless a test proves a path is broken.
  - Notes:
    - `apps/api/src/server.ts` defines the active public API surface: `/health`, `/builds`, `/builds/:id`, `/poe-ninja/build-index`, `/poe-ninja/leagues`, `/summaries`, `/heatmaps/passives`, `/heatmaps/items`, `/trade/stats`, `/trade/leagues`, and `/trade/price-check`; preserve these paths for client compatibility.
    - CORS is currently handled by an `onRequest` hook with wildcard origin, `Content-Type, Accept` headers, and `GET, POST, OPTIONS`; request logging is globally enabled with `logger: true`.
    - Only `/builds/:id` and `/trade/price-check` currently format route errors as `{ error: string }`; `/trade/stats` and `/trade/leagues` allow upstream exceptions to flow through Fastify's default error response.
    - `apps/api/src/poe-ninja.ts` already falls back to fixtures for build index, leagues, build search, and build detail; it also has dictionary and passive tree caches, but no exported cache reset helper for tests.
    - `apps/api/src/trade.ts` already has stats and league TTL caches, a `__tradeInternals.resetCaches()` helper, rate limiting for price checks, stat ID resolution, batched fetches of 10 listing IDs, online-only default behavior, and `safeResponseText()` for upstream failures.
    - Trade debug logging currently uses repeated `console.info()` calls on successful price-check hot paths, which should be consolidated or gated in the logging task.
    - `apps/api/src/fixtures.ts` has three build fixtures plus summaries and passive heatmap coverage; item heatmap remains an empty route-level fixture.
    - `packages/api-client/src/index.ts` already covers health, builds, build detail, poe.ninja metadata, summaries, heatmaps, trade metadata, and price check; it preserves a helpful unreachable-API message and serializes build query parameters with `URLSearchParams`.
    - `packages/config/src/index.ts` validates `DATABASE_URL`, `API_HOST`, `API_PORT`, and `POE_NINJA_BASE_URL`; the current poe.ninja adapter uses hardcoded upstream URLs rather than this config value.
    - Current tests in `apps/api/src/server.test.ts` cover health, fixture build fallback, build query parsing, fixture detail fallback, summaries/heatmaps, normalized build index, league metadata, protobuf decode, trade stats caching, price-check search/fetch, batched fetches, and trade search failure. Remaining gaps align with later tasks: explicit CORS/OPTIONS behavior, malformed upstream JSON fallback, unknown build IDs, trade league caching, trade stats/league upstream error shape, fetch failure, zero listings, unmapped filters, and explicit online-only false behavior.

- [x] Standardize API error responses and logging:
  - Ensure upstream failures return useful status codes and `{ error: string }` bodies without leaking huge response payloads.
  - Keep request logging enabled for local debugging, but avoid noisy repeated logs for successful hot paths.
  - Make CORS behavior explicit for local web and desktop renderer use.
  - Notes:
    - Added a Fastify error handler in `apps/api/src/server.ts` so unhandled API route failures return `{ error: string }` with propagated upstream HTTP status codes where available.
    - Made CORS origin handling explicit for local web (`localhost`/`127.0.0.1:3000`) and desktop renderer (`localhost`/`127.0.0.1:1420`, Tauri origins) while preserving wildcard behavior for non-browser requests.
    - Gated successful trade hot-path debug logs behind `ZOE_TRADE_DEBUG=1` and truncated upstream error body snippets to 500 characters in `apps/api/src/trade.ts`.
    - Added tests for local web and desktop CORS preflights, trade stats/leagues error responses, quiet successful price checks, and truncated upstream trade errors.
    - Verification passed: `bun run test:api`, `bun run typecheck:api`, `bun run lint:api`, and `bun run build:api`.

- [x] Harden poe.ninja build routes:
  - Confirm `/poe-ninja/build-index`, `/poe-ninja/leagues`, `/builds`, and `/builds/:id` normalize upstream responses and fall back to fixtures where appropriate.
  - Add or adjust tests for unavailable upstream, malformed upstream JSON, unknown build IDs, league metadata, and query parameter parsing.
  - Keep fixture responses rich enough for the web dashboard to demonstrate filtering, sorting, details, summaries, and heatmaps.
  - Notes:
    - Enriched `apps/api/src/fixtures.ts` build snapshots with top DPS and defense metrics and marked them as `source: "fixture"` so fallback payloads are clearer to clients.
    - Extended `apps/api/src/server.test.ts` coverage for fixture build search payload shape, unknown build detail 404s, malformed build-index JSON fallback, malformed league metadata fallback, and malformed search protobuf fallback.
    - Existing tests continue to cover normalized build index data, league metadata normalization, build query parameter parsing, fixture detail fallback, summaries, and passive heatmaps.
    - Verification passed: `bun run test:api`, `bun run typecheck:api`, `bun run lint:api`, and `bun run build:api`.

- [x] Harden official trade routes:
  - Confirm `/trade/stats`, `/trade/leagues`, and `/trade/price-check` use cache TTLs, rate limiting, stat ID resolution, batched fetches, and useful error propagation.
  - Add or adjust tests for trade stats caching, league caching, search failure, fetch failure, zero listings, batched result fetching, unmapped filters, and online-only behavior.
  - Keep official network calls mocked in tests.
  - Notes:
    - Confirmed the existing official trade implementation in `apps/api/src/trade.ts` keeps stats and leagues behind TTL caches, rate-limits price checks, resolves requested filters to official stat IDs, fetches listings in batches of 10, and propagates upstream status codes through standardized `{ error: string }` API responses.
    - Extended `apps/api/src/server.test.ts` with mocked-network coverage for trade league caching, zero-result searches that skip listing fetches, unmapped filters being dropped before official search, `onlineOnly: false` sending `status.option: "any"`, and listing fetch failures preserving useful status/body context.
    - Existing tests continue to cover trade stats caching, search failures, batched result fetching, stat ID resolution, successful price-check normalization, quiet successful hot paths, and truncated upstream error bodies.
    - Verification passed: `bun run test:api`, `bun run typecheck:api`, `bun run lint:api`, and `bun run build:api`.

- [ ] Improve the typed API client:
  - Ensure client methods cover health, builds, build detail, poe.ninja metadata, summaries, heatmaps, trade metadata, and price check.
  - Preserve helpful unreachable-API error messages for desktop and web users.
  - Add lightweight tests if there is no coverage for query string serialization or error formatting.

- [ ] Add environment validation where it reduces runtime ambiguity:
  - Reuse `packages/config` patterns for API port, web API base URL, desktop API base URL, and any optional upstream settings.
  - Do not require secrets for the fixture-backed prototype path.
  - Document required environment variables in existing project docs only if the implementation introduces a new variable.

- [ ] Run API validation and fix failures:
  - `bun run test:api`
  - `bun run typecheck:api`
  - `bun run lint:api`
  - `bun run build:api`
