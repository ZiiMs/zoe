import type {
  BuildSearchParams,
  BuildSearchResponse,
  BuildDetail,
  BuildSnapshot,
  BuildSummary,
  HeatmapAggregate,
  PoeNinjaBuildIndex,
  PoeNinjaLeagueOption,
  TradeLeague,
  TradePriceCheckRequest,
  TradePriceCheckResult,
  TradeStatGroup
} from "@zoe/domain";

export interface ZoeApiClientOptions {
  baseUrl: string;
  fetcher?: typeof fetch;
}

export interface BuildsResponse {
  builds: BuildSnapshot[];
}

export interface SummariesResponse {
  summaries: BuildSummary[];
}

export interface PoeNinjaBuildIndexResponse {
  index: PoeNinjaBuildIndex;
}

export interface PoeNinjaLeaguesResponse {
  leagues: PoeNinjaLeagueOption[];
}

export interface TradeStatsResponse {
  stats: TradeStatGroup[];
}

export interface TradeLeaguesResponse {
  leagues: TradeLeague[];
}

export interface TradePriceCheckResponse {
  result: TradePriceCheckResult;
}

export function createZoeApiClient({ baseUrl, fetcher = fetch }: ZoeApiClientOptions) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  async function getJson<T>(path: string): Promise<T> {
    const response = await request(`${normalizedBaseUrl}${path}`);

    if (!response.ok) {
      throw new Error(await formatApiError(response));
    }

    return response.json() as Promise<T>;
  }

  async function postJson<T>(path: string, body: unknown): Promise<T> {
    const response = await request(`${normalizedBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(await formatApiError(response));
    }

    return response.json() as Promise<T>;
  }

  async function request(input: RequestInfo | URL, init?: RequestInit) {
    try {
      return await fetcher(input, init);
    } catch (error) {
      throw new Error(
        `Zoe API unreachable at ${normalizedBaseUrl}. Start it with "bun run dev:api" or run "bun run dev". ${String(error)}`
      );
    }
  }

  async function formatApiError(response: Response) {
    const body = await response.text().catch(() => "");
    const parsed = parseErrorBody(body);
    return [`Zoe API request failed: ${response.status} ${response.statusText}`, parsed]
      .filter(Boolean)
      .join(" - ");
  }

  function parseErrorBody(body: string) {
    if (!body) {
      return "";
    }

    try {
      const payload = JSON.parse(body) as { error?: unknown };
      return typeof payload.error === "string" ? payload.error : body;
    } catch {
      return body;
    }
  }

  return {
    health: () => getJson<{ ok: true }>("/health"),
    builds: (params?: BuildSearchParams) =>
      getJson<BuildSearchResponse>(`/builds${toQueryString(params)}`),
    build: (id: string) =>
      getJson<{ build: BuildSnapshot; detail?: BuildDetail }>(`/builds/${encodeURIComponent(id)}`),
    poeNinjaBuildIndex: () => getJson<PoeNinjaBuildIndexResponse>("/poe-ninja/build-index"),
    poeNinjaLeagues: () => getJson<PoeNinjaLeaguesResponse>("/poe-ninja/leagues"),
    summaries: () => getJson<SummariesResponse>("/summaries"),
    passiveHeatmap: () => getJson<HeatmapAggregate>("/heatmaps/passives"),
    itemHeatmap: () => getJson<HeatmapAggregate>("/heatmaps/items"),
    tradeStats: () => getJson<TradeStatsResponse>("/trade/stats"),
    tradeLeagues: () => getJson<TradeLeaguesResponse>("/trade/leagues"),
    priceCheck: (request: TradePriceCheckRequest) =>
      postJson<TradePriceCheckResponse>("/trade/price-check", request)
  };
}

function toQueryString(params?: BuildSearchParams) {
  if (!params) {
    return "";
  }

  const query = new URLSearchParams();
  addValue(query, "league", params.league);
  addValue(query, "search", params.search);
  addValues(query, "class", params.className);
  addValues(query, "keystones", params.keystones);
  addValues(query, "skills", params.skills);
  addValues(query, "supports", params.supports);
  addValues(query, "gear", params.gear);
  addValue(query, "sort", params.sort);
  addValue(query, "order", params.order);
  addValue(query, "page", params.page?.toString());

  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

function addValue(query: URLSearchParams, key: string, value?: string) {
  if (value) {
    query.set(key, value);
  }
}

function addValues(query: URLSearchParams, key: string, values?: string[]) {
  if (values?.length) {
    query.set(key, values.join(","));
  }
}
