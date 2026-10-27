import { useState } from "react";
import { useTree, poolUsage, effectivePools, statVars, aggregateResources, profBonusFor, carryCapacity, totalCoins } from "@/lib/treeStore";
import { groupUnlocked } from "@/lib/unlocked";
import { usePanelWidth } from "@/hooks/use-panel-width";
import { PanelResizer } from "./PanelResizer";
import {
  derivedSheet,
  mergeLibraryActions,
  collectActions,
  buildVars,
  numericResourceMap,
  sanitizeKey,
  ACTION_CATEGORIES,
  BUILTIN_ROW_ORDER,
  BUILTIN_KEYS,
  SIZE_LABELS,
  totalCarried,
  repeatsFor,
} from "@/lib/resources";
import { resolveResourceDie } from "@/lib/dieScaling";
import { CapacityBar } from "./CapacityBar";
import { ActionActivationDialog } from "./ActionActivationDialog";
import { DiceRoller } from "./DiceRoller";
import { Button } from "@/components/ui/button";
import { Dices, Download, Play } from "lucide-react";

const signed = (n) => (n >= 0 ? `+${n}` : String(n));
const SPELL_LEVELS = [
  ["cantrip", "Cantrips"],
  ["1", "1st Level"], ["2", "2nd Level"], ["3", "3rd Level"], ["4", "4th Level"],
  ["5", "5th Level"], ["6", "6th Level"], ["7", "7th Level"], ["8", "8th Level"],
  ["9", "9th Level"],
];
const REST_LABEL = { none: "", short: "short rest", long: "long rest" };

function Section({ title, children }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="mb-1.5 border-b-2 border-slate-800 pb-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-center">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-bold leading-tight text-slate-900">{value}</div>
      {sub ? <div className="text-[9px] text-slate-500">{sub}</div> : null}
    </div>
  );
}

// The read-only "View" sheet: a presentation-style, nothing-editable layout
// of the character. This is also the document captured for image/PDF export.
export function PresentationSheet({ innerRef, onExport }) {
  const { mergedTree: tree, character, pools, settings } = useTree();
  const [panelWidth] = usePanelWidth();
  const [actOpen, setActOpen] = useState(false);
  const [diceOpen, setDiceOpen] = useState(false);
  const levels = settings?.library?.levels || [];
  const usage = poolUsage(tree);
  const eff = effectivePools(pools, character, tree, levels);
  const stats = statVars(character, tree);
  const aggregated = aggregateResources(tree, character, levels);
  const profBonus = profBonusFor(character.level || 1, levels);
  const sheet = derivedSheet(character, tree, levels, aggregated, profBonus, stats, settings?.library);
  const vars = buildVars(character.level, stats, profBonus, numericResourceMap(aggregated), character.hitDiceSize);
  const actions = mergeLibraryActions(
    settings?.library?.actions || [],
    collectActions(tree, vars),
    vars
  );
  const spent = character.actionUses || {};
  const customs = aggregated.filter((e) => !BUILTIN_KEYS.has(e.name));
  const currencies = (settings?.library?.currencies || []).filter((c) => c.key || c.name);
  const coins = character.coins || {};
  const items = character.inventory || [];
  const carried = totalCarried(character);
  const capacity = carryCapacity(character, tree);
  const spells = character.spellList || [];
  const unlocked = (tree?.nodes || []).filter((n) => (n.currentPoints || 0) > 0);
  // Heritage-purchased nodes first, then Talent-pool nodes grouped by Talent
  // Type (alphabetized), each in acquisition order.
  const { heritage: heritageNodes, talentGroups, attributes: attributeNodes } =
    groupUnlocked(unlocked);
  const profGroups = [
    ["Skill", (character.proficiencies || {}).skills],
    ["Tool", (character.proficiencies || {}).tools],
    ["Language", (character.proficiencies || {}).languages],
    ["Instrument", (character.proficiencies || {}).instruments],
  ].filter(([, list]) => (list || []).length > 0);

  const profLines = [];
  [
    ["skills", "Skill"],
    ["tools", "Tool"],
    ["languages", "Language"],
    ["instruments", "Instrument"],
  ].forEach(([k, label]) =>
    ((character.proficiencies || {})[k] || []).forEach((it) =>
      profLines.push(
        `${label}: ${it.name || "—"}${k === "languages" ? "" : ` ×${it.times ?? 1}`}${it.expertise ? " (Expertise)" : ""}`
      )
    )
  );

  // Shared action pools: one counter per resource drawn from.
  const poolMap = {};
  actions
    .filter((a) => a.usesMode === "shared" && a.sharedResource)
    .forEach((a) => {
      (poolMap[a.sharedResource] = poolMap[a.sharedResource] || []).push(a);
    });

  const coreCards = [
    ["Hit Points", sheet["Hit Points"]?.final ?? 0],
    ["Armor Class", sheet["Armor Class"]?.final ?? 10],
    ["Speed", sheet["Speed"]?.final ?? 0],
    ["Initiative", signed(sheet["Initiative"]?.final ?? 0)],
    ["Prof. Bonus", signed(sheet["Proficiency Bonus"]?.final ?? profBonus)],
    ["Hit Dice", `${sheet["Hit Dice"]?.final ?? 0}${sheet["Hit Dice"]?.size || "d8"}`],
    ["Spell Atk", signed(sheet["Spell Attacks"]?.final ?? 0)],
    ["Save DC", sheet["Save DCs"]?.final ?? 8],
  ];

  const derivedRows = BUILTIN_ROW_ORDER.filter(
    (k) =>
      !["STR", "DEX", "CON", "INT", "WIS", "CHA", "Hit Points", "Armor Class", "Speed", "Initiative", "Proficiency Bonus", "Hit Dice", "Spell Attacks", "Save DCs"].includes(k)
  );
  const derivedText = (k, d) => {
    if (k === "Creature Type") return d.text;
    if (k === "Size" || k === "Count as Size") return SIZE_LABELS[d.idx] ?? "Medium";
    return String(d.final ?? d);
  };

  const details = [
    ["Traits", character.traits], ["Ideals", character.ideals],
    ["Bonds", character.bonds], ["Flaws", character.flaws],
    ["Allies & Organizations", character.alliesOrganizations],
    ["Backstory", character.backstory], ["Notes", character.notes],
  ].filter(([, v]) => v);

  const appearance = character.appearance || {};
  const appearanceText = Object.entries(appearance).filter(([, v]) => v).map(([k, v]) => `${k[0].toUpperCase()}${k.slice(1)}: ${v}`).join(" · ");

  return (
    <div className="relative">
      {!innerRef && <PanelResizer />}
      {onExport && (
        <div className="mb-3 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setActOpen(true)}>
            <Play className="mr-1 h-4 w-4" /> Actions
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDiceOpen(true)}>
            <Dices className="mr-1 h-4 w-4" /> Dice
          </Button>
          <Button size="sm" onClick={onExport}>
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
        </div>
      )}
      <div
        ref={innerRef}
        className="space-y-5 bg-white p-8 font-body text-slate-900 shadow-xl"
        style={{ width: innerRef ? 760 : Math.max(480, panelWidth) }}
      >
        {/* Header */}
        <header className="rounded-lg bg-slate-900 px-6 py-4 text-white">
          <h1 className="text-2xl font-bold tracking-wide">{character.name || "Unnamed Character"}</h1>
          <p className="mt-0.5 text-xs text-slate-300">
            {[character.class, character.race, character.background, character.alignment]
              .filter(Boolean)
              .join(" · ") || "—"}
            {"  ·  Level "}{character.level || 1}
          </p>
        </header>

        {/* Ability scores */}
        <Section title="Ability Scores">
          <div className="grid grid-cols-6 gap-2">
            {["STR", "DEX", "CON", "INT", "WIS", "CHA"].map((s) => {
              const effective = Number(sheet[s]?.final ?? stats[s]) || 10;
              const abilBonus = Number(character.modifiers?.ability?.[s]) || 0;
              const mod = Math.floor((effective - 10) / 2) + abilBonus;
              return (
                <div key={s} className="rounded-lg border border-slate-300 py-2 text-center">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{s}</div>
                  <div className="text-xl font-bold">{effective}</div>
                  <div className="text-[11px] font-semibold text-slate-600">{signed(mod)}</div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Core stats */}
        <Section title="Combat & Core">
          <div className="grid grid-cols-4 gap-2">
            {coreCards.map(([label, value]) => (
              <StatCard key={label} label={label} value={value} />
            ))}
          </div>
        </Section>

        {/* Point pools */}
        <Section title="Point Pools">
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Heritage", usage.heritage, eff.heritage.total],
              ["Talent", usage.talent, eff.talent.total],
              ["Attribute", usage.attribute, eff.attribute.total],
            ].map(([label, used, total]) => (
              <div key={label} className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
                <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{label} Points</div>
                <div className="text-sm font-bold">
                  {used} <span className="text-slate-400">/ {total}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Derived resources */}
        <Section title="Derived Resources">
          <div className="grid grid-cols-3 gap-2">
            {derivedRows.map((k) => {
              const d = sheet[k];
              if (!d) return null;
              const display = derivedText(k, d);
              return (
                <div key={k} className="rounded-lg border border-slate-300 px-3 py-1.5">
                  <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{k}</div>
                  <div className="truncate text-sm font-semibold">{display}</div>
                </div>
              );
            })}
          </div>
          {customs.length > 0 && (
            <div className="mt-2 space-y-1">
              {customs.map((r) => {
                const die = resolveResourceDie(r, settings?.library);
                return (
                <div key={r.name} className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1 text-xs">
                  <span className="font-medium">{r.name}</span>
                  <span className="font-mono text-slate-700">
                    {r.value}
                    {die && /\d*d\d/.test(die.text) ? ` · ${die.text}` : ""}
                    {r.grant ? ` → ${r.grant.pool === "heritage" ? "Heritage" : r.grant.pool === "attribute" ? "Attribute" : "Talent"}${r.grant.variant === "specific" ? ` (${r.grant.name})` : ""} pts` : ""}
                    {r.recovery === "short" || r.recovery === "long"
                      ? ` · ${REST_LABEL[r.recovery]}${r.recoveryAmount ? ` +${r.recoveryAmount}` : " (full)"}`
                      : ""}
                  </span>
                </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Actions */}
        <Section title="Actions">
          {actions.length === 0 && <p className="text-xs text-slate-500">No actions granted yet.</p>}
          {ACTION_CATEGORIES.map(([key, label]) => {
            const own = actions.filter((a) => a.category === key && a.usesMode !== "shared");
            const poolEntries = Object.entries(poolMap).filter(([, list]) => list.some((a) => a.category === key));
            if (!own.length && !poolEntries.length) return null;
            return (
              <div key={key} className="mt-1.5">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
                {own.map((a) => {
                  const cur = Number(spent[a.id]) || 0;
                  const numeric = Number.isFinite(Number(a.ownUses));
                  const max = numeric ? Number(a.ownUses) : null;
                  return (
                    <div key={a.id} className="mt-1 rounded-md border border-slate-200 px-2 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">
                          {a.name}
                          {repeatsFor(a, vars) > 1 ? ` ×${repeatsFor(a, vars)}` : ""}
                        </span>
                        <span className="font-mono text-[10px] text-slate-600">
                          {a.usesMode === "atwill"
                            ? "At will"
                            : max != null
                            ? `${Math.max(0, max - cur)}/${max}`
                            : a.ownUses}
                          {REST_LABEL[a.recovery] ? ` · ${REST_LABEL[a.recovery]}${a.recoveryAmount ? ` +${a.recoveryAmount}` : ""}` : ""}
                        </span>
                      </div>
                      {a.description && <p className="mt-0.5 text-[10px] leading-snug text-slate-600">{a.description}</p>}
                      {(a.resolve || "none") !== "none" && character.actionChoices?.[a.id] && (
                        <p className="text-[10px] italic text-slate-500">
                          Using: {[].concat(character.actionChoices[a.id]).filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                  );
                })}
                {poolEntries.map(([name, list]) => {
                  const total = Number(vars[sanitizeKey(name)]) || 0;
                  const cur = Number(spent["shared:" + name]) || 0;
                  return (
                    <div key={name} className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">{name}</span>
                        <span className="font-mono text-[10px] text-slate-600">{Math.max(0, total - cur)}/{total}</span>
                      </div>
                      {list.map((a) => (
                        <p key={a.id} className="mt-0.5 text-[10px] leading-snug text-slate-600">
                          <span className="font-semibold text-slate-800">{a.name}:</span> {a.description || "No description."}
                        </p>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </Section>

        {/* Proficiencies */}
        {profLines.length > 0 && (
          <Section title="Proficiencies">
            <ul className="ml-4 list-disc space-y-0.5 text-xs">
              {profLines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </Section>
        )}

        {/* Inventory */}
        <Section title="Inventory">
          <div className="mb-1.5 flex flex-wrap gap-3 text-xs">
            {currencies.map((c) => {
              const key = c.key || String(c.name || "").toLowerCase();
              return (
                <span key={key}>
                  {c.name || key}: <span className="font-mono font-semibold">{coins[key] ?? 0}</span>
                </span>
              );
            })}
          </div>
          {items.length > 0 && (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-300 text-[9px] uppercase tracking-wide text-slate-500">
                  <th className="py-0.5">Item</th>
                  <th className="w-10">Qty</th>
                  <th className="w-16">lb</th>
                  <th className="w-20">Rarity</th>
                  <th className="w-20">Where</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-0.5">{it.name || "—"}</td>
                    <td>{it.qty ?? 1}</td>
                    <td>{((Number(it.weight) || 0) * (Number(it.qty) || 1)).toLocaleString()}</td>
                    <td>{it.rarity || "Common"}</td>
                    <td>
                      {it.location === "equipped"
                        ? "Equipped"
                        : it.location === "storage"
                          ? it.chest || "Storage"
                          : "Carried"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-2 text-[10px] text-slate-600">
            Carried: {carried.toLocaleString()} lb / {capacity.toLocaleString()} lb
          </div>
          <div className="mt-1">
            <CapacityBar character={character} tree={tree} carried={carried} capacity={capacity} />
          </div>
        </Section>

        {/* Spells */}
        {spells.length > 0 && (
          <Section title="Spells">
            {SPELL_LEVELS.map(([level, label]) => {
              const at = spells.filter((s) => (s.level || "cantrip") === level);
              if (at.length === 0) return null;
              return (
                <div key={level} className="mt-1">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
                  <ul className="ml-4 list-disc text-xs">
                    {at.map((s) => (
                      <li key={s.name + s.level}>
                        {s.name}
                        {s.repeats ? ` ×${s.repeats}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </Section>
        )}

        {/* Unlocked: Heritage Traits above Talents by type */}
        <Section title="Unlocked Talents">
          {unlocked.length === 0 && profGroups.length === 0 ? (
            <p className="text-xs text-slate-500">No talents unlocked yet.</p>
          ) : (
            <>
              {heritageNodes.length > 0 && (
                <div className="mb-2">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Heritage Traits</div>
                  <div className="mt-0.5 flex flex-wrap gap-1.5">
                    {heritageNodes.map((n) => (
                      <span key={n.id} title={n.description || ""} className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px]">
                        {n.name}
                        {n.maxPoints > 1 ? ` (${n.currentPoints}/${n.maxPoints})` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {talentGroups.map((g) => (
                <div key={g.type || "__untyped"} className="mb-2">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{g.type || "Untyped"}</div>
                  <div className="mt-0.5 space-y-0.5">
                    {g.nodes.map((n) => (
                      <details key={n.id} className="rounded-md border border-slate-200 px-2 py-1">
                        <summary className="cursor-pointer text-[11px] font-semibold">
                          {n.name}
                          {n.maxPoints > 1 ? ` (${n.currentPoints}/${n.maxPoints})` : ""}
                        </summary>
                        <p className="mt-0.5 text-[10px] leading-snug text-slate-600">
                          {n.description || "No description."}
                        </p>
                      </details>
                    ))}
                  </div>
                </div>
              ))}
              {attributeNodes.length > 0 && (
                <div className="mb-2">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Attributes</div>
                  <div className="mt-0.5 flex flex-wrap gap-1.5">
                    {attributeNodes.map((n) => (
                      <span key={n.id} className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px]">
                        {n.name}
                        {n.maxPoints > 1 ? ` (${n.currentPoints}/${n.maxPoints})` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {profGroups.map(([label, list]) => (
                <div key={label} className="mb-1">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                    {label} Proficiencies
                  </div>
                  <ul className="ml-4 list-disc text-[11px]">
                    {list.map((p, i) => (
                      <li key={i}>
                        {p.name || "—"}
                        {p.expertise ? " (Expertise)" : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          )}
        </Section>

        {/* Details */}
        {(appearanceText || details.length > 0) && (
          <Section title="Details">
            {appearanceText && <p className="text-xs text-slate-700">{appearanceText}</p>}
            {details.map(([label, value]) => (
              <div key={label} className="mt-1.5">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
                <p className="whitespace-pre-wrap text-xs leading-snug text-slate-700">{value}</p>
              </div>
            ))}
          </Section>
        )}

        <footer className="pt-1 text-center text-[9px] text-slate-400">
          {totalCoins(coins) > 0 ? `${totalCoins(coins).toLocaleString()} coins · ` : ""}
          I'm Trying's Terrific Talent Tree
        </footer>
      </div>

      <ActionActivationDialog open={actOpen} onClose={() => setActOpen(false)} />
      <DiceRoller open={diceOpen} onClose={() => setDiceOpen(false)} />
    </div>
  );
}