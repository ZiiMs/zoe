# Phase 07: Quality and Release Readiness

This phase prepares Zoe for sustained development and shareable builds. It tightens repo-wide checks, documents architecture decisions as graph-friendly Markdown, verifies local developer workflows, and leaves clear release criteria for the web dashboard, API, workers, and desktop overlay.

## Tasks

- [x] Audit repo-wide quality configuration before editing:
  - Review `package.json`, `turbo.json`, `eslint.config.mjs`, `.prettierrc.json`, `tsconfig.base.json`, app/package `tsconfig.json` files, and existing README content.
  - Search for existing docs, scripts, CI hints, and generated output before adding new files.
  - Keep all source changes aligned with current Bun, Turbo, TypeScript ESM, Prettier, and ESLint conventions.
  - Completed audit on 2026-06-18:
    - Root scripts delegate through `turbo run`; package scripts own build/typecheck/lint/test/dev tasks.
    - `turbo.json` defines build/dev/typecheck/lint/test plus worker jobs, excludes Tauri generated output, and uses a transit task for typecheck/test dependency invalidation.
    - ESLint, Prettier, and shared TypeScript settings match the documented TypeScript ESM style; package tsconfigs inherit from `tsconfig.base.json`.
    - Existing README covers core setup and commands but is missing later release-readiness details called out by follow-up tasks.
    - No `docs/` or `.github/` workflow directory exists yet; generated outputs are ignored in `.gitignore`.

- [x] Make repo-wide checks reliable:
  - Ensure `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`, and `bun run format:check` either pass or fail for actionable project reasons.
  - Fix legitimate TypeScript, lint, formatting, and test failures introduced by earlier phases.
  - Do not mask failures by weakening rules unless the codebase already uses that local pattern.
  - Completed on 2026-06-18:
    - Ran `bun run typecheck`, `bun run lint`, `bun run test`, and `bun run build`; all completed successfully across the Turbo workspace.
    - Fixed `bun run format:check` by applying Prettier to `apps/api/src/fixtures.ts`, `apps/web/app/globals.css`, `apps/web/app/page.tsx`, `apps/worker/src/jobs.ts`, `packages/domain/src/trade-fixtures.test.ts`, and UI component files in `packages/ui/src/`.
    - Re-ran `bun run format:check`, `bun run typecheck`, `bun run lint`, `bun run test`, and `bun run build`; all passed after formatting.
    - `bun run lint` still reports non-blocking `@next/next/no-img-element` warnings in existing web pages, but exits successfully with 0 errors.

- [x] Add structured architecture documentation for future agents:
  - Create `docs/architecture/system-overview.md` with YAML front matter using `type: reference`, `title: Zoe System Overview`, current date, tags `[architecture, poe2, zoe]`, and wiki-links to related docs.
  - Create `docs/architecture/trade-flow.md` with front matter and wiki-links such as `[[Zoe-System-Overview]]`, covering item capture, parsing, stat mapping, API search, listing fetch, and overlay rendering.
  - Create `docs/architecture/build-intelligence-flow.md` with front matter and wiki-links such as `[[Zoe-System-Overview]]`, covering poe.ninja ingestion, normalization, summaries, heatmaps, API reads, and web rendering.
  - Completed on 2026-06-18:
    - Added `docs/architecture/system-overview.md` describing workspace boundaries, runtime data sources, UI surfaces, and reliability patterns.
    - Added `docs/architecture/trade-flow.md` covering desktop item capture, domain parsing, stat mapping, API official-trade search, listing fetch, and overlay rendering.
    - Added `docs/architecture/build-intelligence-flow.md` covering worker ingestion, normalization, summaries, heatmap aggregation, Postgres persistence, API reads, and web rendering.
    - Verified Markdown formatting with `bunx prettier --check docs/architecture/system-overview.md docs/architecture/trade-flow.md docs/architecture/build-intelligence-flow.md`.

- [x] Add structured decision records for major tradeoffs:
  - Create `docs/decisions/adr-001-fixture-first-development.md` with YAML front matter using `type: analysis`, `title: Fixture First Development`, tags `[adr, testing, reliability]`, and related wiki-links.
  - Create `docs/decisions/adr-002-local-api-as-overlay-gateway.md` with front matter, explaining why the desktop overlay calls the local Zoe API instead of official trade APIs directly.
  - Keep ADRs concise, factual, and tied to implemented behavior.
  - Completed on 2026-06-18:
    - Added `docs/decisions/adr-001-fixture-first-development.md` documenting the accepted fixture-first testing and local development tradeoff.
    - Added `docs/decisions/adr-002-local-api-as-overlay-gateway.md` documenting the accepted local API gateway boundary for overlay trade calls.
    - Verified ADR Markdown formatting with `bunx prettier --check docs/decisions/adr-001-fixture-first-development.md docs/decisions/adr-002-local-api-as-overlay-gateway.md`.

- [x] Improve README developer workflow only where it is missing or stale:
  - Include setup, `bun install`, optional Postgres startup, API/web/desktop/worker dev commands, validation commands, and fixture fallback behavior.
  - Include local URLs for API health, web app, and desktop renderer.
  - Avoid duplicating large architecture docs; link to structured docs with relative paths.
  - Completed on 2026-06-18:
    - Updated `README.md` with fixture-friendly setup, optional Postgres startup, per-app dev commands, repo-wide validation commands, and default local URLs for API health/build data, web, and desktop renderer.
    - Documented the fixture fallback path for API, web, and worker workflows, including `ZOE_API_PERSISTED_READS=true` for persisted API reads.
    - Linked to the structured architecture and decision docs instead of duplicating their content.
    - Verified README formatting with `bunx prettier --check README.md`.

- [x] Verify all app entry points:
  - Start the API and confirm `/health`, `/builds`, `/summaries`, and `/heatmaps/passives`.
  - Start the web app and confirm the build explorer renders.
  - Start the desktop renderer and confirm the overlay renders without Tauri.
  - Run worker scripts in fixture mode and confirm they print useful output.
  - Completed on 2026-06-18:
    - Started `bun run dev:api` and confirmed `/health`, `/builds`, `/summaries`, and `/heatmaps/passives` on `http://127.0.0.1:4000`; `/builds` returned live poe.ninja build rows, while summaries and passive heatmaps returned fixture-backed local data.
    - Started `bun run dev:web` and verified `http://127.0.0.1:3000` in Chrome via Playwright; the build explorer rendered with build rows, no framework overlay, and no console errors. Screenshot captured at `.maestro/playbooks/Working/phase07-web.png`.
    - Started `bun run dev:desktop:renderer` and verified `http://127.0.0.1:5173` in Chrome via Playwright; the overlay rendered without Tauri and loaded trade league metadata after fixing local API CORS for the Vite renderer origin. Screenshot captured at `.maestro/playbooks/Working/phase07-desktop-after-cors.png`.
    - Ran `bun run worker:ingest:poe-ninja`, `bun run worker:summarize:builds`, and `bun run worker:aggregate:heatmaps`; all printed useful fixture-mode output.
    - Added `http://localhost:5173` and `http://127.0.0.1:5173` to the API CORS allow-list and extended the desktop renderer CORS test.
    - Verified the code change with `bun run test:api`, `bun run typecheck:api`, and `bunx prettier --check apps/api/src/server.ts apps/api/src/server.test.ts .maestro/playbooks/Initiation/Phase-07-Quality-and-Release-Readiness.md`.

- [x] Capture final validation status:
  - Run `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`, and `bun run format:check`.
  - If any command cannot be completed due to missing external software such as Docker, Rust, or Tauri prerequisites, report the blocker and the exact command that remains.
  - Leave the repo with no unrelated generated artifacts checked into source-controlled areas.
  - Completed on 2026-06-18:
    - `bun run typecheck` passed across all 9 Turbo workspace packages.
    - `bun run lint` passed across all 9 packages; it still reports 9 non-blocking `@next/next/no-img-element` warnings in existing web app files.
    - `bun run test` passed across all 9 packages; Vitest suites reported 83 passing tests plus pass-with-no-tests packages.
    - `bun run build` passed across all 9 packages, including the Next.js web build and Vite desktop renderer build.
    - `bun run format:check` passed with all matched files using Prettier style.
    - No external software blocker was encountered. The only untracked path after validation was `.maestro/playbooks/Working/`, the configured temporary Auto Run working folder.
