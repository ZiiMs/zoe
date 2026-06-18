"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createZoeApiClient } from "@zoe/api-client";
import { readWebEnv } from "@zoe/config";
import type {
  BuildFilterGroup,
  BuildSearchParams,
  BuildSearchResponse,
  BuildSnapshot
} from "@zoe/domain";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn
} from "@zoe/ui";
import {
  Boxes,
  Brain,
  ChevronDown,
  Gem,
  RadioTower,
  RotateCcw,
  Search,
  Shield,
  SlidersHorizontal,
  Sword,
  UserRound
} from "lucide-react";

const api = createZoeApiClient({
  baseUrl: readWebEnv({ NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL })
    .NEXT_PUBLIC_API_BASE_URL
});

const filterIcons = {
  class: Shield,
  keystones: Brain,
  skills: Sword,
  supports: Gem,
  gear: Boxes
} satisfies Record<BuildFilterGroup["id"], typeof Shield>;

const sortOptions = [
  { field: "level", label: "Level" },
  { field: "dps", label: "DPS" },
  { field: "life", label: "Life" },
  { field: "energyshield", label: "ES" },
  { field: "ehp", label: "EHP" }
] as const;

const filterOptionBatchSize = 24;

type ActiveBuildSearchParams = {
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

export function BuildsPage({ initialData }: { initialData: BuildSearchResponse }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState(initialData);
  const [searchDraft, setSearchDraft] = useState(searchParams.get("search") ?? "");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const queryString = searchParams.toString();

  const activeParams = useMemo(
    () => parseBuildSearchParams(new URLSearchParams(queryString), data.league.url),
    [queryString, data.league.url]
  );
  const activeFilterCount =
    activeParams.className.length +
    activeParams.keystones.length +
    activeParams.skills.length +
    activeParams.supports.length +
    activeParams.gear.length +
    (activeParams.search ? 1 : 0);

  useEffect(() => {
    setSearchDraft(new URLSearchParams(queryString).get("search") ?? "");
  }, [queryString]);

  useEffect(() => {
    let cancelled = false;

    setIsRefreshing(true);
    setRefreshFailed(false);

    api
      .builds({
        league: activeParams.league,
        search: activeParams.search,
        className: activeParams.className,
        keystones: activeParams.keystones,
        skills: activeParams.skills,
        supports: activeParams.supports,
        gear: activeParams.gear,
        sort: activeParams.sort,
        order: activeParams.order
      })
      .then((response) => {
        if (!cancelled) {
          setData(response);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRefreshFailed(true);
          setData((current) => ({ ...current, source: "fixture" }));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsRefreshing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeParams]);

  function updateParams(mutator: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams.toString());
    mutator(next);
    if (!next.get("league")) {
      next.set("league", data.league.url);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function setSingleParam(key: string, value?: string) {
    updateParams((next) => {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
      next.delete("page");
    });
  }

  function filterHref(groupId: BuildFilterGroup["id"], value: string) {
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
      next.set("league", data.league.url);
    }
    next.delete("page");

    return `${pathname}?${next.toString()}`;
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSingleParam("search", searchDraft.trim() || undefined);
  }

  function resetFilters() {
    const next = new URLSearchParams();
    next.set("league", activeParams.league);
    next.set("sort", activeParams.sort);
    next.set("order", activeParams.order);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[110rem] gap-5">
        <header className="grid gap-4 border border-border bg-card p-4 shadow-lg lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="warning">Builds</Badge>
              <Badge
                variant={data.source === "poe.ninja" ? "success" : "outline"}
                className="gap-1.5"
              >
                <RadioTower className="h-3.5 w-3.5" aria-hidden="true" />
                {data.source === "poe.ninja" ? "poe.ninja live" : "fixture fallback"}
              </Badge>
              <Badge variant="outline">{data.league.displayName}</Badge>
              {isRefreshing ? <Badge variant="secondary">Refreshing</Badge> : null}
              {refreshFailed ? <Badge variant="outline">API fallback</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground">Path of Exile 2 ladder intelligence</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal sm:text-4xl">
              Build Observatory
            </h1>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:flex">
            <StatPill label="Characters" value={formatNumber(data.total)} />
            <StatPill label="Rows loaded" value={formatNumber(data.builds.length)} />
            <StatPill label="Filters" value={formatNumber(activeFilterCount)} />
          </div>
        </header>

        <div className="grid min-w-0 gap-5 lg:grid-cols-[21rem_1fr]">
          <aside className="grid gap-4 lg:content-start">
            <Card>
              <CardHeader>
                <CardDescription>Controls</CardDescription>
                <CardTitle className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  Build filters
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <label className="grid gap-2 text-xs text-muted-foreground">
                  League
                  <span className="relative">
                    <select
                      className="h-10 w-full appearance-none border border-input bg-muted px-3 pr-9 text-sm text-foreground outline-none transition-colors focus:border-ring"
                      value={activeParams.league}
                      onChange={(event) => setSingleParam("league", event.target.value)}
                    >
                      {data.leagues.map((league) => (
                        <option key={league.url} value={league.url}>
                          {league.displayName}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  </span>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-2 text-xs text-muted-foreground">
                    Sort
                    <span className="relative">
                      <select
                        className="h-10 w-full appearance-none border border-input bg-muted px-3 pr-9 text-sm text-foreground outline-none transition-colors focus:border-ring"
                        value={activeParams.sort}
                        onChange={(event) =>
                          updateParams((next) => {
                            next.set("sort", event.target.value);
                          })
                        }
                      >
                        {sortOptions.map((option) => (
                          <option key={option.field} value={option.field}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    </span>
                  </label>

                  <label className="grid gap-2 text-xs text-muted-foreground">
                    Order
                    <span className="relative">
                      <select
                        className="h-10 w-full appearance-none border border-input bg-muted px-3 pr-9 text-sm text-foreground outline-none transition-colors focus:border-ring"
                        value={activeParams.order}
                        onChange={(event) =>
                          updateParams((next) => {
                            next.set("order", event.target.value);
                          })
                        }
                      >
                        <option value="desc">Desc</option>
                        <option value="asc">Asc</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    </span>
                  </label>
                </div>

                <form
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2"
                  onSubmit={handleSearchSubmit}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2 border border-input bg-muted px-3 text-sm text-muted-foreground">
                    <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <input
                      className="h-10 min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                      placeholder="Account or character"
                      value={searchDraft}
                      onChange={(event) => setSearchDraft(event.target.value)}
                    />
                  </div>
                  <Button size="sm" type="submit">
                    Search
                  </Button>
                </form>

                <Button variant="outline" className="justify-start gap-2" onClick={resetFilters}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Reset filters
                </Button>
              </CardContent>
            </Card>

            {data.filters.map((group) => (
              <FilterSection
                activeValues={activeValuesForGroup(activeParams, group.id)}
                getOptionHref={(value) => filterHref(group.id, value)}
                group={group}
                key={group.id}
              />
            ))}
          </aside>

          <section className="grid min-w-0 gap-4">
            <Card className="min-w-0">
              <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
                <div>
                  <CardDescription>
                    {data.source === "poe.ninja" ? "Live poe.ninja ladder" : "Fallback ladder"} ·{" "}
                    {new Date(data.fetchedAt).toLocaleTimeString()}
                  </CardDescription>
                  <CardTitle>Build ladder</CardTitle>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sortOptions.map((option) => {
                    const active = activeParams.sort === option.field;
                    return (
                      <Button
                        key={option.field}
                        variant={active ? "secondary" : "outline"}
                        size="sm"
                        onClick={() =>
                          updateParams((next) => {
                            next.set("sort", option.field);
                          })
                        }
                      >
                        {option.label} {active ? activeParams.order : ""}
                      </Button>
                    );
                  })}
                </div>
              </CardHeader>
              <CardContent className="min-w-0">
                <div className="relative min-h-[22rem]">
                  {isRefreshing ? (
                    <div className="absolute right-3 top-3 z-10 border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
                      Updating results
                    </div>
                  ) : null}
                  <div
                    className={cn(
                      "min-w-0 transition-opacity",
                      isRefreshing ? "opacity-70" : "opacity-100"
                    )}
                  >
                    {data.builds.length ? (
                      <div className="overflow-x-auto border border-border">
                        <table className="w-full min-w-[1040px] border-collapse text-sm">
                          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                            <tr>
                              <th className="px-3 py-3 font-medium">Rank</th>
                              <th className="px-3 py-3 font-medium">Character</th>
                              <th className="px-3 py-3 font-medium">Class</th>
                              <th className="px-3 py-3 font-medium">Level</th>
                              <th className="px-3 py-3 font-medium">Top DPS</th>
                              <th className="px-3 py-3 font-medium">Defenses</th>
                              <th className="px-3 py-3 font-medium">Main skills</th>
                              <th className="px-3 py-3 font-medium">Key gear</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.builds.map((build, index) => (
                              <BuildRow build={build} index={index} key={build.metadata.id} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyState activeFilterCount={activeFilterCount} onReset={resetFilters} />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Selected league</CardDescription>
                <CardTitle>Class distribution</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {data.league.statistics.slice(0, 7).map((stat) => (
                  <div className="grid gap-2" key={stat.className}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span>{stat.className}</span>
                      <span className="text-muted-foreground">{stat.percentage.toFixed(2)}%</span>
                    </div>
                    <div className="h-2 bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.min(stat.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </main>
  );
}

function FilterSection({
  activeValues,
  getOptionHref,
  group
}: {
  activeValues: string[];
  getOptionHref: (value: string) => string;
  group: BuildFilterGroup;
}) {
  const Icon = filterIcons[group.id];
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(filterOptionBatchSize);
  const visibleOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return group.options;
    }

    return group.options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
  }, [group.options, query]);
  const renderedOptions = visibleOptions.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(filterOptionBatchSize);
  }, [group.id, group.options, query]);

  function handleOptionsScroll(event: React.UIEvent<HTMLDivElement>) {
    const target = event.currentTarget;
    const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 16;

    if (nearBottom && visibleCount < visibleOptions.length) {
      setVisibleCount((current) =>
        Math.min(current + filterOptionBatchSize, visibleOptions.length)
      );
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" aria-hidden="true" />
          {group.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex min-w-0 items-center gap-2 border border-input bg-muted px-3 text-sm text-muted-foreground">
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <input
            className="h-9 min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            placeholder={`Search ${group.label.toLowerCase()}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="max-h-64 overflow-y-auto pr-1" onScroll={handleOptionsScroll}>
          <div className="flex flex-wrap gap-2">
            {renderedOptions.length ? (
              renderedOptions.map((option) => {
                const active = activeValues.includes(option.value);
                return group.id === "class" ? (
                  <AscendancyOption
                    active={active}
                    count={option.count}
                    href={getOptionHref(option.value)}
                    key={`${group.id}:${option.value}`}
                    label={option.label}
                  />
                ) : (
                  <a
                    className={cn(
                      "inline-flex max-w-full items-center gap-2 border px-2.5 py-1.5 text-left text-xs transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-muted text-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    href={getOptionHref(option.value)}
                    key={`${group.id}:${option.value}`}
                  >
                    <span
                      className={cn(
                        "truncate",
                        active ? "text-primary-foreground" : "text-foreground"
                      )}
                    >
                      {option.label}
                    </span>
                    <span
                      className={active ? "text-primary-foreground/75" : "text-muted-foreground"}
                    >
                      {formatCompact(option.count)}
                    </span>
                  </a>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">
                {query
                  ? `No ${group.label.toLowerCase()} match that search.`
                  : "No filter options returned."}
              </p>
            )}
          </div>
        </div>
        {visibleOptions.length > filterOptionBatchSize ? (
          <div className="text-xs text-muted-foreground">
            Showing {formatNumber(Math.min(visibleCount, visibleOptions.length))} of{" "}
            {formatNumber(visibleOptions.length)}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AscendancyOption({
  active,
  count,
  href,
  label
}: {
  active: boolean;
  count: number;
  href: string;
  label: string;
}) {
  const imageUrl = getAscendancyImageUrl(label);

  return (
    <a
      aria-label={`${active ? "Remove" : "Add"} ${label}`}
      className={cn(
        "grid w-[5.75rem] gap-1 border p-2 text-center text-xs transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-muted text-foreground hover:bg-accent hover:text-accent-foreground"
      )}
      href={href}
      title={label}
    >
      <span
        className={cn(
          "mx-auto flex h-12 w-12 items-center justify-center overflow-hidden border",
          active
            ? "border-primary-foreground/40 bg-primary-foreground/10"
            : "border-border bg-background"
        )}
      >
        {imageUrl ? (
          <img alt="" className="h-full w-full object-cover" src={imageUrl} />
        ) : (
          <span className="text-base font-semibold">{label.slice(0, 1)}</span>
        )}
      </span>
      <span className={cn("truncate", active ? "text-primary-foreground" : "text-foreground")}>
        {label}
      </span>
      <span className={active ? "text-primary-foreground/75" : "text-muted-foreground"}>
        {formatCompact(count)}
      </span>
    </a>
  );
}

function BuildRow({ build, index }: { build: BuildSnapshot; index: number }) {
  const metadata = build.metadata;
  const skills = build.mainSkills.slice(0, 3).map((skill) => skill.name);
  const items = build.items.slice(0, 2).map((item) => item.name);
  const metrics = build.metrics;

  return (
    <tr className="border-t border-border align-top transition-colors hover:bg-muted/40">
      <td className="whitespace-nowrap px-3 py-4 text-muted-foreground">
        #{metadata.rank ?? index + 1}
      </td>
      <td className="px-3 py-4">
        <div className="flex items-center gap-2 font-semibold">
          <UserRound className="h-4 w-4 text-primary" aria-hidden="true" />
          <Link className="hover:text-primary" href={buildDetailHref(metadata)}>
            {metadata.characterName}
          </Link>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{metadata.accountName}</div>
      </td>
      <td className="px-3 py-4">
        <div>{metadata.ascendancyName ?? metadata.className}</div>
        <div className="text-xs text-muted-foreground">{metadata.league}</div>
      </td>
      <td className="px-3 py-4 text-2xl font-semibold">{metadata.level}</td>
      <td className="px-3 py-4">
        <TopDpsSkill
          skill={metrics?.highestDpsSkill}
          dps={metrics?.dpsLabel}
          iconUrl={metrics?.highestDpsSkillIconUrl}
        />
      </td>
      <td className="px-3 py-4">
        <DefenseMetrics
          life={metrics?.life}
          energyShield={metrics?.energyShield}
          ehp={metrics?.ehpLabel}
        />
      </td>
      <td className="px-3 py-4">
        <ChipList items={skills} />
      </td>
      <td className="px-3 py-4">
        <ChipList items={items} />
      </td>
    </tr>
  );
}

function TopDpsSkill({
  dps,
  iconUrl,
  skill
}: {
  dps?: string | undefined;
  iconUrl?: string | undefined;
  skill?: string | undefined;
}) {
  if (!skill && !dps) {
    return <span className="text-muted-foreground">Unknown</span>;
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden">
        {iconUrl ? (
          <img alt="" className="h-9 w-9 object-contain" src={iconUrl} />
        ) : (
          <span className="text-xs font-semibold text-primary">{skill?.slice(0, 2) ?? "?"}</span>
        )}
      </span>
      <div className="min-w-0">
        <div className="truncate font-semibold">{skill ?? "Unknown skill"}</div>
        <div className="text-xs text-muted-foreground">{dps ?? "DPS unavailable"}</div>
      </div>
    </div>
  );
}

function DefenseMetrics({
  ehp,
  energyShield,
  life
}: {
  ehp?: string | undefined;
  energyShield?: number | undefined;
  life?: number | undefined;
}) {
  return (
    <div className="grid gap-1 text-xs">
      <span className="text-sm font-semibold">{ehp ?? "EHP N/A"}</span>
      <span className="text-muted-foreground">
        Life {life !== undefined ? formatCompact(life) : "N/A"}
      </span>
      <span className="text-muted-foreground">
        ES {energyShield !== undefined ? formatCompact(energyShield) : "N/A"}
      </span>
    </div>
  );
}

function ChipList({ items }: { items: string[] }) {
  if (!items.length) {
    return <span className="text-muted-foreground">Unknown</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          className="max-w-44 truncate border border-border bg-muted px-2 py-1 text-xs"
          key={item}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function EmptyState({
  activeFilterCount,
  onReset
}: {
  activeFilterCount: number;
  onReset: () => void;
}) {
  return (
    <div className="grid min-h-[22rem] place-content-center gap-3 border border-border bg-muted p-6 text-center">
      <div className="text-lg font-semibold">No builds match these filters</div>
      <p className="text-sm text-muted-foreground">
        {activeFilterCount > 0
          ? "Clear the active filter set or choose a different league."
          : "No builds were returned for this league yet."}
      </p>
      <div>
        <Button variant="secondary" onClick={onReset}>
          Reset filters
        </Button>
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-muted px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function buildDetailHref(metadata: BuildSnapshot["metadata"]) {
  return `/builds/${encodeURIComponent(`${metadata.league}:${metadata.accountName}:${metadata.characterName}`)}`;
}

function parseBuildSearchParams(
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

function activeValuesForGroup(
  params: ReturnType<typeof parseBuildSearchParams>,
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

function filterParamKey(groupId: BuildFilterGroup["id"]) {
  return groupId === "class" ? "class" : groupId;
}

function splitParam(value: string | null) {
  return (
    value
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  );
}

function parseSort(value: string | null): NonNullable<BuildSearchParams["sort"]> {
  return value === "dps" ||
    value === "life" ||
    value === "energyshield" ||
    value === "ehp" ||
    value === "level"
    ? value
    : "level";
}

function parseOrder(value: string | null): NonNullable<BuildSearchParams["order"]> {
  return value === "asc" ? "asc" : "desc";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    value
  );
}

function getAscendancyImageUrl(name: string) {
  return ascendancyImageUrls[name];
}

const ascendancyImageUrls: Record<string, string | undefined> = {
  "Martial Artist": "https://www.poe2wiki.net/images/9/95/Martial_Artist_portrait.png",
  "Spirit Walker": "https://www.poe2wiki.net/images/4/46/Spirit_Walker_portrait.png",
  Deadeye: "https://www.poe2wiki.net/images/d/d4/Deadeye_portrait.png",
  Oracle: "https://www.poe2wiki.net/images/c/c2/Oracle_portrait.png",
  Tactician: "https://www.poe2wiki.net/images/1/1f/Tactician_portrait.png",
  "Disciple of Varashta": "https://www.poe2wiki.net/images/6/61/Disciple_of_Varashta_portrait.png",
  Witchhunter: "https://www.poe2wiki.net/images/6/61/Witchhunter_portrait.png",
  Stormweaver: "https://www.poe2wiki.net/images/1/19/Stormweaver_portrait.png",
  Titan: "https://www.poe2wiki.net/images/d/dc/Titan_portrait.png",
  Lich: "https://www.poe2wiki.net/images/5/5c/Lich_portrait.png",
  "Gemling Legionnaire": "https://www.poe2wiki.net/images/2/25/Gemling_Legionnaire_portrait.png",
  "Blood Mage": "https://www.poe2wiki.net/images/d/da/Blood_Mage_portrait.png",
  "Abyssal Lich": "https://www.poe2wiki.net/images/5/5e/Abyssal_Lich_portrait.png",
  Infernalist: "https://www.poe2wiki.net/images/8/86/Infernalist_portrait.png",
  Chronomancer: "https://www.poe2wiki.net/images/1/1e/Chronomancer_portrait.png",
  Shaman: "https://www.poe2wiki.net/images/3/30/Shaman_portrait.png",
  Amazon: "https://www.poe2wiki.net/images/d/d3/Amazon_portrait.png",
  Ritualist: "https://www.poe2wiki.net/images/3/39/Ritualist_portrait.png",
  Warbringer: "https://www.poe2wiki.net/images/f/ff/Warbringer_portrait.png",
  "Smith of Kitava": "https://www.poe2wiki.net/images/c/c1/Smith_of_Kitava_portrait.png",
  "Acolyte of Chayula": "https://www.poe2wiki.net/images/9/9f/Acolyte_of_Chayula_portrait.png",
  Pathfinder: "https://www.poe2wiki.net/images/c/c4/Pathfinder_portrait.png",
  Invoker: "https://www.poe2wiki.net/images/a/a2/Invoker_portrait.png",
  Witch: "https://www.poe2wiki.net/images/7/7e/Witch_portrait.png",
  Huntress: "https://www.poe2wiki.net/images/a/a8/Huntress_portrait.png",
  Ranger: "https://www.poe2wiki.net/images/f/f9/Ranger_portrait.png",
  Sorceress: "https://www.poe2wiki.net/images/d/d2/Sorceress_portrait.png",
  Monk: "https://www.poe2wiki.net/images/e/e9/Monk_portrait.png",
  Mercenary: "https://www.poe2wiki.net/images/3/33/Mercenary_portrait.png",
  Warrior: "https://www.poe2wiki.net/images/c/c6/Warrior_portrait.png"
};
