import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ListTree } from "lucide-react";

// Shown when the player unlocks (or clicks the subtree chevron on) a talent
// that owns its own skill trees: pick which tree to open in a side panel and
// spend its granted pool in. Trees already open in a panel are greyed out —
// one tree, one panel — as are trees with no nodes to invest in.
export function SubtreePickerDialog({ node, sideTrees, onPick, onClose }) {
  if (!node) return null;
  const subtrees = node.subtrees || [];

  const openSlot = (i) =>
    ["left", "right"].find(
      (s) =>
        sideTrees?.[s]?.subtreeHostId === node.id &&
        sideTrees[s].subtreeIndex === i &&
        !sideTrees[s].closed
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
          {subtrees.map((s, i) => {
            const slot = openSlot(i);
            const empty = (s.nodes || []).length === 0;
            const locked = !!slot || empty;
            return (
              <button
                key={s.id || i}
                disabled={locked}
                onClick={() => onPick(i)}
                className={`flex w-full items-center gap-2 rounded-md border p-3 text-left text-sm transition-colors ${
                  locked ? "cursor-not-allowed opacity-50" : "hover:bg-accent"
                }`}
              >
                <ListTree className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.name || `Subtree ${i + 1}`}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {empty
                      ? "No nodes yet"
                      : `${(s.nodes || []).length} nodes · ${s.poolName || "Subtree"} pool · ${Number(s.grantedPoints) || 0} points granted`}
                  </span>
                </span>
                {slot && (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    Open in {slot} panel
                  </span>
                )}
              </button>
            );
          })}
          {subtrees.length === 0 && (
            <p className="text-xs text-muted-foreground">No subtrees on this node yet.</p>
          )}
        </div>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}