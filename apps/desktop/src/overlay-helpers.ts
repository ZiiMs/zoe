import type { TradeLeague, TradeListing } from "@zoe/domain";

export type PanelPosition = { x: number; y: number };
export type CursorPosition = { x: number; y: number };
export type ViewportSize = { width: number; height: number };

export const quickPanelSize = { width: 340, height: 690 };
export const panelMargin = 18;
export const cursorPanelGap = 18;

export function selectTradeLeague(leagues: TradeLeague[], currentLeague: string) {
  if (currentLeague && leagues.some((league) => league.id === currentLeague)) {
    return currentLeague;
  }

  const poe2Leagues = leagues.filter((league) => !league.realm || league.realm === "poe2");
  const primaryLeagues = poe2Leagues.filter(
    (league) => !/\b(?:hardcore|ssf|solo self-found)\b/i.test(`${league.id} ${league.text}`)
  );

  return primaryLeagues[0]?.id ?? poe2Leagues[0]?.id ?? leagues[0]?.id ?? "";
}

export function formatLeagueLabel(leagues: TradeLeague[], leagueId: string) {
  if (!leagueId) {
    return "Loading league";
  }

  return leagues.find((league) => league.id === leagueId)?.text ?? leagueId;
}

export function formatPrice(listing: TradeListing) {
  return `${listing.priceAmount ?? "?"} ${listing.priceCurrency ?? ""}`.trim();
}

export function formatItemLevel(itemLevel?: number) {
  return typeof itemLevel === "number" ? `ilvl ${itemLevel}` : "ilvl --";
}

export function formatListedAge(listedAt: string | undefined, now = Date.now()) {
  if (!listedAt) {
    return "unknown";
  }

  const listedTime = new Date(listedAt).getTime();
  if (!Number.isFinite(listedTime)) {
    return "unknown";
  }

  const diffMs = Math.max(0, now - listedTime);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) {
    return "now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}d ago`;
  }

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function formatQuickModifier(label: string) {
  return label
    .replace(/^Pseudo:\s*/i, "")
    .replace(/^\+?\d+(?:\.\d+)?%?\s*(?:to|increased)?\s*/i, "")
    .replace(/\s+\((?:implicit|explicit|crafted|fractured|enchant)\)$/i, "")
    .trim();
}

export function constrainSettingsPosition(
  position: PanelPosition,
  viewport: ViewportSize
): PanelPosition {
  const width = 960;
  const height = 720;
  const maxX = Math.max(
    panelMargin,
    viewport.width - Math.min(width, viewport.width - panelMargin * 2) - panelMargin
  );
  const maxY = Math.max(
    panelMargin,
    viewport.height - Math.min(height, viewport.height - panelMargin * 2) - panelMargin
  );

  return {
    x: Math.min(Math.max(position.x, panelMargin), maxX),
    y: Math.min(Math.max(position.y, panelMargin), maxY)
  };
}

export function calculateQuickPanelPosition(
  cursor: CursorPosition,
  viewport: ViewportSize
): PanelPosition {
  const availableWidth = Math.max(quickPanelSize.width, viewport.width);
  const availableHeight = Math.max(quickPanelSize.height, viewport.height);
  const maxX = Math.max(panelMargin, availableWidth - quickPanelSize.width - panelMargin);
  const maxY = Math.max(panelMargin, availableHeight - quickPanelSize.height - panelMargin);
  const leftOfCursor = cursor.x - quickPanelSize.width - cursorPanelGap;
  const rightOfCursor = cursor.x + cursorPanelGap;
  const x = leftOfCursor >= panelMargin ? leftOfCursor : Math.min(rightOfCursor, maxX);
  const y = Math.min(Math.max(cursor.y - 40, panelMargin), maxY);

  return { x, y };
}
