import { z } from "zod";

const httpUrlSchema = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Expected an HTTP(S) URL");

export const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url().default("postgres://zoe:zoe@localhost:5432/zoe"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  POE_NINJA_BASE_URL: httpUrlSchema.default("https://poe.ninja/poe2/api/data")
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function readServerEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  return serverEnvSchema.parse(env);
}

const clientApiBaseUrlSchema = httpUrlSchema.default("http://localhost:4000");

export const webEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: clientApiBaseUrlSchema
});

export const desktopEnvSchema = z.object({
  VITE_ZOE_API_BASE_URL: clientApiBaseUrlSchema
});

export type WebEnv = z.infer<typeof webEnvSchema>;
export type DesktopEnv = z.infer<typeof desktopEnvSchema>;

export function readWebEnv(env: Record<string, string | undefined>): WebEnv {
  return webEnvSchema.parse(env);
}

export function readDesktopEnv(env: Record<string, string | undefined>): DesktopEnv {
  return desktopEnvSchema.parse(env);
}
