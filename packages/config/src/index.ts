import { z } from "zod";

export const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url().default("postgres://zoe:zoe@localhost:5432/zoe"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  POE_NINJA_BASE_URL: z.string().url().default("https://poe.ninja/api/data")
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function readServerEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  return serverEnvSchema.parse(env);
}
