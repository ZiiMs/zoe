import type { PoeNinjaBuildPayload } from "@zoe/domain";

export const poeNinjaBuildFixture: PoeNinjaBuildPayload[] = [
  {
    id: "fixture:grenadier",
    accountName: "zoe",
    characterName: "GrenadeMap",
    className: "Mercenary",
    ascendancyName: "Witchhunter",
    level: 89,
    league: "Dawn of the Hunt",
    skills: [{ name: "Explosive Grenade", usageCount: 7 }],
    items: [{ slot: "crossbow", name: "Expert Bombard Crossbow", rarity: "Rare" }],
    passives: [{ id: "grenade-cluster", name: "Grenade Cluster", count: 5 }]
  }
];
