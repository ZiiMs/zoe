import Link from "next/link";
import type { ReactNode } from "react";
import { createZoeApiClient } from "@zoe/api-client";
import { readWebEnv } from "@zoe/config";
import type {
  BuildDetail,
  BuildDetailItem,
  BuildDetailKeystone,
  BuildDetailSkillGroup,
  BuildPassiveTree,
  PassiveHeatmapPoint
} from "@zoe/domain";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  buttonVariants,
  cn
} from "@zoe/ui";
import {
  ArrowLeft,
  ExternalLink,
  Gem,
  Map as MapIcon,
  PackageSearch,
  RadioTower,
  Shield,
  Sparkles,
  Sword
} from "lucide-react";
import { buildListHref, safeDecode } from "./route-helpers";
import { ItemTooltip, WeaponSetInventory } from "./weapon-set-inventory";

const env = readWebEnv(process.env);
const api = createZoeApiClient({
  baseUrl: env.NEXT_PUBLIC_API_BASE_URL
});

export default async function BuildDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const [response, rawSearchParams] = await Promise.all([
    loadBuildDetail(safeDecode(id)),
    searchParams
  ]);
  const backHref = buildListHref(rawSearchParams);

  if (!response.detail) {
    return <MissingBuildState id={safeDecode(id)} backHref={backHref} error={response.error} />;
  }

  const detail = response.detail;
  const metadata = detail.build.metadata;

  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full min-w-0 max-w-[110rem] gap-5">
        <header className="grid gap-4 border border-border bg-card p-4 shadow-lg lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="warning">Build detail</Badge>
              <Badge variant={buildDetailSourceVariant(detail.source)}>
                {buildDetailSourceLabel(detail.source)}
              </Badge>
              <Badge variant="outline">{metadata.league}</Badge>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
                {metadata.characterName}
              </h1>
              <div className="pb-1 text-sm text-muted-foreground">{metadata.accountName}</div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Level {metadata.level} {metadata.ascendancyName ?? metadata.className}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className={buttonVariants({ variant: "outline" })} href={backHref}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to builds
            </Link>
            <Link className={buttonVariants({ variant: "secondary" })} href={detail.poeNinjaUrl}>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              poe.ninja
            </Link>
          </div>
        </header>

        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,34rem)_15rem] lg:items-start xl:grid-cols-[minmax(0,34rem)_22rem]">
          <EquipmentPanel detail={detail} />
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <StatCard
              label="Top DPS"
              value={detail.build.metrics?.dpsLabel ?? "N/A"}
              detail={detail.build.metrics?.highestDpsSkill}
            />
            <StatCard
              label="EHP"
              value={formatNumber(detail.defensiveStats.effectiveHealthPool)}
              detail="Effective health pool"
            />
            <StatCard
              label="Life / ES"
              value={`${formatNumber(detail.defensiveStats.life)} / ${formatNumber(detail.defensiveStats.energyShield)}`}
              detail="Core pools"
            />
            <StatCard
              label="Passives"
              value={formatNumber(detail.passiveCounts.passives)}
              detail={`${detail.passiveCounts.ascendancy ?? 0} ascendancy`}
            />
            <MetadataPanel detail={detail} />
          </section>
        </div>
        <PassiveTreePanel tree={detail.passiveTree} />

        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="grid gap-5">
            <SkillPanel groups={detail.skillGroups} />
            <ItemListPanel items={detail.items} />
          </section>
          <section className="grid gap-5">
            <DefensePanel detail={detail} />
            <KeystonePanel keystones={detail.keystones} />
            <SnapshotPassivePanel passives={detail.build.passives} />
            <CompactItemPanel
              icon={<Gem className="h-4 w-4" aria-hidden="true" />}
              items={detail.flasks}
              title="Flasks"
            />
            <CompactItemPanel
              icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
              items={detail.jewels}
              title="Jewels"
            />
          </section>
        </div>
      </div>
    </main>
  );
}

async function loadBuildDetail(id: string): Promise<{ detail?: BuildDetail; error?: string }> {
  try {
    return await api.build(id);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function MissingBuildState({
  backHref,
  error,
  id
}: {
  backHref: string;
  error?: string | undefined;
  id: string;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-8 text-foreground">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge variant="warning">Build detail</Badge>
            <Badge variant="outline">Unavailable</Badge>
          </div>
          <CardTitle>Build detail could not be loaded</CardTitle>
          <CardDescription>
            The API did not return a matching build detail for this character or the local API is
            unavailable.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="border border-border bg-muted p-3 text-sm">
            <div className="text-xs text-muted-foreground">Requested id</div>
            <div className="mt-1 break-all font-medium">{id}</div>
          </div>
          {error ? (
            <div className="border border-border bg-muted p-3 text-sm text-muted-foreground">
              {error}
            </div>
          ) : null}
          <div>
            <Link className={buttonVariants({ variant: "secondary" })} href={backHref}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to builds
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function EquipmentPanel({ detail }: { detail: BuildDetail }) {
  const equipped = detail.items.filter((item) => String(item.slot) !== "24");

  return (
    <section className="min-w-0 overflow-hidden border border-border bg-card">
      <header className="border-b border-border bg-muted/50 px-4 py-3">
        <h2 className="text-lg font-semibold">Equipment</h2>
      </header>
      <div className="bg-card p-4 sm:p-6">
        <WeaponSetInventory equipped={equipped} flasks={detail.flasks} />
      </div>
    </section>
  );
}

function PassiveTreePanel({ tree }: { tree?: BuildPassiveTree | undefined }) {
  const allocatedCount = tree?.nodes.filter((node) => node.allocated).length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardDescription>
          {tree
            ? `${tree.nodes.length.toLocaleString()} nodes · ${allocatedCount.toLocaleString()} allocated`
            : "Tree export unavailable"}
        </CardDescription>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Passive tree
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tree ? (
          <PassiveTreeSvg tree={tree} />
        ) : (
          <p className="text-sm text-muted-foreground">Passive tree data could not be loaded.</p>
        )}
      </CardContent>
    </Card>
  );
}

function PassiveTreeSvg({ tree }: { tree: BuildPassiveTree }) {
  const width = tree.bounds.maxX - tree.bounds.minX;
  const height = tree.bounds.maxY - tree.bounds.minY;
  const nodeById = new Map(tree.nodes.map((node) => [node.id, node]));
  const edgePath = tree.edges
    .flatMap((edge) => {
      const from = nodeById.get(edge.from);
      const to = nodeById.get(edge.to);
      return from && to ? [`M${from.x} ${from.y}L${to.x} ${to.y}`] : [];
    })
    .join("");
  const backgroundNodePath = tree.nodes
    .filter((node) => !node.allocated && !node.notable && !node.keystone && !node.ascendancy)
    .map((node) => circlePath(node.x, node.y, 46))
    .join("");
  const inspectableNodes = tree.nodes.filter(
    (node) => node.allocated || node.notable || node.keystone || node.ascendancy
  );

  return (
    <div className="overflow-hidden border border-border bg-[#070504]">
      <svg
        aria-label="Path of Exile 2 passive tree"
        className="h-[34rem] w-full"
        preserveAspectRatio="xMidYMid meet"
        viewBox={`${tree.bounds.minX - 900} ${tree.bounds.minY - 900} ${width + 1800} ${height + 1800}`}
      >
        <rect
          x={tree.bounds.minX - 900}
          y={tree.bounds.minY - 900}
          width={width + 1800}
          height={height + 1800}
          fill="#070504"
        />
        <path
          d={edgePath}
          fill="none"
          opacity="0.32"
          stroke="#6d4a2c"
          strokeLinecap="round"
          strokeWidth="38"
        />
        <path d={backgroundNodePath} fill="#3a2a1f" opacity="0.42" />
        <g>
          {inspectableNodes.map((node) => (
            <circle
              cx={node.x}
              cy={node.y}
              fill={nodeColor(node)}
              key={node.id}
              opacity={node.allocated ? 1 : 0.42}
              r={nodeRadius(node)}
              stroke={node.allocated ? "#f5d68a" : "#3c2a1c"}
              strokeWidth={node.allocated ? 30 : 12}
            >
              <title>{[node.name, ...node.stats].join("\n")}</title>
            </circle>
          ))}
        </g>
      </svg>
      <div className="flex flex-wrap gap-3 border-t border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        <LegendDot className="bg-amber-300" label="Allocated" />
        <LegendDot className="bg-emerald-400" label="Weapon set 1" />
        <LegendDot className="bg-sky-400" label="Weapon set 2" />
        <LegendDot className="bg-primary" label="Notable / keystone" />
      </div>
    </div>
  );
}

function SkillPanel({ groups }: { groups: BuildDetailSkillGroup[] }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Damage setup</CardDescription>
        <CardTitle className="flex items-center gap-2">
          <Sword className="h-4 w-4" aria-hidden="true" />
          Skill groups
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {groups.length ? (
          groups.map((group) => (
            <SkillGroup group={group} key={`${group.name}:${group.gems.length}`} />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No skill group detail was returned.</p>
        )}
      </CardContent>
    </Card>
  );
}

function MetadataPanel({ detail }: { detail: BuildDetail }) {
  const metadata = detail.build.metadata;
  return (
    <Card className="sm:col-span-2 lg:col-span-1">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <RadioTower className="h-4 w-4" aria-hidden="true" />
          Metadata
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <MetaRow label="Rank" value={metadata.rank ? `#${metadata.rank}` : "N/A"} />
        <MetaRow label="Class" value={metadata.ascendancyName ?? metadata.className} />
        <MetaRow label="Source" value={buildDetailSourceLabel(detail.source)} />
        <MetaRow label="Captured" value={formatDateTime(detail.build.capturedAt)} />
        <MetaRow label="Updated" value={formatDateTime(detail.updatedAt)} />
        <MetaRow label="Last seen" value={formatDateTime(detail.lastSeenAt)} />
      </CardContent>
    </Card>
  );
}

function DefensePanel({ detail }: { detail: BuildDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Survivability</CardDescription>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-4 w-4" aria-hidden="true" />
          Defenses
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm">
        {[
          ["Fire", detail.defensiveStats.fireResistance],
          ["Cold", detail.defensiveStats.coldResistance],
          ["Lightning", detail.defensiveStats.lightningResistance],
          ["Chaos", detail.defensiveStats.chaosResistance],
          ["Evasion", detail.defensiveStats.evasionRating],
          ["Armour", detail.defensiveStats.armour],
          ["Block", detail.defensiveStats.blockChance],
          ["Spirit", detail.defensiveStats.spirit]
        ].map(([label, value]) => (
          <div className="border border-border bg-muted p-3" key={label}>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-lg font-semibold">
              {formatNumber(value as number | undefined)}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function StatCard({
  detail,
  label,
  value
}: {
  detail?: string | undefined;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
        {detail ? (
          <div className="mt-1 truncate text-xs text-muted-foreground">{detail}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function KeystonePanel({ keystones }: { keystones: BuildDetailKeystone[] }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{keystones.length} returned</CardDescription>
        <CardTitle className="flex items-center gap-2">
          <MapIcon className="h-4 w-4" aria-hidden="true" />
          Keystones
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {keystones.length ? (
          keystones.map((keystone) => (
            <div className="grid gap-2 border border-border bg-muted p-3" key={keystone.name}>
              <div className="flex min-w-0 items-center gap-2">
                {keystone.iconUrl ? (
                  <img
                    alt=""
                    className="h-8 w-8 shrink-0 object-contain"
                    height={32}
                    loading="lazy"
                    src={keystone.iconUrl}
                    width={32}
                  />
                ) : null}
                <div className="min-w-0 truncate font-semibold">{keystone.name}</div>
              </div>
              {keystone.stats.length ? (
                <div className="grid gap-1 text-xs text-muted-foreground">
                  {keystone.stats.slice(0, 4).map((stat) => (
                    <div key={stat}>{cleanMod(stat)}</div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No keystone stat text returned.</p>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No keystones were returned for this build.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SnapshotPassivePanel({ passives }: { passives: PassiveHeatmapPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Search snapshot</CardDescription>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Passive signals
        </CardTitle>
      </CardHeader>
      <CardContent>
        {passives.length ? (
          <div className="flex flex-wrap gap-2">
            {passives.map((passive) => (
              <span
                className="inline-flex max-w-full items-center gap-2 border border-border bg-muted px-2 py-1 text-xs"
                key={passive.passiveId}
                title={passive.passiveId}
              >
                <span className="truncate">{passive.name ?? passive.passiveId}</span>
                <span className="text-muted-foreground">{formatCompact(passive.weight)}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No passive heatmap signals were returned.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ItemListPanel({ items }: { items: BuildDetailItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{items.length} equipped items</CardDescription>
        <CardTitle className="flex items-center gap-2">
          <PackageSearch className="h-4 w-4" aria-hidden="true" />
          Item details
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {items.length ? (
          items.map((item, index) => (
            <div
              className="grid gap-3 border border-border bg-muted p-3 sm:grid-cols-[auto_1fr]"
              key={`${item.slot}:${item.name}:${index}`}
            >
              {item.iconUrl ? (
                <img
                  alt=""
                  className="h-14 w-14 object-contain"
                  height={56}
                  loading="lazy"
                  src={item.iconUrl}
                  width={56}
                />
              ) : (
                <div className="grid h-14 w-14 place-items-center border border-border bg-card text-xs text-muted-foreground">
                  {item.slot}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 truncate font-semibold">{item.name}</div>
                  <Badge variant="outline">{item.slot}</Badge>
                  {item.rarity ? <Badge variant="secondary">{item.rarity}</Badge> : null}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{item.typeLine}</div>
                <ModList mods={item.implicitMods} title="Implicit" />
                <ModList mods={item.explicitMods} title="Explicit" />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No equipped item detail was returned.</p>
        )}
      </CardContent>
    </Card>
  );
}

function SkillGroup({ group }: { group: BuildDetailSkillGroup }) {
  return (
    <div className="grid gap-3 border border-border bg-muted p-3">
      <div className="flex min-w-0 items-center gap-3">
        {group.iconUrl ? (
          <img
            alt=""
            className="h-11 w-11 shrink-0 object-contain"
            height={44}
            loading="lazy"
            src={group.iconUrl}
            width={44}
          />
        ) : null}
        <div className="min-w-0">
          <div className="truncate font-semibold">{group.name}</div>
          <div className="text-xs text-muted-foreground">
            {group.dps ? `${formatCompact(group.dps)} DPS` : "DPS unavailable"}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {group.gems.map((gem) => (
          <span
            className="inline-flex max-w-full items-center gap-2 border border-border bg-card px-2 py-1 text-xs"
            key={`${group.name}:${gem.name}`}
          >
            {gem.iconUrl ? (
              <img
                alt=""
                className="h-5 w-5 shrink-0 object-contain"
                height={20}
                loading="lazy"
                src={gem.iconUrl}
                width={20}
              />
            ) : null}
            <span className="truncate">{gem.name}</span>
            {gem.support ? <span className="text-muted-foreground">support</span> : null}
          </span>
        ))}
      </div>
    </div>
  );
}

function CompactItemPanel({
  icon,
  items,
  title
}: {
  icon: ReactNode;
  items: BuildDetailItem[];
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{items.length} returned</CardDescription>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {items.length ? (
          items.map((item, index) => (
            <ItemToken item={item} key={`${title}:${item.slot}:${item.name}:${index}`} />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">None returned.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ItemToken({ item }: { item: BuildDetailItem }) {
  return (
    <div className="group/item relative inline-flex items-center gap-2 border border-border bg-muted px-2 py-1 text-xs">
      {item.iconUrl ? (
        <img
          alt=""
          className="h-6 w-6 shrink-0 object-contain"
          height={24}
          loading="lazy"
          src={item.iconUrl}
          width={24}
        />
      ) : null}
      <span className="max-w-44 truncate">{item.name}</span>
      <ItemTooltip align="left" item={item} />
    </div>
  );
}

function ModList({ mods, title }: { mods: string[]; title: string }) {
  return mods.length ? (
    <div className="mt-3 border-t border-border pt-2">
      <div className="mb-1 text-[0.7rem] uppercase text-muted-foreground">{title}</div>
      <div className="grid gap-1">
        {mods.slice(0, 8).map((mod) => (
          <div key={mod}>{cleanMod(mod)}</div>
        ))}
      </div>
    </div>
  ) : null;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-2 last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{value}</span>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", className)} />
      {label}
    </span>
  );
}

function nodeRadius(node: BuildPassiveTree["nodes"][number]) {
  if (node.keystone) {
    return 155;
  }

  if (node.notable || node.ascendancy) {
    return 115;
  }

  return node.allocated ? 78 : 46;
}

function nodeColor(node: BuildPassiveTree["nodes"][number]) {
  if (node.weaponSet === 1) {
    return "#34d399";
  }

  if (node.weaponSet === 2) {
    return "#38bdf8";
  }

  if (node.allocated) {
    return "#f5d68a";
  }

  if (node.keystone || node.notable) {
    return "#c27e3b";
  }

  return "#3a2a1f";
}

function circlePath(x: number, y: number, radius: number) {
  return `M${x - radius} ${y}a${radius} ${radius} 0 1 0 ${radius * 2} 0a${radius} ${radius} 0 1 0 ${-radius * 2} 0`;
}

function cleanMod(value: string) {
  return value
    .replace(/\[([^\]|]+)\|([^\]]+)\]/g, "$2")
    .replace(/\[([^\]]+)\]/g, "$1")
    .replace(/\[([^\]]+)\]/g, "$1");
}

function formatDateTime(value?: string) {
  if (!value) {
    return "N/A";
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? new Date(value).toLocaleString() : "N/A";
}

function formatNumber(value?: number) {
  if (value === undefined || value === null) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

function buildDetailSourceLabel(source: BuildDetail["source"]) {
  if (source === "poe.ninja") {
    return "poe.ninja live";
  }

  return source === "database" ? "persisted data" : "fixture fallback";
}

function buildDetailSourceVariant(source: BuildDetail["source"]) {
  return source === "poe.ninja" || source === "database" ? "success" : "outline";
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    value
  );
}
