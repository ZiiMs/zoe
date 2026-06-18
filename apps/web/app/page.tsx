import { Suspense } from "react";
import { createZoeApiClient } from "@zoe/api-client";
import { readWebEnv } from "@zoe/config";
import type { BuildSearchResponse } from "@zoe/domain";
import { BuildsPage } from "./builds-page";

const env = readWebEnv(process.env);
const api = createZoeApiClient({
  baseUrl: env.NEXT_PUBLIC_API_BASE_URL
});

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialData = await loadInitialData(params);

  return (
    <Suspense>
      <BuildsPage initialData={initialData} />
    </Suspense>
  );
}

async function loadInitialData(params: Record<string, string | string[] | undefined>): Promise<BuildSearchResponse> {
  try {
    return await api.builds({
      league: first(params.league),
      search: first(params.search),
      className: list(params.class),
      keystones: list(params.keystones),
      skills: list(params.skills),
      supports: list(params.supports),
      gear: list(params.gear),
      sort: parseSort(first(params.sort)),
      order: parseOrder(first(params.order))
    });
  } catch {
    return {
      builds: [],
      total: 0,
      filters: [],
      leagues: [],
      league: {
        name: "Offline",
        url: "offline",
        displayName: "Offline",
        indexed: false,
        hardcore: false,
        version: "",
        snapshotName: "",
        total: 0,
        statistics: []
      },
      sort: { field: "level", order: "desc" },
      fetchedAt: new Date().toISOString(),
      source: "fixture"
    };
  }
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function list(value: string | string[] | undefined) {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  return rawValues.flatMap((rawValue) => rawValue.split(",")).map((item) => item.trim()).filter(Boolean);
}

function parseSort(value?: string) {
  return value === "dps" || value === "life" || value === "energyshield" || value === "ehp" || value === "level"
    ? value
    : undefined;
}

function parseOrder(value?: string) {
  return value === "asc" || value === "desc" ? value : undefined;
}
