import { describe, expect, it } from "vitest";
import {
  aggregateHeatmaps,
  ingestPoeNinja,
  persistFixtureBuildIntelligence,
  summarizeBuilds
} from "./jobs";

describe("worker jobs", () => {
  it("ingests fixture poe.ninja payloads", async () => {
    const builds = await ingestPoeNinja();

    expect(builds[0]?.metadata.characterName).toBe("GrenadeMap");
  });

  it("summarizes ingested builds", async () => {
    const summaries = await summarizeBuilds();

    expect(summaries[0]?.primarySkill).toBe("Explosive Grenade");
  });

  it("aggregates passive heatmaps", async () => {
    const heatmap = await aggregateHeatmaps();

    expect(heatmap.points[0]?.passiveId).toBe("grenade-cluster");
  });

  it("persists fixture build intelligence through an explicit database boundary", async () => {
    const queries: unknown[][] = [];
    const client = {
      query: async (_text: string, values?: unknown[]) => {
        queries.push(values ?? []);
        return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
      }
    };

    const counts = await persistFixtureBuildIntelligence(client);

    expect(counts).toEqual({
      builds: 1,
      summaries: 1,
      heatmapPoints: 1
    });
    expect(queries).toHaveLength(3);
    expect(queries[0]?.[0]).toBe("fixture:grenadier");
  });
});
