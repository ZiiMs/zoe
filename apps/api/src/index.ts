import { readServerEnv } from "@zoe/config";
import { createServer } from "./server";

const env = readServerEnv();
const server = createServer({
  poeNinjaBaseUrl: env.POE_NINJA_BASE_URL
});

await server.listen({
  host: env.API_HOST,
  port: env.API_PORT
});
