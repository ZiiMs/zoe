import { describe, expect, it } from "vitest";
import { aggregatePassiveHeatmap, normalizePoeNinjaBuild, parseTradeItemText, summarizeBuild } from "./index";

const capturedAt = "2026-06-05T12:00:00.000Z";

describe("domain normalization and summaries", () => {
  it("normalizes poe.ninja style build payloads", () => {
    const build = normalizePoeNinjaBuild(
      {
        accountName: "zoe",
        characterName: "Heatmapper",
        className: "Sorceress",
        level: 91,
        league: "Dawn of the Hunt",
        skills: [{ name: "Spark", count: 9 }],
        items: [{ slot: "weapon", name: "Rare Wand", rarity: "Rare" }],
        passives: [{ id: 123, name: "Lightning Walker", count: 2 }]
      },
      capturedAt
    );

    expect(build.metadata.id).toBe("zoe:Heatmapper");
    expect(build.mainSkills[0]?.id).toBe("spark");
    expect(build.passives[0]?.weight).toBe(2);
  });

  it("creates a concise build summary", () => {
    const build = normalizePoeNinjaBuild(
      {
        accountName: "zoe",
        characterName: "Summarized",
        className: "Mercenary",
        level: 88,
        skills: [{ gem: "Grenade", usageCount: 4 }]
      },
      capturedAt
    );

    const summary = summarizeBuild(build, capturedAt);

    expect(summary.primarySkill).toBe("Grenade");
    expect(summary.highlights).toContain("Level 88");
  });

  it("aggregates passive heatmap weights", () => {
    const build = normalizePoeNinjaBuild(
      {
        passives: [
          { id: "a", count: 1 },
          { id: "a", count: 3 },
          { id: "b", count: 2 }
        ]
      },
      capturedAt
    );

    const heatmap = aggregatePassiveHeatmap([build], "Standard", capturedAt);

    expect(heatmap.points[0]).toMatchObject({ passiveId: "a", weight: 4 });
  });
});

describe("trade item parsing", () => {
  it("parses rare item text and creates pseudo resistance filters", () => {
    const item = parseTradeItemText(`Item Class: Rings
Rarity: Rare
Storm Loop
Ruby Ring
--------
Requirements:
Level: 52
--------
Item Level: 80
--------
+15% to Fire Resistance (implicit)
--------
+15% to Lightning Resistance
+12% to Chaos Resistance
+64 to maximum Life
+23 to Strength`);

    expect(item.itemClass).toBe("Rings");
    expect(item.rarity).toBe("Rare");
    expect(item.name).toBe("Storm Loop");
    expect(item.baseType).toBe("Ruby Ring");
    expect(item.itemLevel).toBe(80);
    expect(item.modifiers).toHaveLength(5);
    expect(item.pseudoSuggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "pseudo-total-elemental-resistance", value: 30 }),
        expect.objectContaining({ id: "pseudo-total-chaos-resistance", value: 12 })
      ])
    );

    const fireExact = item.statCandidates.find((candidate) => candidate.label.includes("Fire Resistance"));
    const elementalPseudo = item.statCandidates.find((candidate) => candidate.id === "pseudo-total-elemental-resistance");
    expect(fireExact?.enabled).toBe(false);
    expect(elementalPseudo?.enabled).toBe(true);
  });

  it("handles malformed clipboard text without throwing", () => {
    const item = parseTradeItemText("not an item");

    expect(item.modifiers).toHaveLength(0);
    expect(item.parseWarnings).toHaveLength(1);
  });
});
