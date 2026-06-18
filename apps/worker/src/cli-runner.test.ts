import { describe, expect, it } from "vitest";
import { runWorkerCli } from "./cli-runner";

describe("worker CLI", () => {
  it("prints useful ingest output for the known poe.ninja command", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runWorkerCli(["ingest:poe-ninja"], {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message)
    });

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout[0]).toBe("Ingested 1 poe.ninja build snapshot(s).");
    expect(stdout[1]).toContain('"characterName": "GrenadeMap"');
  });

  it("returns a non-zero exit code for unknown worker jobs", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runWorkerCli(["missing:job"], {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message)
    });

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([]);
    expect(stderr[0]).toBe("Unknown worker job: missing:job");
    expect(stderr[1]).toContain("Usage:");
  });

  it("returns a non-zero exit code when a known job fails", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runWorkerCli(
      ["summarize:builds"],
      {
        stdout: (message) => stdout.push(message),
        stderr: (message) => stderr.push(message)
      },
      {
        ingestPoeNinja: async () => [],
        summarizeBuilds: async () => {
          throw new Error("summary source unavailable");
        },
        aggregateHeatmaps: async () => ({
          kind: "passives",
          league: "Dawn of the Hunt",
          points: [],
          generatedAt: "2026-06-18T00:00:00.000Z"
        })
      }
    );

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([]);
    expect(stderr).toEqual(["Worker job failed: summary source unavailable"]);
  });
});
