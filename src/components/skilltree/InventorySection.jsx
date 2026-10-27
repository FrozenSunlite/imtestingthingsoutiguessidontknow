import { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useTree, carryCapacity, totalCoins } from "@/lib/treeStore";
import { CapacityBar } from "@/components/skilltree/CapacityBar";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Archive, Box, ChevronDown, GripVertical, Plus, X, Minus } from "lucide-react";
import { WeaponUpgradesSection } from "./WeaponUpgradesSection";

const DEFAULT_CURRENCIES = [
  { key: "copper", name: "Copper" },
  { key: "silver", name: "Silver" },
  { key: "gold", name: "Gold" },
  { key: "electrum", name: "Electrum" },
  { key: "platinum", name: "Platinum" },
];

const TAGS = ["Mundane", "Magical"];
const RARITIES = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary"];
const TYPES = ["Armor", "Weapon", "Item", "Trinket", "Ammo", "Special", "Other"];

// Where an item sits: equipped/worn on the body, carried on the person, or
// stored in a chest. Anything not tagged defaults to carried (older saves).
const itemLoc = (it) =>
  it.location === "equipped" || it.location === "storage" ? it.location : "carried";

export function InventorySection() {
  const { mergedTree: tree, character, setCharacter, settings } = useTree();
  const currencies = (settings?.library?.currencies || []).length
    ? settings.library.currencies
    : DEFAULT_CURRENCIES;
  const coins = character.coins || {};
  const items = character.inventory || [];
  const chests = character.chests || [];
  const wondrousLib = (settings?.library?.wondrousItems || []).filter((w) => w.name);
  const ammoLib = (settings?.library?.ammo || []).filter((a) => a.name);
  const setCoins = (patch) => setCharacter({ ...character, coins: { ...coins, ...patch } });
  const [expanded, setExpanded] = useState({});
  const [newChest, setNewChest] = useState("");

  // Only equipped/worn and carried items count toward carried weight —
  // items in storage or chests stay behind.
  const coinWeight = Math.floor(totalCoins(coins) / 50);
  const itemWeight = items
    .filter((it) => itemLoc(it) !== "storage")
    .reduce((a, i) => a + (Number(i.weight) || 0) * (Number(i.qty) || 1), 0);
  const carried = itemWeight + coinWeight;
  const capacity = carryCapacity(character, tree);

  const setInventory = (next) => setCharacter({ ...character, inventory: next });
  const patchItem = (i, p) => {
    const next = [...items];
    next[i] = { ...next[i], ...p };
    setInventory(next);
  };
  const removeItem = (i) => setInventory(items.filter((_, j) => j !== i));
  const addItem = (extra) =>
    setInventory([
      ...items,
      {
        name: "",
        qty: 1,
        weight: 0,
        tag: "Mundane",
        rarity: "Common",
        type: "Item",
        description: "",
        location: "carried",
        ...extra,
      },
    ]);

  const setChests = (next) => setCharacter({ ...character, chests: next });
  const addChest = () => {
    const name = newChest.trim() || `Chest ${chests.length + 1}`;
    if (chests.includes(name)) return;
    setChests([...chests, name]);
    setNewChest("");
  };
  // Deleting a chest sends its items back to being carried.
  const removeChest = (name) => {
    setInventory(
      items.map((it) =>
        itemLoc(it) === "storage" && it.chest === name
          ? { ...it, location: "carried", chest: undefined }
          : it
      )
    );
    setChests(chests.filter((c) => c !== name));
  };

  // Drag & drop only moves items between zones; ordering stays as entered.
  const onDragEnd = (result) => {
    if (!result.destination) return;
    const dst = result.destination.droppableId;
    const idx = Number(result.draggableId);
    if (!Number.isInteger(idx) || !items[idx]) return;
    if (dst === "equipped") patchItem(idx, { location: "equipped", chest: undefined });
    else if (dst === "carried") patchItem(idx, { location: "carried", chest: undefined });
    else if (dst.startsWith("chest:"))
      patchItem(idx, { location: "storage", chest: dst.slice("chest:".length) });
  };

  const inZone = (loc) =>
    items.map((it, i) => ({ it, i })).filter(({ it }) => itemLoc(it) === loc);
  const inChest = (name) =>
    items
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => itemLoc(it) === "storage" && it.chest === name);

  const renderItem = (it, i, k) => (
    <Draggable draggableId={String(i)} index={k} key={i}>
      {(prov) => (
        <div
          ref={prov.innerRef}
          {...prov.draggableProps}
          className="rounded-md border bg-card p-1.5"
        >
          <div className="flex items-center gap-1" {...prov.dragHandleProps}>
            <GripVertical
              className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground"
              title="Drag to another section"
            />
            <button
              className="text-muted-foreground hover:text-foreground"
              title="Toggle edit fields"
              onClick={() => setExpanded((e) => ({ ...e, [i]: !e[i] }))}
            >
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", expanded[i] ? "" : "-rotate-90")}
              />
            </button>
            <span className="flex-1 truncate text-xs font-medium">
              {it.name || "Unnamed item"}
            </span>
            {it.type === "Ammo" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                title="Use one"
                disabled={(Number(it.qty) || 0) <= 0}
                onClick={() => patchItem(i, { qty: Math.max(0, (Number(it.qty) || 0) - 1) })}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
            )}
            <span className="shrink-0 text-[10px] text-muted-foreground">×{it.qty ?? 1}</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              title="Remove item"
              onClick={() => removeItem(i)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          {expanded[i] && (
            <div className="mt-1 space-y-1 border-t pt-1.5">
              <div className="flex flex-wrap items-center gap-1">
                <Input
                  className="h-8 min-w-24 flex-1"
                  placeholder="Item name"
                  value={it.name || ""}
                  onChange={(e) => patchItem(i, { name: e.target.value })}
                />
                <Input
                  type="number"
                  min={1}
                  className="h-8 w-14"
                  title="Quantity"
                  value={it.qty ?? 1}
                  onChange={(e) => patchItem(i, { qty: Math.max(1, Number(e.target.value) || 1) })}
                />
                <Input
                  type="number"
                  min={0}
                  className="h-8 w-16"
                  title="Weight each (lb)"
                  value={it.weight ?? 0}
                  onChange={(e) => patchItem(i, { weight: Number(e.target.value) || 0 })}
                />
                <Select value={it.tag || "Mundane"} onValueChange={(v) => patchItem(i, { tag: v })}>
                  <SelectTrigger className="h-8 w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAGS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={it.rarity || "Common"}
                  onValueChange={(v) => patchItem(i, { rarity: v })}
                >
                  <SelectTrigger className="h-8 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RARITIES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={it.type || "Item"} onValueChange={(v) => patchItem(i, { type: v })}>
                  <SelectTrigger className="h-8 w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                className="h-8"
                placeholder="Description"
                value={it.description || ""}
                onChange={(e) => patchItem(i, { description: e.target.value })}
              />
              {it.chargesMax !== "" && it.chargesMax != null && (
                <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  Charges
                  <Input
                    type="number"
                    min={0}
                    className="h-7 w-16"
                    value={it.chargesCurrent ?? it.chargesMax}
                    onChange={(e) =>
                      patchItem(i, { chargesCurrent: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                  / {it.chargesMax}
                  {it.recharge ? ` · recharges: ${it.recharge}` : ""}
                </label>
              )}
              {it.type === "Special" && (
                <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                  <span title="Applies while the item is equipped or carried">
                    Wondrous bonuses
                  </span>
                  <Input
                    type="number"
                    className="h-7 w-16"
                    title="Adds to the spell attack bonus (equipped or carried)"
                    placeholder="Atk +"
                    value={it.spellAttackBonus ?? 0}
                    onChange={(e) => patchItem(i, { spellAttackBonus: Number(e.target.value) || 0 })}
                  />
                  <Input
                    type="number"
                    className="h-7 w-16"
                    title="Adds to the spell save DC (equipped or carried)"
                    placeholder="DC +"
                    value={it.saveDCBonus ?? 0}
                    onChange={(e) => patchItem(i, { saveDCBonus: Number(e.target.value) || 0 })}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );

  const zone = (id, title, hint, extra) => (
    <div className="rounded-md border p-2">
      <div className="flex items-center gap-1">
        <span className="flex-1 truncate text-xs font-medium">{title}</span>
        {extra}
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>
      <Droppable droppableId={id}>
        {(prov) => (
          <div
            ref={prov.innerRef}
            {...prov.droppableProps}
            className="mt-1 min-h-20 space-y-1.5 rounded border border-dashed p-1.5"
          >
            {inZone(id).map(({ it, i }, k) => renderItem(it, i, k))}
            {prov.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );

  return (
    <div className="space-y-2">
      <Label>Inventory & Coins</Label>

      {/* Weapon Upgrades: apply library upgrades to a weapon's damage/abilities */}
      {(settings?.library?.weaponUpgrades || []).length > 0 && <WeaponUpgradesSection />}


      <div className="flex flex-wrap items-center gap-1.5 rounded-md border p-2">
        {currencies.map((c) => {
          const key = c.key || String(c.name || "").toLowerCase();
          return (
            <label
              key={key}
              className="flex items-center gap-1 text-[10px] text-muted-foreground"
            >
              {c.name || key}
              <Input
                type="number"
                min={0}
                className="h-7 w-16"
                value={coins[key] ?? 0}
                onChange={(e) => setCoins({ [key]: Math.max(0, Number(e.target.value) || 0) })}
              />
            </label>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Every 50 coins weigh 1 lb. Coins now weigh {coinWeight} lb.
      </p>

      {(wondrousLib.length > 0 || ammoLib.length > 0) && (
        <div className="flex flex-wrap gap-1">
          {wondrousLib.length > 0 && (
            <Select
              value=""
              onValueChange={(name) => {
                const src = wondrousLib.find((w) => w.name === name);
                if (!src) return;
                const hasCharges = src.uses !== "" && src.uses != null;
                addItem({
                  name: src.name,
                  tag: "Magical",
                  rarity: src.rarity || "Common",
                  type: "Special",
                  description: src.description || "",
                  itemActions: (src.itemActions || []).map((a) => ({ ...a })),
                  chargesMax: hasCharges ? Number(src.uses) : "",
                  chargesCurrent: hasCharges ? Number(src.uses) : "",
                  recharge: src.recharge || "",
                  spellAttackBonus: Number(src.spellAttackBonus) || 0,
                  saveDCBonus: Number(src.saveDCBonus) || 0,
                });
              }}
            >
              <SelectTrigger className="h-8 w-48">
                <SelectValue placeholder="Add wondrous item…" />
              </SelectTrigger>
              <SelectContent>
                {wondrousLib.map((w) => (
                  <SelectItem key={w.name} value={w.name}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {ammoLib.length > 0 && (
            <Select
              value=""
              onValueChange={(name) => {
                const src = ammoLib.find((a) => a.name === name);
                if (!src) return;
                addItem({
                  name: src.name,
                  qty: Math.max(1, Number(src.packSize) || 1),
                  weight: Number(src.weight) || 0,
                  type: "Ammo",
                  description: src.description || "",
                });
              }}
            >
              <SelectTrigger className="h-8 w-48">
                <SelectValue placeholder="Add ammunition…" />
              </SelectTrigger>
              <SelectContent>
                {ammoLib.map((a) => (
                  <SelectItem key={a.name} value={a.name}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {zone(
            "equipped",
            "Equipped / Worn",
            "Items currently worn or wielded.",
            null
          )}
          {zone(
            "carried",
            "Carried",
            "On your person but not equipped.",
            <Button size="sm" variant="ghost" className="h-6 p-1" title="Add item" onClick={() => addItem({})}>
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Storage: owned items kept in chests the character owns. */}
        <div className="rounded-md border p-2">
          <div className="flex items-center gap-1">
            <Archive className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1 text-xs font-medium">Storage</span>
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Owned items in chests — not carried, so they don't count toward weight.
          </p>
          <div className="mt-1 flex items-center gap-1">
            <Input
              className="h-7 flex-1"
              placeholder="New chest name"
              value={newChest}
              onChange={(e) => setNewChest(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addChest();
              }}
            />
            <Button size="sm" variant="outline" className="h-7" onClick={addChest}>
              <Plus className="h-3.5 w-3.5" /> Add chest
            </Button>
          </div>
          {chests.length === 0 && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              Create chests and drag items into them from Carried.
            </p>
          )}
          {chests.map((name) => (
            <div key={name} className="mt-2 rounded-md border bg-muted/30 p-1.5">
              <div className="flex items-center gap-1">
                <Box className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="flex-1 truncate text-xs font-medium">{name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {inChest(name).length} item{inChest(name).length === 1 ? "" : "s"}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  title="Remove chest — its items move to Carried"
                  onClick={() => removeChest(name)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Droppable droppableId={`chest:${name}`}>
                {(prov) => (
                  <div
                    ref={prov.innerRef}
                    {...prov.droppableProps}
                    className="mt-1 min-h-16 space-y-1.5 rounded border border-dashed p-1.5"
                  >
                    {inChest(name).map(({ it, i }, k) => renderItem(it, i, k))}
                    {prov.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      <div className="space-y-1.5 rounded-md bg-muted/50 px-2 py-1.5 text-xs">
        <div>
          <span className="text-muted-foreground">Currently carried:</span>{" "}
          <span className="font-mono font-medium">{carried.toLocaleString()} lb</span>{" "}
          <span className="text-muted-foreground">
            / {capacity.toLocaleString()} lb capacity
          </span>
        </div>
        <CapacityBar character={character} tree={tree} carried={carried} capacity={capacity} />
        <div className="text-[10px] text-muted-foreground">
          Light: {Math.floor(capacity / 3).toLocaleString()} · Heavy:{" "}
          {Math.floor((capacity * 2) / 3).toLocaleString()} · Max: {capacity.toLocaleString()} lb
          · Storage items don't count.
        </div>
      </div>
    </div>
  );
}