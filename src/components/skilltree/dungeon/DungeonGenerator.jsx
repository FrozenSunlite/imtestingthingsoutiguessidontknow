import { useEffect, useMemo, useRef, useState } from "react";
import { useTree } from "@/lib/treeStore";
import {
  DUNGEON_CATEGORIES,
  DUNGEON_RANKS,
  categoryColor,
  generateDungeon,
  randomSeed,
  roomFromTemplate,
  scaleEncounters,
  rankChallenge,
  buildRoutes,
  dungeonBounds,
  hasCr,
} from "@/lib/dungeonGen";
import { roomThreat } from "@/lib/roomThreat";
import { DungeonMap } from "@/components/skilltree/dungeon/DungeonMap";
import { RoomBattleMap } from "@/components/skilltree/dungeon/RoomBattleMap";
import { RoomShapeBuilder } from "@/components/skilltree/dungeon/RoomShapeBuilder";
import { DungeonDangerPanel } from "@/components/skilltree/dungeon/DungeonDangerPanel";
import { STARTER_DUNGEON_ROOMS } from "@/lib/dungeonRooms";
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
  minW: 9,
  maxW: 12,
  minH: 9,
  maxH: 12,
  environment: "",
  elevation: "Flat",
  cover: "Open",
  connector: "Doorway",
};

// Copy the battlefield surface fields when a room is duplicated or pasted.
const cloneSurface = (room) => ({
  heights: (room.heights || []).map((p) => (Array.isArray(p) ? [...p] : { ...p })),
  stairs: (room.stairs || []).map((p) => (Array.isArray(p) ? [...p] : { ...p })),
  coverPoints: (room.coverPoints || []).map((p) => ({ ...p })),
  trapPoints: (room.trapPoints || []).map((p) => ({ ...p })),
  water: (room.water || []).map((p) => (Array.isArray(p) ? [...p] : { ...p })),
  difficult: (room.difficult || []).map((p) => (Array.isArray(p) ? [...p] : { ...p })),
  tags: [...(room.tags || [])],
});

// Full dungeon workbench: generate a single dungeon or a branching spire run,
// edit the generated rooms, and save the result with the project. Room
// templates live in the Reference Library's new Dungeon Rooms tab.
export function DungeonGenerator({ onExit, embedded = false }) {
  const { settings, setSettings } = useTree();
  const allRoomTemplates = settings?.library?.dungeonRooms?.length
    ? settings.library.dungeonRooms
    : STARTER_DUNGEON_ROOMS;
  const roomTemplates = allRoomTemplates.filter((r) => r.enabled !== false);
  const monsters = settings?.library?.monsters || [];
  const lootPools = settings?.library?.lootPools || [];
  const encounterTables = settings?.library?.encounterTables || [];
  const saved = settings?.library?.dungeons || [];
  const draft = settings?.library?.dungeonDraft || null;

  const [mode, setMode] = useState(draft?.mode || "single");
  const [rank, setRank] = useState(draft?.rank || "E");
  const [seed, setSeed] = useState(draft?.seed || randomSeed);
  const [players, setPlayers] = useState(draft?.players || 4);
  const [partyLevel, setPartyLevel] = useState(draft?.partyLevel || 1);
  const [dungeon, setDungeon] = useState(draft?.dungeon || null);
  const [selectedId, setSelectedId] = useState(draft?.selectedId || null);
  const [includeTraps, setIncludeTraps] = useState(true);
  const [includeSpawns, setIncludeSpawns] = useState(true);
  const [includeLoot, setIncludeLoot] = useState(true);
  const [requiredTags, setRequiredTags] = useState("");
  const [avoidCategories, setAvoidCategories] = useState([]);
  const [monsterSource, setMonsterSource] = useState(draft?.monsterSource || "random");
  const [customMonsters, setCustomMonsters] = useState(
    () => new Set(draft?.customMonsters || [])
  );
  const [encounterTableId, setEncounterTableId] = useState(draft?.encounterTableId || "");
  const [monsterQuery, setMonsterQuery] = useState("");
  const [sessionMode, setSessionMode] = useState(false);
  const mapCaptureRef = useRef(null);
  const draftLoadedRef = useRef(false);
  const [savedId, setSavedId] = useState("");
  const [roomQuery, setRoomQuery] = useState("");
  const [makerOpen, setMakerOpen] = useState(true);
  const [makerMax, setMakerMax] = useState(false);
  const [makerRoom, setMakerRoom] = useState(null);
  const [makerTemplateId, setMakerTemplateId] = useState("");
  const [ctxMenu, setCtxMenu] = useState(null);
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const clipRef = useRef(null);

  // Hydrate a persisted draft once, then keep it current so leaving the Builder
  // and coming back does not lose the dungeon.
  useEffect(() => {
    if (draftLoadedRef.current) return;
    const savedDraft = settings?.library?.dungeonDraft;
    if (!savedDraft) {
      draftLoadedRef.current = true;
      return;
    }
    if (savedDraft.dungeon) {
      setDungeon(savedDraft.dungeon);
      setMode(savedDraft.mode || "single");
      setRank(savedDraft.rank || "E");
      setSeed(savedDraft.seed || randomSeed());
      setPlayers(savedDraft.players || 4);
      setPartyLevel(savedDraft.partyLevel || 1);
      setSelectedId(savedDraft.selectedId || savedDraft.dungeon.rooms?.[0]?.id || null);
      setMonsterSource(savedDraft.monsterSource || "random");
      setCustomMonsters(new Set(savedDraft.customMonsters || []));
      setEncounterTableId(savedDraft.encounterTableId || "");
    }
    draftLoadedRef.current = true;
  }, [settings?.library?.dungeonDraft]);

  useEffect(() => {
    if (!dungeon) return undefined;
    setSettings((s) => ({
      ...s,
      library: {
        ...s.library,
        dungeonDraft: {
          dungeon,
          selectedId,
          mode,
          rank,
          seed,
          players,
          partyLevel,
          monsterSource,
          customMonsters: [...customMonsters],
          encounterTableId,
        },
      },
    }));
    return undefined;
  }, [
    dungeon,
    selectedId,
    mode,
    rank,
    seed,
    players,
    partyLevel,
    monsterSource,
    customMonsters,
    encounterTableId,
    setSettings,
  ]);

  const selected = dungeon?.rooms?.find((r) => r.id === selectedId) || null;
  const threat = selected ? roomThreat(selected, monsters, partyLevel, players) : null;
  const ctxRoom = ctxMenu?.roomId
    ? dungeon?.rooms?.find((r) => r.id === ctxMenu.roomId) || null
    : null;
  const routes = dungeon?.routes || [];
  const chosenRoute =
    routes.find((r) => r.id === dungeon?.chosenRouteId) || routes[0] || null;
  const chosenBoss = dungeon?.rooms?.find((r) => r.id === chosenRoute?.bossId) || null;
  const sessionVisited = dungeon?.session?.visited || [];
  const sessionRoom =
    dungeon?.rooms?.find((r) => r.id === dungeon.session?.currentRoomId) || null;
  const rankInfo = DUNGEON_RANKS[rank] || DUNGEON_RANKS.E;
  const rankBand = rankChallenge(rank);
  const selectedEncounterTable =
    encounterTables.find(
      (table) => table.id === encounterTableId || table.name === encounterTableId
    ) || null;
  const eligibleMonsters = monsters.filter(
    (monster) => hasCr(monster.cr) && !monster.dungeonExempt
  );
  const customOptions = eligibleMonsters
    .filter((monster) =>
      `${monster.name} ${monster.type || ""} ${monster.category || ""}`
        .toLowerCase()
        .includes(monsterQuery.trim().toLowerCase())
    )
    .slice(0, 150);
  const filteredTemplates = roomTemplates.filter((r) => {
    const q = roomQuery.trim().toLowerCase();
    return !q || `${r.name} ${r.category}`.toLowerCase().includes(q);
  });
  const stats = useMemo(() => {
    const rooms = dungeon?.rooms || [];
    return {
      rooms: rooms.filter((r) => !r.side && !r.hall).length,
      sideRooms: rooms.filter((r) => r.side).length,
      halls: rooms.filter((r) => r.hall).length,
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
      ...cloneSurface(src),
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
  const rerollRoom = (id = selectedId) => {
    if (!dungeon) return;
    const room = dungeon.rooms.find((r) => r.id === id);
    if (!room) return;
    const pool = roomTemplates.filter((t) => t.category === room.category);
    const source = pool.length ? pool : roomTemplates;
    if (!source.length) return;
    const template = source[Math.floor(Math.random() * source.length)];
    const fresh = roomFromTemplate(template, { x: room.x, y: room.y });
    const next = {
      ...fresh,
      id: room.id,
      x: room.x,
      y: room.y,
      locked: room.locked,
      branch: room.branch,
      parentId: room.parentId,
      side: room.side,
      combat: room.combat,
      name: fresh.name || room.name,
    };
    commit({
      ...dungeon,
      rooms: dungeon.rooms.map((r) => (r.id === room.id ? next : r)),
    });
    setMakerRoom(next);
    setCtxMenu(null);
    toast.success(`Rerolled ${next.name}.`);
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
      harvest: [...(src.harvest || [])],
      ...cloneSurface(src),
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
      x: Math.round(world.x),
      y: Math.round(world.y),
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
      harvest: [...(base.harvest || [])],
      notes: base.notes,
      description: base.description || "",
      environmentEffect: base.environmentEffect || "",
      tags: [...(base.tags || [])],
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
        description: room.description || "",
        environmentEffect: room.environmentEffect || "",
        tags: [...(room.tags || [])],
        cr0Only: !!room.cr0Only,
        bonfire: !!room.bonfire,
        enabled: true,
        shape: footprint.shape,
        cells: footprint.cells,
        spawnPoints: footprint.spawnPoints,
        ingressPoints: footprint.ingressPoints,
        heights: (footprint.heights || []).map((p) => (Array.isArray(p) ? [...p] : { ...p })),
        stairs: (footprint.stairs || []).map((p) => ({ ...p })),
        coverPoints: (footprint.coverPoints || []).map((p) => ({ ...p })),
        trapPoints: (footprint.trapPoints || []).map((p) => ({ ...p })),
        water: (footprint.water || []).map((p) => [...p]),
        difficult: (footprint.difficult || []).map((p) => [...p]),
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
      ...cloneSurface(footprint),
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
    if (monsterSource === "custom" && customMonsters.size === 0) {
      toast.error("Pick at least one custom monster, or switch the monster source to Random.");
      return;
    }
    if (monsterSource === "table" && !selectedEncounterTable) {
      toast.error("Choose an encounter table first.");
      return;
    }
    const d = generateDungeon({
      mode,
      rank,
      seed: seed.trim() || randomSeed(),
      templates: roomTemplates,
      monsters,
      lootPools,
      players,
      requiredTags: requiredTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      avoidCategories,
    });
    const encounterPool =
      monsterSource === "custom"
        ? monsters.filter((monster) => customMonsters.has(monster.name))
        : monsters;
    const scaled = scaleEncounters(d, {
      players,
      partyLevel,
      monsters: encounterPool,
      rank,
      countMultiplier: mode === "spire" ? 2 : 1,
      bossCR: partyLevel,
      encounterTable: monsterSource === "table" ? selectedEncounterTable : null,
    });
    const rooms = (scaled.rooms || []).map((r) => ({
      ...r,
      traps: includeTraps ? r.traps : [],
      spawns: includeSpawns ? r.spawns : [],
      loot: includeLoot ? r.loot : [],
    }));
    // Locked rooms survive a reroll. They keep their position and terrain and
    // are reattached to the nearest newly generated room if their old links
    // no longer exist.
    const locked = (dungeon?.rooms || []).filter((r) => r.locked);
    const mergedRooms = [...rooms];
    locked.forEach((room) => {
      if (!mergedRooms.some((r) => r.id === room.id)) mergedRooms.push(room);
    });
    const mergedConnections = [...(scaled.connections || [])];
    locked.forEach((room) => {
      if (mergedConnections.some((c) => c.from === room.id || c.to === room.id)) return;
      const nearest = mergedRooms
        .filter((r) => !r.locked)
        .sort((a, b) => {
          const da = (a.x + a.w / 2 - room.x - room.w / 2) ** 2 + (a.y + a.h / 2 - room.y - room.h / 2) ** 2;
          const db = (b.x + b.w / 2 - room.x - room.w / 2) ** 2 + (b.y + b.h / 2 - room.y - room.h / 2) ** 2;
          return da - db;
        })[0];
      if (nearest) {
        mergedConnections.push({
          id: `${nearest.id}->${room.id}`,
          from: nearest.id,
          to: room.id,
          type: "Side passage",
        });
      }
    });
    const nextRoutes = buildRoutes(mergedRooms, mergedConnections);
    const nextDungeon = {
      ...scaled,
      rooms: mergedRooms,
      connections: mergedConnections,
      routes: nextRoutes,
      chosenRouteId: nextRoutes[0]?.id || scaled.chosenRouteId || "",
    };
    pastRef.current = [];
    futureRef.current = [];
    setDungeon(nextDungeon);
    setSeed(d.seed);
    setSelectedId(mergedRooms[0]?.id || null);
    setSettings((s) => ({ ...s, projectStarted: true }));
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

  const downloadDataUrl = (dataUrl, name) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = name;
    a.click();
  };

  const captureMap = async () => {
    if (!mapCaptureRef.current) return "";
    const node = mapCaptureRef.current;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(node, {
        backgroundColor: "#0b0f15",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      return canvas.toDataURL("image/png");
    } catch {
      // Fallback: draw the SVG itself. This keeps map export working even when
      // the HTML rasterizer chokes on a stylesheet feature.
      const svg = node.querySelector("svg");
      if (!svg) return "";
      const rect = svg.getBoundingClientRect();
      const clone = svg.cloneNode(true);
      clone.setAttribute("width", rect.width);
      clone.setAttribute("height", rect.height);
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
      const computed = getComputedStyle(document.documentElement);
      const vars = [
        "--primary",
        "--primary-foreground",
        "--foreground",
        "--muted-foreground",
        "--background",
        "--destructive",
        "--accent",
        "--border",
        "--muted",
      ];
      style.textContent = `svg{${vars
        .map((name) => `${name}:${computed.getPropertyValue(name) || "#888"}`)
        .join(";")}}`;
      clone.insertBefore(style, clone.firstChild);
      const xml = new XMLSerializer().serializeToString(clone);
      const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(rect.width * 2));
      canvas.height = Math.max(1, Math.round(rect.height * 2));
      const ctx = canvas.getContext("2d");
      ctx.scale(2, 2);
      ctx.fillStyle = "#0b0f15";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.drawImage(image, 0, 0, rect.width, rect.height);
      return canvas.toDataURL("image/png");
    }
  };

  const exportMapPng = async () => {
    if (!dungeon) return;
    try {
      const dataUrl = await captureMap();
      if (!dataUrl) {
        toast.error("Could not capture the map.");
        return;
      }
      downloadDataUrl(dataUrl, `${(dungeon.name || "dungeon").replace(/[^\w-]+/g, "_")}.png`);
      toast.success("Map PNG exported.");
    } catch {
      toast.error("Could not export the map as PNG.");
    }
  };

  const exportMapPdf = async () => {
    if (!dungeon) return;
    const dataUrl = await captureMap();
    if (!dataUrl) {
      toast.error("Could not capture the map.");
      return;
    }
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const props = pdf.getImageProperties(dataUrl);
    const maxW = pageW - 48;
    const maxH = pageH - 90;
    const scale = Math.min(maxW / props.width, maxH / props.height);
    const imgW = props.width * scale;
    const imgH = props.height * scale;
    pdf.setFontSize(15);
    pdf.text(String(dungeon.name || "Dungeon"), 24, 30);
    pdf.setFontSize(9);
    pdf.text(
      `${dungeon.rank || ""} - ${(dungeon.rooms || []).length} rooms - ${dungeon.seed || ""}`,
      24,
      44
    );
    pdf.addImage(dataUrl, "PNG", (pageW - imgW) / 2, 58, imgW, imgH);
    pdf.addPage("a4", "portrait");
    pdf.setFontSize(15);
    pdf.text(String(dungeon.name || "Dungeon") + " - DM notes", 28, 36);
    let y = 58;
    pdf.setFontSize(9);
    (dungeon.rooms || []).forEach((room) => {
      const lines = [
        `${room.name} [${room.category}] ${room.w}x${room.h}`,
        room.description || room.notes || "",
        room.spawns?.length ? `Spawns: ${room.spawns.join("; ")}` : "",
        room.traps?.length ? `Traps: ${room.traps.join("; ")}` : "",
        room.loot?.length ? `Loot: ${room.loot.join("; ")}` : "",
      ].filter(Boolean);
      lines.forEach((line) => {
        const wrapped = pdf.splitTextToSize(line, pageW - 56);
        if (y + wrapped.length * 12 > pageH - 30) {
          pdf.addPage("a4", "portrait");
          y = 36;
        }
        pdf.text(wrapped, 28, y);
        y += wrapped.length * 12;
      });
      y += 6;
    });
    pdf.save(`${(dungeon.name || "dungeon").replace(/[^\w-]+/g, "_")}.pdf`);
    toast.success("Dungeon PDF exported.");
  };

  const exportUniversalVtt = async () => {
    if (!dungeon) return;
    const dataUrl = await captureMap();
    if (!dataUrl) {
      toast.error("Could not capture the map.");
      return;
    }
    const bounds = dungeonBounds(dungeon);
    const byId = new Map((dungeon.rooms || []).map((r) => [r.id, r]));
    const portals = (dungeon.connections || [])
      .map((connection) => {
        const from = byId.get(connection.from);
        const to = byId.get(connection.to);
        if (!from || !to) return null;
        const x1 = from.x + from.w / 2;
        const y1 = from.y + from.h / 2;
        const x2 = to.x + to.w / 2;
        const y2 = to.y + to.h / 2;
        return {
          position: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 },
          bounds: [
            { x: x1, y: y1 },
            { x: x2, y: y2 },
          ],
          rotation: 0,
          closed: false,
        };
      })
      .filter(Boolean);
    const objects = (dungeon.rooms || [])
      .filter((room) => room.bonfire || room.loot?.length || room.harvest?.length)
      .map((room) => ({
        position: { x: room.x + room.w / 2, y: room.y + room.h / 2 },
        rotation: 0,
        scale: 1,
        hidden: false,
        locked: false,
        name: room.name,
        type: room.bonfire ? "bonfire" : room.loot?.length ? "loot" : "harvest",
      }));
    const payload = {
      format: 0.3,
      resolution: {
        map_origin: { x: 0, y: 0 },
        map_size: { x: Math.max(1, bounds.w), y: Math.max(1, bounds.h) },
        pixels_per_grid: 70,
      },
      line_of_sight: [],
      objects,
      portals,
      environment: { baked_lighting: false, ambient_light: "ffffff" },
      image: dataUrl,
    };
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(dungeon.name || "dungeon").replace(/[^\w-]+/g, "_")}.dd2vtt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Universal VTT exported.");
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

  const openSessionRoom = (id) => {
    setSelectedId(id);
    if (!dungeon || !sessionMode || !id) return;
    const visited = new Set(dungeon.session?.visited || []);
    if (dungeon.session?.currentRoomId === id && visited.has(id)) return;
    visited.add(id);
    commit({
      ...dungeon,
      session: {
        ...(dungeon.session || {}),
        currentRoomId: id,
        visited: [...visited],
      },
    });
  };

  const revealAllRooms = () => {
    if (!dungeon) return;
    commit({
      ...dungeon,
      session: {
        ...(dungeon.session || {}),
        visited: (dungeon.rooms || []).map((r) => r.id),
      },
    });
  };

  const resetSession = () => {
    if (!dungeon) return;
    commit({ ...dungeon, session: { currentRoomId: "", visited: [] } });
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
      description: selected.description || "",
      environmentEffect: selected.environmentEffect || "",
      tags: [...(selected.tags || [])],
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
      ...cloneSurface(selected),
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
    const room = dungeon.rooms.find((r) => r.id === id);
    const nextX = Math.round(x);
    const nextY = Math.round(y);
    if (room && room.x === nextX && room.y === nextY) {
      return;
    }
    commit({
      ...dungeon,
      rooms: dungeon.rooms.map((r) =>
        r.id === id ? { ...r, x: nextX, y: nextY } : r
      ),
    });
  };
  const resizeRoom = (id, w, h) => {
    if (!dungeon) return;
    const room = dungeon.rooms.find((r) => r.id === id);
    const nextW = Math.max(9, Math.min(33, Math.round(w)));
    const nextH = Math.max(9, Math.min(33, Math.round(h)));
    if (room && room.w === nextW && room.h === nextH) return;
    commit({
      ...dungeon,
      rooms: dungeon.rooms.map((r) =>
        r.id === id
          ? {
              ...r,
              w: nextW,
              h: nextH,
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
            {dungeon?.name || "Dungeon Builder"}
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
          <Button size="sm" variant="outline" disabled={!dungeon} onClick={exportMapPng} title="Export the map as a PNG">
            PNG
          </Button>
          <Button size="sm" variant="outline" disabled={!dungeon} onClick={exportMapPdf} title="Export a printable map + DM notes PDF">
            PDF
          </Button>
          <Button size="sm" variant="outline" disabled={!dungeon} onClick={exportUniversalVtt} title="Export a Universal VTT (.dd2vtt) for Foundry/Roll20">
            VTT
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
                <Label className="text-[10px]">Highest party level</Label>
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
              ~{players * 2 * (mode === "spire" ? 2 : 1)} monsters total per combat room · rank {rank} boss CR{" "}
              {dungeon?.encounterScale?.bossCR ?? partyLevel} · minions CR{" "}
              {dungeon?.encounterScale?.minionMin ?? rankBand.minionMin}-
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
              currency={settings?.rewardCurrency || "gp"}
              onCurrencyChange={(value) =>
                setSettings((s) => ({ ...s, rewardCurrency: value }))
              }
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
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Generation constraints</p>
            <Input
              className="h-7 text-xs"
              placeholder="Required themes/tags (comma separated)"
              value={requiredTags}
              onChange={(e) => setRequiredTags(e.target.value)}
            />
            <p className="text-[9px] text-muted-foreground">Avoid categories</p>
            <div className="flex flex-wrap gap-1">
              {DUNGEON_CATEGORIES.filter(([cat]) => !["Start", "Boss"].includes(cat)).map(([cat]) => {
                const active = avoidCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`rounded border px-1 py-0.5 text-[9px] ${
                      active ? "border-destructive bg-destructive/15 text-destructive" : "text-muted-foreground"
                    }`}
                    onClick={() =>
                      setAvoidCategories((prev) =>
                        prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                      )
                    }
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5 border-t pt-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Monster source</p>
            <Select value={monsterSource} onValueChange={setMonsterSource}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="random">Random (CR band)</SelectItem>
                <SelectItem value="custom">Custom list</SelectItem>
                <SelectItem value="table">Encounter table</SelectItem>
              </SelectContent>
            </Select>
            {monsterSource === "custom" && (
              <>
                <Input
                  className="h-7 text-xs"
                  placeholder="Filter monsters…"
                  value={monsterQuery}
                  onChange={(e) => setMonsterQuery(e.target.value)}
                />
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1 text-[9px]"
                    onClick={() =>
                      setCustomMonsters((prev) => {
                        const next = new Set(prev);
                        customOptions.forEach((monster) => next.add(monster.name));
                        return next;
                      })
                    }
                  >
                    Select visible
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1 text-[9px]"
                    onClick={() => setCustomMonsters(new Set())}
                  >
                    Clear
                  </Button>
                  <span className="text-[9px] text-muted-foreground">
                    {customMonsters.size} selected
                  </span>
                </div>
                <div className="max-h-40 space-y-0.5 overflow-y-auto rounded border p-1">
                  {customOptions.map((monster) => (
                    <label
                      key={monster.name}
                      className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] hover:bg-accent/50"
                    >
                      <input
                        type="checkbox"
                        checked={customMonsters.has(monster.name)}
                        onChange={() =>
                          setCustomMonsters((prev) => {
                            const next = new Set(prev);
                            if (next.has(monster.name)) next.delete(monster.name);
                            else next.add(monster.name);
                            return next;
                          })
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">{monster.name}</span>
                      <span className="shrink-0 text-muted-foreground">CR {monster.cr}</span>
                    </label>
                  ))}
                  {customOptions.length === 0 && (
                    <p className="p-1 text-[10px] text-muted-foreground">No eligible monsters.</p>
                  )}
                </div>
                <p className="text-[9px] text-muted-foreground">
                  Only creatures with a CR are listed; exempt creatures are hidden.
                </p>
              </>
            )}
            {monsterSource === "table" && (
              <>
                <Select value={encounterTableId} onValueChange={setEncounterTableId}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Choose an encounter table…" />
                  </SelectTrigger>
                  <SelectContent>
                    {encounterTables.map((table) => (
                      <SelectItem key={table.id || table.name} value={table.id || table.name}>
                        {table.name || "Encounter table"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[9px] text-muted-foreground">
                  Pulls monsters from the table up to each room's encounter limit. Halls stay monster-free.
                </p>
              </>
            )}
            <p className="text-[9px] text-muted-foreground">
              Missing CR values are ignored. Unique creatures appear only as a Mini Boss or Boss,
              and only once.
            </p>
          </div>

          <div className="space-y-1.5 border-t pt-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">DM session</p>
            <label className="flex items-center justify-between text-xs">
              Session / fog of war{" "}
              <Switch checked={sessionMode} onCheckedChange={setSessionMode} />
            </label>
            {sessionMode && (
              <>
                <p className="text-[10px] text-muted-foreground">
                  Current room:{" "}
                  <span className="font-medium text-foreground">
                    {sessionRoom?.name || "none — click a room"}
                  </span>
                </p>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" className="h-6 px-1 text-[9px]" onClick={revealAllRooms}>
                    Reveal all
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 px-1 text-[9px]" onClick={resetSession}>
                    Reset fog
                  </Button>
                </div>
                <div className="max-h-40 space-y-0.5 overflow-y-auto rounded border p-1">
                  {(dungeon?.rooms || []).map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => openSessionRoom(room.id)}
                      className={`flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[9px] ${
                        dungeon?.session?.currentRoomId === room.id
                          ? "bg-primary/15 font-semibold"
                          : "hover:bg-accent/60"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{room.name}</span>
                      <span className="text-muted-foreground">
                        {sessionVisited.includes(room.id) ? "seen" : "fog"}
                      </span>
                    </button>
                  ))}
                </div>
                {sessionRoom?.spawns?.length > 0 && (
                  <p className="text-[10px] text-destructive">
                    Encounter: {sessionRoom.spawns.join("; ")}
                  </p>
                )}
              </>
            )}
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
                {stats.halls > 0 && <span>· {stats.halls} halls</span>}
                {stats.sideRooms > 0 && <span>· {stats.sideRooms} side rooms</span>}
                <span>· {stats.connections} links</span>
                <span>· {stats.traps} trapped</span>
                <span>· {stats.spawns} with spawns</span>
                <span>· {stats.loot} with loot</span>
                <span>· {stats.bonfires} bonfire rest stops</span>
                {chosenBoss && <span>· following: {chosenBoss.name}</span>}
              </div>
              <div className="min-h-0 flex-1">
              <div ref={mapCaptureRef} className="min-h-0 flex-1">
                <DungeonMap
                  dungeon={dungeon}
                  selectedId={selectedId}
                  onSelect={openSessionRoom}
                  onMoveRoom={moveRoom}
                  onResizeRoom={resizeRoom}
                  onContextMenu={setCtxMenu}
                  highlightIds={chosenRoute?.roomIds || []}
                  highlightConnectionIds={chosenRoute?.connectionIds || []}
                  sessionMode={sessionMode}
                  visitedIds={sessionVisited}
                  currentRoomId={dungeon?.session?.currentRoomId || ""}
                />
              </div>
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
            <div
              className={`flex shrink-0 flex-col rounded-md border bg-background ${
                makerMax ? "h-[calc(100vh-1.5rem)]" : "h-[min(72vh,820px)] min-h-[420px]"
              }`}
            >
              <div className="flex items-center justify-between border-b bg-muted/20 px-3 py-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Room Maker
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setMakerMax((value) => !value)}
                >
                  {makerMax ? "Restore" : "Maximize"}
                </Button>
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
                  <Input type="number" min={9} max={33} className="h-8" value={selected.w} onChange={(e) => patchSelected({ w: Math.max(9, Math.min(33, Number(e.target.value) || 9)) })} />
                </div>
                <div>
                  <Label className="text-[10px]">Height (spaces)</Label>
                  <Input type="number" min={9} max={33} className="h-8" value={selected.h} onChange={(e) => patchSelected({ h: Math.max(9, Math.min(33, Number(e.target.value) || 9)) })} />
                </div>
              </div>
              <div>
                <Label className="text-[10px]">Environment</Label>
                <Input className="h-8" value={selected.environment || ""} onChange={(e) => patchSelected({ environment: e.target.value })} />
              </div>
              <div>
                <Label className="text-[10px]">Description / read-aloud</Label>
                <Textarea
                  className="min-h-12 text-xs"
                  rows={2}
                  placeholder="What the party sees and how the room plays…"
                  value={selected.description || ""}
                  onChange={(e) => patchSelected({ description: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-[10px]">Environment effect</Label>
                <Input
                  className="h-8"
                  placeholder="Unstable ground: difficult terrain…"
                  value={selected.environmentEffect || ""}
                  onChange={(e) => patchSelected({ environmentEffect: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-[10px]">Tags (comma separated)</Label>
                <Input
                  className="h-8"
                  placeholder="chokepoint, half cover"
                  value={(selected.tags || []).join(", ")}
                  onChange={(e) =>
                    patchSelected({
                      tags: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
              <label className="flex items-center justify-between rounded border px-2 py-1 text-[10px]">
                <span>
                  {selected.locked
                    ? "Locked — preserved when you generate a new dungeon"
                    : "Unlocked — replaced by the next generation"}
                </span>
                <Switch
                  checked={!!selected.locked}
                  onCheckedChange={(v) => patchSelected({ locked: v })}
                />
              </label>
              {threat && (
                <div className="space-y-0.5 rounded border bg-muted/30 p-1.5 text-[10px]">
                  <p>
                    <span className="font-semibold">Room threat:</span> {threat.difficulty} ·{" "}
                    {threat.adjustedXp.toLocaleString()} XP
                  </p>
                  <p className="text-muted-foreground">
                    Party of {players} at level {partyLevel}: deadly at{" "}
                    {threat.thresholds[3].toLocaleString()} XP
                  </p>
                  {threat.unmatched.length > 0 && (
                    <p className="text-amber-700 dark:text-amber-400">
                      Unmatched spawns: {threat.unmatched.slice(0, 4).join(", ")}
                    </p>
                  )}
                </div>
              )}
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
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => rerollRoom(selected.id)}>
                  Reroll room
                </Button>
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
                  onClick={() => {
                    setSelectedId(ctxRoom.id);
                    rerollRoom(ctxRoom.id);
                  }}
                >
                  Reroll this room
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
