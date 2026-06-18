import { describe, expect, it } from "vitest";
import {
  calculateQuickPanelPosition,
  constrainSettingsPosition,
  formatItemLevel,
  formatLeagueLabel,
  formatListedAge,
  formatPrice,
  formatQuickModifier,
  panelMargin,
  selectTradeLeague
} from "./overlay-helpers";
import type { TradeLeague, TradeListing } from "@zoe/domain";

const leagues: TradeLeague[] = [
  { id: "Hardcore Dawn of the Hunt", text: "Hardcore Dawn of the Hunt", realm: "poe2" },
  { id: "Dawn of the Hunt", text: "Dawn of the Hunt", realm: "poe2" },
  { id: "Standard", text: "Standard", realm: "poe2" },
  { id: "Settlers", text: "Settlers", realm: "pc" }
];

describe("desktop overlay helpers", () => {
  it("keeps a valid current league and otherwise prefers non-hardcore PoE2 leagues", () => {
    expect(selectTradeLeague(leagues, "Standard")).toBe("Standard");
    expect(selectTradeLeague(leagues, "Missing")).toBe("Dawn of the Hunt");
    expect(
      selectTradeLeague(
        [{ id: "Hardcore Dawn of the Hunt", text: "Hardcore Dawn of the Hunt", realm: "poe2" }],
        ""
      )
    ).toBe("Hardcore Dawn of the Hunt");
    expect(selectTradeLeague([{ id: "Settlers", text: "Settlers", realm: "pc" }], "")).toBe(
      "Settlers"
    );
    expect(selectTradeLeague([], "")).toBe("");
  });

  it("formats league labels with loading and id fallbacks", () => {
    expect(formatLeagueLabel(leagues, "")).toBe("Loading league");
    expect(formatLeagueLabel(leagues, "Dawn of the Hunt")).toBe("Dawn of the Hunt");
    expect(formatLeagueLabel(leagues, "Unknown League")).toBe("Unknown League");
  });

  it("formats listing prices and item levels with missing-value fallbacks", () => {
    const pricedListing: TradeListing = {
      id: "listing-1",
      itemName: "Phoenix Band",
      priceAmount: 7,
      priceCurrency: "exalted"
    };
    const missingAmount: TradeListing = {
      id: "listing-2",
      itemName: "Ruby Ring",
      priceCurrency: "divine"
    };

    expect(formatPrice(pricedListing)).toBe("7 exalted");
    expect(formatPrice(missingAmount)).toBe("? divine");
    expect(formatPrice({ id: "listing-3", itemName: "Unknown" })).toBe("?");
    expect(formatItemLevel(82)).toBe("ilvl 82");
    expect(formatItemLevel()).toBe("ilvl --");
  });

  it("formats listed ages across practical listing ranges", () => {
    const now = Date.UTC(2026, 5, 18, 16, 0, 0);

    expect(formatListedAge(undefined, now)).toBe("unknown");
    expect(formatListedAge("not a date", now)).toBe("unknown");
    expect(formatListedAge(new Date(now - 10_000).toISOString(), now)).toBe("now");
    expect(formatListedAge(new Date(now - 15 * 60_000).toISOString(), now)).toBe("15m ago");
    expect(formatListedAge(new Date(now - 3 * 60 * 60_000).toISOString(), now)).toBe("3h ago");
    expect(formatListedAge(new Date(now - 12 * 24 * 60 * 60_000).toISOString(), now)).toBe(
      "12d ago"
    );
    expect(formatListedAge(new Date(now - 65 * 24 * 60 * 60_000).toISOString(), now)).toBe(
      "2mo ago"
    );
    expect(formatListedAge(new Date(now + 60_000).toISOString(), now)).toBe("now");
  });

  it("cleans parser modifier labels for dense quick rows", () => {
    expect(formatQuickModifier("Pseudo: total elemental resistance")).toBe(
      "total elemental resistance"
    );
    expect(formatQuickModifier("+34% to Fire Resistance (explicit)")).toBe("Fire Resistance");
    expect(formatQuickModifier("15% increased Rarity of Items found")).toBe(
      "Rarity of Items found"
    );
  });

  it("positions the quick panel near the cursor without overflowing the viewport", () => {
    expect(calculateQuickPanelPosition({ x: 900, y: 500 }, { width: 1200, height: 900 })).toEqual({
      x: 542,
      y: 192
    });
    expect(calculateQuickPanelPosition({ x: 20, y: 10 }, { width: 1200, height: 900 })).toEqual({
      x: 38,
      y: panelMargin
    });
    expect(calculateQuickPanelPosition({ x: 1160, y: 880 }, { width: 1200, height: 900 })).toEqual({
      x: 802,
      y: 192
    });
  });

  it("constrains settings panels inside desktop and compact viewports", () => {
    expect(constrainSettingsPosition({ x: -20, y: 900 }, { width: 1280, height: 900 })).toEqual({
      x: panelMargin,
      y: 162
    });
    expect(constrainSettingsPosition({ x: 400, y: 400 }, { width: 320, height: 240 })).toEqual({
      x: panelMargin,
      y: panelMargin
    });
  });
});
