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
import { FLOOR_TEXTURES, floorTexture } from "@/lib/worldAssets";
import { travelEstimate } from "@/lib/worldGen";
import { ensureCityLayout } from "@/lib/cityLayout";
import { INTERIOR_CELL, ensureInterior } from "@/lib/interiorGen";
import { roomStickerList, buildStickerLayout } from "@/lib/roomStickers";
import {
  ROOM_CATEGORIES,
  roomCategoryColor,
  roomFocusLabel,
} from "@/lib/facilityRooms";
import {
  MapPin,
  Users,
  Coins,
  Hammer,
  ArrowLeft,
  ImagePlus,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";

const CATEGORY_COLOR = {
  Residential: "#8b7355",
  Commercial: "#b08a3e",
  Industrial: "#7a6a5a",
  Civic: "#6a7f9c",
  Military: "#9c5a5a",
  Food: "#6f8f4a",
  Service: "#6f8f8a",
};

const MAP_TILE = 14;
const CITY_GRID_COLOR = "#2a2d34";
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function SettlementView({
  world,
  settlementId,
  focusBuildingId = "",
  onSelectSettlement,
  onFindAssets,
  onSetFloorTexture,
  onOpenKingdom,
  onBuildHere,
  onRegenerateLayout,
  onUpdateRoomStickers,
  onUseRoomTemplate,
  onRerollInterior,
  onUpdateBuilding,
}) {
  const [buildingId, setBuildingId] = useState("");
  const [floor, setFloor] = useState(1);
  const [stickerRoomId, setStickerRoomId] = useState("");
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [mapDrag, setMapDrag] = useState(null);
  const mapDraggedRef = useRef(false);
  const [interiorZoom, setInteriorZoom] = useState(1);
  const [interiorPan, setInteriorPan] = useState({ x: 0, y: 0 });
  const [interiorDrag, setInteriorDrag] = useState(null);
  const interiorDraggedRef = useRef(false);
  const settlements = world?.settlements || [];
  const settlement = settlements.find((s) => s.id === settlementId) || settlements[0] || null;
  const nation = world?.nations?.find((n) => n.id === settlement?.nationId);
  const kingdom = world?.kingdoms?.find((k) => k.nationId === settlement?.nationId);
  const building = settlement?.buildings?.find((b) => b.id === buildingId) || null;
  const localNpcs = (world?.npcs || []).filter((npc) => npc.settlementId === settlement?.id);

  const layout = useMemo(
    () => (settlement ? ensureCityLayout(settlement) : null),
    [settlement]
  );
  const buildingView = useMemo(
    () => (building ? ensureInterior(building, settlement) : null),
    [building, settlement]
  );
  const interior = buildingView?.interior || null;
  const floorData = useMemo(() => {
    if (!interior) return null;
    return interior.floors?.find((entry) => entry.floor === floor) || interior.floors?.[0] || null;
  }, [interior, floor]);
  const rooms = floorData?.rooms || [];

  // Keep the floor picker inside the selected building's range.
  useEffect(() => {
    if (!building) return;
    if (floor > (building.floors || 1)) setFloor(1);
  }, [building?.id, building?.floors, floor]);

  useEffect(() => {
    setMapZoom(1);
    setMapPan({ x: 0, y: 0 });
    setMapDrag(null);
    mapDraggedRef.current = false;
  }, [settlement?.id]);

  useEffect(() => {
    if (!focusBuildingId) return;
    setBuildingId(focusBuildingId);
    setFloor(1);
    setTimeout(() => {
      document
        .getElementById("building-interior")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }, [focusBuildingId]);

  // Each building/floor starts fitted; zooming then pans within the interior.
  useEffect(() => {
    setInteriorZoom(1);
    setInteriorPan({ x: 0, y: 0 });
    setInteriorDrag(null);
    interiorDraggedRef.current = false;
  }, [building?.id, floor]);

  // Mouse-wheel / trackpad zoom, anchored under the cursor. Native listeners
  // are used because React's onWheel is passive and cannot prevent page scroll.
  useEffect(() => {
    const node = document.getElementById("city-map-svg");
    if (!node) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      const width = (layout?.width || 32) * MAP_TILE;
      const height = (layout?.height || 32) * MAP_TILE;
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      const nextZoom = clamp(mapZoom * factor, 1, 6);
      if (nextZoom === mapZoom) return;
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const fx = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const fy = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      const oldW = width / mapZoom;
      const oldH = height / mapZoom;
      const oldX = clamp(width / 2 + mapPan.x - oldW / 2, 0, Math.max(0, width - oldW));
      const oldY = clamp(height / 2 + mapPan.y - oldH / 2, 0, Math.max(0, height - oldH));
      const worldX = oldX + fx * oldW;
      const worldY = oldY + fy * oldH;
      const newW = width / nextZoom;
      const newH = height / nextZoom;
      const newX = clamp(worldX - fx * newW, 0, Math.max(0, width - newW));
      const newY = clamp(worldY - fy * newH, 0, Math.max(0, height - newH));
      setMapZoom(nextZoom);
      setMapPan({
        x: newX + newW / 2 - width / 2,
        y: newY + newH / 2 - height / 2,
      });
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [layout?.width, layout?.height, mapZoom, mapPan]);

  useEffect(() => {
    const node = document.getElementById("interior-grid-svg");
    if (!node) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      const width = (interior?.width || 8) * INTERIOR_CELL;
      const height = (interior?.height || 8) * INTERIOR_CELL;
      const pad = INTERIOR_CELL * 0.9;
      const baseX = -pad;
      const baseY = -pad;
      const baseW = width + pad * 2;
      const baseH = height + pad * 2;
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      const nextZoom = clamp(interiorZoom * factor, 1, 6);
      if (nextZoom === interiorZoom) return;
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const fx = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const fy = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      const oldW = baseW / interiorZoom;
      const oldH = baseH / interiorZoom;
      const oldX = clamp(
        baseX + baseW / 2 + interiorPan.x - oldW / 2,
        baseX,
        Math.max(baseX, baseX + baseW - oldW)
      );
      const oldY = clamp(
        baseY + baseH / 2 + interiorPan.y - oldH / 2,
        baseY,
        Math.max(baseY, baseY + baseH - oldH)
      );
      const worldX = oldX + fx * oldW;
      const worldY = oldY + fy * oldH;
      const newW = baseW / nextZoom;
      const newH = baseH / nextZoom;
      const newX = clamp(
        worldX - fx * newW,
        baseX,
        Math.max(baseX, baseX + baseW - newW)
      );
      const newY = clamp(
        worldY - fy * newH,
        baseY,
        Math.max(baseY, baseY + baseH - newH)
      );
      setInteriorZoom(nextZoom);
      setInteriorPan({
        x: newX + newW / 2 - (baseX + baseW / 2),
        y: newY + newH / 2 - (baseY + baseH / 2),
      });
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [interior?.width, interior?.height, interiorZoom, interiorPan]);

  const routes = useMemo(
    () =>
      settlement
        ? (world?.routes || [])
            .filter((route) => route.from === settlement.id || route.to === settlement.id)
            .map((route) => {
              const otherId = route.from === settlement.id ? route.to : route.from;
              const other = settlements.find((s) => s.id === otherId);
              return other ? { route, other } : null;
            })
            .filter(Boolean)
        : [],
    [settlement, settlements, world?.routes]
  );

  const tileEntries = useMemo(() => {
    if (!layout) return [];
    return [
      ...(layout.water || []).map((cell) => ({ ...cell, kind: "water" })),
      ...(layout.plaza || []).map((cell) => ({ ...cell, kind: "plaza" })),
      ...(layout.roads || []).map((cell) => ({ ...cell, kind: "road" })),
      ...(layout.walls || []).map((cell) => ({ ...cell, kind: "wall" })),
      ...(layout.gates || []).map((cell) => ({ ...cell, kind: "gate" })),
    ];
  }, [layout]);

  const buildingEntries = useMemo(() => {
    if (!layout) return [];
    const byId = new Map((settlement?.buildings || []).map((item) => [item.id, item]));
    return layout.buildings
      .map((entry) => ({ entry, building: byId.get(entry.id) }))
      .filter((item) => item.building);
  }, [layout, settlement]);

  if (!settlement) {
    return <p className="text-xs text-muted-foreground">No settlements generated yet.</p>;
  }

  const templateAssets = world?.roomAssetTemplates || {};
  const assetsForRoom = (room) =>
    room.assets?.length ? room.assets : templateAssets[room.type]?.urls || [];
  const nearestRoadTile = (entry) => {
    if (entry.roadX != null && entry.roadY != null) {
      return { x: entry.roadX, y: entry.roadY };
    }
    let best = null;
    let bestDistance = Infinity;
    (layout?.roads || []).forEach((road) => {
      const distance =
        Math.abs(road.x - (entry.doorX ?? entry.x)) +
        Math.abs(road.y - (entry.doorY ?? entry.y));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = road;
      }
    });
    return best;
  };
  const openBuilding = (id) => {
    if (!id) return;
    setBuildingId(id);
    setTimeout(() => {
      document
        .getElementById("building-interior")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  // Double-clicking a building opens it. Fall back to the SVG-level handler so
  // the click still works when the pointer was captured by a pan drag.
  const openBuildingFromEvent = (event) => {
    const holder = event.target?.closest?.("[data-building-id]");
    const id = holder?.getAttribute("data-building-id");
    if (!id) return false;
    openBuilding(id);
    return true;
  };

  const stickerRoom =
    (interior?.rooms || []).find((room) => room.id === stickerRoomId) || null;
  const stickerList = stickerRoom
    ? roomStickerList(stickerRoom, assetsForRoom(stickerRoom))
    : [];
  const patchSticker = (stickerId, patch) => {
    if (!stickerRoom) return;
    const next = stickerList.map((sticker) =>
      sticker.id === stickerId ? { ...sticker, ...patch } : sticker
    );
    onUpdateRoomStickers?.(stickerRoom, building, next);
  };
  const removeSticker = (stickerId) => {
    if (!stickerRoom) return;
    onUpdateRoomStickers?.(
      stickerRoom,
      building,
      stickerList.filter((sticker) => sticker.id !== stickerId)
    );
  };
  const autoArrangeStickers = () => {
    if (!stickerRoom) return;
    const next = buildStickerLayout(
      stickerRoom,
      stickerList.map((sticker) => sticker.url)
    );
    onUpdateRoomStickers?.(stickerRoom, building, next);
  };
  const mapWidth = (layout?.width || 32) * MAP_TILE;
  const mapHeight = (layout?.height || 32) * MAP_TILE;
  const mapViewWidth = mapWidth / mapZoom;
  const mapViewHeight = mapHeight / mapZoom;
  const mapView = {
    x: clamp(
      mapWidth / 2 + mapPan.x - mapViewWidth / 2,
      0,
      Math.max(0, mapWidth - mapViewWidth)
    ),
    y: clamp(
      mapHeight / 2 + mapPan.y - mapViewHeight / 2,
      0,
      Math.max(0, mapHeight - mapViewHeight)
    ),
    w: mapViewWidth,
    h: mapViewHeight,
  };

  const beginMapPan = (event) => {
    if (event.button !== 0) return;
    // Do not capture the pointer yet: capturing on pointer-down retargets the
    // following double-click to the SVG, which stops building double-clicks
    // from firing. Capture only once the pointer actually starts dragging.
    mapDraggedRef.current = false;
    setMapDrag({
      startX: event.clientX,
      startY: event.clientY,
      panX: mapPan.x,
      panY: mapPan.y,
    });
  };

  const moveMapPan = (event) => {
    if (!mapDrag) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dx = ((event.clientX - mapDrag.startX) * mapViewWidth) / rect.width;
    const dy = ((event.clientY - mapDrag.startY) * mapViewHeight) / rect.height;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      if (!mapDraggedRef.current) {
        mapDraggedRef.current = true;
        try {
          event.currentTarget.setPointerCapture?.(event.pointerId);
        } catch {
          /* pointer capture is optional */
        }
      }
    }
    setMapPan({ x: mapDrag.panX - dx, y: mapDrag.panY - dy });
  };

  const endMapPan = (event) => {
    if (!mapDrag) return;
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      /* capture may already be released */
    }
    setMapDrag(null);
  };

  const interiorWidth = (interior?.width || 8) * INTERIOR_CELL;
  const interiorHeight = (interior?.height || 8) * INTERIOR_CELL;
  const interiorPad = INTERIOR_CELL * 0.9;
  const interiorBaseX = -interiorPad;
  const interiorBaseY = -interiorPad;
  const interiorBaseWidth = interiorWidth + interiorPad * 2;
  const interiorBaseHeight = interiorHeight + interiorPad * 2;
  const interiorViewWidth = interiorBaseWidth / interiorZoom;
  const interiorViewHeight = interiorBaseHeight / interiorZoom;
  const interiorView = {
    x: clamp(
      interiorBaseX + interiorBaseWidth / 2 + interiorPan.x - interiorViewWidth / 2,
      interiorBaseX,
      Math.max(interiorBaseX, interiorBaseX + interiorBaseWidth - interiorViewWidth)
    ),
    y: clamp(
      interiorBaseY + interiorBaseHeight / 2 + interiorPan.y - interiorViewHeight / 2,
      interiorBaseY,
      Math.max(interiorBaseY, interiorBaseY + interiorBaseHeight - interiorViewHeight)
    ),
    w: interiorViewWidth,
    h: interiorViewHeight,
  };

  const beginInteriorPan = (event) => {
    if (event.button !== 0) return;
    if (event.target?.closest?.("button, a, input, select, foreignObject")) return;
    interiorDraggedRef.current = false;
    setInteriorDrag({
      startX: event.clientX,
      startY: event.clientY,
      panX: interiorPan.x,
      panY: interiorPan.y,
    });
  };

  const moveInteriorPan = (event) => {
    if (!interiorDrag) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dx = ((event.clientX - interiorDrag.startX) * interiorViewWidth) / rect.width;
    const dy = ((event.clientY - interiorDrag.startY) * interiorViewHeight) / rect.height;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      if (!interiorDraggedRef.current) {
        interiorDraggedRef.current = true;
        try {
          event.currentTarget.setPointerCapture?.(event.pointerId);
        } catch {
          /* pointer capture is optional */
        }
      }
    }
    setInteriorPan({ x: interiorDrag.panX - dx, y: interiorDrag.panY - dy });
  };

  const endInteriorPan = (event) => {
    if (!interiorDrag) return;
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      /* capture may already be released */
    }
    setInteriorDrag(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onSelectSettlement?.("")}>
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> All settlements
        </Button>
        <Select value={settlement.id} onValueChange={onSelectSettlement}>
          <SelectTrigger className="h-7 w-56 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {settlements.map((item) => (
              <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground">
          {settlement.typeLabel} · {nation?.name} · {settlement.biomeLabel}
        </span>
        <div className="ml-auto flex flex-wrap gap-1">
          {onRegenerateLayout && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => onRegenerateLayout?.(settlement)}
              title="Rebuild the street grid and every building interior from the current building list."
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Rebuild plan
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenKingdom?.(kingdom?.id)}>
            Kingdom
          </Button>
        </div>
      </div>

      <div className="grid gap-2 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <Stat icon={Users} label="Population" value={settlement.population.toLocaleString()} />
            <Stat icon={MapPin} label="Districts" value={settlement.districts?.length || 0} />
            <Stat icon={Coins} label="Prosperity" value={`${settlement.prosperity}/10`} />
            <Stat icon={Hammer} label="Defense" value={`${settlement.defense}/10`} />
          </div>

          <div className="overflow-hidden rounded-md border bg-[#15171c]">
            <div className="flex flex-wrap items-center gap-1 border-b border-[#2a2d34] px-1.5 py-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setMapZoom((value) => Math.max(1, value / 1.25))}
                title="Zoom out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="w-10 text-center text-[9px] text-muted-foreground">
                {Math.round(mapZoom * 100)}%
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setMapZoom((value) => Math.min(6, value * 1.25))}
                title="Zoom in"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px]"
                onClick={() => {
                  setMapZoom(1);
                  setMapPan({ x: 0, y: 0 });
                }}
                title="Fit and reset pan"
              >
                <Maximize2 className="mr-1 h-3 w-3" /> Fit
              </Button>
              <span className="ml-auto text-[9px] text-muted-foreground">
                Wheel or buttons to zoom · drag to pan · double-click a building to open it · double-click empty space to recenter
              </span>
            </div>
            <svg
              id="city-map-svg"
              viewBox={`${mapView.x} ${mapView.y} ${mapView.w} ${mapView.h}`}
              className="block h-[54vh] w-full select-none"
              style={{ cursor: mapDrag ? "grabbing" : "grab", touchAction: "none" }}
              onPointerDown={beginMapPan}
              onPointerMove={moveMapPan}
              onPointerUp={endMapPan}
              onPointerCancel={endMapPan}
              onDoubleClick={(event) => {
                if (openBuildingFromEvent(event)) return;
                setMapPan({ x: 0, y: 0 });
              }}
            >
              <defs>
                <pattern id="city-water" width="12" height="12" patternUnits="userSpaceOnUse">
                  <rect width="12" height="12" fill="#1d3c4d" />
                  <path d="M0 6 q3 -2 6 0 t6 0" fill="none" stroke="#3f7f96" strokeWidth="1" opacity="0.5" />
                </pattern>
              </defs>
              <rect width={mapWidth} height={mapHeight} fill="#16181d" />
              {tileEntries.map((cell) => (
                <rect
                  key={`${cell.kind}-${cell.x}-${cell.y}`}
                  x={cell.x * MAP_TILE}
                  y={cell.y * MAP_TILE}
                  width={MAP_TILE}
                  height={MAP_TILE}
                  fill={
                    cell.kind === "water"
                      ? "url(#city-water)"
                      : cell.kind === "road"
                        ? "#45464c"
                        : cell.kind === "plaza"
                          ? "#5a5549"
                          : cell.kind === "wall"
                            ? "#8f8878"
                            : cell.kind === "gate"
                              ? "#c9a85a"
                              : "#16181d"
                  }
                  stroke={cell.kind === "road" ? "#54565e" : "none"}
                  strokeWidth="0.6"
                />
              ))}
              {layout?.roads?.map((cell) => (
                <rect
                  key={`road-mark-${cell.x}-${cell.y}`}
                  x={cell.x * MAP_TILE + MAP_TILE * 0.3}
                  y={cell.y * MAP_TILE + MAP_TILE * 0.45}
                  width={MAP_TILE * 0.4}
                  height={MAP_TILE * 0.1}
                  fill="#b8b09c"
                  opacity="0.35"
                />
              ))}
              {Array.from({ length: (layout?.width || 0) + 1 }).map((_, index) => (
                <line
                  key={`gv-${index}`}
                  x1={index * MAP_TILE}
                  y1={0}
                  x2={index * MAP_TILE}
                  y2={mapHeight}
                  stroke={CITY_GRID_COLOR}
                  strokeWidth="0.4"
                  opacity="0.5"
                />
              ))}
              {Array.from({ length: (layout?.height || 0) + 1 }).map((_, index) => (
                <line
                  key={`gh-${index}`}
                  x1={0}
                  y1={index * MAP_TILE}
                  x2={mapWidth}
                  y2={index * MAP_TILE}
                  stroke={CITY_GRID_COLOR}
                  strokeWidth="0.4"
                  opacity="0.5"
                />
              ))}
              {buildingEntries.map(({ entry, building: item }) => {
                const active = item.id === building?.id;
                const color = CATEGORY_COLOR[item.category] || "#7a6a5a";
                return (
                  <g
                    key={item.id}
                    data-building-id={item.id}
                    onClick={() => {
                      if (!mapDraggedRef.current) setBuildingId(item.id);
                    }}
                    onDoubleClick={() => openBuilding(item.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <rect
                      x={entry.x * MAP_TILE}
                      y={entry.y * MAP_TILE}
                      width={entry.w * MAP_TILE}
                      height={entry.h * MAP_TILE}
                      rx={2}
                      fill={color}
                      fillOpacity={active ? 0.98 : 0.82}
                      stroke={active ? "#fff2c7" : "#0d0f13"}
                      strokeWidth={active ? 2 : 0.8}
                    >
                      <title>
                        {item.name} · {item.type} · footprint {entry.w}×{entry.h} spaces
                      </title>
                    </rect>
                    {item.icon && (
                      <image
                        href={item.icon}
                        x={entry.x * MAP_TILE + 1}
                        y={entry.y * MAP_TILE + 1}
                        width={Math.max(1, entry.w * MAP_TILE - 2)}
                        height={Math.max(1, entry.h * MAP_TILE - 2)}
                        opacity={0.92}
                        preserveAspectRatio="xMidYMid meet"
                        pointerEvents="none"
                        transform={`rotate(${Number(item.rotation) || 0} ${
                          (entry.x + entry.w / 2) * MAP_TILE
                        } ${(entry.y + entry.h / 2) * MAP_TILE})`}
                      />
                    )}
                    {entry.doorX != null && entry.doorY != null && (
                      <rect
                        x={entry.doorX * MAP_TILE + MAP_TILE * 0.3}
                        y={entry.doorY * MAP_TILE + MAP_TILE * 0.3}
                        width={MAP_TILE * 0.4}
                        height={MAP_TILE * 0.4}
                        fill="#f0d48a"
                        opacity="0.95"
                      />
                    )}
                    {active && (
                      <text
                        x={entry.x * MAP_TILE + 2}
                        y={entry.y * MAP_TILE + Math.min(10, entry.h * MAP_TILE - 3)}
                        fontSize={Math.min(8, MAP_TILE * 0.6)}
                        fill="#f4edd9"
                      >
                        {item.name.slice(0, 22)}
                      </text>
                    )}
                  </g>
                );
              })}
              {buildingEntries.map(({ entry }) => {
                const road = nearestRoadTile(entry);
                if (!road || entry.doorX == null || entry.doorY == null) return null;
                return (
                  <line
                    key={`driveway-${entry.id}`}
                    x1={(entry.doorX + 0.5) * MAP_TILE}
                    y1={(entry.doorY + 0.5) * MAP_TILE}
                    x2={(road.x + 0.5) * MAP_TILE}
                    y2={(road.y + 0.5) * MAP_TILE}
                    stroke="#f0d48a"
                    strokeOpacity="0.55"
                    strokeWidth="1.2"
                    strokeDasharray="2 2"
                  />
                );
              })}
            </svg>
          </div>

          <div className="flex flex-wrap gap-2 text-[9px] text-muted-foreground">
            {Object.entries(CATEGORY_COLOR).map(([name, color]) => (
              <span key={name} className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
                {name}
              </span>
            ))}
            <span className="text-sky-400">Water</span>
            <span className="text-stone-300">Road tiles</span>
            <span className="text-amber-400">Walls & gates</span>
            <span>Every building touches a road tile.</span>
            {layout?.missing?.length > 0 && (
              <span className="text-red-400">{layout.missing.length} building(s) could not find a free lot.</span>
            )}
          </div>
        </div>

        <aside className="space-y-2">
          <div className="rounded-md border p-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Settlement</p>
            <p className="text-sm font-semibold">{settlement.name}</p>
            <p className="text-xs text-muted-foreground">
              {settlement.kind} in {nation?.name}. {settlement.districts?.join(", ")}.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1 text-[10px]">
              <span>Kingdom: {kingdom?.name || "—"}</span>
              <span>Culture: {nation?.culture || "—"}</span>
              <span>Government: {nation?.government || "—"}</span>
              <span>Loyalty: {kingdom?.loyalty?.[settlement.id] ?? "—"} / 20</span>
            </div>
            <p className="mt-1 text-[9px] text-muted-foreground">
              Street grid {layout?.width || 0}×{layout?.height || 0} · block size {layout?.block || 0}
            </p>
          </div>

          <div className="rounded-md border p-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Buildings</p>
              <span className="text-[10px] text-muted-foreground">{settlement.buildings?.length || 0}</span>
            </div>
            <div className="mt-1 max-h-44 space-y-0.5 overflow-y-auto">
              {settlement.buildings?.map((item) => {
                const entry = layout?.buildings?.find((row) => row.id === item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setBuildingId(item.id)}
                    className={`flex w-full items-center gap-1 rounded px-1 py-1 text-left text-[10px] ${
                      item.id === building?.id ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: CATEGORY_COLOR[item.category] }} />
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    {entry && (
                      <span className="text-muted-foreground">{entry.w}×{entry.h}</span>
                    )}
                    <span className="text-muted-foreground">{item.floors}F</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-md border p-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Travel from here</p>
            <div className="mt-1 max-h-32 space-y-0.5 overflow-y-auto text-[10px]">
              {routes.length === 0 && <p className="text-muted-foreground">No routes.</p>}
              {routes.slice(0, 12).map(({ route, other }) => {
                const estimate = travelEstimate(route, "walk");
                return (
                  <button
                    key={route.id}
                    type="button"
                    className="flex w-full justify-between gap-1 rounded px-1 py-0.5 hover:bg-accent/50"
                    onClick={() => onSelectSettlement?.(other.id)}
                  >
                    <span className="truncate">{other.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {route.distanceKm.toLocaleString()} km · {estimate.days}d
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-md border p-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">People here</p>
            <div className="mt-1 max-h-32 space-y-0.5 overflow-y-auto text-[10px]">
              {localNpcs.slice(0, 20).map((npc) => (
                <p key={npc.id} className="truncate">
                  <span className="font-medium">{npc.name}</span>{" "}
                  <span className="text-muted-foreground">— {npc.occupation}</span>
                </p>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {building && buildingView && (
        <div id="building-interior" className="rounded-md border p-2">
          <div className="flex flex-wrap items-center gap-2">
            <div>
              <p className="text-sm font-semibold">{buildingView.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {buildingView.type} · {buildingView.category} · {buildingView.district} ·{" "}
                {buildingView.floors} floor(s) · footprint {buildingView.footprint?.w || 1}×
                {buildingView.footprint?.h || 1} map spaces · interior {interior?.width || 0}×
                {interior?.height || 0} grid
              </p>
            </div>
            <div className="ml-auto flex flex-wrap gap-1">
              <Select value={String(floor)} onValueChange={(v) => setFloor(Number(v))}>
                <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: buildingView.floors || 1 }, (_, i) => (
                    <SelectItem key={i} value={String(i + 1)}>Floor {i + 1}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {onBuildHere && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onBuildHere?.(settlement, buildingView)}>
                  Build / lease here
                </Button>
              )}
              {onRerollInterior && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => onRerollInterior?.(settlement, buildingView)}
                  title="Generate a new room layout and seed for this building."
                >
                  <RefreshCw className="mr-1 h-3.5 w-3.5" /> Reroll rooms
                </Button>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            <span className="font-semibold uppercase tracking-wide">House icon</span>
            <Input
              className="h-7 w-56 text-[10px]"
              placeholder="Icon URL or /api/assets/file?path=…"
              value={buildingView.icon || ""}
              onChange={(e) =>
                onUpdateBuilding?.(settlement, buildingView, { icon: e.target.value })
              }
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px]"
              onClick={() =>
                onUpdateBuilding?.(settlement, buildingView, {
                  rotation: ((Number(buildingView.rotation) || 0) + 45) % 360,
                })
              }
            >
              Rotate +45°
            </Button>
            <Input
              type="number"
              step={45}
              min={0}
              max={315}
              className="h-7 w-16 text-[10px]"
              value={Number(buildingView.rotation) || 0}
              onChange={(e) =>
                onUpdateBuilding?.(settlement, buildingView, {
                  rotation:
                    ((Math.round((Number(e.target.value) || 0) / 45) * 45) % 360 + 360) %
                    360,
                })
              }
            />
            <span>{Number(buildingView.rotation) || 0}°</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            <span>Workstations: {buildingView.workstations?.join(", ") || "—"}</span>
            <span>Value: {buildingView.propertyValue?.toLocaleString()} gp</span>
            <span>Comfort: {buildingView.comfort || "Poor"}</span>
            <span>
              Facility: {buildingView.facilityClass || "Roomy"} ·{" "}
              {buildingView.buildMonths || 1} month
              {(buildingView.buildMonths || 1) === 1 ? "" : "s"} to build
            </span>
            <span>Seed: {buildingView.interior?.seed || "—"}</span>
            <span>Rooms on this floor: {rooms.length}</span>
          </div>

          <div className="mt-2 overflow-hidden rounded border bg-[#101216]">
            <div className="flex flex-wrap items-center gap-1 border-b border-[#2a2d34] px-1.5 py-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setInteriorZoom((value) => Math.max(1, value / 1.25))}
                title="Zoom out of the room grid"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="w-10 text-center text-[9px] text-muted-foreground">
                {Math.round(interiorZoom * 100)}%
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setInteriorZoom((value) => Math.min(6, value * 1.25))}
                title="Zoom in on the room grid"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px]"
                onClick={() => {
                  setInteriorZoom(1);
                  setInteriorPan({ x: 0, y: 0 });
                }}
                title="Fit the whole floor"
              >
                <Maximize2 className="mr-1 h-3 w-3" /> Fit
              </Button>
              <span className="ml-auto text-[9px] text-muted-foreground">
                Wheel or buttons to zoom · drag to pan · double-click to reset · {rooms.length} rooms
              </span>
            </div>
            <svg
              id="interior-grid-svg"
              viewBox={`${interiorView.x} ${interiorView.y} ${interiorView.w} ${interiorView.h}`}
              className="block h-[46vh] w-full select-none"
              style={{
                cursor: interiorDrag ? "grabbing" : "grab",
                touchAction: "none",
              }}
              onPointerDown={beginInteriorPan}
              onPointerMove={moveInteriorPan}
              onPointerUp={endInteriorPan}
              onPointerCancel={endInteriorPan}
              onDoubleClick={() => {
                setInteriorZoom(1);
                setInteriorPan({ x: 0, y: 0 });
              }}
            >
              <defs>
                <marker id="entry-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#f0d48a" />
                </marker>
                <pattern id="interior-grid" width={INTERIOR_CELL} height={INTERIOR_CELL} patternUnits="userSpaceOnUse">
                  <rect width={INTERIOR_CELL} height={INTERIOR_CELL} fill="#12151b" />
                  <path d={`M ${INTERIOR_CELL} 0 L 0 0 0 ${INTERIOR_CELL}`} fill="none" stroke="#262a31" strokeWidth="1" />
                </pattern>
              </defs>
              <rect
                x={-interiorPad}
                y={-interiorPad}
                width={interiorWidth + interiorPad * 2}
                height={interiorHeight + interiorPad * 2}
                fill="#0d0f13"
              />
              <rect width={interiorWidth} height={interiorHeight} fill="url(#interior-grid)" />
              <rect
                width={interiorWidth}
                height={interiorHeight}
                fill="none"
                stroke="#59606c"
                strokeWidth={6}
              />
              {(floorData?.corridor || []).map((cell) => (
                <rect
                  key={`corr-${cell.x}-${cell.y}`}
                  x={cell.x * INTERIOR_CELL}
                  y={cell.y * INTERIOR_CELL}
                  width={INTERIOR_CELL}
                  height={INTERIOR_CELL}
                  fill="#262a31"
                  stroke="#343943"
                  strokeWidth="1"
                />
              ))}
              {rooms.map((room) => {
                const texture = floorTexture(room.floorTexture);
                return (
                  <g key={room.id}>
                    <rect
                      x={room.x * INTERIOR_CELL}
                      y={room.y * INTERIOR_CELL}
                      width={room.w * INTERIOR_CELL}
                      height={room.h * INTERIOR_CELL}
                      fill={texture.color}
                      fillOpacity="0.35"
                      stroke="#d8cfae"
                      strokeWidth="5"
                    />
                    <rect
                      x={room.x * INTERIOR_CELL + 4}
                      y={room.y * INTERIOR_CELL + 4}
                      width={Math.max(0, room.w * INTERIOR_CELL - 8)}
                      height={4}
                      fill={roomCategoryColor(room.category)}
                      opacity="0.95"
                    />
                    {room.floorTextureUrl && (
                      <image
                        href={room.floorTextureUrl}
                        x={room.x * INTERIOR_CELL + 3}
                        y={room.y * INTERIOR_CELL + 3}
                        width={room.w * INTERIOR_CELL - 6}
                        height={room.h * INTERIOR_CELL - 6}
                        preserveAspectRatio="xMidYMid slice"
                        opacity="0.55"
                      />
                    )}
                    <text x={room.x * INTERIOR_CELL + 8} y={room.y * INTERIOR_CELL + 20} fontSize="15" fill="#f4edd9">
                      {room.type}
                    </text>
                    <text x={room.x * INTERIOR_CELL + 8} y={room.y * INTERIOR_CELL + 38} fontSize="10" fill="#c6bea9">
                      {room.w}×{room.h} spaces · {room.floorTexture}
                    </text>
                    {roomStickerList(room, assetsForRoom(room)).map((sticker) => {
                      const roomWidth = room.w * INTERIOR_CELL;
                      const roomHeight = room.h * INTERIOR_CELL;
                      const x = room.x * INTERIOR_CELL + sticker.x * roomWidth;
                      const y = room.y * INTERIOR_CELL + sticker.y * roomHeight;
                      const width = Math.max(8, sticker.w * roomWidth);
                      const height = Math.max(8, sticker.h * roomHeight);
                      const centerX = x + width / 2;
                      const centerY = y + height / 2;
                      return (
                        <g
                          key={sticker.id}
                          transform={`rotate(${sticker.rotation || 0} ${centerX} ${centerY})`}
                        >
                          <image
                            href={sticker.url}
                            x={x}
                            y={y}
                            width={width}
                            height={height}
                            preserveAspectRatio="xMidYMid meet"
                          />
                        </g>
                      );
                    })}
                    {room.door && (
                      <rect
                        x={
                          (room.door.side === "east"
                            ? room.x + room.w
                            : room.door.side === "west"
                              ? room.x
                              : room.door.x) * INTERIOR_CELL +
                          (room.door.side === "east" ? -4 : room.door.side === "west" ? 0 : INTERIOR_CELL * 0.35)
                        }
                        y={
                          (room.door.side === "north"
                            ? room.y
                            : room.door.side === "south"
                              ? room.y + room.h
                              : room.door.y) * INTERIOR_CELL +
                          (room.door.side === "south" ? -4 : room.door.side === "north" ? 0 : INTERIOR_CELL * 0.35)
                        }
                        width={
                          room.door.side === "east" || room.door.side === "west"
                            ? 4
                            : INTERIOR_CELL * 0.3
                        }
                        height={
                          room.door.side === "north" || room.door.side === "south"
                            ? 4
                            : INTERIOR_CELL * 0.3
                        }
                        fill="#f0d48a"
                        opacity="0.9"
                      />
                    )}
                    <foreignObject
                      x={room.x * INTERIOR_CELL + 8}
                      y={(room.y + room.h) * INTERIOR_CELL - 28}
                      width={room.w * INTERIOR_CELL - 16}
                      height="24"
                    >
                      <button
                        type="button"
                        onClick={() => onFindAssets?.(room, building)}
                        className="rounded border border-white/20 bg-black/40 px-2 py-0.5 text-[9px] text-white"
                      >
                        <ImagePlus className="mr-1 inline h-3 w-3" /> Assign stickers
                      </button>
                    </foreignObject>
                  </g>
                );
              })}
              {(floorData?.stairs || []).map((stair, index) => (
                <g key={`stair-${index}`}>
                  <rect
                    x={stair.x * INTERIOR_CELL + 6}
                    y={stair.y * INTERIOR_CELL + 6}
                    width={INTERIOR_CELL - 12}
                    height={INTERIOR_CELL - 12}
                    fill="#3a3f4a"
                    stroke="#c9a85a"
                    strokeWidth="2"
                  />
                  <text
                    x={stair.x * INTERIOR_CELL + INTERIOR_CELL / 2}
                    y={stair.y * INTERIOR_CELL + INTERIOR_CELL / 2 + 6}
                    textAnchor="middle"
                    fontSize="24"
                    fill="#f0d48a"
                  >
                    ⇅
                  </text>
                </g>
              ))}
              {floorData?.exteriorDoor && (() => {
                const entry = floorData.exteriorDoor;
                const vertical = entry.side === "east" || entry.side === "west";
                const doorX = (entry.x + (vertical ? 0 : 0.5)) * INTERIOR_CELL;
                const doorY = (entry.y + (vertical ? 0.5 : 0)) * INTERIOR_CELL;
                return (
                  <g>
                    <line
                      x1={entry.vector.x1 * INTERIOR_CELL}
                      y1={entry.vector.y1 * INTERIOR_CELL}
                      x2={entry.vector.x2 * INTERIOR_CELL}
                      y2={entry.vector.y2 * INTERIOR_CELL}
                      stroke="#f0d48a"
                      strokeWidth="4"
                      strokeDasharray="7 4"
                      opacity="0.9"
                      markerEnd="url(#entry-arrow)"
                    />
                    <circle
                      cx={entry.outside.x * INTERIOR_CELL}
                      cy={entry.outside.y * INTERIOR_CELL}
                      r="5"
                      fill="#f0d48a"
                    />
                    <rect
                      x={
                        entry.side === "east"
                          ? doorX - 5
                          : entry.side === "west"
                            ? doorX - 5
                            : doorX - INTERIOR_CELL * 0.16
                      }
                      y={
                        entry.side === "north" || entry.side === "south"
                          ? doorY - 5
                          : doorY - INTERIOR_CELL * 0.16
                      }
                      width={
                        entry.side === "east" || entry.side === "west"
                          ? 10
                          : INTERIOR_CELL * 0.32
                      }
                      height={
                        entry.side === "north" || entry.side === "south"
                          ? 10
                          : INTERIOR_CELL * 0.32
                      }
                      fill="#f0d48a"
                    />
                    <text
                      x={entry.outside.x * INTERIOR_CELL}
                      y={entry.outside.y * INTERIOR_CELL - 12}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#f0d48a"
                    >
                      outside
                    </text>
                  </g>
                );
              })()}
            </svg>
          </div>

          <div className="mt-2 flex flex-wrap gap-2 text-[9px] text-muted-foreground">
            <span>Gold line = door onto the corridor</span>
            <span>Gold dashed line = door to the outside</span>
            <span>⇅ = one stair between floors</span>
            <span>Each cell is one 5-ft. space on the Architect grid.</span>
            <span>Top bar = room category:</span>
            {["Living", "Social", "Storage", "Business", "Bastion", "Attachment", "Connection"].map(
              (category) => (
                <span key={category} className="flex items-center gap-0.5">
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ backgroundColor: ROOM_CATEGORIES[category].color }}
                  />
                  {ROOM_CATEGORIES[category].label}
                </span>
              )
            )}
          </div>

          <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <div key={room.id} className="rounded border p-1.5 text-[10px]">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{room.type}</span>
                  <span className="text-muted-foreground">{room.w}×{room.h} · fl {room.floor || 1}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[9px] text-muted-foreground">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: roomCategoryColor(room.category) }}
                  />
                  <span>{room.category || "Misc"}</span>
                  <span>·</span>
                  <span>favours {roomFocusLabel(room.focus)}</span>
                  {room.bastion && (
                    <span className="ml-auto rounded bg-amber-500/15 px-1 text-amber-300">
                      {room.seatOfPower ? "Seat of Power" : `Bastion ${room.bastionLevel || ""}`}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <select
                    className="h-6 min-w-0 flex-1 rounded border bg-background px-1 text-[10px]"
                    value={room.floorTexture || "stone"}
                    onChange={(e) => onSetFloorTexture?.(room, building, e.target.value)}
                  >
                    {room.floorTexture === "custom" && <option value="custom">Custom image</option>}
                    {FLOOR_TEXTURES.map((texture) => (
                      <option key={texture.id} value={texture.id}>{texture.label}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1 text-[9px]"
                    onClick={() => setStickerRoomId(room.id)}
                  >
                    Stickers
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1 text-[9px]"
                    onClick={() => onFindAssets?.(room, building, "texture")}
                    title="Assign an imported image as this room's floor material."
                  >
                    Floor art
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {stickerRoom && (
            <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
              <div className="flex flex-wrap items-center gap-1">
                <p className="text-xs font-semibold">
                  Sticker layout · {stickerRoom.type}
                </p>
                <span className="text-[9px] text-muted-foreground">
                  Place, resize and rotate cosmetic images inside the room.
                </span>
                <div className="ml-auto flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px]"
                    onClick={() => onFindAssets?.(stickerRoom, building, "assets")}
                  >
                    <ImagePlus className="mr-1 h-3 w-3" /> Add sticker
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px]"
                    onClick={autoArrangeStickers}
                  >
                    Auto-arrange
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px]"
                    onClick={() => onUseRoomTemplate?.(stickerRoom)}
                  >
                    Use as room-type template
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px]"
                    onClick={() => setStickerRoomId("")}
                  >
                    Close
                  </Button>
                </div>
              </div>
              <div className="mt-1 space-y-1">
                {stickerList.map((sticker) => (
                  <div
                    key={sticker.id}
                    className="flex flex-wrap items-center gap-1 rounded border bg-background/60 px-1.5 py-1 text-[10px]"
                  >
                    <img
                      src={sticker.url}
                      alt="Sticker"
                      className="h-8 w-8 shrink-0 rounded border bg-muted/30 object-contain"
                    />
                    <span className="max-w-36 truncate text-muted-foreground">
                      {decodeURIComponent(sticker.url.split("/").pop() || "Sticker")}
                    </span>
                    {[
                      ["X", "x"],
                      ["Y", "y"],
                      ["W", "w"],
                      ["H", "h"],
                    ].map(([label, key]) => (
                      <label key={key} className="flex items-center gap-0.5">
                        <span className="text-[9px] text-muted-foreground">{label}</span>
                        <input
                          type="number"
                          min={key === "w" || key === "h" ? 5 : 0}
                          max={key === "w" || key === "h" ? 95 : 100}
                          className="h-6 w-12 rounded border bg-background px-1 text-[10px]"
                          value={Math.round((sticker[key] || 0) * 100)}
                          onChange={(event) =>
                            patchSticker(sticker.id, {
                              [key]: Math.max(0, Math.min(1, Number(event.target.value) / 100)),
                            })
                          }
                        />
                      </label>
                    ))}
                    <label className="flex items-center gap-0.5">
                      <span className="text-[9px] text-muted-foreground">Rotate</span>
                      <select
                        className="h-6 rounded border bg-background px-1 text-[10px]"
                        value={String(sticker.rotation || 0)}
                        onChange={(event) =>
                          patchSticker(sticker.id, { rotation: Number(event.target.value) })
                        }
                      >
                        {[0, 90, 180, 270].map((angle) => (
                          <option key={angle} value={String(angle)}>{angle}°</option>
                        ))}
                      </select>
                    </label>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1 text-[9px]"
                      onClick={() =>
                        onFindAssets?.(stickerRoom, building, "replaceSticker", sticker.id)
                      }
                    >
                      Replace art
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1 text-[9px] text-destructive"
                      onClick={() => removeSticker(sticker.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                {stickerList.length === 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    No stickers in this room yet. Add one, or save another room of this type as a
                    room-type template so every interior uses the same art.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-md border bg-muted/20 p-1.5">
      <p className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className="text-xs font-semibold">{value}</p>
    </div>
  );
}
