import type { BuildSnapshot, BuildSummary, HeatmapAggregate } from "@zoe/domain";
import { describe, expect, it, vi } from "vitest";
import {
  checkDatabase,
  storeBuildIntelligence,
  storeBuildSnapshot,
  storeBuildSummary,
  storeHeatmapAggregate
} from "./index";

function createMockClient() {
  return {
    query: vi.fn(async (_text: string, _values?: unknown[]) => ({
      rows: [],
      rowCount: 0,
      command: "",
      oid: 0,
      fields: []
    }))
  };
}

const build: BuildSnapshot = {
  metadata: {
    id: "build-1",
    accountName: "zoe",
    characterName: "GrenadeMap",
    className: "Mercenary",
    ascendancyName: "Witchhunter",
    level: 90,
    league: "Dawn of the Hunt",
    rank: 7
  },
  mainSkills: [{ id: "explosive-grenade", name: "Explosive Grenade", usageCount: 1 }],
  items: [{ slot: "weapon", name: "Boomstick", rarity: "Rare", usageCount: 1 }],
  passives: [{ passiveId: "grenade-cluster", name: "Grenade Cluster", weight: 1 }],
  capturedAt: "2026-06-18T00:00:00.000Z",
  source: "poe.ninja"
};

const summary: BuildSummary = {
  id: "summary:build-1",
  buildId: "build-1",
  title: "GrenadeMap build summary",
  highlights: ["Mercenary Witchhunter", "Level 90"],
  primarySkill: "Explosive Grenade",
  defensiveLayers: ["armour"],
  generatedAt: "2026-06-18T00:01:00.000Z"
};

const heatmap: HeatmapAggregate = {
  kind: "passives",
  league: "Dawn of the Hunt",
  points: [{ passiveId: "grenade-cluster", name: "Grenade Cluster", weight: 3 }],
  generatedAt: "2026-06-18T00:02:00.000Z"
};

const itemHeatmap: HeatmapAggregate = {
  kind: "items",
  league: "Dawn of the Hunt",
  points: [{ passiveId: "Expert Bombard Crossbow", name: "Expert Bombard Crossbow", weight: 2 }],
  generatedAt: "2026-06-18T00:03:00.000Z"
};

describe("database persistence helpers", () => {
  it("checks database health through a generic query client", async () => {
    const client = {
      query: vi.fn(async (_text: string, _values?: unknown[]) => ({
        rows: [{ ok: 1 }],
        rowCount: 1,
        command: "",
        oid: 0,
        fields: []
      }))
    };

    await expect(checkDatabase(client)).resolves.toBe(true);

    expect(client.query).toHaveBeenCalledWith("select 1 as ok");
  });

  it("stores normalized build snapshots with the full payload for debugging", async () => {
    const client = createMockClient();

    await storeBuildSnapshot(client, build);

    expect(client.query).toHaveBeenCalledTimes(1);
    const values = client.query.mock.calls[0]?.[1];
    expect(values?.[0]).toBe("build-1");
    expect(values?.[1]).toBe("Dawn of the Hunt");
    expect(values?.[9]).toBe(
      JSON.stringify({
        id: "build-1",
        league: "Dawn of the Hunt",
        source: "poe.ninja",
        capturedAt: "2026-06-18T00:00:00.000Z",
        accountName: "zoe",
        characterName: "GrenadeMap",
        rank: 7
      })
    );
    expect(values?.[10]).toBe(JSON.stringify(build));
    expect(client.query.mock.calls[0]?.[0]).toContain("on conflict (id, league)");
  });

  it("upserts build summaries by build, league, and generated timestamp", async () => {
    const client = createMockClient();

    await storeBuildSummary(client, summary, {
      buildLeague: "Dawn of the Hunt",
      sourceSnapshot: { sourceBuildId: "build-1" }
    });

    const queryText = client.query.mock.calls[0]?.[0];
    const values = client.query.mock.calls[0]?.[1];
    expect(queryText).toContain("on conflict (build_id, build_league, generated_at)");
    expect(values?.[1]).toBe("build-1");
    expect(values?.[2]).toBe("Dawn of the Hunt");
    expect(values?.[7]).toBe("2026-06-18T00:01:00.000Z");
    expect(values?.[8]).toBe(JSON.stringify({ sourceBuildId: "build-1" }));
  });

  it("stores league-wide heatmaps with an explicit all-classes key", async () => {
    const client = createMockClient();

    await expect(storeHeatmapAggregate(client, heatmap)).resolves.toBe(1);

    expect(client.query.mock.calls[0]?.[0]).toContain("on conflict (league, kind, class_name)");
    expect(client.query.mock.calls[0]?.[1]?.[1]).toBe("passives");

    const values = client.query.mock.calls[1]?.[1];
    expect(values?.[0]).toBe("Dawn of the Hunt");
    expect(values?.[1]).toBe("all");
    expect(values?.[2]).toBe("grenade-cluster");
  });

  it("upserts item heatmap aggregates without requiring passive point storage", async () => {
    const client = createMockClient();

    await expect(storeHeatmapAggregate(client, itemHeatmap)).resolves.toBe(1);

    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.query.mock.calls[0]?.[1]).toEqual([
      "Dawn of the Hunt",
      "items",
      "all",
      "2026-06-18T00:03:00.000Z",
      JSON.stringify(itemHeatmap)
    ]);
  });

  it("stores build intelligence records without requiring a real Postgres connection", async () => {
    const client = createMockClient();

    await expect(
      storeBuildIntelligence(client, {
        builds: [build],
        summaries: [summary],
        heatmaps: [heatmap]
      })
    ).resolves.toEqual({
      builds: 1,
      summaries: 1,
      heatmapPoints: 1
    });

    expect(client.query).toHaveBeenCalledTimes(4);
  });
});
