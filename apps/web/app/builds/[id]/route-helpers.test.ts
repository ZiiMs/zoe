import { describe, expect, it } from "vitest";
import { buildListHref, safeDecode } from "./route-helpers";

describe("build detail route helpers", () => {
  it("preserves build explorer context for missing-detail fallback links", () => {
    expect(
      buildListHref({
        league: "Runes of Aldur",
        search: "Storm Account",
        class: "Stormweaver",
        skills: ["Spark", "Orb of Storms"],
        supports: undefined,
        gear: "",
        sort: "dps",
        order: "asc",
        page: "2",
        ignored: "value"
      })
    ).toBe(
      "/?league=Runes+of+Aldur&search=Storm+Account&class=Stormweaver&skills=Spark&skills=Orb+of+Storms&sort=dps&order=asc&page=2"
    );
  });

  it("decodes route ids safely for fallback display", () => {
    expect(safeDecode("Runes%20of%20Aldur%3AAccount%3ACharacter")).toBe(
      "Runes of Aldur:Account:Character"
    );
    expect(safeDecode("%E0%A4%A")).toBe("%E0%A4%A");
  });
});
