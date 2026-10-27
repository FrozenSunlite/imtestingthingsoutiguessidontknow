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

const TOOLS = [
  ["floor", "Floor"],
  ["spawn", "Monster spawn"],
  ["ingress", "Player ingress"],
  ["erase", "Erase"],
];

const keyOf = (x, y) => `${x},${y}`;

// Grid-based room builder: paint floor cells, place monster spawn points and
// player ingress zones, import a Reference Library template, upload the result
// back to the library, or apply it to the selected dungeon room. Rendered
// inline on the Dungeon Generator page, and still usable as a Dialog.
export function RoomShapeBuilder({
  open = true,
  onOpenChange,
  inline = false,
  room,
  onSave,
  onUpload,
  onAdd,
  templates = [],
  onLoadTemplate,
  templateId = "",
}) {
  const w = Math.max(2, Math.min(20, Math.round(Number(room?.w) || 2)));
  const h = Math.max(2, Math.min(20, Math.round(Number(room?.h) || 2)));
  const [preset, setPreset] = useState("Rectangle");
  const [tool, setTool] = useState("floor");
  const [cells, setCells] = useState(() => new Set());
  const [spawns, setSpawns] = useState(() => new Map());
  const [ingress, setIngress] = useState(() => new Map());

  useEffect(() => {
    if (!room) return;
    const initial = roomShapeCells({ ...room, w, h });
    const active = new Set(initial.map(([x, y]) => keyOf(x, y)));
    setCells(active);
    setSpawns(
      new Map(
        (room.spawnPoints || [])
          .map((p) => [keyOf(p.x, p.y), p.label || ""])
          .filter(([key]) => active.has(key))
      )
    );
    setIngress(
      new Map(
        (room.ingressPoints || [])
          .map((p) => [keyOf(p.x, p.y), p.label || ""])
          .filter(([key]) => active.has(key))
      )
    );
    setTool("floor");
    setPreset(room.shape || "Custom");
  }, [room, w, h]);

  const list = useMemo(
    () => [...cells].map((key) => key.split(",").map(Number)),
    [cells]
  );
  const connected = list.length > 0 && cellsConnected(list);

  const applyCellClick = (x, y) => {
    const key = keyOf(x, y);
    if (tool === "spawn") {
      const nextCells = new Set(cells).add(key);
      const nextSpawns = new Map(spawns);
      const nextIngress = new Map(ingress);
      nextIngress.delete(key);
      if (nextSpawns.has(key)) nextSpawns.delete(key);
      else nextSpawns.set(key, `Spawn ${nextSpawns.size + 1}`);
      setCells(nextCells);
      setSpawns(nextSpawns);
      setIngress(nextIngress);
      setPreset("Custom");
      return;
    }
    if (tool === "ingress") {
      const nextCells = new Set(cells).add(key);
      const nextSpawns = new Map(spawns);
      const nextIngress = new Map(ingress);
      nextSpawns.delete(key);
      if (nextIngress.has(key)) nextIngress.delete(key);
      else nextIngress.set(key, "Ingress");
      setCells(nextCells);
      setSpawns(nextSpawns);
      setIngress(nextIngress);
      setPreset("Custom");
      return;
    }
    if (tool === "erase") {
      const nextSpawns = new Map(spawns);
      const nextIngress = new Map(ingress);
      if (nextSpawns.has(key) || nextIngress.has(key)) {
        nextSpawns.delete(key);
        nextIngress.delete(key);
        setSpawns(nextSpawns);
        setIngress(nextIngress);
        return;
      }
      const next = new Set(cells);
      next.delete(key);
      setCells(next);
      setPreset("Custom");
      return;
    }
    const next = new Set(cells);
    if (next.has(key)) {
      next.delete(key);
      const nextSpawns = new Map(spawns);
      const nextIngress = new Map(ingress);
      nextSpawns.delete(key);
      nextIngress.delete(key);
      setSpawns(nextSpawns);
      setIngress(nextIngress);
    } else {
      next.add(key);
    }
    setCells(next);
    setPreset("Custom");
  };

  const applyPreset = (name) => {
    setPreset(name);
    const next = new Set(shapeCells(w, h, name).map(([x, y]) => keyOf(x, y)));
    setCells(next);
    setSpawns((prev) => new Map([...prev].filter(([key]) => next.has(key))));
    setIngress((prev) => new Map([...prev].filter(([key]) => next.has(key))));
  };

  const payload = () => ({
    cells: list,
    shape: preset === "Custom" ? "Custom" : preset,
    spawnPoints: [...spawns].map(([key, label]) => {
      const [x, y] = key.split(",").map(Number);
      return { x, y, label };
    }),
    ingressPoints: [...ingress].map(([key, label]) => {
      const [x, y] = key.split(",").map(Number);
      return { x, y, label };
    }),
  });

  const save = () => {
    if (!connected) return;
    onSave?.(payload());
    if (!inline) onOpenChange?.(false);
  };

  const content = (
    <>
      {inline ? (
        <div>
          <h3 className="text-sm font-semibold">Room Maker — {room?.name || "Room"}</h3>
          <p className="text-[10px] text-muted-foreground">
            Paint the floor, place spawns and ingress, then apply it to the selected room or
            upload it to the Reference Library. Grid: {w} × {h}.
          </p>
        </div>
      ) : (
        <DialogHeader>
          <DialogTitle>Room builder — {room?.name || "Room"}</DialogTitle>
          <DialogDescription>
            Paint the floor cells, then place monster spawn points and player ingress zones. The
            shape must stay connected. Grid: {w} × {h}.
          </DialogDescription>
        </DialogHeader>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {templates.length > 0 && onLoadTemplate && (
          <>
            <Label className="text-[10px] text-muted-foreground">From library</Label>
            <Select
              value={templateId}
              onValueChange={(id) => {
                const template = templates.find((t) => t.id === id);
                if (template) onLoadTemplate(template);
              }}
            >
              <SelectTrigger className="h-8 w-40">
                <SelectValue placeholder="Load a room…" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template, i) => (
                  <SelectItem key={template.id || `${template.name}-${i}`} value={template.id || `template-${i}`}>
                    {template.name || "Unnamed room"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        <Label className="text-[10px] text-muted-foreground">Preset</Label>
        <Select value={preset} onValueChange={applyPreset}>
          <SelectTrigger className="h-8 w-32">
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
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setCells(new Set());
              setSpawns(new Map());
              setIngress(new Map());
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {TOOLS.map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            variant={tool === id ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setTool(id)}
          >
            {label}
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => {
            setSpawns(new Map());
            setIngress(new Map());
          }}
        >
          Clear markers
        </Button>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {spawns.size} spawn{spawns.size === 1 ? "" : "s"} · {ingress.size} ingress
        </span>
      </div>

      <div className="overflow-auto rounded-md border p-2">
        <div
          className="mx-auto grid w-max gap-0.5"
          style={{ gridTemplateColumns: `repeat(${w}, 2rem)` }}
        >
          {Array.from({ length: h }, (_, y) =>
            Array.from({ length: w }, (_, x) => {
              const key = keyOf(x, y);
              const active = cells.has(key);
              const isSpawn = spawns.has(key);
              const isIngress = ingress.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  title={`${x}, ${y}${isSpawn ? " · monster spawn" : ""}${isIngress ? " · player ingress" : ""}`}
                  onClick={() => applyCellClick(x, y)}
                  className={`h-8 w-8 rounded-sm border text-[10px] font-semibold transition-colors ${
                    isSpawn
                      ? "border-red-500 bg-red-500/30 text-red-700 dark:text-red-300"
                      : isIngress
                        ? "border-emerald-500 bg-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                        : active
                          ? "border-primary bg-primary/35 text-foreground"
                          : "border-border bg-muted/20 text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {isSpawn ? "S" : isIngress ? "IN" : active ? "·" : ""}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" /> monster spawn</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" /> player ingress</span>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          <Button size="sm" variant="outline" onClick={() => onOpenChange?.(false)}>
            Close
          </Button>
          {onUpload && (
            <Button size="sm" variant="outline" onClick={() => onUpload(payload())} disabled={!connected}>
              Upload to Library
            </Button>
          )}
          {onAdd && (
            <Button size="sm" variant="outline" onClick={() => onAdd(payload())} disabled={!connected}>
              Add as new room
            </Button>
          )}
          <Button size="sm" onClick={save} disabled={!connected}>
            {inline ? "Apply to selected room" : "Save room"}
          </Button>
        </div>
      </div>
    </>
  );

  if (inline) return <div className="space-y-2">{content}</div>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">{content}</DialogContent>
    </Dialog>
  );
}
