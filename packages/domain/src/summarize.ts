import type { BuildSnapshot, BuildSummary, HeatmapAggregate, PassiveHeatmapPoint } from "./types";

export function summarizeBuild(
  build: BuildSnapshot,
  generatedAt = new Date().toISOString()
): BuildSummary {
  const primarySkill = build.mainSkills[0]?.name;
  const uniqueItems = build.items.filter((item) => item.rarity?.toLowerCase() === "unique");
  const highlights = [
    `${build.metadata.className}${build.metadata.ascendancyName ? ` ${build.metadata.ascendancyName}` : ""}`,
    `Level ${build.metadata.level}`,
    primarySkill ? `Primary skill: ${primarySkill}` : "Primary skill unknown",
    uniqueItems.length > 0 ? `${uniqueItems.length} unique item(s)` : "No unique items detected"
  ];

  return {
    id: `summary:${build.metadata.id}`,
    buildId: build.metadata.id,
    title: `${build.metadata.characterName} build summary`,
    highlights,
    primarySkill,
    defensiveLayers: inferDefensiveLayers(build),
    generatedAt
  };
}

export function aggregatePassiveHeatmap(
  builds: BuildSnapshot[],
  league: string,
  generatedAt = new Date().toISOString()
): HeatmapAggregate {
  const points = new Map<string, PassiveHeatmapPoint>();

  for (const build of builds) {
    for (const passive of build.passives) {
      const current = points.get(passive.passiveId);
      points.set(passive.passiveId, {
        passiveId: passive.passiveId,
        name: passive.name ?? current?.name,
        x: passive.x ?? current?.x,
        y: passive.y ?? current?.y,
        weight: (current?.weight ?? 0) + passive.weight
      });
    }
  }

  return {
    kind: "passives",
    league,
    points: [...points.values()].sort((a, b) => b.weight - a.weight),
    generatedAt
  };
}

function inferDefensiveLayers(build: BuildSnapshot): string[] {
  const itemText = build.items
    .map((item) => `${item.name} ${item.baseType ?? ""}`)
    .join(" ")
    .toLowerCase();
  const layers = new Set<string>();

  if (itemText.includes("shield")) {
    layers.add("block");
  }

  if (itemText.includes("armour") || itemText.includes("plate")) {
    layers.add("armour");
  }

  if (itemText.includes("evasion") || itemText.includes("leather")) {
    layers.add("evasion");
  }

  return [...layers];
}
