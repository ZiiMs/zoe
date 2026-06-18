import { describe, expect, it } from "vitest";
import { attachTradeStatIds, parseTradeItemText, type TradeStatGroup } from "./index";

const tradeStats: TradeStatGroup[] = [
  {
    id: "pseudo",
    label: "Pseudo",
    entries: [
      {
        id: "pseudo.pseudo_total_elemental_resistance",
        text: "Pseudo: total elemental resistance",
        type: "pseudo"
      },
      {
        id: "pseudo.pseudo_total_chaos_resistance",
        text: "Pseudo: total chaos resistance",
        type: "pseudo"
      },
      {
        id: "pseudo.pseudo_total_maximum_life",
        text: "Pseudo: total maximum life",
        type: "pseudo"
      },
      {
        id: "pseudo.pseudo_total_maximum_mana",
        text: "Pseudo: total maximum mana",
        type: "pseudo"
      }
    ]
  },
  {
    id: "implicit",
    label: "Implicit",
    entries: [
      {
        id: "implicit.stat_implicit_fire_resistance",
        text: "+#% to Fire Resistance",
        type: "implicit"
      },
      {
        id: "implicit.stat_implicit_global_critical_chance",
        text: "+#% to Global Critical Strike Chance",
        type: "implicit"
      }
    ]
  },
  {
    id: "explicit",
    label: "Explicit",
    entries: [
      {
        id: "explicit.stat_fire_resistance",
        text: "+#% to Fire Resistance",
        type: "explicit"
      },
      {
        id: "explicit.stat_cold_resistance",
        text: "+#% to Cold Resistance",
        type: "explicit"
      },
      {
        id: "explicit.stat_lightning_resistance",
        text: "+#% to Lightning Resistance",
        type: "explicit"
      },
      {
        id: "explicit.stat_all_elemental_resistances",
        text: "+#% to all Elemental Resistances",
        type: "explicit"
      },
      {
        id: "explicit.stat_chaos_resistance",
        text: "+#% to Chaos Resistance",
        type: "explicit"
      },
      {
        id: "explicit.stat_maximum_life",
        text: "+# to maximum Life",
        type: "explicit"
      },
      {
        id: "explicit.stat_attack_speed",
        text: "+#% increased Attack Speed",
        type: "explicit"
      },
      {
        id: "explicit.stat_added_physical_damage",
        text: "Adds # to # Physical Damage",
        type: "explicit"
      }
    ]
  },
  {
    id: "crafted",
    label: "Crafted",
    entries: [
      {
        id: "crafted.stat_maximum_mana",
        text: "+# to maximum Mana",
        type: "crafted"
      }
    ]
  },
  {
    id: "enchant",
    label: "Enchant",
    entries: [
      {
        id: "enchant.stat_attack_speed",
        text: "+#% increased Attack Speed",
        type: "enchant"
      }
    ]
  },
  {
    id: "fractured",
    label: "Fractured",
    entries: [
      {
        id: "fractured.stat_strength",
        text: "+# to Strength",
        type: "fractured"
      }
    ]
  }
];

describe("trade parser representative fixtures", () => {
  it("parses and maps a rare ring with resistance pseudo totals", () => {
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
Explicit Modifiers:
+15% to Lightning Resistance
+12% to Chaos Resistance
+64 to maximum Life`);

    const attached = attachTradeStatIds(item.statCandidates, tradeStats);

    expect(item).toMatchObject({
      itemClass: "Rings",
      rarity: "Rare",
      name: "Storm Loop",
      baseType: "Ruby Ring",
      itemLevel: 80,
      requirements: ["Level: 52"],
      parseWarnings: []
    });
    expect(item.modifiers).toEqual([
      expect.objectContaining({
        id: "mod-0",
        source: "implicit",
        normalizedText: "#% to fire resistance",
        values: [15]
      }),
      expect.objectContaining({
        id: "mod-1",
        source: "explicit",
        normalizedText: "#% to lightning resistance",
        values: [15]
      }),
      expect.objectContaining({
        id: "mod-2",
        source: "explicit",
        normalizedText: "#% to chaos resistance",
        values: [12]
      }),
      expect.objectContaining({
        id: "mod-3",
        source: "explicit",
        normalizedText: "# to maximum life",
        values: [64]
      })
    ]);
    expect(item.pseudoSuggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "pseudo-total-elemental-resistance",
          value: 30,
          coveredModifierIds: ["mod-0", "mod-1"]
        }),
        expect.objectContaining({
          id: "pseudo-total-chaos-resistance",
          value: 12,
          coveredModifierIds: ["mod-2"]
        }),
        expect.objectContaining({
          id: "pseudo-total-maximum-life",
          value: 64,
          coveredModifierIds: ["mod-3"]
        })
      ])
    );
    expect(
      attached.find((candidate) => candidate.id === "pseudo-total-elemental-resistance")
    ).toMatchObject({
      enabled: true,
      tradeStatId: "pseudo.pseudo_total_elemental_resistance"
    });
    expect(attached.find((candidate) => candidate.label.includes("Fire Resistance"))).toMatchObject(
      {
        enabled: false,
        tradeStatId: "implicit.stat_implicit_fire_resistance"
      }
    );
  });

  it("parses and maps a rare weapon with ranged, enchant, crafted, and fractured modifiers", () => {
    const item = parseTradeItemText(`Item Class: One Hand Maces
Rarity: Rare
Gale Crusher
War Hammer
--------
Quality: +20%
--------
Requirements:
Level: 45
Str: 95
--------
Item Level: 82
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
Adds 12 to 24 Physical Damage
20-30% increased Physical Damage (local)
--------
Crafted Modifiers:
+15 to maximum Mana`);

    const attached = attachTradeStatIds(item.statCandidates, tradeStats);

    expect(item).toMatchObject({
      itemClass: "One Hand Maces",
      rarity: "Rare",
      quality: 20,
      itemLevel: 82,
      requirements: ["Level: 45", "Str: 95"],
      parseWarnings: []
    });
    expect(item.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "explicit",
          text: "Adds 12 to 24 Physical Damage",
          normalizedText: "adds # to # physical damage",
          values: [12, 24]
        }),
        expect.objectContaining({
          source: "explicit",
          text: "20-30% increased Physical Damage (local)",
          normalizedText: "#-#% increased physical damage",
          values: [20, 30]
        }),
        expect.objectContaining({ source: "enchant", text: "+5% increased Attack Speed" }),
        expect.objectContaining({ source: "crafted", text: "+15 to maximum Mana" }),
        expect.objectContaining({ source: "fractured", text: "+25 to Strength" })
      ])
    );
    expect(
      attached.find((candidate) => candidate.label === "Adds 12 to 24 Physical Damage")
    ).toMatchObject({
      enabled: true,
      min: 24,
      tradeStatId: "explicit.stat_added_physical_damage"
    });
    expect(
      attached.find((candidate) => candidate.label === "+5% increased Attack Speed")
    ).toMatchObject({
      source: "enchant",
      tradeStatId: "enchant.stat_attack_speed"
    });
    expect(
      attached.find((candidate) => candidate.id === "pseudo-total-maximum-mana")
    ).toMatchObject({
      enabled: true,
      min: 15,
      tradeStatId: "pseudo.pseudo_total_maximum_mana"
    });
  });

  it("parses unique item metadata and keeps useful exact candidates mapped", () => {
    const item = parseTradeItemText(`Item Class: Body Armours
Rarity: Unique
Bramblejack
Rusted Cuirass
--------
Quality: +10%
--------
Requirements:
Level: 16
Str: 37
--------
Item Level: 70
--------
Implicit Modifiers:
+10% to Fire Resistance
--------
Explicit Modifiers:
+45 to maximum Life
+10% increased Attack Speed`);

    const attached = attachTradeStatIds(item.statCandidates, tradeStats);

    expect(item).toMatchObject({
      itemClass: "Body Armours",
      rarity: "Unique",
      name: "Bramblejack",
      baseType: "Rusted Cuirass",
      quality: 10,
      itemLevel: 70,
      parseWarnings: []
    });
    expect(item.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "implicit", text: "+10% to Fire Resistance" }),
        expect.objectContaining({ source: "explicit", text: "+45 to maximum Life" }),
        expect.objectContaining({ source: "explicit", text: "+10% increased Attack Speed" })
      ])
    );
    expect(
      attached.find((candidate) => candidate.id === "pseudo-total-maximum-life")
    ).toMatchObject({
      enabled: true,
      tradeStatId: "pseudo.pseudo_total_maximum_life"
    });
    expect(
      attached.find((candidate) => candidate.label === "+10% increased Attack Speed")
    ).toMatchObject({
      enabled: true,
      tradeStatId: "explicit.stat_attack_speed"
    });
  });

  it("parses socketed item metadata without treating sockets as stat candidates", () => {
    const item = parseTradeItemText(`Item Class: Bows
Rarity: Rare
Dread Bite
Advanced Shortbow
--------
Sockets: S S
Rune Sockets: 2
Charm Slots: 1
--------
Item Level: 76
--------
Explicit Modifiers:
+14% to Cold Resistance
+16% to Lightning Resistance`);

    expect(item.sockets).toEqual(["Sockets: S S", "Rune Sockets: 2", "Charm Slots: 1"]);
    expect(item.modifiers.map((modifier) => modifier.text)).toEqual([
      "+14% to Cold Resistance",
      "+16% to Lightning Resistance"
    ]);
    expect(item.statCandidates.some((candidate) => candidate.label.includes("Sockets"))).toBe(
      false
    );
    expect(item.pseudoSuggestions).toEqual([
      expect.objectContaining({
        id: "pseudo-total-elemental-resistance",
        value: 30,
        coveredModifierIds: ["mod-0", "mod-1"]
      })
    ]);
  });

  it("returns structured warnings for malformed clipboard text", () => {
    const item = parseTradeItemText(`Rarity Maybe
--------
Unknown Section:
requires a real item`);

    expect(item).toMatchObject({
      requirements: [],
      sockets: [],
      modifiers: [],
      statCandidates: [],
      pseudoSuggestions: []
    });
    expect(item.parseWarnings).toEqual(["Unsupported item text line: Unknown Section:"]);
  });

  it("aggregates mixed resistance modifiers and attaches pseudo stat ids", () => {
    const item = parseTradeItemText(`Item Class: Gloves
Rarity: Rare
Rune Knuckle
Fine Gloves
--------
Explicit Modifiers:
+12% to Fire Resistance
+13% to Cold Resistance
+8% to all Elemental Resistances
+17% to Chaos Resistance`);

    const attached = attachTradeStatIds(item.statCandidates, tradeStats);

    expect(item.pseudoSuggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "pseudo-total-elemental-resistance",
          value: 49,
          min: 49,
          coveredModifierIds: ["mod-0", "mod-1", "mod-2"]
        }),
        expect.objectContaining({
          id: "pseudo-total-chaos-resistance",
          value: 17,
          min: 17,
          coveredModifierIds: ["mod-3"]
        })
      ])
    );
    expect(
      attached.find((candidate) => candidate.id === "pseudo-total-elemental-resistance")
    ).toMatchObject({
      enabled: true,
      tradeStatId: "pseudo.pseudo_total_elemental_resistance"
    });
    expect(
      attached.find((candidate) => candidate.label === "+8% to all Elemental Resistances")
    ).toMatchObject({
      enabled: false,
      normalizedText: "#% to all elemental resistances",
      tradeStatId: "explicit.stat_all_elemental_resistances"
    });
    expect(
      attached.find((candidate) => candidate.id === "pseudo-total-chaos-resistance")
    ).toMatchObject({
      enabled: true,
      tradeStatId: "pseudo.pseudo_total_chaos_resistance"
    });
  });
});
