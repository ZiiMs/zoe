import { describe, expect, it } from "vitest";
import { createServer } from "./server";
import { __poeNinjaInternals, decodeSearchResult } from "./poe-ninja";
import { __tradeInternals } from "./trade";

describe("api server", () => {
  it("reports health", async () => {
    const server = createServer();
    const response = await server.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it("returns fixture builds", async () => {
    const server = createServer({
      fetcher: async () => new Response("upstream unavailable", { status: 503 })
    });
    const response = await server.inject({ method: "GET", url: "/builds" });

    expect(response.statusCode).toBe(200);
    const payload = response.json<{ builds: unknown[]; source: string; total: number }>();
    expect(payload.builds).toHaveLength(3);
    expect(payload.total).toBe(3);
    expect(payload.source).toBe("fixture");
  });

  it("returns normalized poe.ninja build index data", async () => {
    const server = createServer({
      fetcher: async () =>
        new Response(
          JSON.stringify({
            leagueBuilds: [
              {
                leagueName: "Runes of Aldur",
                leagueUrl: "runesofaldur",
                total: 10,
                status: 0,
                statistics: [{ class: "Deadeye", percentage: 12.5, trend: 1 }]
              }
            ]
          })
        )
    });
    const response = await server.inject({ method: "GET", url: "/poe-ninja/build-index" });

    expect(response.statusCode).toBe(200);
    expect(
      response.json<{
        index: { leagueBuilds: Array<{ statistics: Array<{ className: string }> }> };
      }>().index.leagueBuilds[0]?.statistics[0]?.className
    ).toBe("Deadeye");
  });

  it("normalizes league metadata from poe.ninja index-state", async () => {
    const server = createServer({
      fetcher: async (input) => {
        const url = String(input);
        if (url.includes("build-index-state")) {
          return new Response(
            JSON.stringify({
              leagueBuilds: [
                {
                  leagueName: "Runes of Aldur",
                  leagueUrl: "runesofaldur",
                  total: 10,
                  status: 0,
                  statistics: [{ class: "Deadeye", percentage: 12.5, trend: 1 }]
                }
              ]
            })
          );
        }

        if (url.includes("index-state")) {
          return new Response(
            JSON.stringify({
              buildLeagues: [
                {
                  name: "Runes of Aldur",
                  url: "runesofaldur",
                  displayName: "Runes of Aldur",
                  indexed: true,
                  hardcore: false,
                  version: "0015",
                  snapshotName: "runes-of-aldur"
                }
              ],
              oldBuildLeagues: []
            })
          );
        }

        return new Response("unexpected URL", { status: 404 });
      }
    });
    const response = await server.inject({ method: "GET", url: "/poe-ninja/leagues" });

    expect(response.statusCode).toBe(200);
    const payload = response.json<{
      leagues: Array<{ url: string; version: string; snapshotName: string; total: number }>;
    }>();
    expect(payload.leagues[0]).toMatchObject({
      url: "runesofaldur",
      version: "0015",
      snapshotName: "runes-of-aldur",
      total: 10
    });
  });

  it("decodes poe.ninja search protobuf fixtures", () => {
    const type = __poeNinjaInternals.protoRoot.lookupType("NinjaSearchResult");
    const encoded = type
      .encode({
        result: {
          total: 1,
          valueLists: [
            { id: "name", values: [{ str: "AldurRunner" }] },
            { id: "level", values: [{ number: 98 }] }
          ],
          dictionaries: [{ id: "class", hash: "fixture-hash" }]
        }
      })
      .finish();

    const decoded = decodeSearchResult(encoded);

    expect(decoded.total).toBe(1);
    expect(decoded.valueLists?.[0]?.id).toBe("name");
    expect(decoded.valueLists?.[1]?.values?.[0]?.number).toBe(98);
    expect(decoded.dictionaries?.[0]?.hash).toBe("fixture-hash");
  });

  it("returns cached trade stats", async () => {
    __tradeInternals.resetCaches();
    let statsCalls = 0;
    const server = createServer({
      fetcher: async (input) => {
        if (String(input).includes("/api/trade2/data/stats")) {
          statsCalls += 1;
          return new Response(
            JSON.stringify({
              result: [
                {
                  id: "pseudo",
                  label: "Pseudo",
                  entries: [
                    {
                      id: "pseudo.pseudo_total_elemental_resistance",
                      text: "Pseudo: total elemental resistance",
                      type: "pseudo"
                    }
                  ]
                }
              ]
            })
          );
        }

        return new Response("unexpected URL", { status: 404 });
      }
    });

    const first = await server.inject({ method: "GET", url: "/trade/stats" });
    const second = await server.inject({ method: "GET", url: "/trade/stats" });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(statsCalls).toBe(1);
  });

  it("price checks an item through trade search and fetch", async () => {
    __tradeInternals.resetCaches();
    const requestedUrls: string[] = [];
    const server = createServer({
      fetcher: async (input) => {
        const url = String(input);
        requestedUrls.push(url);

        if (url.includes("/api/trade2/data/stats")) {
          return new Response(
            JSON.stringify({
              result: [
                {
                  id: "pseudo",
                  label: "Pseudo",
                  entries: [
                    {
                      id: "pseudo.pseudo_total_elemental_resistance",
                      text: "Pseudo: total elemental resistance",
                      type: "pseudo"
                    }
                  ]
                }
              ]
            })
          );
        }

        if (url.includes("/api/trade2/search/Standard")) {
          return new Response(JSON.stringify({ id: "query-1", result: ["listing-1"], total: 1 }));
        }

        if (url.includes("/api/trade2/fetch/listing-1")) {
          return new Response(
            JSON.stringify({
              result: [
                {
                  id: "listing-1",
                  item: { name: "Storm Loop", typeLine: "Ruby Ring" },
                  listing: {
                    account: { name: "seller" },
                    price: { amount: 3, currency: "exalted" },
                    indexed: "2026-06-11T12:00:00Z",
                    whisper: "@seller Hi"
                  }
                }
              ]
            })
          );
        }

        return new Response("unexpected URL", { status: 404 });
      }
    });

    const response = await server.inject({
      method: "POST",
      url: "/trade/price-check",
      payload: {
        league: "Standard",
        item: {
          rawText: "item",
          rarity: "Rare",
          baseType: "Ruby Ring",
          requirements: [],
          sockets: [],
          modifiers: [],
          statCandidates: [],
          pseudoSuggestions: [],
          parseWarnings: []
        },
        filters: [
          {
            id: "pseudo-total-elemental-resistance",
            label: "Pseudo: total elemental resistance",
            normalizedText: "pseudo: total elemental resistance",
            source: "pseudo",
            min: 30
          }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json<{
      result: { total: number; listings: Array<{ priceAmount: number; seller: string }> };
    }>();
    expect(payload.result.total).toBe(1);
    expect(payload.result.listings[0]).toMatchObject({ priceAmount: 3, seller: "seller" });
    expect(requestedUrls.some((url) => url.includes("/api/trade2/search/Standard"))).toBe(true);
  });

  it("fetches the first two trade result pages in batches", async () => {
    __tradeInternals.resetCaches();
    const resultIds = Array.from({ length: 20 }, (_, index) => `listing-${index + 1}`);
    const fetchUrls: string[] = [];
    const server = createServer({
      fetcher: async (input) => {
        const url = String(input);

        if (url.includes("/api/trade2/data/stats")) {
          return new Response(JSON.stringify({ result: [] }));
        }

        if (url.includes("/api/trade2/search/Standard")) {
          return new Response(JSON.stringify({ id: "query-2", result: resultIds, total: 42 }));
        }

        if (url.includes("/api/trade2/fetch/")) {
          fetchUrls.push(url);
          const ids =
            url
              .match(/\/fetch\/([^?]+)/)
              ?.at(1)
              ?.split(",") ?? [];
          return new Response(
            JSON.stringify({
              result: ids.map((id, index) => ({
                id,
                item: { name: `Item ${id}`, typeLine: "Expert Boots", ilvl: 80 + index },
                listing: {
                  account: { name: `seller-${id}` },
                  price: { amount: index + 1, currency: "exalted" },
                  indexed: "2026-06-11T12:00:00Z"
                }
              }))
            })
          );
        }

        return new Response("unexpected URL", { status: 404 });
      }
    });

    const response = await server.inject({
      method: "POST",
      url: "/trade/price-check",
      payload: {
        league: "Standard",
        item: {
          rawText: "item",
          rarity: "Rare",
          baseType: "Expert Boots",
          requirements: [],
          sockets: [],
          modifiers: [],
          statCandidates: [],
          pseudoSuggestions: [],
          parseWarnings: []
        },
        filters: [],
        limit: 20
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json<{
      result: { total: number; listings: Array<{ itemLevel: number; listedAt: string }> };
    }>();
    expect(payload.result.total).toBe(42);
    expect(payload.result.listings).toHaveLength(20);
    expect(payload.result.listings[0]).toMatchObject({
      itemLevel: 80,
      listedAt: "2026-06-11T12:00:00Z"
    });
    expect(fetchUrls).toHaveLength(2);
    expect(fetchUrls[0]).toContain(resultIds.slice(0, 10).join(","));
    expect(fetchUrls[1]).toContain(resultIds.slice(10, 20).join(","));
  });

  it("returns an error when trade search fails", async () => {
    __tradeInternals.resetCaches();
    const server = createServer({
      fetcher: async (input) => {
        if (String(input).includes("/api/trade2/data/stats")) {
          return new Response(JSON.stringify({ result: [] }));
        }

        return new Response("rate limited", { status: 429 });
      }
    });

    const response = await server.inject({
      method: "POST",
      url: "/trade/price-check",
      payload: {
        league: "Standard",
        item: {
          rawText: "item",
          requirements: [],
          sockets: [],
          modifiers: [],
          statCandidates: [],
          pseudoSuggestions: [],
          parseWarnings: []
        },
        filters: []
      }
    });

    expect(response.statusCode).toBe(429);
    expect(response.json<{ error: string }>().error).toContain("Trade search failed");
  });
});
