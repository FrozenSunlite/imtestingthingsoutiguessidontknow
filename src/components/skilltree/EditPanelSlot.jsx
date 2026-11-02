import { useEffect, useState } from "react";
import { useTree } from "@/lib/treeStore";
import { usePanelWidth } from "@/hooks/use-panel-width";
import { NodeEditorPanel } from "./NodeEditorPanel";

// The desktop node editor only exists while a node is being edited. It expands
// from the right edge when a node opens and slides away when editing stops,
// keeping the last node visible during the exit animation.
export function EditPanelSlot() {
  const { ui } = useTree();
  const [width] = usePanelWidth();
  const [nodeId, setNodeId] = useState(ui.editingNodeId || null);
  const [open, setOpen] = useState(!!ui.editingNodeId);

  useEffect(() => {
    if (ui.editingNodeId) {
      setNodeId(ui.editingNodeId);
      setOpen(true);
      return undefined;
    }
    setOpen(false);
    const timer = setTimeout(() => setNodeId(null), 320);
    return () => clearTimeout(timer);
  }, [ui.editingNodeId]);

  if (!nodeId) return null;

  return (
    <div
      className="relative h-full shrink-0 overflow-hidden"
      style={{
        width,
        marginRight: open ? 0 : -width,
        transform: open ? "translateX(0)" : "translateX(100%)",
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition:
          "margin-right 300ms ease-out, transform 300ms ease-out, opacity 300ms ease-out",
      }}
    >
      <NodeEditorPanel nodeId={nodeId} />
    </div>
  );
}
