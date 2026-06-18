import { readServerEnv } from "@zoe/config";
import { createPool } from "@zoe/db";
import { createServer } from "./server";

const env = readServerEnv();
const pool = env.ZOE_API_PERSISTED_READS
  ? createPool({ connectionString: env.DATABASE_URL })
  : undefined;
const server = createServer({
  poeNinjaBaseUrl: env.POE_NINJA_BASE_URL,
  dbClient: pool
});

await server.listen({
  host: env.API_HOST,
  port: env.API_PORT
});
