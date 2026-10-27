import { useEffect, useState } from "react";
import { useTree } from "@/lib/treeStore";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Chooser for "Send to subtree": one row per selected node, each listing the
// parents it connects from that own subtrees and which of their subtrees to
// receive it. Send moves them all in one go.
export function SendToSubtreeDialog({ open, rows, onClose }) {
  const { sendNodesToSubtree } = useTree();
  const [choices, setChoices] = useState({});
  useEffect(() => {
    if (open) setChoices({});
  }, [open, rows]);
  if (!open || !rows?.length) return null;
  const send = () => {
    sendNodesToSubtree(
      rows.map((r) => {
        const opt = r.options[choices[r.nodeId] ?? 0] || r.options[0];
        return { id: r.nodeId, hostId: opt.hostId, subIndex: opt.subIndex };
      })
    );
    toast.success(`Sent ${rows.length} node${rows.length > 1 ? "s" : ""} into a subtree.`);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send to a parent's subtree</DialogTitle>
          <DialogDescription>
            Each node moves into the chosen subtree, keeps its distance from the
            parent, and connects to the subtree's starter node.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-3 overflow-y-auto">
          {rows.map((r) => (
            <div key={r.nodeId} className="rounded-lg border p-2.5">
              <div className="mb-1.5 text-xs font-semibold">
                {r.nodeName}
                {r.options.length > 1 && (
                  <span className="ml-1 font-normal text-muted-foreground">
                    ({r.options.length} destinations)
                  </span>
                )}
              </div>
              <Select
                value={String(choices[r.nodeId] ?? 0)}
                onValueChange={(v) =>
                  setChoices((c) => ({ ...c, [r.nodeId]: Number(v) }))
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {r.options.map((o, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={send}>
            Send
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}