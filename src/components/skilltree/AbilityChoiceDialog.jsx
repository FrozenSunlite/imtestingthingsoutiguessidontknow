import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, ChevronRight, Lock, ListTree } from "lucide-react";
import { subtreeOptions } from "@/lib/optionTree";

// Shown when investing a point into a node that grants a choice of benefits
// (e.g. Fighting Style). A node's "Options per investment" setting lets one
// take pick several benefits at once. An option may list several requirements
// — every one of them must be met to pick it.
//
// Options with a subtree open a nested pick list: after taking the option the
// player picks from its subtree (linked from another node, or embedded
// inline), recursively to any depth. The full chain is recorded as one path
// string, e.g. "Archery > Precision".
export function AbilityChoiceDialog({ node, nodesById, choices, perTake = 1, onPick, onClose }) {
  const [picked, setPicked] = useState([]); // complete choice paths (arrays of names)
  const [drill, setDrill] = useState(null); // name path currently being browsed
  useEffect(() => {
    setPicked([]);
    setDrill(null);
  }, [node]);
  if (!node) return null;
  const taken = choices[node.id] || [];
  const n = Math.max(1, Number(perTake) || 1);
  const multi = n > 1;

  const reqsOf = (opt) => (Array.isArray(opt.requires) ? opt.requires : []);

  // Requirement matching accepts a full choice path when its first segment
  // names the required option.
  const hasChoice = (nodeId, optionName) =>
    (choices[nodeId] || []).some(
      (c) => c === optionName || String(c).split(" > ")[0] === optionName
    );

  const optionMet = (opt) =>
    reqsOf(opt).every((req) => {
      if (req.type === "node") {
        const d = nodesById[req.nodeId];
        return !!d && (d.currentPoints || 0) > 0;
      }
      if (req.type === "option") {
        return hasChoice(req.nodeId, req.optionName);
      }
      return true;
    });

  const reqLabel = (opt) => {
    const parts = reqsOf(opt)
      .map((req) => {
        if (req.type === "node") return `points in ${nodesById[req.nodeId]?.name || "?"}`;
        if (req.type === "option")
          return `"${req.optionName || "?"}" chosen on ${nodesById[req.nodeId]?.name || "?"}`;
        return null;
      })
      .filter(Boolean);
    return parts.length ? `Requires ${parts.join(" and ")}` : "";
  };

  // Options shown at the current level: the node's root options, or the
  // subtree options of the drilled path.
  let levelOpts = node.options || [];
  if (drill && drill.length) {
    let opts = node.options || [];
    let opt = null;
    for (const seg of drill) {
      opt = opts.find((o) => (o.name || "") === seg);
      if (!opt) break;
      opts = subtreeOptions(opt, nodesById);
    }
    levelOpts = opts;
  }
  const atRoot = !drill || drill.length === 0;

  const pick = (opt, i) => {
    const name = opt.name || `Benefit ${i + 1}`;
    if (subtreeOptions(opt, nodesById).length) {
      // Not a leaf yet — drill into its subtree.
      setDrill([...(drill || []), name]);
      return;
    }
    const path = [...(drill || []), name];
    if (!multi) {
      onPick([path.join(" > ")]);
      return;
    }
    setPicked((p) => [...p, path]);
    setDrill(null);
  };

  return (
    <Dialog open={!!node} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {multi ? `Choose ${n} benefits` : "Choose a benefit"} — {node.name}
          </DialogTitle>
          <DialogDescription>
            {multi ? `Pick ${n} benefits for this take.` : "Pick one benefit for this take."}
            {taken.length > 0 && ` Already taken: ${taken.join(", ")}.`}
          </DialogDescription>
        </DialogHeader>
        {/* Breadcrumb while inside a subtree. */}
        {!atRoot && (
          <div className="flex flex-wrap items-center gap-0.5 rounded-md border bg-muted/40 px-2 py-1 text-xs">
            <button className="rounded px-0.5 hover:bg-accent" onClick={() => setDrill(null)}>
              {node.name}
            </button>
            {drill.map((seg, i) => (
              <span key={i} className="flex items-center gap-0.5">
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <button
                  className="rounded px-0.5 hover:bg-accent"
                  onClick={() => setDrill(drill.slice(0, i + 1))}
                >
                  {seg}
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {levelOpts.map((opt, i) => {
            const met = optionMet(opt);
            const name = opt.name || `Benefit ${i + 1}`;
            const subs = subtreeOptions(opt, nodesById);
            const isPicked = picked.some((p) => p.join(" > ") === [...(drill || []), name].join(" > "));
            return (
              <button
                key={i}
                disabled={!met}
                onClick={() => pick(opt, i)}
                className={`block w-full rounded-md border p-3 text-left text-sm transition-colors ${
                  met ? "hover:bg-accent" : "cursor-not-allowed opacity-50"
                } ${isPicked ? "border-primary ring-2 ring-primary/40" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{name}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {subs.length > 0 && (
                      <span className="flex items-center rounded bg-muted px-1 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                        <ListTree className="mr-0.5 h-3 w-3" />
                        {subs.length} pick{subs.length > 1 ? "s" : ""}
                      </span>
                    )}
                    {isPicked ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : !met ? (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : null}
                  </span>
                </div>
                {opt.description && (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{opt.description}</p>
                )}
                {(Array.isArray(opt.attached) ? opt.attached : []).filter((a) => a.nodeId && a.optionName).length > 0 && (
                  <p className="mt-1 text-[10px] text-emerald-600">
                    Also grants:{" "}
                    {(Array.isArray(opt.attached) ? opt.attached : [])
                      .filter((a) => a.nodeId && a.optionName)
                      .map((a) => `${a.optionName} (${nodesById[a.nodeId]?.name || "?"})`)
                      .join(", ")}
                  </p>
                )}
                {!met && <p className="mt-1 text-[10px] text-amber-600">{reqLabel(opt)}</p>}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between">
          {multi ? (
            <>
              <span className="text-xs text-muted-foreground">
                {picked.length}/{n} selected
              </span>
              <div className="flex gap-2">
                {picked.length > 0 && (
                  <Button variant="ghost" onClick={() => setPicked((p) => p.slice(0, -1))}>
                    Undo pick
                  </Button>
                )}
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  disabled={picked.length !== n}
                  onClick={() => onPick(picked.map((p) => p.join(" > ")))}
                >
                  Take {n} benefit{n > 1 ? "s" : ""}
                </Button>
              </div>
            </>
          ) : (
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}