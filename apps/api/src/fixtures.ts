import { aggregatePassiveHeatmap, normalizePoeNinjaBuild, summarizeBuild } from "@zoe/domain";

const capturedAt = "2026-06-05T12:00:00.000Z";

export const fixtureBuilds = [
  fixtureBuild({
    id: "fixture:spark-stormweaver",
    accountName: "zoe",
    characterName: "StormIndex",
    className: "Sorceress",
    ascendancyName: "Stormweaver",
    level: 92,
    league: "Dawn of the Hunt",
    rank: 42,
    skills: [
      { name: "Spark", usageCount: 10 },
      { name: "Orb of Storms", usageCount: 5 }
    ],
    items: [
      { slot: "weapon", name: "Voltaxic Wand", baseType: "Wand", rarity: "Rare" },
      {
        slot: "body",
        name: "Expert Hexer's Robe",
        baseType: "Energy Shield Armour",
        rarity: "Rare"
      }
    ],
    passives: [
      { id: "lightning-walker", name: "Lightning Walker", x: 10, y: 20, count: 8 },
      { id: "raw-power", name: "Raw Power", x: 14, y: 26, count: 6 }
    ],
    metrics: {
      highestDpsSkill: "Spark",
      highestDpsSkillIconUrl:
        "https://web.poecdn.com/image/Art/2DItems/Gems/Spark.png?scale=1&w=1&h=1",
      dpsLabel: "1.6M",
      life: 2140,
      energyShield: 7820,
      ehpLabel: "48.2K"
    }
  }),
  fixtureBuild({
    id: "fixture:grenade-witchhunter",
    accountName: "caffeinated",
    characterName: "GrenadePress",
    className: "Mercenary",
    ascendancyName: "Witchhunter",
    level: 94,
    league: "Runes of Aldur",
    rank: 18,
    skills: [
      { name: "Explosive Grenade", usageCount: 12 },
      { name: "Flash Grenade", usageCount: 7 }
    ],
    items: [
      { slot: "weapon", name: "Expert Bombard Crossbow", baseType: "Crossbow", rarity: "Rare" },
      { slot: "helmet", name: "Crown of the Victor", baseType: "Greathelm", rarity: "Unique" }
    ],
    passives: [
      { id: "grenadier", name: "Grenadier", x: 20, y: 12, count: 11 },
      { id: "close-quarters", name: "Close Quarters", x: 26, y: 16, count: 7 }
    ],
    metrics: {
      highestDpsSkill: "Explosive Grenade",
      dpsLabel: "2.4M",
      life: 3150,
      energyShield: 410,
      ehpLabel: "35.9K"
    }
  }),
  fixtureBuild({
    id: "fixture:quarterstaff-invoker",
    accountName: "beanrunner",
    characterName: "MonkBrew",
    className: "Monk",
    ascendancyName: "Invoker",
    level: 91,
    league: "Runes of Aldur",
    rank: 73,
    skills: [
      { name: "Tempest Flurry", usageCount: 9 },
      { name: "Charged Staff", usageCount: 6 }
    ],
    items: [
      {
        slot: "weapon",
        name: "Expert Gothic Quarterstaff",
        baseType: "Quarterstaff",
        rarity: "Rare"
      },
      { slot: "gloves", name: "Grip of Thunder", baseType: "Gloves", rarity: "Unique" }
    ],
    passives: [
      { id: "resonance", name: "Resonance", x: 30, y: 20, count: 5 },
      { id: "flow-like-water", name: "Flow Like Water", x: 35, y: 22, count: 8 }
    ],
    metrics: {
      highestDpsSkill: "Tempest Flurry",
      dpsLabel: "1.1M",
      life: 2840,
      energyShield: 960,
      ehpLabel: "31.4K"
    }
  })
];

export const fixturePoeNinjaBuildIndex = {
  fetchedAt: capturedAt,
  leagueBuilds: [
    {
      leagueName: "Runes of Aldur",
      leagueUrl: "runesofaldur",
      total: 124264,
      status: 0,
      statistics: [
        { className: "Martial Artist", percentage: 24.57, trend: 1 as const },
        { className: "Spirit Walker", percentage: 17.79, trend: 1 as const },
        { className: "Deadeye", percentage: 14.21, trend: 1 as const },
        { className: "Oracle", percentage: 5.01, trend: 1 as const },
        { className: "Tactician", percentage: 4.59, trend: 1 as const }
      ]
    }
  ]
};

export const fixtureSummaries = fixtureBuilds.map((build) => summarizeBuild(build, capturedAt));
export const fixturePassiveHeatmap = aggregatePassiveHeatmap(
  fixtureBuilds,
  "Dawn of the Hunt",
  capturedAt
);

function fixtureBuild(payload: Parameters<typeof normalizePoeNinjaBuild>[0]) {
  return {
    ...normalizePoeNinjaBuild(payload, capturedAt),
    source: "fixture" as const
  };
}
