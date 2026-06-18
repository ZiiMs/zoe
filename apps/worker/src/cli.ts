import { runWorkerCli } from "./cli-runner";

process.exitCode = await runWorkerCli(process.argv.slice(2));
