import { useEffect, useState } from "react";
import { useTree } from "@/lib/treeStore";
import { matchesQuery } from "@/lib/textSearch";
import { AbilityList } from "@/components/skilltree/library/shared";
import { ShopTab } from "@/components/skilltree/library/ShopTab";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { InfoTip } from "./InfoTip";
import { NameList } from "./library/shared";
import { parseArmorAC } from "@/lib/resources";

const STATS_LIST = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
import {
  AdventuringGearTab,
  AmmoTab,
  TrinketsTab,
  ExplosivesTab,
  CurrencyTab,
  TradeGoodsTab,
  PoisonsTab,
} from "./library/GearTabs";
import { RollTablesTab } from "./library/RollTablesTab";
import { LootTablesTab } from "./library/LootTablesTab";
import { LootPoolsTab } from "./library/LootPoolsTab";
import { EncounterTablesTab } from "./library/EncounterTablesTab";
import { DowntimeTab } from "./library/DowntimeTab";
import { SubChips, matchesSub } from "./library/SubChips";
import { DamageTypesTab, GearCategoriesTab, LanguagesTab } from "./library/ReferenceTabs";
import { CostField } from "./library/shared";
import { WondrousTab, SiegeTab, VehiclesTab } from "./library/CombatTabs";
import { WeaponPropertiesTab } from "./library/WeaponPropertiesTab";
import { WeaponMasteriesTab } from "./library/WeaponMasteriesTab";
import { benefitDragProps } from "@/lib/benefits";
import { LevelsTab } from "./library/LevelsTab";
import { PointTypesTab } from "./library/PointTypesTab";
import { NodeTypesTab } from "./library/NodeTypesTab";
import { CreatureTypesTab } from "./library/CreatureTypesTab";
import { SpeedTypesTab, SensesLibraryTab } from "./library/SpeedSensesTabs";
import { ResourcesTab } from "./library/ResourcesTab";
import { DieScalingTab } from "./library/DieScalingTab";
import { DungeonRoomsTab } from "./library/DungeonRoomsTab";
import { FiveEToolsImportsTab } from "./library/FiveEToolsImportsTab";
import { MediaTab } from "./library/MediaTab";
import { FiveEToolsCategoryTab } from "./library/FiveEToolsCategoryTab";
import { FIVE_CATEGORIES } from "@/lib/fiveETools";
import { EncounterXpCalculator } from "./library/EncounterXpCalculator";
import { ActionsTab } from "./library/ActionsTab";
import { SpellsTab } from "./library/SpellsTab";
import { SpellSchoolsTab } from "./library/SpellSchoolsTab";
import { TriggersTab } from "./library/TriggersTab";
import { StatusEffectsTab } from "./library/StatusEffectsTab";
import { MonstersTab } from "./library/MonstersTab";
import { UpgradesTab } from "./library/UpgradesTab";

const DEDICATED_IMPORTED = new Set([
  "backgrounds",
  "species",
  "deities",
  "objects",
  "traps",
  "books",
]);

const importedCategoryLabel = (id) =>
  FIVE_CATEGORIES.find((category) => category.id === id)?.label ||
  id
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]+/g, " ")
    .replace(/^./, (char) => char.toUpperCase());

const DIE_SIZES = ["d4", "d6", "d8", "d10", "d12", "d20"];

// Tabs grouped into themed sections instead of one flat list.
const TAB_GROUPS = [
  ["Character & Progression", [
    ["levels", "Levels"], ["pointTypes", "Point Types"], ["nodeTypes", "Node Types"],
    ["attributes", "Attributes"], ["skills", "Skills"], ["tools", "Tools"],
    ["languages", "Languages"], ["speedTypes", "Speed Types"], ["senses", "Senses"],
    ["resources", "Resources"], ["dieScaling", "Die Scaling"],
  ]],
  ["Lore & Creatures", [
    ["backgrounds", "Backgrounds"], ["species", "Species"], ["deities", "Deities"],
    ["objects", "Objects"], ["traps", "Traps & Hazards"],
  ]],
  ["Combat", [
    ["weapons", "Weapons"], ["weaponUpgrades", "Weapon Upgrades"], ["armor", "Armor"],
    ["categories", "Categories"],
    ["properties", "Weapon Properties"], ["weaponMasteries", "Weapon Masteries"],
    ["damageTypes", "Damage Types"],
    ["types", "Creature Types"], ["monsters", "Monsters"], ["actions", "Actions"],
    ["downtime", "Downtime Actions"],
    ["triggers", "Triggers"], ["statusEffects", "Status Effects"],
  ]],
  ["Spellcasting", [["spells", "Spells"], ["spellSchools", "Spell Schools"]]],
  ["Gear & Equipment", [
    ["gear", "Adventuring Gear"], ["gearCategories", "Gear Categories"],
    ["ammo", "Ammunition"], ["trinkets", "Trinkets"], ["explosives", "Explosives"],
    ["wondrous", "Wondrous Items"], ["siege", "Siege Equipment"], ["vehicles", "Vehicles"],
    ["currency", "Currency"], ["trade", "Trade Goods"], ["poisons", "Poisons"],
  ]],
  ["Economy & Tables", [
    ["shop", "Shop"], ["rollTables", "Roll Tables"], ["lootTables", "Loot Tables"],
    ["lootPools", "Loot Pools"], ["encounterTables", "Encounter Tables"],
    ["encounterCalc", "Encounter XP"],
  ]],
  ["Dungeons", [["dungeonRooms", "Dungeon Rooms"]]],
  ["Imported", [["fiveETools", "5eTools Imports"]]],
  ["Project", [["media", "Project Media"]]],
];

// Every searchable library list, as [category label, tab value, entries].
const SEARCH_CATEGORIES = (lib) => [
  ["Actions", "actions", lib.actions || []],
  ["Spells", "spells", lib.spells || []],
  ["Triggers", "triggers", (lib.triggers || []).map((n) => ({ name: n }))],
  ["Status Effects", "statusEffects", lib.statusEffects || []],
  ["Weapons", "weapons", lib.weapons || []],
  ["Weapon Upgrades", "weaponUpgrades", lib.weaponUpgrades || []],
  ["Armor", "armor", lib.armor || []],
  ["Wondrous Items", "wondrous", lib.wondrousItems || []],
  ["Damage Types", "damageTypes", (lib.damageTypes || []).map((n) => ({ name: n }))],
  ["Gear Categories", "gearCategories", (lib.adventureGearCategories || []).map((n) => ({ name: n }))],
  ["Roll Tables", "rollTables", (lib.rollTables || []).map((t) => ({ name: t?.name }))],
  ["Loot Tables", "lootTables", (lib.lootTables || []).map((t) => ({ name: t?.name }))],
  ["Loot Pools", "lootPools", (lib.lootPools || []).map((t) => ({ name: t?.name }))],
  ["Encounter Tables", "encounterTables", (lib.encounterTables || []).map((t) => ({ name: t?.name }))],
  ["Downtime Actions", "downtime", lib.downtimeActions || []],
  ["Adventuring Gear", "gear", lib.adventuringGear || []],
  ["Trinkets", "trinkets", lib.trinkets || []],
  ["Explosives", "explosives", lib.explosives || []],
  ["Ammunition", "ammo", lib.ammo || []],
  ["Currency", "currency", lib.currencies || []],
  ["Trade Goods", "trade", lib.tradeGoods || []],
  ["Poisons", "poisons", lib.poisons || []],
  ["Siege Equipment", "siege", lib.siege || []],
  ["Vehicles", "vehicles", lib.vehicles || []],
  ["Creature Types", "types", (lib.creatureTypes || []).map((n) => ({ name: n }))],
  ["Speed Types", "speedTypes", (lib.speedTypes || []).map((n) => ({ name: n?.name || n }))],
  ["Senses", "senses", (lib.senses || []).map((n) => ({ name: n?.name || n }))],
  ["Resources", "resources", lib.resources || []],
  ["Die Scaling", "dieScaling", (lib.dieScaling || []).map((n) => ({ name: n?.name || n }))],
  ["Dungeon Rooms", "dungeonRooms", lib.dungeonRooms || []],
  ["Monsters", "monsters", lib.monsters || []],
  ["Monster Templates", "monsters", lib.monsterTemplates || []],
  ["Backgrounds", "backgrounds", lib.fiveETools?.backgrounds || []],
  ["Species", "species", lib.fiveETools?.species || []],
  ["Deities", "deities", lib.fiveETools?.deities || []],
  ["Objects", "objects", lib.fiveETools?.objects || []],
  ["Traps & Hazards", "traps", lib.fiveETools?.traps || []],
  ["Spell Schools", "spellSchools", (lib.spellSchools || []).map((n) => ({ name: n }))],
  ["Spell Subschools", "spellSchools", (lib.spellSubschools || []).map((s) => ({ name: s?.name }))],
  ["Attributes", "attributes", (lib.attributes || []).map((n) => ({ name: n }))],
  ["Weapon Properties", "properties", (lib.properties || []).map((n) => ({ name: n }))],
  ["Weapon Masteries", "weaponMasteries", (lib.weaponMasteries || []).map((m) => ({ name: m.name || m }))],
  ["Shop", "shop", lib.shop || []],
  ["Skills", "skills", (lib.lists?.skills || []).map((n) => (typeof n === "string" ? { name: n } : n))],
  ["Languages", "languages", (lib.lists?.languages || []).map((n) => ({ name: n }))],
  ["Tools", "tools",
    [...(lib.lists?.artisanTools || []), ...(lib.lists?.miscTools || [])]
      .map((n) => (typeof n === "string" ? { name: n } : n))
      .filter((n) => n?.name),
  ],
];

export function LibraryMenu({ open, onClose }) {
  const { settings, setSettings } = useTree();
  const [weaponQuery, setWeaponQuery] = useState("");
  const [weaponSub, setWeaponSub] = useState("__all__");
  const [armorQuery, setArmorQuery] = useState("");
  const [armorSub, setArmorSub] = useState("__all__");
  const [tab, setTab] = useState("weapons");
  const [navOpen, setNavOpen] = useState(true);
  const [search, setSearch] = useState("");
  useEffect(() => {
    const onTab = (event) => {
      const next = event?.detail?.tab;
      if (next) setTab(next);
    };
    window.addEventListener("skilltree:open-library-tab", onTab);
    return () => window.removeEventListener("skilltree:open-library-tab", onTab);
  }, []);
  if (!settings) return null;
  const lib = settings.library;
  const importedTabs = Object.keys(lib.fiveETools || {})
    .filter(
      (key) =>
        Array.isArray(lib.fiveETools[key]) &&
        lib.fiveETools[key].length &&
        !DEDICATED_IMPORTED.has(key)
    )
    .sort((a, b) =>
      importedCategoryLabel(a).localeCompare(importedCategoryLabel(b))
    )
    .map((key) => [`imported:${key}`, importedCategoryLabel(key)]);
  const tabGroups = importedTabs.length
    ? [...TAB_GROUPS, ["Imported 5eTools", importedTabs]]
    : TAB_GROUPS;
  const setLib = (patch) => setSettings((s) => ({ ...s, library: { ...s.library, ...patch } }));
  const setList = (key, next) => setLib({ lists: { ...lib.lists, [key]: next } });

  // Global search: matches grouped by library category; a click opens its tab.
  const q = search.trim();
  const searchCategories = [
    ...SEARCH_CATEGORIES(lib),
    ...importedTabs.map(([value, label]) => [
      label,
      value,
      lib.fiveETools?.[value.slice("imported:".length)] || [],
    ]),
  ];
  const results = q
    ? searchCategories
        .map(([cat, tabValue, entries]) => ({
          cat,
          tabValue,
          hits: entries
            .filter((e) => matchesQuery(e?.name, q))
            .slice(0, 8),
        }))
        .filter((g) => g.hits.length)
    : [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()} modal={false}>
      <DialogContent
        hideOverlay
        className="left-2 top-2 max-h-[calc(100vh-1rem)] w-[min(60rem,calc(100vw-1rem))] translate-x-0 translate-y-0 overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Reference Library</DialogTitle>
          <DialogDescription>
            Weapons, armor, gear and lists used as suggestions when a node grants a proficiency.
          </DialogDescription>
        </DialogHeader>

        <InfoTip label="Search every tab; click a result to jump to it.">
          <Input
            className="h-8"
            placeholder="Search the whole library…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InfoTip>

        <Tabs
          value={tab}
          onValueChange={setTab}
          orientation="vertical"
          className="flex flex-col gap-3 md:flex-row"
        >
          {navOpen && (
            <div className="flex w-full shrink-0 flex-col gap-1 md:w-48">
              <TabsList className="flex h-[55vh] w-full flex-col items-stretch justify-start gap-0.5 overflow-y-auto rounded-md border p-1">
                {tabGroups.map(([groupLabel, entries]) => (
                  <div key={groupLabel} className="w-full">
                    <div className="px-2 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {groupLabel}
                    </div>
                    {entries.map(([value, entryLabel]) => (
                      <TabsTrigger
                        key={value}
                        value={value}
                        className="ml-1 w-full justify-start py-1 pl-5 pr-2 text-left text-xs"
                      >
                        {entryLabel}
                      </TabsTrigger>
                    ))}
                  </div>
                ))}
              </TabsList>
              <Button
                size="sm"
                variant="ghost"
                className="justify-start text-xs"
                onClick={() => setNavOpen(false)}
              >
                Hide categories
              </Button>
            </div>
          )}
          <div className="min-w-0 flex-1">
            {!navOpen && (
              <Button
                size="sm"
                variant="outline"
                className="mb-2"
                onClick={() => setNavOpen(true)}
              >
                Show categories
              </Button>
            )}
            {q ? (
            <div className="max-h-[50vh] space-y-2 overflow-y-auto pt-3">
              {results.length === 0 && (
                <p className="text-xs text-muted-foreground">No matches.</p>
              )}
              {results.map((g) => (
                <div key={g.cat}>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {g.cat}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {g.hits.map((h) => (
                      <button
                        key={h.name}
                        onClick={() => {
                          setTab(g.tabValue);
                          setSearch("");
                        }}
                        className="rounded border px-2 py-0.5 text-xs hover:bg-accent"
                      >
                        {h.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <div className="max-h-[50vh] overflow-y-auto pt-3">
            <TabsContent value="types" className="mt-0 space-y-2">
              <CreatureTypesTab />
            </TabsContent>
            <TabsContent value="monsters" className="mt-0 space-y-2">
              <MonstersTab />
            </TabsContent>
            <TabsContent value="actions" className="mt-0 space-y-2">
              <ActionsTab />
            </TabsContent>
            <TabsContent value="spells" className="mt-0 space-y-2">
              <SpellsTab />
            </TabsContent>
            <TabsContent value="spellSchools" className="mt-0 space-y-2">
              <SpellSchoolsTab />
            </TabsContent>
            <TabsContent value="triggers" className="mt-0">
              <TriggersTab />
            </TabsContent>
            <TabsContent value="statusEffects" className="mt-0 space-y-2">
              <StatusEffectsTab />
            </TabsContent>
            <TabsContent value="damageTypes" className="mt-0">
              <DamageTypesTab />
            </TabsContent>
            <TabsContent value="gearCategories" className="mt-0">
              <GearCategoriesTab />
            </TabsContent>
            <TabsContent value="rollTables" className="mt-0">
              <RollTablesTab />
            </TabsContent>
            <TabsContent value="lootTables" className="mt-0">
              <LootTablesTab />
            </TabsContent>
            <TabsContent value="lootPools" className="mt-0">
              <LootPoolsTab />
            </TabsContent>
            <TabsContent value="encounterTables" className="mt-0">
              <EncounterTablesTab />
            </TabsContent>
            <TabsContent value="dungeonRooms" className="mt-0">
              <DungeonRoomsTab />
            </TabsContent>
            <TabsContent value="fiveETools" className="mt-0">
              <FiveEToolsImportsTab />
            </TabsContent>
            {importedTabs.map(([value]) => (
              <TabsContent key={value} value={value} className="mt-0">
                <FiveEToolsCategoryTab categoryId={value.slice("imported:".length)} />
              </TabsContent>
            ))}
            <TabsContent value="media" className="mt-0">
              <MediaTab />
            </TabsContent>
            <TabsContent value="encounterCalc" className="mt-0">
              <EncounterXpCalculator />
            </TabsContent>
            <TabsContent value="backgrounds" className="mt-0">
              <FiveEToolsCategoryTab categoryId="backgrounds" />
            </TabsContent>
            <TabsContent value="species" className="mt-0">
              <FiveEToolsCategoryTab categoryId="species" />
            </TabsContent>
            <TabsContent value="deities" className="mt-0">
              <FiveEToolsCategoryTab categoryId="deities" />
            </TabsContent>
            <TabsContent value="objects" className="mt-0">
              <FiveEToolsCategoryTab categoryId="objects" />
            </TabsContent>
            <TabsContent value="traps" className="mt-0">
              <FiveEToolsCategoryTab categoryId="traps" />
            </TabsContent>
            <TabsContent value="downtime" className="mt-0">
              <DowntimeTab />
            </TabsContent>
            <TabsContent value="weaponUpgrades" className="mt-0 space-y-2">
              <UpgradesTab />
            </TabsContent>
            <TabsContent value="weapons" className="mt-0 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Damage like 1d8 slashing: dice count, die size and type.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setLib({
                      weapons: [
                        ...(lib.weapons || []),
                        { name: "", category: "Simple", attackType: "melee", diceCount: 1, dieSize: "d6", damageType: "", properties: [], weight: 0, cost: "" },
                      ],
                    })
                  }
                >
                  <Plus className="mr-1 h-4 w-4" /> Add weapon
                </Button>
              </div>
              <InfoTip label="Filter the weapon list by name.">
                <Input
                  className="h-8"
                  placeholder="Search weapons…"
                  value={weaponQuery}
                  onChange={(e) => setWeaponQuery(e.target.value)}
                  />
                  </InfoTip>
                  <datalist id="library-damage-types">
                  {(lib.damageTypes || []).map((d) => (
                  <option key={d} value={d} />
                  ))}
                  </datalist>
              <SubChips
                values={lib.weaponCategories || []}
                value={weaponSub}
                onChange={setWeaponSub}
              />
              {(() => {
                const q = weaponQuery.trim();
                const shown = (lib.weapons || [])
                  .map((w, i) => ({ w, i }))
                  .filter(({ w }) => matchesQuery(w?.name, q) && matchesSub(w.category, weaponSub));
                if (shown.length === 0)
                  return (
                    <p className="text-xs text-muted-foreground">
                      {(lib.weapons || []).length === 0 ? "No weapons yet." : "No matches."}
                    </p>
                  );
                return shown.map(({ w, i }) => {
                  const patch = (p) => {
                    const next = [...lib.weapons];
                    next[i] = { ...w, ...p };
                    setLib({ weapons: next });
                  };
                  return (
                    <div
                      key={i}
                      {...benefitDragProps("equipment", w.name, {
                        description: w.description,
                        image: w.image,
                      })}
                      className="space-y-1.5 rounded-md border p-2"
                    >
                      <div className="grid grid-cols-2 gap-1.5">
                        <InfoTip label="The weapon's display name.">
                          <Input
                            className="h-8"
                            placeholder="Weapon name"
                            value={w.name || ""}
                            onChange={(e) => patch({ name: e.target.value })}
                          />
                        </InfoTip>
                        <Select value={w.category || "Simple"} onValueChange={(v) => patch({ category: v })}>
                          <InfoTip label="Weapon category (Simple, Martial…) — edit categories in the Categories tab.">
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                          </InfoTip>
                          <SelectContent>
                            {(lib.weaponCategories || []).map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={w.attackType || "melee"} onValueChange={(v) => patch({ attackType: v })}>
                          <InfoTip label="Melee or ranged attack.">
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                          </InfoTip>
                          <SelectContent>
                            <SelectItem value="melee">Melee</SelectItem>
                            <SelectItem value="ranged">Ranged</SelectItem>
                          </SelectContent>
                        </Select>
                        <InfoTip label="Weight in pounds; counts toward carried weight.">
                          <Input
                            className="h-8"
                            type="number"
                            min={0}
                            placeholder="Weight (lb)"
                            value={w.weight ?? 0}
                            onChange={(e) => patch({ weight: Number(e.target.value) || 0 })}
                          />
                        </InfoTip>
                        <div className="flex items-center gap-1">
                          <InfoTip label="Number of damage dice.">
                            <Input
                              className="h-8 w-14"
                              type="number"
                              min={1}
                              value={w.diceCount ?? 1}
                              onChange={(e) => patch({ diceCount: Math.max(1, Number(e.target.value) || 1) })}
                            />
                          </InfoTip>
                          <Select value={w.dieSize || "d6"} onValueChange={(v) => patch({ dieSize: v })}>
                            <InfoTip label="Damage die size.">
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                            </InfoTip>
                            <SelectContent>
                              {DIE_SIZES.map((d) => (
                                <SelectItem key={d} value={d}>
                                  {d}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <InfoTip label="Damage type, e.g. slashing, piercing, fire.">
                            <Input
                              className="h-8 flex-1"
                              placeholder="Damage type"
                              value={w.damageType || ""}
                              onChange={(e) => patch({ damageType: e.target.value })}
                              list="library-damage-types"
                            />
                          </InfoTip>
                        </div>
                        <InfoTip label="Cost and currency, e.g. 10 gp.">
                          <CostField value={w.cost} onChange={(v) => patch({ cost: v })} />
                        </InfoTip>
                        <InfoTip label="Comma-separated weapon properties from the Weapon Properties tab.">
                          <Input
                            className="h-8"
                            placeholder="Properties (comma separated)"
                            value={(w.properties || []).join(", ")}
                            onChange={(e) =>
                              patch({ properties: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
                            }
                          />
                        </InfoTip>
                      </div>
                      <div className="flex justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setLib({ weapons: lib.weapons.filter((_, j) => j !== i) })}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                });
              })()}
            </TabsContent>

            <TabsContent value="armor" className="mt-0 space-y-2">
              <div className="flex items-center justify-between">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setLib({
                      armor: [
                        ...(lib.armor || []),
                        { name: "", type: "Light", requirement: "", acFlat: "", acPlus: "", stealthDisadvantage: false, cost: "" },
                      ],
                    })
                  }
                >
                  <Plus className="mr-1 h-4 w-4" /> Add armor
                </Button>
                <InfoTip label="Filter the armor list by name.">
                  <Input
                    className="h-8 w-48"
                    placeholder="Search armor…"
                    value={armorQuery}
                    onChange={(e) => setArmorQuery(e.target.value)}
                  />
                </InfoTip>
              </div>
              <SubChips
                values={lib.armorTypes || []}
                value={armorSub}
                onChange={setArmorSub}
              />
              {(() => {
                const q = armorQuery.trim();
                const shown = (lib.armor || [])
                  .map((a, i) => ({ a, i }))
                  .filter(({ a }) => matchesQuery(a?.name, q) && matchesSub(a.type, armorSub));
                if (shown.length === 0)
                  return (
                    <p className="text-xs text-muted-foreground">
                      {(lib.armor || []).length === 0 ? "No armor yet." : "No matches."}
                    </p>
                  );
                return shown.map(({ a, i }) => {
                  const patch = (p) => {
                    const next = [...lib.armor];
                    next[i] = { ...a, ...p };
                    setLib({ armor: next });
                  };
                  return (
                    <div
                      key={i}
                      {...benefitDragProps("armor", a.name, {
                        description: a.description,
                        image: a.image,
                      })}
                      className="rounded-md border p-2"
                    >
                      <div className="grid grid-cols-2 gap-1.5">
                        <InfoTip label="The armor's display name.">
                          <Input
                            className="h-8"
                            placeholder="Armor name"
                            value={a.name || ""}
                            onChange={(e) => patch({ name: e.target.value })}
                          />
                        </InfoTip>
                        <Select value={a.type || "Light"} onValueChange={(v) => patch({ type: v })}>
                          <InfoTip label="Armor type (Light, Medium, Heavy…) — edit types in the Categories tab.">
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                          </InfoTip>
                          <SelectContent>
                            {(lib.armorTypes || []).map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <InfoTip label="Minimum STR to wear it — a flat number (legacy text like 'STR 15' is read as its number).">
                          <Input
                            className="h-8"
                            type="number"
                            placeholder="STR requirement"
                            value={String(a.requirement ?? "").replace(/[^\d-]/g, "")}
                            onChange={(e) => patch({ requirement: e.target.value === "" ? "" : Number(e.target.value) })}
                          />
                        </InfoTip>
                        <InfoTip label="Armor Class: a flat value, optionally plus an ability or skill modifier.">
                          <Input
                            className="h-8"
                            type="number"
                            placeholder="AC (flat)"
                            value={parseArmorAC(a).flat || ""}
                            onChange={(e) =>
                              patch({ acFlat: e.target.value === "" ? "" : Number(e.target.value) || 0 })
                            }
                          />
                        </InfoTip>
                        <InfoTip label="Added to the flat AC: an ability modifier (e.g. DEX) or a skill modifier (ability + proficiency if trained). Leave as — for none.">
                          <Select
                            value={parseArmorAC(a).plus || "none"}
                            onValueChange={(v) => patch({ acPlus: v === "none" ? "" : v })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="+ modifier" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— nothing —</SelectItem>
                              {STATS_LIST.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s} modifier
                                </SelectItem>
                              ))}
                              {(lib.lists?.skills || [])
                                .map((s) => (typeof s === "string" ? { name: s } : s))
                                .filter((s) => s?.name)
                                .map((s) => (
                                  <SelectItem key={s.name} value={s.name}>
                                    {s.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </InfoTip>
                            <InfoTip label="Cost and currency, e.g. 10 gp.">
                            <CostField value={a.cost} onChange={(v) => patch({ cost: v })} />
                            </InfoTip>
                        <label className="flex items-center gap-1.5 text-xs">
                          <InfoTip label="Wearing this armor imposes disadvantage on Stealth checks.">
                            <Switch
                              checked={!!a.stealthDisadvantage}
                              onCheckedChange={(v) => patch({ stealthDisadvantage: v })}
                            />
                          </InfoTip>
                          Stealth disadvantage
                        </label>
                      </div>
                      <div className="mt-1 flex justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setLib({ armor: lib.armor.filter((_, j) => j !== i) })}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                });
              })()}
            </TabsContent>

            <TabsContent value="skills" className="mt-0">
              <AbilityList
                label="Skills — the ability assignment powers auto-calculated check modifiers"
                entries={lib.lists.skills || []}
                onChange={(n) => setList("skills", n)}
                placeholder="Skill name"
                dragCategory="skill"
              />
            </TabsContent>

            <TabsContent value="languages" className="mt-0">
              <LanguagesTab />
            </TabsContent>

            <TabsContent value="speedTypes" className="mt-0">
              <SpeedTypesTab />
            </TabsContent>
            <TabsContent value="senses" className="mt-0">
              <SensesLibraryTab />
            </TabsContent>
            <TabsContent value="resources" className="mt-0">
              <ResourcesTab />
            </TabsContent>
            <TabsContent value="dieScaling" className="mt-0">
              <DieScalingTab />
            </TabsContent>

            <TabsContent value="categories" className="mt-0 space-y-2">
              <NameList
                label="Weapon Categories"
                entries={lib.weaponCategories || []}
                onChange={(n) => setLib({ weaponCategories: n })}
                placeholder="Category (e.g. Martial)"
              />
              <NameList
                label="Armor Types"
                entries={lib.armorTypes || []}
                onChange={(n) => setLib({ armorTypes: n })}
                placeholder="Armor type (e.g. Heavy)"
              />
            </TabsContent>

            <TabsContent value="properties" className="mt-0">
              <WeaponPropertiesTab />
            </TabsContent>
            <TabsContent value="weaponMasteries" className="mt-0">
              <WeaponMasteriesTab />
            </TabsContent>
            <TabsContent value="levels" className="mt-0">
              <LevelsTab />
            </TabsContent>
            <TabsContent value="pointTypes" className="mt-0">
              <PointTypesTab />
            </TabsContent>
            <TabsContent value="nodeTypes" className="mt-0">
              <NodeTypesTab />
            </TabsContent>
            <TabsContent value="attributes" className="mt-0">
              <NameList
                label="Attributes (Attribute nodes grant +1 per invested point)"
                entries={lib.attributes || []}
                onChange={(n) => setLib({ attributes: n })}
                placeholder="Attribute (e.g. STR)"
              />
            </TabsContent>

            <TabsContent value="gear" className="mt-0">
              <AdventuringGearTab />
            </TabsContent>
            <TabsContent value="ammo" className="mt-0">
              <AmmoTab />
            </TabsContent>
            <TabsContent value="trinkets" className="mt-0">
              <TrinketsTab />
            </TabsContent>
            <TabsContent value="explosives" className="mt-0">
              <ExplosivesTab />
            </TabsContent>
            <TabsContent value="wondrous" className="mt-0">
              <WondrousTab />
            </TabsContent>
            <TabsContent value="shop" className="mt-0">
              <ShopTab />
            </TabsContent>
            <TabsContent value="currency" className="mt-0">
              <CurrencyTab />
            </TabsContent>
            <TabsContent value="trade" className="mt-0">
              <TradeGoodsTab />
            </TabsContent>
            <TabsContent value="poisons" className="mt-0">
              <PoisonsTab />
            </TabsContent>
            <TabsContent value="tools" className="mt-0 space-y-2">
              <AbilityList
                label="Artisan's Tools (ability used for tool checks)"
                entries={lib.lists.artisanTools || []}
                onChange={(n) => setList("artisanTools", n)}
                placeholder="Artisan's tool"
                dragCategory="tool"
              />
              <AbilityList
                label="Musical Instruments (ability used for checks)"
                entries={lib.lists.instruments || []}
                onChange={(n) => setList("instruments", n)}
                placeholder="Instrument"
                dragCategory="tool"
              />
              <AbilityList
                label="Gaming Sets (ability used for checks)"
                entries={lib.lists.gamingSets || []}
                onChange={(n) => setList("gamingSets", n)}
                placeholder="Gaming set"
                dragCategory="tool"
              />
              <AbilityList
                label="Miscellaneous Tools (ability used for checks)"
                entries={lib.lists.miscTools || []}
                onChange={(n) => setList("miscTools", n)}
                placeholder="Tool"
                dragCategory="tool"
              />
            </TabsContent>
            <TabsContent value="siege" className="mt-0">
              <SiegeTab />
            </TabsContent>
            <TabsContent value="vehicles" className="mt-0">
              <VehiclesTab />
            </TabsContent>
          </div>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}