export type PoeLeague = string;

export interface BuildMetadata {
  id: string;
  accountName: string;
  characterName: string;
  className: string;
  ascendancyName?: string | undefined;
  level: number;
  league: PoeLeague;
  rank?: number | undefined;
}

export interface SkillUsage {
  id: string;
  name: string;
  socketGroup?: string | undefined;
  usageCount: number;
}

export interface ItemUsage {
  slot: string;
  name: string;
  baseType?: string | undefined;
  rarity?: string | undefined;
  usageCount: number;
}

export interface PassiveHeatmapPoint {
  passiveId: string;
  name?: string | undefined;
  x?: number | undefined;
  y?: number | undefined;
  weight: number;
}

export interface BuildMetrics {
  highestDpsSkill?: string | undefined;
  highestDpsSkillIconUrl?: string | undefined;
  dpsLabel?: string | undefined;
  life?: number | undefined;
  energyShield?: number | undefined;
  ehpLabel?: string | undefined;
}

export interface BuildSnapshot {
  metadata: BuildMetadata;
  mainSkills: SkillUsage[];
  items: ItemUsage[];
  passives: PassiveHeatmapPoint[];
  metrics?: BuildMetrics | undefined;
  capturedAt: string;
  source: "poe.ninja" | "manual" | "fixture";
}

export interface BuildSummary {
  id: string;
  buildId: string;
  title: string;
  highlights: string[];
  primarySkill?: string | undefined;
  defensiveLayers: string[];
  generatedAt: string;
}

export interface HeatmapAggregate {
  kind: "passives" | "items";
  league: PoeLeague;
  className?: string | undefined;
  points: PassiveHeatmapPoint[];
  generatedAt: string;
}

export interface PoeNinjaClassStatistic {
  className: string;
  percentage: number;
  trend: -1 | 0 | 1;
}

export interface PoeNinjaLeagueBuilds {
  leagueName: string;
  leagueUrl: string;
  total: number;
  status: number;
  statistics: PoeNinjaClassStatistic[];
}

export interface PoeNinjaBuildIndex {
  leagueBuilds: PoeNinjaLeagueBuilds[];
  fetchedAt: string;
}

export type BuildFilterGroupId = "class" | "keystones" | "skills" | "supports" | "gear";

export interface BuildFilterOption {
  value: string;
  label: string;
  count: number;
}

export interface BuildFilterGroup {
  id: BuildFilterGroupId;
  label: string;
  options: BuildFilterOption[];
}

export type BuildSortField = "level" | "dps" | "life" | "energyshield" | "ehp";
export type SortOrder = "asc" | "desc";

export interface BuildSearchParams {
  league?: string | undefined;
  search?: string | undefined;
  className?: string[] | undefined;
  keystones?: string[] | undefined;
  skills?: string[] | undefined;
  supports?: string[] | undefined;
  gear?: string[] | undefined;
  sort?: BuildSortField | undefined;
  order?: SortOrder | undefined;
  page?: number | undefined;
}

export interface PoeNinjaLeagueOption {
  name: string;
  url: string;
  displayName: string;
  indexed: boolean;
  hardcore: boolean;
  version: string;
  snapshotName: string;
  total: number;
  statistics: PoeNinjaClassStatistic[];
}

export interface BuildSearchResponse {
  builds: BuildSnapshot[];
  total: number;
  filters: BuildFilterGroup[];
  leagues: PoeNinjaLeagueOption[];
  league: PoeNinjaLeagueOption;
  sort: {
    field: BuildSortField;
    order: SortOrder;
  };
  fetchedAt: string;
  source: "poe.ninja" | "fixture" | "database";
}

export interface BuildDetailGem {
  name: string;
  iconUrl?: string | undefined;
  support: boolean;
}

export interface BuildDetailSkillGroup {
  name: string;
  iconUrl?: string | undefined;
  dps?: number | undefined;
  gems: BuildDetailGem[];
}

export interface BuildDetailItem {
  slot: string;
  name: string;
  typeLine: string;
  rarity?: string | undefined;
  iconUrl?: string | undefined;
  implicitMods: string[];
  explicitMods: string[];
}

export interface BuildDetailKeystone {
  name: string;
  iconUrl?: string | undefined;
  stats: string[];
}

export interface BuildPassiveTreeNode {
  id: number;
  name: string;
  x: number;
  y: number;
  stats: string[];
  allocated: boolean;
  weaponSet?: 1 | 2 | undefined;
  notable?: boolean | undefined;
  keystone?: boolean | undefined;
  ascendancy?: boolean | undefined;
}

export interface BuildPassiveTreeEdge {
  from: number;
  to: number;
}

export interface BuildPassiveTree {
  name?: string | undefined;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  nodes: BuildPassiveTreeNode[];
  edges: BuildPassiveTreeEdge[];
}

export interface BuildDefensiveStats {
  life?: number | undefined;
  energyShield?: number | undefined;
  mana?: number | undefined;
  spirit?: number | undefined;
  effectiveHealthPool?: number | undefined;
  evasionRating?: number | undefined;
  armour?: number | undefined;
  fireResistance?: number | undefined;
  coldResistance?: number | undefined;
  lightningResistance?: number | undefined;
  chaosResistance?: number | undefined;
  blockChance?: number | undefined;
}

export interface BuildDetail {
  build: BuildSnapshot;
  poeNinjaUrl: string;
  defensiveStats: BuildDefensiveStats;
  skillGroups: BuildDetailSkillGroup[];
  items: BuildDetailItem[];
  flasks: BuildDetailItem[];
  jewels: BuildDetailItem[];
  keystones: BuildDetailKeystone[];
  passiveTree?: BuildPassiveTree | undefined;
  passiveCounts: {
    passives?: number | undefined;
    anoints?: number | undefined;
    ascendancy?: number | undefined;
    bonusPassives?: number | undefined;
  };
  updatedAt?: string | undefined;
  lastSeenAt?: string | undefined;
  source: "poe.ninja" | "fixture" | "database";
}
