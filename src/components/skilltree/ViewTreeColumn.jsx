import { useEffect, useState } from "react";
import { useTree } from "@/lib/treeStore";
import { usePanelWidth } from "@/hooks/use-panel-width";
import { SideTreePanel } from "@/components/skilltree/SideTreePanel";
import { PanelResizer } from "@/components/skilltree/PanelResizer";
import { StackSplitter } from "@/components/skilltree/StackSplitter";

const SPLIT_KEY = "skilltree:sideSplit";

// Both play-mode trees share one column on the left of the View sheet: the
// standard tree on top and the second tree underneath it. One vertical border
// sets their shared width, and the horizontal splitter sets how the height is
// divided between them.
export function ViewTreeColumn() {
  const { sideTrees } = useTree();
  const [width, setWidth] = usePanelWidth(460, 260, 900, "skilltree:sideWidth:stack");
  const [split, setSplit] = useState(0.5);

  useEffect(() => {
    const saved = Number(localStorage.getItem(SPLIT_KEY));
    if (saved >= 0.18 && saved <= 0.82) setSplit(saved);
  }, []);

  const left = !!sideTrees?.left && !sideTrees.left.closed;
  const right = !!sideTrees?.right && !sideTrees.right.closed;
  if (!left && !right) return null;

  const updateSplit = (value) => {
    setSplit(value);
    try {
      localStorage.setItem(SPLIT_KEY, String(value));
    } catch {
      /* storage unavailable: the split still works for this session */
    }
  };

  return (
    <div
      className="relative flex min-h-0 shrink-0 flex-col border-r bg-card"
      style={{ width }}
    >
      <PanelResizer width={width} onResize={setWidth} edge="right" />
      {left && (
        <div
          className="flex min-h-0 min-w-0 flex-col"
          style={{ flexGrow: right ? split : 1, flexBasis: 0 }}
        >
          <SideTreePanel slot="left" stacked />
        </div>
      )}
      {left && right && <StackSplitter value={split} onChange={updateSplit} />}
      {right && (
        <div
          className="flex min-h-0 min-w-0 flex-col"
          style={{ flexGrow: left ? 1 - split : 1, flexBasis: 0 }}
        >
          <SideTreePanel slot="right" stacked />
        </div>
      )}
    </div>
  );
}
