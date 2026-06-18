import type { DbQueryClient, StoredRecordCounts } from "@zoe/db";
import { storeBuildIntelligence } from "@zoe/db";
import {
  aggregatePassiveHeatmap,
  normalizePoeNinjaBuild,
  summarizeBuild,
  type BuildSnapshot,
  type PoeNinjaBuildPayload
} from "@zoe/domain";
import { poeNinjaBuildFixture } from "./fixture";

interface IngestPoeNinjaOptions {
  fetchBuilds?: () => PoeNinjaBuildPayload[] | Promise<PoeNinjaBuildPayload[]>;
  capturedAt?: string | undefined;
}

interface SummarizeBuildsOptions {
  builds?: BuildSnapshot[] | undefined;
  ingest?: IngestPoeNinjaOptions | undefined;
  generatedAt?: string | undefined;
}

interface AggregateHeatmapsOptions {
  builds?: BuildSnapshot[] | undefined;
  ingest?: IngestPoeNinjaOptions | undefined;
  league?: string | undefined;
  generatedAt?: string | undefined;
}

interface PersistFixtureBuildIntelligenceOptions {
  capturedAt?: string | undefined;
  summaryGeneratedAt?: string | undefined;
  heatmapGeneratedAt?: string | undefined;
}

export async function ingestPoeNinja(options: IngestPoeNinjaOptions = {}) {
  const fetchBuilds = options.fetchBuilds ?? (() => poeNinjaBuildFixture);
  const payloads = await fetchBuilds();

  return payloads.map((payload) => normalizePoeNinjaBuild(payload, options.capturedAt));
}

export async function summarizeBuilds(options: SummarizeBuildsOptions = {}) {
  const builds = options.builds ?? (await ingestPoeNinja(options.ingest));
  return builds.map((build) => summarizeBuild(build, options.generatedAt));
}

export async function aggregateHeatmaps(options: AggregateHeatmapsOptions = {}) {
  const builds = options.builds ?? (await ingestPoeNinja(options.ingest));
  return aggregatePassiveHeatmap(
    builds,
    options.league ?? "Dawn of the Hunt",
    options.generatedAt
  );
}

export async function persistFixtureBuildIntelligence(
  client: DbQueryClient,
  options: PersistFixtureBuildIntelligenceOptions = {}
): Promise<StoredRecordCounts> {
  const builds = await ingestPoeNinja({ capturedAt: options.capturedAt });
  const summaries = builds.map((build) => summarizeBuild(build, options.summaryGeneratedAt));
  const heatmap = aggregatePassiveHeatmap(
    builds,
    "Dawn of the Hunt",
    options.heatmapGeneratedAt
  );

  return storeBuildIntelligence(client, {
    builds,
    summaries,
    heatmaps: [heatmap]
  });
}
