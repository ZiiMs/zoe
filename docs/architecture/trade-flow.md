---
type: reference
title: Zoe Trade Flow
created: 2026-06-18
tags:
  - architecture
  - poe2
  - zoe
  - trade
related:
  - "[[Zoe-System-Overview]]"
---

# Zoe Trade Flow

Zoe's trade flow turns a captured Path of Exile 2 item into a local overlay view
of comparable official trade listings. The desktop overlay owns capture and
presentation; shared domain code owns parsing and filter construction; the API
owns official trade calls.

## Item Capture

In the Tauri runtime, `apps/desktop` registers `CommandOrControl+D` for quick
price checks and `Shift+Space` for the settings overlay. Before responding to a
shortcut, the overlay asks the Rust backend whether Path of Exile 2 is focused.
For a price check, the overlay invokes the `capture_item_text` Tauri command and
receives raw item text from the game clipboard workflow.

The Vite-only renderer can open without Tauri for local UI development. In that
mode, the overlay skips native hotkey and window behavior and starts visible.

## Parsing

The overlay passes captured text to `parseTradeItemText` in `packages/domain`.
The parser splits copied item text into sections, extracts item class, rarity,
name, base type, item level, quality, sockets, requirements, and modifier lines.
It preserves parse warnings for unsupported lines so the overlay can show useful
debug feedback instead of silently dropping data.

Each modifier is normalized through `normalizeStatText`, numeric values are
extracted, and candidate filters are generated. Domain logic also creates pseudo
stat suggestions for common totals such as elemental resistance, chaos
resistance, maximum life, maximum mana, maximum energy shield, and attributes.

## Stat Mapping

The overlay loads trade metadata from the local API through
`createZoeApiClient`: `/health`, `/trade/stats`, and `/trade/leagues`. It uses
`attachTradeStatIds` to match parsed exact and pseudo candidates to official
trade stat IDs. Mapped candidates become searchable filters; unmapped candidates
remain visible for debugging and can be disabled or adjusted by the user.

## API Search

When the user runs a search, the overlay calls
`buildTradePriceCheckRequest` with the parsed item, selected league, enabled
candidates, and listing limit. It sends that request to
`POST /trade/price-check`.

The API resolves any remaining stat IDs, builds an official trade search query,
and posts it to `https://www.pathofexile.com/api/trade2/search/{league}` for the
POE2 realm. Searches default to online listings and sort by ascending price.

## Listing Fetch

The official search response returns a query ID and listing IDs. The API slices
the result IDs to the requested limit, fetches listings in batches of ten from
the official fetch endpoint, and normalizes each listing into seller, price,
item name, item level, listed time, whisper text, and trade URL fields.

Trade stats are cached for one hour, leagues for fifteen minutes, and price
checks are spaced by a small in-process rate limiter.

## Overlay Rendering

The desktop overlay renders mapped/enabled counts, active filters, market status,
listing totals, fetched rows, trade links, and debug lines. The quick panel is
positioned near the cursor when native cursor coordinates are available, while
the settings panel exposes API URL, league selection, parsed candidate details,
and request/result diagnostics.

This flow depends on the local API gateway described in
[[Zoe-System-Overview]] and complements the build dashboard flow in
[[Zoe-Build-Intelligence-Flow]].
