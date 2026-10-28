import { useEffect, useState } from "react";
import { useTree } from "@/lib/treeStore";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CombatTracker } from "@/components/skilltree/CombatTracker";
import { EncountersLoot } from "@/components/skilltree/EncountersLoot";
import { LibraryReference } from "@/components/skilltree/LibraryReference";
import { DmDiceRoller } from "@/components/skilltree/DmDiceRoller";
import { LibraryMenu } from "@/components/skilltree/LibraryMenu";
import { DungeonGenerator } from "@/components/skilltree/dungeon/DungeonGenerator";
import { loadDmTracker, DM_TRACKER_KEY } from "@/lib/dmTrackerStore";
import { parseMaxHp, dexMod } from "@/lib/dmLoot";
import { Swords, DoorOpen, BookOpen } from "lucide-react";

// The Dungeon Master's Screen as its own full-screen section: a combat
// tracker that pulls monsters from the reference library, encounter and
// recursive loot rolling, quick-reference rules, and a plain dice roller —
// no character sheet attached.
export function DMScreen({ onExit }) {
  const { settings } = useTree();
  const monsters = (settings?.library?.monsters || []).filter((m) => m.name);
  const pools = (settings?.library?.lootPools || []).filter((p) => p.name);
  const encounterTables = (settings?.library?.encounterTables || []).filter((t) => t.name);

  const [libOpen, setLibOpen] = useState(false);
  // The combat tracker lives at screen level so rolled encounters can be
  // dropped into it; it persists in the browser between sessions.
  const [tracker, setTracker] = useState(loadDmTracker);
  useEffect(() => {
    try {
      localStorage.setItem(DM_TRACKER_KEY, JSON.stringify(tracker));
    } catch {
      /* quota */
    }
  }, [tracker]);

  // Add rolled encounter monsters to the tracker as ready-made rows.
  const addSpawn = (spawned, tableName) => {
    const now = Date.now();
    const rows = [];
    spawned.forEach(({ monster, count }, idx) => {
      const m = monsters.find((x) => x.name === monster);
      const maxHp = m ? parseMaxHp(m.hp) : 0;
      for (let i = 0; i < count; i++) {
        rows.push({
          id: `e${now}-${idx}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          name: count > 1 ? `${monster} ${i + 1}` : monster,
          monster: m ? m.name : "",
          init: "",
          initBonus: m ? dexMod(m.abilities) : 0,
          ac: m ? String(m.ac ?? "") : "",
          hp: maxHp,
          maxHp,
          notes: `Encounter: ${tableName}${m?.cr ? ` · CR ${m.cr}` : ""}`,
          lootPools: m ? (m.lootPools || []).slice() : [],
        });
      }
    });
    if (rows.length) setTracker((t) => ({ ...t, entries: [...t.entries, ...rows] }));
    return rows.length;
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b px-4 py-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Swords className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-base font-semibold leading-tight">Dungeon Master's Screen</h1>
          <p className="text-[10px] text-muted-foreground">
            Run combat and pull quick rules from the reference library
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setLibOpen(true)}>
            <BookOpen className="mr-1 h-4 w-4" /> Reference Library
          </Button>
          <Button size="sm" variant="outline" onClick={onExit}>
            <DoorOpen className="mr-1 h-4 w-4" /> Back to menu
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <Tabs defaultValue="tracker">
            <TabsList>
              <TabsTrigger value="tracker">Combat Tracker</TabsTrigger>
              <TabsTrigger value="encounters">Encounters & Loot</TabsTrigger>
              <TabsTrigger value="dungeon">Dungeon Builder</TabsTrigger>
              <TabsTrigger value="reference">Quick Reference</TabsTrigger>
            </TabsList>
            <TabsContent value="tracker">
              <CombatTracker tracker={tracker} setTracker={setTracker} monsters={monsters} />
            </TabsContent>
            <TabsContent value="encounters">
              <EncountersLoot
                monsters={monsters}
                pools={pools}
                encounterTables={encounterTables}
                onEncounter={addSpawn}
              />
            </TabsContent>
            <TabsContent value="dungeon">
              <DungeonGenerator embedded />
            </TabsContent>
            <TabsContent value="reference">
              <LibraryReference spells={(settings?.library?.spells || []).filter((s) => s.name)} />
            </TabsContent>
          </Tabs>
        </div>
        <aside className="w-full shrink-0 overflow-y-auto border-t p-3 lg:w-72 lg:border-l lg:border-t-0">
          <DmDiceRoller />
        </aside>
      </div>
      <LibraryMenu open={libOpen} onClose={() => setLibOpen(false)} />
    </div>
  );
}