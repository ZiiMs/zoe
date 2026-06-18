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

- [ ] Add structured architecture documentation for future agents:
  - Create `docs/architecture/system-overview.md` with YAML front matter using `type: reference`, `title: Zoe System Overview`, current date, tags `[architecture, poe2, zoe]`, and wiki-links to related docs.
  - Create `docs/architecture/trade-flow.md` with front matter and wiki-links such as `[[Zoe-System-Overview]]`, covering item capture, parsing, stat mapping, API search, listing fetch, and overlay rendering.
  - Create `docs/architecture/build-intelligence-flow.md` with front matter and wiki-links such as `[[Zoe-System-Overview]]`, covering poe.ninja ingestion, normalization, summaries, heatmaps, API reads, and web rendering.

- [ ] Add structured decision records for major tradeoffs:
  - Create `docs/decisions/adr-001-fixture-first-development.md` with YAML front matter using `type: analysis`, `title: Fixture First Development`, tags `[adr, testing, reliability]`, and related wiki-links.
  - Create `docs/decisions/adr-002-local-api-as-overlay-gateway.md` with front matter, explaining why the desktop overlay calls the local Zoe API instead of official trade APIs directly.
  - Keep ADRs concise, factual, and tied to implemented behavior.

- [ ] Improve README developer workflow only where it is missing or stale:
  - Include setup, `bun install`, optional Postgres startup, API/web/desktop/worker dev commands, validation commands, and fixture fallback behavior.
  - Include local URLs for API health, web app, and desktop renderer.
  - Avoid duplicating large architecture docs; link to structured docs with relative paths.

- [ ] Verify all app entry points:
  - Start the API and confirm `/health`, `/builds`, `/summaries`, and `/heatmaps/passives`.
  - Start the web app and confirm the build explorer renders.
  - Start the desktop renderer and confirm the overlay renders without Tauri.
  - Run worker scripts in fixture mode and confirm they print useful output.

- [ ] Capture final validation status:
  - Run `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`, and `bun run format:check`.
  - If any command cannot be completed due to missing external software such as Docker, Rust, or Tauri prerequisites, report the blocker and the exact command that remains.
  - Leave the repo with no unrelated generated artifacts checked into source-controlled areas.
