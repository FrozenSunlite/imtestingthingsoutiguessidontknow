import { useState } from "react";
import { useTree } from "@/lib/treeStore";
import { Button } from "@/components/ui/button";
import { SettingsMenu } from "@/components/skilltree/SettingsMenu";
import { LibraryMenu } from "@/components/skilltree/LibraryMenu";
import Rulebook from "@/components/rulebook/Rulebook";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SaveLoadMenu } from "@/components/skilltree/SaveLoadMenu";
import { StandaloneCopyDialog } from "@/components/skilltree/StandaloneCopyDialog";
import { IS_STANDALONE } from "@/lib/env";
import { toast } from "sonner";
import {
  Plus,
  Play,
  FolderOpen,
  Wand2,
  Settings as SettingsIcon,
  Power,
  Download,
  Home,
  BookOpen,
  Swords,
} from "lucide-react";

// First-run main menu: shown before the workspace until an option is picked.
// Return here anytime from the toolbar's door button.
export function LaunchMenu({ onHomebuilder, onDmScreen }) {
  const { enterApp, startNewTree, tree, character } = useTree();
  const hasProject = !!(tree?.nodes?.length || character?.name);
  const devMode = !!character?.devMode;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [rulebookOpen, setRulebookOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const menuBtn = (icon, title, sub, onClick, disabled = false) => (
    <button
      onClick={onClick}
      title={sub}
      className={"group flex w-full items-center gap-4 rounded-xl border border-border/60 bg-card/80 px-5 py-4 text-left shadow-lg backdrop-blur transition-colors hover:border-primary/60 hover:bg-accent" + (disabled ? " opacity-40 pointer-events-none" : "")}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <span>
        <span className="block font-display text-lg font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </span>
    </button>
  );

  const exit = () => {
    window.close();
    toast("Close this browser tab to exit.", {
      description: "Browsers only let a script close a tab it opened itself.",
    });
  };

  return (
    <div className="blue-fire relative flex min-h-screen flex-col items-center justify-center overflow-y-auto bg-gradient-to-b from-background via-background to-muted px-4 py-10">
      <div className="my-auto w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight text-primary drop-shadow-[0_0_16px_rgba(0,229,255,0.5)] sm:text-3xl">
            I'm Trying's Terrific Talent Tree
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            D&D 5e homebrew talent trees — build, play and export
          </p>
        </div>
        <div className="space-y-3">
          {menuBtn(<Plus className="h-5 w-5" />, "New", "Start a fresh skill tree", () => { if (window.confirm("Starting a new project will erase any unsaved changes. Continue?")) startNewTree(); })}
          <div className="grid grid-cols-2 gap-3">
            {menuBtn(<Play className={hasProject ? "h-5 w-5" : "h-5 w-5 opacity-40"} />, "Continue", "Resume current tree without clearing", () => { if (hasProject) enterApp("edit"); })}
            {menuBtn(<FolderOpen className="h-5 w-5" />, "Save / Load", "Save or load a project", () => setSaveOpen(true))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {menuBtn(<BookOpen className="h-5 w-5" />, "Rulebook", "Read the rulebook", () => setRulebookOpen(true))}
            {menuBtn(<BookOpen className="h-5 w-5" />, "Reference Library", "Browse the reference library", () => setLibraryOpen(true))}
          </div>

          {menuBtn(
            <Wand2 className={hasProject ? "h-5 w-5" : "h-5 w-5 opacity-40"} />,
            "Character Creator",
            "Build a character in the working sheet",
            () => { if (hasProject) enterApp("sheet", { sheetOnly: true }); }, (!hasProject && !devMode)
          )}
          {menuBtn(
            <Home className={hasProject ? "h-5 w-5" : "h-5 w-5 opacity-40"} />,
            "Architect",
            "Design a home, business or bastion plot",
            () => { if (hasProject) onHomebuilder?.(); }, (!hasProject && !devMode)
          )}
          {menuBtn(
            <Swords className={hasProject ? "h-5 w-5" : "h-5 w-5 opacity-40"} />,
            "DM Screen",
            "Quick rules and a dice roller for running the game",
            () => { if (hasProject) onDmScreen?.(); }, (!hasProject && !devMode)
          )}
          {menuBtn(
            <BookOpen className="h-5 w-5" />,
            "Rulebook",
            "Read the rulebook — quick start guide and chapters",
            () => setRulebookOpen(true)
          )}
          {menuBtn(
            <SettingsIcon className="h-5 w-5" />,
            "Settings",
            "Hotkeys, grid, library and defaults",
            () => setSettingsOpen(true)
          )}
          {!IS_STANDALONE &&
            menuBtn(
              <Download className="h-5 w-5" />,
              "Get a copy",
              "Download a standalone personal copy",
              () => setCopyOpen(true)
            )}
          {menuBtn(<Power className="h-5 w-5" />, "Exit", "Close the app", exit)}
        </div>
      </div>
      <SaveLoadMenu open={saveOpen} onClose={() => setSaveOpen(false)} />
'      <Dialog open={showNewConfirm} onOpenChange={setShowNewConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Start new project?</DialogTitle>
            <DialogDescription>Starting a new project will erase current work. Proceed?</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNewConfirm(false)}>Cancel</Button>
            <Button onClick={() => { setShowNewConfirm(false); startNewTree(); }}>Continue</Button>
          </div>
        </DialogContent>
      </Dialog>
      <LibraryMenu open={libraryOpen} onClose={() => setLibraryOpen(false)} />
      <Dialog open={rulebookOpen} onOpenChange={setRulebookOpen}>'
        <DialogContent className="flex h-[85vh] flex-col overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Rulebook</DialogTitle>
          </DialogHeader>
          <Rulebook className="min-h-0 flex-1" />
        </DialogContent>
      </Dialog>
      <SettingsMenu open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <SaveLoadMenu open={loadOpen} onClose={() => setLoadOpen(false)} />
      <StandaloneCopyDialog open={copyOpen} onClose={() => setCopyOpen(false)} />
    </div>
  );
}

















