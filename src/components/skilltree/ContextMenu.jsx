import { useTree } from "@/lib/treeStore";
import { snapPoint } from "@/lib/geometry";
import { InfoTip } from "@/components/skilltree/InfoTip";
import {
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Copy,
  Trash2,
  Pencil,
  Link2,
  GitBranch,
  ArrowLeftRight,
  Plus,
  Scissors,
  MoveRight,
  Pin,
  PinOff,
  Network,
} from "lucide-react";

export function ContextMenu({ x, y, node, world, editable = true, onSendToSubtree, onClose }) {
  const {
    rotateNode,
    flipNode,
    deleteNode,
    addNode,
    setUi,
    updateNode,
    patchTab,
    toggleDependency,
    invertPrerequisites,
    grid,
    ui,
    copyNodes,
    cutNodes,
    moveNodesToTab,
    tabs,
    activeTabId,
    tree,
    enterSubtreeEditor,
  } = useTree();
  // Non-edit modes (Values / View) get a display-only menu: pin the node.
  if (!editable) {
    if (!node) return null;
    const pinnedNow = (ui.pinnedNodeIds || []).includes(node.id);
    return (
      <>
        <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
        <div className="fixed z-50 w-44 rounded-md border bg-popover p-1 shadow-lg" style={{ left: x, top: y }}>
          {item(
            pinnedNow ? "Unpin from display" : "Pin for display",
            pinnedNow ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />,
            () =>
              setUi((u) => ({
                ...u,
                pinnedNodeIds: (u.pinnedNodeIds || []).includes(node.id)
                  ? (u.pinnedNodeIds || []).filter((id) => id !== node.id)
                  : [...(u.pinnedNodeIds || []), node.id],
              })),
            false,
            "Show this node's full player-facing details in a pinned card"
          )}
        </div>
      </>
    );
  }
  if (!node && !world) return null;

  const item = (label, icon, onClick, danger, tip) => (
    <InfoTip label={tip || label} side="right">
      <button
        onClick={() => {
          onClick();
          onClose();
        }}
        className={`flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm hover:bg-accent ${
          danger ? "text-destructive" : "text-foreground"
        }`}
      >
        {icon}
        {label}
      </button>
    </InfoTip>
  );

  // Cut applies to the selection (or this single node); Ctrl+V pastes it into
  // whichever tab is active, so cut doubles as cross-tab move.
  const cutIds = node
    ? (ui.selectedNodeIds || []).length
      ? ui.selectedNodeIds
      : [node.id]
    : [];
  const otherTabs = (tabs || []).filter((t) => t.id !== activeTabId);

  // "Send to subtree": for each selected (or right-clicked) node, every
  // parent it's connected from that owns subtrees — and which of that
  // parent's subtrees — is offered in the chooser dialog.
  const sendRows = (() => {
    const nodes = tree?.nodes || [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const conns = tree?.connections || [];
    const rows = [];
    cutIds.forEach((id) => {
      const n = byId.get(id);
      if (!n) return;
      const options = [];
      const seen = new Set();
      conns.forEach((c) => {
        if (c.to !== id || c.from === id) return;
        const host = byId.get(c.from);
        if (!host) return;
        (host.subtrees || []).forEach((st, subIndex) => {
          const key = `${host.id}:${subIndex}`;
          if (seen.has(key)) return;
          seen.add(key);
          options.push({
            hostId: host.id,
            subIndex,
            label: `${host.name || "node"} — ${st.name || `Subtree ${subIndex + 1}`}`,
          });
        });
      });
      if (options.length)
        rows.push({ nodeId: n.id, nodeName: n.name || "node", options });
    });
    return rows;
  })();

  const duplicate = () => {
    const id = addNode(node.x + 40, node.y + 40);
    updateNode(id, {
      name: node.name + " (copy)",
      maxPoints: node.maxPoints,
      description: node.description,
      flavor: node.flavor,
      resources: node.resources,
      pointType: node.pointType,
      requirementMode: node.requirementMode,
      requiredPoints: node.requiredPoints,
      rotation: node.rotation,
      flipped: node.flipped,
      talentType: node.talentType,
      talentTypes: [...(node.talentTypes || [])],
      tiers: JSON.parse(JSON.stringify(node.tiers || [])),
      levelReq: node.levelReq,
      nodeType: node.nodeType,
      attributeStat: node.attributeStat,
      cost: node.cost,
      options: node.options,
      // Deep-copy so the duplicate's subtree edits never leak into the original.
      subtrees: node.subtrees ? JSON.parse(JSON.stringify(node.subtrees)) : [],
      exclusiveWith: node.exclusiveWith,
      size: node.size,
      grantsExpertise: node.grantsExpertise,
      proficiencyGrant: node.proficiencyGrant,
      proficiencies: node.proficiencies,
      frameImage: node.frameImage,
      choiceProficiencies: node.choiceProficiencies,
    });
    setUi((u) => ({ ...u, selectedNodeId: id, editingNodeId: id }));
  };

  // Creates a child node that inherits this node's talent type.
  const createChild = () => {
    const id = addNode(node.x + 140, node.y);
    updateNode(id, { talentType: node.talentType || "", size: node.size || 100 });
    toggleDependency(node.id, id);
    setUi((u) => ({ ...u, selectedNodeId: id, editingNodeId: id }));
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        className="fixed z-50 w-44 rounded-md border bg-popover p-1 shadow-lg"
        style={{ left: x, top: y }}
      >
        {node ? (
          <>
            {item("Edit", <Pencil className="h-4 w-4" />, () =>
              setUi((u) => ({ ...u, editingNodeId: node.id })),
              false,
              "Open the Edit Node panel for this node"
            )}
            {item("Set as camera start", <Pin className="h-4 w-4" />, () => patchTab && patchTab(activeTabId, { cameraStartNode: node.name }), false, "Center the view on this node when this tab opens")}
            {item(
              (ui.pinnedNodeIds || []).includes(node.id)
                ? "Unpin from display"
                : "Pin for display",
              (ui.pinnedNodeIds || []).includes(node.id) ? (
                <PinOff className="h-4 w-4" />
              ) : (
                <Pin className="h-4 w-4" />
              ),
              () =>
                setUi((u) => ({
                  ...u,
                  pinnedNodeIds: (u.pinnedNodeIds || []).includes(node.id)
                    ? (u.pinnedNodeIds || []).filter((id) => id !== node.id)
                    : [...(u.pinnedNodeIds || []), node.id],
                })),
              false,
              "Show this node's full player-facing details in a pinned card"
            )}
            {item("Rotate +15°", <RotateCw className="h-4 w-4" />, () => rotateNode(node.id, 15), false, "Rotate the artwork 15° clockwise")}
            {item("Rotate −15°", <RotateCcw className="h-4 w-4" />, () => rotateNode(node.id, -15), false, "Rotate the artwork 15° counter-clockwise")}
            {item("Flip", <FlipHorizontal className="h-4 w-4" />, () => flipNode(node.id), false, "Mirror the artwork horizontally")}
            {item("Invert", <FlipVertical className="h-4 w-4" />, () => flipNode(node.id, "v"), false, "Mirror the artwork vertically")}
{item("Duplicate", <Copy className="h-4 w-4" />, duplicate, false, "Copy this node with all its settings")}
            {item("Invert prerequisites", <ArrowLeftRight className="h-4 w-4" />, () => invertPrerequisites(), false, "Swap every prerequisite with its dependent on this tab — fixes trees imported with reversed parent/child roles")}
            {item("Create child node", <GitBranch className="h-4 w-4" />, createChild, false, "Add a connected node to the right that inherits this node's type")}
            {item("Link mode", <Link2 className="h-4 w-4" />, () =>
              setUi((u) => ({ ...u, linkingFromId: node.id })),
              false,
              "Then click another node to draw a connection (Esc cancels; Alt+click works too)"
            )}
            {item("Edit subtree", <Network className="h-4 w-4" />, () =>
              enterSubtreeEditor(node.id, 0),
              false,
              "Open this node's own skill tree for editing — a separate space of nodes unlocked with this node (creates one if it has none)"
            )}
            {cutIds.length > 0 && sendRows.length > 0 && (
              <InfoTip
                label="Send to a parent's subtree — keeps its distance from the parent and autoconnects to the subtree's starter node"
                side="right"
              >
                <button
                  onClick={() => {
                    onSendToSubtree?.(sendRows);
                    onClose();
                  }}
                  className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <Network className="h-4 w-4" /> Send to subtree…
                </button>
              </InfoTip>
            )}
            {cutIds.length > 0 && item("Copy", <Copy className="h-4 w-4" />, () =>
              copyNodes(cutIds),
              false,
              "Copy this node (or the whole selection) to the clipboard — the next copy or cut replaces it"
            )}
            {cutIds.length > 0 && item("Cut", <Scissors className="h-4 w-4" />, () =>
              cutNodes(cutIds),
              false,
              "Cut this node (or the whole selection) — Ctrl+V pastes it into whichever tab is active"
            )}
            {cutIds.length > 0 && otherTabs.length > 0 && (
              <>
                <div className="my-1 h-px bg-border" />
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Move to tab
                </div>
                {otherTabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      moveNodesToTab(cutIds, t.id);
                      onClose();
                    }}
                    className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <MoveRight className="h-4 w-4" /> {t.name}
                  </button>
                ))}
                {/* Moves the node (or selection) plus its whole prerequisite chain. */}
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Move with prerequisites
                </div>
                {otherTabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      const withPrereqs = (() => {
                        const out = new Set(cutIds);
                        const byId = new Map((tree?.nodes || []).map((n) => [n.id, n]));
                        const queue = [...cutIds];
                        while (queue.length) {
                          const n = byId.get(queue.pop());
                          if (!n) continue;
                          (n.dependencies || []).forEach((d) => {
                            if (!out.has(d)) {
                              out.add(d);
                              queue.push(d);
                            }
                          });
                        }
                        return [...out];
                      })();
                      moveNodesToTab(withPrereqs, t.id);
                      onClose();
                    }}
                    className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <GitBranch className="h-4 w-4" /> {t.name} + prerequisites
                  </button>
                ))}
              </>
            )}
            <div className="my-1 h-px bg-border" />
            {item("Delete", <Trash2 className="h-4 w-4" />, () => deleteNode(node.id), true, "Remove this node and its connections")}
          </>
        ) : (
          item(
            "Add node here",
            <Plus className="h-4 w-4" />,
            () => {
            const p = snapPoint(world.x, world.y, grid);
            const id = addNode(p.x, p.y);
            setUi((u) => ({ ...u, selectedNodeId: id, editingNodeId: id }));
          })
        )}
      </div>
    </>
  );
}