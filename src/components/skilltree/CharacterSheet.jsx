import {
  useTree,
  poolUsage,
  effectivePools,
  grantedPoolBonus,
  statVars,
  aggregateResources,
  profBonusFor,
} from "@/lib/treeStore";
import { pointTypesFor } from "@/lib/pointTypes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfoTip } from "@/components/skilltree/InfoTip";
import { Plus, X, Download } from "lucide-react";
import { toast } from "sonner";
import { SIZE_LADDER, SIZE_LABELS, derivedSheet, speedTypeList, senseList, encumbranceInfo } from "@/lib/resources";
import { statOr10 } from "@/lib/skills";
import { usePanelWidth } from "@/hooks/use-panel-width";
import { PanelResizer } from "@/components/skilltree/PanelResizer";
import { CarryCalculator } from "@/components/skilltree/CarryCalculator";
import { AbilitiesSection } from "@/components/skilltree/AbilitiesSection";
import { ProficienciesSection } from "@/components/skilltree/ProficienciesSection";
import { InventorySection } from "@/components/skilltree/InventorySection";
import { ShopSection } from "@/components/skilltree/ShopSection";
import { ModifiersSection } from "@/components/skilltree/ModifiersSection";
import { SpellListSection } from "@/components/skilltree/SpellListSection";
import { ActionsSection } from "@/components/skilltree/ActionsSection";
import { DerivedResourcesSection } from "@/components/skilltree/DerivedResourcesSection";
import { TokenForge } from "@/components/skilltree/TokenForge";
import { PortraitDisplay } from "@/components/skilltree/PortraitDisplay";
import { StatusSection } from "@/components/skilltree/StatusSection";
import { SpeedSection } from "@/components/skilltree/SpeedSection";
import { SensesSection } from "@/components/skilltree/SensesSection";
import { SheetDetailsSection } from "@/components/skilltree/SheetDetailsSection";

const STATS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

export function CharacterSheet({ onExport, fill = false }) {
  // All derivations read the merged tree: the main tree plus both side-tree
  // panels, so effects chosen on any tree land on this sheet and pool limits
  // stay global.
  const { mergedTree: tree, character, setCharacter, pools, settings } = useTree();
  const levels = settings?.library?.levels || [];
  const [panelWidth] = usePanelWidth();
  const usage = poolUsage(tree, settings?.library?.pointTypes);
  const eff = effectivePools(pools, character, tree, levels, settings);
  const granted = grantedPoolBonus(
    tree,
    character,
    levels,
    settings?.library?.pointTypes
  );
  const derivedStats = statVars(character, tree);
  const charSheet = derivedSheet(
    character,
    tree,
    levels,
    aggregateResources(tree, character, levels),
    profBonusFor(character.level || 1, levels),
    derivedStats,
    settings?.library
  );

  const set = (patch) => setCharacter({ ...character, ...patch });
  const setStat = (k, v) => set({ stats: { ...character.stats, [k]: v } });

  // Leveling down strips what the lost levels granted: each one removes its
  // average HP and one hit die (when the count is pinned instead of tracking
  // the level). Leveling up only changes the level.
  const setLevel = (v) => {
    const next = Math.max(1, Number(v) || 1);
    const prev = Number(character.level) || 1;
    if (next >= prev) {
      set({ level: next });
      return;
    }
    const lost = prev - next;
    const sides = Number(String(character.hitDiceSize || "d6").replace(/\D/g, "")) || 6;
    const conMod =
      Math.floor((statOr10(derivedStats.CON) - 10) / 2) +
      (Number(character.modifiers?.ability?.CON) || 0);
    const perLevel = Math.max(1, Math.floor(sides / 2) + 1) + conMod;
    const hp = Math.max(0, (Number(character.hitPoints) || 0) - lost * perLevel);
    const hd =
      character.hitDiceCount == null || character.hitDiceCount === ""
        ? ""
        : Math.max(1, (Number(character.hitDiceCount) || 0) - lost);
    set({
      level: next,
      hitPoints: hp,
      ...(character.currentHp != null
        ? { currentHp: Math.min(Number(character.currentHp) || 0, hp) }
        : {}),
      ...(hd !== "" ? { hitDiceCount: hd } : {}),
    });
  };

  // Small race: grants the 13th Heritage Point (−5 speed) and drops the
  // character one size step (to Small by default). Turning it off restores
  // the previous size, but is blocked while every Heritage Point is spent.
  const toggleSmallRace = (on) => {
    if (!on) {
      const heritageTotal = eff.heritage?.total ?? 0;
      if ((usage.heritage || 0) >= heritageTotal) {
        toast.error(
          `You're using all ${heritageTotal} Heritage Points — the Small race bonus is one of them. Remove one Heritage point first.`
        );
        return;
      }
      const prev = character.sizeBeforeSmallRace;
      set(
        prev
          ? {
              smallRaceHeritage: false,
              sizeCountAs: prev,
              size: SIZE_LABELS[prev] || prev,
              sizeBeforeSmallRace: "",
            }
          : { smallRaceHeritage: false }
      );
      return;
    }
    const idx = SIZE_LADDER.indexOf(
      String(character.sizeCountAs || "medium").toLowerCase()
    );
    const smallIdx = SIZE_LADDER.indexOf("small");
    const nextSize = idx > smallIdx ? SIZE_LADDER[idx - 1] : "small";
    set({
      smallRaceHeritage: true,
      sizeBeforeSmallRace: character.sizeCountAs || "medium",
      sizeCountAs: nextSize,
      size: SIZE_LABELS[nextSize] || nextSize,
    });
  };

  return (
    <div
      className={`relative flex h-full flex-col bg-card ${fill ? "" : "border-l"}`}
      style={fill ? undefined : { width: panelWidth }}
    >
      {!fill && <PanelResizer />}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Character Sheet</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onExport}>
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
        </div>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto p-4 text-sm">
        <div className="rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <Label className="text-xs">Blind run</Label>
              <p className="text-[10px] text-muted-foreground">
                Hides nodes whose prerequisites aren't met — the tree reveals itself as you play.
              </p>
            </div>
            <Switch
              checked={!!character.hideLockedNodes}
              onCheckedChange={(v) => set({ hideLockedNodes: v })}
            />
          </div>
          {!!character.hideLockedNodes && (
            <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
              <div>
                <Label className="text-xs">Include level requirements</Label>
                <p className="text-[10px] text-muted-foreground">
                  Also hide nodes gated behind a higher character level.
                </p>
              </div>
              <Switch
                checked={!!character.hideLockedIncludeLevel}
                onCheckedChange={(v) => set({ hideLockedIncludeLevel: v })}
              />
            </div>
          )}
        </div>

        <PortraitDisplay />

        <TokenForge />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Character Name</Label>
            <Input value={character.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Class</Label>
            <Input
              placeholder="Dilettante"
              value={character.class}
              onChange={(e) => set({ class: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Race</Label>
            <Input value={character.race} onChange={(e) => set({ race: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Background</Label>
            <Input value={character.background} onChange={(e) => set({ background: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Age</Label>
            <Input value={character.age} onChange={(e) => set({ age: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Alignment</Label>
            <Input value={character.alignment} onChange={(e) => set({ alignment: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Level</Label>
            <Input
              type="number"
              min={1}
              value={character.level}
              onChange={(e) => setLevel(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Size</Label>
            <Input
              value={character.size || ""}
              placeholder="e.g. Medium"
              list="character-sizes"
              onChange={(e) => set({ size: e.target.value })}
            />
            <datalist id="character-sizes">
              {Object.values(SIZE_LABELS).map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>
        </div>

        <div>
          <Label className="mb-1.5 block">Ability Scores</Label>
          <div className="grid grid-cols-6 gap-1.5">
            {STATS.map((s) => {
              const abilBonus = Number(character.modifiers?.ability?.[s]) || 0;
              // The modifier follows the effective score — node contributions
              // included — so a score below 10 shows a negative modifier.
              const effective = statOr10(charSheet[s]?.final ?? derivedStats[s]);
              const nodeBonus = effective - (Number(character.stats[s]) || 10);
              const mod = Math.floor((effective - 10) / 2) + abilBonus;
              return (
                <div key={s} className="text-center">
                  <div className="text-[10px] font-medium text-muted-foreground">{s}</div>
                  <Input
                    type="number"
                    className="h-9 px-1 text-center"
                    value={character.stats[s]}
                    onChange={(e) => setStat(s, Number(e.target.value) || 0)}
                  />
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {mod >= 0 ? `+${mod}` : mod}
                    {nodeBonus !== 0 && (
                      <span className="block text-[9px] text-violet-500">
                        {nodeBonus > 0 ? "+" : ""}{nodeBonus} nodes
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <StatusSection />

        <SpeedSection
          sheet={charSheet}
          character={character}
          setCharacter={setCharacter}
          tree={tree}
          types={speedTypeList(character, settings?.library || {})}
          enc={encumbranceInfo(character, tree)}
        />
        <SensesSection
          sheet={charSheet}
          character={character}
          setCharacter={setCharacter}
          senses={senseList(character, settings?.library || {})}
        />

        <div>
          <Label className="mb-1.5 block">Point Pools</Label>
          <div className="grid grid-cols-3 gap-2">
            {pointTypesFor(settings).map((pt) => (
              <div
                key={pt.id}
                className="rounded-md border border-border bg-accent/40 p-2"
              >
                <div className="text-xs font-medium">{pt.label}</div>
                <div className="text-lg font-bold">
                  {usage[pt.id] || 0} / {eff[pt.id]?.total ?? 0}
                </div>
              </div>
            ))}
          </div>
          {pointTypesFor(settings).some(
            (pt) => (granted[pt.id]?.specific || []).length > 0
          ) && (
            <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
              {pointTypesFor(settings).flatMap((pt) =>
                (granted[pt.id]?.specific || []).map((s, i) => (
                  <div key={`${pt.id}-${i}`}>
                    +{s.amount} {pt.currency} ({s.name})
                  </div>
                ))
              )}
            </div>
          )}
          <div className="mt-2 space-y-1.5 text-xs">
            {eff.heritage && (
              <label className="flex items-center gap-2">
                <Switch
                  checked={!!character.smallRaceHeritage}
                  onCheckedChange={toggleSmallRace}
                />
                Small race: 13th Heritage Point (−5 speed, size drops one step)
              </label>
            )}
            {eff.talent && (
              <label className="flex items-center gap-2">
                <Switch
                  checked={!!character.bonusTalentFromProf}
                  onCheckedChange={(v) => set({ bonusTalentFromProf: v })}
                />
                Talent Points rise with proficiency (+{eff.profBonus} at level {character.level})
              </label>
            )}
          </div>
        </div>

        <DerivedResourcesSection />

        <ActionsSection />

        <AbilitiesSection />

        <div>
          <div className="flex items-center justify-between">
            <Label>Manual Resources</Label>
            <div className="flex items-center gap-1">
              <InfoTip label="Add a resource defined in the Reference Library, with its die size.">
                <Select
                  value=""
                  onValueChange={(name) => {
                    const lib = (settings?.library?.resources || []).find((r) => r.name === name);
                    if (!lib) return;
                    set({
                      manualResources: [
                        ...(character.manualResources || []),
                        {
                          name: lib.name,
                          value: "0",
                          color: lib.color || "#ffffff",
                          dieSize: lib.dieSize || "",
                        },
                      ],
                    });
                  }}
                >
                  <SelectTrigger className="h-7 w-40 text-xs">
                    <SelectValue placeholder="Add from library…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(settings?.library?.resources || [])
                      .filter(
                        (r) =>
                          r.name &&
                          !(character.manualResources || []).some(
                            (m) => (m.name || "").toLowerCase() === r.name.toLowerCase()
                          )
                      )
                      .map((r) => (
                        <SelectItem key={r.name} value={r.name}>
                          {r.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </InfoTip>
              <Button
                size="sm"
                variant="ghost"
                title="Add a blank resource"
                onClick={() =>
                  set({ manualResources: [...(character.manualResources || []), { name: "", value: "", color: "#ffffff" }] })
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="mt-1.5 space-y-1">
            {(character.manualResources || []).map((r, i) => (
              <div key={i} className="flex items-center gap-1">
                <Input
                  className="h-8 flex-1"
                  placeholder="Name"
                  value={r.name}
                  onChange={(e) => {
                    const mr = [...character.manualResources];
                    mr[i] = { ...r, name: e.target.value };
                    set({ manualResources: mr });
                  }}
                />
                <Input
                  className="h-8 w-20"
                  placeholder="Value"
                  value={r.value}
                  onChange={(e) => {
                    const mr = [...character.manualResources];
                    mr[i] = { ...r, value: e.target.value };
                    set({ manualResources: mr });
                  }}
                />
                <InfoTip label="Optional scaling die shown next to this resource on the sheet.">
                  <Select
                    value={r.dieSize || "none"}
                    onValueChange={(v) => {
                      const mr = [...character.manualResources];
                      mr[i] = { ...r, dieSize: v === "none" ? "" : v };
                      set({ manualResources: mr });
                    }}
                  >
                    <SelectTrigger className="h-8 w-[4.5rem] text-xs">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {["d4", "d6", "d8", "d10", "d12", "d20"].map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </InfoTip>
                <input
                  type="color"
                  value={r.color || "#ffffff"}
                  onChange={(e) => {
                    const mr = [...character.manualResources];
                    mr[i] = { ...r, color: e.target.value };
                    set({ manualResources: mr });
                  }}
                  className="h-8 w-8 rounded border"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    set({ manualResources: character.manualResources.filter((_, j) => j !== i) })
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <CarryCalculator character={character} setCharacter={setCharacter} />

        <ProficienciesSection />

        <ModifiersSection />

        <SpellListSection />

        <InventorySection />

        <ShopSection />

        <SheetDetailsSection />
      </div>
    </div>
  );
}