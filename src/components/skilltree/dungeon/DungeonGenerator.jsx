import { useEffect, useMemo, useRef, useState } from "react";
import { useTree } from "@/lib/treeStore";
import {
  DUNGEON_CATEGORIES,
  DUNGEON_RANKS,
  DEFAULT_DUNGEON_ROOMS,
  categoryColor,
  generateDungeon,
  randomSeed,
  roomFromTemplate,
  scaleEncounters,
  rankChallenge,
} from "@/lib/dungeonGen";
import { DungeonMap } from "@/components/skilltree/dungeon/DungeonMap";
import { RoomBattleMap } from "@/components/skilltree/dungeon/RoomBattleMap";
import { RoomShapeBuilder } from "@/components/skilltree/dungeon/RoomShapeBuilder";
import { DungeonDangerPanel } from "@/components/skilltree/dungeon/DungeonDangerPanel";
import { rollEncounter } from "@/lib/dmLoot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Dices, Download, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

const lines = (arr) => (arr || []).join("\n");
const split = (text) =>
  String(text || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

const CONNECTORS = ["Doorway", "Double Door", "Gate", "Archway", "Corridor", "Bridge", "Stairs", "Rubble passage", "Rune-sealed door"];

const BLANK_ROOM = {
  name: "New Room",
  category: "Chamber",
  minW: 6,
  maxW: 12,
  minH: 6,
  maxH: 12,
  environment: "",
  elevation: "Flat",
  cover: "Open",
  connector: "Doorway",
};

// Full dungeon workbench: generate a single dungeon or a branching spire run,
// edit the generated rooms, and save the result with the project. Room
// templates live in the Reference Library's new Dungeon Rooms tab.
export function DungeonGenerator({ onExit, embedded = false }) {
  const { settings, setSettings } = useTree();
  const allRoomTemplates = settings?.library?.dungeonRooms?.length
    ? settings.library.dungeonRooms
    : DEFAULT_DUNGEON_ROOMS;
  const roomTemplates = allRoomTemplates.filter((r) => r.enabled !== false);
  const monsters = settings?.library?.monsters || [];
  const lootPools = settings?.library?.lootPools || [];
  const encounterTables = settings?.library?.encounterTables || [];
  const saved = settings?.library?.dungeons || [];

  const [mode, setMode] = useState("single");
  const [rank, setRank] = useState("E");
  const [seed, setSeed] = useState(randomSeed);
  const [players, setPlayers] = useState(4);
  const [partyLevel, setPartyLevel] = useState(1);
  const [dungeon, setDungeon] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [includeTraps, setIncludeTraps] = useState(true);
  const [includeSpawns, setIncludeSpawns] = useState(true);
  const [includeLoot, setIncludeLoot] = useState(true);
  const [savedId, setSavedId] = useState("");
  const [roomQuery, setRoomQuery] = useState("");
  const [makerOpen, setMakerOpen] = useState(true);
  const [makerRoom, setMakerRoom] = useState(null);
  const [makerTemplateId, setMakerTemplateId] = useState("");
  const [ctxMenu, setCtxMenu] = useState(null);
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const clipRef = useRef(null);

  const selected = dungeon?.rooms?.find((r) => r.id === selectedId) || null;
  const ctxRoom = ctxMenu?.roomId
    ? dungeon?.rooms?.find((r) => r.id === ctxMenu.roomId) || null
    : null;
  const routes = dungeon?.routes || [];
  const chosenRoute =
    routes.find((r) => r.id === dungeon?.chosenRouteId) || routes[0] || null;
  const chosenBoss = dungeon?.rooms?.find((r) => r.id === chosenRoute?.bossId) || null;
  const rankInfo = DUNGEON_RANKS[rank] || DUNGEON_RANKS.E;
  const rankBand = rankChallenge(rank);
  const filteredTemplates = roomTemplates.filter((r) => {
    const q = roomQuery.trim().toLowerCase();
    return !q || `${r.name} ${r.category}`.toLowerCase().includes(q);
  });
  const stats = useMemo(() => {
    const rooms = dungeon?.rooms || [];
    return {
      rooms: rooms.filter((r) => !r.side).length,
      sideRooms: rooms.filter((r) => r.side).length,
      traps: rooms.filter((r) => (r.traps || []).length).length,
      spawns: rooms.filter((r) => (r.spawns || []).length).length,
      loot: rooms.filter((r) => (r.loot || []).length).length,
      bonfires: rooms.filter((r) => r.bonfire).length,
      connections: dungeon?.connections?.length || 0,
    };
  }, [dungeon]);

  const commit = (next) => {
    if (!next) return;
    if (dungeon) {
      pastRef.current.push(dungeon);
      if (pastRef.current.length > 80) pastRef.current.shift();
      futureRef.current = [];
    }
    setDungeon(next);
  };
  const undo = () => {
    const prev = pastRef.current.pop();
    if (!prev) return;
    if (dungeon) futureRef.current.push(dungeon);
    setDungeon(prev);
    setSelectedId(null);
  };
  const redo = () => {
    const next = futureRef.current.pop();
    if (!next) return;
    if (dungeon) pastRef.current.push(dungeon);
    setDungeon(next);
    setSelectedId(null);
  };
  const copyRoom = (id = selectedId) => {
    const room = dungeon?.rooms?.find((r) => r.id === id) || selected;
    if (room) {
      clipRef.current = room;
      toast("Room copied.");
    }
  };
  const cutRoom = (id = selectedId) => {
    const room = dungeon?.rooms?.find((r) => r.id === id) || selected;
    if (!room) return;
    clipRef.current = room;
    removeRoom(room.id);
    toast("Room cut.");
  };
  const pasteRoom = () => {
    if (!dungeon || !clipRef.current) return;
    const src = clipRef.current;
    const room = {
      ...src,
      id: `room${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
      x: src.x + 2,
      y: src.y + 2,
      cells: Array.isArray(src.cells) ? src.cells.map(([x, y]) => [x, y]) : undefined,
      spawnPoints: (src.spawnPoints || []).map((p) => ({ ...p })),
      ingressPoints: (src.ingressPoints || []).map((p) => ({ ...p })),
    };
    commit({ ...dungeon, rooms: [...dungeon.rooms, room] });
    setSelectedId(room.id);
    toast("Room pasted.");
  };
  const removeRoom = (id) => {
    if (!dungeon) return;
    commit({
      ...dungeon,
      rooms: dungeon.rooms.filter((r) => r.id !== id),
      connections: dungeon.connections.filter((c) => c.from !== id && c.to !== id),
    });
    if (selectedId === id) setSelectedId(null);
  };
  const rotateRoom = (id = selectedId) => {
    const room = dungeon?.rooms?.find((r) => r.id === id) || selected;
    if (!room || !dungeon) return;
    commit({
      ...dungeon,
      rooms: dungeon.rooms.map((r) => {
        if (r.id !== room.id) return r;
        const cells = Array.isArray(r.cells)
          ? r.cells.map(([x, y]) => [r.h - 1 - y, x])
          : undefined;
        return { ...r, w: r.h, h: r.w, cells };
      }),
    });
  };
  const addTemplate = (template) => {
    if (!dungeon) {
      toast("Generate or load a dungeon first.");
      return;
    }
    const maxX = Math.max(0, ...(dungeon.rooms || []).map((r) => r.x + r.w));
    const room = roomFromTemplate(template, { x: maxX + 4, y: 0 });
    commit({ ...dungeon, rooms: [...dungeon.rooms, room] });
    setSelectedId(room.id);
  };
  const addBlankRoom = () => {
    if (!dungeon) {
      toast("Generate or load a dungeon first.");
      return;
    }
    const maxX = Math.max(0, ...(dungeon.rooms || []).map((r) => r.x + r.w));
    const room = roomFromTemplate(BLANK_ROOM, { x: maxX + 4, y: 0 });
    commit({ ...dungeon, rooms: [...dungeon.rooms, room] });
    setSelectedId(room.id);
  };

  const duplicateRoom = (id = selectedId) => {
    if (!dungeon) return;
    const src = dungeon.rooms.find((r) => r.id === id);
    if (!src) return;
    const room = {
      ...src,
      id: `room${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
      x: src.x + 3,
      y: src.y + 3,
      cells: Array.isArray(src.cells) ? src.cells.map(([x, y]) => [x, y]) : undefined,
      spawnPoints: (src.spawnPoints || []).map((p) => ({ ...p })),
      ingressPoints: (src.ingressPoints || []).map((p) => ({ ...p })),
      traps: [...(src.traps || [])],
      spawns: [...(src.spawns || [])],
      loot: [...(src.loot || [])],
    };
    commit({ ...dungeon, rooms: [...dungeon.rooms, room] });
    setSelectedId(room.id);
    setCtxMenu(null);
    toast("Room duplicated.");
  };

  const addConnectedRoom = (parentId = selectedId) => {
    if (!dungeon) return;
    const parent = dungeon.rooms.find((r) => r.id === parentId);
    if (!parent) return;
    const room = roomFromTemplate(BLANK_ROOM, {
      x: parent.x + parent.w + 4,
      y: parent.y,
    });
    commit({
      ...dungeon,
      rooms: [...dungeon.rooms, room],
      connections: [
        ...dungeon.connections,
        {
          id: `${parent.id}->${room.id}`,
          from: parent.id,
          to: room.id,
          type: parent.connector || "Doorway",
        },
      ],
    });
    setSelectedId(room.id);
    setCtxMenu(null);
  };

  const addRoomAt = (world) => {
    if (!dungeon || !world) return;
    const room = roomFromTemplate(BLANK_ROOM, {
      x: Math.max(0, Math.round(world.x)),
      y: Math.max(0, Math.round(world.y)),
    });
    commit({ ...dungeon, rooms: [...dungeon.rooms, room] });
    setSelectedId(room.id);
    setCtxMenu(null);
    toast("Room added. Use Edit shape to carve its footprint.");
  };

  const connectNearest = (id = selectedId) => {
    if (!dungeon) return;
    const src = dungeon.rooms.find((r) => r.id === id);
    if (!src) return;
    const nearest = dungeon.rooms
      .filter((r) => r.id !== id)
      .sort((a, b) => {
        const da = (a.x + a.w / 2 - (src.x + src.w / 2)) ** 2 + (a.y + a.h / 2 - (src.y + src.h / 2)) ** 2;
        const db = (b.x + b.w / 2 - (src.x + src.w / 2)) ** 2 + (b.y + b.h / 2 - (src.y + src.h / 2)) ** 2;
        return da - db;
      })[0];
    if (!nearest) return;
    if (
      dungeon.connections.some(
        (c) => (c.from === src.id && c.to === nearest.id) || (c.from === nearest.id && c.to === src.id)
      )
    ) {
      toast("These rooms are already connected.");
      setCtxMenu(null);
      return;
    }
    commit({
      ...dungeon,
      connections: [
        ...dungeon.connections,
        {
          id: `${src.id}->${nearest.id}`,
          from: src.id,
          to: nearest.id,
          type: src.connector || "Doorway",
        },
      ],
    });
    setCtxMenu(null);
    toast(`Connected to ${nearest.name}.`);
  };

  const openMaker = (id = selectedId) => {
    if (!id) return;
    const room = dungeon?.rooms?.find((r) => r.id === id);
    if (!room) return;
    setSelectedId(id);
    setMakerRoom(room);
    setMakerTemplateId(room.templateId || "");
    setMakerOpen(true);
    setCtxMenu(null);
  };

  const loadMakerTemplate = (template) => {
    const room = roomFromTemplate(template, { x: 0, y: 0 });
    setMakerRoom(room);
    setMakerTemplateId(template.id || "");
    setMakerOpen(true);
  };

  const applyMaker = (footprint) => {
    if (!selected) return;
    const base = makerRoom || selected;
    patchSelected({
      ...footprint,
      name: base.name,
      category: base.category,
      w: base.w,
      h: base.h,
      environment: base.environment,
      elevation: base.elevation,
      cover: base.cover,
      connector: base.connector,
      traps: [...(base.traps || [])],
      spawns: [...(base.spawns || [])],
      loot: [...(base.loot || [])],
      notes: base.notes,
      cr0Only: !!base.cr0Only,
      bonfire: !!base.bonfire,
    });
    setMakerRoom((room) => ({ ...(room || base), ...footprint }));
    toast.success("Room Maker applied to the selected room.");
  };

  const uploadMaker = (footprint) => {
    const baseRoom =
      selected && makerRoom?.id === selected.id ? selected : makerRoom || selected;
    const room = { ...baseRoom, ...footprint };
    if (!room?.name && !room?.category) return;
    const id = makerTemplateId || `room${Date.now().toString(36)}`;
    setSettings((s) => {
      const list = [...(s.library.dungeonRooms || [])];
      const template = {
        id,
        name: room.name || "New Room",
        category: room.category || "Chamber",
        minW: room.w,
        maxW: room.w,
        minH: room.h,
        maxH: room.h,
        environment: room.environment || "",
        elevation: room.elevation || "Flat",
        cover: room.cover || "Open",
        connector: room.connector || "Doorway",
        traps: [...(room.traps || [])],
        spawns: [...(room.spawns || [])],
        loot: [...(room.loot || [])],
        notes: room.notes || "",
        cr0Only: !!room.cr0Only,
        bonfire: !!room.bonfire,
        enabled: true,
        shape: footprint.shape,
        cells: footprint.cells,
        spawnPoints: footprint.spawnPoints,
        ingressPoints: footprint.ingressPoints,
        harvest: [...(room.harvest || [])],
      };
      const i = list.findIndex((t) => t.id === id);
      if (i >= 0) list[i] = { ...list[i], ...template };
      else list.push(template);
      return { ...s, library: { ...s.library, dungeonRooms: list } };
    });
    setMakerTemplateId(id);
    toast.success("Room uploaded to Reference Library → Dungeon Rooms.");
  };

  const addMakerRoom = (footprint) => {
    if (!dungeon) return;
    const maxX = Math.max(0, ...(dungeon.rooms || []).map((r) => r.x + r.w));
    const room = {
      ...(makerRoom || selected || {}),
      ...footprint,
      id: `room${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
      x: maxX + 4,
      y: 0,
      templateId: makerTemplateId || "custom-room",
      traps: [...(makerRoom?.traps || [])],
      spawns: [...(makerRoom?.spawns || [])],
      loot: [...(makerRoom?.loot || [])],
      harvest: [...(makerRoom?.harvest || [])],
    };
    commit({ ...dungeon, rooms: [...dungeon.rooms, room] });
    setSelectedId(room.id);
    setMakerRoom(room);
    toast.success("Room added to the dungeon.");
  };

  const generate = () => {
    if (!roomTemplates.length) {
      toast.error("Enable at least one room in Reference Library → Dungeon Rooms.");
      return;
    }
    const d = generateDungeon({
      mode,
      rank,
      seed: seed.trim() || randomSeed(),
      templates: roomTemplates,
      monsters,
      lootPools,
    });
    const scaled = scaleEncounters(d, {
      players,
      partyLevel,
      monsters,
      rank,
    });
    const rooms = (scaled.rooms || []).map((r) => ({
      ...r,
      traps: includeTraps ? r.traps : [],
      spawns: includeSpawns ? r.spawns : [],
      loot: includeLoot ? r.loot : [],
    }));
    pastRef.current = [];
    futureRef.current = [];
    setDungeon({ ...scaled, rooms });
    setSeed(d.seed);
    setSelectedId(rooms[0]?.id || null);
    toast.success(
      `${rankInfo.nickname} ${mode === "spire" ? "spire" : "dungeon"} generated${
        includeSpawns ? ` · target CR ${scaled.encounterScale?.targetCR || "?"}` : ""
      }.`
    );
  };

  const save = () => {
    if (!dungeon) return;
    setSettings((s) => {
      const list = Array.isArray(s.library.dungeons) ? [...s.library.dungeons] : [];
      const i = list.findIndex((d) => d.id === dungeon.id);
      if (i >= 0) list[i] = dungeon;
      else list.push(dungeon);
      return { ...s, library: { ...s.library, dungeons: list } };
    });
    setSavedId(dungeon.id);
    toast.success("Dungeon saved with the project.");
  };

  const load = (id) => {
    const d = saved.find((x) => x.id === id);
    if (!d) return;
    pastRef.current = [];
    futureRef.current = [];
    setDungeon(d);
    setMode(d.mode || "single");
    setRank(d.rank || "E");
    setSeed(d.seed || "");
    if (d.encounterScale?.players) setPlayers(d.encounterScale.players);
    if (d.encounterScale?.partyLevel) setPartyLevel(d.encounterScale.partyLevel);
    setSavedId(id);
    setSelectedId(d.rooms?.[0]?.id || null);
  };

  const removeSaved = (id) => {
    setSettings((s) => ({
      ...s,
      library: {
        ...s.library,
        dungeons: (s.library.dungeons || []).filter((d) => d.id !== id),
      },
    }));
    if (savedId === id) setSavedId("");
    toast("Saved dungeon removed.");
  };

  const download = () => {
    if (!dungeon) return;
    const blob = new Blob([JSON.stringify(dungeon, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(dungeon.name || "dungeon").replace(/[^\w-]+/g, "_")}.dungeon.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const patchSelected = (patch) => {
    if (!dungeon || !selected) return;
    commit({
      ...dungeon,
      rooms: dungeon.rooms.map((r) => (r.id === selected.id ? { ...r, ...patch } : r)),
    });
  };

  const setRoute = (routeId) => {
    if (!dungeon) return;
    commit({ ...dungeon, chosenRouteId: routeId });
  };

  const removeSelected = () => {
    if (!selected) return;
    removeRoom(selected.id);
  };

  const rollRoomEncounter = (tableId) => {
    const table = encounterTables.find((t) => t.id === tableId || t.name === tableId);
    if (!table || !selected) return;
    const result = rollEncounter(table, monsters);
    patchSelected({
      spawns: result.map((r) => `${r.count}× ${r.monster}`),
      encounterTable: table.name || "",
    });
    toast(
      result.length
        ? `Rolled ${table.name}: ${result.map((r) => `${r.count}× ${r.monster}`).join(", ")}`
        : `${table.name} produced no monsters.`
    );
  };

  const saveSelectedAsTemplate = () => {
    if (!selected) return;
    const template = {
      id: `room${Date.now().toString(36)}`,
      name: selected.name,
      category: selected.category,
      minW: selected.w,
      maxW: selected.w,
      minH: selected.h,
      maxH: selected.h,
      environment: selected.environment,
      elevation: selected.elevation,
      cover: selected.cover,
      connector: selected.connector,
      traps: [...(selected.traps || [])],
      spawns: [...(selected.spawns || [])],
      loot: [...(selected.loot || [])],
      notes: selected.notes,
      cr0Only: !!selected.cr0Only,
      bonfire: !!selected.bonfire,
      enabled: true,
      shape: selected.shape || "",
      cells: Array.isArray(selected.cells)
        ? selected.cells.map(([x, y]) => [x, y])
        : undefined,
      spawnPoints: (selected.spawnPoints || []).map((p) => ({ ...p })),
      ingressPoints: (selected.ingressPoints || []).map((p) => ({ ...p })),
      harvest: [...(selected.harvest || [])],
    };
    setSettings((s) => ({
      ...s,
      library: {
        ...s.library,
        dungeonRooms: [...(s.library.dungeonRooms || []), template],
      },
    }));
    toast.success("Room added to the Reference Library's Dungeon Rooms.");
  };

  const moveRoom = (id, x, y) => {
    if (!dungeon) return;
    commit({
      ...dungeon,
      rooms: dungeon.rooms.map((r) =>
        r.id === id ? { ...r, x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) } : r
      ),
    });
  };
  const resizeRoom = (id, w, h) => {
    if (!dungeon) return;
    commit({
      ...dungeon,
      rooms: dungeon.rooms.map((r) =>
        r.id === id
          ? {
              ...r,
              w: Math.max(2, Math.min(30, Math.round(w))),
              h: Math.max(2, Math.min(30, Math.round(h))),
            }
          : r
      ),
    });
  };

  useEffect(() => {
    if (!selectedId) {
      setMakerRoom(null);
      setMakerTemplateId("");
      return;
    }
    const room = dungeon?.rooms?.find((r) => r.id === selectedId);
    if (room) {
      setMakerRoom(room);
      setMakerTemplateId(room.templateId || "");
    }
    // Only follow selection changes; edits inside the maker are local until
    // Apply/Upload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const meta = e.ctrlKey || e.metaKey;
      if (e.key === "Escape") {
        setSelectedId(null);
        return;
      }
      if (meta && (e.key === "z" || e.key === "Z")) {
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && (e.key === "y" || e.key === "Y")) {
        redo();
        return;
      }
      if (meta && (e.key === "c" || e.key === "C")) {
        copyRoom();
        return;
      }
      if (meta && (e.key === "x" || e.key === "X")) {
        cutRoom();
        return;
      }
      if (meta && (e.key === "v" || e.key === "V")) {
        pasteRoom();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          e.preventDefault();
          removeRoom(selectedId);
        }
        return;
      }
      if ((e.key === "r" || e.key === "R") && !meta) rotateRoom();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className={`flex flex-col bg-background text-foreground ${embedded ? "h-[74vh] min-h-[560px]" : "h-screen"}`}>
      <header className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-3 py-2">
        {!embedded && (
          <Button size="icon" variant="outline" className="h-8 w-8" title="Back to menu" onClick={onExit}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-base font-semibold leading-tight">
            {dungeon?.name || "Dungeon Generator"}
          </h1>
          <p className="text-[10px] text-muted-foreground">
            {dungeon
              ? `${rankInfo.nickname} · ${rankInfo.downtime} downtime · ${dungeon.mode === "spire" ? "Spire run" : "Single dungeon"}`
              : "Generate a single dungeon or a branching spire run"}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setMakerOpen((open) => !open)}>
            Room Maker
          </Button>
          <Button size="sm" variant="outline" onClick={generate}>
            <Dices className="mr-1 h-4 w-4" /> Generate
          </Button>
          <Button size="sm" variant="outline" disabled={!dungeon} onClick={save}>
            <Save className="mr-1 h-4 w-4" /> Save
          </Button>
          <Button size="sm" variant="outline" disabled={!dungeon} onClick={download}>
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 space-y-3 overflow-y-auto border-r p-3">
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Dungeon</p>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <Label className="text-[10px]">Mode</Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single dungeon</SelectItem>
                    <SelectItem value="spire">Spire run</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Rank</Label>
                <Select value={rank} onValueChange={(v) => {
                  setRank(v);
                  const first = Number(String(DUNGEON_RANKS[v]?.level || "1").match(/\d+/)?.[0] || 1);
                  setPartyLevel(Math.max(1, first));
                }}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(DUNGEON_RANKS).map((r) => (
                      <SelectItem key={r.label} value={r.label}>
                        {r.label} — {r.nickname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Label className="text-[10px]">Seed</Label>
            <div className="flex gap-1">
              <Input className="h-8" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Seed" />
              <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => setSeed(randomSeed())} title="New seed">
                <Dices className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {rankInfo.rooms} encounters · levels {rankInfo.level} · prof +{rankInfo.prof}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <Label className="text-[10px]">Players</Label>
                <Input
                  className="h-8"
                  type="number"
                  min={1}
                  max={12}
                  value={players}
                  onChange={(e) => setPlayers(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                />
              </div>
              <div>
                <Label className="text-[10px]">Party level</Label>
                <Input
                  className="h-8"
                  type="number"
                  min={0}
                  max={30}
                  value={partyLevel}
                  onChange={(e) => setPartyLevel(Math.max(0, Math.min(30, Number(e.target.value) || 0)))}
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              ~{players * 2} monsters total per combat room · rank {rank} boss CR{" "}
              {dungeon?.encounterScale?.minCR ?? rankBand.minCR}–
              {dungeon?.encounterScale?.maxCR ?? rankBand.maxCR} · minions CR{" "}
              {dungeon?.encounterScale?.minionMin ?? rankBand.minionMin}–
              {dungeon?.encounterScale?.minionMax ?? rankBand.minionMax}
            </p>
            {routes.length > 1 && (
              <div className="space-y-1 rounded border p-1.5">
                <Label className="text-[10px]">Follow route</Label>
                <Select
                  value={chosenRoute?.id || routes[0].id}
                  onValueChange={setRoute}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {routes.map((route, i) => (
                      <SelectItem key={route.id} value={route.id}>
                        {i + 1}. {route.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Boss: {chosenBoss?.name || chosenRoute?.name || "—"} · {chosenRoute?.roomIds?.length || 0} rooms
                </p>
              </div>
            )}
            <DungeonDangerPanel
              dungeon={dungeon}
              partyLevel={partyLevel}
              monsters={monsters}
              rank={rank}
            />
          </div>

          <div className="space-y-1.5 border-t pt-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Include</p>
            <label className="flex items-center justify-between text-xs">
              Traps <Switch checked={includeTraps} onCheckedChange={setIncludeTraps} />
            </label>
            <label className="flex items-center justify-between text-xs">
              Spawns <Switch checked={includeSpawns} onCheckedChange={setIncludeSpawns} />
            </label>
            <label className="flex items-center justify-between text-xs">
              Loot <Switch checked={includeLoot} onCheckedChange={setIncludeLoot} />
            </label>
          </div>

          <div className="space-y-1.5 border-t pt-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Saved dungeons</p>
            {saved.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">None saved yet.</p>
            ) : (
              <div className="space-y-1">
                <Select value={savedId} onValueChange={load}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Load a dungeon…" /></SelectTrigger>
                  <SelectContent>
                    {saved.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name || "Dungeon"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {savedId && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => removeSaved(savedId)}>
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete saved
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5 border-t pt-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Room library</p>
              <span className="text-[10px] text-muted-foreground">{roomTemplates.length}</span>
            </div>
            <Input
              className="h-7 text-xs"
              placeholder="Search rooms…"
              value={roomQuery}
              onChange={(e) => setRoomQuery(e.target.value)}
            />
            <Button size="sm" variant="outline" className="h-7 w-full text-xs" onClick={addBlankRoom}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add blank room
            </Button>
            <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
              {filteredTemplates.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => addTemplate(r)}
                  className="w-full rounded border px-1.5 py-1 text-left text-[10px] hover:bg-accent"
                  title="Add this room to the dungeon"
                >
                  <div className="truncate font-medium">{r.name}</div>
                  <div className="truncate text-muted-foreground">
                    {r.category} · {r.minW}–{r.maxW}×{r.minH}–{r.maxH}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Edit room templates in Reference Library → Dungeon Rooms.
            </p>
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-3">
          {dungeon ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                <span>{stats.rooms} rooms</span>
                {stats.sideRooms > 0 && <span>· {stats.sideRooms} side rooms</span>}
                <span>· {stats.connections} links</span>
                <span>· {stats.traps} trapped</span>
                <span>· {stats.spawns} with spawns</span>
                <span>· {stats.loot} with loot</span>
                <span>· {stats.bonfires} bonfire rest stops</span>
                {chosenBoss && <span>· following: {chosenBoss.name}</span>}
              </div>
              <div className="min-h-0 flex-1">
                <DungeonMap
                  dungeon={dungeon}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onMoveRoom={moveRoom}
                  onResizeRoom={resizeRoom}
                  onContextMenu={setCtxMenu}
                  highlightIds={chosenRoute?.roomIds || []}
                  highlightConnectionIds={chosenRoute?.connectionIds || []}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DUNGEON_CATEGORIES.map(([cat, color]) => (
                  <span key={cat} className="inline-flex items-center gap-1 rounded bg-muted/50 px-1.5 py-0.5 text-[9px]">
                    <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                    {cat}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-md border border-dashed p-8 text-center">
              <p className="text-sm font-medium">No dungeon generated</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Pick a mode and rank, then Generate. A single dungeon gives a connected sequence with branches;
                a spire run gives a branching Slay-the-Spire-style map.
              </p>
              <Button onClick={generate}>
                <Dices className="mr-1 h-4 w-4" /> Generate dungeon
              </Button>
            </div>
          )}
          {makerOpen && (
            <div className="flex h-[360px] shrink-0 flex-col rounded-md border bg-background">
              <div className="flex items-center justify-between border-b bg-muted/20 px-3 py-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Room Maker
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setMakerOpen(false)}
                >
                  Hide
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {makerRoom ? (
                  <RoomShapeBuilder
                    inline
                    room={makerRoom}
                    templates={allRoomTemplates}
                    templateId={makerTemplateId}
                    onLoadTemplate={loadMakerTemplate}
                    onSave={applyMaker}
                    onUpload={uploadMaker}
                    onAdd={addMakerRoom}
                    onOpenChange={() => setMakerOpen(false)}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Select a room on the map to edit its footprint, spawn points and ingress zones,
                    or load a room template from the Reference Library.
                  </p>
                )}
              </div>
            </div>
          )}
        </main>

        <aside className="w-80 shrink-0 overflow-y-auto border-l p-3">
          {selected ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Room</p>
                <span className="text-[10px]" style={{ color: categoryColor(selected.category) }}>
                  {selected.category}
                </span>
              </div>
              <Input className="h-8" value={selected.name} onChange={(e) => patchSelected({ name: e.target.value })} />
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <Label className="text-[10px]">Category</Label>
                  <Select value={selected.category} onValueChange={(v) => patchSelected({ category: v })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DUNGEON_CATEGORIES.map(([cat]) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px]">Connector</Label>
                  <Select value={selected.connector || "Doorway"} onValueChange={(v) => patchSelected({ connector: v })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONNECTORS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px]">Width (spaces)</Label>
                  <Input type="number" min={2} max={20} className="h-8" value={selected.w} onChange={(e) => patchSelected({ w: Math.max(2, Math.min(20, Number(e.target.value) || 2)) })} />
                </div>
                <div>
                  <Label className="text-[10px]">Height (spaces)</Label>
                  <Input type="number" min={2} max={20} className="h-8" value={selected.h} onChange={(e) => patchSelected({ h: Math.max(2, Math.min(20, Number(e.target.value) || 2)) })} />
                </div>
              </div>
              <div>
                <Label className="text-[10px]">Environment</Label>
                <Input className="h-8" value={selected.environment || ""} onChange={(e) => patchSelected({ environment: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <Label className="text-[10px]">Elevation</Label>
                  <Input className="h-8" value={selected.elevation || ""} onChange={(e) => patchSelected({ elevation: e.target.value })} />
                </div>
                <div>
                  <Label className="text-[10px]">Cover</Label>
                  <Input className="h-8" value={selected.cover || ""} onChange={(e) => patchSelected({ cover: e.target.value })} />
                </div>
              </div>
              {encounterTables.length > 0 && (
                <div>
                  <Label className="text-[10px]">Roll encounter table into spawns</Label>
                  <Select value="" onValueChange={rollRoomEncounter}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Choose a table…" />
                    </SelectTrigger>
                    <SelectContent>
                      {encounterTables.map((t, i) => (
                        <SelectItem key={t.id || `${t.name}-${i}`} value={t.id || t.name}>
                          {t.name || "Encounter table"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selected.encounterTable && (
                    <p className="mt-0.5 text-[9px] text-muted-foreground">
                      Last rolled: {selected.encounterTable}
                    </p>
                  )}
                </div>
              )}
              {[
                ["traps", "Traps (one per line)"],
                ["spawns", "Enemy spawns / placement"],
                ["loot", "Loot (not on a creature)"],
                ["harvest", "Harvestable materials (one per line)"],
              ].map(([key, label]) => (
                <div key={key}>
                  <Label className="text-[10px]">{label}</Label>
                  <Textarea
                    className="min-h-14 text-xs"
                    rows={2}
                    value={lines(selected[key])}
                    onChange={(e) => patchSelected({ [key]: split(e.target.value) })}
                  />
                </div>
              ))}
              <div>
                <Label className="text-[10px]">Notes</Label>
                <Textarea
                  className="min-h-14 text-xs"
                  rows={2}
                  value={selected.notes || ""}
                  onChange={(e) => patchSelected({ notes: e.target.value })}
                />
              </div>
              <label className="flex items-center justify-between rounded border px-2 py-1 text-[10px]">
                CR 0 creatures only (animal den)
                <Switch
                  checked={!!selected.cr0Only}
                  onCheckedChange={(v) => patchSelected({ cr0Only: v })}
                />
              </label>
              <div className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-[10px]">
                <div>
                  <p className="font-medium">
                    {selected.shape && selected.shape !== "Custom" ? selected.shape : "Footprint"}
                    {Array.isArray(selected.cells) ? ` · ${selected.cells.length} cells` : " · rectangle"}
                    {selected.spawnPoints?.length ? ` · ${selected.spawnPoints.length} spawns` : ""}
                    {selected.ingressPoints?.length ? ` · ${selected.ingressPoints.length} ingress` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    {selected.bonfire
                      ? "Bonfire safe zone · short rest"
                      : "Carve diamond, circular, T-shaped, irregular or painted footprints."}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={() => openMaker(selected.id)}>
                  Room Maker
                </Button>
              </div>
              <RoomBattleMap room={selected} />
              <div className="flex flex-wrap gap-1.5 border-t pt-2">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={saveSelectedAsTemplate}>
                  Save as room template
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={rotateRoom}>
                  Rotate 90°
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={removeSelected}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove room
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Select a room on the map to edit its size, environment, elevation, cover, traps, spawns and loot.
            </p>
          )}
        </aside>
      </div>

      {ctxMenu && (
        <div
          className="fixed inset-0 z-50"
          onPointerDown={() => setCtxMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setCtxMenu(null);
          }}
        >
          <div
            className="fixed z-50 w-52 rounded-md border bg-popover p-1 text-xs shadow-lg"
            style={{
              left: Math.min(ctxMenu.x, window.innerWidth - 220),
              top: Math.min(ctxMenu.y, window.innerHeight - 300),
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {ctxRoom ? (
              <>
                <div className="truncate px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {ctxRoom.name}
                </div>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1 text-left hover:bg-accent"
                  onClick={() => {
                    setSelectedId(ctxRoom.id);
                    setCtxMenu(null);
                  }}
                >
                  Edit room
                </button>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1 text-left hover:bg-accent"
                  onClick={() => openMaker(ctxRoom.id)}
                >
                  Room Maker — shape, spawns, ingress…
                </button>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1 text-left hover:bg-accent"
                  onClick={() => duplicateRoom(ctxRoom.id)}
                >
                  Duplicate room
                </button>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1 text-left hover:bg-accent"
                  onClick={() => {
                    setSelectedId(ctxRoom.id);
                    copyRoom(ctxRoom.id);
                    setCtxMenu(null);
                  }}
                >
                  Copy room
                </button>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1 text-left hover:bg-accent"
                  onClick={() => {
                    setSelectedId(ctxRoom.id);
                    cutRoom(ctxRoom.id);
                    setCtxMenu(null);
                  }}
                >
                  Cut room
                </button>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1 text-left hover:bg-accent"
                  onClick={() => {
                    setSelectedId(ctxRoom.id);
                    rotateRoom(ctxRoom.id);
                    setCtxMenu(null);
                  }}
                >
                  Rotate 90°
                </button>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1 text-left hover:bg-accent"
                  onClick={() => addConnectedRoom(ctxRoom.id)}
                >
                  Add connected room
                </button>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1 text-left hover:bg-accent"
                  onClick={() => connectNearest(ctxRoom.id)}
                >
                  Connect to nearest room
                </button>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1 text-left text-destructive hover:bg-accent"
                  onClick={() => {
                    removeRoom(ctxRoom.id);
                    setCtxMenu(null);
                  }}
                >
                  Delete room
                </button>
              </>
            ) : (
              <button
                type="button"
                className="w-full rounded px-2 py-1 text-left hover:bg-accent"
                onClick={() => addRoomAt(ctxMenu.world)}
              >
                Add room here
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
