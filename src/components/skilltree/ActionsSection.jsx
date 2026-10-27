import { useState } from "react";
import {
  useTree,
  aggregateResources,
  statVars,
  profBonusFor,
  pushActivityLog,
} from "@/lib/treeStore";
import {
  mergeLibraryActions,
  collectActions,
  restRestore,
  buildVars,
  numericResourceMap,
  sanitizeKey,
  derivedSheet,
  ACTION_CATEGORIES,
  repeatsFor,
} from "@/lib/resources";
import { evalResource } from "@/lib/geometry";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { materialStatus, consumeMaterials } from "@/lib/spells";
import { SpellCastInfo } from "./SpellDetails";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronDown, Undo2 } from "lucide-react";

const REST_LABEL = {
  none: "no automatic recovery",
  short: "short rest",
  long: "long rest",
};

const restLabel = (a) =>
  a.recovery === "recharge"
    ? `recharge ${a.rechargeFrom ?? 5}–${a.rechargeTo ?? 6}`
    : a.recovery === "none"
      ? REST_LABEL.none
      : `${REST_LABEL[a.recovery]}${a.recoveryAmount ? ` +${a.recoveryAmount}` : " (full)"}`;

const PICK_LABEL = { weapon: "Choose a weapon…", spell: "Choose a spell…", item: "Choose an item…" };

// One or more pickers (one per repeat) for the weapon / spell / item an
// action uses; the picks persist on the character as an array.
function ResolvePicker({ action, options, emptyHint, vars, choices, onPick }) {
  if (!action.resolve || action.resolve === "none") return null;
  const reps = repeatsFor(action, vars);
  const cur = choices[action.id];
  const arr = Array.isArray(cur) ? cur : cur ? [cur] : [];
  return (
    <div className="mt-1 space-y-0.5">
      {Array.from({ length: reps }, (_, r) => (
        <Select key={r} value={arr[r] || ""} onValueChange={(v) => onPick(action.id, r, v)}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue
              placeholder={`${PICK_LABEL[action.resolve]}${reps > 1 ? ` (${r + 1} of ${reps})` : ""}`}
            />
          </SelectTrigger>
          <SelectContent>
            {options.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {options.length === 0 && <p className="text-[10px] text-muted-foreground">{emptyHint}</p>}
    </div>
  );
}

// Character-sheet action list. Actions are grouped by category, and inside
// each category split into two columns: the library's default actions on the
// left and actions granted by talents on the right. Each row is condensed —
// name, uses and Use/Undo on one line, with the description behind the
// chevron. Shared pools show one counter per resource; Short/Long Rest
// restores per each action's recovery setting.
export function ActionsSection() {
  const { mergedTree: tree, character, setCharacter, settings } = useTree();
  const levels = settings?.library?.levels || [];
  const [open, setOpen] = useState(true);
  const [openDesc, setOpenDesc] = useState({});
  const toggleDesc = (id) => setOpenDesc((o) => ({ ...o, [id]: !o[id] }));

  const aggregated = aggregateResources(tree, character, levels);
  const profBonus = profBonusFor(character.level || 1, levels);
  const stats = statVars(character, tree);
  const vars = buildVars(character.level, stats, profBonus, numericResourceMap(aggregated), character.hitDiceSize);
  const sheet = derivedSheet(character, tree, levels, aggregated, profBonus, stats, settings?.library);
  const spellAttack = Number(sheet["Spell Attacks"]?.final) || 0;
  const spellDC = Number(sheet["Save DCs"]?.final) || 8;

  const abilityMod = (stat) => {
    const raw = Number(stats?.[stat]);
    const base = Number.isFinite(raw) ? raw : 10;
    return Math.floor((base - 10) / 2) + (Number(character.modifiers?.ability?.[stat]) || 0);
  };
  const evalNum = (formula) => {
    const text = String(formula || "").trim();
    if (!text) return 0;
    const ev = evalResource(text, vars);
    const n = parseFloat(ev);
    return Number.isFinite(n) ? n : 0;
  };
  const weaponAbility = (w) => {
    const props = (w?.properties || []).map((p) => String(p).toLowerCase());
    if (props.includes("finesse")) {
      return abilityMod("DEX") > abilityMod("STR") ? "DEX" : "STR";
    }
    if (props.includes("ammunition") || props.includes("range") || /ranged/i.test(w?.category || "")) {
      return "DEX";
    }
    return "STR";
  };
  const chosenWeaponFor = (action) => {
    if (!action || action.resolve !== "weapon") return null;
    const pick = choices[action.id];
    const name = Array.isArray(pick) ? pick[0] : pick;
    if (!name) return null;
    return (
      (settings?.library?.weapons || []).find((w) => w.name === name) ||
      (character.inventory || []).find((it) => it.name === name && it.type === "Weapon") ||
      null
    );
  };
  const attackBonus = (part, action) => {
    if (part.kind === "spell") return spellAttack + evalNum(part.bonus);
    if (part.kind === "other") {
      return abilityMod(part.ability || "STR") + profBonus + evalNum(part.bonus);
    }
    const weapon = chosenWeaponFor(action);
    const ability = part.ability || weaponAbility(weapon);
    return (
      abilityMod(ability) +
      profBonus +
      (Number(character.modifiers?.weaponAttack) || 0) +
      evalNum(part.bonus)
    );
  };
  const saveDC = (part) =>
    part.dcMode === "fixed" ? Number(part.dc) || 0 : spellDC;
  const damageBonus = (part) =>
    (part.ability ? abilityMod(part.ability) : 0) + evalNum(part.bonus);

  const rollExpr = (expr, extra = 0) => {
    let total = Number(extra) || 0;
    const detail = [];
    let rest = String(expr || "");
    rest = rest.replace(/(\d*)d(\d+)/gi, (_, count, size) => {
      const n = Math.max(1, Number(count) || 1);
      const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * Number(size)));
      const sum = rolls.reduce((a, b) => a + b, 0);
      total += sum;
      detail.push(`${n}d${size} [${rolls.join(", ")}]`);
      return "0";
    });
    const leftover = rest.replace(/\s+/g, "").replace(/^\+/, "");
    if (leftover && !/^0*$/.test(leftover)) total += evalNum(leftover);
    return { total, detail: detail.join(" + ") };
  };

  const pushLog = (text) => setCharacter((c) => pushActivityLog(c, text));
  const rollPart = (action, part) => {
    if (part.type === "attack") {
      const d20 = 1 + Math.floor(Math.random() * 20);
      const bonus = attackBonus(part, action);
      pushLog(
        `${action.name} — ${part.label || "Attack"}: d20(${d20}) ${bonus >= 0 ? "+" : ""}${bonus} = ${d20 + bonus}`
      );
      return;
    }
    if (part.type === "damage") {
      const bonus = damageBonus(part);
      const { total, detail } = rollExpr(part.dice, bonus);
      pushLog(
        `${action.name} — Damage: ${detail || part.dice || "0"}${bonus ? ` ${bonus >= 0 ? "+" : ""}${bonus}` : ""} = ${total}${part.damageType ? ` ${part.damageType}` : ""}`
      );
      return;
    }
    if (part.type === "heal" || part.type === "temp") {
      const bonus = damageBonus(part);
      const { total, detail } = rollExpr(part.dice, bonus);
      pushLog(
        `${action.name} — ${part.type === "heal" ? "Healing" : "Temporary HP"}: ${detail || part.dice || "0"}${bonus ? ` ${bonus >= 0 ? "+" : ""}${bonus}` : ""} = ${total}`
      );
    }
  };
  const applyPartStatus = (action, part) => {
    if (!part.status) return;
    setCharacter((c) => ({
      ...c,
      activeStatuses: [...new Set([...(c.activeStatuses || []), part.status])],
    }));
    pushLog(`${action.name} — applied ${part.status}${part.duration ? ` (${part.duration})` : ""}`);
  };

  const partSummary = (part, action) => {
    if (part.type === "attack") {
      const bonus = attackBonus(part, action);
      return `${part.label || (part.kind === "spell" ? "Spell attack" : "Attack")} ${bonus >= 0 ? "+" : ""}${bonus}`;
    }
    if (part.type === "save") return `DC ${saveDC(part)} ${part.ability || "DEX"} save`;
    if (part.type === "damage") {
      const bonus = damageBonus(part);
      return `${part.dice || "—"}${bonus ? ` ${bonus >= 0 ? "+" : ""}${bonus}` : ""}${part.damageType ? ` ${part.damageType}` : ""}`;
    }
    if (part.type === "heal") return `Heal ${part.dice || "—"}`;
    if (part.type === "temp") return `Temp HP ${part.dice || "—"}`;
    if (part.type === "effect") {
      return [part.status, part.duration].filter(Boolean).join(" · ");
    }
    return "";
  };

  // Library defaults first, node-granted actions after; a node action with the
  // same name and category replaces its default.
  const actions = mergeLibraryActions(
    settings?.library?.actions || [],
    collectActions(tree, vars),
    vars
  );
  const spent = character.actionUses || {};
  const choices = character.actionChoices || {};
  const setChoiceAt = (id, idx, v) => {
    const cur = choices[id];
    const arr = Array.isArray(cur) ? [...cur] : cur ? [cur] : [];
    arr[idx] = v;
    setCharacter({ ...character, actionChoices: { ...choices, [id]: arr } });
  };

  // What the character can pick from when taking an action that requires a
  // weapon, a spell, or an item.
  const inventoryNames = (character.inventory || [])
    .map((it) => it.name)
    .filter(Boolean);
  const weaponNames = (character.inventory || [])
    .filter((it) => it.type === "Weapon")
    .map((it) => it.name)
    .filter(Boolean);
  const spellNames = (character.spellList || []).map((s) => s.name).filter(Boolean);
  const optionsFor = (resolve) => {
    if (resolve === "weapon") return [...new Set(["Unarmed Strike", ...weaponNames])];
    if (resolve === "spell") return [...new Set(spellNames)];
    return [...new Set(inventoryNames)];
  };

  // The library spell a spell-resolving action has picked, by name.
  const spellByName = Object.fromEntries(
    (character.spellList || []).map((s) => [s.name, s]).filter(([n]) => n)
  );
  const chosenSpellFor = (action) => {
    if (!action || action.resolve !== "spell") return null;
    const pick = choices[action.id];
    const name = Array.isArray(pick) ? pick[0] : pick;
    return spellByName[name] || null;
  };
  // A spell whose material components are missing can't be cast — unless
  // developer mode bypasses the check.
  const blockedFor = (action) => {
    if (!action || action.resolve !== "spell" || character.devMode) return false;
    const spell = chosenSpellFor(action);
    return !!spell && !materialStatus(spell, character).ok;
  };
  // An action requiring a status only works while that status is active on
  // the character (developer mode bypasses the check).
  const reqOkFor = (action) =>
    !action?.requiresStatus ||
    character.devMode ||
    (character.activeStatuses || []).includes(action.requiresStatus);
  const setSpent = (k, v, action) => {
    const patch = { actionUses: { ...spent, [k]: Math.max(0, Number(v) || 0) } };
    // Using an action can grant status effects (e.g. Raging), either through
    // the legacy single grant or through structured effect parts.
    const gained = [
      action?.grantsStatus,
      ...(action?.parts || [])
        .filter((p) => p?.type === "effect" && p.status)
        .map((p) => p.status),
    ].filter(Boolean);
    if (gained.length && v > (Number(spent[k]) || 0)) {
      const active = character.activeStatuses || [];
      patch.activeStatuses = [...new Set([...active, ...gained])];
    }
    // Casting consumes the chosen spell's material items and gold cost.
    const spell = action ? chosenSpellFor(action) : null;
    if (spell && !character.devMode) {
      const consumed = consumeMaterials(spell, character);
      if (consumed) {
        patch.inventory = consumed.inventory;
        if (consumed.coins) patch.coins = consumed.coins;
      }
    }
    setCharacter({ ...character, ...patch });
  };
  const doRest = (rest) => {
    // Also recharge wondrous item charges whose recharge time matches this rest.
    const inventory = (character.inventory || []).map((it) => {
      if (it.chargesMax === "" || it.chargesMax == null) return it;
      const rec = String(it.recharge || "").toLowerCase();
      const isLong = rec.includes("long") || rec.includes("dawn") || rec.includes("day");
      const isShort = rec.includes("short") || rec.includes("hour");
      const restore = rest === "long" ? isLong || isShort : isShort && !isLong;
      return restore ? { ...it, chargesCurrent: Number(it.chargesMax) } : it;
    });
    setCharacter({ ...character, actionUses: restRestore(actions, spent, rest), inventory });
  };

  // Group shared actions by their resource.
  const pools = {};
  actions
    .filter((a) => a.usesMode === "shared" && a.sharedResource)
    .forEach((a) => {
      if (!pools[a.sharedResource]) pools[a.sharedResource] = [];
      pools[a.sharedResource].push(a);
    });

  // One condensed action row: name + repeats and the use counter on a single
  // line; source, badges, description and pickers behind the chevron.
  const renderRow = (a) => {
    const cur = Number(spent[a.id]) || 0;
    const numeric = Number.isFinite(Number(a.ownUses));
    const max = numeric ? Number(a.ownUses) : null;
    return (
      <div key={a.id} className="mt-0.5 rounded bg-muted/40 px-1.5 py-1">
        <div className="flex items-center justify-between gap-1">
          <button
            className="flex min-w-0 items-center gap-0.5 text-left"
            onClick={() => toggleDesc(a.id)}
            title="Toggle description"
          >
            <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${openDesc[a.id] ? "" : "-rotate-90"}`} />
            <span className="truncate text-[11px] font-medium">
              {a.name}
              {repeatsFor(a, vars) > 1 ? ` ×${repeatsFor(a, vars)}` : ""}
            </span>
          </button>
          {numeric && max > 0 ? (
            <div className="flex shrink-0 items-center gap-0.5">
              <span className="font-mono text-[10px]">{Math.max(0, max - cur)}/{max}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1.5"
                disabled={cur >= max || blockedFor(a) || !reqOkFor(a)}
                onClick={() => setSpent(a.id, cur + 1, a)}
              >
                Use
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1"
                disabled={cur <= 0}
                onClick={() => setSpent(a.id, cur - 1)}
              >
                <Undo2 className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
              {max != null && max <= 0 ? "0" : a.usesMode === "atwill" ? "At will" : (a.ownUses ?? "")}
            </span>
          )}
        </div>
        {openDesc[a.id] && (
          <div className="mt-1 border-t pt-1">
            <div className="mb-0.5 flex flex-wrap items-center gap-1 text-[9px] text-muted-foreground">
              <span className="font-medium">{a.nodeName}</span>
              <span>· {restLabel(a)}</span>
              {a.trigger && <span className="rounded bg-sky-100 px-1 py-0.5 text-sky-700 dark:bg-sky-950 dark:text-sky-300">⚡ {a.trigger}</span>}
              {a.requiresStatus && (
                <span
                  className={`rounded px-1 py-0.5 ${
                    reqOkFor(a)
                      ? "bg-muted text-muted-foreground"
                      : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                  }`}
                >
                  Requires: {a.requiresStatus}
                </span>
              )}
              {a.grantsStatus && (
                <span className="rounded bg-emerald-100 px-1 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  Grants: {a.grantsStatus}
                </span>
              )}
            </div>
            {(a.parts || []).length > 0 && (
              <div className="mb-1 space-y-1">
                <div className="flex flex-wrap gap-1">
                  {(a.parts || [])
                    .map((part, j) => [part, partSummary(part, a), j])
                    .filter(([, text]) => text)
                    .map(([part, text, j]) => (
                      <span
                        key={j}
                        className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium"
                      >
                        {text}
                      </span>
                    ))}
                </div>
                {(a.target || a.range || a.duration || a.concentration) && (
                  <p className="text-[10px] text-muted-foreground">
                    {[a.target, a.range, a.duration, a.concentration ? "concentration" : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                <div className="flex flex-wrap gap-1">
                  {(a.parts || []).map((part, j) =>
                    ["attack", "damage", "heal", "temp"].includes(part.type) ? (
                      <Button
                        key={`roll-${j}`}
                        size="sm"
                        variant="outline"
                        className="h-6 px-1.5 text-[10px]"
                        onClick={() => rollPart(a, part)}
                      >
                        Roll {part.type === "attack" ? part.label || "attack" : part.type === "temp" ? "temp HP" : part.type}
                      </Button>
                    ) : part.type === "effect" && part.status ? (
                      <Button
                        key={`effect-${j}`}
                        size="sm"
                        variant="outline"
                        className="h-6 px-1.5 text-[10px]"
                        onClick={() => applyPartStatus(a, part)}
                      >
                        Apply {part.status}
                      </Button>
                    ) : null
                  )}
                </div>
              </div>
            )}
            <p className="text-[10px] leading-snug text-muted-foreground">{a.description || "No description."}</p>
            <ResolvePicker
              action={a}
              options={optionsFor(a.resolve)}
              emptyHint={
                a.resolve === "spell"
                  ? "No spells known — add them to the Spell List."
                  : "Nothing in inventory yet."
              }
              vars={vars}
              choices={choices}
              onPick={setChoiceAt}
            />
            {a.resolve === "spell" && (
              <SpellCastInfo spell={chosenSpellFor(a)} action={a} character={character} />
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <button className="flex items-center gap-1" onClick={() => setOpen(!open)}>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`} />
          <Label>Actions</Label>
        </button>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => doRest("short")}>Short Rest</Button>
          <Button size="sm" variant="outline" onClick={() => doRest("long")}>Long Rest</Button>
        </div>
      </div>
      {open && (
        <div className="mt-1.5 space-y-2">
          {actions.length === 0 && (
            <p className="text-xs text-muted-foreground">No actions yet — add them to nodes in the editor.</p>
          )}
          {ACTION_CATEGORIES.map(([key, label]) => {
            const own = actions.filter((a) => a.category === key && a.usesMode !== "shared");
            if (!own.length) return null;
            const defaults = own.filter((a) => a.nodeName === "Default");
            const granted = own.filter((a) => a.nodeName !== "Default");
            const poolEntries = Object.entries(pools).filter(([, list]) =>
              list.some((a) => a.category === key)
            );
            return (
              <div key={key}>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </div>
                <div className="mt-0.5 grid grid-cols-2 gap-1.5">
                  <div className="min-w-0">
                    <div className="text-[9px] font-medium text-muted-foreground">Defaults</div>
                    {defaults.map(renderRow)}
                    {defaults.length === 0 && (
                      <p className="text-[10px] text-muted-foreground">None</p>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] font-medium text-muted-foreground">From talents</div>
                    {granted.map(renderRow)}
                    {granted.length === 0 && (
                      <p className="text-[10px] text-muted-foreground">None</p>
                    )}
                  </div>
                </div>
                {poolEntries.map(([name, list]) => {
                  const total = Number(vars[sanitizeKey(name)]) || 0;
                  const cur = Number(spent["shared:" + name]) || 0;
                  return (
                    <div key={name} className="mt-1 rounded-md border px-2 py-1">
                      <div className="flex items-center justify-between gap-1">
                        <button
                          className="flex min-w-0 items-center gap-1 text-left"
                          onClick={() => toggleDesc("pool:" + name)}
                          title="Toggle descriptions"
                        >
                          <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${openDesc["pool:" + name] ? "" : "-rotate-90"}`} />
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium">{name}</div>
                            <div className="truncate text-[10px] text-muted-foreground">
                              shared pool · {list.map((a) => a.name).join(", ")} · {restLabel(list[0])}
                            </div>
                          </div>
                        </button>
                        {total > 0 && (
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="font-mono text-xs">{Math.max(0, total - cur)}/{total}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={cur >= total || list.some((a) => blockedFor(a) || !reqOkFor(a))}
                              onClick={() =>
                                setSpent(
                                  "shared:" + name,
                                  cur + 1,
                                  list.find((a) => a.resolve === "spell" && chosenSpellFor(a))
                                )
                              }
                            >
                              Use
                            </Button>
                            <Button size="sm" variant="ghost" disabled={cur <= 0} onClick={() => setSpent("shared:" + name, cur - 1)}>
                              <Undo2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        {total <= 0 && (
                          <span className="font-mono text-xs text-muted-foreground">0/0</span>
                        )}
                      </div>
                      {openDesc["pool:" + name] && (
                        <div className="mt-1 space-y-1 border-t pt-1">
                          {list.map((a) => (
                            <div key={a.id} className="text-[11px] leading-snug text-muted-foreground">
                              <p>
                                <span className="font-medium text-foreground">{a.name}:</span>{" "}
                                {a.description || "No description."}
                              </p>
                              <ResolvePicker
                                action={a}
                                options={optionsFor(a.resolve)}
                                emptyHint={
                                  a.resolve === "spell"
                                    ? "No spells known — add them to the Spell List."
                                    : "Nothing in inventory yet."
                                }
                                vars={vars}
                                choices={choices}
                                onPick={setChoiceAt}
                              />
                              {a.resolve === "spell" && (
                                <SpellCastInfo spell={chosenSpellFor(a)} action={a} character={character} />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {(() => {
            // Actions carried by wondrous items in inventory, with charges.
            const wondrous = (character.inventory || []).filter(
              (it) => (it.itemActions || []).length > 0
            );
            if (wondrous.length === 0) return null;
            return (
              <div className="mt-2 rounded-md border p-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Wondrous Item Actions
                </div>
                {wondrous.map((it) => {
                  const idx = (character.inventory || []).indexOf(it);
                  const hasCharges = it.chargesMax !== "" && it.chargesMax != null;
                  const max = hasCharges ? Number(it.chargesMax) : null;
                  const cur = hasCharges ? Number(it.chargesCurrent ?? max) : null;
                  const spendCharge = (act) => {
                    if (!hasCharges) return;
                    const next = [...(character.inventory || [])];
                    next[idx] = { ...it, chargesCurrent: Math.max(0, cur - Number(act.chargeCost || 0)) };
                    setCharacter({ ...character, inventory: next });
                  };
                  return (
                    <div key={it.name + idx} className="mt-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-medium">{it.name || "Unnamed item"}</span>
                        {hasCharges && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {cur}/{max} charges
                          </span>
                        )}
                      </div>
                      {(it.itemActions || []).map((act, j) => (
                        <div
                          key={j}
                          className="mt-0.5 flex items-center justify-between gap-1 rounded bg-muted/50 px-2 py-0.5"
                        >
                          <span className="truncate text-xs">
                            {act.name}
                            {act.chargeCost
                              ? ` · ${act.chargeCost} charge${Number(act.chargeCost) > 1 ? "s" : ""}`
                              : ""}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={hasCharges && cur < Number(act.chargeCost || 0)}
                            onClick={() => spendCharge(act)}
                          >
                            Use
                          </Button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}