import { parseCastingTime, materialStatus, componentsText, spellNumbers, aoeText } from "@/lib/spells";
import { ACTION_CATEGORIES } from "@/lib/resources";

const fmtSigned = (n) => {
  const x = Math.round(Number(n) || 0);
  return x >= 0 ? `+${x}` : `${x}`;
};

const CAT_LABEL = Object.fromEntries(ACTION_CATEGORIES);

function Row({ label, children }) {
  return (
    <div className="flex gap-1.5 text-[11px] leading-snug">
      <span className="w-24 shrink-0 font-medium text-muted-foreground">{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function saveText(spell) {
  if (spell?.saveType === "save") {
    return `Saving throw${spell.saveAbility ? ` (${spell.saveAbility})` : ""} vs. Spell Save DC`;
  }
  if (spell?.saveType === "attack") {
    const kind = spell.attackKind || "";
    if (kind === "melee") return "Melee spell attack";
    if (kind === "ranged") return "Ranged spell attack";
    if (kind === "item") {
      if (spell.attackMod === "weapon") {
        return `Item attack (weapon modifier, ${spell.attackAbility || "STR"})`;
      }
      return "Item attack (spellcasting modifier)";
    }
    return "Spell Attack roll";
  }
  return "—";
}

// Cantrip scaling thresholds; the row matching the character's current level
// is highlighted.
function ScalingBlock({ scaling, level }) {
  const rows = (scaling || [])
    .filter((r) => Number(r?.atLevel) > 0)
    .sort((a, b) => Number(a.atLevel) - Number(b.atLevel));
  if (!rows.length) return null;
  let active = -1;
  rows.forEach((r, i) => {
    if (level >= Number(r.atLevel)) active = i;
  });
  return (
    <Row label="Cantrip scaling">
      <span className="block space-y-0.5">
        {rows.map((r, i) => {
          const dice = Number(r.diceCount) || "";
          const size = r.dieSize || "";
          const change =
            dice && size ? `${dice}${size}` : dice ? `${dice} dice` : size ? `die size ${size}` : "";
          return (
            <span key={i} className={`block ${i === active ? "font-medium text-foreground" : ""}`}>
              At level {r.atLevel}: {change}
              {r.effect ? ` — ${r.effect}` : ""}
              {i === active ? " (current)" : ""}
            </span>
          );
        })}
      </span>
    </Row>
  );
}

// Upcast thresholds for leveled spells: what improves at a higher slot level.
const ord = (n) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);

function UpcastBlock({ scaling, note }) {
  const rows = (scaling || [])
    .filter((r) => Number(r?.atSlot) > 0)
    .sort((a, b) => Number(a.atSlot) - Number(b.atSlot));
  if (!rows.length && !note) return null;
  return (
    <Row label="At higher levels">
      <span className="block space-y-0.5">
        {rows.map((r, i) => {
          const dice = Number(r.diceCount) || "";
          const size = r.dieSize || "";
          const parts = [];
          if (dice && size) parts.push(`${dice}${size}`);
          else if (dice) parts.push(`${dice} dice`);
          else if (size) parts.push(`die size ${size}`);
          if (Number(r.aoeSize)) parts.push(`AoE +${r.aoeSize} ft.`);
          if (r.targets !== "" && r.targets != null) parts.push(`${r.targets} targets`);
          if (r.repeats !== "" && r.repeats != null) parts.push(`repeats: ${r.repeats}`);
          if (r.effect) parts.push(r.effect);
          return (
            <span key={i} className="block">
              At {ord(Number(r.atSlot))} slot: {parts.join(", ")}
            </span>
          );
        })}
        {note ? <span className="block">{note}</span> : null}
      </span>
    </Row>
  );
}

// Compact status for a Cast a Spell action row: the chosen spell's casting
// time (with a mismatch hint) and any missing material components.
export function SpellCastInfo({ spell, action, character }) {
  if (!spell) return null;
  const ct = parseCastingTime(spell.castingTime);
  const status = materialStatus(spell, character);
  return (
    <div className="mt-0.5 space-y-0.5 text-[10px] leading-snug text-muted-foreground">
      {spell.castingTime && (
        <p>
          Casting time: {spell.castingTime}
          {ct.category && action && ct.category !== action.category
            ? ` — note: this action is a ${CAT_LABEL[action.category] || action.category}`
            : ""}
        </p>
      )}
      {!status.ok && (
        <p className="text-destructive">
          Missing material components{status.missing.length ? `: ${status.missing.join(", ")}` : ""}
          {status.goldShort ? `${status.missing.length ? " and " : ""}${status.cost} gp` : ""} — can't cast
          {character?.devMode ? " (developer mode bypass)" : ""}.
        </p>
      )}
    </div>
  );
}

// Full spell detail block for the character sheet's Spell List. The sheet's
// derived values feed the auto-calculated save DC and attack bonus.
export function SpellDetails({ spell, character, sheet = {} }) {
  if (!spell) return null;
  const level = Number(character?.level) || 1;
  const status = materialStatus(spell, character);
  const calc = spellNumbers(spell, character, sheet);
  return (
    <div className="mt-1 space-y-1 rounded border bg-muted/30 p-1.5">
      <Row label="Casting time">{spell.castingTime || "—"}</Row>
      <Row label="Range">{spell.range || "—"}</Row>
      <Row label="Duration">{spell.duration || "—"}</Row>
      <Row label="Components">{componentsText(spell) || "—"}</Row>
      <Row label="Attack/Save">{saveText(spell)}</Row>
      {spell.saveType === "save" && (
        <Row label="Save DC">
          <span className="font-mono font-semibold">{calc.dc}</span>
          <span className="text-muted-foreground"> ({calc.stat}-based)</span>
        </Row>
      )}
      {spell.saveType === "attack" &&
        !(spell.attackKind === "item" && spell.attackMod === "weapon") && (
          <Row label="Attack bonus">
            <span className="font-mono font-semibold">{fmtSigned(calc.attack)}</span>
            <span className="text-muted-foreground"> ({calc.stat}-based)</span>
          </Row>
        )}
      <Row label="Targets">{spell.targets || "—"}</Row>
      <Row label="Area of effect">{aoeText(spell) || "—"}</Row>
      {spell.repeats ? <Row label="Repeats">{spell.repeats}</Row> : null}
      {spell.description ? <Row label="Effect">{spell.description}</Row> : null}
      {spell.level !== "cantrip" && (
        <UpcastBlock scaling={spell.upcastScaling} note={spell.upcast} />
      )}
      {spell.level === "cantrip" && <ScalingBlock scaling={spell.scaling} level={level} />}
      {!status.ok && (
        <p className="text-[10px] leading-snug text-destructive">
          Missing material components — can't cast{character?.devMode ? " (developer mode bypass)" : ""}.
        </p>
      )}
    </div>
  );
}