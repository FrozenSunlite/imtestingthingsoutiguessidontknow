import { useTree } from "@/lib/treeStore";
import { resourceCatalog } from "@/lib/resources";
import { Switch } from "@/components/ui/switch";
import { ResourcePicker } from "@/components/skilltree/ResourcePicker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfoTip } from "@/components/skilltree/InfoTip";
import { Plus, X } from "lucide-react";

// Node action editor. Actions can be at-will, have their own use count, or
// draw from a shared resource pool (e.g. several maneuvers on Superiority
// Dice). Recovery: short/long rest, a fixed amount per rest, or the full
// pool (blank amount).
export function NodeActionsSection({ node, set }) {
  const { tree, character, settings, setSettings } = useTree();
  const catalog = resourceCatalog(tree, character?.manualResources);
  const actions = node.actions || [];
  const libActions = [
    ...(settings?.library?.actions || []),
    ...(settings?.library?.downtimeActions || []).map((a) => ({ ...a, category: "downtime" })),
  ].filter((a) => a.name);
  const triggers = settings?.library?.triggers || [];
  const statuses = (settings?.library?.statusEffects || [])
    .map((s) => s?.name)
    .filter(Boolean);
  const addFromLibrary = (name) => {
    const src = libActions.find((a) => a.name === name);
    set({
      actions: [
        ...actions,
        {
          name: src?.name || name,
          description: src?.description || "",
          category: src?.category || "action",
          usesMode: src?.usesMode || "atwill",
          uses: src?.uses ?? "1",
          sharedResource: src?.sharedResource || "",
          recovery: src?.recovery || "none",
          recoveryAmount: src?.recoveryAmount || "",
          time: src?.time || "",
          cost: src?.cost || "",
          resolve: src?.resolve || "none",
          trigger: src?.trigger || "",
          requiresStatus: src?.requiresStatus || "",
          grantsStatus: src?.grantsStatus || "",
        },
      ],
    });
  };

  // "Auto-import": a toggled-on action is upserted into the Reference Library
  // — Downtime actions go to the Downtime Actions tab, everything else to
  // Actions — keyed by name + category, so re-edits update in place.
  const upsertLibrary = (act) => {
    if (!act?.autoImport || !String(act?.name || "").trim()) return;
    const downtime = (act.category || "action") === "downtime";
    const key = downtime ? "downtimeActions" : "actions";
    setSettings((s) => {
      const list = [...(s.library?.[key] || [])];
      const idx = list.findIndex(
        (x) => x.name === act.name && (x.category || "action") === (act.category || "action")
      );
      const entry = downtime
        ? {
            name: act.name,
            description: act.description || "",
            time: act.time || "",
            cost: act.cost || "",
          }
        : {
            name: act.name,
            description: act.description || "",
            category: act.category || "action",
            usesMode: act.usesMode || "atwill",
            uses: act.uses ?? "1",
            sharedResource: act.sharedResource || "",
            recovery: act.recovery || "none",
            recoveryAmount: act.recoveryAmount || "",
            resolve: act.resolve || "none",
            repeats: act.repeats ?? "",
            trigger: act.trigger || "",
            requiresStatus: act.requiresStatus || "",
            grantsStatus: act.grantsStatus || "",
          };
      if (idx >= 0) list[idx] = { ...list[idx], ...entry };
      else list.push(entry);
      return { ...s, library: { ...s.library, [key]: list } };
    });
  };

  const setAct = (i, patch) => {
    const next = [...actions];
    next[i] = { ...next[i], ...patch };
    set({ actions: next });
    upsertLibrary(next[i]);
  };
  const addAction = () =>
    set({
      actions: [
        ...actions,
        {
          name: "",
          category: "action",
          description: "",
          usesMode: "atwill",
          uses: "1",
          sharedResource: "",
          recovery: "none",
          recoveryAmount: "",
        },
      ],
    });

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-1">
        <InfoTip label="Actions granted by this node. Actions sharing a resource can each have their own use count or draw from the shared pool.">
          <Label>Actions</Label>
        </InfoTip>
        {libActions.length > 0 && (
          <Select value="" onValueChange={addFromLibrary}>
            <SelectTrigger className="h-7 w-44 text-xs">
              <SelectValue placeholder="Add default action…" />
            </SelectTrigger>
            <SelectContent>
              {libActions.map((a) => (
                <SelectItem key={a.name} value={a.name}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {actions.map((a, i) => {
        const act = actions[i];
        const mode = act.usesMode || "atwill";
        return (
          <div key={i} className="space-y-1.5 rounded-md border p-2">
            <div className="flex items-center gap-1">
              <Input
                className="h-8 flex-1"
                placeholder="Action name (e.g. Trip Attack)"
                value={act.name || ""}
                onChange={(e) => setAct(i, { name: e.target.value })}
              />
              <Button size="sm" variant="ghost" onClick={() => set({ actions: actions.filter((_, j) => j !== i) })}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Textarea
              className="h-16 text-xs"
              placeholder="What does this action do?"
              value={act.description || ""}
              onChange={(e) => setAct(i, { description: e.target.value })}
            />
            {(act.category || "action") === "downtime" && (
              <div className="grid grid-cols-2 gap-1.5">
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground">Time requirement</Label>
                  <Input
                    className="h-8"
                    placeholder="e.g. 8 hours, 3 days"
                    value={act.time || ""}
                    onChange={(e) => setAct(i, { time: e.target.value })}
                  />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground">Downtime Action Cost (DAP)</Label>
                  <Input
                    className="h-8"
                    placeholder="e.g. prof or prof * 2"
                    value={act.cost || ""}
                    onChange={(e) => setAct(i, { cost: e.target.value })}
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Category</Label>
                <Select value={act.category || "action"} onValueChange={(v) => setAct(i, { category: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="action">Action</SelectItem>
                    <SelectItem value="bonus">Bonus Action</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="reaction">Reaction</SelectItem>
                    <SelectItem value="downtime">Downtime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Uses</Label>
                <Select value={mode} onValueChange={(v) => setAct(i, { usesMode: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="atwill">At-will</SelectItem>
                    <SelectItem value="own">Own uses</SelectItem>
                    <SelectItem value="shared">Shared pool</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {mode === "own" && (
                <div className="col-span-2 space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground">Times usable (number or formula)</Label>
                  <Input
                    className="h-8"
                    placeholder="2 — or prof + 1, SuperiorityDice * 2"
                    value={act.uses ?? "1"}
                    onChange={(e) => setAct(i, { uses: e.target.value })}
                  />
                </div>
              )}
              {mode === "shared" && (
                <div className="col-span-2 space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground">Draws from resource</Label>
                  <ResourcePicker
                    value={act.sharedResource || ""}
                    onChange={(v) => setAct(i, { sharedResource: v })}
                    items={catalog}
                    placeholder="e.g. Superiority Dice"
                  />
                </div>
              )}
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Restores on</Label>
                <Select value={act.recovery || "none"} onValueChange={(v) => setAct(i, { recovery: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nothing</SelectItem>
                    <SelectItem value="short">Short rest</SelectItem>
                    <SelectItem value="long">Long rest</SelectItem>
                    <SelectItem value="recharge">Recharge (d6)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(act.recovery || "none") === "recharge" && (
                <div className="col-span-2 flex items-center gap-1.5">
                  <Label className="shrink-0 text-[10px] text-muted-foreground">Recharge on d6</Label>
                  <Input
                    className="h-8 w-14 text-center"
                    type="number"
                    min={1}
                    max={6}
                    value={act.rechargeFrom ?? 5}
                    onChange={(e) => setAct(i, { rechargeFrom: Math.min(6, Math.max(1, Number(e.target.value) || 5)) })}
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input
                    className="h-8 w-14 text-center"
                    type="number"
                    min={1}
                    max={6}
                    value={act.rechargeTo ?? 6}
                    onChange={(e) => setAct(i, { rechargeTo: Math.min(6, Math.max(1, Number(e.target.value) || 6)) })}
                  />
                </div>
              )}
              {(act.recovery === "short" || act.recovery === "long") && (
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground">Amount (blank = full)</Label>
                  <Input
                    className="h-8"
                    placeholder="blank = full pool"
                    value={act.recoveryAmount || ""}
                    onChange={(e) => setAct(i, { recoveryAmount: e.target.value })}
                  />
                </div>
              )}
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">When used, choose</Label>
                <Select value={act.resolve || "none"} onValueChange={(v) => setAct(i, { resolve: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nothing</SelectItem>
                    <SelectItem value="weapon">A weapon — attack with it</SelectItem>
                    <SelectItem value="spell">A spell — cast it</SelectItem>
                    <SelectItem value="item">An item — utilize it</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5">
                <InfoTip label="How many times it repeats per use. A number or a formula using prof, level or a resource name — e.g. 2, prof, 1 + prof. Blank means 1.">
                  <Label className="text-[10px] text-muted-foreground">Repeats</Label>
                </InfoTip>
                <Input
                  className="h-8"
                  placeholder="1, prof, 2 + prof…"
                  value={act.repeats ?? ""}
                  onChange={(e) => setAct(i, { repeats: e.target.value })}
                />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Trigger</Label>
                <Select value={act.trigger || "__none__"} onValueChange={(v) => setAct(i, { trigger: v === "__none__" ? "" : v })}>
                  <InfoTip label="When this ability occurs — On Hit, At the End of Your Turn… (edit in the Triggers tab).">
                    <SelectTrigger className="h-8"><SelectValue placeholder="No trigger" /></SelectTrigger>
                  </InfoTip>
                  <SelectContent>
                    <SelectItem value="__none__">No trigger</SelectItem>
                    {triggers.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Requires status</Label>
                <Select value={act.requiresStatus || "__none__"} onValueChange={(v) => setAct(i, { requiresStatus: v === "__none__" ? "" : v })}>
                  <InfoTip label="Only works while the character is under this status (toggle on the sheet).">
                    <SelectTrigger className="h-8"><SelectValue placeholder="Requires nothing" /></SelectTrigger>
                  </InfoTip>
                  <SelectContent>
                    <SelectItem value="__none__">Requires nothing</SelectItem>
                    {statuses.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Grants status</Label>
                <Select value={act.grantsStatus || "__none__"} onValueChange={(v) => setAct(i, { grantsStatus: v === "__none__" ? "" : v })}>
                  <InfoTip label="Using this ability applies this status to the character (e.g. Raging).">
                    <SelectTrigger className="h-8"><SelectValue placeholder="Grants nothing" /></SelectTrigger>
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
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <InfoTip label="Adds this action to the Reference Library automatically — Downtime actions to the Downtime Actions tab, everything else to the Actions tab (updated in place on later edits).">
              <Switch
                checked={!!act.autoImport}
                onCheckedChange={(v) => setAct(i, { autoImport: v })}
              />
            </InfoTip>
            Add to Reference Library
          </label>
          </div>
        );
      })}
      <Button size="sm" variant="outline" onClick={addAction}>
        <Plus className="mr-1 h-4 w-4" /> Add action
      </Button>
    </div>
  );
}