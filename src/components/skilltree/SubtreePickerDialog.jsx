import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ListTree } from "lucide-react";
import { useTree } from "@/lib/treeStore";

// Shown when the player unlocks (or clicks the subtree chevron on) a talent
// that owns its own skill trees: pick which tree to open in a side panel and
// spend its granted pool in. Trees already open in a panel are greyed out —
// one tree, one panel — as are trees with no nodes to invest in.
export function SubtreePickerDialog({ node, onPick, onClose }) {
  const { character } = useTree();
  if (!node) return null;
  const level = Math.max(1, Number(character?.level) || 1);
  const subtrees = (node.subtrees || [])
    .map((subtree, index) => ({ subtree, index }))
    .filter(({ subtree }) => !Number(subtree.level) || Number(subtree.level) <= level)
    .sort(
      (a, b) =>
        Number(!!b.subtree.default) - Number(!!a.subtree.default) ||
        Number(a.subtree.level || 0) - Number(b.subtree.level || 0)
    );

  return (
    <Dialog open={!!node} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choose a talent tree — {node.name}</DialogTitle>
          <DialogDescription>
            This talent opens its own skill trees. Pick one to open in a side panel and spend
            its granted points there. Greyed trees are already open.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {subtrees.map(({ subtree: s, index: i }) => {
            const empty = (s.nodes || []).length === 0;
            const locked = empty;
            return (
              <button
                key={s.id || i}
                disabled={locked}
                onClick={() => onPick(i)}
                className={`flex w-full items-center gap-2 rounded-md border p-3 text-left text-sm transition-colors ${
                  locked ? "cursor-not-allowed opacity-50" : "hover:bg-accent"
                } ${s.default ? "border-primary/50 bg-primary/5" : ""}`}
              >
                <ListTree className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {s.name || `Subtree ${i + 1}`}
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {empty
                      ? "No nodes yet"
                      : `${(s.nodes || []).length} nodes · ${s.poolName || "Subtree"} pool · ${Number(s.grantedPoints) || 0} points granted${
                          Number(s.maxPurchases) > 0
                            ? ` · bought ${Number(s.purchases) || 0}/${s.maxPurchases}`
                            : ""
                        }`}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  {s.default && (
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9px] text-primary">
                      Default
                    </span>
                  )}
                  {Number(s.level) > 0 && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                      Lvl {s.level}
                    </span>
                  )}
                  {!empty && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                      Right panel
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          {subtrees.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No subtree is available at character level {level}. Lower a subtree&apos;s unlock level
              or mark a default subtree.
            </p>
          )}
        </div>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}