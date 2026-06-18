import type { PoeNinjaBuildPayload } from "@zoe/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  aggregateHeatmaps,
  ingestPoeNinja,
  persistFixtureBuildIntelligence,
  summarizeBuilds
} from "./jobs";

const fixedNow = new Date("2026-06-18T12:00:00.000Z");
const capturedAt = "2026-06-18T00:00:00.000Z";
const summaryGeneratedAt = "2026-06-18T00:01:00.000Z";
const heatmapGeneratedAt = "2026-06-18T00:02:00.000Z";

const upstreamBuilds: PoeNinjaBuildPayload[] = [
  {
    id: "upstream:grenadier",
    accountName: "zoe",
    characterName: "MockedGrenadier",
    className: "Mercenary",
    ascendancyName: "Witchhunter",
    level: 91,
    league: "Dawn of the Hunt",
    rank: 11,
    skills: [
      { name: "Explosive Grenade", usageCount: 9 },
      { name: "Flash Grenade", usageCount: 2 }
    ],
    items: [
      { slot: "crossbow", name: "Expert Bombard Crossbow", rarity: "Rare" },
      { slot: "boots", name: "Plated Boots", rarity: "Rare", baseType: "Armour Boots" }
    ],
    passives: [
      { id: "grenade-cluster", name: "Grenade Cluster", count: 5, x: 10, y: 20 },
      { id: "grenade-cluster", name: "Grenade Cluster", count: 4, x: 10, y: 20 },
      { id: "crossbow-cluster", name: "Crossbow Cluster", count: 3 }
    ]
  }
];

describe("worker jobs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ingests fixture poe.ninja payloads with deterministic capture timestamps", async () => {
    const builds = await ingestPoeNinja({ capturedAt });

    expect(builds[0]?.metadata.characterName).toBe("GrenadeMap");
    expect(builds[0]?.capturedAt).toBe(capturedAt);
    expect(builds[0]?.source).toBe("poe.ninja");
    expect(builds[0]?.mainSkills).toEqual([
      { id: "explosive-grenade", name: "Explosive Grenade", usageCount: 7 }
    ]);
  });

  it("normalizes mocked upstream poe.ninja payloads without network calls", async () => {
    const fetchBuilds = vi.fn(async () => upstreamBuilds);

    const builds = await ingestPoeNinja({ fetchBuilds, capturedAt });

    expect(fetchBuilds).toHaveBeenCalledOnce();
    expect(builds).toHaveLength(1);
    expect(builds[0]?.metadata).toMatchObject({
      id: "upstream:grenadier",
      characterName: "MockedGrenadier",
      level: 91,
      league: "Dawn of the Hunt",
      rank: 11
    });
    expect(builds[0]?.capturedAt).toBe(capturedAt);
  });

  it("summarizes ingested builds with deterministic generated timestamps", async () => {
    const builds = await ingestPoeNinja({ fetchBuilds: () => upstreamBuilds, capturedAt });

    const summaries = await summarizeBuilds({ builds, generatedAt: summaryGeneratedAt });

    expect(summaries[0]?.primarySkill).toBe("Explosive Grenade");
    expect(summaries[0]).toMatchObject({
      id: "summary:upstream:grenadier",
      buildId: "upstream:grenadier",
      title: "MockedGrenadier build summary",
      defensiveLayers: ["armour"],
      generatedAt: summaryGeneratedAt
    });
    expect(summaries[0]?.highlights).toContain("Level 91");
  });

  it("aggregates passive heatmaps deterministically from mocked build data", async () => {
    const builds = await ingestPoeNinja({ fetchBuilds: () => upstreamBuilds, capturedAt });

    const heatmap = await aggregateHeatmaps({
      builds,
      league: "Dawn of the Hunt",
      generatedAt: heatmapGeneratedAt
    });

    expect(heatmap.points[0]?.passiveId).toBe("grenade-cluster");
    expect(heatmap).toEqual({
      kind: "passives",
      league: "Dawn of the Hunt",
      generatedAt: heatmapGeneratedAt,
      points: [
        {
          passiveId: "grenade-cluster",
          name: "Grenade Cluster",
          x: 10,
          y: 20,
          weight: 9
        },
        {
          passiveId: "crossbow-cluster",
          name: "Crossbow Cluster",
          x: undefined,
          y: undefined,
          weight: 3
        }
      ]
    });
  });

  it("persists fixture build intelligence through mocked database calls", async () => {
    const queries: unknown[][] = [];
    const client = {
      query: async (_text: string, values?: unknown[]) => {
        queries.push(values ?? []);
        return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
      }
    };

    const counts = await persistFixtureBuildIntelligence(client, {
      capturedAt,
      summaryGeneratedAt,
      heatmapGeneratedAt
    });

    expect(counts).toEqual({
      builds: 1,
      summaries: 1,
      heatmapPoints: 1
    });
    expect(queries).toHaveLength(4);
    expect(queries[0]?.[0]).toBe("fixture:grenadier");
    expect(queries[0]?.[8]).toBe(capturedAt);
    expect(queries[1]?.[7]).toBe(summaryGeneratedAt);
    expect(queries[2]?.[3]).toBe(heatmapGeneratedAt);
    expect(queries[3]?.[7]).toBe(heatmapGeneratedAt);
  });
});
