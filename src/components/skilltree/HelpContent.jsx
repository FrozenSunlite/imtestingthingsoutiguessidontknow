// The app's in-app manual, shown as the "Help" tab of the Settings dialog.
// A hand-holding seven-lesson tutorial leads the page; a concise quick
// reference (no repeated prose) sits at the bottom for fast lookups.

// Detailed walkthrough: one numbered lesson per part of the program.
const TUTORIAL = [
  {
    part: "1. The Main Menu (where you start)",
    steps: [
      "When you open the app you see the main menu. Nothing is loaded yet — that's normal.",
      "Click “New” to start with a blank tree, or “Load” to reopen a character you saved earlier.",
      "“Character Creator” opens the character sheet directly if you just want to work on stats.",
      "“Homebuilder” opens the floor-plan editor for designing houses, shops and bastions.",
      "You can come back here at any time: the door icon on the toolbar returns you to this menu.",
    ],
  },
  {
    part: "2. Building your tree (Edit mode)",
    steps: [
      "After “New” or “Load” you land in Edit mode — the builder. The big empty area in the middle is the canvas.",
      "Right-click (or middle-click and hold) empty canvas and drag to move your view around. Scroll the mouse wheel to zoom in and out.",
      "Double-click empty canvas (or use the toolbar's plus button) to place your first node.",
      "Click a node once to select it — an editor panel appears beside it where you set its name, type, description and more.",
      "Drag a node by its body to move it. Ctrl/⌘+click adds nodes to a multi-selection; drag empty space to box-select several.",
    ],
  },
  {
    part: "3. Connecting your nodes",
    steps: [
      "Connectors are the arrows that chain nodes together: a node can only be invested once the nodes feeding into it have enough points.",
      "To draw one, hold Alt and click the first node, then Alt+click the second. Press Escape to cancel halfway.",
      "Click a connector line to select it and edit its style in the panel that appears.",
      "In a hurry? Fill in just the name and points on nodes and connect them — everything else can be tuned later.",
    ],
  },
  {
    part: "4. Playing your character (View mode)",
    steps: [
      "Flip the Edit/View switch on the toolbar to View mode — now you're playing, not building.",
      "Click a node to invest a point in it. Its check marks fill in, and every stat it grants updates instantly on the right.",
      "The pools at the top of the screen (skill points, heritage points and so on) show what you can still spend.",
      "Nodes that are grayed out aren't unlocked yet — their dependencies need more points first.",
      "Turn on “Blind run” in the character sheet to hide unmet nodes, so the tree reveals itself as you play.",
    ],
  },
  {
    part: "5. The character sheet (Values)",
    steps: [
      "The sheet is the whole character on one page: details, abilities, hit points, actions, spells, proficiencies, inventory and more.",
      "Almost everything fills itself in from the nodes you invested — you rarely type numbers by hand here.",
      "Use the rest buttons at the top of the Actions section to refill short- and long-rest abilities.",
      "The inventory keeps running totals: item weight and coins (50 coins = 1 lb) feed the capacity bar.",
    ],
  },
  {
    part: "6. The Homebuilder",
    steps: [
      "From the main menu, pick “Homebuilder” to design a property: a home, a business, a bastion — or a hybrid of two.",
      "Create a plot first, then pick a building tool from the palette on the right and click the grid to place it.",
      "Press R before clicking to rotate a piece; drag while placing a Courtyard or Porch to size it freely.",
      "Buy land tiles from the summary panel to expand the boundary; walls, fences and staircases each have their own tools.",
      "Each floor gets its own tab — drag the tabs to rearrange storeys. Save the plot and import it into a character's Property tab later.",
    ],
  },
  {
    part: "7. Saving and exporting",
    steps: [
      "Use the save/load icon on the toolbar to save your character (tree and sheet together) to a file on your computer.",
      "The export button (in View mode) produces a printable sheet, a PNG image, and a JSON backup of the whole tree.",
      "Save often — the browser tab does not keep your work between visits unless you saved it.",
    ],
  },
];

// Concise lookup tables for the bottom of the page — one-liners only; the
// tutorial above carries the explanation.
const QUICK_REFERENCE = [
  {
    title: "Controls & Hotkeys",
    entries: [
      ["Pan", "Right- or middle-drag empty space"],
      ["Zoom", "Mouse wheel"],
      ["Select", "Click · Ctrl/⌘+click to add · drag to box-select"],
      ["Move node", "Drag its body"],
      ["New node", "Double-click empty canvas (Edit mode)"],
      ["Draw connector", "Alt+click node → Alt+click node · Esc cancels"],
      ["Delete selection", "Delete key"],
      ["Undo / Redo", "Configurable in Settings → Hotkeys"],
      ["Rotate selection", "Configurable in Settings → Hotkeys"],
      ["Copy / Paste", "Configurable in Settings → Hotkeys · works across tabs"],
      ["Select all", "Configurable — on screen or whole tab"],
    ],
  },
  {
    title: "Node Anatomy",
    entries: [
      ["Name", "Label on canvas, tooltip and exports"],
      ["Type", "Shape, size and behavior (ability, resource, action…)"],
      ["Description", "Rules text in tooltip and panels"],
      ["Image & frame", "Node artwork; defaults in Settings → Node Artwork"],
      ["Points", "Capacity (2/5 invested); check mark = full"],
      ["Resources", "Granted pools/points; scale with level, refill on rest"],
      ["Actions", "Uses, recovery, resolution, triggers, statuses"],
      ["Choices", "Either/or picks (e.g. +1 STR or +1 DEX)"],
      ["Dependencies", "Required nodes, points needed, all-or-any"],
      ["Level req.", "Minimum character level (feeds Blind Run filter)"],
      ["Exclusive with", "Nodes that lock each other out"],
    ],
  },
  {
    title: "Connector Anatomy",
    entries: [
      ["Direction", "Arrow points at the gated node"],
      ["Prerequisite gate", "Enough invested points upstream to invest"],
      ["Line type", "Solid / dashed / dotted — Settings → Connectors"],
      ["Style", "Thickness, color, opacity — global or per-connector"],
      ["Bend points", "Alt+click along the line to add; drag to reshape"],
      ["Select", "Click the line; Delete removes it"],
    ],
  },
  {
    title: "Character Sheet (Values)",
    entries: [
      ["Details", "Identity: name, class, race, background, level, size"],
      ["Abilities & Stats", "Base scores + node bonuses, live modifiers"],
      ["Pools", "Spendable points, top of screen"],
      ["Derived", "HP, hit dice, initiative, spellcasting stat, exhaustion"],
      ["Actions", "Everything the character can do; rest buttons refill"],
      ["Status", "Initiative, inspiration, exhaustion stages, effects"],
      ["Proficiencies", "Skills, tools, languages, instruments"],
      ["Modifiers", "AC, speed, spell/weapon attack, saves"],
      ["Spell List", "Tabbed by casting stat, then level"],
      ["Inventory", "Items, weight, coins (50 = 1 lb), capacity bar"],
      ["Sheet details / Token", "Printable details; VTT token forge"],
    ],
  },
  {
    title: "Homebuilder",
    entries: [
      ["Plot kinds", "Home, Business, Bastion — or a hybrid of two"],
      ["Basic facility", "25 gp per space (1-space grid = 5 ft)"],
      ["Courtyard / Porch", "Drag to size · Porch 2×3 default"],
      ["Balcony", "1×3 · always lands on the floor above"],
      ["Attachments", "Attic / Floor / Cellar per basic facility"],
      ["Walls & fences", "Wall 5 gp/space · interior wall & fence 2 gp/space"],
      ["Connections", "Corridor, Doorway, Staircase, Ramp — 25 gp"],
      ["Land tiles", "25 gp each · buy/sell in the summary panel"],
      ["Floors", "One tab each · drag tabs to rearrange · R rotates"],
      ["Tower", "Comes with 2 upper storeys + staircases; delete removes all"],
    ],
  },
  {
    title: "Files & Export",
    entries: [
      ["Save / Load", "Toolbar icon → character file (tree + sheet + plots)"],
      ["Printable sheet", "From the export panel (View mode)"],
      ["PNG image", "Snapshot of the current view"],
      ["RPG JSON", "Normalized backup; reloads cleanly"],
    ],
  },
];

export function HelpContent() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        A detailed tutorial to learn the app, then a quick reference for fast
        lookups. New here? Read the tutorial top to bottom.
      </p>

      {/* Detailed tutorial: one hand-held lesson per part of the app. */}
      <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
        <p className="text-sm font-semibold text-primary">Tutorial — Start Here</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Seven short lessons, in order. Each one covers one part of the program;
          do them top to bottom on your first visit and you'll know your way around.
        </p>
        {TUTORIAL.map((t) => (
          <div key={t.part} className="mt-3 rounded-md border bg-card p-3">
            <p className="text-sm font-semibold">{t.part}</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5">
              {t.steps.map((step, i) => (
                <li key={i} className="text-xs leading-relaxed text-muted-foreground">
                  {step}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      {/* Quick reference: compact lookup tables, no repeated prose. */}
      <div className="rounded-md border p-3">
        <p className="text-sm font-semibold">Quick Reference</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The short version of everything above — scan it when you know what
          you're looking for.
        </p>
        {QUICK_REFERENCE.map((q) => (
          <div key={q.title} className="mt-3 rounded-md border bg-card p-3">
            <p className="text-sm font-semibold">{q.title}</p>
            <dl className="mt-1.5 divide-y">
              {q.entries.map(([term, def]) => (
                <div key={term} className="grid grid-cols-[minmax(7rem,9rem)_1fr] gap-2 px-1 py-1">
                  <dt className="text-xs font-medium text-foreground">{term}</dt>
                  <dd className="text-xs leading-relaxed text-muted-foreground">{def}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}