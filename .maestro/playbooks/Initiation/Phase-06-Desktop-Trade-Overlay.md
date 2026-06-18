# Phase 06: Desktop Trade Overlay

This phase refines Zoe's Tauri overlay into a practical in-game price-checking tool. It focuses on capture safety, hotkeys, overlay states, filter adjustment, listings, debug output, and browser-renderer fallback so work can be validated without always launching Path of Exile 2.

## Tasks

- [x] Audit the desktop app before editing:
  - Review `apps/desktop/src/main.tsx`, `apps/desktop/src/styles.css`, `apps/desktop/src-tauri/src`, `apps/desktop/package.json`, and `apps/desktop/vite.config.ts`.
  - Search for existing Tauri commands, hotkey registration, clipboard capture, cursor positioning, PoE focus checks, and API status code with `rg "capture_item_text|global-shortcut|is_poe_focused|cursor_position|priceCheck" apps/desktop`.
  - Preserve the renderer-only fallback path used by `bun run dev:desktop:renderer`.
  - Completed audit notes: `apps/desktop/src/main.tsx` already has Tauri runtime guards for renderer-only development, global shortcuts for `CommandOrControl+D` and `Shift+Space`, Escape close handling, click-through sync, cursor-based quick panel positioning, API metadata loading, filter controls, debug output, and price-check calls. `apps/desktop/src-tauri/src/lib.rs` exposes `capture_item_text`, `cursor_position`, and `is_poe_focused`; Windows clipboard capture is PowerShell-based, focus gating checks Path of Exile process names, and non-Windows capture returns a clear unsupported message while cursor positioning returns `None`. `apps/desktop/src/styles.css` contains the dense quick-panel and settings-panel styles. `apps/desktop/package.json` keeps `dev:renderer` as Vite-only, and `apps/desktop/vite.config.ts` serves that fallback on `127.0.0.1:5173`.
  - Search completed with `rg "capture_item_text|global-shortcut|is_poe_focused|cursor_position|priceCheck" apps/desktop`; matches confirmed the command names, Tauri global shortcut plugin dependency and capabilities, renderer shortcut registration, focus check, cursor command, and API client `priceCheck` call.

- [x] Harden Tauri command behavior:
  - Ensure item text capture fails with a clear message when clipboard or focus access is unavailable.
  - Ensure PoE focus gating works without blocking renderer-only development.
  - Ensure cursor positioning and window click-through behavior fail gracefully if an OS API is unavailable.
  - Completed hardening notes: `capture_item_text` now verifies the focused process before clipboard capture and returns explicit messages when PoE2 is not focused or the active window cannot be inspected. Clipboard-empty errors now mention the administrator-privilege mismatch case. The renderer keeps the non-Tauri `dev:desktop:renderer` path focused by default, while Tauri hotkey focus failures are logged to the debug panel. Cursor positioning, overlay focus, and click-through sync now fail gracefully with debug messages instead of silent drops or crashes.
  - Validation: `cargo check` in `apps/desktop/src-tauri`, `bun run typecheck:desktop`, `bun run lint:desktop`, and `bun run test:desktop` passed. The desktop test target currently has no test files and exits successfully with `--passWithNoTests`.

- [x] Improve hotkey and overlay state handling:
  - Keep `CommandOrControl+D` for quick price check and `Shift+Space` for settings or interactive mode unless the existing code already defines a different convention.
  - Prevent duplicate shortcut registration during hot reloads.
  - Ensure Escape closes the overlay and passive mode restores click-through behavior.
  - Completed hotkey/state notes: `apps/desktop/src/main.tsx` now keeps the existing `CommandOrControl+D` quick price check and `Shift+Space` settings toggle, but replaces only Zoe-owned shortcuts instead of calling `unregisterAll`. A window-scoped setup token prevents stale hot-reload cleanup from unregistering the current handlers, and shortcut callbacks ignore stale setup instances. Escape still routes through `closeOverlay`, which closes the overlay and returns it to passive mode. The settings click-through action now uses an explicit passive-mode handler, and `apps/desktop/src/styles.css` mirrors passive click-through behavior for renderer-only fallback by disabling pointer events while the overlay is open in passive mode.
  - Validation: `bun run typecheck:desktop`, `bun run lint:desktop`, and `bun run test:desktop` passed. The desktop test target currently has no test files and exits successfully with `--passWithNoTests`.

- [x] Improve the quick price panel workflow:
  - Show item name, base type, league, item level, mapped filter count, enabled filters, loading state, price check result count, prices, listed age, and trade link.
  - Keep controls dense and stable so the panel does not resize unpredictably while listings load.
  - Let users enable or disable candidate filters and adjust min/max values before rerunning search.
  - Completed quick panel notes: `apps/desktop/src/main.tsx` now shows item name and base type separately, league, rarity, item level, mapped filter count, enabled filter count, loading state, fetched/total listing counts, listing prices, listed ages, seller or item fallback text, and trade links from each listing or the active search. The compact filter rows remain adjustable with enable toggles plus min/max inputs before rerunning search.
  - Layout notes: `apps/desktop/src/styles.css` adds fixed quick summary slots, stable loading placeholder rows, bounded filter/listing scroll regions, and disabled trade-link styling so loading results do not resize the panel unpredictably.
  - Validation: `bun run typecheck:desktop`, `bun run lint:desktop`, `bun run test:desktop`, and `bun run build:desktop` passed. The desktop test target currently has no test files and exits successfully with `--passWithNoTests`.

- [x] Improve settings and debug workflow:
  - Let users change API base URL and league from existing API metadata.
  - Show API health, parse warnings, unmapped stats, request details, and result details in a compact debug area.
  - Keep debug messages useful for diagnosing stat mapping and official trade failures.
  - Completed settings/debug notes: `apps/desktop/src/main.tsx` now preserves editable API base URL and league selection while adding a structured settings debug summary for API status, base URL, selected league, metadata counts, parse warnings, unmapped stat labels, last request filters, and result totals/query details. The existing event log remains below the summary for capture, metadata, stat mapping, and official trade failure diagnostics.
  - Layout notes: `apps/desktop/src/styles.css` adds compact debug grid styling so long URLs, warnings, unmapped labels, and trade stat IDs wrap within the settings panel.
  - Validation: `bun run typecheck:desktop`, `bun run lint:desktop`, `bun run test:desktop`, and `bun run build:desktop` passed. The desktop test target currently has no test files and exits successfully with `--passWithNoTests`.

- [ ] Add desktop tests where practical:
  - Cover pure helpers for league selection, price formatting, listed age formatting, quick panel positioning, and any extracted parser-to-UI mapping.
  - Mock Tauri APIs rather than requiring a Tauri runtime for unit tests.
  - Keep visual changes validated through renderer build and manual browser verification if no component test harness exists.

- [ ] Run desktop validation and fix failures:
  - `bun run test:desktop`
  - `bun run typecheck:desktop`
  - `bun run lint:desktop`
  - `bun run build:desktop`
  - Start `bun run dev:desktop:renderer` and verify the overlay prototype renders without Tauri.
