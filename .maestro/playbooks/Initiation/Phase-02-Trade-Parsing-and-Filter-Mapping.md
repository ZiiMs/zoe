# Phase 02: Trade Parsing and Filter Mapping

This phase improves Zoe's core trade intelligence: converting copied PoE2 item text into reliable structured metadata, search candidates, pseudo stats, and official trade stat IDs. The goal is to make price checks explainable and robust before adding more overlay polish.

## Tasks

- [x] Audit the current trade parser and test coverage before editing:
  - Review `packages/domain/src/trade.ts`, `packages/domain/src/domain.test.ts`, `apps/api/src/trade.ts`, and `apps/desktop/src/main.tsx`.
  - Search for existing fixture item text, parser helpers, and stat mapping code with `rg "parseTradeItemText|TradeStat|pseudo|Item Class"`.
  - Reuse existing parser shapes and exported domain types instead of adding duplicate item models.
  - Audit notes:
    - `packages/domain/src/trade.ts` owns the shared exported parser and trade model shapes: `ParsedTradeItem`, `ParsedItemModifier`, `TradeStatCandidate`, `PseudoStatSuggestion`, `TradePriceCheckFilter`, and `TradeStatGroup`.
    - The parser already handles basic `Item Class`, `Rarity`, rare/unique name and base lines, requirements, item level, quality, socket-like lines, numeric modifiers, modifier source suffixes, pseudo suggestions, candidate generation, and stat ID attachment.
    - `apps/desktop/src/main.tsx` uses `parseTradeItemText` after clipboard capture, attaches metadata with `attachTradeStatIds`, keeps unmapped candidates visible, and sends enabled candidates through `buildTradePriceCheckRequest`.
    - `apps/api/src/trade.ts` fetches official trade stats/leagues, resolves missing `tradeStatId` values through `findTradeStatId`, drops unmapped filters before official search, and builds the official `/api/trade2/search` and fetch calls.
    - Existing fixtures are inline in `packages/domain/src/domain.test.ts` and `apps/api/src/server.test.ts`; coverage currently includes one rare ring fixture, malformed clipboard tolerance, pseudo elemental/chaos/life mapping through mocked API stats, request construction, and API search/fetch behavior.
    - Coverage gaps for following tasks: representative rare weapons, unique items, socketed/rune/charm items, fractured/crafted/enchant sections beyond source suffix parsing, mixed resistance edge cases, normalized range/signed/percentage values, explicit stat ID attachment tests in `packages/domain`, and parser warnings for unsupported but meaningful sections.
    - Validation run: `bun run test:domain` passed with 1 test file and 6 tests.

- [x] Expand parser support for common PoE2 item text sections:
  - Handle item class, rarity, rare and unique name/base lines, item level, quality, requirements, sockets, rune sockets, charm slots, implicit modifiers, explicit modifiers, crafted modifiers, enchant modifiers, and fractured modifiers.
  - Preserve unknown but useful lines in parse warnings only when they indicate unsupported or malformed input.
  - Keep parsing tolerant: malformed clipboard text should return a structured empty item with warnings rather than throwing.
  - Completion notes:
    - `packages/domain/src/trade.ts` now supports modifier section headings for implicit, explicit, crafted, enchant, and fractured modifiers, while preserving parenthetical source overrides.
    - Socket metadata now continues to preserve `Sockets`, `Rune Sockets`, and `Charm Slots` lines in the shared `sockets` array.
    - Unsupported or malformed lines are reported as targeted parse warnings when they appear inside a modifier section or look like an unsupported item-text heading.
    - Added domain coverage for unique item name/base parsing, quality, requirements, item level, socket/rune/charm lines, section-scoped modifier sources, and warning behavior.
    - Validation run: `bun run test:domain` passed with 1 test file and 8 tests; `bun run typecheck` passed for all 9 packages.

- [x] Improve modifier normalization and candidate generation:
  - Normalize numeric ranges, signed values, percentages, local tags, and parenthetical source markers consistently.
  - Choose a stable dominant value for simple values and ranges so default minimum filters are useful.
  - Ensure pseudo candidates disable covered exact candidates only when the pseudo filter represents the same underlying modifiers.
  - Completion notes:
    - `packages/domain/src/trade.ts` now normalizes hyphenated numeric ranges before scalar number placeholders, preserves signed parsed values, strips parenthetical tags from normalized stat text, and avoids adding stray spaces before percentages.
    - Range-like modifiers now use the upper bound as the candidate value/default minimum, including `Adds # to # ...` and `#-#% ...` forms.
    - Added regression coverage for range parsing, signed values, `(local)` tags, inline source markers, and partial pseudo coverage so unrelated exact modifiers remain enabled.
    - Validation run: `bun run test:domain` passed with 1 test file and 10 tests; `bun run typecheck` passed for all 9 packages.

- [x] Add pseudo stat suggestions for high-value trade checks:
  - Total elemental resistance, total chaos resistance, total maximum life, total maximum mana, total maximum energy shield, total attributes, and any existing locally supported pseudo stats.
  - Use deterministic IDs, labels, covered modifier IDs, values, and default minimums.
  - Avoid guessing unsupported official stat IDs in `packages/domain`; let `attachTradeStatIds` resolve them from API metadata.
  - Completion notes:
    - `packages/domain/src/trade.ts` now keeps deterministic pseudo suggestions for total elemental resistance, total chaos resistance, total maximum life, total maximum mana, total maximum energy shield, and total attributes without assigning official `tradeStatId` values in the domain layer.
    - Added weighted support for `to all Elemental Resistances` and `to all Attributes`, counting those as three stat contributions and covering the originating exact modifier so the overlay does not double-filter it by default.
    - Added domain coverage for pseudo IDs, labels, values, default minimums, covered modifier IDs, enabled pseudo candidates, and unset domain-level trade stat IDs.
    - Validation run: `bun run test:domain` passed with 1 test file and 11 tests; `bun run typecheck` passed for all 9 packages.

- [x] Strengthen official trade stat ID attachment:
  - Improve exact and fuzzy matching in `findTradeStatId` only where tests prove the current behavior is insufficient.
  - Prefer pseudo stat groups for pseudo candidates and exact stat groups for exact modifiers.
  - Keep unmapped candidates visible to the overlay with `tradeStatId` unset so users can debug mapping gaps.
  - Completion notes:
    - `packages/domain/src/trade.ts` now scopes `findTradeStatId` matching by candidate source: pseudo candidates only search pseudo stats, exact candidates prefer their own exact source group, and exact candidates never fall through to pseudo entries.
    - Exact and fuzzy matching now compare both the display label and `normalizedText`, preserving tolerant matching without crossing pseudo/exact stat groups.
    - Added domain regressions for explicit, implicit, and pseudo stat ID attachment when conflicting same-text entries exist, plus unmapped exact candidates that remain visible with `tradeStatId` unset.
    - Validation run: `bun run test:domain` passed with 1 test file and 13 tests; `bun run typecheck` passed for all 9 packages; `bun run lint` passed with 7 existing Next.js `<img>` warnings in `apps/web`.

- [x] Write focused domain tests for parser and mapping behavior:
  - Add representative rare ring, rare weapon, unique item, socketed item, malformed clipboard, and mixed resistance fixtures.
  - Assert item metadata, modifier sources, candidate enablement, pseudo totals, warnings, normalized text, and stat ID attachment.
  - Keep tests beside the implementation as `*.test.ts` and mock trade metadata with small local arrays.
  - Completion notes:
    - Added `packages/domain/src/trade-fixtures.test.ts` with six representative parser fixtures covering rare rings, rare weapons, unique items, socketed items, malformed clipboard text, and mixed resistance totals.
    - The tests assert item metadata, requirements, quality, item level, socket metadata, modifier sources, normalized text, range dominant values, candidate enablement, pseudo totals, parse warnings, and stat ID attachment with local mock trade stat groups.
    - Validation run: `bun run test:domain` passed with 2 test files and 19 tests; `bun run typecheck` passed for all 9 packages; `bun run test` passed for all 9 packages.

- [ ] Run parser validation and fix failures:
  - `bun run test:domain`
  - `bun run typecheck`
  - Include any known unsupported item text forms in the final status so the next phase can prioritize them.
