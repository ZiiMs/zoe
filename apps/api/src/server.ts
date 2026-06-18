import Fastify from "fastify";
import type { FastifyBaseLogger } from "fastify";
import type { DbQueryClient } from "@zoe/db";
import {
  readBuildSnapshot,
  readBuildSnapshots,
  readBuildSummaries,
  readHeatmapAggregate
} from "@zoe/db";
import type {
  BuildFilterGroup,
  BuildSearchResponse,
  BuildSearchParams,
  BuildSortField,
  BuildSnapshot,
  HeatmapAggregate,
  PoeNinjaLeagueOption,
  SortOrder,
  TradePriceCheckRequest
} from "@zoe/domain";
import { fixturePassiveHeatmap, fixtureSummaries } from "./fixtures";
import {
  fetchPoeNinjaBuildDetail,
  fetchPoeNinjaBuildIndex,
  fetchPoeNinjaBuilds,
  fetchPoeNinjaLeagues,
  buildDetailFromSnapshot
} from "./poe-ninja";
import { fetchTradeLeagues, fetchTradeStats, priceCheckTradeItem } from "./trade";

interface CreateServerOptions {
  fetcher?: typeof fetch;
  poeNinjaBaseUrl?: string | undefined;
  dbClient?: DbQueryClient | undefined;
}

const allowedCorsOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:1420",
  "http://127.0.0.1:1420",
  "http://tauri.localhost",
  "tauri://localhost"
] as const;

export function createServer({
  fetcher = fetch,
  poeNinjaBaseUrl,
  dbClient
}: CreateServerOptions = {}) {
  const server = Fastify({
    logger: true
  });

  server.addHook("onRequest", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", corsOriginFor(request.headers.origin));
    reply.header("Access-Control-Allow-Headers", "Content-Type, Accept");
    reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    reply.header("Vary", "Origin");

    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });

  server.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    return reply.code(statusCodeFromError(error)).send({ error: messageFromError(error) });
  });

  server.get("/health", async () => ({ ok: true as const }));

  server.get<{ Querystring: Record<string, string | string[] | undefined> }>(
    "/builds",
    async (request) => {
      const params = parseBuildSearchParams(request.query);
      const persisted = await readPersistedBuildSearch(request.log, dbClient, params, fetcher, {
        baseUrl: poeNinjaBaseUrl
      });

      return (
        persisted ??
        fetchPoeNinjaBuilds(params, fetcher, {
          baseUrl: poeNinjaBaseUrl
        })
      );
    }
  );

  server.get("/poe-ninja/build-index", async () => ({
    index: await fetchPoeNinjaBuildIndex(fetcher, { baseUrl: poeNinjaBaseUrl })
  }));

  server.get("/poe-ninja/leagues", async () => ({
    leagues: await fetchPoeNinjaLeagues(fetcher, { baseUrl: poeNinjaBaseUrl })
  }));

  server.get<{ Params: { id: string } }>("/builds/:id", async (request, reply) => {
    const persisted = await readPersistedBuildDetail(request.log, dbClient, request.params.id);
    if (persisted) {
      return { build: persisted.build, detail: persisted };
    }

    const detail = await fetchPoeNinjaBuildDetail(request.params.id, fetcher, {
      baseUrl: poeNinjaBaseUrl
    });

    if (!detail) {
      return reply.code(404).send({ error: "Build not found" });
    }

    return { build: detail.build, detail };
  });

  server.get("/summaries", async (request) => ({
    summaries: (await readPersistedSummaries(request.log, dbClient)) ?? fixtureSummaries
  }));

  server.get(
    "/heatmaps/passives",
    async (request) =>
      (await readPersistedHeatmap(request.log, dbClient, "passives")) ?? fixturePassiveHeatmap
  );

  server.get(
    "/heatmaps/items",
    async (request) =>
      (await readPersistedHeatmap(request.log, dbClient, "items")) ?? {
        kind: "items",
        league: "Dawn of the Hunt",
        points: [],
        generatedAt: "2026-06-05T12:00:00.000Z"
      }
  );

  server.get("/trade/stats", async () => ({
    stats: await fetchTradeStats(fetcher)
  }));

  server.get("/trade/leagues", async () => ({
    leagues: await fetchTradeLeagues(fetcher)
  }));

  server.post<{ Body: TradePriceCheckRequest }>("/trade/price-check", async (request, reply) => {
    try {
      return {
        result: await priceCheckTradeItem(request.body, fetcher)
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(statusCodeFromError(error)).send({ error: messageFromError(error) });
    }
  });

  return server;
}

async function readPersistedBuildSearch(
  log: Pick<FastifyBaseLogger, "warn">,
  dbClient: DbQueryClient | undefined,
  params: BuildSearchParams,
  fetcher: typeof fetch,
  options: { baseUrl?: string | undefined }
): Promise<BuildSearchResponse | undefined> {
  if (!dbClient) {
    return undefined;
  }

  try {
    const builds = applyBuildFilters(
      await readBuildSnapshots(dbClient, { ...params, limit: 200 }),
      params
    );
    if (!builds.length) {
      return undefined;
    }

    const sort = parseSort(params.sort) ?? "level";
    const order = parseOrder(params.order) ?? "desc";
    const sortedBuilds = sortBuilds(builds, sort, order);
    const leagues = await fetchPoeNinjaLeagues(fetcher, options);
    const league = selectResponseLeague(leagues, sortedBuilds, params.league);

    return {
      builds: sortedBuilds,
      total: sortedBuilds.length,
      filters: createPersistedFilters(sortedBuilds),
      leagues,
      league,
      sort: { field: sort, order },
      fetchedAt: newestCapturedAt(sortedBuilds),
      source: "database"
    };
  } catch (error) {
    log.warn({ error }, "Persisted build search failed; falling back to upstream/fixtures.");
    return undefined;
  }
}

async function readPersistedBuildDetail(
  log: Pick<FastifyBaseLogger, "warn">,
  dbClient: DbQueryClient | undefined,
  id: string
) {
  if (!dbClient) {
    return undefined;
  }

  try {
    const build = await readBuildSnapshot(dbClient, id);
    return build ? buildDetailFromSnapshot(build, "database") : undefined;
  } catch (error) {
    log.warn({ error }, "Persisted build detail failed; falling back to upstream/fixtures.");
    return undefined;
  }
}

async function readPersistedSummaries(
  log: Pick<FastifyBaseLogger, "warn">,
  dbClient: DbQueryClient | undefined
) {
  if (!dbClient) {
    return undefined;
  }

  try {
    const summaries = await readBuildSummaries(dbClient);
    return summaries.length ? summaries : undefined;
  } catch (error) {
    log.warn({ error }, "Persisted summaries failed; falling back to fixtures.");
    return undefined;
  }
}

async function readPersistedHeatmap(
  log: Pick<FastifyBaseLogger, "warn">,
  dbClient: DbQueryClient | undefined,
  kind: HeatmapAggregate["kind"]
) {
  if (!dbClient) {
    return undefined;
  }

  try {
    return await readHeatmapAggregate(dbClient, kind);
  } catch (error) {
    log.warn({ error }, "Persisted heatmap failed; falling back to fixtures.");
    return undefined;
  }
}

function applyBuildFilters(builds: BuildSnapshot[], params: BuildSearchParams) {
  return builds.filter((build) => {
    const searchable = [
      build.metadata.accountName,
      build.metadata.characterName,
      build.metadata.className,
      build.metadata.ascendancyName ?? "",
      ...build.mainSkills.map((skill) => skill.name),
      ...build.items.map((item) => item.name),
      ...build.passives.map((passive) => passive.name ?? passive.passiveId)
    ]
      .join(" ")
      .toLowerCase();
    const search = params.search?.trim().toLowerCase();

    return (
      (!params.league || build.metadata.league === params.league) &&
      (!search || searchable.includes(search)) &&
      matchesAny(params.className, [build.metadata.className, build.metadata.ascendancyName]) &&
      matchesAny(
        params.keystones,
        build.passives.map((passive) => passive.name ?? passive.passiveId)
      ) &&
      matchesAny(
        params.skills,
        build.mainSkills.map((skill) => skill.name)
      ) &&
      matchesAny(
        params.gear,
        build.items.map((item) => item.name)
      )
    );
  });
}

function sortBuilds(builds: BuildSnapshot[], sort: BuildSortField, order: SortOrder) {
  return [...builds].sort((left, right) => {
    const direction = order === "asc" ? 1 : -1;
    return (buildSortValue(left, sort) - buildSortValue(right, sort)) * direction;
  });
}

function buildSortValue(build: BuildSnapshot, sort: BuildSortField) {
  if (sort === "life") {
    return build.metrics?.life ?? 0;
  }

  if (sort === "energyshield") {
    return build.metrics?.energyShield ?? 0;
  }

  if (sort === "dps") {
    return parseMetricLabel(build.metrics?.dpsLabel);
  }

  if (sort === "ehp") {
    return parseMetricLabel(build.metrics?.ehpLabel);
  }

  return build.metadata.level;
}

function parseMetricLabel(value?: string) {
  if (!value) {
    return 0;
  }

  const match = value.trim().match(/^([\d,.]+)\s*([kmb])?/i);
  if (!match) {
    return 0;
  }

  const number = Number(match[1]?.replace(/,/g, ""));
  const suffix = match[2]?.toLowerCase();
  const multiplier =
    suffix === "b" ? 1_000_000_000 : suffix === "m" ? 1_000_000 : suffix === "k" ? 1_000 : 1;
  return Number.isFinite(number) ? number * multiplier : 0;
}

function createPersistedFilters(builds: BuildSnapshot[]): BuildFilterGroup[] {
  return [
    createFilterGroupFromValues(
      "class",
      "Ascendancy / class",
      builds.map((build) => build.metadata.ascendancyName ?? build.metadata.className)
    ),
    createFilterGroupFromValues(
      "keystones",
      "Keystones",
      builds.flatMap((build) => build.passives.map((passive) => passive.name ?? passive.passiveId))
    ),
    createFilterGroupFromValues(
      "skills",
      "Skills",
      builds.flatMap((build) => build.mainSkills.map((skill) => skill.name))
    ),
    createFilterGroupFromValues("supports", "Supports", []),
    createFilterGroupFromValues(
      "gear",
      "Gear",
      builds.flatMap((build) => build.items.map((item) => item.name))
    )
  ];
}

function createFilterGroupFromValues(
  id: BuildFilterGroup["id"],
  label: string,
  values: string[]
): BuildFilterGroup {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return {
    id,
    label,
    options: Array.from(counts.entries())
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
  };
}

function selectResponseLeague(
  leagues: PoeNinjaLeagueOption[],
  builds: BuildSnapshot[],
  requestedLeague?: string
) {
  const buildLeague = requestedLeague ?? builds[0]?.metadata.league;
  return (
    leagues.find((league) => league.displayName === buildLeague || league.name === buildLeague) ??
    leagues[0] ?? {
      name: buildLeague ?? "Persisted Builds",
      url: slugify(buildLeague ?? "persisted-builds"),
      displayName: buildLeague ?? "Persisted Builds",
      indexed: true,
      hardcore: false,
      version: "database",
      snapshotName: "database",
      total: builds.length,
      statistics: []
    }
  );
}

function newestCapturedAt(builds: BuildSnapshot[]) {
  return (
    builds
      .map((build) => build.capturedAt)
      .sort()
      .at(-1) ?? new Date().toISOString()
  );
}

function matchesAny(filters: string[] | undefined, values: Array<string | undefined>) {
  const normalizedValues = values.filter((value): value is string => Boolean(value));
  return !filters?.length || filters.some((filter) => normalizedValues.includes(filter));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function corsOriginFor(origin?: string) {
  if (!origin) {
    return "*";
  }

  return allowedCorsOrigins.includes(origin as (typeof allowedCorsOrigins)[number])
    ? origin
    : "null";
}

function statusCodeFromError(error: unknown) {
  if (typeof error === "object" && error && "statusCode" in error) {
    const statusCode = Number((error as { statusCode?: unknown }).statusCode);
    if (statusCode >= 400 && statusCode < 600) {
      return statusCode;
    }
  }

  if (error instanceof SyntaxError) {
    return 502;
  }

  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(
    /^Trade (?:stats request|leagues request|search|fetch) failed: (\d{3})\b/
  );
  if (!match) {
    return 500;
  }

  const statusCode = Number(match[1]);
  return statusCode >= 400 && statusCode < 600 ? statusCode : 500;
}

function messageFromError(error: unknown) {
  if (error instanceof SyntaxError) {
    return "Upstream returned malformed JSON.";
  }

  return error instanceof Error ? error.message : String(error);
}

function parseBuildSearchParams(
  query: Record<string, string | string[] | undefined>
): BuildSearchParams {
  return {
    league: first(query.league),
    search: first(query.search),
    className: list(query.class),
    keystones: list(query.keystones),
    skills: list(query.skills ?? query.skill),
    supports: list(query.supports),
    gear: list(query.gear),
    sort: parseSort(first(query.sort)),
    order: parseOrder(first(query.order)),
    page: parsePage(first(query.page))
  };
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function list(value: string | string[] | undefined) {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  return rawValues
    .flatMap((rawValue) => rawValue.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSort(value?: string): BuildSortField | undefined {
  return value === "dps" ||
    value === "life" ||
    value === "energyshield" ||
    value === "ehp" ||
    value === "level"
    ? value
    : undefined;
}

function parseOrder(value?: string): SortOrder | undefined {
  return value === "asc" || value === "desc" ? value : undefined;
}

function parsePage(value?: string) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : undefined;
}
