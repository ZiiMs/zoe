import { aggregateHeatmaps, ingestPoeNinja, summarizeBuilds } from "./jobs";

type LogFn = (message: string) => void;

interface WorkerCliIo {
  stdout: LogFn;
  stderr: LogFn;
}

interface WorkerCliJobs {
  ingestPoeNinja: typeof ingestPoeNinja;
  summarizeBuilds: typeof summarizeBuilds;
  aggregateHeatmaps: typeof aggregateHeatmaps;
}

const usage =
  "Usage: bun --filter @zoe/worker <ingest:poe-ninja|summarize:builds|aggregate:heatmaps>";

const defaultIo: WorkerCliIo = {
  stdout: (message) => console.log(message),
  stderr: (message) => console.error(message)
};

const defaultJobs: WorkerCliJobs = {
  ingestPoeNinja,
  summarizeBuilds,
  aggregateHeatmaps
};

export async function runWorkerCli(
  args: string[],
  io: WorkerCliIo = defaultIo,
  jobs: WorkerCliJobs = defaultJobs
): Promise<number> {
  const command = args[0] ?? "help";

  try {
    switch (command) {
      case "ingest:poe-ninja": {
        const builds = await jobs.ingestPoeNinja();
        io.stdout(`Ingested ${builds.length} poe.ninja build snapshot(s).`);
        io.stdout(JSON.stringify(builds, null, 2));
        return 0;
      }
      case "summarize:builds": {
        const summaries = await jobs.summarizeBuilds();
        io.stdout(`Generated ${summaries.length} build summary record(s).`);
        io.stdout(JSON.stringify(summaries, null, 2));
        return 0;
      }
      case "aggregate:heatmaps": {
        const heatmap = await jobs.aggregateHeatmaps();
        io.stdout(
          `Aggregated ${heatmap.points.length} ${heatmap.kind} heatmap point(s) for ${heatmap.league}.`
        );
        io.stdout(JSON.stringify(heatmap, null, 2));
        return 0;
      }
      case "help": {
        io.stdout(usage);
        return 0;
      }
      default: {
        io.stderr(`Unknown worker job: ${command}`);
        io.stderr(usage);
        return 1;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`Worker job failed: ${message}`);
    return 1;
  }
}
