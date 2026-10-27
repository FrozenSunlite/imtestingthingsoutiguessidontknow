import { useEffect, useState } from "react";
import { useTree } from "@/lib/treeStore";

// Floating chip that follows the pointer while nodes are carried between the
// canvas, tab headers and the Subtrees section. Releasing over empty space
// cancels the carry (the node stays where it was).
export function CarryGhost() {
  const { carry, endCarry } = useTree();
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!carry) {
      setPos(null);
      return;
    }
    const move = (e) => setPos({ x: e.clientX, y: e.clientY });
    const up = () => endCarry();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [carry, endCarry]);

  if (!carry || !pos) return null;
  return (
    <div
      className="pointer-events-none fixed z-[60] max-w-64 -translate-y-1/2 truncate rounded-md border border-primary bg-primary px-2 py-1 text-xs font-medium text-primary-foreground shadow-lg"
      style={{ left: pos.x + 14, top: pos.y }}
    >
      {carry.nodes.length === 1
        ? carry.nodes[0].name || "Node"
        : `${carry.nodes.length} nodes`}{" "}
      — drop on a tab or Subtrees section
    </div>
  );
}