import { useEffect, useMemo, useState } from "react";
import { useTree } from "@/lib/treeStore";
import {
  DUNGEON_TRAP_TYPES,
  ROOM_SHAPES,
  cellsConnected,
  findStairs,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TOOLS = [
  ["floor", "Floor", "Paint or remove floor cells"],
  ["rect", "Rect fill", "Click a start corner, then an end corner"],
  ["fill", "Flood fill", "Flood the connected floor or empty region"],
  ["spawn", "Spawn", "Place a monster spawn point"],
  ["ingress", "Ingress", "Place a player entry point"],
  ["heightUp", "Raise +1", "Raise this cell by one space"],
  ["heightDown", "Lower −1", "Lower this cell by one space"],
  ["half", "Half cover", "Place half cover on this cell"],
  ["threeQuarter", "¾ cover", "Place three-quarters cover on this cell"],
  ["full", "Full cover", "Place full cover on this cell"],
  ["trap", "Trap", "Place the selected trap type"],
  ["hazard", "Hazard", "Mark terrain as a hazard with a description"],
  ["water", "Water", "Mark a water cell (swimming / difficult)"],
  ["lava", "Lava", "Mark a lava cell (hazardous floor)"],
  ["bridge", "Bridge", "Mark a bridge crossing over liquid"],
  ["difficult", "Difficult", "Mark difficult terrain"],
  ["stairs", "Stairs", "Place stairs on an elevation edge"],
  ["erase", "Erase", "Remove markers, surfaces, then floor"],
];

const FLOOR_TYPES = [
  ["stone", "Stone", "#6b7280"],
  ["wood", "Wood", "#8b5e3c"],
  ["dirt", "Dirt", "#7c5a3a"],
  ["grass", "Grass", "#4d7c0f"],
  ["sand", "Sand", "#c2a35a"],
  ["marble", "Marble", "#d1d5db"],
  ["ice", "Ice", "#7dd3fc"],
  ["metal", "Metal", "#64748b"],
  ["lava", "Lava", "#dc2626"],
];

const floorColor = (id) =>
  FLOOR_TYPES.find(([key]) => key === id)?.[2] || "#6b7280";

const keyOf = (x, y) => `${x},${y}`;const pointKey = (p) => keyOf(Number(p?.x), Number(p?.y));
const pointList = (arr) => {
  if (!Array.isArray(arr) || !arr.length) return [];
  return arr
    .map((p) =>
      Array.isArray(p)
        ? {
            x: Number(p[0]),
            y: Number(p[1]),
            value: p[2],
            cover: p[3] ?? p[2],
            type: p[3] ?? p[2],
          }
        : { ...p, x: Number(p?.x), y: Number(p?.y) }
    )
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
};

const coverLabel = (cover) =>
  /full/i.test(String(cover || ""))
    ? "F"
    : /three|3\/4|3_4/i.test(String(cover || ""))
      ? "¾"
      : "½";

const brushKeys = (x, y, size, w, h) => {
  const radius = Math.floor((Math.max(1, Number(size) || 1) - 1) / 2);
  const out = [];
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) out.push(keyOf(nx, ny));
    }
  }
  return out;
};

const mirrorOf = (key, w) => {
  const [x, y] = key.split(",").map(Number);
  return keyOf(w - 1 - x, y);
};

// Grid-based room builder: paint floor cells, place monster spawn points, player
// ingress zones and battlefield surfaces (height, cover, traps, water, difficult
// terrain and stairs), import a Reference Library template, upload the result
// back to the library, or apply it to the selected dungeon room. Rendered
// inline on the Dungeon Builder page, and still usable as a Dialog.
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
  onResize,
}) {
  const { settings } = useTree();
  const w = Math.max(3, Math.min(33, Math.round(Number(room?.w) || 9)));
  const h = Math.max(3, Math.min(33, Math.round(Number(room?.h) || 9)));
  const [preset, setPreset] = useState("Rectangle");
  const [tool, setTool] = useState("floor");
  const [cells, setCells] = useState(() => new Set());
  const [spawns, setSpawns] = useState(() => new Map());
  const [ingress, setIngress] = useState(() => new Map());
  const [heights, setHeights] = useState(() => new Map());
  const [covers, setCovers] = useState(() => new Map());
  const [trapMaps, setTrapMaps] = useState(() => new Map());
  const [hazards, setHazards] = useState(() => new Map());
  const [water, setWater] = useState(() => new Set());
  const [lava, setLava] = useState(() => new Set());
  const [bridges, setBridges] = useState(() => new Set());
  const [difficult, setDifficult] = useState(() => new Set());
  const [stairs, setStairs] = useState(() => new Set());
  const [trapType, setTrapType] = useState(DUNGEON_TRAP_TYPES[0]);
  const [hazardType, setHazardType] = useState("Unstable ground");
  const [bridgeType, setBridgeType] = useState("Bridge");
  const [floorType, setFloorType] = useState(room?.floorType || "stone");
  const [floorTexture, setFloorTexture] = useState(room?.floorTextureUrl || "");
  const [brush, setBrush] = useState(1);
  const [mirror, setMirror] = useState(false);
  const [rectStart, setRectStart] = useState(null);
  const [terrainClip, setTerrainClip] = useState(null);

  useEffect(() => {
    if (!room) return;
    const initial = roomShapeCells({ ...room, w, h });
    const active = new Set(initial.map(([x, y]) => keyOf(x, y)));
    const keep = (key) => active.has(key);
    setCells(active);
    setSpawns(
      new Map(
        (room.spawnPoints || [])
          .map((p) => [pointKey(p), p.label || ""])
          .filter(([key]) => keep(key))
      )
    );
    setIngress(
      new Map(
        (room.ingressPoints || [])
          .map((p) => [pointKey(p), p.label || ""])
          .filter(([key]) => keep(key))
      )
    );
    setHeights(
      new Map(
        pointList(room.heights)
          .map((p) => [pointKey(p), Number(p.height ?? p.h ?? p.value ?? 0)])
          .filter(([key, value]) => keep(key) && value)
      )
    );
    setCovers(
      new Map(
        pointList(room.coverPoints)
          .map((p) => [pointKey(p), String(p.cover || "half")])
          .filter(([key]) => keep(key))
      )
    );
    setTrapMaps(
      new Map(
        pointList(room.trapPoints)
          .map((p) => [pointKey(p), String(p.type || "Trap")])
          .filter(([key]) => keep(key))
      )
    );
    setWater(new Set(pointList(room.water).map(pointKey).filter(keep)));
    setLava(new Set(pointList(room.lava).map(pointKey).filter(keep)));
    setBridges(new Set(pointList(room.bridges).map(pointKey).filter(keep)));
    setHazards(
      new Map(
        pointList(room.hazardPoints)
          .map((p) => [pointKey(p), String(p.type || p.hazard || "Hazard")])
          .filter(([key]) => keep(key))
      )
    );
    setDifficult(new Set(pointList(room.difficult).map(pointKey).filter(keep)));
    setStairs(new Set(pointList(room.stairs).map(pointKey).filter(keep)));
    setFloorType(room.floorType || "stone");
    setFloorTexture(room.floorTextureUrl || "");
    setTool("floor");
    setPreset(room.shape || "Custom");
  }, [room, w, h]);

  const list = useMemo(
    () => [...cells].map((key) => key.split(",").map(Number)),
    [cells]
  );
  const connected = list.length > 0 && cellsConnected(list);

  const hasAnnotation = (key, state) =>
    state.spawns.has(key) ||
    state.ingress.has(key) ||
    state.heights.has(key) ||
    state.covers.has(key) ||
    state.trapMaps.has(key) ||
    state.hazards.has(key) ||
    state.water.has(key) ||
    state.lava.has(key) ||
    state.bridges.has(key) ||
    state.difficult.has(key) ||
    state.stairs.has(key);

  const clearAnnotations = (key, state) => {
    state.spawns.delete(key);
    state.ingress.delete(key);
    state.heights.delete(key);
    state.covers.delete(key);
    state.trapMaps.delete(key);
    state.hazards.delete(key);
    state.water.delete(key);
    state.lava.delete(key);
    state.bridges.delete(key);
    state.difficult.delete(key);
    state.stairs.delete(key);
  };

  const applyOne = (key, state) => {
    const active = state.cells.has(key);
    if (tool !== "floor" && tool !== "erase" && !active) state.cells.add(key);

    if (tool === "erase") {
      if (hasAnnotation(key, state)) {
        clearAnnotations(key, state);
        return;
      }
      if (active) {
        state.cells.delete(key);
        clearAnnotations(key, state);
      }
      return;
    }

    if (tool === "spawn") {
      state.ingress.delete(key);
      if (state.spawns.has(key)) state.spawns.delete(key);
      else state.spawns.set(key, `Spawn ${state.spawns.size + 1}`);
      return;
    }

    if (tool === "ingress") {
      state.spawns.delete(key);
      if (state.ingress.has(key)) state.ingress.delete(key);
      else state.ingress.set(key, "Ingress");
      return;
    }

    if (tool === "heightUp" || tool === "heightDown") {
      const current = Number(state.heights.get(key) || 0);
      const next = tool === "heightUp" ? Math.min(4, current + 1) : Math.max(-4, current - 1);
      if (next) state.heights.set(key, next);
      else state.heights.delete(key);
      return;
    }

    if (tool === "half" || tool === "threeQuarter" || tool === "full") {
      const value =
        tool === "half" ? "half" : tool === "threeQuarter" ? "three-quarters" : "full";
      if (state.covers.get(key) === value) state.covers.delete(key);
      else state.covers.set(key, value);
      return;
    }

    if (tool === "trap") {
      if (state.trapMaps.get(key) === trapType) state.trapMaps.delete(key);
      else state.trapMaps.set(key, trapType);
      return;
    }

    if (tool === "hazard") {
      if (state.hazards.get(key) === hazardType) state.hazards.delete(key);
      else state.hazards.set(key, hazardType);
      return;
    }

    if (tool === "water") {
      if (state.water.has(key)) state.water.delete(key);
      else {
        state.water.add(key);
        state.lava.delete(key);
      }
      return;
    }

    if (tool === "lava") {
      if (state.lava.has(key)) state.lava.delete(key);
      else {
        state.lava.add(key);
        state.water.delete(key);
      }
      return;
    }

    if (tool === "bridge") {
      if (state.bridges.has(key)) state.bridges.delete(key);
      else state.bridges.add(key);
      return;
    }

    if (tool === "difficult") {
      if (state.difficult.has(key)) state.difficult.delete(key);
      else state.difficult.add(key);
      return;
    }

    if (tool === "stairs") {
      if (state.stairs.has(key)) state.stairs.delete(key);
      else state.stairs.add(key);
      return;
    }

    if (active) {
      state.cells.delete(key);
      clearAnnotations(key, state);
    } else {
      state.cells.add(key);
    }
  };

  const applyCellClick = (x, y) => {
    const state = {
      cells: new Set(cells),
      spawns: new Map(spawns),
      ingress: new Map(ingress),
      heights: new Map(heights),
      covers: new Map(covers),
      trapMaps: new Map(trapMaps),
      hazards: new Map(hazards),
      water: new Set(water),
      lava: new Set(lava),
      bridges: new Set(bridges),
      difficult: new Set(difficult),
      stairs: new Set(stairs),
    };

    if (tool === "rect") {
      if (!rectStart) {
        setRectStart([x, y]);
        return;
      }
      const [sx, sy] = rectStart;
      for (let yy = Math.min(sy, y); yy <= Math.max(sy, y); yy += 1) {
        for (let xx = Math.min(sx, x); xx <= Math.max(sx, x); xx += 1) {
          state.cells.add(keyOf(xx, yy));
        }
      }
      setCells(state.cells);
      setRectStart(null);
      setPreset("Custom");
      return;
    }

    if (tool === "fill") {
      const active = state.cells.has(keyOf(x, y));
      const seen = new Set();
      const queue = [[x, y]];
      while (queue.length && seen.size < 2000) {
        const [cx, cy] = queue.pop();
        const key = keyOf(cx, cy);
        if (seen.has(key) || cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
        if (state.cells.has(key) !== active) continue;
        seen.add(key);
        if (active) {
          state.cells.delete(key);
          clearAnnotations(key, state);
        } else {
          state.cells.add(key);
        }
        queue.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
    } else {
      const keys = new Set(brushKeys(x, y, ["spawn", "ingress"].includes(tool) ? 1 : brush, w, h));
      if (mirror) [...keys].forEach((key) => keys.add(mirrorOf(key, w)));
      keys.forEach((key) => applyOne(key, state));
    }

    setCells(state.cells);
    setSpawns(state.spawns);
    setIngress(state.ingress);
    setHeights(state.heights);
    setCovers(state.covers);
    setTrapMaps(state.trapMaps);
    setHazards(state.hazards);
    setWater(state.water);
    setLava(state.lava);
    setBridges(state.bridges);
    setDifficult(state.difficult);
    setStairs(state.stairs);
    setPreset("Custom");
  };

  const filterTo = (next) => ({
    spawns: new Map([...spawns].filter(([key]) => next.has(key))),
    ingress: new Map([...ingress].filter(([key]) => next.has(key))),
    heights: new Map([...heights].filter(([key]) => next.has(key))),
    covers: new Map([...covers].filter(([key]) => next.has(key))),
    trapMaps: new Map([...trapMaps].filter(([key]) => next.has(key))),
    hazards: new Map([...hazards].filter(([key]) => next.has(key))),
    water: new Set([...water].filter((key) => next.has(key))),
    lava: new Set([...lava].filter((key) => next.has(key))),
    bridges: new Set([...bridges].filter((key) => next.has(key))),
    difficult: new Set([...difficult].filter((key) => next.has(key))),
    stairs: new Set([...stairs].filter((key) => next.has(key))),
  });

  const applyPreset = (name) => {
    setPreset(name);
    const next = new Set(shapeCells(w, h, name).map(([x, y]) => keyOf(x, y)));
    const filtered = filterTo(next);
    setCells(next);
    setSpawns(filtered.spawns);
    setIngress(filtered.ingress);
    setHeights(filtered.heights);
    setCovers(filtered.covers);
    setTrapMaps(filtered.trapMaps);
    setHazards(filtered.hazards);
    setWater(filtered.water);
    setLava(filtered.lava);
    setBridges(filtered.bridges);
    setDifficult(filtered.difficult);
    setStairs(filtered.stairs);
  };

  const copyTerrain = () => {
    setTerrainClip({
      heights: new Map(heights),
      covers: new Map(covers),
      trapMaps: new Map(trapMaps),
      hazards: new Map(hazards),
      water: new Set(water),
      lava: new Set(lava),
      bridges: new Set(bridges),
      difficult: new Set(difficult),
      stairs: new Set(stairs),
    });
  };

  const pasteTerrain = () => {
    if (!terrainClip) return;
    const keep = (key) => cells.has(key);
    setHeights(new Map([...terrainClip.heights].filter(([key]) => keep(key))));
    setCovers(new Map([...terrainClip.covers].filter(([key]) => keep(key))));
    setTrapMaps(new Map([...terrainClip.trapMaps].filter(([key]) => keep(key))));
    setHazards(new Map([...terrainClip.hazards].filter(([key]) => keep(key))));
    setWater(new Set([...terrainClip.water].filter(keep)));
    setLava(new Set([...terrainClip.lava].filter(keep)));
    setBridges(new Set([...terrainClip.bridges].filter(keep)));
    setDifficult(new Set([...terrainClip.difficult].filter(keep)));
    setStairs(new Set([...terrainClip.stairs].filter(keep)));
    setPreset("Custom");
  };

  const payload = () => {
    const heightArr = [...heights].map(([key, value]) => {
      const [x, y] = key.split(",").map(Number);
      return [x, y, value];
    });
    const stairList = [...stairs].map((key) => {
      const [x, y] = key.split(",").map(Number);
      return { x, y };
    });
    // Elevation edges get stairs automatically; a manually placed stair always
    // wins on the cell the DM painted.
    const autoStairs = stairList.length ? stairList : findStairs(list, heightArr);
    return {
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
      heights: heightArr,
      stairs: autoStairs.map((p) => ({ x: p.x, y: p.y })),
      coverPoints: [...covers].map(([key, cover]) => {
        const [x, y] = key.split(",").map(Number);
        return { x, y, cover };
      }),
      trapPoints: [...trapMaps].map(([key, type]) => {
        const [x, y] = key.split(",").map(Number);
        return { x, y, type };
      }),
      hazardPoints: [...hazards].map(([key, type]) => {
        const [x, y] = key.split(",").map(Number);
        return { x, y, type };
      }),
      water: [...water].map((key) => key.split(",").map(Number)),
      lava: [...lava].map((key) => key.split(",").map(Number)),
      bridges: [...bridges].map((key) => key.split(",").map(Number)),
      difficult: [...difficult].map((key) => key.split(",").map(Number)),
      floorType,
      floorTextureUrl: floorTexture,
      environmentEffect: room?.environmentEffect || "",
      tags: [...(room?.tags || [])],
    };
  };

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
            Paint the floor and battlefield: height, cover, traps, hazards, water, lava, bridges and
            stairs. Add a floor type or texture to the whole room. Grid: {w} × {h}. Enemies stay
            abstract — this is terrain, not a monster list.
          </p>
        </div>
      ) : (
        <DialogHeader>
          <DialogTitle>Room builder — {room?.name || "Room"}</DialogTitle>
          <DialogDescription>
            Paint the floor cells, then place monster spawns, player ingress and battlefield
            surfaces. The shape must stay connected. Grid: {w} × {h}.
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
        {onResize && (
          <span className="flex items-center gap-1">
            <Label className="text-[10px] text-muted-foreground">W</Label>
            <Input
              className="h-7 w-14 text-xs"
              type="number"
              min={3}
              max={33}
              value={w}
              onChange={(e) =>
                onResize({
                  w: Math.max(3, Math.min(33, Number(e.target.value) || 3)),
                  h,
                })
              }
            />
            <Label className="text-[10px] text-muted-foreground">H</Label>
            <Input
              className="h-7 w-14 text-xs"
              type="number"
              min={3}
              max={33}
              value={h}
              onChange={(e) =>
                onResize({
                  w,
                  h: Math.max(3, Math.min(33, Number(e.target.value) || 3)),
                })
              }
            />
          </span>
        )}
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
              setHeights(new Map());
              setCovers(new Map());
              setTrapMaps(new Map());
              setHazards(new Map());
              setWater(new Set());
              setLava(new Set());
              setBridges(new Set());
              setDifficult(new Set());
              setStairs(new Set());
              setRectStart(null);
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-[10px] text-muted-foreground">Floor type</Label>
        <Select value={floorType} onValueChange={setFloorType}>
          <SelectTrigger className="h-7 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FLOOR_TYPES.map(([id, label]) => (
              <SelectItem key={id} value={id}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label className="text-[10px] text-muted-foreground">Texture</Label>
        <Input
          className="h-7 w-64 text-xs"
          value={floorTexture}
          list="room-floor-textures"
          placeholder="/images/... or a texture URL"
          onChange={(e) => setFloorTexture(e.target.value)}
        />
        <datalist id="room-floor-textures">
          {[...new Set((settings?.library?.dungeonRooms || [])
            .map((r) => r.floorTextureUrl)
            .filter(Boolean))].map((url) => (
            <option key={url} value={url} />
          ))}
        </datalist>
        {floorTexture && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setFloorTexture("")}>
            Clear texture
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {TOOLS.map(([id, label, title]) => (
          <Button
            key={id}
            size="sm"
            variant={tool === id ? "default" : "outline"}
            className="h-7 text-xs"
            title={title}
            onClick={() => {
              setTool(id);
              if (id !== "rect") setRectStart(null);
            }}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-[10px] text-muted-foreground">Brush</Label>
        <Select value={String(brush)} onValueChange={(v) => setBrush(Number(v) || 1)}>
          <SelectTrigger className="h-7 w-16 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 3, 5, 7].map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}×{size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant={mirror ? "default" : "outline"}
          className="h-7 text-xs"
          onClick={() => setMirror((v) => !v)}
          title="Mirror every edit across the vertical centre line"
        >
          Mirror X
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={copyTerrain}>
          Copy terrain
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={pasteTerrain}
          disabled={!terrainClip}
        >
          Paste terrain
        </Button>
        {rectStart && (
          <span className="text-[10px] text-muted-foreground">
            Rect start {rectStart[0]},{rectStart[1]} — click the opposite corner
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tool === "hazard" && (
          <>
            <Label className="text-[10px] text-muted-foreground">Hazard</Label>
            <Input
              className="h-7 w-64 text-xs"
              value={hazardType}
              placeholder="What is the hazard?"
              onChange={(e) => setHazardType(e.target.value)}
            />
          </>
        )}
        {tool === "bridge" && (
          <>
            <Label className="text-[10px] text-muted-foreground">Bridge</Label>
            <Input
              className="h-7 w-44 text-xs"
              value={bridgeType}
              onChange={(e) => setBridgeType(e.target.value)}
            />
          </>
        )}
        {tool === "trap" && (
          <>
            <Label className="text-[10px] text-muted-foreground">Trap type</Label>
            <Select value={trapType} onValueChange={setTrapType}>
              <SelectTrigger className="h-7 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DUNGEON_TRAP_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
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
          {spawns.size} spawn{spawns.size === 1 ? "" : "s"} · {ingress.size} ingress ·{" "}
          {heights.size} height · {covers.size} cover · {trapMaps.size} trap · {hazards.size} hazard ·{" "}
          {water.size} water · {lava.size} lava · {bridges.size} bridge ·{" "}
          {difficult.size} difficult · {stairs.size} stair
        </span>
      </div>

      <div className="overflow-auto rounded-md border p-2">
        <div
          className="mx-auto grid w-max select-none gap-0.5"
          style={{ gridTemplateColumns: `repeat(${w}, 2rem)` }}
          onMouseDown={(event) => event.preventDefault()}
        >
          {Array.from({ length: h }, (_, y) =>
            Array.from({ length: w }, (_, x) => {
              const key = keyOf(x, y);
              const active = cells.has(key);
              const isSpawn = spawns.has(key);
              const isIngress = ingress.has(key);
              const height = heights.get(key) || 0;
              const cover = covers.get(key);
              const trap = trapMaps.get(key);
              const hazard = hazards.get(key);
              const isWater = water.has(key);
              const isLava = lava.has(key);
              const isBridge = bridges.has(key);
              const isDifficult = difficult.has(key);
              const isStairs = stairs.has(key);
              const badges = [
                trap ? "T" : "",
                hazard ? "!" : "",
                isWater ? "≈" : "",
                isLava ? "L" : "",
                isBridge ? "B" : "",
                isDifficult ? "▨" : "",
                isStairs ? "↕" : "",
                cover ? coverLabel(cover) : "",
                height ? `${height > 0 ? "+" : ""}${height}` : "",
              ].filter(Boolean);
              const center = isSpawn
                ? "S"
                : isIngress
                  ? "IN"
                  : isBridge
                    ? "B"
                    : isLava
                      ? "L"
                      : isWater
                        ? "≈"
                        : hazard
                          ? "!"
                          : isDifficult
                            ? "▨"
                            : active
                              ? "·"
                              : "";
              return (
                <button
                  key={key}
                  type="button"
                  title={`${x}, ${y}${
                    isSpawn ? " · monster spawn" : ""
                  }${isIngress ? " · player ingress" : ""}${
                    height ? ` · height ${height}` : ""
                  }${cover ? ` · ${cover} cover` : ""}${trap ? ` · trap: ${trap}` : ""}${
                    hazard ? ` · hazard: ${hazard}` : ""
                  }${isWater ? " · water" : ""}${isLava ? " · lava" : ""}${
                    isBridge ? ` · ${bridgeType || "bridge"}` : ""
                  }${isDifficult ? " · difficult terrain" : ""}${
                    isStairs ? " · stairs" : ""
                  }`}
                  onClick={() => applyCellClick(x, y)}
                  onMouseDown={(event) => event.preventDefault()}
                  style={
                    active
                      ? {
                          backgroundColor: floorColor(floorType),
                          backgroundImage: floorTexture ? `url("${floorTexture}")` : undefined,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                  className={`relative h-8 w-8 cursor-pointer select-none overflow-hidden rounded-sm border text-[10px] font-semibold transition-colors ${
                    isSpawn
                      ? "border-red-500 bg-red-500/30 text-red-700 dark:text-red-300"
                      : isIngress
                        ? "border-emerald-500 bg-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                        : isLava
                          ? "border-orange-600 bg-orange-500/40 text-orange-800 dark:text-orange-200"
                          : isWater
                            ? "border-sky-500 bg-sky-500/30 text-sky-700 dark:text-sky-300"
                            : hazard
                              ? "border-rose-600 bg-rose-500/30 text-rose-800 dark:text-rose-200"
                              : isDifficult
                                ? "border-amber-600 bg-amber-500/25 text-amber-800 dark:text-amber-300"
                                : active
                                  ? "border-primary text-foreground"
                                  : "border-border bg-muted/20 text-muted-foreground hover:bg-accent"
                  } ${isBridge ? "ring-1 ring-inset ring-amber-200/80" : ""}`}
                >
                  {center}
                  {badges.length > 0 && (
                    <span className="pointer-events-none absolute right-0.5 top-0 flex max-w-full flex-wrap justify-end gap-0.5 text-[7px] leading-none opacity-90">
                      {badges.join(" ")}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" /> spawn</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" /> ingress</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-500" /> water</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-orange-500" /> lava</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-200" /> bridge</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" /> hazard</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" /> difficult</span>
          <span>T trap · ! hazard · L lava · B bridge · ↕ stairs · ½/¾/F cover · +1/−1 elevation</span>
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
