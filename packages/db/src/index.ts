import pg from "pg";
import type { BuildSnapshot, BuildSummary, HeatmapAggregate } from "@zoe/domain";

const allClassesHeatmapKey = "all";

export interface DatabaseOptions {
  connectionString: string;
}

export interface DbQueryClient {
  query(text: string, values?: unknown[]): Promise<pg.QueryResult>;
}

export interface StoredRecordCounts {
  builds: number;
  summaries: number;
  heatmapPoints: number;
}

export function createPool(options: DatabaseOptions): pg.Pool {
  return new pg.Pool({
    connectionString: options.connectionString
  });
}

export async function checkDatabase(client: DbQueryClient): Promise<boolean> {
  const result = await client.query("select 1 as ok");
  return (result.rows[0] as { ok?: number } | undefined)?.ok === 1;
}

export async function storeBuildSnapshot(
  client: DbQueryClient,
  build: BuildSnapshot
): Promise<void> {
  await client.query(
    `
      insert into build_snapshots (
        id,
        league,
        class_name,
        ascendancy_name,
        level,
        account_name,
        character_name,
        source,
        captured_at,
        payload
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      on conflict (id) do update set
        league = excluded.league,
        class_name = excluded.class_name,
        ascendancy_name = excluded.ascendancy_name,
        level = excluded.level,
        account_name = excluded.account_name,
        character_name = excluded.character_name,
        source = excluded.source,
        captured_at = excluded.captured_at,
        payload = excluded.payload
    `,
    [
      build.metadata.id,
      build.metadata.league,
      build.metadata.className,
      build.metadata.ascendancyName ?? null,
      build.metadata.level,
      build.metadata.accountName,
      build.metadata.characterName,
      build.source,
      build.capturedAt,
      JSON.stringify(build)
    ]
  );
}

export async function storeBuildSnapshots(
  client: DbQueryClient,
  builds: BuildSnapshot[]
): Promise<number> {
  for (const build of builds) {
    await storeBuildSnapshot(client, build);
  }

  return builds.length;
}

export async function storeBuildSummary(
  client: DbQueryClient,
  summary: BuildSummary
): Promise<void> {
  await client.query(
    `
      insert into build_summaries (
        id,
        build_id,
        title,
        primary_skill,
        highlights,
        defensive_layers,
        generated_at
      ) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
      on conflict (id) do update set
        build_id = excluded.build_id,
        title = excluded.title,
        primary_skill = excluded.primary_skill,
        highlights = excluded.highlights,
        defensive_layers = excluded.defensive_layers,
        generated_at = excluded.generated_at
    `,
    [
      summary.id,
      summary.buildId,
      summary.title,
      summary.primarySkill ?? null,
      JSON.stringify(summary.highlights),
      JSON.stringify(summary.defensiveLayers),
      summary.generatedAt
    ]
  );
}

export async function storeBuildSummaries(
  client: DbQueryClient,
  summaries: BuildSummary[]
): Promise<number> {
  for (const summary of summaries) {
    await storeBuildSummary(client, summary);
  }

  return summaries.length;
}

export async function storeHeatmapAggregate(
  client: DbQueryClient,
  aggregate: HeatmapAggregate
): Promise<number> {
  if (aggregate.kind !== "passives") {
    throw new Error(`Unsupported heatmap aggregate kind: ${aggregate.kind}`);
  }

  for (const point of aggregate.points) {
    await client.query(
      `
        insert into passive_heatmap_points (
          league,
          class_name,
          passive_id,
          name,
          x,
          y,
          weight,
          generated_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8)
        on conflict (league, class_name, passive_id) do update set
          name = excluded.name,
          x = excluded.x,
          y = excluded.y,
          weight = excluded.weight,
          generated_at = excluded.generated_at
      `,
      [
        aggregate.league,
        aggregate.className ?? allClassesHeatmapKey,
        point.passiveId,
        point.name ?? null,
        point.x ?? null,
        point.y ?? null,
        point.weight,
        aggregate.generatedAt
      ]
    );
  }

  return aggregate.points.length;
}

export async function storeBuildIntelligence(
  client: DbQueryClient,
  records: {
    builds: BuildSnapshot[];
    summaries: BuildSummary[];
    heatmaps: HeatmapAggregate[];
  }
): Promise<StoredRecordCounts> {
  const builds = await storeBuildSnapshots(client, records.builds);
  const summaries = await storeBuildSummaries(client, records.summaries);
  let heatmapPoints = 0;

  for (const heatmap of records.heatmaps) {
    heatmapPoints += await storeHeatmapAggregate(client, heatmap);
  }

  return {
    builds,
    summaries,
    heatmapPoints
  };
}
