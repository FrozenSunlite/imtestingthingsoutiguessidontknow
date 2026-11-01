import { useMemo, useState } from "react";
import { useTree } from "@/lib/treeStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoomShapeBuilder } from "@/components/skilltree/dungeon/RoomShapeBuilder";
import { DUNGEON_CATEGORIES } from "@/lib/dungeonGen";
import { ArrowLeft, Copy, Home, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const blankRoom = (index) => ({
  id: `room_${Date.now().toString(36)}_${index}`,
  name: `Room ${index + 1}`,
  category: "Chamber",
  w: 9,
  h: 9,
  minW: 9,
  maxW: 16,
  minH: 9,
  maxH: 16,
  shape: "Rectangle",
  cells: [],
  environment: "",
  elevation: "Flat",
  cover: "Open",
  connector: "Doorway",
  environmentEffect: "",
  tags: [],
  traps: [],
  spawns: [],
  loot: [],
  harvest: [],
  objects: [],
  enabled: true,
});

// Standalone Room Builder: the same grid room maker used by the Dungeon
// Builder, saved into the room library that procedural dungeons and kingdom
// house interiors draw from. The Architect can open this page and vice versa,
// and rooms can be copied into house room templates from there.
export function RoomBuilder({ onExit, onArchitect }) {
  const { settings, setSettings } = useTree();
  const rooms = settings?.library?.dungeonRooms || [];
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState("");
  const selected = rooms[selectedIndex] || rooms[0] || null;

  const setRooms = (next) =>
    setSettings((s) => ({
      ...s,
      library: { ...s.library, dungeonRooms: next },
    }));

  const patchSelected = (patch) => {
    if (!selected) return;
    const next = [...rooms];
    next[selectedIndex] = { ...selected, ...patch };
    setRooms(next);
  };

  const addRoom = () => {
    const next = [...rooms, blankRoom(rooms.length)];
    setRooms(next);
    setSelectedIndex(next.length - 1);
    toast.success("New room added.");
  };

  const duplicateRoom = () => {
    if (!selected) return;
    const copy = {
      ...JSON.parse(JSON.stringify(selected)),
      id: `room_${Date.now().toString(36)}_${rooms.length}`,
      name: `${selected.name || "Room"} copy`,
    };
    setRooms([...rooms, copy]);
    setSelectedIndex(rooms.length);
    toast.success("Room duplicated.");
  };

  const removeRoom = () => {
    if (!selected) return;
    if (!window.confirm(`Delete “${selected.name || "this room"}” from the room library?`))
      return;
    const next = rooms.filter((_, i) => i !== selectedIndex);
    setRooms(next);
    setSelectedIndex(Math.max(0, Math.min(selectedIndex, next.length - 1)));
  };

  const shown = useMemo(
    () =>
      rooms
        .map((room, index) => ({ room, index }))
        .filter(({ room }) =>
          `${room.name || ""} ${room.category || ""}`
            .toLowerCase()
            .includes(query.trim().toLowerCase())
        ),
    [rooms, query]
  );

  const applyPayload = (payload) => {
    if (!selected) return;
    patchSelected(payload);
    toast.success("Room saved to the library.");
  };

  const addFromPayload = (payload) => {
    if (!selected) return;
    const copy = {
      ...payload,
      id: `room_${Date.now().toString(36)}_${rooms.length}`,
      name: `${selected.name || "Room"} copy`,
      category: selected.category || "Chamber",
      w: selected.w || 9,
      h: selected.h || 9,
      enabled: true,
    };
    setRooms([...rooms, copy]);
    setSelectedIndex(rooms.length);
    toast.success("Room uploaded to the library.");
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2">
        <Button size="icon" variant="outline" className="h-8 w-8" title="Back to menu" onClick={onExit}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="mr-2">
          <h1 className="font-display text-sm font-semibold">Room Builder</h1>
          <p className="text-[10px] text-muted-foreground">
            Design rooms once; dungeons and kingdom houses reuse them.
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={addRoom}>
          <Plus className="mr-1 h-4 w-4" /> New room
        </Button>
        {selected && (
          <>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={duplicateRoom}>
              <Copy className="mr-1 h-4 w-4" /> Duplicate
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive" onClick={removeRoom}>
              <Trash2 className="mr-1 h-4 w-4" /> Delete
            </Button>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Input
            className="h-8 w-48"
            placeholder="Search rooms…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onArchitect}>
            <Home className="mr-1 h-4 w-4" /> Open Architect
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-2 overflow-hidden p-2 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="min-h-0 overflow-y-auto rounded-md border p-1">
          {shown.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">
              {rooms.length ? "No matches." : "No rooms yet. Add one to begin."}
            </p>
          ) : (
            shown.map(({ room, index }) => (
              <button
                key={room.id || index}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs ${
                  index === selectedIndex ? "bg-accent font-medium" : "hover:bg-accent/50"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{room.name || "Untitled room"}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {room.category || "Chamber"}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="min-h-0 overflow-y-auto rounded-md border p-2">
          {selected ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <label className="space-y-1">
                  <Label className="text-[10px]">Room name</Label>
                  <Input
                    className="h-8"
                    value={selected.name || ""}
                    onChange={(e) => patchSelected({ name: e.target.value })}
                  />
                </label>
                <label className="space-y-1">
                  <Label className="text-[10px]">Category</Label>
                  <Select
                    value={selected.category || "Chamber"}
                    onValueChange={(v) => patchSelected({ category: v })}
                  >
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DUNGEON_CATEGORIES.map(([cat]) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="space-y-1">
                  <Label className="text-[10px]">Width (spaces)</Label>
                  <Input
                    className="h-8"
                    type="number"
                    min={9}
                    max={33}
                    value={selected.w ?? 9}
                    onChange={(e) =>
                      patchSelected({
                        w: Math.max(9, Math.min(33, Number(e.target.value) || 9)),
                      })
                    }
                  />
                </label>
                <label className="space-y-1">
                  <Label className="text-[10px]">Height (spaces)</Label>
                  <Input
                    className="h-8"
                    type="number"
                    min={9}
                    max={33}
                    value={selected.h ?? 9}
                    onChange={(e) =>
                      patchSelected({
                        h: Math.max(9, Math.min(33, Number(e.target.value) || 9)),
                      })
                    }
                  />
                </label>
                <label className="space-y-1">
                  <Label className="text-[10px]">Environment</Label>
                  <Input
                    className="h-8"
                    value={selected.environment || ""}
                    placeholder="Damp stone"
                    onChange={(e) => patchSelected({ environment: e.target.value })}
                  />
                </label>
                <label className="space-y-1">
                  <Label className="text-[10px]">Effect</Label>
                  <Input
                    className="h-8"
                    value={selected.environmentEffect || ""}
                    placeholder="Difficult terrain…"
                    onChange={(e) => patchSelected({ environmentEffect: e.target.value })}
                  />
                </label>
                <label className="space-y-1">
                  <Label className="text-[10px]">Tags</Label>
                  <Input
                    className="h-8"
                    value={(selected.tags || []).join(", ")}
                    placeholder="crypt, flooded"
                    onChange={(e) =>
                      patchSelected({
                        tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      })
                    }
                  />
                </label>
                <label className="flex items-end gap-2 pb-1 text-xs">
                  <Switch
                    checked={selected.enabled !== false}
                    onCheckedChange={(v) => patchSelected({ enabled: v })}
                  />
                  Enabled in generation
                </label>
              </div>

              <RoomShapeBuilder
                inline
                room={{ ...selected, w: selected.w || 9, h: selected.h || 9 }}
                templates={rooms}
                onLoadTemplate={(template) => {
                  const index = rooms.indexOf(template);
                  if (index >= 0) setSelectedIndex(index);
                }}
                onSave={applyPayload}
                onUpload={addFromPayload}
                onAdd={addFromPayload}
              />
              <p className="text-[10px] text-muted-foreground">
                Saved rooms are used by the Dungeon Builder's procedural generation.
                Use <strong>Open Architect</strong> to give kingdom houses a shared
                room appearance, then bring the look back here as a template.
              </p>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <p className="text-xs text-muted-foreground">
                No rooms yet. Create one to start painting a room.
              </p>
              <Button size="sm" variant="outline" onClick={addRoom}>
                <Plus className="mr-1 h-4 w-4" /> New room
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
