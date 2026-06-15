import { aggregateHeatmaps, ingestPoeNinja, summarizeBuilds } from "./jobs";

const command = process.argv[2] ?? "help";

switch (command) {
  case "ingest:poe-ninja": {
    console.log(JSON.stringify(await ingestPoeNinja(), null, 2));
    break;
  }
  case "summarize:builds": {
    console.log(JSON.stringify(await summarizeBuilds(), null, 2));
    break;
  }
  case "aggregate:heatmaps": {
    console.log(JSON.stringify(await aggregateHeatmaps(), null, 2));
    break;
  }
  default: {
    console.log(
      "Usage: bun --filter @zoe/worker <ingest:poe-ninja|summarize:builds|aggregate:heatmaps>"
    );
  }
}
