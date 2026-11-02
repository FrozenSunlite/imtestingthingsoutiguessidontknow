import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { TreeProvider, useTree } from "@/lib/treeStore";
import { Toolbar } from "@/components/skilltree/Toolbar";
import { SkillTreeCanvas } from "@/components/skilltree/SkillTreeCanvas";
import { NodeEditorPanel } from "@/components/skilltree/NodeEditorPanel";
import { ConnectorEditorPanel } from "@/components/skilltree/ConnectorEditorPanel";
import { ContextMenu } from "@/components/skilltree/ContextMenu";
import { SendToSubtreeDialog } from "@/components/skilltree/SendToSubtreeDialog";
import { ViewSheet } from "@/components/skilltree/ViewSheet";
import { ViewTreeColumn } from "@/components/skilltree/ViewTreeColumn";
import { PinnedNodeCard } from "@/components/skilltree/PinnedNodeCard";
import { LaunchMenu } from "@/components/skilltree/LaunchMenu";
import { DMScreen } from "@/components/skilltree/DMScreen";
import { ReferenceIndexPage } from "@/components/skilltree/ReferenceIndexPage";
import Homebuilder from "@/components/skilltree/homestead/Homebuilder";
import { DungeonGenerator } from "@/components/skilltree/dungeon/DungeonGenerator";
import { WorldBuilder } from "@/components/skilltree/world/WorldBuilder";
import { RoomBuilder } from "@/components/skilltree/RoomBuilder";
import { ActivityLogPanel } from "@/components/skilltree/ActivityLogPanel";
import { ExportPanel } from "@/components/skilltree/ExportPanel";
import { PoolWindows } from "@/components/skilltree/PoolWindows";
import { Loader2 } from "lucide-react";
import { CommandPalette } from "@/components/skilltree/CommandPalette";
import { OnboardingTour } from "@/components/skilltree/OnboardingTour";
import { useIsMobile } from "@/hooks/use-is-mobile";

function Workspace() {
  const { mode, loading, tree, ui, screen, setScreen, enterApp, sideTrees, setSideTree } = useTree();
  const [ctx, setCtx] = useState(null); // {x, y, node}
  const [homebuilder, setHomebuilder] = useState(false);
  const [dmScreen, setDmScreen] = useState(false);
  const [dungeon, setDungeon] = useState(false);
  const [roomBuilder, setRoomBuilder] = useState(false);
  const [worldbuilder, setWorldbuilder] = useState(false);
  const [referenceIndex, setReferenceIndex] = useState(false);
  const [sendRows, setSendRows] = useState(null); // "send to subtree" chooser
  const [exportOpen, setExportOpen] = useState(false);
  const [poolWins, setPoolWins] = useState([]);
  const isMobile = useIsMobile();
  const mobileTreesOpen =
    isMobile &&
    ((sideTrees?.left && !sideTrees.left.closed) ||
      (sideTrees?.right && !sideTrees.right.closed));
  const closeMobileTrees = () => {
    if (sideTrees?.left) setSideTree("left", { ...sideTrees.left, closed: true });
    if (sideTrees?.right) setSideTree("right", { ...sideTrees.right, closed: true });
  };
  const mobileDefaultsApplied = useRef(false);
  useEffect(() => {
    if (!isMobile || mobileDefaultsApplied.current) return;
    mobileDefaultsApplied.current = true;
    closeMobileTrees();
  }, [isMobile]);
  useEffect(() => {
    const openDungeon = () => {
      setScreen("launch");
      setDungeon(true);
    };
    const openArchitect = () => {
      setScreen("launch");
      setHomebuilder(true);
    };
    const openDm = () => {
      setScreen("launch");
      setDmScreen(true);
    };
    const openCharacter = () => enterApp("sheet", { sheetOnly: true });
    const openWorld = () => {
      setScreen("launch");
      setWorldbuilder(true);
    };
    const openReference = () => setReferenceIndex(true);
    window.addEventListener("skilltree:open-dungeon", openDungeon);
    window.addEventListener("skilltree:open-worldbuilder", openWorld);
    window.addEventListener("skilltree:open-architect", openArchitect);
    window.addEventListener("skilltree:open-dm-screen", openDm);
    window.addEventListener("skilltree:open-character", openCharacter);
    window.addEventListener("skilltree:open-reference-index", openReference);
    return () => {
      window.removeEventListener("skilltree:open-dungeon", openDungeon);
      window.removeEventListener("skilltree:open-worldbuilder", openWorld);
      window.removeEventListener("skilltree:open-architect", openArchitect);
      window.removeEventListener("skilltree:open-dm-screen", openDm);
      window.removeEventListener("skilltree:open-character", openCharacter);
      window.removeEventListener("skilltree:open-reference-index", openReference);
    };
  }, [enterApp, setScreen]);
  const addPoolWindow = () =>
    setPoolWins((ws) => [
      ...ws,
      {
        id: "pw" + Date.now(),
        pool: "talent",
        x: 40 + (ws.length % 4) * 290,
        y: 40 + (ws.length % 3) * 170,
        collapsed: false,
      },
    ]);

  if (referenceIndex)
    return <ReferenceIndexPage onExit={() => setReferenceIndex(false)} />;

  if (screen === "launch" && homebuilder)
    return (
      <Homebuilder
        onExit={() => setHomebuilder(false)}
        onRoomBuilder={() => {
          setHomebuilder(false);
          setRoomBuilder(true);
        }}
      />
    );

  if (screen === "launch" && roomBuilder)
    return (
      <RoomBuilder
        onExit={() => setRoomBuilder(false)}
        onArchitect={() => {
          setRoomBuilder(false);
          setHomebuilder(true);
        }}
      />
    );

  if (screen === "launch" && dungeon)
    return <DungeonGenerator onExit={() => setDungeon(false)} />;

  if (screen === "launch" && worldbuilder)
    return <WorldBuilder onExit={() => setWorldbuilder(false)} />;

  if (screen === "launch" && dmScreen) return <DMScreen onExit={() => setDmScreen(false)} />;

  if (screen === "launch")
    return (
      <>
        <LaunchMenu
          onHomebuilder={() => setHomebuilder(true)}
          onDmScreen={() => setDmScreen(true)}
          onDungeon={() => setDungeon(true)}
          onReferenceIndex={() => setReferenceIndex(true)}
          onWorldbuilder={() => setWorldbuilder(true)}
          onRoomBuilder={() => setRoomBuilder(true)}
        />
        <OnboardingTour />
        <CommandPalette />
      </>
    );

  if (loading || !tree) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your skill tree…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Toolbar
        onAddPoolWindow={addPoolWindow}
        onReferenceIndex={() => setReferenceIndex(true)}
      />
      <div className="relative flex flex-1 overflow-hidden">
        {mode !== "sheet" && (
          <div id="canvas-viewport" className="relative flex-1">
            <SkillTreeCanvas
              editable={mode === "edit"}
              onNodeContextMenu={(e, node) => setCtx({ x: e.clientX, y: e.clientY, node })}
              onBackgroundContextMenu={(e, world) =>
                setCtx({ x: e.clientX, y: e.clientY, node: null, world })
              }
            />
          </div>
        )}
        {mode === "sheet" && (
          <div className="flex flex-1 overflow-hidden">
            {!isMobile && <ViewTreeColumn />}
            <div className="flex-1 overflow-auto bg-muted/50 p-1 sm:p-3 md:p-6">
              <ViewSheet onExport={() => setExportOpen(true)} />
            </div>
            {isMobile && mobileTreesOpen && (
              <div className="fixed inset-0 z-40 flex flex-col bg-background">
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <span className="text-sm font-semibold">Skill trees</span>
                  <button
                    type="button"
                    className="rounded border px-2 py-1 text-xs"
                    onClick={closeMobileTrees}
                  >
                    Close
                  </button>
                </div>
                <div className="min-h-0 flex-1">
                  <ViewTreeColumn mobile />
                </div>
              </div>
            )}
          </div>
        )}
        {mode === "edit" &&
          (ui.selectedConnectionId ? (
            isMobile ? (
              <div className="fixed inset-0 z-40 bg-background">
                <ConnectorEditorPanel mobile />
              </div>
            ) : (
              <ConnectorEditorPanel />
            )
          ) : ui.editingNodeId ? (
            isMobile ? (
              <div className="fixed inset-0 z-40 bg-background">
                <NodeEditorPanel mobile />
              </div>
            ) : (
              <NodeEditorPanel />
            )
          ) : (
            !isMobile && <NodeEditorPanel />
          ))}
        <PoolWindows wins={poolWins} setWins={setPoolWins} />
        <PinnedNodeCard />
        <CommandPalette />
        <OnboardingTour />
        {mode === "sheet" && <ActivityLogPanel />}
      </div>
      {ctx && (
        <ContextMenu
          x={ctx.x}
          y={ctx.y}
          node={ctx.node}
          world={ctx.world}
          editable={mode === "edit"}
          onSendToSubtree={setSendRows}
          onClose={() => setCtx(null)}
        />
      )}
      <SendToSubtreeDialog
        open={!!sendRows}
        rows={sendRows}
        onClose={() => setSendRows(null)}
      />
      <ExportPanel open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}

export const Route = createFileRoute("/")({
  ssr: false,
  component: () => (
    <TreeProvider>
      <Workspace />
    </TreeProvider>
  ),
  head: () => ({
    meta: [
      { title: "I'm Trying's Terrific Talent Tree" },
      { name: "description", content: "Build and play homebrew D&D 5e talent trees with a live character sheet." },
    ],
  }),
});