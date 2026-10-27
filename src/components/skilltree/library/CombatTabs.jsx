import { useState } from "react";
import { useTree } from "@/lib/treeStore";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useLibList,
  ListHeader,
  EmptyNote,
  EntryCard,
  PeriodSelect,
  NameList,
  CostField,
} from "./shared";
import { WondrousActions } from "./WondrousActions";
import { InfoTip } from "@/components/skilltree/InfoTip";
import { SubChips, matchesSub } from "./SubChips";

// Wondrous Items, Siege Equipment and Vehicles tabs for the Reference Library.

export function WondrousTab() {
  const { settings, setSettings } = useTree();
  const lib = settings.library;
  const w = useLibList("wondrousItems");
  const rarities = lib.rarities || [];
  const types = lib.wondrousTypes || [];
  const [raritySub, setRaritySub] = useState("__all__");
  const setLib = (patch) => setSettings((s) => ({ ...s, library: { ...s.library, ...patch } }));
  return (
    <div className="space-y-2">
      <SubChips values={rarities} value={raritySub} onChange={setRaritySub} />
      <ListHeader
        onAdd={() =>
          w.add({
            name: "",
            rarity: "Common",
            itemType: "Wondrous Item",
            uses: "",
            recharge: "",
            consumable: false,
            cost: "",
            link: "",
            description: "",
          })
        }
        addLabel="Add wondrous item"
        query={w.query}
        setQuery={w.setQuery}
        searchPlaceholder="Search wondrous items…"
      />
      <EmptyNote items={w.items} query={w.query} />
      {w.shown
        .filter(({ e }) => matchesSub(e.rarity, raritySub))
        .map(({ e, i }) => (
        <EntryCard key={i} entry={e} onPatch={(p) => w.patch(i, p)} onDelete={() => w.remove(i)}>
          <div className="grid grid-cols-2 gap-1.5">
            <InfoTip label="The item's display name.">
              <Input
                className="h-8"
                placeholder="Name"
                value={e.name || ""}
                onChange={(ev) => w.patch(i, { name: ev.target.value })}
              />
            </InfoTip>
            <Select value={e.rarity || "Common"} onValueChange={(v) => w.patch(i, { rarity: v })}>
              <InfoTip label="Item rarity — edit the list of rarities below.">
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Rarity" />
                </SelectTrigger>
              </InfoTip>
              <SelectContent>
                {rarities.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={e.itemType || "Wondrous Item"} onValueChange={(v) => w.patch(i, { itemType: v })}>
              <InfoTip label="Item type, e.g. Wondrous Item, Weapon, Armor.">
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Item type" />
                </SelectTrigger>
              </InfoTip>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <InfoTip label="Cost and currency, e.g. 5,000 gp.">
              <CostField value={e.cost} onChange={(v) => w.patch(i, { cost: v })} />
            </InfoTip>
            <InfoTip label="Total charges; the item's actions spend from this pool.">
              <Input
                className="h-8"
                type="number"
                min={0}
                placeholder="Uses / charges"
                value={e.uses ?? ""}
                onChange={(ev) => w.patch(i, { uses: ev.target.value === "" ? "" : Number(ev.target.value) })}
              />
            </InfoTip>
            <InfoTip label="When charges replenish, e.g. dawn or long rest.">
              <Input
                className="h-8"
                placeholder="Recharge time (e.g. dawn, long rest)"
                value={e.recharge ?? ""}
                onChange={(ev) => w.patch(i, { recharge: ev.target.value })}
              />
            </InfoTip>
            <InfoTip label="Adds to the spell attack bonus while the item is equipped or carried.">
              <Input
                className="h-8"
                type="number"
                placeholder="Spell attack bonus"
                value={e.spellAttackBonus ?? ""}
                onChange={(ev) => w.patch(i, { spellAttackBonus: Number(ev.target.value) || 0 })}
              />
            </InfoTip>
            <InfoTip label="Adds to the spell save DC while the item is equipped or carried.">
              <Input
                className="h-8"
                type="number"
                placeholder="Save DC bonus"
                value={e.saveDCBonus ?? ""}
                onChange={(ev) => w.patch(i, { saveDCBonus: Number(ev.target.value) || 0 })}
              />
            </InfoTip>
            <label className="flex items-center gap-1.5 text-xs">
              <InfoTip label="Single-use item: consumed when its charges run out.">
                <Switch
                  checked={!!e.consumable}
                  onCheckedChange={(v) => w.patch(i, { consumable: v })}
                />
              </InfoTip>
              Consumable
            </label>
            {(e.itemType === "Weapon" || e.itemType === "Armor") && (
              <Select
                value={e.link || "any"}
                onValueChange={(v) => w.patch(i, { link: v === "any" ? "" : v })}
              >
                <InfoTip label="Pin this entry to a specific weapon or armor, or choose Any.">
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Specific item" />
                  </SelectTrigger>
                </InfoTip>
                <SelectContent>
                  <SelectItem value="any">Any — set later in View</SelectItem>
                  {(e.itemType === "Weapon" ? lib.weapons || [] : lib.armor || []).map(
                    (it) =>
                      it.name && (
                        <SelectItem key={it.name + i} value={it.name}>
                          {it.name}
                        </SelectItem>
                      )
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
          <WondrousActions item={e} onPatch={(p) => w.patch(i, p)} />
        </EntryCard>
      ))}
      <NameList
        label="Rarities"
        entries={rarities}
        onChange={(n) => setLib({ rarities: n })}
        placeholder="Rarity"
      />
    </div>
  );
}

export function SiegeTab() {
  const { settings } = useTree();
  const periods = settings.library.timePeriods || [];
  const g = useLibList("siege");
  return (
    <div className="space-y-2">
      <ListHeader
        onAdd={() =>
          g.add({ name: "", period: periods[0] || "", size: "", ac: "", hp: "", immunities: "", action: "", description: "" })
        }
        addLabel="Add siege equipment"
        query={g.query}
        setQuery={g.setQuery}
        searchPlaceholder="Search siege equipment…"
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
            <InfoTip label="Creature size, e.g. Huge.">
              <Input
                className="h-8"
                placeholder="Size"
                value={e.size || ""}
                onChange={(ev) => g.patch(i, { size: ev.target.value })}
              />
            </InfoTip>
            <InfoTip label="Armor Class of the equipment.">
              <Input
                className="h-8"
                type="number"
                min={0}
                placeholder="Armor Class"
                value={e.ac ?? ""}
                onChange={(ev) => g.patch(i, { ac: ev.target.value })}
              />
            </InfoTip>
            <InfoTip label="Hit points of the equipment.">
              <Input
                className="h-8"
                type="number"
                min={0}
                placeholder="Hit Points"
                value={e.hp ?? ""}
                onChange={(ev) => g.patch(i, { hp: ev.target.value })}
              />
            </InfoTip>
            <InfoTip label="Damage types it is immune to, comma separated.">
              <Input
                className="h-8"
                placeholder="Damage immunities"
                value={e.immunities || ""}
                onChange={(ev) => g.patch(i, { immunities: ev.target.value })}
              />
            </InfoTip>
            <InfoTip label="The attack or action it performs in combat.">
              <Input
                className="h-8 col-span-2"
                placeholder="Attack / action it performs"
                value={e.action || ""}
                onChange={(ev) => g.patch(i, { action: ev.target.value })}
              />
            </InfoTip>
          </div>
        </EntryCard>
      ))}
      <p className="text-[10px] text-muted-foreground">
        Siege Equipment does not count toward a character's carried weight.
      </p>
    </div>
  );
}

export function VehiclesTab() {
  const { settings, setSettings } = useTree();
  const periods = settings.library.timePeriods || [];
  const g = useLibList("vehicles");
  // Land, Sea, Sky, Space by default (editable list below); saved categories
  // on older entries stay available.
  const categories = [
    ...new Set([
      ...(settings.library.vehicleCategories || []),
      ...(settings.library.vehicles || []).map((v) => v.category).filter(Boolean),
    ]),
  ];
  const [vehSub, setVehSub] = useState("__all__");
  const setCategories = (next) =>
    setSettings((s) => ({ ...s, library: { ...s.library, vehicleCategories: next } }));
  return (
    <div className="space-y-2">
      <SubChips values={categories} value={vehSub} onChange={setVehSub} />
      <ListHeader
        onAdd={() =>
          g.add({ name: "", period: periods[0] || "", category: "", classification: "", cost: "", speed: "", carry: 0, weight: 0, size: "", description: "" })
        }
        addLabel="Add vehicle"
        query={g.query}
        setQuery={g.setQuery}
        searchPlaceholder="Search vehicles…"
      />
      <EmptyNote items={g.items} query={g.query} />
      {g.shown
        .filter(({ e }) => matchesSub(e.category, vehSub))
        .map(({ e, i }) => (
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
            <InfoTip label="Vehicle category — Land, Sea, Sky or Space by default (edit the list below).">
              <Select value={e.category || "__none__"} onValueChange={(v) => g.patch(i, { category: v === "__none__" ? "" : v })}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Uncategorized</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </InfoTip>
            <InfoTip label="Classification within the category, e.g. Galley.">
              <Input
                className="h-8"
                placeholder="Classification"
                value={e.classification || ""}
                onChange={(ev) => g.patch(i, { classification: ev.target.value })}
              />
            </InfoTip>
            <InfoTip label="Cost, e.g. 5,000 gp.">
              <Input
                className="h-8"
                placeholder="Cost"
                value={e.cost ?? ""}
                onChange={(ev) => g.patch(i, { cost: ev.target.value })}
              />
            </InfoTip>
            <InfoTip label="Movement speed, e.g. 30 ft.">
              <Input
                className="h-8"
                placeholder="Speed (e.g. 30 ft.)"
                value={e.speed || ""}
                onChange={(ev) => g.patch(i, { speed: ev.target.value })}
              />
            </InfoTip>
            <InfoTip label="How much weight it can carry, in pounds.">
              <Input
                className="h-8"
                type="number"
                min={0}
                placeholder="Carry capacity (lb)"
                value={e.carry ?? 0}
                onChange={(ev) => g.patch(i, { carry: Number(ev.target.value) || 0 })}
              />
            </InfoTip>
            <InfoTip label="Weight in pounds; does not count toward carried weight.">
              <Input
                className="h-8"
                type="number"
                min={0}
                placeholder="Weight (lb)"
                value={e.weight ?? 0}
                onChange={(ev) => g.patch(i, { weight: Number(ev.target.value) || 0 })}
              />
            </InfoTip>
            <InfoTip label="Creature size, e.g. Huge.">
              <Input
                className="h-8"
                placeholder="Size"
                value={e.size || ""}
                onChange={(ev) => g.patch(i, { size: ev.target.value })}
              />
            </InfoTip>
          </div>
        </EntryCard>
      ))}
      <p className="text-[10px] text-muted-foreground">
        Vehicles do not count toward a character's carried weight.
      </p>
      <NameList
        label="Vehicle Categories"
        entries={settings.library.vehicleCategories || []}
        onChange={setCategories}
        placeholder="Category (e.g. Land)"
      />
    </div>
  );
}