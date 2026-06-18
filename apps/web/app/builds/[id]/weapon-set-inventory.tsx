"use client";

import { useState } from "react";
import type { BuildDetailItem } from "@zoe/domain";
import { cn } from "@zoe/ui";
import { Repeat2 } from "lucide-react";

const weaponSetSlotGroups = {
  1: {
    Weapon: ["7", "Weapon", "MainHand", "Mainhand"],
    Offhand: ["6", "Offhand"]
  },
  2: {
    Weapon: ["15", "27", "Weapon2", "Weapon 2", "MainHand2", "Mainhand2"],
    Offhand: ["16", "28", "Offhand2", "Offhand 2"]
  }
} as const;

const equipmentSlots = [
  { area: "Weapon", columns: 2, imageScale: 1.1, label: "Mainhand", rows: 4 },
  { area: "Offhand", columns: 2, imageScale: 1.1, label: "Offhand", rows: 4 },
  { area: "Helm", columns: 2, imageScale: 1.75, label: "Helmet", rows: 2, slots: ["1"] },
  { area: "BodyArmour", columns: 2, imageScale: 1.2, label: "Body Armour", rows: 3, slots: ["3"] },
  { area: "Gloves", columns: 2, imageScale: 1.35, label: "Gloves", rows: 2, slots: ["2"] },
  { area: "Boots", columns: 2, imageScale: 1.35, label: "Boots", rows: 2, slots: ["5"] },
  { area: "Amulet", columns: 1, imageScale: 1.55, label: "Amulet", rows: 1, slots: ["4"] },
  { area: "Ring", columns: 1, imageScale: 1.35, label: "Left Ring", rows: 1, slots: ["8"] },
  { area: "Ring2", columns: 1, imageScale: 1.35, label: "Right Ring", rows: 1, slots: ["9"] },
  { area: "Belt", columns: 2, imageScale: 1.35, label: "Belt", rows: 1, slots: ["11"] }
] as const satisfies ReadonlyArray<{
  area: string;
  columns: number;
  imageScale: number;
  label: string;
  rows: number;
  slots?: readonly string[];
}>;

const equipmentBackgroundSlots = [
  { area: "Weapon", columns: 2, rows: 4 },
  { area: "Offhand", columns: 2, rows: 4 },
  { area: "Helm", columns: 2, rows: 2 },
  { area: "BodyArmour", columns: 2, rows: 3 },
  { area: "Gloves", columns: 2, rows: 2 },
  { area: "Boots", columns: 2, rows: 2 },
  { area: "Amulet", columns: 1, rows: 1 },
  { area: "Ring", columns: 1, rows: 1 },
  { area: "Ring2", columns: 1, rows: 1 },
  { area: "Ring3", columns: 1, rows: 1 },
  { area: "Belt", columns: 2, rows: 1 },
  { area: "Flasks", columns: 5, rows: 1 }
] as const;

type WeaponSet = 1 | 2;

export function WeaponSetInventory({
  equipped,
  flasks
}: {
  equipped: BuildDetailItem[];
  flasks: BuildDetailItem[];
}) {
  const [weaponSet, setWeaponSet] = useState<WeaponSet>(1);

  return (
    <div className="mx-auto w-full max-w-[32.875rem]">
      <div className="mb-3 flex justify-end">
        <div
          className="inline-flex items-center gap-1 border border-border bg-muted p-1"
          role="group"
          aria-label="Weapon set"
        >
          {[1, 2].map((set) => (
            <button
              aria-pressed={weaponSet === set}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 px-2.5 text-xs font-medium transition-colors",
                weaponSet === set
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-card hover:text-foreground"
              )}
              key={set}
              onClick={() => setWeaponSet(set as WeaponSet)}
              type="button"
            >
              <Repeat2 className="h-3.5 w-3.5" aria-hidden="true" />
              Set {set}
            </button>
          ))}
        </div>
      </div>
      <div
        className="grid aspect-square w-full grid-cols-8 grid-rows-8 gap-1.5"
        style={{
          gridTemplateAreas: `
            "Weapon Weapon . Helm Helm . Offhand Offhand"
            "Weapon Weapon . Helm Helm . Offhand Offhand"
            "Weapon Weapon Ring3 BodyArmour BodyArmour Amulet Offhand Offhand"
            "Weapon Weapon Ring BodyArmour BodyArmour Ring2 Offhand Offhand"
            ". Gloves Gloves BodyArmour BodyArmour Boots Boots ."
            ". Gloves Gloves Belt Belt Boots Boots ."
            ". . . . . . . ."
            "Flasks Flasks Flasks Flasks Flasks . . ."
          `,
          gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
          gridTemplateRows: "repeat(8, minmax(0, 1fr))"
        }}
      >
        {equipmentBackgroundSlots.map((slot) => (
          <EquipmentBackgroundSlot
            area={slot.area}
            columns={slot.columns}
            key={`background:${slot.area}`}
            rows={slot.rows}
          />
        ))}
        {equipmentSlots.map((slot) => (
          <InventorySlot
            area={slot.area}
            columns={slot.columns}
            imageScale={slot.imageScale}
            item={
              findSlotItems(
                equipped,
                getSlotIds(slot.area, weaponSet, "slots" in slot ? slot.slots : undefined)
              )[0]
            }
            key={slot.label}
            label={slot.label}
            rows={slot.rows}
          />
        ))}
        {Array.from({ length: 5 }, (_, index) => (
          <InventorySlot
            area="Flasks"
            columns={1}
            gridColumn={`${index + 1} / span 1`}
            imageScale={1.15}
            item={flasks[index]}
            key={flasks[index]?.name ?? `flask:${index}`}
            label="Flask"
            rows={1}
          />
        ))}
      </div>
    </div>
  );
}

function EquipmentBackgroundSlot({
  area,
  columns,
  rows
}: {
  area: string;
  columns: number;
  rows: number;
}) {
  return (
    <div
      className="border border-[#21180f] bg-[#11100f]/80 shadow-[inset_0_0_12px_rgba(0,0,0,0.8)]"
      style={{
        gridArea: area,
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
      }}
    />
  );
}

function InventorySlot({
  area,
  columns,
  gridColumn,
  imageScale,
  item,
  label,
  rows,
  className
}: {
  area: string;
  columns: number;
  gridColumn?: string | undefined;
  imageScale: number;
  item?: BuildDetailItem | undefined;
  label: string;
  rows: number;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn(
        "group/item relative z-10 grid h-full w-full min-w-0 overflow-hidden border border-[#2a2118] bg-center p-0.5 shadow-inner place-items-center",
        item ? "hover:border-[#70572f]" : "",
        className
      )}
      style={{
        gridArea: area,
        ...(gridColumn ? { gridColumn } : {}),
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
      }}
      title={item ? `${label}: ${item.name}` : label}
    >
      {item?.iconUrl ? (
        <span className="absolute inset-1.5 z-10 flex items-center justify-center overflow-hidden">
          <img
            alt=""
            className="max-h-full max-w-full object-contain drop-shadow-[0_8px_10px_rgba(0,0,0,0.9)]"
            height={96}
            loading="lazy"
            src={item.iconUrl}
            style={{ transform: `scale(${imageScale})` }}
            width={96}
          />
        </span>
      ) : (
        <span className="relative z-10 px-1 text-center text-[0.58rem] uppercase text-[#4a3b2a]">
          {label}
        </span>
      )}
      {item ? <ItemTooltip align={area === "Offhand" ? "right" : "left"} item={item} /> : null}
    </div>
  );
}

export function ItemTooltip({ align, item }: { align: "left" | "right"; item: BuildDetailItem }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute top-[calc(100%+0.5rem)] z-30 hidden w-[min(20rem,calc(100vw-2rem))] border border-primary/40 bg-card p-3 text-left text-xs shadow-2xl group-hover/item:block",
        align === "right" ? "right-0" : "left-0"
      )}
      aria-hidden="true"
    >
      <div className="flex items-start gap-3">
        {item.iconUrl ? (
          <img
            alt=""
            className="h-12 w-12 shrink-0 object-contain"
            height={48}
            loading="lazy"
            src={item.iconUrl}
            width={48}
          />
        ) : null}
        <div className="min-w-0">
          <div className="font-semibold text-primary">{item.name}</div>
          <div className="text-muted-foreground">{item.typeLine}</div>
          {item.rarity ? (
            <div className="mt-1 text-[0.7rem] uppercase text-amber-300">{item.rarity}</div>
          ) : null}
        </div>
      </div>
      <ModList mods={item.implicitMods} title="Implicit" />
      <ModList mods={item.explicitMods} title="Explicit" />
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

function getSlotIds(area: string, weaponSet: WeaponSet, fallbackSlots?: readonly string[]) {
  if (isWeaponArea(area)) {
    return weaponSetSlotGroups[weaponSet][area];
  }

  return fallbackSlots ?? [];
}

function isWeaponArea(area: string): area is keyof (typeof weaponSetSlotGroups)[WeaponSet] {
  return area === "Weapon" || area === "Offhand";
}

function findSlotItems(items: BuildDetailItem[], slots: readonly string[]) {
  return items.filter((item) => slots.includes(String(item.slot)));
}

function cleanMod(mod: string) {
  return mod.replace(/\{[^}]+\}/g, "").replace(/\s+/g, " ").trim();
}
