import { useState } from "react";
import { useTree } from "@/lib/treeStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, X } from "lucide-react";

// Tab strip above the canvas: each tab holds its own tree (nodes + connectors).
// Click to switch, double-click to rename, X on the active tab to close it.
// Carried nodes (dragged off the canvas) can be dropped on a tab header to
// move them into that tab's tree.
export function TabBar() {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    addTab,
    renameTab,
    deleteTab,
    tree,
    carry,
    dropCarriedOnTab,
  } = useTree();
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");
  const [dropId, setDropId] = useState(null);
  if (!tree || !(tabs || []).length) return null;

  // A node can't be dropped onto the tab it came from — only into another
  // tab's tree (or any tab when it is being pulled out of a subtree).
  const canDrop = (t) =>
    !!carry && (carry.from?.kind === "subtree" || t.id !== activeTabId);

  const commit = () => {
    if (editingId) renameTab(editingId, draft.trim() || "Tree");
    setEditingId(null);
  };

  return (
    <div className="flex items-center gap-1 border-b bg-muted/40 px-2 py-1">
      {tabs.map((t) => {
        const active = t.id === activeTabId;
        if (editingId === t.id) {
          return (
            <Input
              key={t.id}
              autoFocus
              className="h-6 w-32 text-xs"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setEditingId(null);
              }}
            />
          );
        }
        return (
          <div
            key={t.id}
            onPointerEnter={() => canDrop(t) && setDropId(t.id)}
            onPointerLeave={() => setDropId((id) => (id === t.id ? null : id))}
            onPointerUp={() => {
              if (canDrop(t)) {
                dropCarriedOnTab(t.id);
                setDropId(null);
              }
            }}
            className={`group flex items-center gap-1 rounded-t-md border-b-2 px-2.5 py-1 text-xs ${
              active
                ? "border-primary bg-background font-medium"
                : "border-transparent text-muted-foreground hover:bg-background/60"
            } ${dropId === t.id ? "ring-2 ring-primary" : ""}`}
          >
            <button
              className="max-w-40 truncate"
              title={`${t.name} — double-click to rename`}
              onClick={() => setActiveTab(t.id)}
              onDoubleClick={() => {
                setEditingId(t.id);
                setDraft(t.name);
              }}
            >
              {t.name}
            </button>
            {active && (
              <button
                title="Rename tab"
                onClick={() => {
                  setEditingId(t.id);
                  setDraft(t.name);
                }}
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
            {active && tabs.length > 1 && (
              <button title="Close tab (deletes its nodes)" onClick={() => deleteTab(t.id)}>
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-1.5"
        title="New tab — its own tree of nodes"
        onClick={addTab}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}