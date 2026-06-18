import { describe, expect, it } from "vitest";
import { readDesktopEnv, readServerEnv, readWebEnv } from "./index";

describe("environment validation", () => {
  it("provides fixture-friendly server defaults", () => {
    expect(readServerEnv({})).toEqual({
      DATABASE_URL: "postgres://zoe:zoe@localhost:5432/zoe",
      API_HOST: "0.0.0.0",
      API_PORT: 4000,
      POE_NINJA_BASE_URL: "https://poe.ninja/poe2/api/data"
    });
  });

  it("coerces valid API ports and rejects invalid ports", () => {
    expect(readServerEnv({ API_PORT: "4100" }).API_PORT).toBe(4100);
    expect(() => readServerEnv({ API_PORT: "not-a-port" })).toThrow();
  });

  it("validates web and desktop API base URLs with local defaults", () => {
    expect(readWebEnv({}).NEXT_PUBLIC_API_BASE_URL).toBe("http://localhost:4000");
    expect(readDesktopEnv({}).VITE_ZOE_API_BASE_URL).toBe("http://localhost:4000");

    expect(
      readWebEnv({ NEXT_PUBLIC_API_BASE_URL: "https://api.example.test" })
        .NEXT_PUBLIC_API_BASE_URL
    ).toBe("https://api.example.test");
    expect(
      readDesktopEnv({ VITE_ZOE_API_BASE_URL: "https://api.example.test" })
        .VITE_ZOE_API_BASE_URL
    ).toBe("https://api.example.test");

    expect(() => readWebEnv({ NEXT_PUBLIC_API_BASE_URL: "localhost:4000" })).toThrow();
    expect(() => readDesktopEnv({ VITE_ZOE_API_BASE_URL: "localhost:4000" })).toThrow();
  });
});
