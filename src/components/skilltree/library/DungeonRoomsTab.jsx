import { useLibList, ListHeader, EmptyNote, EntryCard } from "./shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DUNGEON_CATEGORIES } from "@/lib/dungeonGen";

const CONNECTORS = ["Doorway", "Double Door", "Gate", "Archway", "Corridor", "Bridge", "Stairs", "Rubble passage", "Rune-sealed door"];
const lines = (arr) => (arr || []).join("\n");
const split = (text) =>
  String(text || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

// Reference Library section for dungeon room templates. The procedural
// generator picks from these rooms; the size ranges are measured in spaces.
export function DungeonRoomsTab() {
  const { items, add, patch, remove, query, setQuery, shown } = useLibList("dungeonRooms");
  return (
    <div className="space-y-2">
      <ListHeader
        onAdd={() =>
          add({
            name: "",
            category: "Chamber",
            minW: 9,
            maxW: 16,
            minH: 9,
            maxH: 16,
            environment: "",
            elevation: "Flat",
            cover: "Open",
            connector: "Doorway",
            traps: [],
            spawns: [],
            loot: [],
            harvest: [],
            objects: [],
            tags: [],
            description: "",
            environmentEffect: "",
            notes: "",
            enabled: true,
          })
        }
        addLabel="Add room"
        query={query}
        setQuery={setQuery}
        searchPlaceholder="Search dungeon rooms…"
      />
      <p className="text-[10px] text-muted-foreground">
        Rooms used by the Dungeon Builder. Toggle <strong>Enabled</strong> off to keep a room
        in the library without letting it appear in generated dungeons. Sizes are in spaces;
        traps, spawns and loot are one entry per line.
      </p>
      {shown.length === 0 ? (
        <EmptyNote items={items} query={query} />
      ) : (
        shown.map(({ e, i }) => (
          <EntryCard key={i} entry={e} onPatch={(p) => patch(i, p)} onDelete={() => remove(i)}>
            <label className="flex items-center justify-between rounded border px-2 py-1 text-[10px]">
              <span>
                {e.enabled === false
                  ? "Disabled — never chosen by the generator"
                  : "Enabled — can appear in generated dungeons"}
              </span>
              <Switch
                checked={e.enabled !== false}
                onCheckedChange={(v) => patch(i, { enabled: v })}
              />
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <Input
                className="h-8"
                placeholder="Room name"
                value={e.name || ""}
                onChange={(ev) => patch(i, { name: ev.target.value })}
              />
              <Select value={e.category || "Chamber"} onValueChange={(v) => patch(i, { category: v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DUNGEON_CATEGORIES.map(([cat]) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {[
                ["minW", "Min width"],
                ["maxW", "Max width"],
                ["minH", "Min height"],
                ["maxH", "Max height"],
              ].map(([key, label]) => (
                <div key={key}>
                  <Label className="text-[10px] text-muted-foreground">{label}</Label>
                  <Input
                    className="h-8"
                    type="number"
                    min={9}
                    max={33}
                    value={e[key] ?? ""}
                    onChange={(ev) =>
                      patch(i, { [key]: Math.max(9, Math.min(33, Number(ev.target.value) || 9)) })
                    }
                  />
                </div>
              ))}
              <div>
                <Label className="text-[10px] text-muted-foreground">Environment</Label>
                <Input
                  className="h-8"
                  placeholder="Damp stone"
                  value={e.environment || ""}
                  onChange={(ev) => patch(i, { environment: ev.target.value })}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Elevation</Label>
                <Input
                  className="h-8"
                  value={e.elevation || ""}
                  onChange={(ev) => patch(i, { elevation: ev.target.value })}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Cover</Label>
                <Input
                  className="h-8"
                  value={e.cover || ""}
                  onChange={(ev) => patch(i, { cover: ev.target.value })}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Connector</Label>
                <Select value={e.connector || "Doorway"} onValueChange={(v) => patch(i, { connector: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONNECTORS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {[
              ["traps", "Traps (one per line)"],
              ["spawns", "Spawns / placement (one per line)"],
              ["loot", "Loot (one per line)"],
              ["harvest", "Harvestable materials (one per line)"],
              ["objects", "Imported objects (one per line; Name | /images/... for artwork)"],
            ].map(([key, label]) => (
              <div key={key} className="mt-1.5">
                <Label className="text-[10px] text-muted-foreground">{label}</Label>
                <Textarea
                  className="min-h-14 text-xs"
                  rows={2}
                  value={lines(e[key])}
                  onChange={(ev) => patch(i, { [key]: split(ev.target.value) })}
                />
              </div>
            ))}
            <div className="mt-1.5">
              <Label className="text-[10px] text-muted-foreground">Description / read-aloud</Label>
              <Textarea
                className="min-h-12 text-xs"
                rows={2}
                value={e.description || ""}
                onChange={(ev) => patch(i, { description: ev.target.value })}
              />
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <div>
                <Label className="text-[10px] text-muted-foreground">Environment effect</Label>
                <Input
                  className="h-8"
                  placeholder="Unstable ground…"
                  value={e.environmentEffect || ""}
                  onChange={(ev) => patch(i, { environmentEffect: ev.target.value })}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Tags (comma separated)</Label>
                <Input
                  className="h-8"
                  placeholder="chokepoint, half cover"
                  value={(e.tags || []).join(", ")}
                  onChange={(ev) =>
                    patch(i, {
                      tags: split(ev.target.value.replace(/,/g, "\n")),
                    })
                  }
                />
              </div>
            </div>
            <div className="mt-1.5">
              <Label className="text-[10px] text-muted-foreground">Notes / tactics</Label>
              <Textarea
                className="min-h-12 text-xs"
                rows={2}
                value={e.notes || ""}
                onChange={(ev) => patch(i, { notes: ev.target.value })}
              />
            </div>
            {(e.cells?.length || e.water?.length || e.difficult?.length || e.heights?.length) ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Custom footprint: {e.cells?.length || 0} cells · {e.heights?.length || 0} height ·{" "}
                {e.coverPoints?.length || 0} cover · {e.trapPoints?.length || 0} trap ·{" "}
                {e.water?.length || 0} water · {e.difficult?.length || 0} difficult ·{" "}
                {e.stairs?.length || 0} stairs. Edit it in the Dungeon Builder's Room Maker.
              </p>
            ) : null}
          </EntryCard>
        ))
      )}
    </div>
  );
}
