import { describe, expect, it } from "vitest";
import { aggregateHeatmaps, ingestPoeNinja, summarizeBuilds } from "./jobs";

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
});
