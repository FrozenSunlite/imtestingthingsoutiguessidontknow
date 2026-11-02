import { useEffect, useRef, useState } from "react";
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
  const [open, setOpen] = useState(false);
  const nodeIdRef = useRef(nodeId);
  nodeIdRef.current = nodeId;

  useEffect(() => {
    if (ui.editingNodeId) {
      const alreadyMounted = !!nodeIdRef.current;
      setNodeId(ui.editingNodeId);
      // A first open must render one frame in the closed position before the
      // transition starts; an open/switch while mounted can open immediately.
      if (alreadyMounted) setOpen(true);
      return undefined;
    }
    setOpen(false);
    const timer = setTimeout(() => setNodeId(null), 320);
    return () => clearTimeout(timer);
  }, [ui.editingNodeId]);

  // First mount is intentionally closed. Opening on the next frame lets the
  // same 300 ms transition play for the slide-in and the slide-out.
  useEffect(() => {
    if (!nodeId) return undefined;
    const frame = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(frame);
  }, [nodeId]);

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
