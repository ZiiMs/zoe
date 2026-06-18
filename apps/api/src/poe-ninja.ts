import { parse } from "protobufjs";
import { normalizePoeNinjaBuild } from "@zoe/domain";
import type {
  BuildFilterGroup,
  BuildFilterGroupId,
  BuildDetail,
  BuildDetailGem,
  BuildDetailItem,
  BuildDetailKeystone,
  BuildPassiveTree,
  BuildDetailSkillGroup,
  BuildSearchParams,
  BuildSearchResponse,
  BuildSnapshot,
  BuildSortField,
  PoeNinjaBuildIndex,
  PoeNinjaClassStatistic,
  PoeNinjaLeagueOption,
  SortOrder
} from "@zoe/domain";
import { fixtureBuilds, fixturePoeNinjaBuildIndex } from "./fixtures";

const defaultPoeNinjaBaseUrl = "https://poe.ninja/poe2/api/data";
const passiveTreeExportUrl = "https://raw.githubusercontent.com/grindinggear/poe2-skilltree-export/main/data.json";
const defaultLeagueUrl = "runesofaldur";
const optionLimit = 300;
let passiveTreeCache: PassiveTreeExport | undefined;

const protoSchema = `
syntax = "proto3";
message NinjaSearchResult { SearchResult result = 1; }
message SearchResult {
  int32 total = 1;
  repeated SearchResultDimension dimensions = 2;
  repeated SearchResultIntegerDimension integer_dimensions = 3;
  repeated SearchResultPerformance performance_points = 4;
  repeated SearchResultValueList value_lists = 5;
  repeated SearchResultDictionaryReference dictionaries = 6;
  repeated SearchResultField fields = 7;
  repeated SearchResultSection sections = 8;
  repeated SearchResultFieldDescriptor field_descriptors = 9;
  repeated string default_field_ids = 10;
  repeated SearchResultFloatDimension float_dimensions = 11;
}
message SearchResultDimension { string id = 1; string dictionary_id = 2; repeated SearchResultDimensionCount counts = 3; }
message SearchResultDimensionCount { int32 key = 1; int32 count = 2; }
message SearchResultIntegerDimension { string id = 1; int32 min_value = 2; int32 max_value = 3; }
message SearchResultFloatDimension { string id = 1; double min_value = 2; double max_value = 3; }
message SearchResultPerformance { string name = 1; double ms = 2; }
message SearchResultValueList { string id = 1; repeated SearchResultValue values = 2; }
message SearchResultValue { string str = 1; int32 number = 2; repeated int32 numbers = 3; repeated string strs = 4; bool boolean = 5; }
message SearchResultDictionaryReference { string id = 1; string hash = 2; }
message SearchResultField { string id = 1; string type = 2; string name = 3; repeated string value_list_ids = 4; string sort_id = 5; string integer_dimension_id = 6; map<string,string> properties = 7; string main_field_id = 8; string description = 9; string group = 10; bool pinned = 11; }
message SearchResultSection { string id = 1; string type = 2; string name = 3; string dimension_id = 4; map<string,string> properties = 5; }
message SearchResultFieldDescriptor { string id = 1; string name = 2; bool optional = 3; string description = 4; string group = 5; bool pinned = 6; }
message SearchResultDictionary { string id = 1; repeated string values = 2; repeated SearchResultDictionaryProperty properties = 3; }
message SearchResultDictionaryProperty { string id = 1; repeated string values = 2; }
`;

const protoRoot = parse(protoSchema).root;

interface IndexStateLeague {
  name?: string;
  url?: string;
  displayName?: string;
  indexed?: boolean;
  hardcore?: boolean;
  version?: string;
  snapshotName?: string;
}

interface SearchResult {
  total?: number;
  dimensions?: SearchResultDimension[];
  valueLists?: SearchResultValueList[];
  dictionaries?: SearchResultDictionaryReference[];
}

interface SearchResultDimension {
  id?: string;
  dictionaryId?: string;
  counts?: Array<{ key?: number; count?: number }>;
}

interface SearchResultValueList {
  id?: string;
  values?: Array<{ str?: string; number?: number; numbers?: number[]; strs?: string[]; boolean?: boolean }>;
}

interface SearchResultDictionaryReference {
  id?: string;
  hash?: string;
}

interface SearchResultDictionary {
  id?: string;
  values?: string[];
  properties?: SearchResultDictionaryProperty[];
}

interface SearchResultDictionaryProperty {
  id?: string;
  values?: string[];
}

interface PassiveTreeExport {
  min_x?: number;
  min_y?: number;
  max_x?: number;
  max_y?: number;
  nodes?: Record<string, PassiveTreeExportNode> | PassiveTreeExportNode[];
  edges?: PassiveTreeExportEdge[];
}

interface PassiveTreeExportNode {
  skill?: number;
  name?: string;
  x?: number;
  y?: number;
  stats?: string[];
  isNotable?: boolean;
  isKeystone?: boolean;
  ascendancyId?: string;
}

interface PassiveTreeExportEdge {
  from?: number | string;
  to?: number | string;
}

interface PoeNinjaCharacterDetailPayload {
  account?: string;
  name?: string;
  class?: string;
  level?: number;
  league?: string;
  skills?: PoeNinjaSkillGroupPayload[];
  items?: PoeNinjaItemEntryPayload[];
  flasks?: PoeNinjaItemEntryPayload[];
  jewels?: PoeNinjaItemEntryPayload[];
  keystones?: PoeNinjaKeystonePayload[];
  defensiveStats?: PoeNinjaDefensiveStatsPayload;
  passiveCounts?: BuildDetail["passiveCounts"];
  updatedUtc?: string;
  lastSeenUtc?: string;
  passiveTreeName?: string;
  passiveSelection?: unknown;
  passiveSelectionSet1?: unknown;
  passiveSelectionSet2?: unknown;
}

interface PoeNinjaSkillGroupPayload {
  allGems?: PoeNinjaGemPayload[];
  dps?: Array<{ dps?: number }>;
}

interface PoeNinjaGemPayload {
  name?: string;
  itemData?: {
    typeLine?: string;
    icon?: string;
    support?: boolean;
  };
}

interface PoeNinjaItemEntryPayload {
  itemSlot?: string;
  itemData?: PoeNinjaItemPayload;
  inventoryId?: string;
  name?: string;
  typeLine?: string;
  baseType?: string;
  frameTypeId?: string;
  icon?: string;
  implicitMods?: string[];
  explicitMods?: string[];
  desecratedMods?: string[];
  runeMods?: string[];
}

interface PoeNinjaItemPayload {
  inventoryId?: string;
  name?: string;
  typeLine?: string;
  baseType?: string;
  frameTypeId?: string;
  icon?: string;
  implicitMods?: string[];
  explicitMods?: string[];
  desecratedMods?: string[];
  runeMods?: string[];
}

interface PoeNinjaKeystonePayload {
  name?: string;
  icon?: string;
  stats?: string[];
}

interface PoeNinjaDefensiveStatsPayload {
  life?: number;
  energyShield?: number;
  mana?: number;
  spirit?: number;
  effectiveHealthPool?: number;
  evasionRating?: number;
  armour?: number;
  fireResistance?: number;
  coldResistance?: number;
  lightningResistance?: number;
  chaosResistance?: number;
  blockChance?: number;
}

const dictionaryCache = new Map<string, SearchResultDictionary>();

export interface PoeNinjaOptions {
  baseUrl?: string | undefined;
}

export async function fetchPoeNinjaBuildIndex(
  fetcher: typeof fetch,
  options: PoeNinjaOptions = {}
): Promise<PoeNinjaBuildIndex> {
  const urls = createPoeNinjaUrls(options);

  try {
    const response = await fetcher(urls.buildIndexStateUrl);

    if (!response.ok) {
      throw new Error(`poe.ninja returned ${response.status}`);
    }

    const payload = (await response.json()) as {
      leagueBuilds?: Array<{
        leagueName?: string;
        leagueUrl?: string;
        total?: number;
        status?: number;
        statistics?: Array<{ class?: string; percentage?: number; trend?: number }>;
      }>;
    };

    return {
      fetchedAt: new Date().toISOString(),
      leagueBuilds: (payload.leagueBuilds ?? []).map((league) => ({
        leagueName: league.leagueName ?? "Unknown League",
        leagueUrl: league.leagueUrl ?? "unknown",
        total: league.total ?? 0,
        status: league.status ?? 0,
        statistics: (league.statistics ?? []).map(normalizeClassStatistic)
      }))
    };
  } catch {
    return fixturePoeNinjaBuildIndex;
  }
}

export async function fetchPoeNinjaLeagues(
  fetcher: typeof fetch,
  options: PoeNinjaOptions = {}
): Promise<PoeNinjaLeagueOption[]> {
  try {
    const [indexState, buildIndex] = await Promise.all([
      fetchIndexState(fetcher, options),
      fetchPoeNinjaBuildIndex(fetcher, options)
    ]);
    const leagueBuildsByUrl = new Map(buildIndex.leagueBuilds.map((league) => [league.leagueUrl, league]));
    const snapshotsByUrl = new Map((indexState.snapshotVersions ?? []).map((snapshot) => [snapshot.url, snapshot]));
    const current = normalizeIndexStateLeagues(indexState.buildLeagues ?? [], leagueBuildsByUrl, snapshotsByUrl);
    const old = normalizeIndexStateLeagues(indexState.oldBuildLeagues ?? [], leagueBuildsByUrl, snapshotsByUrl);
    const leagues = [...current, ...old].filter((league) => league.version && league.snapshotName);

    return leagues.length > 0 ? leagues : fixtureLeagues();
  } catch {
    return fixtureLeagues();
  }
}

export async function fetchPoeNinjaBuilds(
  params: BuildSearchParams,
  fetcher: typeof fetch,
  options: PoeNinjaOptions = {}
): Promise<BuildSearchResponse> {
  const sort = normalizeSort(params.sort);
  const order = normalizeOrder(params.order);
  const leagues = await fetchPoeNinjaLeagues(fetcher, options);
  const league = selectLeague(leagues, params.league);
  const fetchedAt = new Date().toISOString();

  try {
    const searchUrl = createSearchUrl(league, params, sort, order, options);
    const response = await fetcher(searchUrl);

    if (!response.ok) {
      throw new Error(`poe.ninja returned ${response.status}`);
    }

    const decoded = decodeSearchResult(new Uint8Array(await response.arrayBuffer()));
    const dictionaries = await fetchDictionaries(decoded.dictionaries ?? [], fetcher, options);
    const builds = normalizeBuildRows(decoded, dictionaries, league, fetchedAt, order);
    const filters = normalizeFilters(decoded, dictionaries, params);

    return {
      builds,
      total: decoded.total ?? builds.length,
      filters,
      leagues,
      league,
      sort: { field: sort, order },
      fetchedAt,
      source: "poe.ninja"
    };
  } catch {
    return fixtureBuildSearchResponse(leagues, league, sort, order, fetchedAt);
  }
}

export async function fetchPoeNinjaBuildDetail(
  id: string,
  fetcher: typeof fetch,
  options: PoeNinjaOptions = {}
): Promise<BuildDetail | undefined> {
  const parsed = parsePoeNinjaBuildId(id);

  if (!parsed) {
    const fixture = findFixtureBuildDetail(id);
    return fixture ? fixtureBuildDetail(fixture) : undefined;
  }

  const urls = createPoeNinjaUrls(options);
  const leagues = await fetchPoeNinjaLeagues(fetcher, options);
  const league = selectLeague(leagues, parsed.league);

  try {
    const query = new URLSearchParams({
      account: parsed.account,
      name: parsed.character,
      overview: league.snapshotName
    });
    const response = await fetcher(
      `${urls.buildsBaseUrl}/${encodeURIComponent(league.version)}/character?${query.toString()}`
    );

    if (!response.ok) {
      throw new Error(`poe.ninja returned ${response.status}`);
    }

    return normalizeCharacterDetail(await response.json(), parsed, league, fetcher);
  } catch {
    const fixture = findFixtureBuildDetail(id, parsed);
    return fixture ? fixtureBuildDetail(fixture) : undefined;
  }
}

export function decodeSearchResult(bytes: Uint8Array): SearchResult {
  const type = getProtoRoot().lookupType("NinjaSearchResult");
  const message = type.decode(bytes);
  const decoded = type.toObject(message, {
    defaults: false,
    longs: Number,
    arrays: true,
    objects: true
  }) as { result?: SearchResult };

  return decoded.result ?? {};
}

export function decodeDictionary(bytes: Uint8Array): SearchResultDictionary {
  const type = getProtoRoot().lookupType("SearchResultDictionary");
  const message = type.decode(bytes);
  return type.toObject(message, {
    defaults: false,
    longs: Number,
    arrays: true,
    objects: true
  }) as SearchResultDictionary;
}

function getProtoRoot() {
  return protoRoot;
}

function createPoeNinjaUrls(options: PoeNinjaOptions) {
  const dataBaseUrl = (options.baseUrl ?? defaultPoeNinjaBaseUrl).replace(/\/+$/, "");
  const apiBaseUrl = dataBaseUrl.endsWith("/data") ? dataBaseUrl.slice(0, -"/data".length) : dataBaseUrl;

  return {
    indexStateUrl: `${dataBaseUrl}/index-state`,
    buildIndexStateUrl: `${dataBaseUrl}/build-index-state`,
    buildsBaseUrl: `${apiBaseUrl}/builds`
  };
}

async function fetchIndexState(fetcher: typeof fetch, options: PoeNinjaOptions) {
  const urls = createPoeNinjaUrls(options);
  const response = await fetcher(urls.indexStateUrl);

  if (!response.ok) {
    throw new Error(`poe.ninja returned ${response.status}`);
  }

  return (await response.json()) as {
    buildLeagues?: IndexStateLeague[];
    oldBuildLeagues?: IndexStateLeague[];
    snapshotVersions?: IndexStateLeague[];
  };
}

function normalizeIndexStateLeagues(
  leagues: IndexStateLeague[],
  leagueBuildsByUrl: Map<string, PoeNinjaBuildIndex["leagueBuilds"][number]>,
  snapshotsByUrl: Map<string | undefined, IndexStateLeague>
): PoeNinjaLeagueOption[] {
  return leagues.map((league) => {
    const url = league.url ?? slugify(league.displayName ?? league.name ?? "unknown");
    const buildIndex = leagueBuildsByUrl.get(url);
    const snapshot = snapshotsByUrl.get(url);

    return {
      name: league.name ?? league.displayName ?? "Unknown League",
      url,
      displayName: league.displayName ?? league.name ?? titleize(url),
      indexed: league.indexed ?? Boolean(league.version),
      hardcore: league.hardcore ?? false,
      version: league.version ?? snapshot?.version ?? "",
      snapshotName: league.snapshotName ?? snapshot?.snapshotName ?? "",
      total: buildIndex?.total ?? 0,
      statistics: buildIndex?.statistics ?? []
    };
  });
}

function selectLeague(leagues: PoeNinjaLeagueOption[], leagueUrl?: string): PoeNinjaLeagueOption {
  const fallback = fixtureLeagues()[0] ?? fallbackLeague();
  return (
    leagues.find((league) => league.url === leagueUrl) ??
    leagues.find((league) => league.url === defaultLeagueUrl) ??
    leagues.find((league) => league.indexed) ??
    leagues[0] ??
    fallback
  );
}

function createSearchUrl(
  league: PoeNinjaLeagueOption,
  params: BuildSearchParams,
  sort: BuildSortField,
  order: SortOrder,
  options: PoeNinjaOptions = {}
) {
  const urls = createPoeNinjaUrls(options);
  const query = new URLSearchParams({
    overview: league.snapshotName,
    sort
  });

  if (order === "asc") {
    query.set("sort-asc", "true");
  }

  addQueryValue(query, "name", params.search);
  addQueryValues(query, "class", params.className);
  addQueryValues(query, "keypassives", params.keystones);
  addQueryValues(query, "skills", params.skills);
  addQueryValues(query, "allskills", params.supports);
  addQueryValues(query, "items", params.gear);

  return `${urls.buildsBaseUrl}/${encodeURIComponent(league.version)}/search?${query.toString()}`;
}

async function fetchDictionaries(
  references: SearchResultDictionaryReference[],
  fetcher: typeof fetch,
  options: PoeNinjaOptions
) {
  const urls = createPoeNinjaUrls(options);
  const dictionaries = new Map<string, SearchResultDictionary>();

  await Promise.all(
    references.map(async (reference) => {
      if (!reference.id || !reference.hash) {
        return;
      }

      const cached = dictionaryCache.get(reference.hash);
      if (cached) {
        dictionaries.set(reference.id, cached);
        return;
      }

      const response = await fetcher(`${urls.buildsBaseUrl}/dictionary/${encodeURIComponent(reference.hash)}`);
      if (!response.ok) {
        throw new Error(`poe.ninja dictionary returned ${response.status}`);
      }

      const dictionary = decodeDictionary(new Uint8Array(await response.arrayBuffer()));
      dictionaryCache.set(reference.hash, dictionary);
      dictionaries.set(reference.id, dictionary);
    })
  );

  return dictionaries;
}

function normalizeBuildRows(
  result: SearchResult,
  dictionaries: Map<string, SearchResultDictionary>,
  league: PoeNinjaLeagueOption,
  capturedAt: string,
  order: SortOrder
) {
  const valueLists = new Map((result.valueLists ?? []).map((list) => [list.id ?? "", list.values ?? []]));
  const names = valueLists.get("name") ?? [];
  const accounts = valueLists.get("account") ?? [];
  const classes = valueLists.get("class") ?? [];
  const levels = valueLists.get("level") ?? [];
  const life = valueLists.get("life") ?? [];
  const energyShield = valueLists.get("energyshield") ?? [];
  const ehp = valueLists.get("ehp") ?? [];
  const dps = valueLists.get("dps") ?? [];
  const skills = valueLists.get("skills") ?? valueLists.get("allskills") ?? [];
  const keyPassives = valueLists.get("keypassives") ?? [];
  const items = valueLists.get("items") ?? [];
  const classDictionary = dictionaries.get("class");
  const gemDictionary = dictionaries.get("gem");
  const passiveDictionary = dictionaries.get("keypassive");
  const itemDictionary = dictionaries.get("item");
  const rowCount = Math.max(names.length, accounts.length, classes.length, levels.length);

  return Array.from({ length: rowCount }, (_, index) => {
    const characterName = names[index]?.str ?? "Unknown Character";
    const accountName = accounts[index]?.str ?? "unknown";
    const ascendancyName = lookupDictionary(classDictionary, valueNumber(classes[index]));
    const mainSkills = lookupMany(gemDictionary, skills[index]?.numbers).slice(0, 4);
    const highestDpsSkill = lookupDictionary(gemDictionary, valueNumber(dps[index]));
    const highestDpsSkillIconUrl = lookupDictionaryProperty(gemDictionary, "icon", valueNumber(dps[index]));
    const passives = lookupMany(passiveDictionary, keyPassives[index]?.numbers).slice(0, 4);
    const gear = lookupMany(itemDictionary, items[index]?.numbers).slice(0, 3);
    const metrics = createBuildMetrics({
      ...(highestDpsSkill ? { highestDpsSkill } : {}),
      ...(highestDpsSkillIconUrl ? { highestDpsSkillIconUrl } : {}),
      ...(dps[index]?.str ? { dpsLabel: dps[index]?.str } : {}),
      ...(life[index]?.number !== undefined ? { life: life[index]?.number } : {}),
      ...(energyShield[index]?.number !== undefined ? { energyShield: energyShield[index]?.number } : {}),
      ...(ehp[index]?.str ? { ehpLabel: ehp[index]?.str } : {})
    });

    const payload = {
        id: `poe-ninja:${league.url}:${accountName}:${characterName}`,
        accountName,
        characterName,
        className: ascendancyName ?? "Unknown",
        level: levels[index]?.number ?? 0,
        league: league.displayName,
        skills: mainSkills.map((name) => ({ name, usageCount: 1 })),
        items: gear.map((name, gearIndex) => ({ slot: `item-${gearIndex + 1}`, name })),
        passives: passives.map((name) => ({ id: slugify(name), name, count: 1 })),
        ...(metrics ? { metrics } : {})
      };

    return normalizePoeNinjaBuild(
      {
        ...payload,
        ...(ascendancyName ? { ascendancyName } : {}),
        ...(order === "desc" ? { rank: index + 1 } : {})
      },
      capturedAt
    );
  });
}

function createBuildMetrics(metrics: {
  highestDpsSkill?: string;
  highestDpsSkillIconUrl?: string;
  dpsLabel?: string;
  life?: number;
  energyShield?: number;
  ehpLabel?: string;
}) {
  const normalized = {
    ...(metrics.highestDpsSkill ? { highestDpsSkill: metrics.highestDpsSkill } : {}),
    ...(metrics.highestDpsSkillIconUrl ? { highestDpsSkillIconUrl: metrics.highestDpsSkillIconUrl } : {}),
    ...(metrics.dpsLabel ? { dpsLabel: metrics.dpsLabel } : {}),
    ...(metrics.life !== undefined ? { life: metrics.life } : {}),
    ...(metrics.energyShield !== undefined ? { energyShield: metrics.energyShield } : {}),
    ...(metrics.ehpLabel ? { ehpLabel: metrics.ehpLabel } : {})
  };

  return Object.keys(normalized).length ? normalized : undefined;
}

function normalizeFilters(
  result: SearchResult,
  dictionaries: Map<string, SearchResultDictionary>,
  params: BuildSearchParams
): BuildFilterGroup[] {
  const dimensions = new Map((result.dimensions ?? []).map((dimension) => [dimension.id ?? "", dimension]));

  return [
    createFilterGroup("class", "Ascendancy / class", dimensions.get("class"), dictionaries.get("class"), params.className),
    createFilterGroup("keystones", "Keystones", dimensions.get("keypassives"), dictionaries.get("keypassive"), params.keystones),
    createFilterGroup("skills", "Skills", dimensions.get("skills"), dictionaries.get("gem"), params.skills),
    createFilterGroup("supports", "Supports", dimensions.get("allskills"), dictionaries.get("gem"), params.supports),
    createFilterGroup("gear", "Gear", dimensions.get("items"), dictionaries.get("item"), params.gear)
  ];
}

function createFilterGroup(
  id: BuildFilterGroupId,
  label: string,
  dimension?: SearchResultDimension,
  dictionary?: SearchResultDictionary,
  activeValues: string[] = []
): BuildFilterGroup {
  const optionsByValue = new Map<string, { value: string; label: string; count: number }>();

  for (const option of (dimension?.counts ?? [])
    .map((count) => {
      const name = lookupDictionary(dictionary, count.key ?? 0);
      return name ? { value: name, label: name, count: count.count ?? 0 } : undefined;
    })
    .filter((option): option is { value: string; label: string; count: number } => Boolean(option))
    .filter((option) => option.count > 0)) {
    optionsByValue.set(option.value, option);
  }

  for (const activeValue of activeValues) {
    if (!optionsByValue.has(activeValue)) {
      optionsByValue.set(activeValue, { value: activeValue, label: activeValue, count: 0 });
    }
  }

  const options = Array.from(optionsByValue.values())
    .sort((a, b) => {
      const aActive = activeValues.includes(a.value);
      const bActive = activeValues.includes(b.value);
      if (aActive !== bActive) {
        return aActive ? -1 : 1;
      }

      return b.count - a.count;
    })
    .slice(0, optionLimit);

  return { id, label, options };
}

function fixtureBuildSearchResponse(
  leagues: PoeNinjaLeagueOption[],
  league: PoeNinjaLeagueOption,
  sort: BuildSortField,
  order: SortOrder,
  fetchedAt: string
): BuildSearchResponse {
  const builds = [...fixtureBuilds].sort((a, b) =>
    order === "asc" ? a.metadata.level - b.metadata.level : b.metadata.level - a.metadata.level
  );

  return {
    builds,
    total: builds.length,
    filters: fixtureFilters(),
    leagues,
    league,
    sort: { field: sort, order },
    fetchedAt,
    source: "fixture"
  };
}

function parsePoeNinjaBuildId(id: string) {
  const parts = id.split(":");
  if (parts[0] === "poe-ninja") {
    if (parts.length < 4) {
      return undefined;
    }

    return {
      league: parts[1] ?? defaultLeagueUrl,
      account: parts[2] ?? "",
      character: parts.slice(3).join(":")
    };
  }

  if (parts.length < 3) {
    return undefined;
  }

  return {
    league: parts[0] ?? defaultLeagueUrl,
    account: parts[1] ?? "",
    character: parts.slice(2).join(":")
  };
}

async function fetchPassiveTreeExport(fetcher: typeof fetch): Promise<PassiveTreeExport | undefined> {
  if (passiveTreeCache) {
    return passiveTreeCache;
  }

  try {
    const response = await fetcher(passiveTreeExportUrl);

    if (!response.ok) {
      return undefined;
    }

    passiveTreeCache = (await response.json()) as PassiveTreeExport;
    return passiveTreeCache;
  } catch {
    return undefined;
  }
}

async function normalizePassiveTree(payload: PoeNinjaCharacterDetailPayload, fetcher: typeof fetch): Promise<BuildPassiveTree | undefined> {
  const tree = await fetchPassiveTreeExport(fetcher);

  if (!tree) {
    return undefined;
  }

  const allocated = new Set<number>([
    ...toNumberArray(payload.passiveSelection),
    ...toNumberArray(payload.passiveSelectionSet1),
    ...toNumberArray(payload.passiveSelectionSet2)
  ]);
  const set1 = new Set<number>(toNumberArray(payload.passiveSelectionSet1));
  const set2 = new Set<number>(toNumberArray(payload.passiveSelectionSet2));
  const nodes: BuildPassiveTree["nodes"] = Object.values(tree.nodes ?? {})
    .flatMap((node) => {
      const id = numberOrUndefined(node.skill);

      if (id === undefined || node.x === undefined || node.y === undefined) {
        return [];
      }

      return [{
        id,
        name: node.name ?? `Passive ${id}`,
        x: node.x,
        y: node.y,
        stats: node.stats ?? [],
        allocated: allocated.has(id),
        ...(set1.has(id) ? { weaponSet: 1 as const } : {}),
        ...(set2.has(id) ? { weaponSet: 2 as const } : {}),
        ...(node.isNotable ? { notable: true } : {}),
        ...(node.isKeystone ? { keystone: true } : {}),
        ...(node.ascendancyId ? { ascendancy: true } : {})
      }];
    });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = (tree.edges ?? [])
    .map((edge) => {
      const from = numberOrUndefined(edge.from);
      const to = numberOrUndefined(edge.to);

      return from !== undefined && to !== undefined && nodeIds.has(from) && nodeIds.has(to) ? { from, to } : undefined;
    })
    .filter((edge): edge is BuildPassiveTree["edges"][number] => Boolean(edge));

  return {
    ...(payload.passiveTreeName ? { name: payload.passiveTreeName } : {}),
    bounds: {
      minX: tree.min_x ?? Math.min(...nodes.map((node) => node.x)),
      minY: tree.min_y ?? Math.min(...nodes.map((node) => node.y)),
      maxX: tree.max_x ?? Math.max(...nodes.map((node) => node.x)),
      maxY: tree.max_y ?? Math.max(...nodes.map((node) => node.y))
    },
    nodes,
    edges
  };
}

async function normalizeCharacterDetail(
  payload: PoeNinjaCharacterDetailPayload,
  parsed: { league: string; account: string; character: string },
  league: PoeNinjaLeagueOption,
  fetcher: typeof fetch
): Promise<BuildDetail> {
  const capturedAt = new Date().toISOString();
  const skillGroups = normalizeSkillGroups(payload.skills ?? []);
  const highestSkill = skillGroups
    .flatMap((group) => (group.dps ? [{ name: group.name, dps: group.dps, iconUrl: group.iconUrl }] : []))
    .sort((a, b) => b.dps - a.dps)[0];
  const items = normalizeDetailItems(payload.items ?? []);
  const passiveTree = await normalizePassiveTree(payload, fetcher);
  const build = normalizePoeNinjaBuild(
    {
      id: `poe-ninja:${parsed.league}:${payload.account ?? parsed.account}:${payload.name ?? parsed.character}`,
      accountName: payload.account ?? parsed.account,
      characterName: payload.name ?? parsed.character,
      className: payload.class ?? "Unknown",
      ...(payload.class ? { ascendancyName: payload.class } : {}),
      level: payload.level ?? 0,
      league: payload.league ?? league.displayName,
      skills: skillGroups.slice(0, 4).map((group) => ({ name: group.name, usageCount: 1 })),
      items: items.slice(0, 4).map((item) => ({
        slot: item.slot,
        name: item.name,
        baseType: item.typeLine,
        ...(item.rarity ? { rarity: item.rarity } : {})
      })),
      passives: (payload.keystones ?? []).map((keystone) => ({
        id: slugify(keystone.name ?? "keystone"),
        name: keystone.name ?? "Unknown Keystone",
        count: 1
      })),
      metrics: {
        ...(highestSkill ? { highestDpsSkill: highestSkill.name, highestDpsSkillIconUrl: highestSkill.iconUrl, dpsLabel: formatDps(highestSkill.dps) } : {}),
        ...(payload.defensiveStats?.life !== undefined ? { life: payload.defensiveStats.life } : {}),
        ...(payload.defensiveStats?.energyShield !== undefined ? { energyShield: payload.defensiveStats.energyShield } : {}),
        ...(payload.defensiveStats?.effectiveHealthPool !== undefined ? { ehpLabel: formatDps(payload.defensiveStats.effectiveHealthPool) } : {})
      }
    },
    capturedAt
  );

  return {
    build,
    poeNinjaUrl: `https://poe.ninja/poe2/builds/${encodeURIComponent(parsed.league)}/character/${encodeURIComponent(parsed.account)}/${encodeURIComponent(parsed.character)}`,
    defensiveStats: normalizeDefensiveStats(payload.defensiveStats ?? {}),
    skillGroups,
    items,
    flasks: normalizeDetailItems(payload.flasks ?? []),
    jewels: normalizeDetailItems(payload.jewels ?? []),
    keystones: normalizeKeystones(payload.keystones ?? []),
    ...(passiveTree ? { passiveTree } : {}),
    passiveCounts: payload.passiveCounts ?? {},
    updatedAt: payload.updatedUtc,
    lastSeenAt: payload.lastSeenUtc,
    source: "poe.ninja"
  };
}

function normalizeSkillGroups(groups: PoeNinjaSkillGroupPayload[]): BuildDetailSkillGroup[] {
  return groups
    .map((group) => {
      const mainGem = group.allGems?.find((gem) => !gem.itemData?.support) ?? group.allGems?.[0];
      const dps = group.dps?.[0]?.dps;
      return {
        name: mainGem?.name ?? mainGem?.itemData?.typeLine ?? "Unknown Skill",
        iconUrl: mainGem?.itemData?.icon,
        dps,
        gems: (group.allGems ?? []).map(normalizeGem)
      };
    })
    .filter((group) => group.name !== "Unknown Skill");
}

function normalizeGem(gem: PoeNinjaGemPayload): BuildDetailGem {
  return {
    name: gem.name ?? gem.itemData?.typeLine ?? "Unknown Gem",
    iconUrl: gem.itemData?.icon,
    support: Boolean(gem.itemData?.support)
  };
}

function normalizeDetailItems(items: PoeNinjaItemEntryPayload[]): BuildDetailItem[] {
  return items.map((entry) => {
    const item = entry.itemData ?? entry;
    return {
      slot: entry.itemSlot ?? item.inventoryId ?? "Item",
      name: item.name || item.typeLine || "Unknown Item",
      typeLine: item.typeLine ?? item.baseType ?? "Unknown",
      rarity: item.frameTypeId,
      iconUrl: item.icon,
      implicitMods: item.implicitMods ?? [],
      explicitMods: [...(item.explicitMods ?? []), ...(item.desecratedMods ?? []), ...(item.runeMods ?? [])].slice(0, 8)
    };
  });
}

function normalizeKeystones(keystones: PoeNinjaKeystonePayload[]): BuildDetailKeystone[] {
  return keystones.map((keystone) => ({
    name: keystone.name ?? "Unknown Keystone",
    iconUrl: keystone.icon ? `https://assets.poe.ninja/poe2/${keystone.icon}` : undefined,
    stats: keystone.stats ?? []
  }));
}

function normalizeDefensiveStats(stats: PoeNinjaDefensiveStatsPayload) {
  return {
    life: stats.life,
    energyShield: stats.energyShield,
    mana: stats.mana,
    spirit: stats.spirit,
    effectiveHealthPool: stats.effectiveHealthPool,
    evasionRating: stats.evasionRating,
    armour: stats.armour,
    fireResistance: stats.fireResistance,
    coldResistance: stats.coldResistance,
    lightningResistance: stats.lightningResistance,
    chaosResistance: stats.chaosResistance,
    blockChance: stats.blockChance
  };
}

function fixtureBuildDetail(build: BuildSnapshot): BuildDetail {
  return {
    build,
    poeNinjaUrl: "https://poe.ninja/poe2/builds",
    defensiveStats: {
      life: build.metrics?.life,
      energyShield: build.metrics?.energyShield
    },
    skillGroups: build.mainSkills.map((skill) => ({ name: skill.name, gems: [{ name: skill.name, support: false }] })),
    items: build.items.map((item) => ({
      slot: item.slot,
      name: item.name,
      typeLine: item.baseType ?? item.name,
      rarity: item.rarity,
      implicitMods: [],
      explicitMods: []
    })),
    flasks: [],
    jewels: [],
    keystones: build.passives.map((passive) => ({ name: passive.name ?? passive.passiveId, stats: [] })),
    passiveCounts: {},
    source: "fixture"
  };
}

function findFixtureBuildDetail(
  id: string,
  parsed?: { league: string; account: string; character: string }
) {
  if (!parsed) {
    return fixtureBuilds.find((build) => build.metadata.id === id);
  }

  const parsedLeague = slugify(parsed.league);
  return fixtureBuilds.find((build) => {
    const metadata = build.metadata;
    return (
      metadata.accountName === parsed.account &&
      metadata.characterName === parsed.character &&
      (metadata.league === parsed.league || metadata.id === id || slugify(metadata.league) === parsedLeague)
    );
  });
}

function formatDps(value?: number) {
  if (value === undefined) {
    return undefined;
  }

  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function fixtureLeagues(): PoeNinjaLeagueOption[] {
  return fixturePoeNinjaBuildIndex.leagueBuilds.map((league) => ({
    name: league.leagueName,
    url: league.leagueUrl,
    displayName: league.leagueName,
    indexed: true,
    hardcore: /hardcore/i.test(league.leagueName),
    version: "fixture",
    snapshotName: league.leagueUrl,
    total: league.total,
    statistics: league.statistics
  }));
}

function fallbackLeague(): PoeNinjaLeagueOption {
  return {
    name: "Runes of Aldur",
    url: defaultLeagueUrl,
    displayName: "Runes of Aldur",
    indexed: true,
    hardcore: false,
    version: "fixture",
    snapshotName: defaultLeagueUrl,
    total: fixtureBuilds.length,
    statistics: []
  };
}

function fixtureFilters(): BuildFilterGroup[] {
  const classOptions = unique(fixtureBuilds.map((build) => build.metadata.ascendancyName ?? build.metadata.className));
  const skills = unique(fixtureBuilds.flatMap((build) => build.mainSkills.map((skill) => skill.name)));
  const gear = unique(fixtureBuilds.flatMap((build) => build.items.map((item) => item.name)));
  const keystones = unique(fixtureBuilds.flatMap((build) => build.passives.map((passive) => passive.name ?? passive.passiveId)));

  return [
    { id: "class", label: "Ascendancy / class", options: toFixtureOptions(classOptions) },
    { id: "keystones", label: "Keystones", options: toFixtureOptions(keystones) },
    { id: "skills", label: "Skills", options: toFixtureOptions(skills) },
    { id: "supports", label: "Supports", options: toFixtureOptions(["Martial Tempo", "Concentrated Effect"]) },
    { id: "gear", label: "Gear", options: toFixtureOptions(gear) }
  ];
}

function normalizeClassStatistic(statistic: {
  class?: string;
  percentage?: number;
  trend?: number;
}): PoeNinjaClassStatistic {
  const trend = statistic.trend === -1 || statistic.trend === 1 ? statistic.trend : 0;

  return {
    className: statistic.class ?? "Unknown",
    percentage: statistic.percentage ?? 0,
    trend
  };
}

function addQueryValue(query: URLSearchParams, key: string, value?: string) {
  const trimmed = value?.trim();
  if (trimmed) {
    query.set(key, trimmed);
  }
}

function addQueryValues(query: URLSearchParams, key: string, values?: string[]) {
  const normalized = (values ?? []).map((value) => value.trim()).filter(Boolean);
  if (normalized.length) {
    query.set(key, normalized.join(","));
  }
}

function lookupMany(dictionary: SearchResultDictionary | undefined, keys?: number[]) {
  return (keys ?? []).map((key) => lookupDictionary(dictionary, key)).filter((value): value is string => Boolean(value));
}

function valueNumber(value?: { number?: number }) {
  return value ? (value.number ?? 0) : undefined;
}

function numberOrUndefined(value: number | string | undefined) {
  if (value === undefined || value === "root") {
    return undefined;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function toNumberArray(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
        const numberValue = numberOrUndefined(entry as number | string | undefined);
        return numberValue === undefined ? [] : [numberValue];
      })
    : [];
}

function lookupDictionary(dictionary: SearchResultDictionary | undefined, key?: number) {
  if (key === undefined) {
    return undefined;
  }

  return dictionary?.values?.[key];
}

function lookupDictionaryProperty(dictionary: SearchResultDictionary | undefined, propertyId: string, key?: number) {
  if (key === undefined) {
    return undefined;
  }

  return dictionary?.properties?.find((property) => property.id === propertyId)?.values?.[key];
}

function normalizeSort(sort?: BuildSortField): BuildSortField {
  return sort === "dps" || sort === "life" || sort === "energyshield" || sort === "ehp" ? sort : "level";
}

function normalizeOrder(order?: SortOrder): SortOrder {
  return order === "asc" ? "asc" : "desc";
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function toFixtureOptions(values: string[]) {
  return values.map((value) => ({ value, label: value, count: 1 }));
}

function titleize(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const __poeNinjaInternals = {
  createSearchUrl,
  fixtureFilters,
  protoRoot
};
