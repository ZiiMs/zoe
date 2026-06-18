import {
  findTradeStatId,
  type TradeLeague,
  type TradeListing,
  type TradePriceCheckFilter,
  type TradePriceCheckRequest,
  type TradePriceCheckResult,
  type TradeStatGroup
} from "@zoe/domain";

const tradeBaseUrl = "https://www.pathofexile.com";
const poe2Realm = "poe2";
const statCacheTtlMs = 60 * 60 * 1000;
const leagueCacheTtlMs = 15 * 60 * 1000;
const tradeFetchBatchSize = 10;
const upstreamErrorBodyLimit = 500;
const tradeDebugEnabled = process.env.ZOE_TRADE_DEBUG === "1";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

let statsCache: CacheEntry<TradeStatGroup[]> | undefined;
let leaguesCache: CacheEntry<TradeLeague[]> | undefined;
let lastPriceCheckAt = 0;

export async function fetchTradeStats(
  fetcher: typeof fetch = fetch,
  now = Date.now()
): Promise<TradeStatGroup[]> {
  if (statsCache && statsCache.expiresAt > now) {
    return statsCache.value;
  }

  const response = await fetcher(`${tradeBaseUrl}/api/trade2/data/stats`);
  if (!response.ok) {
    throw new Error(`Trade stats request failed: ${statusMessage(response)}`);
  }

  const payload = (await response.json()) as { result?: unknown[] };
  const value = normalizeTradeStatGroups(payload.result);
  statsCache = { value, expiresAt: now + statCacheTtlMs };
  return value;
}

export async function fetchTradeLeagues(
  fetcher: typeof fetch = fetch,
  now = Date.now()
): Promise<TradeLeague[]> {
  if (leaguesCache && leaguesCache.expiresAt > now) {
    return leaguesCache.value;
  }

  const response = await fetcher(`${tradeBaseUrl}/api/trade2/data/leagues`);
  if (!response.ok) {
    throw new Error(`Trade leagues request failed: ${statusMessage(response)}`);
  }

  const payload = (await response.json()) as { result?: unknown[] };
  const value = normalizeTradeLeagues(payload.result);
  leaguesCache = { value, expiresAt: now + leagueCacheTtlMs };
  return value;
}

export async function priceCheckTradeItem(
  request: TradePriceCheckRequest,
  fetcher: typeof fetch = fetch,
  now = Date.now()
): Promise<TradePriceCheckResult> {
  await waitForRateLimit(now);
  const searchedAt = new Date(now).toISOString();
  const statGroups = await fetchTradeStats(fetcher, now);
  const filters = resolveTradeFilters(request.filters, statGroups);
  const query = buildOfficialTradeSearch(request, filters);
  logTradeDebug(
    `[trade-debug] search league=${request.league} item="${request.item.baseType ?? request.item.name ?? "unknown"}" requestedFilters=${request.filters.length} resolvedFilters=${filters.length} limit=${request.limit ?? 10}`
  );
  logTradeDebug(
    `[trade-debug] filters ${filters
      .map(
        (filter) =>
          `${filter.tradeStatId ?? filter.label}:min=${filter.min ?? "-"}:max=${filter.max ?? "-"}`
      )
      .join(" | ")}`
  );
  const searchResponse = await fetcher(
    `${tradeBaseUrl}/api/trade2/search/${encodeURIComponent(request.league)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(query)
    }
  );

  if (!searchResponse.ok) {
    throw new Error(
      `Trade search failed: ${statusMessage(searchResponse)} ${await safeResponseText(searchResponse)}`.trim()
    );
  }

  const searchPayload = (await searchResponse.json()) as {
    id?: string;
    result?: string[];
    total?: number;
    error?: { message?: string };
  };
  if (searchPayload.error) {
    throw new Error(searchPayload.error.message ?? "Trade search failed.");
  }
  const resultIds = searchPayload.result?.slice(0, request.limit ?? 10) ?? [];
  const tradeUrl = buildTradeUrl(request.league, searchPayload.id);
  logTradeDebug(
    `[trade-debug] searchResult query=${searchPayload.id ?? "none"} total=${searchPayload.total ?? 0} ids=${resultIds.length}`
  );

  if (!searchPayload.id || resultIds.length === 0) {
    return {
      queryId: searchPayload.id,
      tradeUrl,
      total: searchPayload.total ?? 0,
      listings: [],
      filters,
      searchedAt,
      source: "official"
    };
  }

  const listings: TradeListing[] = [];
  for (const batchIds of chunk(resultIds, tradeFetchBatchSize)) {
    logTradeDebug(
      `[trade-debug] fetchBatch size=${batchIds.length} first=${batchIds[0] ?? "none"}`
    );
    const fetchUrl = `${tradeBaseUrl}/api/trade2/fetch/${batchIds.join(",")}?query=${encodeURIComponent(searchPayload.id)}&realm=${poe2Realm}`;
    const fetchResponse = await fetcher(fetchUrl, {
      headers: {
        Accept: "application/json"
      }
    });

    if (!fetchResponse.ok) {
      throw new Error(
        `Trade fetch failed: ${statusMessage(fetchResponse)} ${await safeResponseText(fetchResponse)}`.trim()
      );
    }

    const fetchPayload = (await fetchResponse.json()) as {
      result?: unknown[];
      error?: { message?: string };
    };
    if (fetchPayload.error) {
      throw new Error(fetchPayload.error.message ?? "Trade fetch failed.");
    }

    listings.push(...normalizeTradeListings(fetchPayload.result, tradeUrl));
  }
  logTradeDebug(`[trade-debug] fetchedListings=${listings.length}`);

  return {
    queryId: searchPayload.id,
    tradeUrl,
    total: searchPayload.total ?? resultIds.length,
    listings,
    filters,
    searchedAt,
    source: "official"
  };
}

export const __tradeInternals = {
  resetCaches() {
    statsCache = undefined;
    leaguesCache = undefined;
    lastPriceCheckAt = 0;
  },
  normalizeTradeListings,
  resolveTradeFilters
};

function normalizeTradeStatGroups(groups: unknown): TradeStatGroup[] {
  if (!Array.isArray(groups)) {
    return [];
  }

  return groups.map((group, groupIndex) => {
    const candidate = group as { id?: unknown; label?: unknown; entries?: unknown[] };

    return {
      id: typeof candidate.id === "string" ? candidate.id : `group-${groupIndex}`,
      label: typeof candidate.label === "string" ? candidate.label : "Stats",
      entries: Array.isArray(candidate.entries)
        ? candidate.entries.flatMap((entry, entryIndex) => {
            const stat = entry as { id?: unknown; text?: unknown; type?: unknown };
            if (typeof stat.id !== "string" || typeof stat.text !== "string") {
              return [];
            }

            return [
              {
                id: stat.id,
                text: stat.text,
                type:
                  typeof stat.type === "string"
                    ? stat.type
                    : typeof candidate.id === "string"
                      ? candidate.id
                      : `group-${entryIndex}`
              }
            ];
          })
        : []
    };
  });
}

function normalizeTradeLeagues(leagues: unknown): TradeLeague[] {
  if (!Array.isArray(leagues)) {
    return [];
  }

  return leagues.flatMap((league) => {
    const candidate = league as { id?: unknown; text?: unknown; realm?: unknown };
    if (typeof candidate.id !== "string" || typeof candidate.text !== "string") {
      return [];
    }

    return [
      {
        id: candidate.id,
        text: candidate.text,
        realm: typeof candidate.realm === "string" ? candidate.realm : undefined
      }
    ];
  });
}

function resolveTradeFilters(
  filters: TradePriceCheckFilter[],
  statGroups: TradeStatGroup[]
): TradePriceCheckFilter[] {
  return filters.flatMap((filter) => {
    const tradeStatId = filter.tradeStatId ?? findTradeStatId(filter, statGroups);
    if (!tradeStatId) {
      return [];
    }

    return [
      {
        ...filter,
        tradeStatId
      }
    ];
  });
}

function buildOfficialTradeSearch(
  request: TradePriceCheckRequest,
  filters: TradePriceCheckFilter[]
) {
  return {
    query: {
      status: {
        option: request.onlineOnly === false ? "any" : "online"
      },
      name: request.item.rarity === "Unique" ? request.item.name : undefined,
      type: request.item.baseType,
      stats: [
        {
          type: "and",
          filters: filters.map((filter) => ({
            id: filter.tradeStatId,
            value: {
              min: filter.min,
              max: filter.max
            },
            disabled: false
          }))
        }
      ]
    },
    sort: {
      price: "asc"
    }
  };
}

function normalizeTradeListings(listings: unknown, tradeUrl: string): TradeListing[] {
  if (!Array.isArray(listings)) {
    return [];
  }

  return listings.flatMap((listing, index) => {
    const candidate = listing as {
      id?: unknown;
      item?: { name?: unknown; typeLine?: unknown; ilvl?: unknown };
      listing?: {
        account?: { name?: unknown };
        price?: { amount?: unknown; currency?: unknown };
        indexed?: unknown;
        whisper?: unknown;
      };
    };
    const id = typeof candidate.id === "string" ? candidate.id : `listing-${index}`;
    const itemName =
      typeof candidate.item?.name === "string" && candidate.item.name
        ? candidate.item.name
        : typeof candidate.item?.typeLine === "string"
          ? candidate.item.typeLine
          : "Unknown item";

    return [
      {
        id,
        itemName,
        baseType:
          typeof candidate.item?.typeLine === "string" ? candidate.item.typeLine : undefined,
        itemLevel: typeof candidate.item?.ilvl === "number" ? candidate.item.ilvl : undefined,
        seller:
          typeof candidate.listing?.account?.name === "string"
            ? candidate.listing.account.name
            : undefined,
        priceAmount:
          typeof candidate.listing?.price?.amount === "number"
            ? candidate.listing.price.amount
            : undefined,
        priceCurrency:
          typeof candidate.listing?.price?.currency === "string"
            ? candidate.listing.price.currency
            : undefined,
        listedAt:
          typeof candidate.listing?.indexed === "string" ? candidate.listing.indexed : undefined,
        whisper:
          typeof candidate.listing?.whisper === "string" ? candidate.listing.whisper : undefined,
        tradeUrl
      }
    ];
  });
}

function buildTradeUrl(league: string, queryId?: string) {
  const base = `${tradeBaseUrl}/trade2/search/${poe2Realm}/${encodeURIComponent(league)}`;
  return queryId ? `${base}/${encodeURIComponent(queryId)}` : base;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function safeResponseText(response: Response) {
  try {
    const text = await response.text();
    return text.length > upstreamErrorBodyLimit
      ? `${text.slice(0, upstreamErrorBodyLimit)}...`
      : text;
  } catch {
    return "";
  }
}

function statusMessage(response: Response) {
  return `${response.status} ${response.statusText}`.trim();
}

function logTradeDebug(message: string) {
  if (tradeDebugEnabled) {
    console.info(message);
  }
}

async function waitForRateLimit(now: number) {
  const elapsed = now - lastPriceCheckAt;
  lastPriceCheckAt = now;
  if (elapsed >= 600 || elapsed < 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 600 - elapsed));
}
