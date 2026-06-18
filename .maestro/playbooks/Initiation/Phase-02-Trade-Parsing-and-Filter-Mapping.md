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

- [ ] Expand parser support for common PoE2 item text sections:
  - Handle item class, rarity, rare and unique name/base lines, item level, quality, requirements, sockets, rune sockets, charm slots, implicit modifiers, explicit modifiers, crafted modifiers, enchant modifiers, and fractured modifiers.
  - Preserve unknown but useful lines in parse warnings only when they indicate unsupported or malformed input.
  - Keep parsing tolerant: malformed clipboard text should return a structured empty item with warnings rather than throwing.

- [ ] Improve modifier normalization and candidate generation:
  - Normalize numeric ranges, signed values, percentages, local tags, and parenthetical source markers consistently.
  - Choose a stable dominant value for simple values and ranges so default minimum filters are useful.
  - Ensure pseudo candidates disable covered exact candidates only when the pseudo filter represents the same underlying modifiers.

- [ ] Add pseudo stat suggestions for high-value trade checks:
  - Total elemental resistance, total chaos resistance, total maximum life, total maximum mana, total maximum energy shield, total attributes, and any existing locally supported pseudo stats.
  - Use deterministic IDs, labels, covered modifier IDs, values, and default minimums.
  - Avoid guessing unsupported official stat IDs in `packages/domain`; let `attachTradeStatIds` resolve them from API metadata.

- [ ] Strengthen official trade stat ID attachment:
  - Improve exact and fuzzy matching in `findTradeStatId` only where tests prove the current behavior is insufficient.
  - Prefer pseudo stat groups for pseudo candidates and exact stat groups for exact modifiers.
  - Keep unmapped candidates visible to the overlay with `tradeStatId` unset so users can debug mapping gaps.

- [ ] Write focused domain tests for parser and mapping behavior:
  - Add representative rare ring, rare weapon, unique item, socketed item, malformed clipboard, and mixed resistance fixtures.
  - Assert item metadata, modifier sources, candidate enablement, pseudo totals, warnings, normalized text, and stat ID attachment.
  - Keep tests beside the implementation as `*.test.ts` and mock trade metadata with small local arrays.

- [ ] Run parser validation and fix failures:
  - `bun run test:domain`
  - `bun run typecheck`
  - Include any known unsupported item text forms in the final status so the next phase can prioritize them.
