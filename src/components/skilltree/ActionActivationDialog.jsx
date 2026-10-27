import { useState } from "react";
import { useTree, aggregateResources, statVars, profBonusFor, pushActivityLog } from "@/lib/treeStore";
import {
  mergeLibraryActions,
  collectActions,
  buildVars,
  numericResourceMap,
  sanitizeKey,
  ACTION_CATEGORIES,
  derivedSheet,
  repeatsFor,
} from "@/lib/resources";
import { evalResource } from "@/lib/geometry";
import { consumeMaterials } from "@/lib/spells";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Undo2 } from "lucide-react";

const PICK_LABEL = { weapon: "Choose a weapon…", spell: "Choose a spell…", item: "Choose an item…" };

// View-mode action activation: activating an action consumes its resource
// (own uses, a shared pool, or wondrous-item charges) and logs what the
// character is doing — "Grimm attacks with Longsword".
export function ActionActivationDialog({ open, onClose }) {
  const { mergedTree: tree, character, setCharacter, settings } = useTree();
  const levels = settings?.library?.levels || [];
  const [targetAC, setTargetAC] = useState("");

  const aggregated = aggregateResources(tree, character, levels);
  const profBonus = profBonusFor(character.level || 1, levels);
  const stats = statVars(character, tree);
  const vars = buildVars(character.level, stats, profBonus, numericResourceMap(aggregated), character.hitDiceSize);
  const sheet = derivedSheet(character, tree, levels, aggregated, profBonus, stats, settings?.library);
  const abilityMod = (stat) => {
    const raw = Number(stats?.[stat]);
    return Math.floor(((Number.isFinite(raw) ? raw : 10) - 10) / 2) +
      (Number(character.modifiers?.ability?.[stat]) || 0);
  };
  const evalNum = (formula) => {
    const text = String(formula || "").trim();
    if (!text) return 0;
    const n = parseFloat(evalResource(text, vars));
    return Number.isFinite(n) ? n : 0;
  };
  const rollDice = (expr, extra = 0) => {
    let total = Number(extra) || 0;
    const detail = [];
    let rest = String(expr || "");
    rest = rest.replace(/(\d*)d(\d+)/gi, (_, count, size) => {
      const n = Math.max(1, Number(count) || 1);
      const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * Number(size)));
      total += rolls.reduce((a, b) => a + b, 0);
      detail.push(`${n}d${size} [${rolls.join(", ")}]`);
      return "0";
    });
    const leftover = rest.replace(/\s+/g, "").replace(/^\+/, "");
    if (leftover && !/^0*$/.test(leftover)) total += evalNum(leftover);
    return { total, detail: detail.join(" + ") };
  };
  const partLines = (action) => {
    const lines = [];
    (action.parts || []).forEach((part) => {
      if (part.type === "attack") {
        const d20 = 1 + Math.floor(Math.random() * 20);
        const bonus =
          part.kind === "spell"
            ? Number(sheet["Spell Attacks"]?.final || 0) + evalNum(part.bonus)
            : profBonus +
              (part.ability ? abilityMod(part.ability) : Math.max(abilityMod("STR"), abilityMod("DEX"))) +
              (Number(character.modifiers?.weaponAttack) || 0) +
              evalNum(part.bonus);
        const ac = Number(targetAC) || 0;
        lines.push(
          `${part.label || "Attack"}: d20(${d20}) ${fmt(bonus)} = ${d20 + bonus}${
            ac ? ` vs AC ${ac} → ${d20 + bonus >= ac ? "Hit!" : "Miss"}` : ""
          }`
        );
      } else if (part.type === "damage") {
        const bonus = (part.ability ? abilityMod(part.ability) : 0) + evalNum(part.bonus);
        const { total, detail } = rollDice(part.dice, bonus);
        if (detail || part.dice || bonus) {
          lines.push(
            `Damage: ${detail || part.dice || "0"}${bonus ? ` ${fmt(bonus)}` : ""} = ${total}${
              part.damageType ? ` ${part.damageType}` : ""
            }`
          );
        }
      } else if (part.type === "heal") {
        const bonus = (part.ability ? abilityMod(part.ability) : 0) + evalNum(part.bonus);
        const { total, detail } = rollDice(part.dice, bonus);
        if (detail || part.dice) lines.push(`Healing: ${detail || part.dice} = ${total}`);
      } else if (part.type === "temp") {
        const { total, detail } = rollDice(part.dice, evalNum(part.bonus));
        if (detail || part.dice) lines.push(`Temporary HP: ${detail || part.dice} = ${total}`);
      } else if (part.type === "save") {
        const dc = part.dcMode === "fixed" ? Number(part.dc) || 0 : Number(sheet["Save DCs"]?.final || 0);
        lines.push(`DC ${dc} ${part.ability || "DEX"} save`);
      }
    });
    return lines;
  };
  const actions = mergeLibraryActions(
    settings?.library?.actions || [],
    collectActions(tree, vars),
    vars
  );
  const spent = character.actionUses || {};
  const choices = character.actionChoices || {};

  const spellByName = Object.fromEntries(
    (character.spellList || []).map((s) => [s.name, s]).filter(([n]) => n)
  );
  const inventoryNames = (character.inventory || []).map((it) => it.name).filter(Boolean);
  const weaponNames = (character.inventory || [])
    .filter((it) => it.type === "Weapon")
    .map((it) => it.name)
    .filter(Boolean);
  const optionsFor = (resolve) => {
    if (resolve === "weapon") return [...new Set(["Unarmed Strike", ...weaponNames])];
    if (resolve === "spell") return [...new Set(spellNames(spellByName))];
    return [...new Set(inventoryNames)];
  };
  function spellNames(map) {
    return Object.keys(map);
  }

  const setChoiceAt = (id, idx, v) => {
    const cur = choices[id];
    const arr = Array.isArray(cur) ? [...cur] : cur ? [cur] : [];
    arr[idx] = v;
    setCharacter({ ...character, actionChoices: { ...choices, [id]: arr } });
  };

  const pickOf = (a) => {
    const p = choices[a.id];
    return Array.isArray(p) ? p[0] : p;
  };

  // "Acting as" — the player themselves or the character; saved on the sheet.
  const actor = character.actionActor || "character";
  const who = actor === "me" ? "I" : character.name || "The character";

  const sentenceFor = (a) => {
    const pick = pickOf(a);
    const reps = repeatsFor(a, vars);
    const repTag = reps > 1 ? ` (×${reps})` : "";
    if (a.resolve === "weapon") return `${who} attacks with ${pick || "a weapon"}${repTag}`;
    if (a.resolve === "spell") return `${who} casts ${pick || "a spell"}${repTag}`;
    if (a.resolve === "item") return `${who} uses ${pick || "an item"}${repTag}`;
    return `${who} uses ${a.name}${repTag}`;
  };

  // Every activation lands in the character's activity log, shown on the
  // View screen.
  const pushLog = (line) => setCharacter((c) => pushActivityLog(c, line));

  const fmt = (n) => (n >= 0 ? `+${n}` : String(n));

  // An attack action rolls its d20 automatically: prof + best of STR/DEX
  // (+ the weapon-attack modifier), checked against the Target AC when set.
  const attackLine = (pick) => {
    const d = 1 + Math.floor(Math.random() * 20);
    const str = Number(stats.STR) || 10;
    const dex = Number(stats.DEX) || 10;
    const statMod = Math.floor((Math.max(str, dex) - 10) / 2);
    const bonus =
      profBonus + statMod + (Number(character.modifiers?.weaponAttack) || 0);
    const ac = Number(targetAC) || 0;
    return `attack d20(${d}) ${fmt(bonus)} = ${d + bonus}${
      ac ? ` vs AC ${ac} → ${d + bonus >= ac ? "Hit!" : "Miss"}` : " (set Target AC to check hit/miss)"
    }`;
  };

  // Consume the action's resource and log the activity line. Spells also
  // consume their material components unless dev mode is on.
  const activate = (a) => {
    const key = a.usesMode === "shared" ? "shared:" + a.sharedResource : a.id;
    const max =
      a.usesMode === "own"
        ? Number(a.ownUses)
        : a.usesMode === "shared"
        ? Number(vars[sanitizeKey(a.sharedResource)]) || 0
        : null;
    const cur = Number(spent[key]) || 0;
    if (max != null && cur >= max) return;
    const patch = { actionUses: { ...spent } };
    if (max != null) patch.actionUses[key] = cur + 1;
    const gained = [
      a.grantsStatus,
      ...(a.parts || [])
        .filter((p) => p?.type === "effect" && p.status)
        .map((p) => p.status),
    ].filter(Boolean);
    if (gained.length) {
      patch.activeStatuses = [...new Set([...(character.activeStatuses || []), ...gained])];
    }
    const spell = a.resolve === "spell" ? spellByName[pickOf(a)] : null;
    if (spell && !character.devMode) {
      const consumed = consumeMaterials(spell, character);
      if (consumed) {
        patch.inventory = consumed.inventory;
        if (consumed.coins) patch.coins = consumed.coins;
      }
    }
    setCharacter({ ...character, ...patch });
    const line = sentenceFor(a);
    const parts = partLines(a);
    pushLog(
      parts.length
        ? `${line} — ${parts.join("; ")}`
        : a.resolve === "weapon" && pickOf(a)
          ? `${line} — ${attackLine(pickOf(a))}`
          : line
    );
  };

  const undo = (a) => {
    const key = a.usesMode === "shared" ? "shared:" + a.sharedResource : a.id;
    const cur = Number(spent[key]) || 0;
    if (cur <= 0) return;
    setCharacter({ ...character, actionUses: { ...spent, [key]: cur - 1 } });
  };

  const rowsFor = (key) =>
    actions
      .filter((a) => a.category === key && a.usesMode !== "shared")
      .sort((a, b) => (a.nodeName === "Default" ? -1 : 1) - (b.nodeName === "Default" ? -1 : 1));

  const poolMap = {};
  actions
    .filter((a) => a.usesMode === "shared" && a.sharedResource)
    .forEach((a) => {
      (poolMap[a.sharedResource] = poolMap[a.sharedResource] || []).push(a);
    });

  const wondrous = (character.inventory || []).filter((it) => (it.itemActions || []).length > 0);

  const activateWondrous = (it, idx, act) => {
    const hasCharges = it.chargesMax !== "" && it.chargesMax != null;
    const cur = hasCharges ? Number(it.chargesCurrent ?? it.chargesMax) : null;
    if (hasCharges && cur < Number(act.chargeCost || 0)) return;
    const next = [...(character.inventory || [])];
    next[idx] = {
      ...it,
      chargesCurrent: hasCharges ? Math.max(0, cur - Number(act.chargeCost || 0)) : cur,
    };
    setCharacter({ ...character, inventory: next });
    pushLog(`${who} uses ${it.name || "an item"} — ${act.name}`);
  };

  const recentLog = (character.activityLog || []).slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Activate an action</DialogTitle>
          <DialogDescription>
            Using an action spends its resource and records what {character.name || "the character"} is doing.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="shrink-0 text-[10px] text-muted-foreground">Target AC (for attack rolls)</Label>
            <Input
              type="number"
              className="h-8 w-24"
              value={targetAC}
              onChange={(e) => setTargetAC(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="shrink-0 text-[10px] text-muted-foreground">Acting as</Label>
            <Select
              value={actor}
              onValueChange={(v) => setCharacter({ ...character, actionActor: v })}
            >
              <SelectTrigger className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="character">{character.name || "My character"}</SelectItem>
                <SelectItem value="me">Me (the player)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {actions.length === 0 && wondrous.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No actions yet — add them to nodes in the editor or to wondrous items in the inventory.
            </p>
          )}
          {ACTION_CATEGORIES.map(([key, label]) => {
            const rows = rowsFor(key);
            const pools = Object.entries(poolMap).filter(([, list]) =>
              list.some((a) => a.category === key)
            );
            if (!rows.length && !pools.length) return null;
            return (
              <div key={key}>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </div>
                {rows.map((a) => {
                  const k = a.usesMode === "shared" ? "shared:" + a.sharedResource : a.id;
                  const max =
                    a.usesMode === "own"
                      ? Number(a.ownUses)
                      : a.usesMode === "shared"
                      ? Number(vars[sanitizeKey(a.sharedResource)]) || 0
                      : null;
                  const cur = Number(spent[k]) || 0;
                  const pick = pickOf(a);
                  const reps = repeatsFor(a, vars);
                  const arr = Array.isArray(choices[a.id]) ? choices[a.id] : pick ? [pick] : [];
                  return (
                    <div key={a.id} className="mt-1 rounded-md border px-2 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium">
                            {a.name}
                            {reps > 1 ? ` ×${reps}` : ""}
                          </div>
                          <div className="truncate text-[10px] text-muted-foreground">{a.nodeName}</div>
                        </div>
                        {max != null ? (
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="font-mono text-[10px]">
                              {Math.max(0, max - cur)}/{max}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={cur >= max}
                              onClick={() => activate(a)}
                            >
                              <Play className="h-3 w-3" /> Activate
                            </Button>
                            <Button size="sm" variant="ghost" disabled={cur <= 0} onClick={() => undo(a)}>
                              <Undo2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => activate(a)}>
                            <Play className="h-3 w-3" /> Activate
                          </Button>
                        )}
                      </div>
                      {(a.resolve || "none") !== "none" && (
                        <div className="mt-1 space-y-0.5">
                          {Array.from({ length: reps }, (_, r) => (
                            <Select
                              key={r}
                              value={arr[r] || ""}
                              onValueChange={(v) => setChoiceAt(a.id, r, v)}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue
                                  placeholder={`${PICK_LABEL[a.resolve]}${reps > 1 ? ` (${r + 1} of ${reps})` : ""}`}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {optionsFor(a.resolve).map((name) => (
                                  <SelectItem key={name} value={name}>
                                    {name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ))}
                          {optionsFor(a.resolve).length === 0 && (
                            <p className="text-[10px] text-muted-foreground">
                              {a.resolve === "spell"
                                ? "No spells known — add them to the Spell List."
                                : "Nothing in inventory yet."}
                            </p>
                          )}
                        </div>
                      )}
                      {a.description && (
                        <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{a.description}</p>
                      )}
                    </div>
                  );
                })}
                {pools.map(([name, list]) => {
                  const total = Number(vars[sanitizeKey(name)]) || 0;
                  const cur = Number(spent["shared:" + name]) || 0;
                  return (
                    <div key={name} className="mt-1 flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-2 py-1.5">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium">{name}</div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {list.map((a) => a.name).join(", ")}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="font-mono text-[10px]">
                          {Math.max(0, total - cur)}/{total}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={cur >= total || total <= 0}
                          onClick={() =>
                            activate(list.find((a) => a.resolve === "spell") || list[0])
                          }
                        >
                          <Play className="h-3 w-3" /> Activate
                        </Button>
                        <Button size="sm" variant="ghost" disabled={cur <= 0} onClick={() => undo(list[0])}>
                          <Undo2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {wondrous.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Wondrous Item Actions
              </div>
              {wondrous.map((it) => {
                const idx = (character.inventory || []).indexOf(it);
                const hasCharges = it.chargesMax !== "" && it.chargesMax != null;
                const max = hasCharges ? Number(it.chargesMax) : null;
                const cur = hasCharges ? Number(it.chargesCurrent ?? max) : null;
                return (
                  <div key={it.name + idx} className="mt-1 rounded-md border px-2 py-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{it.name || "Unnamed item"}</span>
                      {hasCharges && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {cur}/{max} charges
                        </span>
                      )}
                    </div>
                    {(it.itemActions || []).map((act, j) => (
                      <div key={j} className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="truncate text-[11px]">
                          {act.name}
                          {act.chargeCost ? ` · ${act.chargeCost} charge${Number(act.chargeCost) > 1 ? "s" : ""}` : ""}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={hasCharges && cur < Number(act.chargeCost || 0)}
                          onClick={() => activateWondrous(it, idx, act)}
                        >
                          <Play className="h-3 w-3" /> Activate
                        </Button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <Label className="text-[10px] text-muted-foreground">Activity log</Label>
          <div className="mt-1 max-h-32 space-y-0.5 overflow-y-auto rounded-md bg-muted/50 p-2">
            {recentLog.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">Nothing yet — activate an action above.</p>
            ) : (
              recentLog.map((e, i) => (
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