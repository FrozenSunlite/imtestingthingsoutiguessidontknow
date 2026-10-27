import { useState } from "react";
import { useTree } from "@/lib/treeStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CharacterTab } from "./CharacterTab";
import { FluffTab } from "./FluffTab";
import { FamiliarTab } from "./FamiliarTab";
import { PropertyTab } from "./PropertyTab";
import { CharacterSheet } from "./CharacterSheet";
import { ActionsSection } from "./ActionsSection";
import { InventorySection } from "./InventorySection";
import { SpellListSection } from "./SpellListSection";
import { ShopSection } from "./ShopSection";
import { ActionActivationDialog } from "./ActionActivationDialog";
import { DiceRoller } from "./DiceRoller";
import { InfoTip } from "./InfoTip";
import Rulebook from "@/components/rulebook/Rulebook";
import { BookOpen, Dices, Download, PanelLeft, PanelRight, Play } from "lucide-react";

// The tabbed "View" screen: a player-facing character sheet, organized like
// the sheet but split across tabs — Character, Actions, Inventory, Spells and
// a Shop for category-based purchases. Side tree panels can be shown on either
// side (investing points there feeds this sheet); the working "Values" sheet
// appears as one more tab, but only in dev mode.
export function ViewSheet({ onExport }) {
  const { character, sideTrees, setSideTree } = useTree();
  const [actOpen, setActOpen] = useState(false);
  const [diceOpen, setDiceOpen] = useState(false);
  const dev = !!character.devMode;
  const isOpen = (slot) => !!sideTrees?.[slot] && !sideTrees[slot].closed;
  // Closing a panel keeps its loaded tree and invested points; reopening
  // brings it back.
  const togglePanel = (slot, def) => {
    const st = sideTrees?.[slot];
    setSideTree(slot, st ? { ...st, closed: !st.closed } : def);
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col p-4">
      <div className="mb-3 flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          variant={isOpen("left") ? "secondary" : "outline"}
          title="Show the skill tree panel on the left — invest points there and the effects apply to the character"
          onClick={() => togglePanel("left", { kind: "main" })}
        >
          <PanelLeft className="mr-1 h-4 w-4" /> Skill tree
        </Button>
        <Button
          size="sm"
          variant={isOpen("right") ? "secondary" : "outline"}
          title="Show a second tree panel on the right — e.g. one side for skills, one for heritage"
          onClick={() => togglePanel("right", { kind: "empty" })}
        >
          <PanelRight className="mr-1 h-4 w-4" /> Second tree
        </Button>
        <InfoTip label="Run one of the character's unlocked actions">
          <Button size="sm" variant="outline" onClick={() => setActOpen(true)}>
            <Play className="mr-1 h-4 w-4" /> Actions
          </Button>
        </InfoTip>
        <InfoTip label="Open the dice roller">
          <Button size="sm" variant="outline" onClick={() => setDiceOpen(true)}>
            <Dices className="mr-1 h-4 w-4" /> Dice
          </Button>
        </InfoTip>
        <InfoTip label="Export the character and sheet">
          <Button size="sm" onClick={onExport}>
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
        </InfoTip>
      </div>

      <Tabs defaultValue="character" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="flex h-auto w-full flex-wrap justify-start sm:w-auto sm:justify-center">
          <TabsTrigger value="character">Character</TabsTrigger>
          <TabsTrigger value="rulebook" className="gap-1">
            <BookOpen className="h-3 w-3" /> Rulebook
          </TabsTrigger>
          <TabsTrigger value="fluff">Fluff</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="spells">Spells</TabsTrigger>
          <TabsTrigger value="shop">Shop</TabsTrigger>
          <TabsTrigger value="familiar">Familiar</TabsTrigger>
          <TabsTrigger value="property">Property</TabsTrigger>
          {dev && <TabsTrigger value="values">Values</TabsTrigger>}
        </TabsList>

        <TabsContent value="character" className="mt-3">
          <CharacterTab />
        </TabsContent>
        <TabsContent value="rulebook" className="mt-3 min-h-0">
          <Rulebook className="h-[70vh]" />
        </TabsContent>
        <TabsContent value="fluff" className="mt-3">
          <FluffTab />
        </TabsContent>
        <TabsContent value="actions" className="mt-3">
          <ActionsSection />
        </TabsContent>
        <TabsContent value="inventory" className="mt-3">
          <InventorySection />
        </TabsContent>
        <TabsContent value="spells" className="mt-3">
          <SpellListSection />
        </TabsContent>
        <TabsContent value="shop" className="mt-3">
          <ShopSection />
        </TabsContent>
        <TabsContent value="familiar" className="mt-3">
          <FamiliarTab />
        </TabsContent>
        <TabsContent value="property" className="mt-3">
          <PropertyTab />
        </TabsContent>
        {dev && (
          <TabsContent value="values" className="mt-3 flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border">
              <CharacterSheet fill onExport={onExport} />
            </div>
          </TabsContent>
        )}
      </Tabs>

      <ActionActivationDialog open={actOpen} onClose={() => setActOpen(false)} />
      <DiceRoller open={diceOpen} onClose={() => setDiceOpen(false)} />
    </div>
  );
}