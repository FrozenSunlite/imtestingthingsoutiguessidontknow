import { useTree } from "@/lib/treeStore";
import { pointTypesFor } from "@/lib/pointTypes";
import { resourceCatalog } from "@/lib/resources";
import { ResourcePicker } from "@/components/skilltree/ResourcePicker";
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
import { resolveResourceDie } from "@/lib/dieScaling";
import { Plus, X } from "lucide-react";

// Node resource editor. Each resource picks a target with a search bar — an
// existing resource (built-in, custom or the sheet's) to add to or replace,
// or a brand-new name to create. Value types: flat, flat + dice, equal to
// another resource or your level, or a free formula.
export function NodeResourcesSection({ node, set }) {
  const { tree, character, settings } = useTree();
  const catalog = resourceCatalog(tree, character?.manualResources, settings?.library);

  const addResource = () =>
    set({
      resources: [
        ...node.resources,
        {
          name: "",
          uses: "1",
          type: "point",
          valueType: "flat",
          diceCount: "",
          diceSize: "d6",
          equalTo: "level",
          mode: "add",
          recovery: "none",
          recoveryAmount: "",
          scaling: { mode: "none", per: 1 },
          color: "#ffffff",
        },
      ],
    });

  return (
    <div className="space-y-1">
      <InfoTip label="Resources granted per invested point. Pick an existing resource to add to or replace it, or type a new name to create one.">
        <Label>Resources</Label>
      </InfoTip>
      {node.resources.map((r, i) => {
        const res = node.resources[i];
        const setRes = (patch) => {
          const resources = [...node.resources];
          resources[i] = { ...res, ...patch };
          set({ resources });
        };
        const name = String(res.name || "").trim();
        const known = catalog.find((c) => c.name.toLowerCase() === name.toLowerCase());
        const vt = res.valueType || "flat";
        const isGrant = (res.type || "point") === "grant";
        const isLegacyDice = (res.type || "point") === "dice";
        return (
          <div key={i} className="space-y-1.5 rounded-md border p-2">
            <div className="flex items-center gap-1">
              <ResourcePicker
                value={res.name || ""}
                onChange={(v) => setRes({ name: v })}
                items={catalog}
                placeholder="Search or name a new resource"
              />
              <input
                type="color"
                value={res.color || "#ffffff"}
                onChange={(e) => setRes({ color: e.target.value })}
                className="h-8 w-8 shrink-0 rounded border"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => set({ resources: node.resources.filter((_, j) => j !== i) })}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {!name
                ? "Pick an existing resource with the search bar, or type a new name to create one."
                : known
                ? res.mode === "replace"
                  ? `Replaces ${known.name}${known.builtin ? " (built-in)" : ""}`
                  : `Adds to ${known.name}${known.builtin ? " (built-in)" : ""}`
                : "New resource — first defined by this talent"}
            </div>
            {known && !isGrant && (
              <Select value={res.mode || "add"} onValueChange={(v) => setRes({ mode: v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add to existing value</SelectItem>
                  <SelectItem value="replace">Replace the value</SelectItem>
                </SelectContent>
              </Select>
            )}
            {/* Creature Type resources take a type name from the library instead of a number. */}
            {name.toLowerCase() === "creature type" && (
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Creature type</Label>
                <Select value={res.uses ?? res.value ?? ""} onValueChange={(v) => setRes({ uses: v })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Pick a type" /></SelectTrigger>
                  <SelectContent>
                    {(settings?.library?.creatureTypes || []).map((t) => (
                      <SelectItem key={t.name || t} value={t.name || t}>
                        {t.name || t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isGrant && (
              <div className="grid grid-cols-2 gap-1.5">
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground">Point pool</Label>
                  <Select value={res.grantPool || "talent"} onValueChange={(v) => setRes({ grantPool: v })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {pointTypesFor(settings).map((pt) => (
                        <SelectItem key={pt.id} value={pt.id}>
                          {pt.currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground">Applies to</Label>
                  <Select value={res.grantVariant || "general"} onValueChange={(v) => setRes({ grantVariant: v })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="specific">Specific</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(res.grantVariant || "general") === "specific" && (
                  <div className="col-span-2 space-y-0.5">
                    <Label className="text-[10px] text-muted-foreground">
                      {res.grantPool === "heritage" ? "Heritage type (e.g. Arcane)" : "Skill the points are for"}
                    </Label>
                    <Input className="h-8" value={res.grantName || ""} onChange={(e) => setRes({ grantName: e.target.value })} />
                  </div>
                )}
              </div>
            )}
            {!isGrant && (
              <>
                {!isLegacyDice && (
                  <Select value={vt} onValueChange={(v) => setRes({ valueType: v })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat value</SelectItem>
                      <SelectItem value="flatDice">Flat value + dice</SelectItem>
                      <SelectItem value="equal">Equal to…</SelectItem>
                      <SelectItem value="formula">Formula</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {isLegacyDice && (
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="space-y-0.5">
                      <Label className="text-[10px] text-muted-foreground">Dice count</Label>
                      <Input className="h-8" placeholder="1" value={res.uses ?? res.value ?? ""} onChange={(e) => setRes({ uses: e.target.value })} />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[10px] text-muted-foreground">Dice size</Label>
                      <Select value={res.diceSize || "d6"} onValueChange={(v) => setRes({ diceSize: v })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["d4", "d6", "d8", "d10", "d12", "d20"].map((d) => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {!isLegacyDice && (vt === "flat" || vt === "flatDice") &&
                  name.toLowerCase() !== "creature type" && (
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-muted-foreground">Flat value</Label>
                    <Input className="h-8" placeholder="2" value={res.uses ?? res.value ?? ""} onChange={(e) => setRes({ uses: e.target.value })} />
                  </div>
                )}
                {!isLegacyDice && vt === "flatDice" && (
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="space-y-0.5">
                      <Label className="text-[10px] text-muted-foreground">Dice count</Label>
                      <Input className="h-8" placeholder="1" value={res.diceCount ?? ""} onChange={(e) => setRes({ diceCount: e.target.value })} />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[10px] text-muted-foreground">Dice size</Label>
                      <Select value={res.diceSize || "d6"} onValueChange={(v) => setRes({ diceSize: v })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["d4", "d6", "d8", "d10", "d12", "d20"].map((d) => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {!isLegacyDice && vt === "equal" && (
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-muted-foreground">Equal to</Label>
                    <Select value={res.equalTo || "level"} onValueChange={(v) => setRes({ equalTo: v })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="level">Your level</SelectItem>
                        <SelectItem value="hitDie">Hit die size</SelectItem>
                        {catalog.map((c) => (
                          <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {!isLegacyDice && vt === "formula" && (
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-muted-foreground">Formula</Label>
                    <Input
                      className="h-8"
                      placeholder="e.g. prof + 1, SuperiorityDice * 2"
                      value={res.uses ?? res.value ?? ""}
                      onChange={(e) => setRes({ uses: e.target.value })}
                    />
                  </div>
                )}
              </>
            )}
            {(res.type || "point") !== "grant" && (
              <label
                className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
                title="Activated instead of always-on: the value applies only while the talent is switched on in the View page's Active Effects list."
              >
                <Switch checked={!!res.toggle} onCheckedChange={(v) => setRes({ toggle: v })} />
                Toggleable (activate instead of passive)
              </label>
            )}
            {(res.type || "point") !== "grant" && (
              <div className="grid grid-cols-2 gap-1.5">
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground">Comes back on</Label>
                  <Select value={res.recovery || "none"} onValueChange={(v) => setRes({ recovery: v })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nothing</SelectItem>
                      <SelectItem value="short">Short rest</SelectItem>
                      <SelectItem value="long">Long rest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(res.recovery || "none") !== "none" && (
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-muted-foreground">Amount (blank = full)</Label>
                    <Input className="h-8" placeholder="blank = full pool" value={res.recoveryAmount || ""} onChange={(e) => setRes({ recoveryAmount: e.target.value })} />
                  </div>
                )}
              </div>
            )}
            {(res.type || "point") !== "grant" && (
              <div className="space-y-0.5 border-t pt-1.5">
                <Label className="text-[10px] text-muted-foreground">Scales with</Label>
                <div className="flex items-center gap-1.5">
                  <Select
                    value={res.scaling?.mode || "none"}
                    onValueChange={(v) => setRes({ scaling: { ...(res.scaling || {}), mode: v } })}
                  >
                    <SelectTrigger className="h-8 flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nothing (flat)</SelectItem>
                      <SelectItem value="level">Level</SelectItem>
                      <SelectItem value="prof">Proficiency bonus</SelectItem>
                      <SelectItem value="stat">Ability score</SelectItem>
                      <SelectItem value="talents">Talents with tag</SelectItem>
                      <SelectItem value="taken">Times taken</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    className="h-8 w-14"
                    title="Amount per step"
                    value={res.scaling?.per ?? 1}
                    onChange={(e) => setRes({ scaling: { ...(res.scaling || {}), per: Number(e.target.value) || 0 } })}
                  />
                </div>
                {res.scaling?.mode === "stat" && (
                  <Select value={res.scaling?.stat || "STR"} onValueChange={(v) => setRes({ scaling: { ...(res.scaling || {}), stat: v } })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["STR", "DEX", "CON", "INT", "WIS", "CHA"].map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {res.scaling?.mode === "talents" && (
                  <Input
                    className="h-8"
                    placeholder="Talent tag (blank = this node's type)"
                    value={res.scaling?.talentTag || ""}
                    onChange={(e) => setRes({ scaling: { ...(res.scaling || {}), talentTag: e.target.value } })}
                  />
                )}
              </div>
            )}
            {!isGrant && known && (
              <div className="space-y-0.5 border-t pt-1.5">
                <Label className="text-[10px] text-muted-foreground">Die scaling</Label>
                <div className="flex items-center gap-1.5">
                  <Select
                    value={String(res.dieAdjust ?? 0)}
                    onValueChange={(v) => setRes({ dieAdjust: Number(v) || 0 })}
                  >
                    <SelectTrigger className="h-8 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">No change</SelectItem>
                      {[-4, -3, -2, -1, 1, 2, 3, 4].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n > 0 ? `+${n}` : n} step{n === 1 || n === -1 ? "" : "s"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-8 min-w-0 flex-1"
                    placeholder="Override die (e.g. 2d8)"
                    value={res.dieOverride || ""}
                    onChange={(e) => setRes({ dieOverride: e.target.value })}
                  />
                </div>
                {(() => {
                  const die = resolveResourceDie({ ...res, name }, settings?.library);
                  if (!die) return null;
                  return (
                    <p className="text-[10px] text-muted-foreground">
                      Rolls <span className="font-mono text-foreground">{die.text}</span>
                      {die.override
                        ? " (overridden)"
                        : die.adjust
                        ? ` (${die.adjust > 0 ? "+" : ""}${die.adjust} step${Math.abs(die.adjust) === 1 ? "" : "s"})`
                        : ""}
                    </p>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">
        Values may also be expressions: <code>level</code>, <code>prof</code>, ability scores
        (STR, DEX…), ability modifiers (<code>STRmod</code>…), the hit die size
        (<code>hitDie</code>, e.g. 6 for a d6) and other resources by name without spaces
        (e.g. <code>SuperiorityDice</code>).
      </p>
      <Button size="sm" variant="outline" onClick={addResource}>
        <Plus className="mr-1 h-4 w-4" /> Add resource
      </Button>
    </div>
  );
}