import Fastify from "fastify";
import type {
  BuildSearchParams,
  BuildSortField,
  SortOrder,
  TradePriceCheckRequest
} from "@zoe/domain";
import { fixturePassiveHeatmap, fixtureSummaries } from "./fixtures";
import {
  fetchPoeNinjaBuildDetail,
  fetchPoeNinjaBuildIndex,
  fetchPoeNinjaBuilds,
  fetchPoeNinjaLeagues
} from "./poe-ninja";
import { fetchTradeLeagues, fetchTradeStats, priceCheckTradeItem } from "./trade";

interface CreateServerOptions {
  fetcher?: typeof fetch;
}

export function createServer({ fetcher = fetch }: CreateServerOptions = {}) {
  const server = Fastify({
    logger: true
  });

  server.addHook("onRequest", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Headers", "Content-Type, Accept");
    reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });

  server.get("/health", async () => ({ ok: true as const }));

  server.get<{ Querystring: Record<string, string | string[] | undefined> }>(
    "/builds",
    async (request) => fetchPoeNinjaBuilds(parseBuildSearchParams(request.query), fetcher)
  );

  server.get("/poe-ninja/build-index", async () => ({
    index: await fetchPoeNinjaBuildIndex(fetcher)
  }));

  server.get("/poe-ninja/leagues", async () => ({
    leagues: await fetchPoeNinjaLeagues(fetcher)
  }));

  server.get<{ Params: { id: string } }>("/builds/:id", async (request, reply) => {
    const detail = await fetchPoeNinjaBuildDetail(request.params.id, fetcher);

    if (!detail) {
      return reply.code(404).send({ error: "Build not found" });
    }

    return { build: detail.build, detail };
  });

  server.get("/summaries", async () => ({
    summaries: fixtureSummaries
  }));

  server.get("/heatmaps/passives", async () => fixturePassiveHeatmap);

  server.get("/heatmaps/items", async () => ({
    kind: "items",
    league: "Dawn of the Hunt",
    points: [],
    generatedAt: "2026-06-05T12:00:00.000Z"
  }));

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
      return reply
        .code(statusCodeFromError(error))
        .send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  return server;
}

function statusCodeFromError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/^Trade (?:search|fetch) failed: (\d{3})\b/);
  if (!match) {
    return 500;
  }

  const statusCode = Number(match[1]);
  return statusCode >= 400 && statusCode < 600 ? statusCode : 500;
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
