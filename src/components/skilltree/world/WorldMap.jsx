import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { BIOMES } from "@/lib/worldGen";
import { fetchAssetsSmart, importAsset } from "@/lib/worldAssets";
import { WORLD_DEVELOPMENTS } from "@/lib/worldDevelopments";
import {
  addRouteOnMap,
  addSettlementOnMap,
  deleteSettlement,
  foundPlayerKingdom,
  generateSettlementsOnMap,
  moveSettlement,
  paintTerrain,
  paintTerritory,
  placeDevelopmentOnMap,
  regenerateRealmTerrain,
  removeDevelopmentOnMap,
  removeRouteOnMap,
} from "@/lib/worldEditor";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Image as ImageIcon,
  Pencil,
  Paintbrush,
  Flag,
  MapPinPlus,
  Move,
  Route,
  Diamond,
  Trash2,
  MousePointerClick,
  Wand2,
  Crown,
  Eye,
  EyeOff,
} from "lucide-react";

const biomeColor = (id) => BIOMES.find((b) => b.id === id)?.color || "#3b3b45";
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const MAP_TOOLS = [
  { id: "select", label: "Select / pan", icon: MousePointerClick },
  { id: "terrain", label: "Paint terrain", icon: Paintbrush },
  { id: "territory", label: "Paint territory", icon: Flag },
  { id: "settlement", label: "Place settlement", icon: MapPinPlus },
  { id: "move", label: "Move settlement", icon: Move },
  { id: "road", label: "Draw road", icon: Route },
  { id: "development", label: "Place development", icon: Diamond },
  { id: "found", label: "Found kingdom", icon: Crown },
  { id: "delete", label: "Delete", icon: Trash2 },
];

const distanceToSegment = (point, from, to) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = clamp(((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSq, 0, 1);
  const px = from.x + t * dx;
  const py = from.y + t * dy;
  return Math.hypot(point.x - px, point.y - py);
};

export function WorldMap({
  world,
  selectedId,
  onSelect,
  onOpenSettlement,
  onTextures,
  onEditTextures,
  onChange,
}) {
  const [realmIndex, setRealmIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState(null);
  const dragMovedRef = useRef(false);
  const svgRef = useRef(null);
  const paintStrokeRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [tool, setTool] = useState("select");
  const [brush, setBrush] = useState(1);
  const [paintBiome, setPaintBiome] = useState("");
  const [paintNation, setPaintNation] = useState("");
  const [newKind, setNewKind] = useState("village");
  const [newName, setNewName] = useState("");
  const [newNationId, setNewNationId] = useState("");
  const [routeType, setRouteType] = useState("Road");
  const [routeFrom, setRouteFrom] = useState("");
  const [movingId, setMovingId] = useState("");
  const [devType, setDevType] = useState("lookout_tower");
  const [kingdomName, setKingdomName] = useState("");
  const [rulerName, setRulerName] = useState("");
  const [terrainSeed, setTerrainSeed] = useState("");
  const [textures, setTextures] = useState(() => world?.mapTextures || {});
  const [useTextures, setUseTextures] = useState(
    () => Object.keys(world?.mapTextures || {}).length > 0
  );
  const [loadingTextures, setLoadingTextures] = useState(false);
  const realms = world?.realms || [];
  const realm = realms[Math.min(realmIndex, Math.max(0, realms.length - 1))] || null;
  const settlements = (world?.settlements || []).filter((s) => s.realmId === realm?.id);
  const routes = (world?.routes || []).filter((route) => {
    const from = settlements.find((s) => s.id === route.from);
    const to = settlements.find((s) => s.id === route.to);
    return from && to;
  });
  const nations = (world?.nations || []).filter((n) => n.realmId === realm?.id);
  const developments = (world?.developments || []).filter((development) =>
    nations.some((nation) => nation.id === development.nationId)
  );
  const selected = settlements.find((s) => s.id === selectedId) || null;

  useEffect(() => {
    setRealmIndex(0);
    setZoom(1);
  }, [world?.id]);

  useEffect(() => {
    const next = world?.mapTextures || {};
    setTextures(next);
    setUseTextures(Object.keys(next).length > 0);
  }, [world?.id, world?.mapTextures]);

  useEffect(() => {
    setPaintBiome((current) =>
      BIOMES.some((biome) => biome.id === current)
        ? current
        : realm?.biomeIds?.[0] || "grassland"
    );
    setPaintNation((current) =>
      nations.some((nation) => nation.id === current) ? current : nations[0]?.id || ""
    );
    setNewNationId((current) =>
      nations.some((nation) => nation.id === current) ? current : nations[0]?.id || ""
    );
    setRouteFrom("");
    setMovingId("");
    paintStrokeRef.current = null;
  }, [realmIndex, world?.id]);

  useEffect(() => {
    if (editing) return;
    setTool("select");
    setRouteFrom("");
    setMovingId("");
    paintStrokeRef.current = null;
  }, [editing]);

  const loadTextures = async () => {
    if (useTextures) {
      setUseTextures(false);
      return;
    }
    const next = { ...(world?.mapTextures || {}) };
    setLoadingTextures(true);
    for (const biome of BIOMES.filter((b) => realm?.biomeIds?.includes(b.id))) {
      if (next[biome.id]) continue;
      const result = await fetchAssetsSmart({
        q: `${biome.assets[0] || biome.label} texture`,
        category: "Texture",
        limit: 1,
      });
      const asset = result.items?.[0];
      if (!asset) continue;
      const stored = await importAsset(asset.path);
      if (stored) next[biome.id] = stored;
    }
    setTextures(next);
    setUseTextures(Object.keys(next).length > 0);
    setLoadingTextures(false);
    onTextures?.(next);
  };

  useEffect(() => {
    setPan({ x: 0, y: 0 });
    setDrag(null);
  }, [selected?.id, realmIndex, world?.id]);

  // Kingdom borders are a toggle, and the map can be very large (256×256 by
  // default), so terrain is grouped into one path per biome/nation instead of
  // one <rect> per cell.
  const showBorders = world?.showBorders !== false;
  const liveMap = realm?.map;
  const nationById = useMemo(
    () => new Map(nations.map((nation) => [nation.id, nation])),
    [nations]
  );
  const cellGroups = useMemo(() => {
    if (!liveMap?.cells?.length) return [];
    const w = 1000 / (liveMap.width || 1);
    const h = 1000 / (liveMap.height || 1);
    const groups = new Map();
    liveMap.cells.forEach((cell) => {
      const nation = cell.nationId ? nationById.get(cell.nationId) : null;
      const textured = !nation && useTextures && textures[cell.biome];
      const key = nation
        ? `nation:${nation.id}`
        : `biome:${cell.biome}:${textured ? "tex" : "flat"}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          fill: nation
            ? nation.color
            : textured
              ? `url(#tex-${cell.biome})`
              : biomeColor(cell.biome),
          d: "",
        };
        groups.set(key, group);
      }
      group.d += `M${cell.x * w} ${cell.y * h}h${w + 0.6}v${h + 0.6}h${-(w + 0.6)}Z`;
    });
    return [...groups.values()];
  }, [liveMap, nationById, useTextures, textures]);
  const borderGroups = useMemo(() => {
    if (!showBorders || !liveMap?.cells?.length) return [];
    const w = 1000 / (liveMap.width || 1);
    const h = 1000 / (liveMap.height || 1);
    const lookup = new Map(
      liveMap.cells.map((cell) => [`${cell.x},${cell.y}`, cell])
    );
    const groups = new Map();
    const add = (nationId, x1, y1, x2, y2) => {
      const nation = nationById.get(nationId);
      if (!nation) return;
      let group = groups.get(nationId);
      if (!group) {
        group = { id: nationId, color: nation.color, d: "" };
        groups.set(nationId, group);
      }
      group.d += `M${x1} ${y1}L${x2} ${y2}`;
    };
    liveMap.cells.forEach((cell) => {
      if (!cell.nationId) return;
      const { x, y, nationId } = cell;
      const left = lookup.get(`${x - 1},${y}`);
      if (!left || left.nationId !== nationId)
        add(nationId, x * w, y * h, x * w, (y + 1) * h);
      const right = lookup.get(`${x + 1},${y}`);
      if (!right || right.nationId !== nationId)
        add(nationId, (x + 1) * w, y * h, (x + 1) * w, (y + 1) * h);
      const top = lookup.get(`${x},${y - 1}`);
      if (!top || top.nationId !== nationId)
        add(nationId, x * w, y * h, (x + 1) * w, y * h);
      const bottom = lookup.get(`${x},${y + 1}`);
      if (!bottom || bottom.nationId !== nationId)
        add(nationId, x * w, (y + 1) * h, (x + 1) * w, (y + 1) * h);
    });
    return [...groups.values()];
  }, [liveMap, showBorders, nationById]);

  const size = 1000 / zoom;
  const centerX = (selected ? selected.x : 500) + pan.x;
  const centerY = (selected ? selected.y : 500) + pan.y;
  const view = {
    x: clamp(centerX - size / 2, 0, Math.max(0, 1000 - size)),
    y: clamp(centerY - size / 2, 0, Math.max(0, 1000 - size)),
    w: size,
    h: size,
  };

  // Wheel / trackpad zoom over the world map, anchored under the cursor.
  // Native listener so the page does not scroll while zooming the map.
  useEffect(() => {
    const node = svgRef.current;
    if (!node) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      const nextZoom = clamp(zoom * factor, 1, 8);
      if (nextZoom === zoom) return;
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const fx = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const fy = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      const oldSize = 1000 / zoom;
      const oldCenterX = (selected ? selected.x : 500) + pan.x;
      const oldCenterY = (selected ? selected.y : 500) + pan.y;
      const oldX = clamp(oldCenterX - oldSize / 2, 0, Math.max(0, 1000 - oldSize));
      const oldY = clamp(oldCenterY - oldSize / 2, 0, Math.max(0, 1000 - oldSize));
      const worldX = oldX + fx * oldSize;
      const worldY = oldY + fy * oldSize;
      const newSize = 1000 / nextZoom;
      const newX = clamp(worldX - fx * newSize, 0, Math.max(0, 1000 - newSize));
      const newY = clamp(worldY - fy * newSize, 0, Math.max(0, 1000 - newSize));
      setZoom(nextZoom);
      setPan({
        x: newX + newSize / 2 - (selected ? selected.x : 500),
        y: newY + newSize / 2 - (selected ? selected.y : 500),
      });
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [zoom, pan, selected]);

  const beginPan = (event) => {
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      /* pointer capture is optional */
    }
    dragMovedRef.current = false;
    setDrag({
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    });
  };

  const movePan = (event) => {
    if (!drag) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    if (
      Math.abs(event.clientX - drag.startX) > 3 ||
      Math.abs(event.clientY - drag.startY) > 3
    ) {
      dragMovedRef.current = true;
    }
    const dx = ((event.clientX - drag.startX) * size) / rect.width;
    const dy = ((event.clientY - drag.startY) * size) / rect.height;
    setPan({ x: drag.panX - dx, y: drag.panY - dy });
  };

  const endPan = (event) => {
    if (!drag) return;
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      /* pointer capture may already have been released */
    }
    if (!dragMovedRef.current) {
      const point = mapPoint(event);
      const hit = settlementAt(point);
      if (hit) onSelect?.(hit.id);
    }
    setDrag(null);
  };

  if (!realm) return <p className="text-xs text-muted-foreground">Generate a setting to see its map.</p>;


  const mapPoint = (event) => {
    const svg = svgRef.current;
    if (!svg) return { x: 500, y: 500 };
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 500, y: 500 };
    return {
      x: view.x + ((event.clientX - rect.left) / rect.width) * view.w,
      y: view.y + ((event.clientY - rect.top) / rect.height) * view.h,
    };
  };

  const settlementAt = (point) => {
    let best = null;
    let bestDistance = Infinity;
    settlements.forEach((settlement) => {
      const distance = Math.hypot(settlement.x - point.x, settlement.y - point.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = settlement;
      }
    });
    return bestDistance <= 14 ? best : null;
  };

  const developmentAt = (point) =>
    developments.find(
      (development) => Math.hypot(development.x - point.x, development.y - point.y) <= 10
    ) || null;

  const routeAt = (point) =>
    routes.find((route) => {
      const from = settlements.find((settlement) => settlement.id === route.from);
      const to = settlements.find((settlement) => settlement.id === route.to);
      if (!from || !to) return false;
      return distanceToSegment(point, from, to) <= 6;
    }) || null;

  const commit = (next, message = "") => {
    if (!next || next === world) return;
    onChange?.(next);
    if (message) toast.success(message);
  };

  const deleteAt = (point) => {
    const settlement = settlementAt(point);
    if (settlement) {
      if (!window.confirm(`Remove ${settlement.name} and its people from the world map?`)) return;
      const result = deleteSettlement(world, settlement.id);
      commit(result.world, `${settlement.name} removed.`);
      if (selectedId === settlement.id) onSelect?.("");
      return;
    }
    const development = developmentAt(point);
    if (development) {
      commit(removeDevelopmentOnMap(world, development.id), `${development.name} removed.`);
      return;
    }
    const route = routeAt(point);
    if (route) {
      commit(removeRouteOnMap(world, route.id), "Road removed.");
      return;
    }
    toast.error("Nothing to delete at that spot.");
  };

  const applyTool = (point) => {
    if (tool === "select") {
      const hit = settlementAt(point);
      if (hit) onSelect?.(hit.id);
      return;
    }
    if (tool === "settlement") {
      const nationId = newNationId || nations[0]?.id;
      if (!nationId) {
        toast.error("Add a nation before placing a settlement.");
        return;
      }
      const result = addSettlementOnMap(world, {
        realmId: selected?.realmId || realm.id,
        nationId,
        kind: newKind,
        x: point.x,
        y: point.y,
        name: newName.trim(),
      });
      if (result.error || !result.settlement) {
        toast.error(result.error || "Could not place that settlement.");
        return;
      }
      commit(result.world, `${result.settlement.name} founded.`);
      onSelect?.(result.settlement.id);
      setNewName("");
      return;
    }
    if (tool === "move") {
      if (movingId) {
        commit(moveSettlement(world, movingId, point.x, point.y), "Settlement moved.");
        setMovingId("");
        onSelect?.(movingId);
        return;
      }
      const hit = settlementAt(point);
      if (!hit) {
        toast.error("Click a settlement first.");
        return;
      }
      setMovingId(hit.id);
      onSelect?.(hit.id);
      toast.info(`Now click the new location for ${hit.name}.`);
      return;
    }
    if (tool === "road") {
      const hit = settlementAt(point);
      if (!hit) {
        toast.error("Click a settlement first.");
        return;
      }
      if (!routeFrom) {
        setRouteFrom(hit.id);
        onSelect?.(hit.id);
        toast.info(`Now click the second settlement for the ${routeType.toLowerCase()}.`);
        return;
      }
      const result = addRouteOnMap(world, routeFrom, hit.id, routeType);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      commit(result.world, "Route added.");
      setRouteFrom("");
      return;
    }
    if (tool === "development") {
      const nationId = newNationId || nations[0]?.id;
      const kingdom = (world.kingdoms || []).find((item) => item.nationId === nationId);
      if (!kingdom) {
        toast.error("Choose a nation with a kingdom first.");
        return;
      }
      const result = placeDevelopmentOnMap(world, {
        kingdomId: kingdom.id,
        developmentId: devType,
        x: point.x,
        y: point.y,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      commit(result.world, `${result.development.name} placed.`);
      return;
    }
    if (tool === "found") {
      const hit = settlementAt(point);
      if (!hit) {
        toast.error("Click the settlement that will become your capital.");
        return;
      }
      const result = foundPlayerKingdom(world, {
        settlementId: hit.id,
        name: kingdomName.trim(),
        rulerName: rulerName.trim(),
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      commit(result.world, `${result.kingdom.name} founded.`);
      onSelect?.(hit.id);
      setKingdomName("");
      return;
    }
    if (tool === "delete") {
      deleteAt(point);
    }
  };

  const paintTerrainAt = (event) => {
    const stroke = paintStrokeRef.current;
    if (!stroke || !realm.map?.cells?.length) return;
    const point = mapPoint(event);
    const cellX = clamp(
      Math.floor((point.x / 1000) * realm.map.width),
      0,
      realm.map.width - 1
    );
    const cellY = clamp(
      Math.floor((point.y / 1000) * realm.map.height),
      0,
      realm.map.height - 1
    );
    const key = `${cellX},${cellY}`;
    if (stroke.last === key) return;
    stroke.last = key;
    const next =
      stroke.mode === "terrain"
        ? paintTerrain(stroke.world, realm.id, cellX, cellY, brush, paintBiome)
        : paintTerritory(
            stroke.world,
            realm.id,
            cellX,
            cellY,
            brush,
            paintNation === "__none__" ? "" : paintNation
          );
    stroke.world = next;
    onChange?.(next);
  };

  const beginPaint = (event) => {
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      /* pointer capture is optional */
    }
    paintStrokeRef.current = { mode: tool, last: "", world };
    paintTerrainAt(event);
  };

  const handleMapPointerDown = (event) => {
    if (!editing) {
      if (event.button <= 2) beginPan(event);
      return;
    }
    if (event.button === 1 || event.button === 2) {
      event.preventDefault();
      beginPan(event);
      return;
    }
    if (event.button !== 0) return;
    if (tool === "select") {
      beginPan(event);
      return;
    }
    if (tool === "terrain" || tool === "territory") {
      beginPaint(event);
      return;
    }
    event.preventDefault();
    applyTool(mapPoint(event));
  };

  const handleMapPointerMove = (event) => {
    if (drag) {
      movePan(event);
      return;
    }
    if (paintStrokeRef.current) paintTerrainAt(event);
  };

  const handleMapPointerUp = (event) => {
    if (drag) endPan(event);
    if (paintStrokeRef.current) {
      try {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      } catch {
        /* capture may already be released */
      }
      paintStrokeRef.current = null;
    }
  };

  const regenerateTerrain = () => {
    const next = regenerateRealmTerrain(world, realm.id, {
      seed: terrainSeed,
      biomeIds: realm.biomeIds || [],
    });
    commit(next, "Terrain regenerated.");
  };

  const generateSettlement = () => {
    const nationId = newNationId || nations[0]?.id;
    if (!nationId) {
      toast.error("Add a nation before generating settlements.");
      return;
    }
    const result = generateSettlementsOnMap(world, {
      realmId: realm.id,
      nationId,
      count: 1,
      kind: newKind,
      seed: `editor:${Date.now()}`,
    });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    commit(result.world);
    const added = result.added?.[0];
    if (added) {
      onSelect?.(added.id);
      toast.success(`${added.name} generated.`);
    } else {
      toast.error("No free land was found for a settlement.");
    }
  };

  const editSettlement = selected;
  const selectedDevNation = nations.find((nation) => nation.id === newNationId) || nations[0];
  const selectedDevKingdom = (world.kingdoms || []).find(
    (kingdom) => kingdom.nationId === selectedDevNation?.id
  );
  const selectedDevelopment = WORLD_DEVELOPMENTS.find(
    (development) => development.id === devType
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {realms.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {realms.map((item, index) => (
              <Button
                key={item.id}
                size="sm"
                variant={index === realmIndex ? "secondary" : "ghost"}
                className="h-7 text-xs"
                onClick={() => {
                  setRealmIndex(index);
                  setZoom(1);
                }}
              >
                {item.name}
              </Button>
            ))}
          </div>
        )}
        <span className="text-[10px] text-muted-foreground">
          {realm.kind} · {realm.biomeLabels?.join(", ")}
          {liveMap ? ` · ${liveMap.width}×${liveMap.height}` : ""}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant={editing ? "secondary" : "outline"}
            className="h-7 text-xs"
            onClick={() => setEditing((value) => !value)}
          >
            <Pencil className="mr-1 h-3.5 w-3.5" /> {editing ? "Done editing" : "Edit map"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => {
              setEditing(true);
              setTool("settlement");
            }}
            title="Place a new village, town or city on the map"
          >
            <MapPinPlus className="mr-1 h-3.5 w-3.5" /> Add city
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onChange?.({ ...world, showBorders: !showBorders })}
            title="Toggle the outlines between kingdoms"
          >
            {showBorders ? (
              <EyeOff className="mr-1 h-3.5 w-3.5" />
            ) : (
              <Eye className="mr-1 h-3.5 w-3.5" />
            )}
            {showBorders ? "Hide borders" : "Show borders"}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={loadTextures} disabled={loadingTextures}>
            <ImageIcon className="mr-1 h-3.5 w-3.5" />
            {loadingTextures ? "Loading…" : useTextures ? "Hide textures" : "Library textures"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => onEditTextures?.()}
            title="Assign or replace the image used by each terrain on the Stickers page."
          >
            Edit textures
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setZoom((z) => Math.max(1, z / 1.3))} title="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setZoom((z) => Math.min(8, z * 1.3))} title="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            title="Fit and reset pan"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {editing && (
        <div className="space-y-1 rounded-md border bg-muted/20 p-2">
          <div className="flex flex-wrap gap-1">
            {MAP_TOOLS.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                size="sm"
                variant={tool === id ? "secondary" : "ghost"}
                className="h-7 text-[10px]"
                onClick={() => {
                  setTool(id);
                  paintStrokeRef.current = null;
                  setRouteFrom("");
                  setMovingId("");
                }}
                title={label}
              >
                <Icon className="mr-1 h-3.5 w-3.5" /> {label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-2 text-[10px]">
            {(tool === "terrain" || tool === "territory") && (
              <>
                {tool === "terrain" ? (
                  <div className="space-y-0.5">
                    <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Biome</p>
                    <Select value={paintBiome} onValueChange={setPaintBiome}>
                      <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BIOMES.map((biome) => (
                          <SelectItem key={biome.id} value={biome.id}>{biome.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Territory</p>
                    <Select value={paintNation || "__none__"} onValueChange={(value) => setPaintNation(value === "__none__" ? "" : value)}>
                      <SelectTrigger className="h-7 w-44 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Wilderness</SelectItem>
                        {nations.map((nation) => (
                          <SelectItem key={nation.id} value={nation.id}>{nation.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-0.5">
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Brush</p>
                  <Select value={String(brush)} onValueChange={(value) => setBrush(Number(value))}>
                    <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4].map((radius) => (
                        <SelectItem key={radius} value={String(radius)}>
                          {radius * 2 + 1}×{radius * 2 + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {(tool === "settlement" || tool === "development") && (
              <div className="space-y-0.5">
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Nation</p>
                <Select
                  value={newNationId || "__none__"}
                  onValueChange={(value) => setNewNationId(value === "__none__" ? "" : value)}
                >
                  <SelectTrigger className="h-7 w-44 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Choose nation</SelectItem>
                    {nations.map((nation) => (
                      <SelectItem key={nation.id} value={nation.id}>{nation.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {tool === "settlement" && (
              <>
                <div className="space-y-0.5">
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Kind</p>
                  <Select value={newKind} onValueChange={setNewKind}>
                    <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="village">Village</SelectItem>
                      <SelectItem value="town">Town</SelectItem>
                      <SelectItem value="city">City</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Name (optional)</p>
                  <Input
                    className="h-7 w-40 text-xs"
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="Generated if empty"
                  />
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={generateSettlement}>
                  <Wand2 className="mr-1 h-3 w-3" /> Generate instead
                </Button>
              </>
            )}

            {tool === "road" && (
              <div className="space-y-0.5">
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Route type</p>
                <Select value={routeType} onValueChange={setRouteType}>
                  <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Road", "Highway", "Trail", "River", "Sea route", "Mountain pass"].map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {tool === "development" && (
              <>
                <div className="space-y-0.5">
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Development</p>
                  <Select value={devType} onValueChange={setDevType}>
                    <SelectTrigger className="h-7 w-48 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WORLD_DEVELOPMENTS.map((development) => (
                        <SelectItem key={development.id} value={development.id}>
                          {development.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedDevelopment && (
                  <p className="max-w-md text-[9px] text-muted-foreground">
                    {selectedDevelopment.benefit}
                  </p>
                )}
              </>
            )}

            {tool === "found" && (
              <>
                <div className="space-y-0.5">
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Kingdom name</p>
                  <Input
                    className="h-7 w-44 text-xs"
                    value={kingdomName}
                    onChange={(event) => setKingdomName(event.target.value)}
                    placeholder="Your new realm"
                  />
                </div>
                <div className="space-y-0.5">
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Ruler name</p>
                  <Input
                    className="h-7 w-40 text-xs"
                    value={rulerName}
                    onChange={(event) => setRulerName(event.target.value)}
                    placeholder="Player Ruler"
                  />
                </div>
              </>
            )}

            <p className="ml-auto text-[9px] text-muted-foreground">
              {tool === "select" && "Click a settlement to select it; drag to pan."}
              {tool === "terrain" && "Drag to paint terrain cells."}
              {tool === "territory" && "Drag to paint national territory (map ownership; settlements keep their nation)."}
              {tool === "settlement" && "Click the map to place a blank player settlement."}
              {tool === "move" && (movingId ? `Click the new location for ${editSettlement?.name || "the settlement"}.` : "Click a settlement, then click its new location.")}
              {tool === "road" && (routeFrom ? "Click the second settlement." : "Click the first settlement.")}
              {tool === "development" && `Click the map to place ${selectedDevelopment?.name || "the development"}${selectedDevKingdom ? ` for ${selectedDevKingdom.name}` : ""}.`}
              {tool === "found" && "Click a settlement to make it your new player kingdom's capital."}
              {tool === "delete" && "Click a settlement, route, or development to delete it."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 border-t pt-1">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              Procedural
            </span>
            <Input
              className="h-7 w-36 text-xs"
              value={terrainSeed}
              onChange={(event) => setTerrainSeed(event.target.value)}
              placeholder="Terrain seed"
            />
            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={regenerateTerrain}>
              <Wand2 className="mr-1 h-3 w-3" /> Regenerate terrain
            </Button>
            <span className="text-[9px] text-muted-foreground">
              Middle/right-drag always pans. Editing is saved automatically.
            </span>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-md border bg-[#0f1117]">
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          className="block h-[62vh] w-full select-none"
          style={{
            cursor: drag
              ? "grabbing"
              : editing
                ? tool === "select"
                  ? "grab"
                  : tool === "terrain" || tool === "territory"
                    ? "crosshair"
                    : "pointer"
                : "grab",
            touchAction: "none",
          }}
          onPointerDown={handleMapPointerDown}
          onPointerMove={handleMapPointerMove}
          onPointerUp={handleMapPointerUp}
          onPointerCancel={() => {
            setDrag(null);
            paintStrokeRef.current = null;
          }}
          onContextMenu={(event) => event.preventDefault()}
          onClick={(event) => {
            if (editing) return;
            const hit = settlementAt(mapPoint(event));
            if (hit) onSelect?.(hit.id);
          }}
          onDoubleClick={(event) => {
            if (editing) {
              setPan({ x: 0, y: 0 });
              return;
            }
            const hit = settlementAt(mapPoint(event));
            if (hit) onOpenSettlement?.(hit.id);
            else setPan({ x: 0, y: 0 });
          }}
        >
          <defs>
            {Object.entries(textures).map(([id, href]) => (
              <pattern key={id} id={`tex-${id}`} width="70" height="70" patternUnits="userSpaceOnUse">
                <image href={href} width="70" height="70" preserveAspectRatio="xMidYMid slice" />
              </pattern>
            ))}
            <filter id="map-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <rect width="1000" height="1000" fill="#0b0d12" />
          {cellGroups.map((group) => (
            <path
              key={group.key}
              d={group.d}
              fill={group.fill}
              fillOpacity={0.72}
            />
          ))}
          {borderGroups.map((group) => (
            <path
              key={`border-${group.id}`}
              d={group.d}
              fill="none"
              stroke={group.color}
              strokeOpacity={0.85}
              strokeWidth={1.1}
              strokeLinecap="round"
            />
          ))}
          {routes.map((route) => {
            const from = settlements.find((s) => s.id === route.from);
            const to = settlements.find((s) => s.id === route.to);
            if (!from || !to) return null;
            return (
              <g key={route.id}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="#e5dcc5"
                  strokeOpacity={0.35}
                  strokeWidth={route.type === "Highway" ? 2.4 : 1.2}
                  strokeDasharray={route.type === "Trail" ? "3 3" : undefined}
                />
              </g>
            );
          })}
          {developments.map((development) => {
            const nation = nations.find((n) => n.id === development.nationId);
            const color = nation?.color || "#c9a85a";
            const size = development.status === "building" ? 4.2 : 5.4;
            return (
              <g key={development.id}>
                <polygon
                  points={`${development.x},${development.y - size} ${development.x + size},${development.y} ${development.x},${development.y + size} ${development.x - size},${development.y}`}
                  fill={development.status === "building" ? "#14161c" : color}
                  stroke={color}
                  strokeWidth="1.2"
                  strokeDasharray={development.status === "building" ? "2 2" : undefined}
                  opacity="0.95"
                >
                  <title>
                    {development.name} · {development.status === "building" ? `${development.monthsRemaining}/${development.months} months` : "built"}
                    {"\n"}
                    {development.benefit}
                  </title>
                </polygon>
                {zoom > 1.8 && (
                  <text
                    x={development.x + size + 2}
                    y={development.y + 3}
                    fontSize="7"
                    fill="#d8cfae"
                    stroke="#0b0d12"
                    strokeWidth="1.5"
                    paintOrder="stroke"
                  >
                    {development.name}
                  </text>
                )}
              </g>
            );
          })}
          {settlements.map((settlement) => {
            const nation = nations.find((n) => n.id === settlement.nationId);
            const size = settlement.kind === "capital" ? 7 : settlement.kind === "city" ? 5.5 : settlement.kind === "town" ? 4 : 3;
            const active = settlement.id === selectedId;
            return (
              <g
                key={settlement.id}
                onClick={() => {
                  if (!editing) onSelect?.(settlement.id);
                }}
                onDoubleClick={() => {
                  if (!editing) onOpenSettlement?.(settlement.id);
                }}
                style={{ cursor: editing ? "inherit" : "pointer" }}
              >
                <circle
                  cx={settlement.x}
                  cy={settlement.y}
                  r={size + (active ? 3 : 0)}
                  fill={nation?.color || "#e5dcc5"}
                  stroke={active ? "#fff5d6" : "#0b0d12"}
                  strokeWidth={active ? 2 : 1.2}
                  filter={active ? "url(#map-glow)" : undefined}
                />
                {(settlement.kind === "capital" || settlement.kind === "city" || active) && (
                  <text
                    x={settlement.x + size + 2}
                    y={settlement.y + 3}
                    fontSize={selected ? 10 : 8}
                    fill="#f4edd9"
                    stroke="#0b0d12"
                    strokeWidth="2"
                    paintOrder="stroke"
                  >
                    {settlement.name}
                  </text>
                )}
              </g>
            );
          })}
          {nations.map((nation) => {
            const capital = settlements.find((s) => s.id === nation.capitalId);
            if (!capital) return null;
            return (
              <text
                key={nation.id}
                x={capital.x}
                y={capital.y - 16}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill={nation.color}
                stroke="#0b0d12"
                strokeWidth="2.5"
                paintOrder="stroke"
              >
                {nation.name}
              </text>
            );
          })}
        </svg>
      </div>

      {selected && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-xs">
          <span className="font-semibold">{selected.name}</span>
          <span className="text-muted-foreground">
            {selected.typeLabel} · {selected.population.toLocaleString()} people · {selected.biomeLabel}
          </span>
          <span className="text-muted-foreground">
            {nations.find((n) => n.id === selected.nationId)?.name}
          </span>
          {editing && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => {
                  setTool("move");
                  setMovingId(selected.id);
                  toast.info(`Now click the new location for ${selected.name}.`);
                }}
              >
                <Move className="mr-1 h-3.5 w-3.5" /> Move
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs"
                onClick={() => {
                  if (!window.confirm(`Remove ${selected.name} and its people from the world map?`)) return;
                  const result = deleteSettlement(world, selected.id);
                  commit(result.world, `${selected.name} removed.`);
                  onSelect?.("");
                }}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={() => onOpenSettlement?.(selected.id)}>
            Open settlement
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-[9px] text-muted-foreground">
        {realm.biomeIds?.map((id) => (
          <span key={id} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: biomeColor(id) }} />
            {BIOMES.find((b) => b.id === id)?.label || id}
          </span>
        ))}
        <span>● capital</span>
        <span>● city/town/village</span>
        <span>— roads and routes</span>
        <span>◆ world development</span>
        <span>◇ under construction</span>
        <span>Wheel or buttons to zoom · drag to pan · double-click to recenter</span>
        {editing && <span>Editing · middle/right-drag to pan</span>}
      </div>
    </div>
  );
}
