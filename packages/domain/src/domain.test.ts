import { describe, expect, it } from "vitest";
import {
  aggregatePassiveHeatmap,
  buildTradePriceCheckRequest,
  normalizePoeNinjaBuild,
  parseTradeItemText,
  summarizeBuild
} from "./index";

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
  const rareRingText = `Item Class: Rings
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
+23 to Strength`;

  it("parses rare item text and creates pseudo resistance filters", () => {
    const item = parseTradeItemText(rareRingText);

    expect(item.itemClass).toBe("Rings");
    expect(item.rarity).toBe("Rare");
    expect(item.name).toBe("Storm Loop");
    expect(item.baseType).toBe("Ruby Ring");
    expect(item.itemLevel).toBe(80);
    expect(item.parseWarnings).toEqual([]);
    expect(item.modifiers).toHaveLength(5);
    expect(item.pseudoSuggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "pseudo-total-elemental-resistance", value: 30 }),
        expect.objectContaining({ id: "pseudo-total-chaos-resistance", value: 12 })
      ])
    );

    const fireExact = item.statCandidates.find((candidate) =>
      candidate.label.includes("Fire Resistance")
    );
    const elementalPseudo = item.statCandidates.find(
      (candidate) => candidate.id === "pseudo-total-elemental-resistance"
    );
    const strengthExact = item.statCandidates.find((candidate) =>
      candidate.label.includes("Strength")
    );
    expect(fireExact?.enabled).toBe(false);
    expect(elementalPseudo?.enabled).toBe(true);
    expect(strengthExact).toMatchObject({
      enabled: true,
      min: 23,
      normalizedText: "# to strength",
      source: "explicit"
    });
  });

  it("builds a price-check request from enabled exact and pseudo filters", () => {
    const item = parseTradeItemText(rareRingText);
    const request = buildTradePriceCheckRequest(item, "Standard", item.statCandidates, 5);

    expect(request.item).toBe(item);
    expect(request.league).toBe("Standard");
    expect(request.limit).toBe(5);
    expect(request.onlineOnly).toBe(true);
    expect(request.filters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "pseudo-total-elemental-resistance",
          min: 30,
          source: "pseudo"
        }),
        expect.objectContaining({
          id: "exact-mod-4",
          label: "+23 to Strength",
          min: 23,
          source: "explicit"
        })
      ])
    );
    expect(request.filters.some((filter) => filter.label.includes("Fire Resistance"))).toBe(false);
  });

  it("creates deterministic pseudo suggestions for high-value trade stats", () => {
    const item = parseTradeItemText(`Item Class: Rings
Rarity: Rare
Glyph Band
Amethyst Ring
--------
Explicit Modifiers:
+10% to Fire Resistance
+11% to Cold Resistance
+12% to Lightning Resistance
+7% to all Elemental Resistances
+8% to Chaos Resistance
+50 to maximum Life
+40 to maximum Mana
+30 to maximum Energy Shield
+5 to Strength
+5 to Dexterity
+5 to Intelligence
+6 to all Attributes`);

    expect(item.pseudoSuggestions).toEqual([
      {
        id: "pseudo-total-elemental-resistance",
        label: "Pseudo: total elemental resistance",
        value: 54,
        min: 54,
        coveredModifierIds: ["mod-0", "mod-1", "mod-2", "mod-3"]
      },
      {
        id: "pseudo-total-chaos-resistance",
        label: "Pseudo: total chaos resistance",
        value: 8,
        min: 8,
        coveredModifierIds: ["mod-4"]
      },
      {
        id: "pseudo-total-maximum-life",
        label: "Pseudo: total maximum life",
        value: 50,
        min: 50,
        coveredModifierIds: ["mod-5"]
      },
      {
        id: "pseudo-total-maximum-mana",
        label: "Pseudo: total maximum mana",
        value: 40,
        min: 40,
        coveredModifierIds: ["mod-6"]
      },
      {
        id: "pseudo-total-maximum-energy-shield",
        label: "Pseudo: total maximum energy shield",
        value: 30,
        min: 30,
        coveredModifierIds: ["mod-7"]
      },
      {
        id: "pseudo-total-attributes",
        label: "Pseudo: total attributes",
        value: 33,
        min: 33,
        coveredModifierIds: ["mod-8", "mod-9", "mod-10", "mod-11"]
      }
    ]);

    expect(item.statCandidates.filter((candidate) => candidate.source === "pseudo")).toEqual(
      item.pseudoSuggestions.map((suggestion) =>
        expect.objectContaining({
          id: suggestion.id,
          label: suggestion.label,
          value: suggestion.value,
          min: suggestion.min,
          enabled: true,
          coveredModifierIds: suggestion.coveredModifierIds,
          tradeStatId: undefined
        })
      )
    );
  });

  it("handles malformed clipboard text without throwing", () => {
    const item = parseTradeItemText("not an item");

    expect(item.modifiers).toHaveLength(0);
    expect(item.parseWarnings).toHaveLength(1);
  });

  it("parses common item text sections and section-scoped modifier sources", () => {
    const item = parseTradeItemText(`Item Class: Quarterstaves
Rarity: Unique
Pillar of the Caged God
Long Quarterstaff
--------
Quality: +20%
--------
Requirements:
Level: 22
Dex: 42
Int: 42
--------
Sockets: S S
Rune Sockets: 2
Charm Slots: 1
--------
Item Level: 84
--------
Implicit Modifiers:
+12% to Global Critical Strike Chance
--------
Enchant Modifiers:
+5% increased Attack Speed
--------
Fractured Modifiers:
+25 to Strength
--------
Explicit Modifiers:
+20% increased Damage
+10% to Fire Resistance
--------
Crafted Modifiers:
+15 to maximum Mana
--------
Corrupted`);

    expect(item.itemClass).toBe("Quarterstaves");
    expect(item.rarity).toBe("Unique");
    expect(item.name).toBe("Pillar of the Caged God");
    expect(item.baseType).toBe("Long Quarterstaff");
    expect(item.quality).toBe(20);
    expect(item.itemLevel).toBe(84);
    expect(item.requirements).toEqual(["Level: 22", "Dex: 42", "Int: 42"]);
    expect(item.sockets).toEqual(["Sockets: S S", "Rune Sockets: 2", "Charm Slots: 1"]);
    expect(item.parseWarnings).toEqual([]);
    expect(item.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "implicit",
          text: "+12% to Global Critical Strike Chance"
        }),
        expect.objectContaining({ source: "enchant", text: "+5% increased Attack Speed" }),
        expect.objectContaining({ source: "fractured", text: "+25 to Strength" }),
        expect.objectContaining({ source: "explicit", text: "+20% increased Damage" }),
        expect.objectContaining({ source: "crafted", text: "+15 to maximum Mana" })
      ])
    );
  });

  it("preserves unsupported section lines as targeted parse warnings", () => {
    const item = parseTradeItemText(`Item Class: Rings
Rarity: Rare
Rune Loop
Amethyst Ring
--------
Explicit Modifiers:
+12% to Chaos Resistance
Requires unsupported omen
--------
Veiled Modifiers:
+10 to Dexterity`);

    expect(item.modifiers).toEqual([
      expect.objectContaining({ source: "explicit", text: "+12% to Chaos Resistance" }),
      expect.objectContaining({ source: "explicit", text: "+10 to Dexterity" })
    ]);
    expect(item.parseWarnings).toEqual([
      "Unsupported explicit modifier line: Requires unsupported omen",
      "Unsupported item text line: Veiled Modifiers:"
    ]);
  });

  it("normalizes ranges, signed values, local tags, and source markers for candidates", () => {
    const item = parseTradeItemText(`Item Class: One Hand Maces
Rarity: Rare
Gale Crusher
War Hammer
--------
Explicit Modifiers:
Adds 12 to 24 Physical Damage
20-30% increased Physical Damage (local)
-10% to Fire Resistance (fractured)
+14% to Cold Resistance
+8% to Lightning Resistance`);

    expect(item.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: "Adds 12 to 24 Physical Damage",
          normalizedText: "adds # to # physical damage",
          values: [12, 24]
        }),
        expect.objectContaining({
          text: "20-30% increased Physical Damage (local)",
          normalizedText: "#-#% increased physical damage",
          values: [20, 30]
        }),
        expect.objectContaining({
          text: "-10% to Fire Resistance (fractured)",
          normalizedText: "#% to fire resistance",
          source: "fractured",
          values: [-10]
        })
      ])
    );

    expect(item.statCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Adds 12 to 24 Physical Damage",
          min: 24,
          value: 24
        }),
        expect.objectContaining({
          label: "20-30% increased Physical Damage (local)",
          min: 30,
          value: 30
        })
      ])
    );
  });

  it("covers all elemental resistance modifiers in total elemental resistance", () => {
    const item = parseTradeItemText(`Item Class: Rings
Rarity: Rare
Storm Loop
Ruby Ring
--------
Explicit Modifiers:
+20% to Fire Resistance
+11% to Cold Resistance
+7% to Lightning Resistance
+9% to all Elemental Resistances`);

    const elementalPseudo = item.statCandidates.find(
      (candidate) => candidate.id === "pseudo-total-elemental-resistance"
    );
    const allElementalExact = item.statCandidates.find((candidate) =>
      candidate.label.includes("all Elemental Resistances")
    );

    expect(elementalPseudo).toMatchObject({
      enabled: true,
      value: 65,
      coveredModifierIds: ["mod-0", "mod-1", "mod-2", "mod-3"]
    });
    expect(allElementalExact).toMatchObject({
      enabled: false,
      min: 9
    });
  });
});
