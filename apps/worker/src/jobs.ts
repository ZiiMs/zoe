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
