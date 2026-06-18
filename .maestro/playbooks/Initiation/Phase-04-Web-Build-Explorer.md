# Phase 04: Web Build Explorer

This phase turns the Next.js web app into a stronger build discovery surface for PoE2 players. It focuses on searchable builds, usable filters, build detail views, summaries, and heatmap-style insight while preserving Zoe's existing dashboard-first interface.

## Tasks

- [x] Audit the web app and shared UI before editing:
  - Review `apps/web/app/page.tsx`, `apps/web/app/layout.tsx`, `apps/web/app/builds-page.tsx`, `apps/web/app/builds/[id]/page.tsx`, `packages/ui/src`, and `packages/api-client/src/index.ts`.
  - Search for existing build filters, detail rendering, card/button/badge primitives, image usage, and API client calls before adding components.
  - Preserve the current app-router structure and avoid adding a landing page.
  - Completion note: reviewed the requested app-router pages, shared `@zoe/ui` primitives, and API client. Existing reusable pieces include `BuildsPage`, URL-param helpers (`parseBuildSearchParams`, `filterHref`, `splitParam`), build row/detail rendering, `Badge`/`Button`/`Card`/`cn`, `createZoeApiClient().builds()` / `.build()`, and current image handling for ascendancy portraits, skill icons, item icons, and passive tree SVG output. No images were attached to this task.

- [x] Improve build list filtering and sorting:
  - Ensure league, account/character search, class, keystone, skill, support, gear, sort, and order controls round-trip through URL search params.
  - Keep controls compact and scannable for repeated use.
  - Handle empty results, API fallback, loading, and refresh states without layout jumps.
  - Completion note: expanded the build explorer controls in `apps/web/app/builds-page.tsx` so league, account/character search, class, keystone, skill, support, gear, sort, and order all stay URL-backed. Added compact sort/order selects covering all supported sort fields, kept quick sort buttons in sync with the selected order, reset pagination when filters change, and replaced transition-only refresh state with explicit refreshing/API-fallback indicators plus a stable empty/results container. Validation: `bun run typecheck:web`, `bun run lint:web` (warnings only for existing `<img>` usage), and `bun run --filter @zoe/web test` (no web test files found, exits 0). No images were attached or analyzed for this task.

- [x] Improve the build table and high-signal summary panels:
  - Show rank, character, account, class or ascendancy, level, top DPS skill, defensive metrics, main skills, key gear, and source freshness where available.
  - Add class distribution, top skills, top supports, and top gear summaries if the API response already contains the data.
  - Reuse `@zoe/ui` primitives and existing formatting helpers before creating new UI code.
  - Completion note: updated `apps/web/app/builds-page.tsx` to add a per-row freshness/source column using each build's `capturedAt` and `source`, while preserving the existing rank, character/account, class/ascendancy, level, top DPS, defenses, skills, and gear cells. Replaced the single class-distribution card with reusable summary panels for class distribution plus top skills, supports, and gear from the existing `BuildSearchResponse.filters` data, with fallback messages when summaries are absent. Validation: `bunx prettier --check apps/web/app/builds-page.tsx .maestro/playbooks/Initiation/Phase-04-Web-Build-Explorer.md`, `bun run typecheck:web`, `bun run lint:web` (passes with existing `<img>` warnings), `bun run --filter @zoe/web test` (no web test files found, exits 0), and `bun run build:web`. No images were attached or analyzed for this task.

- [x] Improve build detail pages:
  - Show skills, supports, items, defensive stats, metadata, and passive or heatmap-related data from the current API response.
  - Provide clear fallback states when a build detail is missing or fixture-backed.
  - Keep navigation back to the build list and preserve the selected league/filter context where practical.
  - Completion note: expanded `apps/web/app/builds/[id]/page.tsx` with a clear unavailable-detail fallback, filter-preserving back navigation, poe.ninja outbound link, metadata panel, full item detail panel, keystone panel, passive-signal panel, empty skill fallback, and item tooltips in the equipment grid. Existing skill/support groups, defenses, flasks, jewels, and passive tree rendering are preserved. Validation: `bunx prettier --check "apps/web/app/builds/[id]/page.tsx"`, `bun run typecheck:web`, `bun run lint:web` (passes with existing `<img>` warnings), `bun run --filter @zoe/web test` (no web test files found, exits 0), and `bun run build:web`. No images were attached or analyzed for this task.

- [x] Add visual and interaction polish appropriate for an operational dashboard:
  - Use stable table widths, compact controls, icons from `lucide-react`, and responsive constraints so text does not overlap on mobile or desktop.
  - Avoid nested cards, decorative backgrounds, oversized hero sections, and one-note color palettes.
  - Ensure images have useful dimensions, empty alt text for decorative class portraits, and no broken layout if an image URL fails.
  - Completion note: tightened the build explorer table and detail layouts in `apps/web/app/builds-page.tsx` and `apps/web/app/builds/[id]/page.tsx` with fixed table column tracks, compact responsive sort/filter controls, truncation on long character/account/class/item text, bounded equipment/detail columns, constrained hover tooltips, and explicit dimensions/lazy loading for decorative class, skill, item, and keystone images. Existing `lucide-react` icons and `@zoe/ui` primitives were reused, and the dashboard remains card-based without nested cards or hero/decoration changes. Validation: `bunx prettier --check apps/web/app/builds-page.tsx "apps/web/app/builds/[id]/page.tsx"`, `bun run typecheck:web`, `bun run lint:web` (passes with existing `<img>` warnings), and `bun run build:web`. No images were attached or analyzed for this task.

- [ ] Add focused web tests or component-level checks where the repo already supports them:
  - Cover URL param parsing, filter toggling helpers, empty result rendering, and build detail fallback if practical.
  - If no web test harness exists, keep logic testable through extracted pure helpers and rely on typecheck/build for this phase.

- [ ] Run web validation and fix failures:
  - `bun run typecheck:web`
  - `bun run lint:web`
  - `bun run build:web`
  - Start `bun run dev:web` and verify the build explorer loads against `NEXT_PUBLIC_API_BASE_URL` or the local API default.
