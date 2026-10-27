import { useEffect, useState } from "react";
import { useTree, aggregateResources, statVars, profBonusFor } from "@/lib/treeStore";
import {
  derivedSheet,
  BUILTIN_KEYS,
  BUILTIN_ROW_ORDER,
  SIZE_LABELS,
  STATS,
} from "@/lib/resources";
import { resolveResourceDie } from "@/lib/dieScaling";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusBadge } from "@/components/skilltree/PlusBadge";

// Derived resources: built-ins (HP, AC, speed, saves, stats…) computed live
// from the character and every invested node's contributions, plus custom
// resources aggregated from nodes. Developer mode unlocks direct overrides.
export function DerivedResourcesSection() {
  const { mergedTree: tree, character, setCharacter, settings } = useTree();
  const levels = settings?.library?.levels || [];
  const aggregated = aggregateResources(tree, character, levels);
  const profBonus = profBonusFor(character.level || 1, levels);
  const stats = statVars(character, tree);
  const sheet = derivedSheet(character, tree, levels, aggregated, profBonus, stats, settings?.library);
  const dev = !!character.devMode;
  const overrides = character.devOverrides || {};

  const setOverride = (k, v) => {
    const o = { ...overrides };
    if (v === "" || v == null) delete o[k];
    else o[k] = Number(v);
    setCharacter({ ...character, devOverrides: o });
  };
  const overrideFor = (k) => {
    const v = Number(overrides[k]);
    return Number.isFinite(v) ? v : null;
  };

  // Library-defined resources act as the catalogue for the sheet: a resource
  // listed there supplies the display colour (unless the character's own
  // entry overrides it). Its die (static or scaling) is resolved separately,
  // so node step adjustments and overrides are applied on top.
  const libResources = settings?.library?.resources || [];
  const libByName = new Map(
    libResources
      .filter((r) => r?.name)
      .map((r) => [String(r.name).toLowerCase(), r])
  );
  const customs = aggregated
    .filter((e) => !BUILTIN_KEYS.has(e.name))
    .map((e) => {
      const lib = libByName.get(String(e.name).toLowerCase());
      if (!lib) return e;
      return {
        ...e,
        color: e.color === "#ffffff" ? lib.color || e.color : e.color,
      };
    });
  const set = (patch) => setCharacter({ ...character, ...patch });

  // The hit-dice field is free text: "#d#" (e.g. "3d8") overrides both the
  // count and the die size at once. Keep the typed text until the character's
  // stored count changes, so "3d8" isn't clobbered mid-typing.
  const [hdText, setHdText] = useState(character.hitDiceCount ?? "");
  useEffect(() => setHdText(character.hitDiceCount ?? ""), [character.hitDiceCount]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <Label>Derived Resources</Label>
        <label className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Dev mode</span>
          <Switch checked={dev} onCheckedChange={(v) => set({ devMode: v })} />
        </label>
      </div>
      {dev && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Developer mode: type a value to override it, clear the field to return to the computed value.
        </p>
      )}

      <div className="mt-1.5 space-y-1">
        {BUILTIN_ROW_ORDER.map((k) => {
          const d = sheet[k];
          if (!d) return null;
          const isSize = k === "Size" || k === "Count as Size";
          const isCT = k === "Creature Type";
          const ov = overrideFor(k);
          let display;
          if (k === "Hit Dice") {
            display = `${d.final}${d.size}`;
          } else if (isCT) {
            display = d.text;
          } else if (isSize) {
            display = SIZE_LABELS[d.idx] ?? "Medium";
          } else {
            display = ov != null ? ov : d.final;
          }
          const shown = ov != null && !isSize && !isCT ? ov : display;
          return (
            <div key={k} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1">
              <span className="text-xs font-medium">{k}</span>
              <span className="flex items-center gap-1.5">
                {d.replaced != null && !isSize && !isCT && (
                  <span className="rounded bg-violet-100 px-1 text-[9px] font-medium text-violet-600 dark:bg-violet-950 dark:text-violet-300">
                    replaced
                  </span>
                )}
                {!isCT && d.adds !== 0 && <PlusBadge value={d.adds} />}
                {k === "Speed" && d.encPenalty > 0 && (
                  <span className="rounded bg-orange-100 px-1 text-[9px] font-medium text-orange-600 dark:bg-orange-950 dark:text-orange-300">
                    enc −{d.encPenalty}
                  </span>
                )}
                {k === "Speed" && d.smallPenalty > 0 && (
                  <span className="rounded bg-sky-100 px-1 text-[9px] font-medium text-sky-600 dark:bg-sky-950 dark:text-sky-300">
                    small −{d.smallPenalty}
                  </span>
                )}
                <span className="font-mono text-xs">{shown}</span>
                {dev && k !== "Speed" && !isCT && (
                  <Input
                    className="h-6 w-14 px-1 text-xs"
                    type="number"
                    placeholder="override"
                    value={overrides[k] ?? ""}
                    onChange={(e) => setOverride(k, e.target.value)}
                  />
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Hit die: quantity and die size are editable at all times (the
          quantity defaults to the level when left blank). A node resource
          set to REPLACE "Hit Dice" overrides either — a plain number
          replaces the quantity, a value like "d10" replaces the size. */}
      <div className="mt-2 flex items-end gap-2">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Hit dice count</Label>
          <Input
            className="h-8 w-20"
            placeholder={`#d# or ${String(Number(character.level) || 1)}`}
            title='Type "#d#" (e.g. 3d8) to override both the hit-dice count and die size; a plain number sets the count only'
            value={hdText}
            onChange={(e) => {
              const raw = e.target.value.trim();
              setHdText(e.target.value);
              const m = raw.match(/^(\d+)\s*d\s*(\d+)$/i);
              if (m) set({ hitDiceCount: Number(m[1]), hitDiceSize: `d${m[2]}` });
              else set({ hitDiceCount: raw === "" ? "" : Number(raw) || 0 });
            }}
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Hit die</Label>
          <Select
            value={character.hitDiceSize || "d6"}
            onValueChange={(v) => set({ hitDiceSize: v })}
          >
            <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["d4", "d6", "d8", "d10", "d12"].map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {dev && (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">Base HP</Label>
            <Input
              className="h-8"
              type="number"
              value={character.hitPoints ?? ""}
              onChange={(e) => set({ hitPoints: e.target.value === "" ? 0 : Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">Spellcasting stat</Label>
            <Select value={character.spellStat || "CHA"} onValueChange={(v) => set({ spellStat: v })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">Base creature type</Label>
            <Select
              value={character.creatureType || "Humanoid"}
              onValueChange={(v) => set({ creatureType: v })}
            >
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(settings?.library?.creatureTypes || []).map((t) => (
                  <SelectItem key={t.name || t} value={t.name || t}>
                    {t.name || t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {sheet.Exhaustion && sheet.Exhaustion.penalty > 0 && (
        <p className="mt-1 text-[10px] font-medium text-orange-600 dark:text-orange-400">
          Exhaustion: −{sheet.Exhaustion.penalty} to every d20 test (already applied to Initiative).
        </p>
      )}

      {customs.length > 0 && (
        <div className="mt-2 space-y-1 border-t pt-2">
          {customs.map((r) => {
            const die = resolveResourceDie(r, settings?.library);
            const dieText = die && /\d*d\d/.test(die.text) ? ` · ${die.text}` : "";
            return (
            <div key={r.name} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1">
              <span style={{ color: r.color !== "#ffffff" ? r.color : undefined }} className="text-xs font-medium">
                {r.name}
              </span>
              <span className="font-mono text-xs">
                {r.value}
                {dieText}
                {r.grant
                  ? ` → ${r.grant.pool === "heritage" ? "Heritage" : "Talent"}${
                      r.grant.variant === "specific" ? ` (${r.grant.name})` : ""
                    } pts`
                  : ""}
                {r.recovery === "short" && r.recoveryAmount ? ` · short rest +${r.recoveryAmount}` : ""}
                {r.recovery === "long" ? ` · long rest` : ""}
                {r.recovery === "short" && !r.recoveryAmount ? ` · short rest (full)` : ""}
              </span>
            </div>
            );
          })}
        </div>
      )}
      {customs.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">No custom resources granted yet. Unlock nodes to populate.</p>
      )}
    </div>
  );
}