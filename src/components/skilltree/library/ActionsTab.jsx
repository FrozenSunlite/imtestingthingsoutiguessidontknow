import { useState } from "react";
import { useTree } from "@/lib/treeStore";
import { ListHeader, EmptyNote } from "./shared";
import { matchesQuery } from "@/lib/textSearch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import { InfoTip } from "@/components/skilltree/InfoTip";
import {
  ActionPartsEditor,
  ActionTargetingFields,
} from "@/components/skilltree/ActionPartsEditor";

// Reference Library tab: the default combat actions (Attack, Dash, Dodge…)
// that node actions can be created from. Entries are fully modifiable and may
// carry optional quantity settings: their own use count, or draws from a
// shared resource pool (e.g. Superiority Dice), plus rest recovery.
export function ActionsTab() {
  const { settings, setSettings } = useTree();
  const actions = settings?.library?.actions || [];
  const triggers = settings?.library?.triggers || [];
  const statuses = (settings?.library?.statusEffects || [])
    .map((s) => s?.name)
    .filter(Boolean);
  const setActions = (next) =>
    setSettings((s) => ({ ...s, library: { ...s.library, actions: next } }));
  const [q, setQ] = useState("");

  const filtered = actions
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => matchesQuery(a?.name, q));
  const add = () =>
    setActions([...actions, { name: "", description: "", category: "action", usesMode: "atwill" }]);
  const patch = (i, p) => {
    const next = [...actions];
    next[i] = { ...next[i], ...p };
    setActions(next);
  };
  const remove = (i) => setActions(actions.filter((_, j) => j !== i));

  return (
    <div className="space-y-2">
      <ListHeader
        onAdd={add}
        addLabel="Add action"
        query={q}
        setQuery={setQ}
        searchPlaceholder="Search actions…"
      />
      {filtered.length === 0 ? (
        <EmptyNote items={actions} query={q} />
      ) : (
        filtered.map(({ a, i }) => {
          const um = a.usesMode || "atwill";
          return (
            <div key={i} className="space-y-1.5 rounded-md border p-2">
              <div className="flex items-center gap-1.5">
                <InfoTip label="The action's name, e.g. Dodge.">
                  <Input
                    className="h-8 flex-1"
                    placeholder="Action name (e.g. Dodge)"
                    value={a.name || ""}
                    onChange={(e) => patch(i, { name: e.target.value })}
                  />
                </InfoTip>
                <Select
                  value={a.category || "action"}
                  onValueChange={(v) => patch(i, { category: v })}
                >
                  <InfoTip label="When the action can be taken: Action, Bonus Action, Free or Reaction.">
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                  </InfoTip>
                  <SelectContent>
                    <SelectItem value="action">Action</SelectItem>
                    <SelectItem value="bonus">Bonus Action</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="reaction">Reaction</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" onClick={() => remove(i)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <InfoTip label="What the action does — shown on the sheet.">
                <Textarea
                  className="min-h-12 text-xs"
                  placeholder="What does this action do?"
                  value={a.description || ""}
                  onChange={(e) => patch(i, { description: e.target.value })}
                />
              </InfoTip>
              <details className="rounded border px-1.5 py-1">
                <summary className="cursor-pointer text-[10px] font-medium text-muted-foreground">
                  Combat details — target, attack, save, damage
                  {(a.parts || []).length ? ` (${(a.parts || []).length} part${(a.parts || []).length === 1 ? "" : "s"})` : ""}
                </summary>
                <div className="mt-1.5 space-y-1.5">
                  <ActionTargetingFields action={a} onChange={(p) => patch(i, p)} />
                  <ActionPartsEditor
                    parts={a.parts || []}
                    onChange={(parts) => patch(i, { parts })}
                    statuses={statuses}
                    damageTypes={settings?.library?.damageTypes || []}
                  />
                </div>
              </details>
              {/* Optional quantity: at-will, its own use count, or a shared pool. */}
              <div className="grid grid-cols-3 gap-1.5">
                <Select value={um} onValueChange={(v) => patch(i, { usesMode: v })}>
                  <InfoTip label="At will, a fixed use count, or drawing from a shared resource pool.">
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  </InfoTip>
                  <SelectContent>
                    <SelectItem value="atwill">At will</SelectItem>
                    <SelectItem value="own">Own uses</SelectItem>
                    <SelectItem value="shared">Shared pool</SelectItem>
                  </SelectContent>
                </Select>
                {um === "own" && (
                  <InfoTip label="Uses per recovery — a number or a formula like prof.">
                    <Input
                      className="h-8"
                      placeholder="Uses (e.g. 4 or prof)"
                      value={a.uses ?? "1"}
                      onChange={(e) => patch(i, { uses: e.target.value })}
                    />
                  </InfoTip>
                )}
                {um === "shared" && (
                  <InfoTip label="Name of the shared resource pool this action spends, e.g. Superiority Dice.">
                    <Input
                      className="h-8"
                      placeholder="Resource (e.g. Superiority Dice)"
                      value={a.sharedResource || ""}
                      onChange={(e) => patch(i, { sharedResource: e.target.value })}
                    />
                  </InfoTip>
                )}
                {um === "atwill" && <span />}
                <Select value={a.recovery || "none"} onValueChange={(v) => patch(i, { recovery: v })}>
                  <InfoTip label="Which rest refills uses: none, short rest or long rest.">
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  </InfoTip>
                  <SelectContent>
                    <SelectItem value="none">No recovery</SelectItem>
                    <SelectItem value="short">Short rest</SelectItem>
                    <SelectItem value="long">Long rest</SelectItem>
                    <SelectItem value="recharge">Recharge (d6)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {a.recovery === "recharge" && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Recharges on a d6 roll of</span>
                  <InfoTip label="The action becomes available again when you roll this range or higher on a d6, starting each turn.">
                    <Input
                      className="h-8 w-14 text-center"
                      type="number"
                      min={1}
                      max={6}
                      value={a.rechargeFrom ?? 5}
                      onChange={(e) => patch(i, { rechargeFrom: Math.min(6, Math.max(1, Number(e.target.value) || 5)) })}
                    />
                  </InfoTip>
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input
                    className="h-8 w-14 text-center"
                    type="number"
                    min={1}
                    max={6}
                    value={a.rechargeTo ?? 6}
                    onChange={(e) => patch(i, { rechargeTo: Math.min(6, Math.max(1, Number(e.target.value) || 6)) })}
                  />
                </div>
              )}
              {(a.recovery === "short" || a.recovery === "long") && um !== "atwill" && (
                <InfoTip label="Amount regained per rest; blank regains everything.">
                  <Input
                    className="h-8"
                    placeholder="Recovery amount per rest (blank = full)"
                    value={a.recoveryAmount || ""}
                    onChange={(e) => patch(i, { recoveryAmount: e.target.value })}
                  />
                </InfoTip>
              )}
              <div className="flex items-center gap-1.5">
                <Select value={a.resolve || "none"} onValueChange={(v) => patch(i, { resolve: v })}>
                  <InfoTip label="When activated, the sheet asks to pick a weapon, spell or item.">
                    <SelectTrigger className="h-8 flex-1"><SelectValue /></SelectTrigger>
                  </InfoTip>
                  <SelectContent>
                    <SelectItem value="none">When used: pick nothing</SelectItem>
                    <SelectItem value="weapon">When used: pick a weapon</SelectItem>
                    <SelectItem value="spell">When used: pick a spell</SelectItem>
                    <SelectItem value="item">When used: pick an item</SelectItem>
                  </SelectContent>
                </Select>
                <InfoTip label="How many times it repeats per use. A number or a formula using prof, level or a resource name — e.g. 2, prof, 1 + prof. Blank means 1.">
                  <Input
                    className="h-8 w-28"
                    placeholder="Repeats"
                    value={a.repeats ?? ""}
                    onChange={(e) => patch(i, { repeats: e.target.value })}
                  />
                </InfoTip>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <Select value={a.trigger || "__none__"} onValueChange={(v) => patch(i, { trigger: v === "__none__" ? "" : v })}>
                  <InfoTip label="When this ability occurs — On Hit, At the End of Your Turn… (edit in the Triggers tab).">
                    <SelectTrigger className="h-8"><SelectValue placeholder="Trigger…" /></SelectTrigger>
                  </InfoTip>
                  <SelectContent>
                    <SelectItem value="__none__">No trigger</SelectItem>
                    {triggers.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={a.requiresStatus || "__none__"} onValueChange={(v) => patch(i, { requiresStatus: v === "__none__" ? "" : v })}>
                  <InfoTip label="The ability only works while the character is under this status (toggle on the sheet).">
                    <SelectTrigger className="h-8"><SelectValue placeholder="Requires…" /></SelectTrigger>
                  </InfoTip>
                  <SelectContent>
                    <SelectItem value="__none__">Requires nothing</SelectItem>
                    {statuses.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={a.grantsStatus || "__none__"} onValueChange={(v) => patch(i, { grantsStatus: v === "__none__" ? "" : v })}>
                  <InfoTip label="Using this ability applies this status to the character (e.g. Raging).">
                    <SelectTrigger className="h-8"><SelectValue placeholder="Grants…" /></SelectTrigger>
                  </InfoTip>
                  <SelectContent>
                    <SelectItem value="__none__">Grants nothing</SelectItem>
                    {statuses.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })
      )}
      <p className="text-[10px] text-muted-foreground">
        These defaults appear when adding actions to a node; the quantity settings prefill the
        node's action (own uses, or a shared pool like Superiority Dice).
      </p>
    </div>
  );
}