import { useState } from "react";
import { useTree } from "@/lib/treeStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, ChevronDown } from "lucide-react";
import { InfoTip } from "@/components/skilltree/InfoTip";
import { useLibList, ListHeader, EmptyNote, EntryCard, PeriodSelect, CostField } from "./shared";
import { GearContents } from "@/components/skilltree/library/GearContents";

// Adventuring Gear, Trinkets, Explosives, Currency, Trade Goods and Poisons
// tabs for the Reference Library.

// A gear item counts as a kit/container when its category says so — or when
// the builder has toggled "Holds items" on it directly.
const containerLike = (cat) => /container|pack|kit/i.test(cat || "");
const holdsItems = (e) => (e.isContainer != null ? !!e.isContainer : containerLike(e.category));

export function AdventuringGearTab() {
  const { settings } = useTree();
  const lib = settings.library;
  const g = useLibList("adventuringGear");
  const cats = lib.adventureGearCategories || [];
  const periods = lib.timePeriods || [];
  return (
    <div className="space-y-2">
      <ListHeader
        onAdd={() =>
          g.add({ name: "", category: cats[0] || "", period: periods[0] || "", cost: "", weight: 0, description: "" })
        }
        addLabel="Add gear"
        query={g.query}
        setQuery={g.setQuery}
        searchPlaceholder="Search gear…"
      />
      <EmptyNote items={g.items} query={g.query} />
      {g.shown.map(({ e, i }) => (
        <EntryCard key={i} entry={e} onPatch={(p) => g.patch(i, p)} onDelete={() => g.remove(i)}>
          <div className="grid grid-cols-2 gap-1.5">
            <InfoTip label="The item's display name.">
              <Input
                className="h-8"
                placeholder="Name"
                value={e.name || ""}
                onChange={(ev) => g.patch(i, { name: ev.target.value })}
              />
            </InfoTip>
            <Select value={e.category || ""} onValueChange={(v) => g.patch(i, { category: v })}>
              <InfoTip label="Gear category, e.g. Tool, Container, Holy Symbol.">
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
              </InfoTip>
              <SelectContent>
                {cats.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <PeriodSelect periods={periods} value={e.period} onChange={(v) => g.patch(i, { period: v })} />
            <InfoTip label="Cost and currency, e.g. 10 gp.">
              <CostField value={e.cost} onChange={(v) => g.patch(i, { cost: v })} />
            </InfoTip>
            <InfoTip label="Weight in pounds; counts toward carry capacity.">
              <Input
                className="h-8"
                type="number"
                min={0}
                placeholder="Weight (lb)"
                value={e.weight ?? 0}
                onChange={(ev) => g.patch(i, { weight: Number(ev.target.value) || 0 })}
              />
            </InfoTip>
            <InfoTip label="Kits and containers (backpack, dungeoneer's pack…) can hold other items.">
              <label className="flex h-8 items-center gap-1.5 text-xs text-muted-foreground">
                <Switch
                  checked={holdsItems(e)}
                  onCheckedChange={(v) => g.patch(i, { isContainer: v })}
                />
                Holds items
              </label>
            </InfoTip>
          </div>
          {holdsItems(e) && (
            <GearContents
              contents={e.contents || []}
              onChange={(contents) => g.patch(i, { contents })}
            />
          )}
        </EntryCard>
      ))}
    </div>
  );
}

// A named table of text rows that can be rolled with a click.
function RollTable({ table, onChange, onDelete }) {
  const [open, setOpen] = useState(false);
  const [roll, setRoll] = useState(null);
  const rows = table.rows || [];
  return (
    <div className="rounded-md border p-2">
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setOpen(!open)}>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
          />
        </button>
        <InfoTip label="Name of this rollable table.">
          <Input
            className="h-8 flex-1"
            placeholder="Table name"
            value={table.name || ""}
            onChange={(e) => onChange({ ...table, name: e.target.value })}
          />
        </InfoTip>
        <Button size="sm" variant="outline" onClick={() => rows.length && setRoll(rows[Math.floor(Math.random() * rows.length)])}>
          Roll
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      {roll !== null && <p className="mt-1 rounded bg-muted/50 px-2 py-1 text-xs">🎲 {roll}</p>}
      {open && (
        <InfoTip label="One possible result per line; Roll picks one at random.">
          <Textarea
            className="mt-1 min-h-20"
            placeholder="One result per line"
            value={rows.join("\n")}
            onChange={(e) => onChange({ ...table, rows: e.target.value.split("\n") })}
          />
        </InfoTip>
      )}
    </div>
  );
}

export function TrinketsTab() {
  const { settings, setSettings } = useTree();
  const t = useLibList("trinkets");
  const tables = settings?.library?.trinketTables || [];
  const setTables = (next) =>
    setSettings((s) => ({ ...s, library: { ...s.library, trinketTables: next } }));
  return (
    <div className="space-y-2">
      <ListHeader
        onAdd={() => t.add({ name: "", cost: "", description: "" })}
        addLabel="Add trinket"
        query={t.query}
        setQuery={t.setQuery}
        searchPlaceholder="Search trinkets…"
      />
      <EmptyNote items={t.items} query={t.query} />
      {t.shown.map(({ e, i }) => (
        <EntryCard key={i} entry={e} onPatch={(p) => t.patch(i, p)} onDelete={() => t.remove(i)}>
          <div className="flex items-center gap-1">
            <InfoTip label="The trinket's display name.">
              <Input
                className="h-8 flex-1"
                placeholder="Trinket name"
                value={e.name || ""}
                onChange={(ev) => t.patch(i, { name: ev.target.value })}
              />
            </InfoTip>
            <CostField value={e.cost} onChange={(v) => t.patch(i, { cost: v })} className="h-8 w-48 shrink-0" />
          </div>
        </EntryCard>
      ))}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs font-medium">Rollable Tables</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setTables([...tables, { name: "", rows: [] }])}
        >
          <Plus className="mr-1 h-4 w-4" /> Add table
        </Button>
      </div>
      {tables.map((tb, i) => (
        <RollTable
          key={i}
          table={tb}
          onChange={(next) => setTables(tables.map((x, j) => (j === i ? next : x)))}
          onDelete={() => setTables(tables.filter((_, j) => j !== i))}
        />
      ))}
      {tables.length === 0 && <p className="text-xs text-muted-foreground">No tables yet.</p>}
    </div>
  );
}

export function ExplosivesTab() {
  const { settings } = useTree();
  const periods = settings.library.timePeriods || [];
  const g = useLibList("explosives");
  return (
    <div className="space-y-2">
      <ListHeader
        onAdd={() => g.add({ name: "", period: periods[0] || "", cost: "", weight: 0, description: "" })}
        addLabel="Add explosive"
        query={g.query}
        setQuery={g.setQuery}
        searchPlaceholder="Search explosives…"
      />
      <EmptyNote items={g.items} query={g.query} />
      {g.shown.map(({ e, i }) => (
        <EntryCard key={i} entry={e} onPatch={(p) => g.patch(i, p)} onDelete={() => g.remove(i)}>
          <div className="grid grid-cols-2 gap-1.5">
            <InfoTip label="The item's display name.">
              <Input
                className="h-8"
                placeholder="Name"
                value={e.name || ""}
                onChange={(ev) => g.patch(i, { name: ev.target.value })}
              />
            </InfoTip>
            <PeriodSelect periods={periods} value={e.period} onChange={(v) => g.patch(i, { period: v })} />
            <InfoTip label="Cost and currency, e.g. 10 gp.">
              <CostField value={e.cost} onChange={(v) => g.patch(i, { cost: v })} />
            </InfoTip>
            <InfoTip label="Weight in pounds; counts toward carry capacity.">
              <Input
                className="h-8"
                type="number"
                min={0}
                placeholder="Weight (lb)"
                value={e.weight ?? 0}
                onChange={(ev) => g.patch(i, { weight: Number(ev.target.value) || 0 })}
              />
            </InfoTip>
          </div>
        </EntryCard>
      ))}
    </div>
  );
}

export function CurrencyTab() {
  const c = useLibList("currencies");
  const slug = (s) => String(s).toLowerCase().trim().replace(/\s+/g, "-") || "coin";
  return (
    <div className="space-y-2">
      <ListHeader
        onAdd={() => c.add({ name: "", key: "coin" })}
        addLabel="Add currency"
        query={c.query}
        setQuery={c.setQuery}
        searchPlaceholder="Search currencies…"
      />
      <EmptyNote items={c.items} query={c.query} />
      {c.shown.map(({ e, i }) => (
        <EntryCard key={i} entry={e} onPatch={(p) => c.patch(i, p)} onDelete={() => c.remove(i)}>
          <InfoTip label="Coin name — its stored key is set automatically when first named.">
            <Input
              className="h-8"
              placeholder="Currency name"
              value={e.name || ""}
              onChange={(ev) =>
                c.patch(i, {
                  name: ev.target.value,
                  // Keep an established coin key stable on rename so the
                  // stored amount survives; only brand-new entries get a key.
                  ...(ev.target.value && (!e.key || e.key === "coin")
                    ? { key: slug(ev.target.value) }
                    : {}),
                })
              }
            />
          </InfoTip>
        </EntryCard>
      ))}
      <p className="text-[10px] text-muted-foreground">
        These appear as coin inputs on the View sheet as they are changed. Renaming a currency
        keeps that coin's stored amount.
      </p>
    </div>
  );
}

export function TradeGoodsTab() {
  const { settings } = useTree();
  const periods = settings.library.timePeriods || [];
  const g = useLibList("tradeGoods");
  return (
    <div className="space-y-2">
      <ListHeader
        onAdd={() => g.add({ name: "", period: periods[0] || "", cost: "", description: "" })}
        addLabel="Add commodity"
        query={g.query}
        setQuery={g.setQuery}
        searchPlaceholder="Search commodities…"
      />
      <EmptyNote items={g.items} query={g.query} />
      {g.shown.map(({ e, i }) => (
        <EntryCard key={i} entry={e} onPatch={(p) => g.patch(i, p)} onDelete={() => g.remove(i)}>
          <div className="grid grid-cols-2 gap-1.5">
            <InfoTip label="Commodity name, e.g. iron ingots.">
              <Input
                className="h-8"
                placeholder="Commodity"
                value={e.name || ""}
                onChange={(ev) => g.patch(i, { name: ev.target.value })}
              />
            </InfoTip>
            <PeriodSelect periods={periods} value={e.period} onChange={(v) => g.patch(i, { period: v })} />
            <InfoTip label="Cost and currency, e.g. 10 gp.">
              <CostField value={e.cost} onChange={(v) => g.patch(i, { cost: v })} />
            </InfoTip>
          </div>
        </EntryCard>
      ))}
    </div>
  );
}

// Ammunition: arrows, bolts, bullets and the like. Purchases add the whole
// pack to the inventory as an "Ammo" item; spent one at a time on the sheet.
export function AmmoTab() {
  const g = useLibList("ammo");
  return (
    <div className="space-y-2">
      <ListHeader
        onAdd={() =>
          g.add({ name: "", damage: "", cost: "", weight: 0, packSize: 20, description: "" })
        }
        addLabel="Add ammunition"
        query={g.query}
        setQuery={g.setQuery}
        searchPlaceholder="Search ammunition…"
      />
      <EmptyNote items={g.items} query={g.query} />
      {g.shown.map(({ e, i }) => (
        <EntryCard key={i} entry={e} onPatch={(p) => g.patch(i, p)} onDelete={() => g.remove(i)}>
          <div className="grid grid-cols-2 gap-1.5">
            <InfoTip label="The ammunition's display name, e.g. Arrows.">
              <Input
                className="h-8"
                placeholder="Name"
                value={e.name || ""}
                onChange={(ev) => g.patch(i, { name: ev.target.value })}
              />
            </InfoTip>
            <InfoTip label="Damage of the weapon it serves, e.g. 1d8 piercing.">
              <Input
                className="h-8"
                placeholder="Damage"
                value={e.damage || ""}
                onChange={(ev) => g.patch(i, { damage: ev.target.value })}
              />
            </InfoTip>
            <InfoTip label="Cost and currency, e.g. 1 gp.">
              <CostField value={e.cost} onChange={(v) => g.patch(i, { cost: v })} />
            </InfoTip>
            <InfoTip label="Weight per piece in pounds; counts toward carry capacity.">
              <Input
                className="h-8"
                type="number"
                min={0}
                placeholder="Weight each (lb)"
                value={e.weight ?? 0}
                onChange={(ev) => g.patch(i, { weight: Number(ev.target.value) || 0 })}
              />
            </InfoTip>
            <InfoTip label="How many come in one purchase, e.g. 20 arrows.">
              <Input
                className="h-8"
                type="number"
                min={1}
                placeholder="Pack size"
                value={e.packSize ?? 20}
                onChange={(ev) =>
                  g.patch(i, { packSize: Math.max(1, Number(ev.target.value) || 1) })
                }
              />
            </InfoTip>
          </div>
        </EntryCard>
      ))}
    </div>
  );
}

export function PoisonsTab() {
  const { settings } = useTree();
  const lib = settings.library;
  const statuses = (lib.statusEffects || []).map((s) => s.name).filter(Boolean);
  const g = useLibList("poisons");
  return (
    <div className="space-y-2">
      <ListHeader
        onAdd={() =>
          g.add({ name: "", cost: "", dc: "", damage: "", damageType: "", status: "", duration: "", description: "" })
        }
        addLabel="Add poison"
        query={g.query}
        setQuery={g.setQuery}
        searchPlaceholder="Search poisons…"
      />
      <EmptyNote items={g.items} query={g.query} />
      {g.shown.map(({ e, i }) => (
        <EntryCard key={i} entry={e} onPatch={(p) => g.patch(i, p)} onDelete={() => g.remove(i)}>
          <div className="grid grid-cols-2 gap-1.5">
            <InfoTip label="The poison's display name.">
              <Input
                className="h-8"
                placeholder="Poison name"
                value={e.name || ""}
                onChange={(ev) => g.patch(i, { name: ev.target.value })}
              />
            </InfoTip>
            <InfoTip label="Cost and currency, e.g. 10 gp.">
              <CostField value={e.cost} onChange={(v) => g.patch(i, { cost: v })} />
            </InfoTip>
            <InfoTip label="Saving throw DC against the poison's effect, e.g. 13.">
              <Input
                className="h-8"
                type="number"
                min={1}
                placeholder="Save DC"
                value={e.dc ?? ""}
                onChange={(ev) => g.patch(i, { dc: ev.target.value === "" ? "" : Math.max(1, Number(ev.target.value)) })}
              />
            </InfoTip>
            <InfoTip label="Damage the poison deals, e.g. 2d6.">
              <Input
                className="h-8"
                placeholder="Damage (e.g. 2d6)"
                value={e.damage || ""}
                onChange={(ev) => g.patch(i, { damage: ev.target.value })}
              />
            </InfoTip>
            <InfoTip label="The poison's damage type, e.g. poison.">
              <Input
                className="h-8"
                placeholder="Damage type"
                list="poison-damage-types"
                value={e.damageType || ""}
                onChange={(ev) => g.patch(i, { damageType: ev.target.value })}
              />
            </InfoTip>
            <InfoTip label="Status effect the poison inflicts on a failed save — chosen from the Status Effects tab.">
              <Select value={e.status || "none"} onValueChange={(v) => g.patch(i, { status: v === "none" ? "" : v })}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Status inflicted" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No status</SelectItem>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </InfoTip>
            <InfoTip label="How long the effect or status lasts, e.g. 1 minute.">
              <Input
                className="h-8"
                placeholder="Duration (e.g. 1 minute)"
                value={e.duration || ""}
                onChange={(ev) => g.patch(i, { duration: ev.target.value })}
              />
            </InfoTip>
          </div>
          <datalist id="poison-damage-types">
            {(lib.damageTypes || []).map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </EntryCard>
      ))}
    </div>
  );
}