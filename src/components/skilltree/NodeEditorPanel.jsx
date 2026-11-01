import { useRef, useState } from "react";
import { useTree } from "@/lib/treeStore";
import { nodeTypesFor, pointTypesFor, poolForNodeType } from "@/lib/pointTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trash2,
  Plus,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  X,
  Search,
  Upload,
} from "lucide-react";
import { usePanelWidth } from "@/hooks/use-panel-width";
import { PanelResizer } from "@/components/skilltree/PanelResizer";
import { InfoTip } from "@/components/skilltree/InfoTip";
import { FieldGroup } from "@/components/skilltree/FieldGroup";
import { importImage } from "@/lib/imageStore";
import { NodePicker } from "@/components/skilltree/NodePicker";
import { matchesQuery } from "@/lib/textSearch";
import { NodeActionsSection } from "@/components/skilltree/NodeActionsSection";
import { NodeResourcesSection } from "@/components/skilltree/NodeResourcesSection";
import { NodeBenefitsSection } from "@/components/skilltree/NodeBenefitsSection";
import { BonusDiceEditor } from "@/components/skilltree/BonusDiceEditor";
import { SubtreesSection } from "@/components/skilltree/SubtreesSection";
import { ProficienciesEditor } from "@/components/skilltree/ProficienciesEditor";
import { AbilityReqEditor } from "@/components/skilltree/AbilityReqEditor";
import { NodeImagePicker } from "@/components/skilltree/NodeImagePicker";
import { nodeMaxPoints, withTiers } from "@/lib/nodeTiers";

// Library list entries can be plain names (older saves) or {name, ability}.
const entryName = (e) => (typeof e === "string" ? e : e?.name || "");

export function NodeEditorPanel() {
  const {
    tree,
    nodesById,
    ui,
    setUi,
    updateNode,
    deleteNode,
    rotateNode,
    flipNode,
    toggleDependency,
    settings,
    setSettings,
  } = useTree();
  const [search, setSearch] = useState("");
  const [exSearch, setExSearch] = useState("");
  const [imagePickerField, setImagePickerField] = useState("");
  // Panel width persists across sessions and is shared with the View panel.
  const [width] = usePanelWidth();
  const [uploading, setUploading] = useState(false);
  const imageFileRef = useRef(null);
  const frameFileRef = useRef(null);

  // Import the file into the project's image folder and store only its short
  // reference on the node (the project server writes it to disk).
  const uploadImage = async (file, field) => {
    if (!file || !node) return;
    setUploading(true);
    try {
      const url = await importImage(file);
      updateNode(node.id, { [field]: url });
    } catch {
      /* upload errors are non-fatal; ignore silently */
    } finally {
      setUploading(false);
    }
  };

  const node = ui.editingNodeId ? nodesById[ui.editingNodeId] : null;
  if (!node) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center border-l bg-card p-6 text-center text-sm text-muted-foreground"
        style={{ width }}
      >
        Select a node and click <span className="font-semibold">Edit</span> in its right-click menu, or
        double-click empty canvas to create one.
        <p className="mt-2 text-xs">Rotate and flip hotkeys are configurable in Settings (gear icon in the toolbar).</p>
      </div>
    );
  }

  const set = (patch) => updateNode(node.id, patch);

  // The return node is a navigation marker: only its name is editable.
  if (node.__returnNode) {
    return (
      <div className="relative flex h-full flex-col border-l bg-card" style={{ width }}>
        <PanelResizer />
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Return Node</h3>
          <Button size="sm" variant="ghost" onClick={() => setUi((u) => ({ ...u, editingNodeId: null }))}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-3 p-4 text-sm">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={node.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <p className="text-xs text-muted-foreground">
            Double-click this node in play to return to the parent node. It cannot be invested in
            and has no effects.
          </p>
        </div>
      </div>
    );
  }

  const applyTiers = (tiers) => {
    const next = withTiers(node, tiers);
    set({
      tiers: next.tiers,
      maxPoints: next.maxPoints,
      levelReq: next.levelReq,
    });
  };
  const nodeImageFolder =
    settings?.nodeImageFolder || settings?.library?.nodeImageFolder || "Icons";

  const filtered = search
    ? tree.nodes
        .filter((n) => n.id !== node.id && matchesQuery(n.name, search))
        .slice(0, 30)
    : [];

  const exFiltered = exSearch
    ? tree.nodes
        .filter((n) => n.id !== node.id && matchesQuery(n.name, exSearch))
        .slice(0, 30)
    : [];

  // Exclusivity is stored on both nodes so either direction locks the pair.
  const toggleExclusive = (otherId) => {
    const has = (node.exclusiveWith || []).includes(otherId);
    set({
      exclusiveWith: has
        ? (node.exclusiveWith || []).filter((id) => id !== otherId)
        : [...(node.exclusiveWith || []), otherId],
    });
    const other = nodesById[otherId];
    if (other) {
      updateNode(otherId, {
        exclusiveWith: has
          ? (other.exclusiveWith || []).filter((id) => id !== node.id)
          : [...(other.exclusiveWith || []), node.id],
      });
    }
  };

  return (
    <div className="relative flex h-full flex-col border-l bg-card" style={{ width }}>
      {/* Shared drag handle to resize the editor */}
      <PanelResizer />
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Edit Node</h3>
        <Button size="sm" variant="ghost" onClick={() => setUi((u) => ({ ...u, editingNodeId: null }))}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto p-4 text-sm">
        {/* ── Identity ─────────────────────────────────────────────── */}
        <FieldGroup label="Identity" collapsible>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <InfoTip label="The node's name — shown on the canvas when Names is enabled, in tooltips and in exports.">
                <Label>Name</Label>
              </InfoTip>
              <Input value={node.name} onChange={(e) => set({ name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <InfoTip label="One or more comma-separated tags shown on the canvas, e.g. [Arcane Talent], [Bloodline]. A node can belong to several Talent Types.">
                <Label>Talent Types</Label>
              </InfoTip>
              <Input
                value={
                  node.talentTypes?.length
                    ? node.talentTypes.join(", ")
                    : node.talentType || ""
                }
                placeholder="[Arcane Talent], [Bloodline]"
                onChange={(e) => {
                  const talentTypes = e.target.value
                    .split(/[,;]/)
                    .map((value) => value.trim())
                    .filter(Boolean);
                  set({
                    talentTypes,
                    talentType: talentTypes.join(", "),
                  });
                }}
                title="Comma-separated. A node may belong to several Talent Types."
              />
            </div>
          </div>
        </FieldGroup>

        {/* ── Classification ───────────────────────────────────────── */}
        <FieldGroup label="Classification" collapsible>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <InfoTip label="Which point pool this node draws from when invested.">
                <Label>Node Type</Label>
              </InfoTip>
              <Select
                value={node.nodeType || "skill"}
                onValueChange={(v) =>
                  set({
                    nodeType: v,
                    pointType: poolForNodeType(v, pointTypesFor(settings)),
                  })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {nodeTypesFor(settings).map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <InfoTip label="Override which point currency pays for this node; otherwise it follows the node type.">
                <Label>Point Currency</Label>
              </InfoTip>
              <Select
                value={node.poolOverride || "auto"}
                onValueChange={(v) => set({ poolOverride: v === "auto" ? "" : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (by node type)</SelectItem>
                  {pointTypesFor(settings).map((pt) => (
                    <SelectItem key={pt.id} value={pt.id}>
                      {pt.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <InfoTip label="Character level needed before this node can be invested (0 = none).">
                <Label>Required Level</Label>
              </InfoTip>
              <Input
                type="number"
                min={0}
                placeholder="None"
                value={node.levelReq || ""}
                onChange={(e) => set({ levelReq: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Auto currency follows the Point Types mapping in the Reference Library.
            An override wins over the type. Mundane nodes additionally require their
            listed proficiency prerequisites.
          </p>
          {node.nodeType === "attribute" && (
            <div className="space-y-1">
              <InfoTip label="Each invested point raises this attribute by +1 (editable list in the Reference Library).">
                <Label>Attribute (+1 per invested point)</Label>
              </InfoTip>
              <Select
                value={node.attributeStat || ""}
                onValueChange={(v) => set({ attributeStat: v })}
              >
                <SelectTrigger className="h-8"><SelectValue placeholder="Pick attribute" /></SelectTrigger>
                <SelectContent>
                  {(settings?.library?.attributes?.length
                    ? settings.library.attributes
                    : ["STR", "DEX", "CON", "INT", "WIS", "CHA"]
                  ).map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </FieldGroup>

        {/* ── Investment ───────────────────────────────────────────── */}
        <FieldGroup label="Costs & Investment" collapsible>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <InfoTip label="Points spent from the pool each time a point is invested here (0 = free).">
                <Label>Node Cost</Label>
              </InfoTip>
              <Input
                type="number"
                min={0}
                value={node.cost ?? 1}
                onChange={(e) => set({ cost: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
            <div className="space-y-1">
              <InfoTip label="How many times this node can be invested (1 = one-time pick).">
                <Label>Max Points</Label>
              </InfoTip>
              <Input
                type="number"
                min={1}
                value={node.maxPoints}
                onChange={(e) => set({ maxPoints: Math.max(1, Number(e.target.value) || 1) })}
              />
            </div>
            <div className="space-y-1">
              <InfoTip label="Points that must already be invested in a prerequisite node before this one unlocks. 0 = auto: whatever it takes to unlock the prerequisite.">
                <Label>Prerequisite Points</Label>
              </InfoTip>
              <Input
                type="number"
                min={0}
                value={Number(node.requiredPoints) === 0 ? 0 : node.requiredPoints}
                onChange={(e) =>
                  set({ requiredPoints: Math.max(0, Number(e.target.value) || 0) })
                }
              />
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <InfoTip label="Character levels this node grants while invested. They count for tier gates, subtree unlock levels and the per-level talent purchase limit; refunding removes them.">
                <Label>Levels Granted</Label>
              </InfoTip>
              <Input
                type="number"
                min={0}
                value={node.levelGain ?? 0}
                onChange={(e) => set({ levelGain: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
            <p className="self-end pb-1 text-[10px] text-muted-foreground">
              Adds this many character levels while the node is invested.
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Node Cost: pool points per invested point, 0 to make it free. Prerequisite Points: 0
            defaults to auto — however many it takes to get to the prerequisite node.
          </p>

          <div className="mt-2 rounded-md border p-2">
            <div className="flex items-center justify-between gap-1">
              <InfoTip label="Level-gated investment tiers. The first tier unlocks the node; later tiers require their own level and their own points. Action Surge at level 2 and its level-17 extra use is the classic example.">
                <Label>Tiers</Label>
              </InfoTip>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px]"
                onClick={() =>
                  applyTiers([
                    ...(node.tiers || []),
                    {
                      level: Number(node.levelReq) || 1,
                      points: 1,
                      label: `Tier ${(node.tiers || []).length + 1}`,
                    },
                  ])
                }
              >
                <Plus className="mr-1 h-3 w-3" /> Add tier
              </Button>
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Points are filled in order. The node shows the next tier&apos;s level and refuses
              investment until that level is reached.
            </p>
            {(node.tiers || []).length === 0 && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                No tiers yet. The Level Requirement and Max Points above apply as a single tier.
              </p>
            )}
            {(node.tiers || []).map((tier, index) => (
              <div key={index} className="mt-1 flex flex-wrap items-end gap-1 rounded border p-1">
                <label className="flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground">Lvl</span>
                  <Input
                    className="h-7 w-14 text-xs"
                    type="number"
                    min={0}
                    value={tier.level || 0}
                    onChange={(e) => {
                      const tiers = [...(node.tiers || [])];
                      tiers[index] = { ...tier, level: Math.max(0, Number(e.target.value) || 0) };
                      applyTiers(tiers);
                    }}
                  />
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground">Pts</span>
                  <Input
                    className="h-7 w-14 text-xs"
                    type="number"
                    min={1}
                    value={tier.points || 1}
                    onChange={(e) => {
                      const tiers = [...(node.tiers || [])];
                      tiers[index] = { ...tier, points: Math.max(1, Number(e.target.value) || 1) };
                      applyTiers(tiers);
                    }}
                  />
                </label>
                <Input
                  className="h-7 min-w-32 flex-1 text-xs"
                  placeholder="Tier label"
                  value={tier.label || ""}
                  onChange={(e) => {
                    const tiers = [...(node.tiers || [])];
                    tiers[index] = { ...tier, label: e.target.value };
                    applyTiers(tiers);
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-1 text-destructive"
                  title="Remove this tier"
                  onClick={() => applyTiers((node.tiers || []).filter((_, i) => i !== index))}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {(node.tiers || []).length > 0 && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Total points across tiers: {nodeMaxPoints(node)}
              </p>
            )}
          </div>
        </FieldGroup>

        {/* ── Requirements & Gates ─────────────────────────────────── */}
        <FieldGroup label="Requirements & Gates" collapsible>
          <div className="space-y-1">
            <InfoTip label="Whether at least one, or all, prerequisite nodes must be invested to unlock this node.">
              <Label>Requirement</Label>
            </InfoTip>
            <Select
              value={node.requirementMode}
              onValueChange={(v) => set({ requirementMode: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No requirement</SelectItem>
                <SelectItem value="any">At least one</SelectItem>
                <SelectItem value="all">All required</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <InfoTip label="Proficiencies the character must already have before investing here — e.g. a Mundane Talent requiring a Skill Proficiency.">
              <Label>Proficiency Prerequisite</Label>
            </InfoTip>
            {(node.requiredProficiencies || []).map((r, i) => (
              <div key={i} className="flex items-center gap-1">
                <Select
                  value={r.type || "skills"}
                  onValueChange={(v) => {
                    const arr = [...(node.requiredProficiencies || [])];
                    arr[i] = { ...r, type: v };
                    set({ requiredProficiencies: arr });
                  }}
                >
                  <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skills">Skill</SelectItem>
                    <SelectItem value="tools">Tool</SelectItem>
                    <SelectItem value="instruments">Instrument</SelectItem>
                    <SelectItem value="languages">Language</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className="h-8 flex-1"
                  placeholder="Name"
                  list={`req-${r.type || "skills"}`}
                  value={r.name || ""}
                  onChange={(e) => {
                    const arr = [...(node.requiredProficiencies || [])];
                    arr[i] = { ...r, name: e.target.value };
                    set({ requiredProficiencies: arr });
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    set({
                      requiredProficiencies: (node.requiredProficiencies || []).filter(
                        (_, j) => j !== i
                      ),
                    })
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                set({
                  requiredProficiencies: [
                    ...(node.requiredProficiencies || []),
                    { type: "skills", name: "" },
                  ],
                })
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Add prerequisite
            </Button>
            <datalist id="req-skills">
              {(settings?.library?.lists?.skills || [])
                .map(entryName)
                .filter(Boolean)
                .map((s) => (
                  <option key={s} value={s} />
                ))}
            </datalist>
            <datalist id="req-tools">
              {(settings?.library?.lists?.tools || [])
                .map(entryName)
                .filter(Boolean)
                .map((s) => (
                  <option key={s} value={s} />
                ))}
            </datalist>
            <datalist id="req-instruments">
              {(settings?.library?.lists?.instruments || []).map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <datalist id="req-languages">
              {(settings?.library?.lists?.languages || []).map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <AbilityReqEditor
            reqs={node.abilityReqs || []}
            onChange={(abilityReqs) => set({ abilityReqs })}
            label="Ability Score Prerequisite"
            info="Ability scores the character needs before investing here — checked against the sheet's effective scores."
          />

          <div className="space-y-1">
            <InfoTip label="Optional: nodes that must have invested points before this node becomes available.">
              <Label>Prerequisite Nodes (Optional)</Label>
            </InfoTip>
            <div className="flex flex-wrap gap-1 rounded-md border p-1.5 min-h-9">
              {node.dependencies.map((did) => {
                const d = nodesById[did];
                return (
                  <span key={did} className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs">
                    {d?.name || "?"}
                    <button onClick={() => toggleDependency(did, node.id)}><X className="h-3 w-3" /></button>
                  </span>
                );
              })}
              {node.dependencies.length === 0 && (
                <span className="text-xs text-muted-foreground">None</span>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search to add prerequisite…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {filtered.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-md border">
                {filtered.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      toggleDependency(n.id, node.id);
                      setSearch("");
                    }}
                    className="block w-full truncate px-2 py-1 text-left text-xs hover:bg-accent"
                  >
                    {n.name}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-1">
              <InfoTip label="Prerequisites outside this tree — main-tree nodes, other subtrees, or this tree. Enter skill names, comma-separated; each must be unlocked for this node to open.">
                <Label>Cross-Tree Prerequisites (Optional)</Label>
              </InfoTip>
              <Input
                placeholder="Skill names, comma-separated (e.g. Archery, Keen Eye)"
                value={(node.requiresNames || []).join(", ")}
                onChange={(e) =>
                  updateNode(node.id, {
                    requiresNames: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-1">
            <InfoTip label="Optional: nodes this one can never be combined with — once one holds points, the other stays locked. The link is saved on both nodes.">
              <Label>Mutually Exclusive Nodes (Optional)</Label>
            </InfoTip>
            <div className="flex flex-wrap gap-1 rounded-md border p-1.5 min-h-9">
              {(node.exclusiveWith || []).map((id) => (
                <span
                  key={id}
                  className="flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-xs dark:bg-rose-950/40"
                >
                  {nodesById[id]?.name || "?"}
                  <button onClick={() => toggleExclusive(id)}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {(node.exclusiveWith || []).length === 0 && (
                <span className="text-xs text-muted-foreground">None</span>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search to add an exclusive node…"
                value={exSearch}
                onChange={(e) => setExSearch(e.target.value)}
              />
            </div>
            {exFiltered.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-md border">
                {exFiltered.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      toggleExclusive(n.id);
                      setExSearch("");
                    }}
                    className="block w-full truncate px-2 py-1 text-left text-xs hover:bg-accent"
                  >
                    {n.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </FieldGroup>

        {/* ── Benefits ───────────────────────────────────────────────── */}
        <FieldGroup label="Benefits" collapsible>
          <NodeBenefitsSection node={node} set={set} />

          {/* ── Proficiencies ────────────────────────────────────────── */}
          <FieldGroup label="Proficiencies" sub collapsible>
            <ProficienciesEditor node={node} set={set} />
          </FieldGroup>

          {/* ── Actions ──────────────────────────────────────────────── */}
          <FieldGroup label="Actions" sub collapsible>
            <NodeActionsSection node={node} set={set} />
          </FieldGroup>

          {/* ── Resources ────────────────────────────────────────────── */}
          <FieldGroup label="Resources" sub collapsible>
            <NodeResourcesSection node={node} set={set} />
          </FieldGroup>

          {/* ── Auto Grants ──────────────────────────────────────────── */}
          <FieldGroup label="Auto Grants" sub collapsible>
            <InfoTip label="Granted automatically when the node is taken, regardless of which benefit is chosen — e.g. a detriment that comes with the deal. Refunding the node removes them.">
              <Label>Auto Grants (granted on take)</Label>
            </InfoTip>
            {(node.grants || []).map((g, i) => {
              const setGrant = (patch) => {
                const arr = [...node.grants];
                arr[i] = { ...node.grants[i], ...patch };
                set({ grants: arr });
              };
              const gOpts = (nodesById[g.nodeId]?.options || []).map((o, j) => ({
                value: o.name || `Benefit ${j + 1}`,
                j,
              }));
              return (
                <div key={i} className="space-y-1 rounded-md border p-2">
                  <div className="flex items-center gap-1">
                    <Input
                      className="h-8 flex-1"
                      placeholder="Granted ability name (e.g. Sunlight Sensitivity)"
                      value={g.name || ""}
                      onChange={(e) => setGrant({ name: e.target.value })}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => set({ grants: node.grants.filter((_, j) => j !== i) })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    <NodePicker
                      className="min-w-0 flex-1"
                      nodes={tree.nodes}
                      value={g.nodeId || ""}
                      placeholder="Granted node (optional)…"
                      onChange={(id) => {
                        const opts = nodesById[id]?.options || [];
                        const opt = opts[0];
                        setGrant({
                          nodeId: id,
                          optionName: opt ? opt.name || `Benefit 1` : "",
                          name: opt ? opt.name || `Benefit 1` : g.name,
                          description: opt ? opt.description || "" : g.description,
                        });
                      }}
                    />
                    {gOpts.length > 0 && (
                      <Select
                        value={g.optionName || ""}
                        onValueChange={(v) => {
                          const opt = nodesById[g.nodeId].options[gOpts.find((o) => o.value === v).j];
                          setGrant({
                            optionName: v,
                            name: opt.name || v,
                            description: opt.description || "",
                          });
                        }}
                      >
                        <SelectTrigger className="h-8 w-32 shrink-0">
                          <SelectValue placeholder="Option" />
                        </SelectTrigger>
                        <SelectContent>
                          {gOpts.map((o) => (
                            <SelectItem key={o.j} value={o.value}>
                              {o.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <Textarea
                    rows={2}
                    placeholder="Description"
                    value={g.description || ""}
                    onChange={(e) => setGrant({ description: e.target.value })}
                  />
                </div>
              );
            })}
            <Button
              size="sm"
              variant="outline"
              onClick={() => set({ grants: [...(node.grants || []), { name: "", description: "" }] })}
            >
              <Plus className="mr-1 h-4 w-4" /> Add auto grant
            </Button>
          </FieldGroup>

          {/* ── Bonus Dice ───────────────────────────────────────────── */}
          <FieldGroup label="Bonus Dice" sub collapsible>
            <BonusDiceEditor node={node} set={set} settings={settings} />
          </FieldGroup>

        </FieldGroup>

        {/* ── Descriptions ─────────────────────────────────────────── */}
        <FieldGroup label="Descriptions" collapsible>
          <div className="space-y-1">
            <InfoTip label="Rules text shown in the node's hover tooltip and in exports.">
              <Label>Description</Label>
            </InfoTip>
            <Textarea
              rows={4}
              value={node.description}
              onChange={(e) => set({ description: e.target.value })}
            />
            <p className="text-[10px] text-muted-foreground">
              Links: type <code>[[Node Name]]</code> to jump to a node, or <code>[[Node Name / Subtree]]</code> to open
              one of its subtrees — links are clickable in the View-mode Alt-description window.
            </p>
          </div>
          <div className="space-y-1">
            <InfoTip label="Optional flavor text. Purely cosmetic — never counted toward pools or stats.">
              <Label>Flavor Text (no mechanical effect)</Label>
            </InfoTip>
            <Textarea
              rows={2}
              value={node.flavor || ""}
              onChange={(e) => set({ flavor: e.target.value })}
            />
          </div>
        </FieldGroup>

        {/* ── Subtrees ─────────────────────────────────────────────── */}
        <FieldGroup label="Subtrees" collapsible>
          <SubtreesSection node={node} set={set} />
        </FieldGroup>

        {/* ── Appearance ───────────────────────────────────────────── */}
        <FieldGroup label="Appearance" collapsible>
          <div className="space-y-1">
            <InfoTip label="Node size in pixels on the canvas.">
              <Label>Node Size</Label>
            </InfoTip>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={40}
                max={300}
                step={10}
                value={node.size || 100}
                onChange={(e) => set({ size: Number(e.target.value) })}
                className="h-1 flex-1 accent-primary"
              />
              <span className="w-10 text-right text-xs text-muted-foreground">{node.size || 100}</span>
            </div>
          </div>

          <div className="space-y-1">
            <InfoTip label="Artwork shown inside the node (blank = default icon). The upload button copies the file into the project's image folder.">
              <Label>Image URL</Label>
            </InfoTip>
            <div
              className="flex gap-1"
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
              onDrop={(e) => { e.preventDefault(); uploadImage(e.dataTransfer.files?.[0], "image"); }}
            >
              <Input value={node.image} onChange={(e) => set({ image: e.target.value })} placeholder="/icon.png" />
              <input
                ref={imageFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => uploadImage(e.target.files?.[0], "image")}
              />
              <Button
                size="sm"
                variant="outline"
                title="Upload an image"
                disabled={uploading}
                onClick={() => imageFileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                title={`Browse ${nodeImageFolder}`}
                onClick={() => setImagePickerField("image")}
              >
                Library
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <InfoTip label="Decorative image overlaid on the node - its border defines the node's shape.">
              <Label>Frame Image URL (overlays the node)</Label>
            </InfoTip>
            <div
              className="flex gap-1"
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
              onDrop={(e) => { e.preventDefault(); uploadImage(e.dataTransfer.files?.[0], "frameImage"); }}
            >
              <Input
                value={node.frameImage || ""}
                onChange={(e) => set({ frameImage: e.target.value })}
                placeholder="e.g. an ornate border PNG"
              />
              <input
                ref={frameFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => uploadImage(e.target.files?.[0], "frameImage")}
              />
              <Button
                size="sm"
                variant="outline"
                title="Upload a frame image"
                disabled={uploading}
                onClick={() => frameFileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                title={`Browse ${nodeImageFolder}`}
                onClick={() => setImagePickerField("frameImage")}
              >
                Library
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <InfoTip label="Trims the artwork inward so it stays inside the frame's border art (0 = edge to edge).">
              <Label>Icon inset (circular crop)</Label>
            </InfoTip>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={35}
                step={1}
                value={node.iconInset ?? 12}
                onChange={(e) => set({ iconInset: Number(e.target.value) })}
                className="h-1 flex-1 accent-primary"
              />
              <span className="w-10 text-right text-xs text-muted-foreground">
                {node.iconInset ?? 12}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => rotateNode(node.id, 15)}><RotateCw className="mr-1 h-4 w-4" /> 15°</Button>
            <Button size="sm" variant="outline" onClick={() => rotateNode(node.id, -15)}><RotateCcw className="mr-1 h-4 w-4" /> −15°</Button>
            <Button size="sm" variant="outline" onClick={() => flipNode(node.id)}><FlipHorizontal className="mr-1 h-4 w-4" /> Flip</Button>
            <Button size="sm" variant="outline" onClick={() => flipNode(node.id, "v")}><FlipVertical className="mr-1 h-4 w-4" /> Invert</Button>
          </div>
        </FieldGroup>

        <datalist id="lib-skills">
          {(settings?.library?.lists?.skills || [])
            .map(entryName)
            .filter(Boolean)
            .map((s) => (
              <option key={s} value={s} />
            ))}
        </datalist>
        <datalist id="lib-tools">
          {[
            ...(settings?.library?.lists?.tools || []),
            ...(settings?.library?.lists?.artisanTools || []),
            ...(settings?.library?.lists?.gamingSets || []),
            ...(settings?.library?.lists?.miscTools || []),
            ...(settings?.library?.lists?.instruments || []),
          ]
            .map(entryName)
            .filter(Boolean)
            .map((s) => (
              <option key={s} value={s} />
            ))}
        </datalist>
        <datalist id="lib-instruments">
          {(settings?.library?.lists?.instruments || [])
            .map(entryName)
            .filter(Boolean)
            .map((s) => (
              <option key={s} value={s} />
            ))}
        </datalist>
        <datalist id="lib-weapons">
          {[
            ...(settings?.library?.weapons || []).map((w) => w.name).filter(Boolean),
            ...(settings?.library?.weaponCategories || []),
          ].map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <datalist id="lib-armor">
          {[
            ...(settings?.library?.armor || []).map((a) => a.name).filter(Boolean),
            ...(settings?.library?.armorTypes || []),
          ].map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <div className="border-t p-3">
        <Button size="sm" variant="destructive" className="w-full" onClick={() => deleteNode(node.id)}>
          <Trash2 className="mr-1 h-4 w-4" /> Delete node
        </Button>
      </div>
      <NodeImagePicker
        open={!!imagePickerField}
        onClose={() => setImagePickerField("")}
        folder={nodeImageFolder}
        title={imagePickerField === "frameImage" ? "Choose frame artwork" : "Choose node artwork"}
        onFolderChange={(folder) =>
          setSettings((current) => ({
            ...current,
            nodeImageFolder: folder,
            library: { ...(current.library || {}), nodeImageFolder: folder },
          }))
        }
        onPick={(url) => {
          if (imagePickerField) updateNode(node.id, { [imagePickerField]: url });
        }}
      />
    </div>
  );
}









