import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTree } from "@/lib/treeStore";
import { scaledNodeSize } from "@/lib/nodeSizing";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRESETS = [-50, -25, -10, 10, 25, 50];

function countNodes(nodes) {
  return (nodes || []).reduce(
    (sum, node) =>
      sum +
      1 +
      (node.subtrees || []).reduce(
        (subSum, subtree) => subSum + countNodes(subtree.nodes),
        0
      ),
    0
  );
}

// Bulk version of Appearance -> Node Size. Every node is multiplied by the
// same percentage, so a 200 px node reduced by 20% becomes 160 px while a
// 100 px node becomes 80 px.
export function ScaleNodesDialog({ open, onOpenChange }) {
  const { tree, scaleAllNodeSizes } = useTree();
  const [value, setValue] = useState("-10");

  useEffect(() => {
    if (open) setValue("-10");
  }, [open]);

  const percent = Number(value);
  const valid =
    Number.isFinite(percent) && percent !== 0 && percent > -100 && percent <= 300;

  const nodeCount = useMemo(() => {
    const spaces = tree?.tabs?.length
      ? tree.tabs
      : [{ nodes: tree?.nodes }];
    return spaces.reduce((sum, tab) => sum + countNodes(tab.nodes), 0);
  }, [tree]);

  const apply = () => {
    if (!valid) return;
    scaleAllNodeSizes(percent);
    toast.success(
      `Scaled every node size by ${percent > 0 ? "+" : ""}${percent}%.`
    );
    onOpenChange(false);
  };

  const sample = (size) => scaledNodeSize(size, percent);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Scale all node sizes</DialogTitle>
          <DialogDescription>
            Multiplies every node&apos;s Appearance &rarr; Node Size by the same
            percentage. Node positions, connections and point values stay the
            same.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="node-scale-percent">Percentage change</Label>
            <div className="relative">
              <Input
                id="node-scale-percent"
                type="number"
                inputMode="numeric"
                step={5}
                min={-95}
                max={300}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="h-8 w-24 pr-7 text-right"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                %
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant={percent === preset ? "default" : "outline"}
                className="h-7 px-2 text-xs"
                onClick={() => setValue(String(preset))}
              >
                {preset > 0 ? `+${preset}%` : `${preset}%`}
              </Button>
            ))}
          </div>

          <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
            <p className="font-medium">Preview</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
              <span>100 px &rarr; {sample(100) ?? "—"} px</span>
              <span>200 px &rarr; {sample(200) ?? "—"} px</span>
            </div>
          </div>

          {!valid && value !== "" && (
            <p className="text-[11px] text-destructive">
              Enter a percentage between -95% and +300% (0% changes nothing).
            </p>
          )}

          <p className="text-[11px] text-muted-foreground">
            Applies to every node in this project, including all tree tabs and
            nested subtrees. {nodeCount} node{nodeCount === 1 ? "" : "s"} found.
            Use Undo (Ctrl+Z) to reverse it.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={!valid}>
            Apply scale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
