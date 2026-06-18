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
  poeNinjaBaseUrl?: string | undefined;
}

const allowedCorsOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:1420",
  "http://127.0.0.1:1420",
  "http://tauri.localhost",
  "tauri://localhost"
] as const;

export function createServer({ fetcher = fetch, poeNinjaBaseUrl }: CreateServerOptions = {}) {
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
    async (request) =>
      fetchPoeNinjaBuilds(parseBuildSearchParams(request.query), fetcher, {
        baseUrl: poeNinjaBaseUrl
      })
  );

  server.get("/poe-ninja/build-index", async () => ({
    index: await fetchPoeNinjaBuildIndex(fetcher, { baseUrl: poeNinjaBaseUrl })
  }));

  server.get("/poe-ninja/leagues", async () => ({
    leagues: await fetchPoeNinjaLeagues(fetcher, { baseUrl: poeNinjaBaseUrl })
  }));

  server.get<{ Params: { id: string } }>("/builds/:id", async (request, reply) => {
    const detail = await fetchPoeNinjaBuildDetail(request.params.id, fetcher, {
      baseUrl: poeNinjaBaseUrl
    });

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
      return reply.code(statusCodeFromError(error)).send({ error: messageFromError(error) });
    }
  });

  return server;
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
