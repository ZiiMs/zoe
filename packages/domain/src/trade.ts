export type TradeModifierSource = "implicit" | "explicit" | "crafted" | "enchant" | "fractured" | "unknown";

export interface ParsedItemModifier {
  id: string;
  text: string;
  normalizedText: string;
  source: TradeModifierSource;
  values: number[];
}

export interface TradeStatCandidate {
  id: string;
  label: string;
  normalizedText: string;
  source: TradeModifierSource | "pseudo";
  value: number;
  min: number;
  max?: number | undefined;
  enabled: boolean;
  tradeStatId?: string | undefined;
  coveredModifierIds: string[];
}

export interface PseudoStatSuggestion {
  id: string;
  label: string;
  value: number;
  min: number;
  tradeStatId?: string | undefined;
  coveredModifierIds: string[];
}

export interface ParsedTradeItem {
  rawText: string;
  itemClass?: string | undefined;
  rarity?: string | undefined;
  name?: string | undefined;
  baseType?: string | undefined;
  itemLevel?: number | undefined;
  quality?: number | undefined;
  requirements: string[];
  sockets: string[];
  modifiers: ParsedItemModifier[];
  statCandidates: TradeStatCandidate[];
  pseudoSuggestions: PseudoStatSuggestion[];
  parseWarnings: string[];
}

export interface TradePriceCheckFilter {
  id: string;
  label: string;
  normalizedText: string;
  source: TradeModifierSource | "pseudo";
  min?: number | undefined;
  max?: number | undefined;
  tradeStatId?: string | undefined;
}

export interface TradePriceCheckRequest {
  league: string;
  item: ParsedTradeItem;
  filters: TradePriceCheckFilter[];
  limit?: number | undefined;
  onlineOnly?: boolean | undefined;
}

export interface TradeListing {
  id: string;
  itemName: string;
  baseType?: string | undefined;
  itemLevel?: number | undefined;
  seller?: string | undefined;
  priceAmount?: number | undefined;
  priceCurrency?: string | undefined;
  listedAt?: string | undefined;
  whisper?: string | undefined;
  tradeUrl?: string | undefined;
}

export interface TradePriceCheckResult {
  queryId?: string | undefined;
  tradeUrl: string;
  total: number;
  listings: TradeListing[];
  filters: TradePriceCheckFilter[];
  searchedAt: string;
  source: "official" | "fixture";
}

export interface TradeStatEntry {
  id: string;
  text: string;
  type: string;
}

export interface TradeStatGroup {
  id: string;
  label: string;
  entries: TradeStatEntry[];
}

export interface TradeLeague {
  id: string;
  text: string;
  realm?: string | undefined;
}

const sectionSeparator = "--------";

const pseudoMatchers = {
  fireResistance: /\bto fire resistance\b/i,
  coldResistance: /\bto cold resistance\b/i,
  lightningResistance: /\bto lightning resistance\b/i,
  chaosResistance: /\bto chaos resistance\b/i,
  maximumLife: /\bto maximum life\b/i,
  maximumMana: /\bto maximum mana\b/i,
  maximumEnergyShield: /\bto maximum energy shield\b/i,
  strength: /\bto strength\b/i,
  dexterity: /\bto dexterity\b/i,
  intelligence: /\bto intelligence\b/i
} as const;

export function parseTradeItemText(rawText: string): ParsedTradeItem {
  const normalizedRaw = rawText.replace(/\r\n/g, "\n").trim();
  const parseWarnings: string[] = [];

  if (!normalizedRaw) {
    return emptyParsedTradeItem(rawText, ["Clipboard did not contain item text."]);
  }

  const sections = normalizedRaw
    .split(sectionSeparator)
    .map((section) =>
      section
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    )
    .filter((section) => section.length > 0);

  const header = sections[0] ?? [];
  const metadata = parseHeader(header);
  const requirements: string[] = [];
  const sockets: string[] = [];
  const modifiers: ParsedItemModifier[] = [];
  let itemLevel: number | undefined;
  let quality: number | undefined;

  for (const section of sections.slice(1)) {
    const heading = section[0] ?? "";
    if (heading === "Requirements:") {
      requirements.push(...section.slice(1));
      continue;
    }

    for (const line of section) {
      const itemLevelMatch = line.match(/^Item Level:\s*(\d+)/i);
      if (itemLevelMatch) {
        itemLevel = Number(itemLevelMatch[1]);
        continue;
      }

      const qualityMatch = line.match(/^Quality:\s*\+?(\d+)%/i);
      if (qualityMatch) {
        quality = Number(qualityMatch[1]);
        continue;
      }

      if (/^(Sockets|Rune Sockets|Charm Slots):/i.test(line)) {
        sockets.push(line);
        continue;
      }

      if (isModifierLine(line)) {
        modifiers.push(toParsedModifier(line, modifiers.length));
      }
    }
  }

  if ((!metadata.itemClass && !metadata.rarity && sections.length < 2) || (!metadata.name && !metadata.baseType && modifiers.length === 0)) {
    parseWarnings.push("Item text was not recognized as a supported PoE2 item.");
  }

  const pseudoSuggestions = createPseudoSuggestions(modifiers);
  const statCandidates = createStatCandidates(modifiers, pseudoSuggestions);

  return {
    rawText,
    itemClass: metadata.itemClass,
    rarity: metadata.rarity,
    name: metadata.name,
    baseType: metadata.baseType,
    itemLevel,
    quality,
    requirements,
    sockets,
    modifiers,
    statCandidates,
    pseudoSuggestions,
    parseWarnings
  };
}

export function buildTradePriceCheckRequest(
  parsedItem: ParsedTradeItem,
  league: string,
  candidates: TradeStatCandidate[],
  limit = 10
): TradePriceCheckRequest {
  return {
    league,
    item: parsedItem,
    filters: candidates
      .filter((candidate) => candidate.enabled)
      .map((candidate) => ({
        id: candidate.id,
        label: candidate.label,
        normalizedText: candidate.normalizedText,
        source: candidate.source,
        min: candidate.min,
        max: candidate.max,
        tradeStatId: candidate.tradeStatId
      })),
    limit,
    onlineOnly: true
  };
}

export function attachTradeStatIds(
  candidates: TradeStatCandidate[],
  statGroups: TradeStatGroup[]
): TradeStatCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    tradeStatId: candidate.tradeStatId ?? findTradeStatId(candidate, statGroups)
  }));
}

export function findTradeStatId(candidate: Pick<TradeStatCandidate | TradePriceCheckFilter, "label" | "normalizedText" | "source">, statGroups: TradeStatGroup[]) {
  const entries = statGroups.flatMap((group) => group.entries);
  const preferredType = candidate.source === "pseudo" ? "pseudo" : undefined;
  const normalizedLabel = normalizeStatText(candidate.label);
  const normalizedText = normalizeStatText(candidate.normalizedText);

  const exact = entries.find(
    (entry) =>
      (!preferredType || entry.type === preferredType) &&
      (normalizeStatText(entry.text) === normalizedLabel || normalizeStatText(entry.text) === normalizedText)
  );
  if (exact) {
    return exact.id;
  }

  const fuzzy = entries.find((entry) => {
    if (preferredType && entry.type !== preferredType) {
      return false;
    }

    const text = normalizeStatText(entry.text);
    return text.includes(normalizedLabel) || normalizedLabel.includes(text);
  });

  return fuzzy?.id;
}

export function normalizeStatText(text: string) {
  return text
    .toLowerCase()
    .replace(/\([^)]+\)/g, "")
    .replace(/[+-]?\d+(?:\.\d+)?/g, "#")
    .replace(/\s+/g, " ")
    .replace(/^\+?#+\s*/, "# ")
    .trim();
}

function emptyParsedTradeItem(rawText: string, parseWarnings: string[]): ParsedTradeItem {
  return {
    rawText,
    requirements: [],
    sockets: [],
    modifiers: [],
    statCandidates: [],
    pseudoSuggestions: [],
    parseWarnings
  };
}

function parseHeader(lines: string[]) {
  const itemClass = valueAfterPrefix(lines, "Item Class:");
  const rarity = valueAfterPrefix(lines, "Rarity:");
  const rest = lines.filter((line) => !line.startsWith("Item Class:") && !line.startsWith("Rarity:"));

  if (rarity === "Rare" && rest.length >= 2) {
    return { itemClass, rarity, name: rest[0], baseType: rest[1] };
  }

  if (rarity === "Unique" && rest.length >= 2) {
    return { itemClass, rarity, name: rest[0], baseType: rest[1] };
  }

  return { itemClass, rarity, name: rest[0], baseType: rest[1] };
}

function valueAfterPrefix(lines: string[], prefix: string) {
  return lines.find((line) => line.startsWith(prefix))?.slice(prefix.length).trim();
}

function isModifierLine(line: string) {
  if (/^(Requirements|Requires|Item Level|Quality|Sockets|Rune Sockets|Charm Slots):/i.test(line)) {
    return false;
  }

  if (/^\{.*\}$/.test(line)) {
    return false;
  }

  return /[+-]?\d/.test(line) || /\((implicit|enchant|crafted|fractured)\)$/i.test(line);
}

function toParsedModifier(line: string, index: number): ParsedItemModifier {
  const source = modifierSource(line);
  const cleanText = line.replace(/\s+\((implicit|enchant|crafted|fractured)\)$/i, "").trim();

  return {
    id: `mod-${index}`,
    text: line,
    normalizedText: normalizeStatText(cleanText),
    source,
    values: valuesFromText(cleanText)
  };
}

function modifierSource(line: string): TradeModifierSource {
  if (/\(implicit\)$/i.test(line)) return "implicit";
  if (/\(crafted\)$/i.test(line)) return "crafted";
  if (/\(enchant\)$/i.test(line)) return "enchant";
  if (/\(fractured\)$/i.test(line)) return "fractured";
  return "explicit";
}

function valuesFromText(text: string) {
  return Array.from(text.matchAll(/[+-]?\d+(?:\.\d+)?/g), (match) => Number(match[0]));
}

function createStatCandidates(modifiers: ParsedItemModifier[], pseudoSuggestions: PseudoStatSuggestion[]): TradeStatCandidate[] {
  const coveredIds = new Set(pseudoSuggestions.flatMap((suggestion) => suggestion.coveredModifierIds));
  const pseudoCandidates = pseudoSuggestions.map((suggestion) => ({
    id: suggestion.id,
    label: suggestion.label,
    normalizedText: normalizeStatText(suggestion.label),
    source: "pseudo" as const,
    value: suggestion.value,
    min: suggestion.min,
    enabled: true,
    tradeStatId: suggestion.tradeStatId,
    coveredModifierIds: suggestion.coveredModifierIds
  }));

  const exactCandidates = modifiers
    .filter((modifier) => modifier.values.length > 0)
    .map((modifier) => {
      const value = dominantValue(modifier);

      return {
        id: `exact-${modifier.id}`,
        label: modifier.text,
        normalizedText: modifier.normalizedText,
        source: modifier.source,
        value,
        min: value,
        enabled: !coveredIds.has(modifier.id),
        coveredModifierIds: [modifier.id]
      };
    });

  return [...pseudoCandidates, ...exactCandidates];
}

function createPseudoSuggestions(modifiers: ParsedItemModifier[]): PseudoStatSuggestion[] {
  const suggestions: PseudoStatSuggestion[] = [];
  const elemental = sumMatchingModifiers(modifiers, [
    pseudoMatchers.fireResistance,
    pseudoMatchers.coldResistance,
    pseudoMatchers.lightningResistance
  ]);

  if (elemental.coveredModifierIds.length >= 2) {
    suggestions.push({
      id: "pseudo-total-elemental-resistance",
      label: "Pseudo: total elemental resistance",
      value: elemental.value,
      min: elemental.value,
      coveredModifierIds: elemental.coveredModifierIds
    });
  }

  addSinglePseudo(suggestions, modifiers, pseudoMatchers.chaosResistance, "pseudo-total-chaos-resistance", "Pseudo: total chaos resistance");
  addSinglePseudo(suggestions, modifiers, pseudoMatchers.maximumLife, "pseudo-total-maximum-life", "Pseudo: total maximum life");
  addSinglePseudo(suggestions, modifiers, pseudoMatchers.maximumMana, "pseudo-total-maximum-mana", "Pseudo: total maximum mana");
  addSinglePseudo(
    suggestions,
    modifiers,
    pseudoMatchers.maximumEnergyShield,
    "pseudo-total-maximum-energy-shield",
    "Pseudo: total maximum energy shield"
  );

  const attributes = sumMatchingModifiers(modifiers, [
    pseudoMatchers.strength,
    pseudoMatchers.dexterity,
    pseudoMatchers.intelligence
  ]);
  if (attributes.coveredModifierIds.length >= 2) {
    suggestions.push({
      id: "pseudo-total-attributes",
      label: "Pseudo: total attributes",
      value: attributes.value,
      min: attributes.value,
      coveredModifierIds: attributes.coveredModifierIds
    });
  }

  return suggestions;
}

function addSinglePseudo(
  suggestions: PseudoStatSuggestion[],
  modifiers: ParsedItemModifier[],
  matcher: RegExp,
  id: string,
  label: string
) {
  const result = sumMatchingModifiers(modifiers, [matcher]);
  if (result.coveredModifierIds.length > 0) {
    suggestions.push({
      id,
      label,
      value: result.value,
      min: result.value,
      coveredModifierIds: result.coveredModifierIds
    });
  }
}

function sumMatchingModifiers(modifiers: ParsedItemModifier[], matchers: RegExp[]) {
  return modifiers.reduce(
    (result, modifier) => {
      if (!matchers.some((matcher) => matcher.test(modifier.text))) {
        return result;
      }

      return {
        value: result.value + dominantValue(modifier),
        coveredModifierIds: [...result.coveredModifierIds, modifier.id]
      };
    },
    { value: 0, coveredModifierIds: [] as string[] }
  );
}

function dominantValue(modifier: ParsedItemModifier) {
  if (modifier.values.length === 0) {
    return 0;
  }

  if (modifier.values.length >= 2 && /\bto\b/i.test(modifier.text) && !/%/.test(modifier.text)) {
    return modifier.values[modifier.values.length - 1] ?? modifier.values[0] ?? 0;
  }

  return modifier.values[0] ?? 0;
}
