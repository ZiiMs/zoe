import type {
  BuildMetadata,
  BuildMetrics,
  BuildSnapshot,
  ItemUsage,
  PassiveHeatmapPoint,
  SkillUsage
} from "./types";

interface PoeNinjaSkill {
  name?: string;
  gem?: string;
  count?: number;
  usageCount?: number;
}

interface PoeNinjaItem {
  slot?: string;
  name?: string;
  baseType?: string;
  rarity?: string;
}

interface PoeNinjaPassive {
  id?: string | number;
  skill?: string | number;
  name?: string;
  x?: number;
  y?: number;
  count?: number;
}

export interface PoeNinjaBuildPayload {
  id?: string;
  accountName?: string;
  name?: string;
  characterName?: string;
  class?: string;
  className?: string;
  ascendancy?: string;
  ascendancyName?: string;
  level?: number;
  league?: string;
  rank?: number;
  skills?: PoeNinjaSkill[];
  items?: PoeNinjaItem[];
  passives?: PoeNinjaPassive[];
  metrics?: BuildMetrics;
}

export function normalizePoeNinjaBuild(
  payload: PoeNinjaBuildPayload,
  capturedAt = new Date().toISOString()
): BuildSnapshot {
  const characterName = payload.characterName ?? payload.name ?? "Unknown Character";
  const accountName = payload.accountName ?? "unknown";

  const metadata: BuildMetadata = {
    id: payload.id ?? `${accountName}:${characterName}`,
    accountName,
    characterName,
    className: payload.className ?? payload.class ?? "Unknown",
    ascendancyName: payload.ascendancyName ?? payload.ascendancy,
    level: payload.level ?? 0,
    league: payload.league ?? "Unknown",
    rank: payload.rank
  };

  return {
    metadata,
    mainSkills: normalizeSkills(payload.skills ?? []),
    items: normalizeItems(payload.items ?? []),
    passives: normalizePassives(payload.passives ?? []),
    metrics: payload.metrics,
    capturedAt,
    source: "poe.ninja"
  };
}

function normalizeSkills(skills: PoeNinjaSkill[]): SkillUsage[] {
  return skills
    .map((skill) => {
      const name = skill.name ?? skill.gem ?? "Unknown Skill";
      return {
        id: slugify(name),
        name,
        usageCount: skill.usageCount ?? skill.count ?? 1
      };
    })
    .sort((a, b) => b.usageCount - a.usageCount);
}

function normalizeItems(items: PoeNinjaItem[]): ItemUsage[] {
  return items.map((item) => ({
    slot: item.slot ?? "unknown",
    name: item.name ?? "Unknown Item",
    baseType: item.baseType,
    rarity: item.rarity,
    usageCount: 1
  }));
}

function normalizePassives(passives: PoeNinjaPassive[]): PassiveHeatmapPoint[] {
  return passives
    .map((passive) => ({
      passiveId: String(passive.id ?? passive.skill ?? "unknown"),
      name: passive.name,
      x: passive.x,
      y: passive.y,
      weight: passive.count ?? 1
    }))
    .filter((passive) => passive.passiveId !== "unknown");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
