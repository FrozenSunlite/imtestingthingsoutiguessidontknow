import { useState } from "react";
import { useTree, pushActivityLog, profBonusFor } from "@/lib/treeStore";
import {
  abilityMod,
  modFmt,
  checkOptions,
  checkBonus,
  talentBonusDice,
  toolSynergy,
  DC_LADDER,
  STATS,
} from "@/lib/skills";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dices } from "lucide-react";
import { applyUpgrades } from "@/lib/upgrades";

const DICE = [4, 6, 8, 10, 12, 20, 100];
const signed = (n) => (n >= 0 ? `+${n}` : String(n));

// Quick dice roller: tap a die for a plain roll, or use Checks to roll an
// attack, saving throw or ability check (skill / tool / instrument / raw
// ability) with advantage/disadvantage against a target AC/DC. Skill and
// tool modifiers auto-calculate from the sheet, the proficiencies and
// exhaustion; everything lands in the character's activity log.
export function DiceRoller({ open, onClose }) {
  const { mergedTree: tree, character, setCharacter, settings } = useTree();
  const [count, setCount] = useState(1);
  const [mod, setMod] = useState("0");
  const [checkType, setCheckType] = useState("attack");
  const [checkStat, setCheckStat] = useState("STR");
  const [checkOpt, setCheckOpt] = useState("");
  const [weaponName, setWeaponName] = useState("none");
  const [targetNum, setTargetNum] = useState("");
  const [mode, setMode] = useState("normal"); // normal | adv | dis
  const log = character.activityLog || [];
  const levels = settings?.library?.levels || [];
  const profB = profBonusFor(character.level || 1, levels);
  const opts = checkOptions(settings);
  // Weapon context for attack rolls: library weapons carry category and
  // properties (used by weapon-scoped talent bonus dice); carried weapon-type
  // inventory items are offered by name only.
  const libWeapons = (settings?.library?.weapons || []).filter((w) => w.name);
  const invWeapons = (character.inventory || []).filter(
    (i) => i.type === "Weapon" && i.name && !libWeapons.some((w) => w.name === i.name)
  );
  // Effective weapon stats: applied Weapon Upgrades change dice, damage type
  // and rider damage; the picked weapon's effective damage can be rolled.
  const picked = weaponName !== "none" ? weaponName : "";
  const wLib = libWeapons.find((w) => w.name === picked);
  const upgradeLib = Object.fromEntries(
    (settings?.library?.weaponUpgrades || []).filter((u) => u.name).map((u) => [u.name, u])
  );
  const appliedFor = (character.appliedUpgrades || [])
    .filter((a) => a.weapon === `${wLib ? "Library" : "Carried"}:${picked}`)
    .map((a) => upgradeLib[a.upgrade])
    .filter(Boolean);
  const effectiveWeapon = picked ? applyUpgrades(wLib || {}, appliedFor) : null;

  const push = (text) => setCharacter((c) => pushActivityLog(c, text));

  const roll = (size) => {
    const n = Math.max(1, Math.min(20, Math.round(Number(count) || 1)));
    const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * size));
    const m = Number(mod) || 0;
    const total = rolls.reduce((a, b) => a + b, 0) + m;
    const label = `${n}d${size}${m ? signed(m) : ""}`;
    push(`${label} → ${total} [${rolls.join(", ")}]`);
  };

  // Effective ability modifier from the sheet: a 0 counts as drained (−5).
  const effMod = (ab) => {
    const raw = character.stats?.[ab];
    const n = Number(raw);
    const base = Number.isFinite(n) ? n : 10;
    return abilityMod(base) + (Number(character.modifiers?.ability?.[ab]) || 0);
  };
  const ex = Math.max(0, Math.min(6, Number(character.exhaustion) || 0));
  const exPen = 2 * ex;
  const exNote = ex ? ` · exhaustion −${exPen}` : "";

  const rollOne = () => 1 + Math.floor(Math.random() * 20);

  // Talent dice: invested nodes can add dice to a specific check
  // (target format "skill:Perception", "attack", "save:WIS", "ability:STR"…).
  const rollTalentDice = (ctx) => {
    const list = talentBonusDice(tree, ctx);
    if (!list.length) return { sum: 0, detail: "" };
    let sum = 0;
    const parts = [];
    list.forEach((d) => {
      const rolls = Array.from({ length: d.count }, () => 1 + Math.floor(Math.random() * d.size));
      sum += rolls.reduce((a, b) => a + b, 0);
      parts.push(`${d.count}d${d.size}[${rolls.join(",")}]`);
    });
    return { sum, detail: ` · talent ${parts.join(" + ")} +${sum}` };
  };

  const rollD20 = (bonus, label, targetLabel, talent, synergy) => {
    // Tool↔skill synergy (Xanathar's): proficiency in a related skill gives
    // advantage on tool checks, applied automatically on a neutral roll.
    const synAdv = !!synergy?.length && mode === "normal";
    const effMode = synAdv ? "adv" : mode;
    let kept, detail;
    if (effMode === "normal") {
      kept = rollOne();
      detail = `d20(${kept})`;
    } else {
      const a = rollOne();
      const b = rollOne();
      kept = effMode === "adv" ? Math.max(a, b) : Math.min(a, b);
      detail = `2d20 [${a}, ${b}] keep ${effMode === "adv" ? "high" : "low"}`;
    }
    const tSum = talent?.sum || 0;
    const total = kept + bonus + tSum;
    const natNote = kept === 20 ? " · natural 20!" : kept === 1 ? " · natural 1!" : "";
    const synNote = synAdv
      ? ` · tool/skill synergy (${synergy.join(", ")}) → advantage`
      : "";
    const target = Number(targetNum) || 0;
    const verdict = target
      ? total >= target
        ? ` vs ${targetLabel} ${target} → Success`
        : ` vs ${targetLabel} ${target} → Failure`
      : "";
    push(
      `${label}: ${detail} ${signed(bonus)}${talent?.detail || ""} = ${total}${natNote}${synNote}${exNote}${verdict}`
    );
  };

  const rollCheck = () => {
    if (checkType === "check") {
      const sep = checkOpt.indexOf(":");
      const group = checkOpt.slice(0, sep);
      const name = checkOpt.slice(sep + 1);
      if (!name) return;
      if (group === "ability") {
        // Raw ability check: no proficiency, exhaustion applies.
        const talent = rollTalentDice({ type: "check", group: "ability", name, ability: name });
        rollD20(effMod(name) - exPen, `${name} check`, "DC", talent);
      } else {
        const pool =
          { skill: opts.skills, tool: opts.tools, instrument: opts.instruments }[group] || [];
        const option = pool.find((o) => o.name === name) || { name, ability: "" };
        const r = checkBonus({
          option,
          group,
          character,
          profBonus: profB,
          effAbilityMod: effMod(option.ability),
        });
        const tag = r.expertise ? ", expertise" : r.prof ? ", proficient" : "";
        const talent = rollTalentDice({ type: "check", group, name, ability: option.ability });
        const synergy = group === "tool" ? toolSynergy({ option, character }) : [];
        rollD20(r.total, `${name} check (${option.ability || "—"}${tag})`, "DC", talent, synergy);
      }
      return;
    }
    const base = Number(character.stats?.[checkStat]);
    const statMod = abilityMod(Number.isFinite(base) ? base : 10);
    const bonus =
      checkType === "attack"
        ? statMod + (Number(character.modifiers?.weaponAttack) || 0) + profB - exPen
        : statMod + (Number(character.modifiers?.saves) || 0) - exPen;
    const weapon = picked
      ? { name: picked, category: wLib?.category || "", properties: wLib?.properties || [] }
      : null;
    const label = checkType === "attack"
      ? `Attack (${checkStat}${picked ? `, ${picked}` : ""})`
      : `${checkStat} saving throw`;
    const talent = rollTalentDice(
      checkType === "attack"
        ? { type: "attack", ability: checkStat, weapon }
        : { type: "save", ability: checkStat }
    );
    rollD20(bonus, label, checkType === "attack" ? "AC" : "DC", talent);
  };

  // Damage roll for the picked weapon, with applied upgrades folded in:
  // base dice (type changed / dice added or removed by upgrades) plus riders.
  const rollDamage = () => {
    if (!effectiveWeapon) return;
    const specs = [];
    if (effectiveWeapon.diceCount && effectiveWeapon.dieSize)
      specs.push({
        spec: `${effectiveWeapon.diceCount}${effectiveWeapon.dieSize}`,
        type: effectiveWeapon.damageType || "",
      });
    effectiveWeapon.riders.forEach((r) => {
      const m = String(r).match(/^(\d+d\d+)\s*(.*)$/i);
      if (m) specs.push({ spec: m[1], type: m[2] || "" });
    });
    if (!specs.length) return;
    let total = 0;
    const parts = [];
    specs.forEach((s) => {
      const [, n, size] = s.spec.match(/(\d+)d(\d+)/i);
      const rolls = Array.from(
        { length: Number(n) },
        () => 1 + Math.floor(Math.random() * Number(size))
      );
      const sum = rolls.reduce((a, b) => a + b, 0);
      total += sum;
      parts.push(`${s.spec}[${rolls.join(",")}]${s.type ? ` ${s.type}` : ""}`);
    });
    push(`${picked} damage → ${total} [${parts.join(" + ")}] · ${effectiveWeapon.damage}`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Dice Roller</DialogTitle>
          <DialogDescription>
            Rolls go to the activity log on the View screen. Checks compare against a target AC or DC.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-2">
          <div className="w-16 space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">Dice</Label>
            <Input
              type="number"
              min={1}
              max={20}
              className="h-8"
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </div>
          <div className="w-16 space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">Modifier</Label>
            <Input type="number" className="h-8" value={mod} onChange={(e) => setMod(e.target.value)} />
          </div>
          <div className="flex flex-1 flex-wrap gap-1">
            {DICE.map((d) => (
              <Button key={d} size="sm" variant="outline" onClick={() => roll(d)}>
                <Dices className="h-3 w-3" /> d{d}
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-md border p-2">
          <Label className="text-[10px] text-muted-foreground">Checks</Label>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Select
              value={checkType}
              onValueChange={(v) => {
                setCheckType(v);
                if (v === "check" && !checkOpt && opts.skills.length)
                  setCheckOpt(`skill:${opts.skills[0].name}`);
              }}
            >
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="attack">Attack roll</SelectItem>
                <SelectItem value="save">Saving throw</SelectItem>
                <SelectItem value="check">Ability check</SelectItem>
              </SelectContent>
            </Select>
            {checkType === "check" ? (
              <Select value={checkOpt} onValueChange={setCheckOpt}>
                <SelectTrigger className="h-8 min-w-40 flex-1 text-xs">
                  <SelectValue placeholder="Pick check…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Skills</SelectLabel>
                    {opts.skills.map((s) => (
                      <SelectItem key={`skill:${s.name}`} value={`skill:${s.name}`}>
                        {s.name} ({s.ability || "—"})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  {opts.tools.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Tools</SelectLabel>
                      {opts.tools.map((s) => (
                        <SelectItem key={`tool:${s.name}`} value={`tool:${s.name}`}>
                          {s.name} ({s.ability || "—"})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {opts.instruments.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Instruments</SelectLabel>
                      {opts.instruments.map((s) => (
                        <SelectItem key={`instrument:${s.name}`} value={`instrument:${s.name}`}>
                          {s.name} ({s.ability || "—"})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  <SelectGroup>
                    <SelectLabel>Abilities</SelectLabel>
                    {STATS.map((s) => (
                      <SelectItem key={s} value={`ability:${s}`}>
                        {s} check
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            ) : (
              <Select value={checkStat} onValueChange={setCheckStat}>
                <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {checkType === "attack" && (
              <Select value={weaponName} onValueChange={setWeaponName}>
                <SelectTrigger
                  className="h-8 min-w-[9rem] flex-1 text-xs"
                  title="Weapon — talent bonus dice scoped to a weapon category, property or name only apply to the chosen weapon"
                >
                  <SelectValue placeholder="Weapon (for talent dice)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific weapon</SelectItem>
                  {libWeapons.map((w) => (
                    <SelectItem key={`lib:${w.name}`} value={w.name}>
                      {w.name}
                    </SelectItem>
                  ))}
                  {invWeapons.map((w) => (
                    <SelectItem key={`inv:${w.name}`} value={w.name}>
                      {w.name} (carried)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              type="number"
              className="h-8 w-20"
              placeholder={checkType === "attack" ? "Target AC" : "Target DC"}
              value={targetNum}
              onChange={(e) => setTargetNum(e.target.value)}
            />
            <Button size="sm" onClick={rollCheck}>Roll</Button>
            {checkType === "attack" && picked && effectiveWeapon?.damage && (
              <Button
                size="sm"
                variant="outline"
                title="Roll the weapon's effective damage — applied Weapon Upgrades included"
                onClick={rollDamage}
              >
                Damage
              </Button>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {["normal", "adv", "dis"].map((m) => (
              <Button
                key={m}
                size="sm"
                variant={mode === m ? "default" : "outline"}
                className="h-6 px-2 text-[10px]"
                onClick={() => setMode(m)}
              >
                {m === "normal" ? "Normal" : m === "adv" ? "Advantage" : "Disadvantage"}
              </Button>
            ))}
            <span className="ml-1 text-[10px] text-muted-foreground">DC:</span>
            {DC_LADDER.map(([label, dc]) => (
              <Button
                key={dc}
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 text-[10px]"
                title={`${label} (${dc})`}
                onClick={() => setTargetNum(String(dc))}
              >
                {dc}
              </Button>
            ))}
          </div>
          {ex > 0 && (
            <p className="mt-1 text-[10px] text-amber-600">
              Exhaustion stage {ex}: −{exPen} applied to d20 rolls.
            </p>
          )}
        </div>

        <div>
          <Label className="text-[10px] text-muted-foreground">Recent rolls</Label>
          <div className="mt-1 max-h-40 space-y-0.5 overflow-y-auto rounded-md bg-muted/50 p-2">
            {log.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">No rolls yet.</p>
            ) : (
              log.slice(0, 8).map((e, i) => (
                <p key={i} className={i === 0 ? "text-xs font-medium" : "text-xs text-muted-foreground"}>
                  {e.text}
                </p>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}