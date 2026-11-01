import { useState } from "react";
import { useTree } from "@/lib/treeStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InfoTip } from "@/components/skilltree/InfoTip";
import { FieldGroup } from "@/components/skilltree/FieldGroup";
import { AbilityReqEditor } from "@/components/skilltree/AbilityReqEditor";
import { SubtreeNodeEditor } from "@/components/skilltree/SubtreeNodeEditor";
import { SubtreePreview } from "@/components/skilltree/SubtreePreview";
import {
  makeReturnNode,
  nextSubtreeId,
} from "@/lib/subtrees";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, FolderOpen, Plus, Network, Share2, Trash2, Unlink } from "lucide-react";

// A node's subtrees: its own skill trees, each with its own pool and edited
// in the full subtree editor. The section is a drop target: dropping carried
// canvas nodes on a subtree copies them into that tree (linked to the host's
// copy); dropping on the empty strip creates a new subtree seeded with a copy
// of this node. A node can never be dropped into its own subtree — the store
// rejects that drop. Each subtree also lists its nodes with miniature effect
// editors (cost, ability gates, proficiencies, bonus dice, actions,
// resources) for quick access without leaving this panel.
export function SubtreesSection({ node, set }) {
  const {
    enterSubtreeEditor,
    carry,
    dropCarriedOnSubtree,
    settings,
    setSettings,
    updateSubtreeInstance,
    loadSharedSubtree,
    unlinkSubtree,
    saveSharedSubtree,
  } = useTree();
  const [dropKey, setDropKey] = useState(null);
  const [expanded, setExpanded] = useState(null); // "subtreeIndex:nodeIndex"
  const [shareIndex, setShareIndex] = useState(null);
  const [shareName, setShareName] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const subtrees = node.subtrees || [];
  const shared = settings?.library?.sharedSubtrees || [];

  const addSubtree = () =>
    set({
      subtrees: [
        ...subtrees,
        {
          id: nextSubtreeId(),
          name: `Subtree ${subtrees.length + 1}`,
          nodes: [makeReturnNode()],
          connections: [],
          grantedPoints: 3,
          poolName: "",
          exclusive: false,
          maxPurchases: 0,
          purchases: 0,
          abilityReqs: [],
        },
      ],
    });

  const openShare = (i) => {
    setShareIndex(i);
    setShareName(subtrees[i]?.name || `Subtree ${i + 1}`);
  };

  const saveShared = () => {
    const st = subtrees[shareIndex];
    if (!st) return;
    saveSharedSubtree(node.id, shareIndex, shareName || st.name);
    toast.success(
      `Saved "${String(shareName || st.name || "Shared subtree").trim()}" to the shared subtree library.`
    );
    setShareIndex(null);
    setShareName("");
  };

  const loadShared = (entry) => {
    loadSharedSubtree(node.id, entry);
    setLibraryOpen(false);
    toast.success(
      `Loaded "${entry.name || "Shared subtree"}" as a shared subtree.`
    );
  };

  const removeShared = (id) =>
    setSettings((s) => ({
      ...s,
      library: {
        ...(s.library || {}),
        sharedSubtrees: (s.library?.sharedSubtrees || []).filter((t) => t.id !== id),
      },
    }));

  const patch = (i, up) => updateSubtreeInstance(node.id, i, up);

  const remove = (i) => set({ subtrees: subtrees.filter((_, j) => j !== i) });

  const enter = (key) => carry && setDropKey(key);
  const leave = (key) => setDropKey((k) => (k === key ? null : k));
  const drop = (key) => {
    setDropKey(null);
    if (carry)
      dropCarriedOnSubtree(node.id, key === "new" ? subtrees.length : key);
  };

  return (
    <FieldGroup label="Subtrees">
      <InfoTip label="This node can unlock several of its own skill trees. Drag nodes from the canvas onto a subtree to copy them into it; each tree keeps its own points and settings.">
        <Label>Node subtrees (own skill trees)</Label>
      </InfoTip>
      {subtrees.map((st, i) => (
        <div
          key={st.id || i}
          onPointerEnter={() => enter(i)}
          onPointerLeave={() => leave(i)}
          onPointerUp={() => drop(i)}
          className={`space-y-1.5 rounded-md border p-2 transition-colors ${
            dropKey === i ? "border-primary bg-primary/10" : ""
          }`}
        >
          <div className="flex items-center gap-1">
            <Input
              className="h-7 flex-1"
              value={st.name || ""}
              placeholder="Subtree name"
              onChange={(e) => patch(i, { name: e.target.value })}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-1.5"
              title="Edit this subtree"
              onClick={() => enterSubtreeEditor(node.id, i)}
            >
              <Network className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-1.5"
              title="Save this subtree to the shared library"
              onClick={() => openShare(i)}
            >
              <Share2 className="h-4 w-4" />
            </Button>
            {st.sharedId && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-1.5"
                title="Unlink from the shared definition, keeping a local copy"
                onClick={() => unlinkSubtree(node.id, i)}
              >
                <Unlink className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-1.5 text-destructive"
              title="Delete this subtree"
              onClick={() => remove(i)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {st.sharedId && (
            <p className="text-[10px] text-primary">
              Shared tree — structural edits update every node using it. Points,
              purchases and exclusivity stay per node.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Pool name</Label>
              <Input
                className="h-7"
                value={st.poolName || ""}
                placeholder="e.g. Maneuvers"
                onChange={(e) => patch(i, { poolName: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Points granted</Label>
              <Input
                className="h-7"
                type="number"
                min={0}
                value={st.grantedPoints ?? 3}
                onChange={(e) =>
                  patch(i, { grantedPoints: Math.max(0, Number(e.target.value) || 0) })
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Purchase limit</Label>
              <Input
                className="h-7"
                type="number"
                min={0}
                value={st.maxPurchases ?? 0}
                onChange={(e) =>
                  patch(i, { maxPurchases: Math.max(0, Number(e.target.value) || 0) })
                }
              />
            </div>
            <p className="self-end pb-1 text-[10px] text-muted-foreground">
              0 = unlimited. Each purchase adds another {st.grantedPoints ?? 3} points.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Unlock level</Label>
              <Input
                className="h-7"
                type="number"
                min={0}
                value={st.level ?? 0}
                onChange={(e) =>
                  patch(i, { level: Math.max(0, Number(e.target.value) || 0) })
                }
              />
            </div>
            <label className="flex items-end gap-1.5 pb-1 text-xs">
              <Switch
                checked={!!st.default}
                onCheckedChange={(v) => patch(i, { default: v })}
              />
              Default subtree
            </label>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Level 0 is always available. When no level-specific subtree is ready, the default tree
            is used automatically.
          </p>
          <div className="rounded border bg-background p-1">
            <SubtreePreview subtree={st} width={210} interactive />
          </div>
          <label className="flex items-center gap-1.5 text-xs">
            <Switch
              checked={!!st.exclusive}
              onCheckedChange={(v) => patch(i, { exclusive: v })}
            />
            Mutually exclusive (only one root branch)
          </label>
          <AbilityReqEditor
            reqs={st.abilityReqs || []}
            onChange={(abilityReqs) => patch(i, { abilityReqs })}
            label="Ability score gate"
            info="Ability scores the character needs before spending this subtree's points."
            compact
          />
          <div className="space-y-1">
            <Label className="text-[10px]">Nodes ({st.nodes.length})</Label>
            {st.nodes.map((sn, k) => {
              const key = `${i}:${k}`;
              const isReturn = !!sn.__returnNode;
              const setNode = (up) =>
                patch(i, {
                  nodes: st.nodes.map((m, j) => (j === k ? { ...m, ...up } : m)),
                });
              return (
                <div key={sn.id || k} className="rounded-md border p-1.5">
                  <div className="flex items-center gap-1">
                    {!isReturn && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 shrink-0 px-0"
                        title="Edit effects"
                        onClick={() => setExpanded(expanded === key ? null : key)}
                      >
                        {expanded === key ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Input
                      className="h-7 flex-1"
                      value={sn.name || ""}
                      placeholder="Node name"
                      onChange={(e) => setNode({ name: e.target.value })}
                    />
                    {!isReturn && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {(sn.currentPoints || 0) > 0 ? `${sn.currentPoints}/${sn.maxPoints || 1}` : `cost ${sn.cost ?? 1}`}
                      </span>
                    )}
                  </div>
                  {!isReturn && expanded === key && (
                    <SubtreeNodeEditor node={sn} set={setNode} settings={settings} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div
        onPointerEnter={() => enter("new")}
        onPointerLeave={() => leave("new")}
        onPointerUp={() => drop("new")}
        className={`flex items-center justify-center gap-1 rounded-md border border-dashed p-2 text-xs text-muted-foreground transition-colors ${
          dropKey === "new" ? "border-primary bg-primary/10 text-foreground" : ""
        }`}
      >
        <Plus className="h-3.5 w-3.5" />
        Drop nodes here for a new subtree
        {subtrees.length ? "" : " — creates this node's first subtree"}
      </div>
      {!carry && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={addSubtree}>
            <Plus className="mr-1 h-4 w-4" /> Add subtree
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => setLibraryOpen(true)}
            title="Load a saved shared subtree"
          >
            <FolderOpen className="mr-1 h-4 w-4" /> Shared library
            {shared.length ? ` (${shared.length})` : ""}
          </Button>
        </div>
      )}

      {/* Save the selected subtree as a reusable, per-node-loaded template. */}
      <Dialog open={shareIndex !== null} onOpenChange={(v) => !v && setShareIndex(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save subtree to the shared library</DialogTitle>
            <DialogDescription>
              Save a reusable template of this subtree. Loading it into other nodes
              shares the same node structure, while each node keeps its own points,
              purchases and exclusivity setting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Library name</Label>
            <Input
              value={shareName}
              placeholder="e.g. Fighting Styles"
              onChange={(e) => setShareName(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setShareIndex(null)}>
                Cancel
              </Button>
              <Button onClick={saveShared}>Save to library</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reusable subtree library: each entry can be loaded into this node. */}
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Shared subtree library</DialogTitle>
            <DialogDescription>
              Loading links this node to the shared definition. Structural edits
              update every node using it; points, purchases and mutual exclusivity
              stay specific to each node. Use Unlink for a private copy.
            </DialogDescription>
          </DialogHeader>
          {shared.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No shared subtrees yet. Use the share button on any subtree to save it here.
            </p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {shared.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 rounded-md border p-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{entry.name || "Shared subtree"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {(entry.nodes || []).filter((n) => !n.__returnNode).length} nodes
                      {entry.exclusive ? " · exclusive" : ""}
                      {entry.grantedPoints ? ` · ${entry.grantedPoints} points` : ""}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => loadShared(entry)}>
                    Load
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    title="Remove from library"
                    onClick={() => removeShared(entry.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </FieldGroup>
  );
}