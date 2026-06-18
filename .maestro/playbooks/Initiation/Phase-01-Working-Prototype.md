# Phase 01: Working Prototype

This phase turns the existing Zoe monorepo into a verified, runnable prototype that demonstrates both product pillars: build exploration in the web app and trade price-check flow through shared domain logic and the API. It is fully autonomous: use fixture data and mocked network responses where needed, avoid requiring Path of Exile 2, official trade credentials, or user decisions, and leave the user with commands and screens that visibly work.

## Tasks

- [x] Inspect the current workspace before editing:
  - Run `rg --files` and review `package.json`, `turbo.json`, `apps/api/src/server.ts`, `apps/web/app/builds-page.tsx`, `apps/desktop/src/main.tsx`, `packages/domain/src/trade.ts`, and existing `*.test.ts` files.
  - Reuse existing scripts, fixtures, UI primitives, and test patterns instead of creating parallel scaffolding.
  - Confirm generated folders such as `dist/`, `.next/`, `.turbo/`, and `apps/desktop/src-tauri/target/` are not edited by hand.
  - Completion note: Inspected the requested workspace files and current tests (`packages/domain/src/domain.test.ts`, `apps/api/src/server.test.ts`, `apps/worker/src/jobs.test.ts`). Root scripts already delegate through `turbo run`; package scripts provide focused `build`, `typecheck`, `lint`, and `test` commands. Existing reusable pieces include `apps/api/src/fixtures.ts`, Fastify `server.inject` tests, `@zoe/api-client`, `@zoe/ui` primitives, domain trade parser/request helpers, and the desktop `isTauriRuntime()` guard. Generated output folders exist under `.turbo/` and `apps/desktop/src-tauri/target/` and were not edited.

- [x] Create or strengthen a fixture-backed end-to-end smoke path for the API and domain trade flow:
  - Ensure `packages/domain` can parse a representative rare PoE2 item text into item metadata, modifiers, pseudo stat suggestions, enabled exact filters, and parse warnings.
  - Ensure `apps/api` can inject `POST /trade/price-check` with mocked official trade stats/search/fetch responses and return listing price, seller, total, trade URL, and resolved filters.
  - Keep all network calls mocked inside tests so this task runs offline and deterministically.
  - Completion note: Strengthened `packages/domain/src/domain.test.ts` to assert a representative rare ring parses into metadata, five modifiers, no parse warnings, pseudo resistance/life suggestions, and enabled exact Strength filters, then builds a price-check request from enabled filters. Added an API smoke test in `apps/api/src/server.test.ts` that parses the same rare item, posts the derived request to `/trade/price-check`, mocks official stats/search/fetch responses offline, and verifies listing price, seller, total, trade URL, captured search body, and resolved pseudo/exact trade stat filters. Verified with `bun run test:domain`, `bun run test:api`, and `bun run typecheck`.

- [ ] Create or strengthen a fixture-backed build exploration smoke path:
  - Ensure `GET /health`, `GET /builds`, `GET /builds/:id`, `GET /summaries`, and `GET /heatmaps/passives` return useful fixture-backed responses when upstream poe.ninja is unavailable.
  - Add focused tests only where gaps exist, using the current Fastify `server.inject` style.
  - Verify build search parameters for league, search, class, skill, gear, sort, order, and page are parsed without throwing.

- [ ] Verify the web build explorer works against the local API or fixture fallback:
  - Start from existing `apps/web/app/page.tsx`, `apps/web/app/builds-page.tsx`, and shared `@zoe/ui` components.
  - Fix any obvious runtime, TypeScript, or hydration issue that prevents the page from rendering the build table, filters, class distribution, or fixture fallback badge.
  - Preserve the current utilitarian dashboard design and avoid adding a marketing landing page.

- [ ] Verify the desktop overlay renderer can run as a browser prototype without requiring Tauri commands:
  - Use `bun run dev:desktop:renderer` for renderer-only validation rather than requiring `tauri dev`.
  - Ensure the non-Tauri path opens the overlay UI, shows the passive instructions or fixture-ready state, and does not crash because Tauri APIs are unavailable.
  - If a small code guard is needed, follow the existing `isTauriRuntime()` pattern and keep the production Tauri behavior intact.

- [ ] Run the focused validation commands and fix failures introduced by this phase:
  - `bun run test:domain`
  - `bun run test:api`
  - `bun run typecheck`
  - `bun run build:web`
  - `bun run build:desktop`

- [ ] Start the runnable prototype services and report the URLs:
  - Start `bun run dev:api` and confirm `http://localhost:4000/health` returns `{ "ok": true }`.
  - Start `bun run dev:web` and confirm the build explorer loads at `http://localhost:3000`.
  - Start `bun run dev:desktop:renderer` if the user wants to view the overlay prototype in a browser, and report the Vite URL shown by the command.
  - Do not leave out any failing command; include exact failures and the most likely next fix in the final status.
