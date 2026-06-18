import { describe, expect, it } from "vitest";
import type { BuildFilterGroup } from "@zoe/domain";
import {
  activeValuesForGroup,
  buildDetailHref,
  createBuildFilterHref,
  optionsForGroup,
  parseBuildSearchParams,
  splitParam
} from "./builds-query";

describe("build explorer query helpers", () => {
  it("parses URL search params with normalized list, sort, and order defaults", () => {
    const params = parseBuildSearchParams(
      new URLSearchParams(
        "search=storm&class=Stormweaver,, Chronomancer &skills=Spark,Orb%20of%20Storms&supports=Martial%20Tempo&gear=Voltaxic%20Wand&sort=not-valid&order=sideways"
      ),
      "Dawn of the Hunt"
    );

    expect(params).toEqual({
      league: "Dawn of the Hunt",
      search: "storm",
      className: ["Stormweaver", "Chronomancer"],
      keystones: [],
      skills: ["Spark", "Orb of Storms"],
      supports: ["Martial Tempo"],
      gear: ["Voltaxic Wand"],
      sort: "level",
      order: "desc"
    });
  });

  it("keeps valid sort and order values from URL search params", () => {
    const params = parseBuildSearchParams(
      new URLSearchParams("league=Standard&sort=dps&order=asc"),
      "Fallback"
    );

    expect(params.league).toBe("Standard");
    expect(params.sort).toBe("dps");
    expect(params.order).toBe("asc");
  });

  it("toggles filter values while preserving league and clearing pagination", () => {
    const href = createBuildFilterHref({
      fallbackLeague: "Standard",
      groupId: "skills",
      pathname: "/",
      searchParams: new URLSearchParams("skills=Spark&page=3&sort=dps"),
      value: "Orb of Storms"
    });

    expect(href).toBe("/?skills=Spark%2COrb+of+Storms&sort=dps&league=Standard");

    const removedHref = createBuildFilterHref({
      fallbackLeague: "Standard",
      groupId: "skills",
      pathname: "/",
      searchParams: new URLSearchParams("league=Standard&skills=Spark,Orb%20of%20Storms&page=3"),
      value: "Spark"
    });

    expect(removedHref).toBe("/?league=Standard&skills=Orb+of+Storms");
  });

  it("maps active values and summary options by filter group", () => {
    const params = parseBuildSearchParams(
      new URLSearchParams("class=Infernalist&keystones=Mind%20Over%20Matter"),
      "Standard"
    );
    const filters: BuildFilterGroup[] = [
      {
        id: "skills",
        label: "Skills",
        options: [{ count: 12, label: "Spark", value: "Spark" }]
      }
    ];

    expect(activeValuesForGroup(params, "class")).toEqual(["Infernalist"]);
    expect(activeValuesForGroup(params, "keystones")).toEqual(["Mind Over Matter"]);
    expect(optionsForGroup([...filters], "skills")).toEqual(filters[0]!.options);
    expect(optionsForGroup([...filters], "gear")).toEqual([]);
  });

  it("creates stable encoded build detail hrefs", () => {
    expect(
      buildDetailHref({
        id: "unused",
        league: "Runes of Aldur",
        accountName: "Storm Account",
        characterName: "Spark/Index",
        className: "Sorceress",
        level: 95
      })
    ).toBe("/builds/Runes%20of%20Aldur%3AStorm%20Account%3ASpark%2FIndex");
  });

  it("splits comma params without empty entries", () => {
    expect(splitParam(" Spark, ,Orb of Storms,, ")).toEqual(["Spark", "Orb of Storms"]);
    expect(splitParam(null)).toEqual([]);
  });
});
