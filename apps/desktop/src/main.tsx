import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { isRegistered, register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { createZoeApiClient } from "@zoe/api-client";
import { readDesktopEnv } from "@zoe/config";
import {
  attachTradeStatIds,
  buildTradePriceCheckRequest,
  parseTradeItemText,
  type ParsedTradeItem,
  type TradeLeague,
  type TradeListing,
  type TradePriceCheckResult,
  type TradeStatCandidate,
  type TradeStatGroup
} from "@zoe/domain";
import { Check, ExternalLink, EyeOff, List, Search, X } from "lucide-react";
import "./styles.css";

const defaultApiBaseUrl = readDesktopEnv({
  VITE_ZOE_API_BASE_URL: import.meta.env.VITE_ZOE_API_BASE_URL
}).VITE_ZOE_API_BASE_URL;
const priceCheckShortcut = "CommandOrControl+D";
const settingsShortcut = "Shift+Space";
const quickTradeListingLimit = 20;

type OverlayMode = "passive" | "interactive";
type OverlayView = "quick" | "settings";
type ApiStatus = "checking" | "ready" | "offline";
type PanelPosition = { x: number; y: number };
type CursorPosition = { x: number; y: number };
type DebugLine = { id: number; message: string };

const quickPanelSize = { width: 340, height: 690 };
const panelMargin = 18;
const cursorPanelGap = 18;
const zoeShortcuts = [priceCheckShortcut, settingsShortcut] as const;

declare global {
  interface Window {
    __zoeShortcutSetupId?: symbol;
  }
}

function OverlayApp() {
  const [apiBaseUrl, setApiBaseUrl] = useState(defaultApiBaseUrl);
  const [league, setLeague] = useState("");
  const [leagues, setLeagues] = useState<TradeLeague[]>([]);
  const [isLoadingLeagues, setIsLoadingLeagues] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(() => !isTauriRuntime());
  const [overlayView, setOverlayView] = useState<OverlayView>("quick");
  const [mode, setMode] = useState<OverlayMode>("passive");
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [item, setItem] = useState<ParsedTradeItem | undefined>();
  const [stats, setStats] = useState<TradeStatGroup[]>([]);
  const [candidates, setCandidates] = useState<TradeStatCandidate[]>([]);
  const [result, setResult] = useState<TradePriceCheckResult | undefined>();
  const [notice, setNotice] = useState("Hover an item in PoE2 and press Ctrl+D.");
  const [isLoading, setIsLoading] = useState(false);
  const [debugLines, setDebugLines] = useState<DebugLine[]>([]);
  const [quickPosition, setQuickPosition] = useState<PanelPosition | undefined>();
  const [settingsPosition, setSettingsPosition] = useState<PanelPosition>(() => ({ x: 96, y: 54 }));

  const api = useMemo(() => createZoeApiClient({ baseUrl: apiBaseUrl }), [apiBaseUrl]);
  const apiRef = useLiveRef(api);
  const apiStatusRef = useLiveRef(apiStatus);
  const candidatesRef = useLiveRef(candidates);
  const itemRef = useLiveRef(item);
  const leagueRef = useLiveRef(league);
  const overlayOpenRef = useLiveRef(overlayOpen);
  const statsRef = useLiveRef(stats);
  const settingsPositionRef = useLiveRef(settingsPosition);
  const settingsDragRef = useRef<
    { pointerId: number; offsetX: number; offsetY: number } | undefined
  >(undefined);
  const enabledCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.enabled),
    [candidates]
  );

  function addDebug(message: string) {
    const line = { id: Date.now() + Math.random(), message };
    console.info(`[Zoe Trade Debug] ${message}`);
    setDebugLines((current) => [line, ...current].slice(0, 12));
  }

  useEffect(() => {
    let cancelled = false;
    setApiStatus("checking");

    setIsLoadingLeagues(true);

    Promise.all([api.health(), api.tradeStats(), api.tradeLeagues()])
      .then(([, statsResponse, leaguesResponse]) => {
        if (!cancelled) {
          setStats(statsResponse.stats);
          setLeagues(leaguesResponse.leagues);
          setLeague((current) => selectTradeLeague(leaguesResponse.leagues, current));
          setApiStatus("ready");
          addDebug(
            `api ready, trade stat groups=${statsResponse.stats.length}, leagues=${leaguesResponse.leagues.length}`
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setApiStatus("offline");
          addDebug(`api offline at ${apiBaseUrl}`);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingLeagues(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    const appWindow = getTauriWindow();
    if (!appWindow) {
      return;
    }

    async function syncOverlayWindow(nextMode: OverlayMode, isOpen: boolean) {
      const windowWithCursorEvents = appWindow as {
        setIgnoreCursorEvents?: (ignore: boolean) => Promise<void>;
        setFocus: () => Promise<void>;
        show: () => Promise<void>;
      };

      await windowWithCursorEvents.show();
      await windowWithCursorEvents
        .setIgnoreCursorEvents?.(!isOpen || nextMode === "passive")
        .catch((error) => {
          addDebug(`click-through unavailable: ${String(error)}`);
        });
      if (isOpen && nextMode === "interactive") {
        await windowWithCursorEvents.setFocus().catch((error) => {
          addDebug(`overlay focus unavailable: ${String(error)}`);
        });
      }
    }

    syncOverlayWindow(mode, overlayOpen).catch((error) => {
      addDebug(`overlay window sync failed: ${String(error)}`);
    });
  }, [mode, overlayOpen]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeOverlay();
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  useEffect(() => {
    let disposed = false;
    const setupId = Symbol("zoe-shortcuts");

    async function setupShortcuts() {
      if (!isTauriRuntime()) {
        return;
      }

      window.__zoeShortcutSetupId = setupId;

      await replaceZoeShortcut(priceCheckShortcut, () => {
        if (!disposed && window.__zoeShortcutSetupId === setupId) {
          void captureAndPriceCheckFromShortcut();
        }
      });

      await replaceZoeShortcut(settingsShortcut, () => {
        if (!disposed && window.__zoeShortcutSetupId === setupId) {
          void toggleSettingsOverlayFromShortcut();
        }
      });
    }

    setupShortcuts().catch((error) => {
      if (!disposed) {
        setNotice(`Hotkeys unavailable: ${String(error)}`);
        addDebug(`hotkey setup failed: ${String(error)}`);
      }
    });

    return () => {
      disposed = true;
      if (window.__zoeShortcutSetupId === setupId) {
        delete window.__zoeShortcutSetupId;
        void unregisterZoeShortcuts();
      }
    };
  }, []);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const drag = settingsDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      setSettingsPosition(
        constrainSettingsPosition({
          x: event.clientX - drag.offsetX,
          y: event.clientY - drag.offsetY
        })
      );
    }

    function handlePointerUp(event: PointerEvent) {
      if (settingsDragRef.current?.pointerId === event.pointerId) {
        settingsDragRef.current = undefined;
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  async function captureAndPriceCheckFromShortcut() {
    const focus = await getPoeFocusStatus();
    if (!focus.focused) {
      if (focus.message) {
        addDebug(focus.message);
      }
      return;
    }

    await captureAndPriceCheck();
  }

  async function toggleSettingsOverlayFromShortcut() {
    if (overlayOpenRef.current) {
      closeOverlay();
      return;
    }

    const focus = await getPoeFocusStatus();
    if (!focus.focused) {
      if (focus.message) {
        addDebug(focus.message);
      }
      return;
    }

    setOverlayView("settings");
    setMode("interactive");
    setOverlayOpen(true);
  }

  async function captureAndPriceCheck() {
    await positionQuickPanelNearCursor();
    setOverlayView("quick");
    setIsLoading(true);
    setNotice("Reading item text...");
    setResult(undefined);

    try {
      const rawText = await invoke<string>("capture_item_text");
      const parsed = parseTradeItemText(rawText);
      let canSearch = apiStatusRef.current === "ready";
      let activeStats = statsRef.current;
      if (!activeStats.length) {
        const metadata = await refreshTradeMetadata(apiRef.current).catch(() => undefined);
        activeStats = metadata?.stats ?? [];
        canSearch = Boolean(metadata);
      }
      const nextCandidates = attachTradeStatIds(parsed.statCandidates, activeStats);
      const mappedCount = nextCandidates.filter((candidate) => candidate.tradeStatId).length;
      const enabledCount = nextCandidates.filter((candidate) => candidate.enabled).length;
      const unmappedLabels = nextCandidates
        .filter((candidate) => !candidate.tradeStatId)
        .slice(0, 4)
        .map((candidate) => candidate.label.replace(/^Pseudo:\s*/i, ""));

      addDebug(
        `capture raw=${rawText.length} chars, mods=${parsed.modifiers.length}, candidates=${nextCandidates.length}, mapped=${mappedCount}, enabled=${enabledCount}`
      );
      if (parsed.parseWarnings.length) {
        addDebug(`parse warnings: ${parsed.parseWarnings.join(" | ")}`);
      }
      if (unmappedLabels.length) {
        addDebug(`unmapped stats: ${unmappedLabels.join(" | ")}`);
      }

      setItem(parsed);
      setCandidates(nextCandidates);
      setOverlayOpen(true);
      setMode("interactive");
      setNotice(parsed.parseWarnings[0] ?? "Searching comparable listings...");

      if (canSearch) {
        await runPriceCheck(nextCandidates, parsed, apiRef.current);
      }
    } catch (error) {
      setOverlayOpen(true);
      setMode("interactive");
      addDebug(`capture failed: ${String(error)}`);
      setNotice(String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function runPriceCheck(
    nextCandidates = candidatesRef.current,
    nextItem = itemRef.current,
    activeApi = apiRef.current
  ) {
    if (!nextItem) {
      return;
    }

    setIsLoading(true);
    try {
      let activeLeague = leagueRef.current;
      if (apiStatusRef.current !== "ready") {
        const metadata = await refreshTradeMetadata(activeApi);
        activeLeague = metadata.league;
      } else if (!activeLeague) {
        activeLeague = await refreshTradeLeagues(activeApi);
      }
      if (!activeLeague) {
        throw new Error("No trade leagues are available from the API.");
      }
      const request = buildTradePriceCheckRequest(
        nextItem,
        activeLeague,
        nextCandidates,
        quickTradeListingLimit
      );
      addDebug(
        `search league=${request.league}, filters=${request.filters.length}, limit=${request.limit ?? 10}, item=${request.item.baseType ?? "unknown"}`
      );
      if (request.filters.length) {
        addDebug(
          `filters: ${request.filters
            .slice(0, 5)
            .map(
              (filter) =>
                `${filter.tradeStatId ?? "unmapped"} min=${filter.min ?? "-"} max=${filter.max ?? "-"}`
            )
            .join(" | ")}`
        );
      }
      const response = await activeApi.priceCheck(request);
      setResult(response.result);
      addDebug(
        `result query=${response.result.queryId ?? "none"}, total=${response.result.total}, fetched=${response.result.listings.length}, resolvedFilters=${response.result.filters.length}`
      );
      setNotice(
        response.result.filters.length
          ? "Showing comparable listings."
          : "No searchable modifiers matched trade metadata."
      );
    } catch (error) {
      setResult(undefined);
      addDebug(`search failed: ${String(error)}`);
      setNotice(`Price check failed: ${String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }

  function updateCandidate(id: string, patch: Partial<TradeStatCandidate>) {
    setCandidates((current) =>
      current.map((candidate) => (candidate.id === id ? { ...candidate, ...patch } : candidate))
    );
  }

  async function refreshTradeLeagues(activeApi = apiRef.current) {
    setIsLoadingLeagues(true);
    try {
      const response = await activeApi.tradeLeagues();
      setLeagues(response.leagues);
      const selectedLeague = selectTradeLeague(response.leagues, leagueRef.current);
      setLeague(selectedLeague);
      addDebug(
        `trade leagues loaded=${response.leagues.length}, selected=${selectedLeague || "-"}`
      );
      return selectedLeague;
    } finally {
      setIsLoadingLeagues(false);
    }
  }

  async function refreshTradeMetadata(activeApi = apiRef.current) {
    addDebug(`api check ${apiBaseUrl}`);
    setIsLoadingLeagues(true);
    try {
      const [, statsResponse, leaguesResponse] = await Promise.all([
        activeApi.health(),
        activeApi.tradeStats(),
        activeApi.tradeLeagues()
      ]);
      const selectedLeague = selectTradeLeague(leaguesResponse.leagues, leagueRef.current);
      setStats(statsResponse.stats);
      setLeagues(leaguesResponse.leagues);
      setLeague(selectedLeague);
      setApiStatus("ready");
      addDebug(
        `api ready, trade stat groups=${statsResponse.stats.length}, leagues=${leaguesResponse.leagues.length}`
      );
      return {
        stats: statsResponse.stats,
        leagues: leaguesResponse.leagues,
        league: selectedLeague
      };
    } catch (error) {
      setApiStatus("offline");
      addDebug(`api unavailable: ${String(error)}`);
      throw error;
    } finally {
      setIsLoadingLeagues(false);
    }
  }

  function closeOverlay() {
    setOverlayOpen(false);
    setMode("passive");
  }

  function enterPassiveMode() {
    setMode("passive");
  }

  async function positionQuickPanelNearCursor() {
    if (!isTauriRuntime()) {
      return;
    }

    const cursor = await invoke<CursorPosition>("cursor_position").catch((error) => {
      addDebug(`cursor position unavailable: ${String(error)}`);
      return undefined;
    });
    if (!cursor) {
      addDebug("cursor position unavailable; using default quick panel position");
      return;
    }

    setQuickPosition(calculateQuickPanelPosition(cursor));
  }

  function beginSettingsDrag(event: React.PointerEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, select, label")) {
      return;
    }

    settingsDragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - settingsPositionRef.current.x,
      offsetY: event.clientY - settingsPositionRef.current.y
    };
  }

  const panelStyle =
    overlayView === "settings"
      ? ({ left: settingsPosition.x, top: settingsPosition.y } satisfies React.CSSProperties)
      : quickPosition
        ? ({ left: quickPosition.x, top: quickPosition.y } satisfies React.CSSProperties)
        : undefined;

  return (
    <main
      className={`overlay ${overlayOpen ? "overlay-open" : "overlay-closed"} overlay-${mode} view-${overlayView}`}
    >
      {overlayOpen ? (
        <section
          className={`trade-panel ${overlayView === "quick" ? "quick-panel" : "settings-panel"}`}
          style={panelStyle}
          aria-label="Zoe trade overlay"
        >
          {overlayView === "quick" ? (
            <QuickPricePanel
              apiStatus={apiStatus}
              candidates={candidates}
              debugLines={debugLines}
              isLoading={isLoading}
              item={item}
              league={league}
              leagues={leagues}
              notice={notice}
              result={result}
              onCapture={() => void captureAndPriceCheck()}
              onChange={updateCandidate}
              onClose={closeOverlay}
              onSearch={() => void runPriceCheck()}
            />
          ) : (
            <SettingsPanel
              apiBaseUrl={apiBaseUrl}
              apiStatus={apiStatus}
              candidates={candidates}
              debugLines={debugLines}
              enabledCount={enabledCandidates.length}
              isLoading={isLoading}
              isLoadingLeagues={isLoadingLeagues}
              item={item}
              league={league}
              leagues={leagues}
              notice={notice}
              result={result}
              onApiBaseUrlChange={setApiBaseUrl}
              onCapture={() => void captureAndPriceCheck()}
              onChange={updateCandidate}
              onClose={closeOverlay}
              onLeagueChange={setLeague}
              onPassive={enterPassiveMode}
              onStartDrag={beginSettingsDrag}
            />
          )}
        </section>
      ) : null}
    </main>
  );
}

function QuickPricePanel({
  apiStatus,
  candidates,
  debugLines,
  isLoading,
  item,
  league,
  leagues,
  notice,
  result,
  onCapture,
  onChange,
  onClose,
  onSearch
}: {
  apiStatus: ApiStatus;
  candidates: TradeStatCandidate[];
  debugLines: DebugLine[];
  isLoading: boolean;
  item?: ParsedTradeItem | undefined;
  league: string;
  leagues: TradeLeague[];
  notice: string;
  result?: TradePriceCheckResult | undefined;
  onCapture: () => void;
  onChange: (id: string, patch: Partial<TradeStatCandidate>) => void;
  onClose: () => void;
  onSearch: () => void;
}) {
  const listedCount = result?.total ?? 0;
  const mappedCount = candidates.filter((candidate) => candidate.tradeStatId).length;
  const enabledCount = candidates.filter((candidate) => candidate.enabled).length;
  const hasSearchError = notice.startsWith("Price check failed:");
  const leagueLabel = formatLeagueLabel(leagues, league);
  const listingStatus = isLoading ? "Loading" : hasSearchError ? "Error" : `${listedCount} Listed`;

  return (
    <>
      <header className="quick-header">
        <div>
          <strong>{item?.name ?? "Item price check"}</strong>
          <span>{item?.baseType ?? "Ready to scan"}</span>
        </div>
        <button className="mini-icon-button" title="Close overlay" type="button" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </header>

      <section className="quick-meta" aria-label="Item summary">
        <span>{leagueLabel}</span>
        <span>{item?.rarity ?? "No item"}</span>
        <span>ilvl: {item?.itemLevel ?? "--"}</span>
      </section>

      <section className="quick-market" aria-label="Market status">
        <div>
          <span>Market status</span>
          <strong>{listingStatus}</strong>
        </div>
        <button
          className="quick-market-button"
          title="Refresh price check"
          type="button"
          onClick={onCapture}
        >
          <List aria-hidden="true" />
        </button>
      </section>

      <section className="quick-stats" aria-label="Price check summary">
        <div>
          <span>Mapped</span>
          <strong>
            {mappedCount}/{candidates.length}
          </strong>
        </div>
        <div>
          <span>Enabled</span>
          <strong>{enabledCount}</strong>
        </div>
        <div>
          <span>Fetched</span>
          <strong>
            {isLoading ? "--" : result ? `${result.listings.length}/${result.total}` : "--"}
          </strong>
        </div>
      </section>

      <div className="quick-section-label">
        <span>Search filters</span>
        <b>{enabledCount} on</b>
      </div>

      <section className="quick-mods" aria-label="Search filters">
        {candidates.length ? (
          candidates.map((candidate) => (
            <ModifierRow candidate={candidate} compact key={candidate.id} onChange={onChange} />
          ))
        ) : (
          <div className="empty-state compact-empty">{notice}</div>
        )}
      </section>

      <footer className="quick-actions">
        <button title="Run price check" type="button" onClick={onSearch}>
          <Search aria-hidden="true" />
          <span>Search</span>
        </button>
        <a
          className={!result?.tradeUrl ? "disabled-link" : undefined}
          aria-disabled={!result?.tradeUrl}
          href={result?.tradeUrl ?? "#"}
          onClick={(event) => {
            if (!result?.tradeUrl) {
              event.preventDefault();
            }
          }}
          target="_blank"
          rel="noreferrer"
          title="Open trade search"
        >
          <ExternalLink aria-hidden="true" />
          <span>Trade</span>
        </a>
      </footer>

      <section className="quick-result-strip" aria-label="Fetched listings">
        <div className="quick-sales-heading">
          <span>Listings</span>
          <span>
            {isLoading
              ? "Loading"
              : result
                ? `${result.listings.length}/${result.total}`
                : "Waiting"}
          </span>
        </div>
        <div className="quick-sales-list">
          {isLoading
            ? Array.from({ length: 5 }, (_, index) => (
                <div className="quick-result-row skeleton-row" key={index}>
                  <strong>Checking</strong>
                  <span>--</span>
                  <span>--</span>
                  <span />
                </div>
              ))
            : null}
          {!isLoading
            ? (result?.listings ?? []).map((listing) => (
                <article className="quick-result-row" key={listing.id}>
                  <div>
                    <strong>{formatPrice(listing)}</strong>
                    <small>{listing.seller ?? listing.itemName}</small>
                  </div>
                  <span>{formatItemLevel(listing.itemLevel)}</span>
                  <span>{formatListedAge(listing.listedAt)}</span>
                  <a
                    aria-label={`Open trade listing for ${listing.itemName}`}
                    href={listing.tradeUrl ?? result?.tradeUrl ?? "#"}
                    onClick={(event) => {
                      if (!listing.tradeUrl && !result?.tradeUrl) {
                        event.preventDefault();
                      }
                    }}
                    target="_blank"
                    rel="noreferrer"
                    title="Open listing"
                  >
                    <ExternalLink aria-hidden="true" />
                  </a>
                </article>
              ))
            : null}
          {result && result.listings.length === 0 ? (
            <div className="quick-result-row muted-result">No fetched listings</div>
          ) : null}
          {!isLoading && !result ? (
            <div className="quick-result-row muted-result">Search to load listings</div>
          ) : null}
        </div>
      </section>

      <DebugPanel lines={debugLines} compact />

      <footer className="quick-footer">
        <span>{apiStatus === "ready" ? notice : apiStatus}</span>
      </footer>
    </>
  );
}

function SettingsPanel({
  apiBaseUrl,
  apiStatus,
  candidates,
  debugLines,
  enabledCount,
  isLoading,
  isLoadingLeagues,
  item,
  league,
  leagues,
  notice,
  result,
  onApiBaseUrlChange,
  onCapture,
  onChange,
  onClose,
  onLeagueChange,
  onPassive,
  onStartDrag
}: {
  apiBaseUrl: string;
  apiStatus: ApiStatus;
  candidates: TradeStatCandidate[];
  debugLines: DebugLine[];
  enabledCount: number;
  isLoading: boolean;
  isLoadingLeagues: boolean;
  item?: ParsedTradeItem | undefined;
  league: string;
  leagues: TradeLeague[];
  notice: string;
  result?: TradePriceCheckResult | undefined;
  onApiBaseUrlChange: (value: string) => void;
  onCapture: () => void;
  onChange: (id: string, patch: Partial<TradeStatCandidate>) => void;
  onClose: () => void;
  onLeagueChange: (value: string) => void;
  onPassive: () => void;
  onStartDrag: (event: React.PointerEvent<HTMLElement>) => void;
}) {
  return (
    <>
      <header className="panel-header draggable-header" onPointerDown={onStartDrag}>
        <div>
          <p className="eyebrow">Zoe Trade</p>
          <h1>{item?.name ?? "Overlay settings"}</h1>
          <p className="subtitle">
            {[item?.baseType, item?.rarity, item?.itemLevel ? `ilvl ${item.itemLevel}` : undefined]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="header-actions">
          <StatusPill label={apiStatus} />
          <button
            className="icon-button"
            title="Click-through mode"
            type="button"
            onClick={onPassive}
          >
            <EyeOff aria-hidden="true" />
          </button>
          <button className="icon-button" title="Close overlay" type="button" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="settings-grid">
        <label>
          API URL
          <input value={apiBaseUrl} onChange={(event) => onApiBaseUrlChange(event.target.value)} />
        </label>
        <label>
          League
          <select
            value={league}
            onChange={(event) => onLeagueChange(event.target.value)}
            disabled={isLoadingLeagues || leagues.length === 0}
          >
            {league ? null : <option value="">Loading leagues</option>}
            {leagues.map((option) => (
              <option key={option.id} value={option.id}>
                {option.text}
              </option>
            ))}
          </select>
        </label>
        <p>Use Windowed or Windowed Fullscreen. If PoE2 runs as admin, run Zoe as admin too.</p>
      </section>

      <div className="content-grid">
        <section className="modifiers">
          <div className="section-title">
            <span>Search filters</span>
            <button className="text-button" type="button" onClick={onCapture}>
              <Search aria-hidden="true" />
              Ctrl+D
            </button>
          </div>

          {candidates.length ? (
            <div className="modifier-list">
              {candidates.map((candidate) => (
                <ModifierRow candidate={candidate} key={candidate.id} onChange={onChange} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>{notice}</p>
            </div>
          )}
        </section>

        <section className="results">
          <div className="section-title">
            <span>Listings</span>
            <span className="muted">
              {isLoading ? "Searching..." : result ? `${result.total} found` : "Waiting"}
            </span>
          </div>

          <div className="notice">{notice}</div>

          {result?.tradeUrl ? (
            <a className="trade-link" href={result.tradeUrl} target="_blank" rel="noreferrer">
              Open trade search
              <ExternalLink aria-hidden="true" />
            </a>
          ) : null}

          <div className="listing-list">
            {result?.listings.map((listing) => (
              <article className="listing" key={listing.id}>
                <div>
                  <strong>{listing.itemName}</strong>
                  <span>{listing.seller ?? "Unknown seller"}</span>
                </div>
                <b>{formatPrice(listing)}</b>
              </article>
            ))}
          </div>

          {result && result.listings.length === 0 ? (
            <div className="empty-state">No listings returned for this filter set.</div>
          ) : null}

          <DebugPanel lines={debugLines} />
        </section>
      </div>

      <footer className="footer-bar">
        <span>{enabledCount} enabled</span>
        <span>Shift+Space toggle</span>
        <span>Esc close</span>
      </footer>
    </>
  );
}

function DebugPanel({ compact = false, lines }: { compact?: boolean; lines: DebugLine[] }) {
  if (!lines.length) {
    return null;
  }

  return (
    <details className={compact ? "debug-panel compact-debug" : "debug-panel"}>
      <summary>Debug</summary>
      <div>
        {lines.map((line) => (
          <p key={line.id}>{line.message}</p>
        ))}
      </div>
    </details>
  );
}

function ModifierRow({
  candidate,
  compact = false,
  onChange
}: {
  candidate: TradeStatCandidate;
  compact?: boolean;
  onChange: (id: string, patch: Partial<TradeStatCandidate>) => void;
}) {
  if (compact) {
    return (
      <article className={`modifier-row compact-row ${candidate.enabled ? "enabled" : ""}`}>
        <button
          className="check-button"
          type="button"
          aria-pressed={candidate.enabled}
          onClick={() => onChange(candidate.id, { enabled: !candidate.enabled })}
        >
          {candidate.enabled ? <Check aria-hidden="true" /> : null}
        </button>
        <div className="modifier-copy">
          <strong>{formatQuickModifier(candidate.label)}</strong>
        </div>
        <div className="quick-value-control">
          <input
            aria-label={`${candidate.label} minimum`}
            type="number"
            value={candidate.min}
            onChange={(event) => onChange(candidate.id, { min: Number(event.target.value) })}
          />
          <input
            aria-label={`${candidate.label} maximum`}
            type="number"
            value={candidate.max ?? ""}
            onChange={(event) =>
              onChange(candidate.id, {
                max: event.target.value ? Number(event.target.value) : undefined
              })
            }
            placeholder="max"
          />
        </div>
      </article>
    );
  }

  return (
    <article
      className={`modifier-row ${candidate.enabled ? "enabled" : ""} ${compact ? "compact-row" : ""}`}
    >
      <button
        className="check-button"
        type="button"
        aria-pressed={candidate.enabled}
        onClick={() => onChange(candidate.id, { enabled: !candidate.enabled })}
      >
        {candidate.enabled ? <Check aria-hidden="true" /> : null}
      </button>
      <div className="modifier-copy">
        <strong>{candidate.label.replace(/^Pseudo:\s*/i, "")}</strong>
        <span>
          {candidate.source === "pseudo" ? <Badge>Pseudo</Badge> : candidate.source}
          {candidate.tradeStatId ? null : <Badge muted>Unmapped</Badge>}
        </span>
      </div>
      <label className="value-input">
        min
        <input
          type="number"
          value={candidate.min}
          onChange={(event) => onChange(candidate.id, { min: Number(event.target.value) })}
        />
      </label>
      <label className="value-input">
        max
        <input
          type="number"
          value={candidate.max ?? ""}
          onChange={(event) =>
            onChange(candidate.id, {
              max: event.target.value ? Number(event.target.value) : undefined
            })
          }
        />
      </label>
    </article>
  );
}

function formatQuickModifier(label: string) {
  return label
    .replace(/^Pseudo:\s*/i, "")
    .replace(/^\+?\d+(?:\.\d+)?%?\s*(?:to|increased)?\s*/i, "")
    .replace(/\s+\((?:implicit|explicit|crafted|fractured|enchant)\)$/i, "")
    .trim();
}

function Badge({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return <em className={muted ? "badge badge-muted" : "badge"}>{children}</em>;
}

function StatusPill({ label }: { label: ApiStatus }) {
  return <span className={`status-pill status-${label}`}>{label}</span>;
}

function selectTradeLeague(leagues: TradeLeague[], currentLeague: string) {
  if (currentLeague && leagues.some((league) => league.id === currentLeague)) {
    return currentLeague;
  }

  const poe2Leagues = leagues.filter((league) => !league.realm || league.realm === "poe2");
  const primaryLeagues = poe2Leagues.filter(
    (league) => !/\b(?:hardcore|ssf|solo self-found)\b/i.test(`${league.id} ${league.text}`)
  );

  return primaryLeagues[0]?.id ?? poe2Leagues[0]?.id ?? leagues[0]?.id ?? "";
}

function formatLeagueLabel(leagues: TradeLeague[], leagueId: string) {
  if (!leagueId) {
    return "Loading league";
  }

  return leagues.find((league) => league.id === leagueId)?.text ?? leagueId;
}

function formatPrice(listing: TradeListing) {
  return `${listing.priceAmount ?? "?"} ${listing.priceCurrency ?? ""}`.trim();
}

function formatItemLevel(itemLevel?: number) {
  return typeof itemLevel === "number" ? `ilvl ${itemLevel}` : "ilvl --";
}

function formatListedAge(listedAt?: string) {
  if (!listedAt) {
    return "unknown";
  }

  const listedTime = new Date(listedAt).getTime();
  if (!Number.isFinite(listedTime)) {
    return "unknown";
  }

  const diffMs = Math.max(0, Date.now() - listedTime);
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

function useLiveRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

async function replaceZoeShortcut(shortcut: (typeof zoeShortcuts)[number], handler: () => void) {
  const registered = await isRegistered(shortcut).catch(() => false);
  if (registered) {
    await unregister(shortcut);
  }

  await register(shortcut, handler);
}

async function unregisterZoeShortcuts() {
  await Promise.all(
    zoeShortcuts.map(async (shortcut) => {
      if (await isRegistered(shortcut).catch(() => false)) {
        await unregister(shortcut).catch(() => undefined);
      }
    })
  );
}

async function getPoeFocusStatus(): Promise<{ focused: boolean; message?: string }> {
  if (!isTauriRuntime()) {
    return { focused: true };
  }

  try {
    const focused = await invoke<boolean>("is_poe_focused");
    if (focused) {
      return { focused: true };
    }

    return {
      focused: false,
      message: "Path of Exile 2 is not focused; shortcut ignored."
    };
  } catch (error) {
    return {
      focused: false,
      message: `Path of Exile focus check unavailable: ${String(error)}`
    };
  }
}

function constrainSettingsPosition(position: PanelPosition): PanelPosition {
  const width = 960;
  const height = 720;
  const maxX = Math.max(
    panelMargin,
    window.innerWidth - Math.min(width, window.innerWidth - panelMargin * 2) - panelMargin
  );
  const maxY = Math.max(
    panelMargin,
    window.innerHeight - Math.min(height, window.innerHeight - panelMargin * 2) - panelMargin
  );

  return {
    x: Math.min(Math.max(position.x, panelMargin), maxX),
    y: Math.min(Math.max(position.y, panelMargin), maxY)
  };
}

function calculateQuickPanelPosition(cursor: CursorPosition): PanelPosition {
  const availableWidth = Math.max(quickPanelSize.width, window.innerWidth);
  const availableHeight = Math.max(quickPanelSize.height, window.innerHeight);
  const maxX = Math.max(panelMargin, availableWidth - quickPanelSize.width - panelMargin);
  const maxY = Math.max(panelMargin, availableHeight - quickPanelSize.height - panelMargin);
  const leftOfCursor = cursor.x - quickPanelSize.width - cursorPanelGap;
  const rightOfCursor = cursor.x + cursorPanelGap;
  const x = leftOfCursor >= panelMargin ? leftOfCursor : Math.min(rightOfCursor, maxX);
  const y = Math.min(Math.max(cursor.y - 40, panelMargin), maxY);

  return { x, y };
}

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

function getTauriWindow() {
  if (!isTauriRuntime()) {
    return undefined;
  }

  try {
    return getCurrentWindow();
  } catch {
    return undefined;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <OverlayApp />
  </React.StrictMode>
);
