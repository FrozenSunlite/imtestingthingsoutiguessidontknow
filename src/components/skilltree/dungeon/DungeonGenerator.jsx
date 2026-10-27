import { useMemo, useState } from "react";
import { useTree } from "@/lib/treeStore";
import {
  DUNGEON_CATEGORIES,
  DUNGEON_RANKS,
  DEFAULT_DUNGEON_ROOMS,
  categoryColor,
  generateDungeon,
  randomSeed,
} from "@/lib/dungeonGen";
import { DungeonMap } from "@/components/skilltree/dungeon/DungeonMap";
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
import { ArrowLeft, Dices, Download, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

const lines = (arr) => (arr || []).join("\n");
const split = (text) =>
  String(text || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

const CONNECTORS = ["Doorway", "Double Door", "Gate", "Archway", "Corridor", "Bridge", "Stairs", "Rubble passage", "Rune-sealed door"];

// Full dungeon workbench: generate a single dungeon or a branching spire run,
// edit the generated rooms, and save the result with the project. Room
// templates live in the Reference Library's new Dungeon Rooms tab.
export function DungeonGenerator({ onExit, embedded = false }) {
  const { settings, setSettings } = useTree();
  const roomTemplates = settings?.library?.dungeonRooms?.length
    ? settings.library.dungeonRooms
    : DEFAULT_DUNGEON_ROOMS;
  const monsters = settings?.library?.monsters || [];
  const lootPools = settings?.library?.lootPools || [];
  const saved = settings?.library?.dungeons || [];

  const [mode, setMode] = useState("single");
  const [rank, setRank] = useState("E");
  const [seed, setSeed] = useState(randomSeed);
  const [dungeon, setDungeon] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [includeTraps, setIncludeTraps] = useState(true);
  const [includeSpawns, setIncludeSpawns] = useState(true);
  const [includeLoot, setIncludeLoot] = useState(true);
  const [savedId, setSavedId] = useState("");
  const [roomQuery, setRoomQuery] = useState("");

  const selected = dungeon?.rooms?.find((r) => r.id === selectedId) || null;
  const rankInfo = DUNGEON_RANKS[rank] || DUNGEON_RANKS.E;
  const filteredTemplates = roomTemplates.filter((r) => {
    const q = roomQuery.trim().toLowerCase();
    return !q || `${r.name} ${r.category}`.toLowerCase().includes(q);
  });
  const stats = useMemo(() => {
    const rooms = dungeon?.rooms || [];
    return {
      rooms: rooms.length,
      traps: rooms.filter((r) => (r.traps || []).length).length,
      spawns: rooms.filter((r) => (r.spawns || []).length).length,
      loot: rooms.filter((r) => (r.loot || []).length).length,
      connections: dungeon?.connections?.length || 0,
    };
  }, [dungeon]);

  const generate = () => {
    const d = generateDungeon({
      mode,
      rank,
      seed: seed.trim() || randomSeed(),
      templates: roomTemplates,
      monsters,
      lootPools,
    });
    const rooms = (d.rooms || []).map((r) => ({
      ...r,
      traps: includeTraps ? r.traps : [],
      spawns: includeSpawns ? r.spawns : [],
      loot: includeLoot ? r.loot : [],
    }));
    setDungeon({ ...d, rooms });
    setSeed(d.seed);
    setSelectedId(rooms[0]?.id || null);
    toast.success(`${rankInfo.nickname} ${mode === "spire" ? "spire" : "dungeon"} generated.`);
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
    setDungeon(d);
    setMode(d.mode || "single");
    setRank(d.rank || "E");
    setSeed(d.seed || "");
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
    setDungeon({
      ...dungeon,
      rooms: dungeon.rooms.map((r) => (r.id === selected.id ? { ...r, ...patch } : r)),
    });
  };

  const removeSelected = () => {
    if (!dungeon || !selected) return;
    setDungeon({
      ...dungeon,
      rooms: dungeon.rooms.filter((r) => r.id !== selected.id),
      connections: dungeon.connections.filter(
        (c) => c.from !== selected.id && c.to !== selected.id
      ),
    });
    setSelectedId(null);
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
                <Select value={rank} onValueChange={setRank}>
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
            <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
              {filteredTemplates.map((r) => (
                <div key={r.id} className="rounded border px-1.5 py-1 text-[10px]">
                  <div className="truncate font-medium">{r.name}</div>
                  <div className="truncate text-muted-foreground">
                    {r.category} · {r.minW}–{r.maxW}×{r.minH}–{r.maxH}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Edit room templates in Reference Library → Dungeon Rooms.
            </p>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
          {dungeon ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                <span>{stats.rooms} rooms</span>
                <span>· {stats.connections} links</span>
                <span>· {stats.traps} trapped</span>
                <span>· {stats.spawns} with spawns</span>
                <span>· {stats.loot} with loot</span>
              </div>
              <div className="min-h-0 flex-1">
                <DungeonMap dungeon={dungeon} selectedId={selectedId} onSelect={setSelectedId} />
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
              {[
                ["traps", "Traps (one per line)"],
                ["spawns", "Enemy spawns / placement"],
                ["loot", "Loot (not on a creature)"],
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
              <div className="flex flex-wrap gap-1.5 border-t pt-2">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={saveSelectedAsTemplate}>
                  Save as room template
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
    </div>
  );
}
