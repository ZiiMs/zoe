import pg from "pg";
import type { BuildSearchParams, BuildSnapshot, BuildSummary, HeatmapAggregate } from "@zoe/domain";

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

interface BuildSourceMetadata {
  id: string;
  league: string;
  source: BuildSnapshot["source"];
  capturedAt: string;
  accountName: string;
  characterName: string;
  rank?: number | undefined;
}

interface SummaryStorageOptions {
  buildLeague?: string | undefined;
  sourceSnapshot?: unknown;
}

export interface ReadBuildSnapshotsOptions extends BuildSearchParams {
  limit?: number | undefined;
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

export async function readBuildSnapshots(
  client: DbQueryClient,
  options: ReadBuildSnapshotsOptions = {}
): Promise<BuildSnapshot[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (options.league) {
    values.push(options.league);
    conditions.push(`league = $${values.length}`);
  }

  if (options.search) {
    values.push(`%${options.search}%`);
    conditions.push(
      `(account_name ilike $${values.length} or character_name ilike $${values.length})`
    );
  }

  if (options.className?.length) {
    values.push(options.className);
    conditions.push(
      `(class_name = any($${values.length}::text[]) or ascendancy_name = any($${values.length}::text[]))`
    );
  }

  values.push(options.limit ?? 100);
  const limitPlaceholder = `$${values.length}`;
  const result = await client.query(
    `
      select payload
      from build_snapshots
      ${conditions.length ? `where ${conditions.join(" and ")}` : ""}
      order by captured_at desc, level desc
      limit ${limitPlaceholder}
    `,
    values
  );

  return result.rows.map((row) =>
    normalizeJsonb<BuildSnapshot>((row as { payload: unknown }).payload)
  );
}

export async function readBuildSnapshot(
  client: DbQueryClient,
  id: string
): Promise<BuildSnapshot | undefined> {
  const result = await client.query(
    `
      select payload
      from build_snapshots
      where id = $1
         or (league || ':' || account_name || ':' || character_name) = $1
      order by captured_at desc
      limit 1
    `,
    [id]
  );
  const row = result.rows[0] as { payload?: unknown } | undefined;
  return row ? normalizeJsonb<BuildSnapshot>(row.payload) : undefined;
}

export async function readBuildSummaries(client: DbQueryClient): Promise<BuildSummary[]> {
  const result = await client.query(
    `
      select
        id,
        build_id,
        title,
        primary_skill,
        highlights,
        defensive_layers,
        generated_at
      from build_summaries
      order by generated_at desc
      limit 100
    `
  );

  return result.rows.map((row) => {
    const record = row as Record<string, unknown>;
    const primarySkill = stringOrUndefined(record.primary_skill);
    return {
      id: String(record.id),
      buildId: String(record.build_id),
      title: String(record.title),
      highlights: normalizeJsonb<string[]>(record.highlights),
      ...(primarySkill ? { primarySkill } : {}),
      defensiveLayers: normalizeJsonb<string[]>(record.defensive_layers),
      generatedAt: dateString(record.generated_at)
    };
  });
}

export async function readHeatmapAggregate(
  client: DbQueryClient,
  kind: HeatmapAggregate["kind"],
  league?: string
): Promise<HeatmapAggregate | undefined> {
  const values: unknown[] = [kind, allClassesHeatmapKey];
  const leagueClause = league ? "and league = $3" : "";
  if (league) {
    values.push(league);
  }

  const result = await client.query(
    `
      select payload
      from heatmap_aggregates
      where kind = $1
        and class_name = $2
        ${leagueClause}
      order by generated_at desc
      limit 1
    `,
    values
  );
  const row = result.rows[0] as { payload?: unknown } | undefined;
  return row ? normalizeJsonb<HeatmapAggregate>(row.payload) : undefined;
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
        source_metadata,
        payload
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)
      on conflict (id, league) do update set
        league = excluded.league,
        class_name = excluded.class_name,
        ascendancy_name = excluded.ascendancy_name,
        level = excluded.level,
        account_name = excluded.account_name,
        character_name = excluded.character_name,
        source = excluded.source,
        captured_at = excluded.captured_at,
        source_metadata = excluded.source_metadata,
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
      JSON.stringify(createBuildSourceMetadata(build)),
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
  summary: BuildSummary,
  options: SummaryStorageOptions = {}
): Promise<void> {
  const buildLeague = options.buildLeague ?? "Unknown";
  const sourceSnapshot = options.sourceSnapshot ?? {
    buildId: summary.buildId,
    generatedAt: summary.generatedAt
  };

  await client.query(
    `
      insert into build_summaries (
        id,
        build_id,
        build_league,
        title,
        primary_skill,
        highlights,
        defensive_layers,
        generated_at,
        source_snapshot
      ) values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9::jsonb)
      on conflict (build_id, build_league, generated_at) do update set
        id = excluded.id,
        build_id = excluded.build_id,
        build_league = excluded.build_league,
        title = excluded.title,
        primary_skill = excluded.primary_skill,
        highlights = excluded.highlights,
        defensive_layers = excluded.defensive_layers,
        generated_at = excluded.generated_at,
        source_snapshot = excluded.source_snapshot
    `,
    [
      summary.id,
      summary.buildId,
      buildLeague,
      summary.title,
      summary.primarySkill ?? null,
      JSON.stringify(summary.highlights),
      JSON.stringify(summary.defensiveLayers),
      summary.generatedAt,
      JSON.stringify(sourceSnapshot)
    ]
  );
}

export async function storeBuildSummaries(
  client: DbQueryClient,
  summaries: BuildSummary[],
  buildSnapshotsById: Map<string, BuildSnapshot> = new Map()
): Promise<number> {
  for (const summary of summaries) {
    const build = buildSnapshotsById.get(summary.buildId);
    await storeBuildSummary(
      client,
      summary,
      build
        ? {
            buildLeague: build.metadata.league,
            sourceSnapshot: createSummarySourceSnapshot(build, summary)
          }
        : {}
    );
  }

  return summaries.length;
}

export async function storeHeatmapAggregate(
  client: DbQueryClient,
  aggregate: HeatmapAggregate
): Promise<number> {
  const className = aggregate.className ?? allClassesHeatmapKey;

  await client.query(
    `
      insert into heatmap_aggregates (
        league,
        kind,
        class_name,
        generated_at,
        payload
      ) values ($1, $2, $3, $4, $5::jsonb)
      on conflict (league, kind, class_name) do update set
        generated_at = excluded.generated_at,
        payload = excluded.payload
    `,
    [aggregate.league, aggregate.kind, className, aggregate.generatedAt, JSON.stringify(aggregate)]
  );

  if (aggregate.kind !== "passives") {
    return aggregate.points.length;
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
          generated_at,
          source_kind
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        on conflict (league, class_name, passive_id) do update set
          name = excluded.name,
          x = excluded.x,
          y = excluded.y,
          weight = excluded.weight,
          generated_at = excluded.generated_at,
          source_kind = excluded.source_kind
      `,
      [
        aggregate.league,
        className,
        point.passiveId,
        point.name ?? null,
        point.x ?? null,
        point.y ?? null,
        point.weight,
        aggregate.generatedAt,
        aggregate.kind
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
  const buildSnapshotsById = new Map(records.builds.map((build) => [build.metadata.id, build]));
  const builds = await storeBuildSnapshots(client, records.builds);
  const summaries = await storeBuildSummaries(client, records.summaries, buildSnapshotsById);
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

function createBuildSourceMetadata(build: BuildSnapshot): BuildSourceMetadata {
  const metadata: BuildSourceMetadata = {
    id: build.metadata.id,
    league: build.metadata.league,
    source: build.source,
    capturedAt: build.capturedAt,
    accountName: build.metadata.accountName,
    characterName: build.metadata.characterName
  };

  if (build.metadata.rank !== undefined) {
    metadata.rank = build.metadata.rank;
  }

  return metadata;
}

function createSummarySourceSnapshot(build: BuildSnapshot, summary: BuildSummary) {
  return {
    build: createBuildSourceMetadata(build),
    summary: {
      id: summary.id,
      generatedAt: summary.generatedAt
    }
  };
}

function normalizeJsonb<T>(value: unknown): T {
  return typeof value === "string" ? (JSON.parse(value) as T) : (value as T);
}

function stringOrUndefined(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function dateString(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}
