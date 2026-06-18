import { describe, expect, it, vi } from "vitest";
import { buildTradePriceCheckRequest, parseTradeItemText } from "@zoe/domain";
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

  it("handles CORS preflight requests for the local web app", async () => {
    const server = createServer();
    const response = await server.inject({
      method: "OPTIONS",
      url: "/trade/price-check",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-method": "POST"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(response.headers["access-control-allow-methods"]).toBe("GET, POST, OPTIONS");
    expect(response.headers["access-control-allow-headers"]).toBe("Content-Type, Accept");
  });

  it("handles CORS preflight requests for the desktop renderer", async () => {
    const server = createServer();
    const response = await server.inject({
      method: "OPTIONS",
      url: "/trade/price-check",
      headers: {
        origin: "http://localhost:1420",
        "access-control-request-method": "POST"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:1420");
  });

  it("returns fixture builds", async () => {
    const server = createServer({
      fetcher: async () => new Response("upstream unavailable", { status: 503 })
    });
    const response = await server.inject({ method: "GET", url: "/builds" });

    expect(response.statusCode).toBe(200);
    const payload = response.json<{
      builds: Array<{ source: string; metrics?: { highestDpsSkill?: string; ehpLabel?: string } }>;
      filters: Array<{ id: string; options: unknown[] }>;
      source: string;
      total: number;
    }>();
    expect(payload.builds).toHaveLength(3);
    expect(payload.total).toBe(3);
    expect(payload.source).toBe("fixture");
    expect(payload.builds[0]).toMatchObject({
      source: "fixture",
      metrics: {
        highestDpsSkill: expect.any(String),
        ehpLabel: expect.any(String)
      }
    });
    expect(payload.filters.find((filter) => filter.id === "class")?.options.length).toBeGreaterThan(0);
  });

  it("parses build search parameters without throwing", async () => {
    const requestedUrls: string[] = [];
    const server = createServer({
      fetcher: async (input) => {
        requestedUrls.push(String(input));
        return new Response("upstream unavailable", { status: 503 });
      }
    });
    const response = await server.inject({
      method: "GET",
      url: "/builds?league=runesofaldur&search=StormIndex&class=Stormweaver&skill=Spark&gear=Voltaxic%20Wand&sort=dps&order=asc&page=2"
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json<{
      builds: unknown[];
      source: string;
      sort: { field: string; order: string };
    }>();
    expect(payload.source).toBe("fixture");
    expect(payload.builds).toHaveLength(3);
    expect(payload.sort).toEqual({ field: "dps", order: "asc" });

    const searchUrl = requestedUrls.find((url) => url.includes("/api/builds/fixture/search"));
    expect(searchUrl).toBeDefined();
    expect(searchUrl).toContain("overview=runesofaldur");
    expect(searchUrl).toContain("sort=dps");
    expect(searchUrl).toContain("sort-asc=true");
    expect(searchUrl).toContain("name=StormIndex");
    expect(searchUrl).toContain("class=Stormweaver");
    expect(searchUrl).toContain("skills=Spark");
    expect(searchUrl).toContain("items=Voltaxic+Wand");
  });

  it("returns fixture build details for web detail ids when upstream is unavailable", async () => {
    const server = createServer({
      fetcher: async () => new Response("upstream unavailable", { status: 503 })
    });
    const response = await server.inject({
      method: "GET",
      url: "/builds/Dawn%20of%20the%20Hunt%3Azoe%3AStormIndex"
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json<{
      build: { metadata: { id: string; characterName: string } };
      detail: { source: string; skillGroups: Array<{ name: string }>; items: unknown[] };
    }>();
    expect(payload.build.metadata.id).toBe("fixture:spark-stormweaver");
    expect(payload.build.metadata.characterName).toBe("StormIndex");
    expect(payload.detail.source).toBe("fixture");
    expect(payload.detail.skillGroups[0]?.name).toBe("Spark");
    expect(payload.detail.items.length).toBeGreaterThan(0);
  });

  it("returns 404 for unknown build detail ids", async () => {
    const server = createServer({
      fetcher: async () => new Response("upstream unavailable", { status: 503 })
    });
    const response = await server.inject({
      method: "GET",
      url: "/builds/fixture%3Aunknown"
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Build not found" });
  });

  it("returns fixture summaries and passive heatmaps", async () => {
    const server = createServer({
      fetcher: async () => new Response("upstream unavailable", { status: 503 })
    });
    const summariesResponse = await server.inject({ method: "GET", url: "/summaries" });
    const heatmapResponse = await server.inject({ method: "GET", url: "/heatmaps/passives" });

    expect(summariesResponse.statusCode).toBe(200);
    expect(heatmapResponse.statusCode).toBe(200);

    const summariesPayload = summariesResponse.json<{
      summaries: Array<{ buildId: string; highlights: string[] }>;
    }>();
    expect(summariesPayload.summaries).toHaveLength(3);
    expect(summariesPayload.summaries[0]?.buildId).toBe("fixture:spark-stormweaver");
    expect(summariesPayload.summaries[0]?.highlights.length).toBeGreaterThan(0);

    const heatmapPayload = heatmapResponse.json<{
      kind: string;
      points: Array<{ passiveId: string; weight: number }>;
    }>();
    expect(heatmapPayload.kind).toBe("passives");
    expect(heatmapPayload.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ passiveId: "lightning-walker", weight: 8 })
      ])
    );
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

  it("falls back to fixture build index when poe.ninja returns malformed JSON", async () => {
    const server = createServer({
      fetcher: async () => new Response("{not-json")
    });
    const response = await server.inject({ method: "GET", url: "/poe-ninja/build-index" });

    expect(response.statusCode).toBe(200);
    const payload = response.json<{
      index: { leagueBuilds: Array<{ leagueUrl: string; statistics: Array<{ className: string }> }> };
    }>();
    expect(payload.index.leagueBuilds[0]).toMatchObject({
      leagueUrl: "runesofaldur",
      statistics: expect.arrayContaining([expect.objectContaining({ className: "Martial Artist" })])
    });
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

  it("falls back to fixture leagues when poe.ninja league metadata is malformed", async () => {
    const server = createServer({
      fetcher: async (input) => {
        if (String(input).includes("build-index-state")) {
          return new Response("{bad-index");
        }

        return new Response("{bad-leagues");
      }
    });
    const response = await server.inject({ method: "GET", url: "/poe-ninja/leagues" });

    expect(response.statusCode).toBe(200);
    const payload = response.json<{
      leagues: Array<{ url: string; version: string; snapshotName: string; statistics: unknown[] }>;
    }>();
    expect(payload.leagues[0]).toMatchObject({
      url: "runesofaldur",
      version: "fixture",
      snapshotName: "runesofaldur"
    });
    expect(payload.leagues[0]?.statistics.length).toBeGreaterThan(0);
  });

  it("falls back to fixture builds when poe.ninja search protobuf is malformed", async () => {
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
                  statistics: []
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

        return new Response(new Uint8Array([0xff, 0xff, 0xff]));
      }
    });
    const response = await server.inject({
      method: "GET",
      url: "/builds?league=runesofaldur&class=Stormweaver&keystones=Raw%20Power&skills=Spark&supports=Martial%20Tempo&gear=Voltaxic%20Wand&sort=level&order=desc"
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json<{
      builds: Array<{ source: string }>;
      filters: Array<{ id: string; options: Array<{ value: string; count: number }> }>;
      source: string;
    }>();
    expect(payload.source).toBe("fixture");
    expect(payload.builds.every((build) => build.source === "fixture")).toBe(true);
    expect(payload.filters.find((filter) => filter.id === "class")?.options).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: "Stormweaver", count: 1 })])
    );
    expect(payload.filters.find((filter) => filter.id === "supports")?.options).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: "Martial Tempo" })])
    );
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

  it("formats trade stats upstream failures", async () => {
    __tradeInternals.resetCaches();
    const server = createServer({
      fetcher: async () => new Response("temporarily unavailable", { status: 503 })
    });

    const response = await server.inject({ method: "GET", url: "/trade/stats" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: "Trade stats request failed: 503"
    });
  });

  it("formats trade leagues upstream failures", async () => {
    __tradeInternals.resetCaches();
    const server = createServer({
      fetcher: async () =>
        new Response("rate limited", { status: 429, statusText: "Too Many Requests" })
    });

    const response = await server.inject({ method: "GET", url: "/trade/leagues" });

    expect(response.statusCode).toBe(429);
    expect(response.json()).toEqual({
      error: "Trade leagues request failed: 429 Too Many Requests"
    });
  });

  it("price checks an item through trade search and fetch", async () => {
    __tradeInternals.resetCaches();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
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
    expect(infoSpy).not.toHaveBeenCalled();
    infoSpy.mockRestore();
  });

  it("smokes the parsed rare item price-check path with mocked trade responses", async () => {
    __tradeInternals.resetCaches();
    const searchBodies: unknown[] = [];
    const server = createServer({
      fetcher: async (input, init) => {
        const url = String(input);

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
                    },
                    {
                      id: "pseudo.pseudo_total_chaos_resistance",
                      text: "Pseudo: total chaos resistance",
                      type: "pseudo"
                    },
                    {
                      id: "pseudo.pseudo_total_maximum_life",
                      text: "Pseudo: total maximum life",
                      type: "pseudo"
                    }
                  ]
                },
                {
                  id: "explicit",
                  label: "Explicit",
                  entries: [
                    {
                      id: "explicit.stat_3299347043",
                      text: "+# to Strength",
                      type: "explicit"
                    }
                  ]
                }
              ]
            })
          );
        }

        if (url.includes("/api/trade2/search/Standard")) {
          searchBodies.push(JSON.parse(String(init?.body)));
          return new Response(JSON.stringify({ id: "rare-query", result: ["rare-1"], total: 7 }));
        }

        if (url.includes("/api/trade2/fetch/rare-1")) {
          return new Response(
            JSON.stringify({
              result: [
                {
                  id: "rare-1",
                  item: { name: "Storm Loop", typeLine: "Ruby Ring", ilvl: 80 },
                  listing: {
                    account: { name: "RingTrader" },
                    price: { amount: 11, currency: "exalted" },
                    indexed: "2026-06-11T12:00:00Z",
                    whisper: "@RingTrader Hi, I would like to buy your Storm Loop"
                  }
                }
              ]
            })
          );
        }

        return new Response("unexpected URL", { status: 404 });
      }
    });
    const item = parseTradeItemText(`Item Class: Rings
Rarity: Rare
Storm Loop
Ruby Ring
--------
Requirements:
Level: 52
--------
Item Level: 80
--------
+15% to Fire Resistance (implicit)
--------
+15% to Lightning Resistance
+12% to Chaos Resistance
+64 to maximum Life
+23 to Strength`);
    const request = buildTradePriceCheckRequest(item, "Standard", item.statCandidates, 10);

    const response = await server.inject({
      method: "POST",
      url: "/trade/price-check",
      payload: request
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json<{
      result: {
        total: number;
        tradeUrl: string;
        filters: Array<{ tradeStatId?: string; min?: number }>;
        listings: Array<{
          itemName: string;
          seller?: string;
          priceAmount?: number;
          priceCurrency?: string;
          tradeUrl?: string;
        }>;
      };
    }>();
    expect(payload.result.total).toBe(7);
    expect(payload.result.tradeUrl).toBe(
      "https://www.pathofexile.com/trade2/search/poe2/Standard/rare-query"
    );
    expect(payload.result.listings[0]).toMatchObject({
      itemName: "Storm Loop",
      seller: "RingTrader",
      priceAmount: 11,
      priceCurrency: "exalted",
      tradeUrl: payload.result.tradeUrl
    });
    expect(payload.result.filters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tradeStatId: "pseudo.pseudo_total_elemental_resistance",
          min: 30
        }),
        expect.objectContaining({ tradeStatId: "explicit.stat_3299347043", min: 23 })
      ])
    );
    expect(searchBodies[0]).toMatchObject({
      query: {
        status: { option: "online" },
        type: "Ruby Ring"
      },
      sort: { price: "asc" }
    });
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

  it("truncates large upstream trade error bodies", async () => {
    __tradeInternals.resetCaches();
    const server = createServer({
      fetcher: async (input) => {
        if (String(input).includes("/api/trade2/data/stats")) {
          return new Response(JSON.stringify({ result: [] }));
        }

        return new Response("x".repeat(1_000), { status: 503 });
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

    const error = response.json<{ error: string }>().error;
    expect(response.statusCode).toBe(503);
    expect(error).toContain("Trade search failed");
    expect(error.length).toBeLessThan(600);
    expect(error).toContain("...");
  });
});
