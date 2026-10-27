import { useTree, aggregateResources, profBonusFor, statVars } from "@/lib/treeStore";
import { derivedSheet } from "@/lib/resources";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { abilityMod, modFmt, checkOptions, checkBonus } from "@/lib/skills";

const STATS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

export function ModifiersSection() {
  const { mergedTree: tree, character, setCharacter, settings } = useTree();
  const mods = character.modifiers || { ability: {}, ac: 0, speed: 0, spellAttack: 0, weaponAttack: 0, saves: 0 };
  const abil = mods.ability || {};
  const levels = settings?.library?.levels || [];
  // Modifiers track the effective score (node contributions included), so
  // scores below 10 show negative modifiers.
  const effSheet = derivedSheet(
    character,
    tree,
    levels,
    aggregateResources(tree, character, levels),
    profBonusFor(character.level || 1, levels),
    statVars(character, tree),
    settings?.library
  );
  const setMod = (patch) =>
    setCharacter({ ...character, modifiers: { ...mods, ...patch } });
  const setAb = (k, v) => setMod({ ability: { ...abil, [k]: Number(v) || 0 } });

  // A 0 counts as a drained score (−5), not "unset".
  const rawStat = (s) => {
    const raw = effSheet[s]?.final ?? character.stats?.[s];
    const n = Number(raw);
    return Number.isFinite(n) ? n : 10;
  };
  const mod = (s) => abilityMod(rawStat(s)) + (Number(abil[s]) || 0);
  const fmt = modFmt;
  const prof = profBonusFor(character.level || 1, levels);
  const ac = 10 + mod("DEX") + (Number(mods.ac) || 0);

  // Casting ability for the spell save DC (stored with the modifiers).
  const castingAbility = mods.castingAbility || "WIS";
  const saveDC = 8 + prof + mod(castingAbility);

  // Auto-calculated check modifiers, ability assignment from the library.
  const opts = checkOptions(settings);
  const checkRow = (option, group) => {
    const r = checkBonus({
      option,
      group,
      character,
      profBonus: prof,
      effAbilityMod: option.ability ? mod(option.ability) : 0,
    });
    return (
      <div
        key={group + option.name}
        className="flex items-center justify-between rounded bg-muted/50 px-1.5 py-0.5 text-[11px]"
        title={
          r.expertise
            ? "Expertise (proficiency doubled)"
            : r.prof
            ? "Proficient"
            : option.ability
            ? "Not proficient"
            : "No ability assigned in the library"
        }
      >
        <span className="min-w-0 truncate">
          {r.expertise ? "★★" : r.prof ? "★" : ""}
          {option.name}{" "}
          <span className="text-muted-foreground">{option.ability || "—"}</span>
          {r.custom ? ` ${fmt(r.custom)}` : ""}
        </span>
        <span className="ml-1 shrink-0 font-mono font-medium">{fmt(r.total)}</span>
      </div>
    );
  };
  const profTools = (character.proficiencies?.tools || [])
    .filter((p) => (p.times ?? 1) > 0 && p.name)
    .map((p) => opts.tools.find((t) => t.name === p.name) || { name: p.name, ability: "" });
  const profInstruments = (character.proficiencies?.instruments || [])
    .filter((p) => (p.times ?? 1) > 0 && p.name)
    .map((p) => opts.instruments.find((t) => t.name === p.name) || { name: p.name, ability: "" });

  return (
    <div className="space-y-2">
      <Label>Modifiers</Label>

      <div className="grid grid-cols-6 gap-1.5">
        {STATS.map((s) => (
          <div key={s} className="text-center">
            <div className="text-[10px] font-medium text-muted-foreground">{s}</div>
            <Input
              type="number"
              className="h-7 px-1 text-center text-xs"
              title={`${s} bonus`}
              value={abil[s] ?? 0}
              onChange={(e) => setAb(s, e.target.value)}
            />
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              mod {fmt(mod(s))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
          AC bonus
          <Input
            type="number"
            className="h-7"
            value={mods.ac ?? 0}
            onChange={(e) => setMod({ ac: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
          Speed bonus
          <Input
            type="number"
            className="h-7"
            value={mods.speed ?? 0}
            onChange={(e) => setMod({ speed: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
          Spell attack
          <Input
            type="number"
            className="h-7"
            value={mods.spellAttack ?? 0}
            onChange={(e) => setMod({ spellAttack: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
          Weapon attack
          <Input
            type="number"
            className="h-7"
            value={mods.weaponAttack ?? 0}
            onChange={(e) => setMod({ weaponAttack: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
          All saves
          <Input
            type="number"
            className="h-7"
            value={mods.saves ?? 0}
            onChange={(e) => setMod({ saves: Number(e.target.value) || 0 })}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-xs">
        <div className="rounded bg-muted/50 px-2 py-1">
          <span className="text-muted-foreground">AC</span>{" "}
          <span className="font-mono font-medium">{ac}</span>
        </div>
        <div className="rounded bg-muted/50 px-2 py-1">
          <span className="text-muted-foreground">Spell attack</span>{" "}
          <span className="font-mono font-medium">{fmt(prof + (Number(mods.spellAttack) || 0))}</span>
        </div>
        <div className="rounded bg-muted/50 px-2 py-1">
          <span className="text-muted-foreground">Weapon attack</span>{" "}
          <span className="font-mono font-medium">{fmt(prof + (Number(mods.weaponAttack) || 0))}</span>
        </div>
        <div className="rounded bg-muted/50 px-2 py-1">
          <span className="text-muted-foreground">Saves</span>{" "}
          <span className="font-mono font-medium">{fmt(Number(mods.saves) || 0)}</span>
        </div>
        <div className="rounded bg-muted/50 px-2 py-1">
          <span className="text-muted-foreground">Proficiency</span>{" "}
          <span className="font-mono font-medium">{fmt(prof)}</span>
        </div>
      </div>

      {/* Spell save DC: 8 + proficiency + casting ability's modifier */}
      <div className="rounded-md border p-2">
        <div className="flex items-center gap-2">
          <Label className="text-[10px] text-muted-foreground">Spell save DC</Label>
          <Select
            value={castingAbility}
            onValueChange={(v) => setMod({ castingAbility: v })}
          >
            <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="ml-auto font-mono text-base font-bold">{saveDC}</span>
        </div>
        <p className="mt-0.5 text-[10px] text-muted-foreground">8 + proficiency {fmt(prof)} + {castingAbility} mod {fmt(mod(castingAbility))}</p>
      </div>

      {/* Auto-calculated skill & tool checks */}
      <div className="space-y-1 rounded-md border p-2">
        <Label className="text-[10px] text-muted-foreground">Check modifiers (auto)</Label>
        <p className="text-[10px] leading-snug text-muted-foreground">
          Ability modifier + proficiency (★, doubled with expertise ★★) + custom
          bonus − 2 per exhaustion stage. Assign abilities on the Skills and Tools
          tabs of the Reference Library.
        </p>
        <div className="grid grid-cols-3 gap-1">
          {opts.skills.map((s) => checkRow(s, "skill"))}
        </div>
        {profTools.length > 0 && (
          <>
            <div className="pt-1 text-[10px] font-semibold text-muted-foreground">Tools</div>
            <div className="grid grid-cols-3 gap-1">
              {profTools.map((t) => checkRow(t, "tool"))}
            </div>
          </>
        )}
        {profInstruments.length > 0 && (
          <>
            <div className="pt-1 text-[10px] font-semibold text-muted-foreground">Instruments</div>
            <div className="grid grid-cols-3 gap-1">
              {profInstruments.map((t) => checkRow(t, "instrument"))}
            </div>
          </>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Spell/weapon attack totals show proficiency + your flat bonus; add a casting
        ability's modifier via the ability bonus fields above.
      </p>
    </div>
  );
}