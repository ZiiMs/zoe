import { describe, expect, it } from "vitest";
import { createZoeApiClient } from "./index";

interface FetchCall {
  input: string;
  init: RequestInit | undefined;
}

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });
}

describe("createZoeApiClient", () => {
  it("covers the public API surface with typed methods", async () => {
    const calls: FetchCall[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push({ input: String(input), init });
      return jsonResponse({});
    };
    const api = createZoeApiClient({ baseUrl: "http://localhost:8787/", fetcher });

    await api.health();
    await api.builds();
    await api.build("fixture:spark stormweaver");
    await api.poeNinjaBuildIndex();
    await api.poeNinjaLeagues();
    await api.summaries();
    await api.passiveHeatmap();
    await api.itemHeatmap();
    await api.tradeStats();
    await api.tradeLeagues();
    await api.priceCheck({
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
      filters: [],
      limit: 5
    });

    expect(calls.map((call) => call.input)).toEqual([
      "http://localhost:8787/health",
      "http://localhost:8787/builds",
      "http://localhost:8787/builds/fixture%3Aspark%20stormweaver",
      "http://localhost:8787/poe-ninja/build-index",
      "http://localhost:8787/poe-ninja/leagues",
      "http://localhost:8787/summaries",
      "http://localhost:8787/heatmaps/passives",
      "http://localhost:8787/heatmaps/items",
      "http://localhost:8787/trade/stats",
      "http://localhost:8787/trade/leagues",
      "http://localhost:8787/trade/price-check"
    ]);
    expect(calls.at(-1)?.init).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: expect.stringContaining('"league":"Standard"')
    });
  });

  it("serializes build query parameters for poe.ninja searches", async () => {
    const calls: FetchCall[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push({ input: String(input), init });
      return jsonResponse({ builds: [] });
    };
    const api = createZoeApiClient({ baseUrl: "http://localhost:8787", fetcher });

    await api.builds({
      league: "Runes of Aldur",
      search: "Storm Index",
      className: ["Stormweaver", "Chronomancer"],
      keystones: ["Raw Power"],
      skills: ["Spark", "Orb of Storms"],
      supports: ["Martial Tempo"],
      gear: ["Voltaxic Wand"],
      sort: "dps",
      order: "asc",
      page: 2
    });

    expect(calls[0]?.input).toBe(
      "http://localhost:8787/builds?league=Runes+of+Aldur&search=Storm+Index&class=Stormweaver%2CChronomancer&keystones=Raw+Power&skills=Spark%2COrb+of+Storms&supports=Martial+Tempo&gear=Voltaxic+Wand&sort=dps&order=asc&page=2"
    );
  });

  it("formats API error bodies without dropping status context", async () => {
    const api = createZoeApiClient({
      baseUrl: "http://localhost:8787",
      fetcher: async () =>
        jsonResponse({ error: "Trade search failed: 429 Too Many Requests" }, { status: 429 })
    });

    await expect(api.tradeStats()).rejects.toThrow(
      "Zoe API request failed: 429  - Trade search failed: 429 Too Many Requests"
    );
  });

  it("preserves a helpful unreachable-API message", async () => {
    const api = createZoeApiClient({
      baseUrl: "http://localhost:8787/",
      fetcher: async () => {
        throw new TypeError("fetch failed");
      }
    });

    await expect(api.health()).rejects.toThrow(
      'Zoe API unreachable at http://localhost:8787. Start it with "bun run dev:api" or run "bun run dev". TypeError: fetch failed'
    );
  });
});
