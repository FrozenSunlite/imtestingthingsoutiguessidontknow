import { useState } from "react";
import { useTree } from "@/lib/treeStore";
import { Button } from "@/components/ui/button";
import { ChevronDown, Eraser, ScrollText } from "lucide-react";

// The character's activity log, floating in a corner of the View screen so
// activated actions and dice rolls are always visible (not buried in a
// dialog).
export function ActivityLogPanel() {
  const { character, setCharacter } = useTree();
  const [open, setOpen] = useState(true);
  const log = character.activityLog || [];
  return (
    <div className="absolute bottom-3 right-3 z-20 w-64 rounded-lg border bg-card shadow-lg">
      <div className="flex items-center justify-between border-b px-2 py-1">
        <button className="flex items-center gap-1 text-xs font-semibold" onClick={() => setOpen(!open)}>
          <ScrollText className="h-3.5 w-3.5" /> Activity Log
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "" : "-rotate-90"}`} />
        </button>
        {log.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-5 px-1"
            title="Clear the log"
            onClick={() => setCharacter({ ...character, activityLog: [] })}
          >
            <Eraser className="h-3 w-3" />
          </Button>
        )}
      </div>
      {open && (
        <div className="max-h-48 overflow-y-auto p-2">
          {log.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">Nothing yet — use Actions or Dice.</p>
          ) : (
            log.map((e, i) => (
              <p key={i} className={i === 0 ? "text-xs font-medium" : "text-xs text-muted-foreground"}>
                {e.at ? <span className="mr-1 font-mono text-[9px] text-muted-foreground">{e.at}</span> : null}
                {e.text}
              </p>
            ))
          )}
        </div>
      )}
    </div>
  );
}