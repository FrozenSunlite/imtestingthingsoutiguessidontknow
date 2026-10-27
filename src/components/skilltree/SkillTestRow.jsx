import { useState } from "react";
import { Minus, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// One skill tile in the Character tab's Unlocked Skills grid (three columns).
// A chevron expands the description plus the node's chosen subtree options —
// collapsed by default so a long list stays compact.
// The − / + controls add or remove a point directly for testing (bypasses all
// invest gates). Double-clicking jumps to the node on its tree panel.
export default function SkillTestRow({ node, onAdjust, onJump }) {
  const [open, setOpen] = useState(false);
  const subtreePicks = (node.subtrees || [])
    .map((st) => ({
      name: st.name || "Subtree",
      picks: (st.nodes || [])
        .filter((m) => (m.currentPoints || 0) > 0)
        .map((m) => `${m.name || "Unnamed"}${(m.currentPoints || 0) > 1 ? ` (${m.currentPoints})` : ""}`),
    }))
    .filter((s) => s.picks.length);
  const hasDetail = !!(node.description || subtreePicks.length);

  return (
    <div
      className="rounded-lg border bg-accent/40 px-2.5 py-1"
      title={onJump ? "Double-click to jump to this skill on the tree" : undefined}
      onDoubleClick={onJump ? () => onJump(node) : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 text-left"
          onClick={() => hasDetail && setOpen(!open)}
        >
          {hasDetail &&
            (open ? (
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            ))}
          <span className="truncate text-[11px] font-semibold">{node.name}</span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          <span className="mr-1 font-mono text-[10px] text-muted-foreground">
            {node.currentPoints || 0}/{node.maxPoints}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            title="Remove a test point"
            onClick={() => onAdjust(node, -1)}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            title="Add a test point"
            onClick={() => onAdjust(node, 1)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {open && hasDetail && (
        <div className="mt-1 space-y-1 border-t pt-1">
          {node.description && (
            <p className="text-[10px] leading-snug text-muted-foreground">{node.description}</p>
          )}
          {subtreePicks.map((s) => (
            <div key={s.name}>
              <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                {s.name}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {s.picks.map((p, i) => (
                  <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[9px]">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}