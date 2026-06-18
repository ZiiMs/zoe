import type { DbQueryClient, StoredRecordCounts } from "@zoe/db";
import { storeBuildIntelligence } from "@zoe/db";
import { aggregatePassiveHeatmap, normalizePoeNinjaBuild, summarizeBuild } from "@zoe/domain";
import { poeNinjaBuildFixture } from "./fixture";

export async function ingestPoeNinja() {
  return poeNinjaBuildFixture.map((payload) => normalizePoeNinjaBuild(payload));
}

export async function summarizeBuilds() {
  const builds = await ingestPoeNinja();
  return builds.map((build) => summarizeBuild(build));
}

export async function aggregateHeatmaps() {
  const builds = await ingestPoeNinja();
  return aggregatePassiveHeatmap(builds, "Dawn of the Hunt");
}

export async function persistFixtureBuildIntelligence(
  client: DbQueryClient
): Promise<StoredRecordCounts> {
  const builds = await ingestPoeNinja();
  const summaries = builds.map((build) => summarizeBuild(build));
  const heatmap = aggregatePassiveHeatmap(builds, "Dawn of the Hunt");

  return storeBuildIntelligence(client, {
    builds,
    summaries,
    heatmaps: [heatmap]
  });
}
