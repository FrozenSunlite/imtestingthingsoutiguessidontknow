import { useCallback, useEffect, useRef, useState } from "react";
import { useTree } from "@/lib/treeStore";
import { Button } from "@/components/ui/button";
import { TutorialVisual } from "@/components/skilltree/TutorialVisual";
import { setTutorialOpen } from "@/lib/tutorialState";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Database,
  GitBranch,
  Globe2,
  GripVertical,
  HelpCircle,
  Home,
  Keyboard,
  Layers,
  Library,
  Map,
  MousePointerClick,
  Pencil,
  Save,
  Sparkles,
  Swords,
  User,
  X,
} from "lucide-react";

const STEPS = [
  {
    id: "welcome",
    group: "Start here",
    icon: Sparkles,
    title: "Welcome to the Talent Tree",
    intro:
      "This program builds RPG skill trees, imports 5eTools reference data, writes rulebooks, generates dungeons and runs the table. Everything belongs to one local project.",
    points: [
      "There is no account and no cloud step: the project lives in this app's local storage.",
      "The launch menu is the hub. Every major tool can be opened from there.",
      "Use Ctrl/⌘+K at any time to search the whole project.",
    ],
    tip: "Follow the steps in order once. Reopen it any time from Settings → Help → Start tutorial, or the Tutorial button at the top of the launch menu.",
  },
  {
    id: "launch",
    group: "Start here",
    icon: Home,
    title: "The launch menu",
    intro: "The launch menu is where you choose a project or open a tool.",
    points: [
      "New starts a fresh tree. Continue resumes the current one.",
      "Save / Load exports or restores a project bundle.",
      "Reference Index imports 5eTools files; Reference Library edits what was imported.",
      "Character Creator and the workspace sheet are for playing a character.",
      "Architect builds homes and businesses; Dungeon Builder builds adventures; DM Screen runs the session.",
    ],
    tip: "The program keeps a rotating backup before New and before loading a save, so a mistaken reset is recoverable.",
  },
  {
    id: "canvas",
    group: "Build a tree",
    icon: MousePointerClick,
    title: "Moving around the canvas",
    intro: "The canvas is the main workspace for a skill tree.",
    points: [
      "Double-click empty space to create a node.",
      "Drag a node to move it. Drag empty space to box-select in Edit mode.",
      "Scroll to zoom; right-drag or middle-drag to pan.",
      "Right-click a node for its menu: edit, duplicate, link, delete and more.",
      "Alt+click one node and then another to create a connection. Ctrl/⌘+click selects several nodes.",
    ],
    tip: "The toolbar has select, move, rotate, flip, grid and zoom controls. Hotkeys are listed in Settings → Shortcuts.",
  },
  {
    id: "tabs",
    group: "Build a tree",
    icon: Layers,
    title: "Tabs and subtrees",
    intro: "A project can hold many trees without mixing them together.",
    points: [
      "Each tab is a separate tree with its own nodes and connections.",
      "Use the tab bar to add, rename or close tabs.",
      "A subtree is a nested tree attached to one node, useful for class paths or specializations.",
      "Points and resources are tracked per tab and per subtree.",
    ],
    tip: "Right-click a node and choose Send to subtree to move an existing branch into a nested tree.",
  },
  {
    id: "node",
    group: "Build a tree",
    icon: Pencil,
    title: "Editing a node",
    intro: "Select a node and the right-hand editor shows everything about it.",
    points: [
      "Name and description are what players read. Description supports [[Node Name]] links.",
      "Node type controls how points are spent: skill, talent, heritage, attribute, informative and special types.",
      "Set cost, maximum points, prerequisites, level requirements and exclusive pairs.",
      "Attach resources, actions, proficiencies, options, images and a frame image.",
      "Use the image buttons to upload artwork; imported artwork is saved with the project.",
    ],
    tip: "Informative nodes are reference-only and cannot be invested in. Use them for rules reminders.",
  },
  {
    id: "points",
    group: "Build a tree",
    icon: GitBranch,
    title: "Points and prerequisites",
    intro: "The tree tracks talent, heritage and attribute pools as the character grows.",
    points: [
      "Invest points by clicking the + control on a node; refund with −.",
      "Prerequisites can require other nodes, spent points, level, proficiencies or ability scores.",
      "A node can draw from its normal pool or an override pool.",
      "Character level defaults come from the Levels tab in the Reference Library.",
    ],
    tip: "Undo and redo work for point changes as well as canvas edits.",
  },
  {
    id: "character",
    group: "Play",
    icon: User,
    title: "Character sheet and creator",
    intro: "The same project contains the character that uses the tree.",
    points: [
      "Character Creator opens the working sheet, where you set abilities, proficiencies, inventory and equipment.",
      "The sheet calculates modifiers, saves, skills, resources, actions and spellcasting from the tree.",
      "Level Up and Level Down on the toolbar adjust the character level and available points.",
      "Rest handles short/long rest recovery; the Combat Tracker follows initiative and conditions.",
    ],
    tip: "Switch between Edit and Sheet with the toolbar mode control. Sheet mode hides tree editing.",
    action: { event: "skilltree:open-character", label: "Open Character Sheet" },
  },
  {
    id: "index",
    group: "Bring in data",
    icon: Database,
    title: "Reference Index",
    intro:
      "The Reference Index reads official/partnered, homebrew and prerelease 5eTools data.",
    points: [
      "Pick a source and a category, then click a file to preview it.",
      "Import this entry imports one record; Import selected imports everything checked.",
      "Display all loads entries from every file in the category; Import all imports that whole category.",
      "Import all data imports every source file in the current data set.",
      "Imports save artwork into the project and are recorded in Import history, where a whole import can be undone.",
    ],
    tip: "Bulk imports can produce thousands of entries. The entry list is virtualized so it stays responsive.",
    action: { event: "skilltree:open-reference-index", label: "Open Reference Index" },
  },
  {
    id: "library",
    group: "Bring in data",
    icon: Library,
    title: "Reference Library",
    intro: "Imported records land in normal, editable library tabs.",
    points: [
      "Monsters, spells, items, conditions, actions and other categories appear in their own tabs.",
      "5eTools Imports holds raw categories without a dedicated tab.",
      "Dungeon Rooms stores the room templates used by the generator.",
      "Project Media lists project artwork, finds orphans and compresses large files.",
      "Everything in the library can be edited by hand; imports are a starting point, not a locked database.",
    ],
    tip: "The library panel is non-modal: leave it open while you drag entries onto the canvas behind it.",
    action: { event: "skilltree:open-library", label: "Open Reference Library" },
  },
  {
    id: "drag",
    group: "Bring in data",
    icon: GripVertical,
    title: "Drag data onto the workspace",
    intro:
      "The fastest way to turn reference material into a node is to drag it from the library.",
    points: [
      "Open Reference Library → 5eTools Imports, then drag an entry onto empty canvas to create a node.",
      "Drop the same entry onto an existing node to add it as a granted benefit (spells, equipment, features, proficiencies and more).",
      "The new node gets the entry name, full stat block and text in the description, plus its artwork when available.",
      "The same works for the dedicated Backgrounds, Species, Deities, Objects and Traps tabs.",
      "Ctrl/⌘+K searches nodes, library entries, rooms, dungeons and rulebook chapters.",
    ],
    tip: "Drop on a node to attach it; drop on empty space to create a new node. The library can stay open on the left.",
  },
  {
    id: "rulebook",
    group: "Write",
    icon: BookOpen,
    title: "Rulebook",
    intro: "The Rulebook is a Homebrewery-style markdown document library.",
    points: [
      "Create books and chapters, then write markdown or paste Homebrewery content.",
      "Use the Image button to upload artwork and the Page break button for printed output.",
      "Contents jumps between headings; image alt text becomes a caption.",
      "Imported 5eTools books are read-only in the Rulebook.",
      "Use .md to download the book or Print / PDF to print the active book.",
    ],
    tip: "The Credits chapter records creators and collaborators for the project.",
  },
  {
    id: "dungeon",
    group: "World",
    icon: Map,
    title: "Dungeon Builder and Room Maker",
    intro: "Generate a dungeon or build rooms by hand.",
    points: [
      "Choose single dungeon or spire, a rank, a seed and the party settings.",
      "Add generation constraints, then Generate. Locked rooms survive rerolls.",
      "Room Maker paints floors and terrain: height, half/¾/full cover, traps, water, difficult terrain, stairs, brush sizes, mirror and flood fill.",
      "Higher ranks can fork into alternate boss routes, each with its own pre-boss camp.",
      "The Danger panel shows loot, reward currency and encounter pressure; the room editor shows the live XP budget.",
      "Session mode adds fog of war, a current-room marker and an encounter readout.",
      "Export the map as PNG, a printable PDF, or Universal VTT.",
    ],
    tip: "Drag-pan the map, Ctrl/⌘+wheel to zoom, and right-click a room for duplicate, reroll and connect actions.",
    action: { event: "skilltree:open-dungeon", label: "Open Dungeon Builder" },
  },
  {
    id: "world",
    group: "World",
    icon: Globe2,
    title: "World Builder",
    intro: "Grow a whole setting: realms, kingdoms, settlements, people and quests.",
    points: [
      "Choose an era, theme, scale and biomes; generate realms, planets or planes with nations, capitals and roads.",
      "The world map is zoomable, drag-pannable and editable: paint terrain or territory, place and move settlements, draw roads, place developments, found a player kingdom, regenerate terrain, and generate new settlements procedurally. Player-placed settlements start blank.",
      "City streets are an orthogonal grid. Every building sits on a free lot that touches a road, and its footprint follows the Building Footprint table (1×1 Wretched/Squalid through 6×6 Aristocratic).",
      "Buildings hold floors of grid-aligned rooms with central corridors and doors. Generated houses follow the facility class for room budget and build time, always have a ground-floor exterior door with a vector line outside, and use exactly one stair between each pair of floors. Double-click a building to open its interior and see the seed for that iteration.",
      "Every cosmetic image placed in a room is a Sticker: position, resize and rotate it, or save the room as a room-type template so every procedural interior of that type shares the same art and floor material. The Stickers page also assigns or replaces the image used by each terrain on the world map.",
      "Kingdoms run monthly turns with economy, military, influence and prosperity. Construction takes 1–5 months by tier, and the six council roles each own a category of actions. Counts and stats are capped, and the Ledger tab tracks each settlement's and development's income and upkeep.",
      "People can be filtered and sorted by name, settlement, occupation or disposition, and each person's attitude (allied, friendly, trusting, indifferent, hostile or hated) can be reassigned.",
      "Issue decrees, sign accords and free-trade agreements, run espionage, appoint created or imported characters to the council, and fight BCR/MP field battles.",
      "World developments — highways, castles, toll booths, magical nexuses, trade ports, villages and towns — are separate plots on the world map, not buildings inside a city.",
      "The living world clock moves NPC schedules and caravans; quests pay gold and can be staged straight into the tactical combat grid.",
      "Combat uses initiative, movement in 5-ft. spaces, attack rolls against AC, hit points and computer-controlled enemy turns.",
      "Export the setting as JSON or a Foundry journal/actor bundle.",
    ],
    tip: "Use the clock in the header to advance time; use Stickers → Sticker room templates to give every interior of a type the same art and floor material.",
    action: { event: "skilltree:open-worldbuilder", label: "Open World Builder" },
  },
  {
    id: "architect",
    group: "World",
    icon: Home,
    title: "Architect",
    intro: "Design a home, business or bastion as a floor plan.",
    points: [
      "Choose a plot type and comfort level, then place facilities, furnishings, walls, doors and stairs.",
      "The right panel totals construction cost, build time, space usage and monthly upkeep.",
      "Expand the land boundary by buying tiles; the cost scales with the new boundary.",
      "Businesses run weekly turns: harvest, sell or stockpile, profit/loss events, resupply, staff and trade routes.",
      "Reward currency is shared with the Dungeon Builder payouts.",
    ],
    tip: "The property summary, business turn panel and labo[u]r panel all read the same plot data.",
    action: { event: "skilltree:open-architect", label: "Open Architect" },
  },
  {
    id: "dm",
    group: "Run",
    icon: Swords,
    title: "DM Screen and combat",
    intro: "The DM Screen keeps quick rules and dice close during play.",
    points: [
      "Roll dice, look up rules and run encounters and loot.",
      "The Combat Tracker follows initiative, hit points and conditions.",
      "Use the dungeon's session mode to reveal rooms and keep the current room in view.",
      "The character sheet's actions and spellcasting are available while running a character.",
    ],
    tip: "Use Activity Log to review recent rolls and changes.",
    action: { event: "skilltree:open-dm-screen", label: "Open DM Screen" },
  },
  {
    id: "save",
    group: "Finish",
    icon: Save,
    title: "Saving, backups and exports",
    intro: "The project autosaves, but exports are what you keep or share.",
    points: [
      "Save / Load writes a portable project bundle; imported artwork is embedded in the export.",
      "Settings → Project shows rotating backups and can restore one.",
      "Import history can undo a tracked import without touching hand-made entries.",
      "Export the tree, character sheet or rulebook separately when you only need one piece.",
    ],
    tip: "Keep a manual backup before a very large import. It takes a moment and saves a lot of rebuilding.",
  },
  {
    id: "shortcuts",
    group: "Finish",
    icon: Keyboard,
    title: "Shortcuts and getting unstuck",
    intro: "A few keys make the program much faster.",
    points: [
      "Ctrl/⌘+K — global search; Ctrl/⌘+Z / Ctrl/⌘+Shift+Z — undo / redo.",
      "Ctrl/⌘+C / X / V — copy, cut and paste nodes; Delete — remove selection.",
      "R — rotate; V — paste; Alt+click — link; right-drag — pan.",
      "Settings → Shortcuts & Hotkeys rebinds the main editing keys.",
      "Help has quick-reference cards, and this tutorial can be reopened at any time.",
    ],
    tip: "If a control is not where you expect, check the right-click menu first — most actions live there too.",
  },
];

export function OnboardingTour() {
  const { settings, setSettings } = useTree();
  const [open, setOpen] = useState(() => !settings?.tourDone);
  const [step, setStep] = useState(0);
  const bodyRef = useRef(null);

  const close = useCallback(() => {
    setOpen(false);
    setSettings((s) => (s.tourDone ? s : { ...s, tourDone: true }));
  }, [setSettings]);

  // The update prompt is a modal dialog. It listens to this so it can wait for
  // the tutorial to close instead of disabling the tutorial underneath it.
  useEffect(() => {
    setTutorialOpen(open);
    if (typeof window !== "undefined") window.talentDesktop?.setTutorialOpen(open);
    return () => {
      setTutorialOpen(false);
      if (typeof window !== "undefined") window.talentDesktop?.setTutorialOpen(false);
    };
  }, [open]);

  useEffect(() => {
    const start = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener("skilltree:start-tutorial", start);
    return () => window.removeEventListener("skilltree:start-tutorial", start);
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [step]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  const item = STEPS[step];
  const Icon = item.icon;
  const runAction = () => {
    if (!item.action) return;
    close();
    window.dispatchEvent(new CustomEvent(item.action.event));
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-3"
      role="dialog"
      aria-modal="true"
      aria-label="New player tutorial"
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-xl border bg-background shadow-2xl">
        <aside className="hidden w-56 shrink-0 flex-col border-r bg-muted/20 sm:flex">
          <div className="border-b px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              New player tutorial
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Step {step + 1} of {STEPS.length}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {STEPS.map((entry, index) => {
              const StepIcon = entry.icon;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setStep(index)}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] ${
                    index === step ? "bg-accent font-semibold" : "hover:bg-accent/50"
                  }`}
                >
                  <StepIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{entry.title}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-start gap-3 border-b px-4 py-3">
            <span className="rounded-md bg-primary/10 p-2 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {item.group}
              </p>
              <h2 className="text-base font-semibold">{item.title}</h2>
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={close} title="Close tutorial">
              <X className="h-4 w-4" />
            </Button>
          </header>

          <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <div className="mb-3 overflow-x-auto rounded-lg border bg-card shadow-sm">
              {/* Keep the diagram wide enough to read on a phone; swipe it. */}
              <div className="min-w-[540px] sm:min-w-0">
                <TutorialVisual kind={item.id} />
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{item.intro}</p>
            {step === 0 && (
              <div className="mt-3 flex gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
                <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold">Reopen this tutorial any time</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Open <strong>Settings → Help → Start tutorial</strong>, or use the{" "}
                    <strong>Tutorial</strong> button at the top of the launch menu.
                  </p>
                </div>
              </div>
            )}
            <ul className="mt-3 space-y-1.5">
              {item.points.map((point, index) => (
                <li key={index} className="flex gap-2 text-xs leading-relaxed">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            {item.tip && (
              <p className="mt-3 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-2 text-[11px] leading-relaxed">
                <span className="font-semibold">Tip:</span> {item.tip}
              </p>
            )}
            {item.action && (
              <Button size="sm" variant="outline" className="mt-3 h-7 text-xs" onClick={runAction}>
                {item.action.label}
              </Button>
            )}
          </div>

          <footer className="flex items-center justify-between gap-2 border-t px-4 py-2">
            <Button size="sm" variant="ghost" onClick={close}>
              {step === STEPS.length - 1 ? "Close" : "Skip tutorial"}
            </Button>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={step === 0}
                onClick={() => setStep((value) => Math.max(0, value - 1))}
              >
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Back
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (step >= STEPS.length - 1) close();
                  else setStep((value) => Math.min(STEPS.length - 1, value + 1));
                }}
              >
                {step >= STEPS.length - 1 ? "Finish" : "Next"}
                {step < STEPS.length - 1 && <ChevronRight className="ml-1 h-3.5 w-3.5" />}
              </Button>
            </div>
          </footer>
          <div className="h-1 bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
