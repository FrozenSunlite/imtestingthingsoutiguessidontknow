import { useEffect, useState } from "react";
import { useTree } from "@/lib/treeStore";
import { Button } from "@/components/ui/button";
import { SettingsMenu } from "@/components/skilltree/SettingsMenu";
import { CharacterCreatorDialog } from "@/components/skilltree/CharacterCreatorDialog";
import { playSfx } from "@/lib/audio";
import { SFX } from "@/lib/sfx";
import { runScreenTransition } from "@/lib/screenTransition";
import { LibraryMenu } from "@/components/skilltree/LibraryMenu";
import { SaveLoadMenu } from "@/components/skilltree/SaveLoadMenu";
import Rulebook from "@/components/rulebook/Rulebook";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Play,
  FolderOpen,
  Wand2,
  Settings as SettingsIcon,
  Power,
  Home,
  BookOpen,
  Library,
  Swords,
  Map,
  Database,
  Globe2,
  Boxes,
  Smartphone,
  GraduationCap,
} from "lucide-react";

// First-run main menu: shown before the workspace until an option is picked.
// Return here anytime from the toolbar's door button.
export function LaunchMenu({ onHomebuilder, onDmScreen, onDungeon, onReferenceIndex, onWorldbuilder, onRoomBuilder }) {
  const { enterApp, startNewTree, tree, character, settings } = useTree();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newConfirmOpen, setNewConfirmOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [rulebookOpen, setRulebookOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice?.outcome === "accepted") setInstallPrompt(null);
  };

  useEffect(() => {
    const openLibrary = () => setLibraryOpen(true);
    const openRulebook = () => setRulebookOpen(true);
    window.addEventListener("skilltree:open-library", openLibrary);
    window.addEventListener("skilltree:open-rulebook", openRulebook);
    return () => {
      window.removeEventListener("skilltree:open-library", openLibrary);
      window.removeEventListener("skilltree:open-rulebook", openRulebook);
    };
  }, []);

  const hasProject = !!(
    tree?.nodes?.length ||
    character?.name ||
    settings?.projectStarted
  );
  const devMode = !!character?.devMode;
  const locked = !hasProject && !devMode;

  const exit = () => {
    window.close();
    toast("Close this browser tab to exit.", {
      description: "Browsers only let a script close a tab it opened itself.",
    });
  };

  const menuBtn = (icon, title, sub, onClick, disabled = false) => (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={sub}
      aria-disabled={disabled}
      className={
        "group flex w-full items-center gap-4 rounded-xl border border-border/60 bg-card/80 px-5 py-4 text-left shadow-lg backdrop-blur transition-colors hover:border-primary/60 hover:bg-accent" +
        (disabled ? " cursor-not-allowed opacity-40" : "")
      }
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-display text-lg font-semibold">{title}</span>
        <span className="block text-xs leading-snug text-muted-foreground">{sub}</span>
      </span>
    </button>
  );

  return (
    <div className="blue-fire relative flex min-h-screen flex-col items-center bg-gradient-to-b from-background via-background to-muted px-4 py-10 sm:pt-20">
      <div className="z-10 mb-3 flex w-full max-w-md justify-end gap-2 sm:absolute sm:right-4 sm:top-4 sm:mb-0 sm:w-auto">
        {installPrompt && (
          <button
            type="button"
            onClick={installApp}
            title="Install this app on your device"
            aria-label="Install app"
            className="rounded-full border bg-card/80 p-2 shadow-lg hover:bg-accent"
          >
            <Smartphone className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("skilltree:start-tutorial"))}
          title="Open the tutorial"
          aria-label="Open the tutorial"
          className="rounded-full border bg-card/80 p-2 shadow-lg hover:bg-accent"
        >
          <GraduationCap className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
          aria-label="Settings"
          className="rounded-full border bg-card/80 p-2 shadow-lg hover:bg-accent"
        >
          <SettingsIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={exit}
          title="Exit"
          aria-label="Exit"
          className="rounded-full border bg-card/80 p-2 shadow-lg hover:bg-accent"
        >
          <Power className="h-5 w-5" />
        </button>
      </div>

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
          {menuBtn(
            <Play className="h-5 w-5" />,
            "Continue",
            "Resume current tree without clearing",
            () => runScreenTransition(() => enterApp("edit")),
            locked
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {menuBtn(
              <Plus className="h-5 w-5" />,
              "New",
              "Start a fresh skill tree",
              () => {
                playSfx(SFX.newProject, { gain: 0.65 });
                setNewConfirmOpen(true);
              }
            )}
            {menuBtn(
              <FolderOpen className="h-5 w-5" />,
              "Save / Load",
              "Save or load a project",
              () => setSaveOpen(true)
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {menuBtn(
              <BookOpen className="h-5 w-5" />,
              "Rulebook",
              "Read and edit the rulebook",
              () => runScreenTransition(() => setRulebookOpen(true)),
              locked
            )}
            {menuBtn(
              <Library className="h-5 w-5" />,
              "Reference Library",
              "Browse the reference library",
              () => setLibraryOpen(true),
              locked
            )}
          </div>

          {menuBtn(
            <Database className="h-5 w-5" />,
            "Reference Index",
            "Browse official, homebrew and prerelease 5eTools data",
            () => runScreenTransition(() => onReferenceIndex?.()),
            locked
          )}

          {menuBtn(
            <Wand2 className="h-5 w-5" />,
            "Character Creator",
            "Build a character, with or without a talent tree",
            () => runScreenTransition(() => setCreatorOpen(true))
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {menuBtn(
              <Home className="h-5 w-5" />,
              "Architect",
              "Design a home, business or bastion plot",
              () => runScreenTransition(() => onHomebuilder?.()),
              locked
            )}
            {menuBtn(
              <Map className="h-5 w-5" />,
              "Dungeon Builder",
              "Build or roll a dungeon or spire",
              () => runScreenTransition(() => onDungeon?.()),
              locked
            )}
            {menuBtn(
              <Boxes className="h-5 w-5" />,
              "Room Builder",
              "Design rooms shared by dungeons and kingdom houses",
              () => runScreenTransition(() => onRoomBuilder?.()),
              locked
            )}
            {menuBtn(
              <Globe2 className="h-5 w-5" />,
              "World Builder",
              "Create a setting, kingdoms, settlements and people",
              () => runScreenTransition(() => onWorldbuilder?.()),
              locked
            )}
          </div>
          {menuBtn(
            <Swords className="h-5 w-5" />,
            "DM Screen",
            "Quick rules and a dice roller for running the game",
            () => runScreenTransition(() => onDmScreen?.()),
            locked
          )}
        </div>
      </div>

      <footer className="mt-8 w-full max-w-md pb-2 text-center text-[10px] text-muted-foreground/70">
        Not for Commercial Resale
      </footer>

      <Dialog open={newConfirmOpen} onOpenChange={setNewConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Start new project?</DialogTitle>
            <DialogDescription>
              Starting a new project will erase current work. Proceed?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNewConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setNewConfirmOpen(false);
                startNewTree();
              }}
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rulebookOpen} onOpenChange={setRulebookOpen}>
        <DialogContent className="flex h-[85vh] flex-col overflow-hidden sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Rulebook</DialogTitle>
          </DialogHeader>
          <Rulebook className="min-h-0 flex-1" />
        </DialogContent>
      </Dialog>

      <SettingsMenu open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <SaveLoadMenu open={saveOpen} onClose={() => setSaveOpen(false)} />
      <LibraryMenu open={libraryOpen} onClose={() => setLibraryOpen(false)} />
      <CharacterCreatorDialog open={creatorOpen} onClose={() => setCreatorOpen(false)} />
    </div>
  );
}
