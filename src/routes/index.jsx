import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { TreeProvider, useTree } from "@/lib/treeStore";
import { Toolbar } from "@/components/skilltree/Toolbar";
import { SkillTreeCanvas } from "@/components/skilltree/SkillTreeCanvas";
import { NodeEditorPanel } from "@/components/skilltree/NodeEditorPanel";
import { ConnectorEditorPanel } from "@/components/skilltree/ConnectorEditorPanel";
import { ContextMenu } from "@/components/skilltree/ContextMenu";
import { SendToSubtreeDialog } from "@/components/skilltree/SendToSubtreeDialog";
import { ViewSheet } from "@/components/skilltree/ViewSheet";
import { PinnedNodeCard } from "@/components/skilltree/PinnedNodeCard";
import { LaunchMenu } from "@/components/skilltree/LaunchMenu";
import { DMScreen } from "@/components/skilltree/DMScreen";
import Homebuilder from "@/components/skilltree/homestead/Homebuilder";
import { DungeonGenerator } from "@/components/skilltree/dungeon/DungeonGenerator";
import { SideTreePanel } from "@/components/skilltree/SideTreePanel";
import { ActivityLogPanel } from "@/components/skilltree/ActivityLogPanel";
import { ExportPanel } from "@/components/skilltree/ExportPanel";
import { PoolWindows } from "@/components/skilltree/PoolWindows";
import { Loader2 } from "lucide-react";

function Workspace() {
  const { mode, loading, tree, ui, screen } = useTree();
  const [ctx, setCtx] = useState(null); // {x, y, node}
  const [homebuilder, setHomebuilder] = useState(false);
  const [dmScreen, setDmScreen] = useState(false);
  const [dungeon, setDungeon] = useState(false);
  const [sendRows, setSendRows] = useState(null); // "send to subtree" chooser
  const [exportOpen, setExportOpen] = useState(false);
  const [poolWins, setPoolWins] = useState([]);
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

  if (screen === "launch" && homebuilder) return <Homebuilder onExit={() => setHomebuilder(false)} />;

  if (screen === "launch" && dungeon)
    return <DungeonGenerator onExit={() => setDungeon(false)} />;

  if (screen === "launch" && dmScreen) return <DMScreen onExit={() => setDmScreen(false)} />;

  if (screen === "launch")
    return (
      <LaunchMenu
        onHomebuilder={() => setHomebuilder(true)}
        onDmScreen={() => setDmScreen(true)}
        onDungeon={() => setDungeon(true)}
      />
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
      <Toolbar onAddPoolWindow={addPoolWindow} />
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
            <SideTreePanel slot="left" />
            <div className="flex-1 overflow-auto bg-muted/50 p-3 sm:p-6">
              <ViewSheet onExport={() => setExportOpen(true)} />
            </div>
            <SideTreePanel slot="right" />
          </div>
        )}
        {mode === "edit" &&
          (ui.selectedConnectionId ? <ConnectorEditorPanel /> : <NodeEditorPanel />)}
        <PoolWindows wins={poolWins} setWins={setPoolWins} />
        <PinnedNodeCard />
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