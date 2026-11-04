import { useEffect, useRef } from "react";
import { RichDescription } from "@/components/skilltree/RichDescription";
import { X } from "lucide-react";

// View-mode floating window: holding Alt over a node opens its description
// as a window with clickable [[...]] links — a link jumps to that node or
// opens its subtree. Stays open while the pointer is inside; closes on
// leaving, releasing Alt, pressing Esc or clicking the canvas background.
export function AltDescriptionWindow({ win, nodes, onJumpNode, onOpenSubtree, onClose }) {
  const closingRef = useRef(false);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { node } = win;
  const left = Math.max(8, Math.min(win.x, window.innerWidth - 348));
  const top = Math.max(8, Math.min(win.y, window.innerHeight - 320));
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onPointerLeave={() => {
        closingRef.current = true;
        onClose();
      }}
      className="fixed z-50 flex max-h-[70vh] w-[340px] flex-col overflow-y-auto rounded-md border bg-popover p-3 text-xs shadow-xl"
      style={{ left, top }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{node.name}</p>
        <button className="text-muted-foreground hover:text-foreground" title="Close" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-0.5 text-muted-foreground">
        {(node.currentPoints || 0)}/{node.maxPoints} points
      </p>
      {node.description && (
        <div className="mt-2">
          <RichDescription
            text={node.description}
            nodes={nodes}
            onJumpNode={onJumpNode}
            onOpenSubtree={onOpenSubtree}
            className="whitespace-pre-wrap text-foreground/90"
          />
        </div>
      )}
      {node.flavor && (
        <p className="mt-2 whitespace-pre-wrap italic text-muted-foreground">{node.flavor}</p>
      )}
      {(node.description || node.flavor) && (
        <p className="mt-1 text-[10px] italic text-muted-foreground">
          Flavor is free — reword or replace it; the rules above still apply.
        </p>
      )}
      <p className="mt-2 shrink-0 text-[10px] text-muted-foreground">
        Click a link to jump · release Alt or leave to close
      </p>
    </div>
  );
}