import type { BuildFilterGroup, BuildSearchParams, BuildSnapshot } from "@zoe/domain";

export type ActiveBuildSearchParams = {
  league: string;
  search: string;
  className: string[];
  keystones: string[];
  skills: string[];
  supports: string[];
  gear: string[];
  sort: NonNullable<BuildSearchParams["sort"]>;
  order: NonNullable<BuildSearchParams["order"]>;
};

export function parseBuildSearchParams(
  searchParams: URLSearchParams,
  fallbackLeague: string
): ActiveBuildSearchParams {
  return {
    league: searchParams.get("league") ?? fallbackLeague,
    search: searchParams.get("search") ?? "",
    className: splitParam(searchParams.get("class")),
    keystones: splitParam(searchParams.get("keystones")),
    skills: splitParam(searchParams.get("skills")),
    supports: splitParam(searchParams.get("supports")),
    gear: splitParam(searchParams.get("gear")),
    sort: parseSort(searchParams.get("sort")),
    order: parseOrder(searchParams.get("order"))
  };
}

export function createBuildFilterHref({
  fallbackLeague,
  groupId,
  pathname,
  searchParams,
  value
}: {
  fallbackLeague: string;
  groupId: BuildFilterGroup["id"];
  pathname: string;
  searchParams: URLSearchParams;
  value: string;
}) {
  const key = filterParamKey(groupId);
  const next = new URLSearchParams(searchParams.toString());
  const values = splitParam(next.get(key));
  const nextValues = values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];

  if (nextValues.length) {
    next.set(key, nextValues.join(","));
  } else {
    next.delete(key);
  }

  if (!next.get("league")) {
    next.set("league", fallbackLeague);
  }
  next.delete("page");

  return `${pathname}?${next.toString()}`;
}

export function activeValuesForGroup(
  params: ActiveBuildSearchParams,
  groupId: BuildFilterGroup["id"]
) {
  switch (groupId) {
    case "class":
      return params.className;
    case "keystones":
      return params.keystones;
    case "skills":
      return params.skills;
    case "supports":
      return params.supports;
    case "gear":
      return params.gear;
  }
}

export function filterParamKey(groupId: BuildFilterGroup["id"]) {
  return groupId === "class" ? "class" : groupId;
}

export function optionsForGroup(filters: BuildFilterGroup[], groupId: BuildFilterGroup["id"]) {
  return filters.find((group) => group.id === groupId)?.options ?? [];
}

export function splitParam(value: string | null) {
  return (
    value
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  );
}

export function parseSort(value: string | null): NonNullable<BuildSearchParams["sort"]> {
  return value === "dps" ||
    value === "life" ||
    value === "energyshield" ||
    value === "ehp" ||
    value === "level"
    ? value
    : "level";
}

export function parseOrder(value: string | null): NonNullable<BuildSearchParams["order"]> {
  return value === "asc" ? "asc" : "desc";
}

export function buildDetailHref(metadata: BuildSnapshot["metadata"]) {
  return `/builds/${encodeURIComponent(`${metadata.league}:${metadata.accountName}:${metadata.characterName}`)}`;
}
