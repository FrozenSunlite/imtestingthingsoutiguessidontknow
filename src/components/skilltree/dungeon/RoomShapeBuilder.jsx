import { useEffect, useMemo, useState } from "react";
import {
  ROOM_SHAPES,
  cellsConnected,
  roomShapeCells,
  shapeCells,
} from "@/lib/dungeonGen";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Grid-based room builder: paint the exact floor cells used by the dungeon map
// and battle map. Presets cover common tactical footprints (L, T, U, cross,
// octagon); any connected painted shape is allowed.
export function RoomShapeBuilder({ open, onOpenChange, room, onSave }) {
  const w = Math.max(2, Math.min(20, Math.round(Number(room?.w) || 2)));
  const h = Math.max(2, Math.min(20, Math.round(Number(room?.h) || 2)));
  const [preset, setPreset] = useState("Rectangle");
  const [cells, setCells] = useState(() => new Set());

  useEffect(() => {
    if (!open || !room) return;
    const initial = roomShapeCells({ ...room, w, h });
    setCells(new Set(initial.map(([x, y]) => `${x},${y}`)));
    setPreset("Custom");
  }, [open, room, w, h]);

  const list = useMemo(
    () => [...cells].map((key) => key.split(",").map(Number)),
    [cells]
  );
  const connected = list.length > 0 && cellsConnected(list);

  const toggle = (x, y) => {
    setCells((prev) => {
      const next = new Set(prev);
      const key = `${x},${y}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setPreset("Custom");
      return next;
    });
  };

  const applyPreset = (name) => {
    setPreset(name);
    setCells(new Set(shapeCells(w, h, name).map(([x, y]) => `${x},${y}`)));
  };

  const save = () => {
    if (!connected) return;
    onSave?.(list);
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Room builder — {room?.name || "Room"}</DialogTitle>
          <DialogDescription>
            Paint the floor cells for this battlemap. The shape must stay connected. The room's
            width and height define the grid (currently {w} × {h}).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-[10px] text-muted-foreground">Preset</Label>
          <Select value={preset} onValueChange={applyPreset}>
            <SelectTrigger className="h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[...ROOM_SHAPES, "Custom"].map((shape) => (
                <SelectItem key={shape} value={shape} disabled={shape === "Custom"}>
                  {shape}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[10px] text-muted-foreground">
            {list.length} cells · {connected ? "connected" : "disconnected"}
          </span>
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => applyPreset("Rectangle")}>
              Fill
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCells(new Set())}>
              Clear
            </Button>
          </div>
        </div>

        <div className="overflow-auto rounded-md border p-2">
          <div
            className="mx-auto grid w-max gap-0.5"
            style={{ gridTemplateColumns: `repeat(${w}, 2rem)` }}
          >
            {Array.from({ length: h }, (_, y) =>
              Array.from({ length: w }, (_, x) => {
                const active = cells.has(`${x},${y}`);
                return (
                  <button
                    key={`${x},${y}`}
                    type="button"
                    title={`${x}, ${y}`}
                    onClick={() => toggle(x, y)}
                    className={`h-8 w-8 rounded-sm border text-[9px] transition-colors ${
                      active
                        ? "border-primary bg-primary/35 text-foreground"
                        : "border-border bg-muted/20 text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {active ? "·" : ""}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] text-muted-foreground">
            Tip: L/T/U/cross shapes create natural choke points, cover lanes and flanking routes.
          </p>
          <div className="flex shrink-0 gap-1">
            <Button size="sm" variant="outline" onClick={() => onOpenChange?.(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={!connected}>
              Save shape
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
