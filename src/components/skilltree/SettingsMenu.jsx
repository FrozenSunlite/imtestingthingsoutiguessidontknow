import { useTree } from "@/lib/treeStore";
import { importImage } from "@/lib/imageStore";
import { Upload, RotateCcw, Trash2, Archive } from "lucide-react";
import { removeImportFromLibrary } from "@/lib/importHistory";
import { DEFAULT_HOTKEYS } from "@/lib/hotkeys";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { HotkeyRow } from "@/components/skilltree/HotkeyRow";
import { HelpContent } from "@/components/skilltree/HelpContent";
import { useTheme, COLOR_TEMPLATES, DEFAULT_CUSTOM, FONT_OPTIONS } from "@/lib/useTheme";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Editable hotkeys (rebindable).
const HOTKEY_LABELS = [
  ["undo", "Undo"],
  ["redo", "Redo"],
  ["rotateRight", "Rotate selection right"],
  ["rotateLeft", "Rotate selection left"],
  ["flipH", "Flip selection horizontally"],
  ["flipV", "Flip selection vertically"],
  ["delete", "Delete selection"],
  ["copy", "Copy selection to clipboard"],
  ["cut", "Cut selection (paste across tabs)"],
  ["paste", "Paste clipboard"],
  ["selectAll", "Select all nodes on screen"],
  ["selectAllTab", "Select all nodes on this tab"],
];

// Built-in mouse/keyboard gestures that can't be rebound, listed for reference.
const FIXED_SHORTCUTS = [
  ["Alt + Click node", "Start or finish a link between nodes"],
  ["Ctrl/⌘ + Click node", "Add or remove from the multi-selection"],
  ["Right- or middle-drag", "Pan the canvas"],
  ["Mouse wheel", "Zoom the canvas"],
  ["Drag empty space (Edit)", "Box-select several nodes"],
  ["Escape", "Cancel link mode or close search"],
];

export function SettingsMenu({ open, onClose }) {
  const { settings, setSettings, character, setCharacter, backupProject, listBackups, restoreBackup, deleteTab } = useTree();
  const [theme, setTheme] = useTheme();
  const template = theme.template || "default";
  const customTheme = { ...DEFAULT_CUSTOM, ...(theme.custom || {}) };
  const setCustomTheme = (patch) =>
    setTheme({ ...theme, custom: { ...customTheme, ...patch } });
  const [devLogs, setDevLogs] = useState([]);
  const [backups, setBackups] = useState([]);
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    listBackups?.().then((list) => {
      if (alive) setBackups(list || []);
    });
    return () => {
      alive = false;
    };
  }, [open, listBackups]);
  useEffect(() => {
    if (!character?.devMode) return;
    const origLog = console.log;
    const origError = console.error;
    console.log = (...a) => { setDevLogs((l) => [...l, a.join(" ")]); origLog(...a); };
    console.error = (...a) => { setDevLogs((l) => [...l, "ERROR: " + a.join(" ")]); origError(...a); };
    return () => { console.log = origLog; console.error = origError; };
  }, [character?.devMode]);
  if (!settings) return null;

  const setHotkey = (action, combo) =>
    setSettings((s) => ({ ...s, hotkeys: { ...s.hotkeys, [action]: combo } }));
  const setConnector = (patch) =>
    setSettings((s) => ({ ...s, connector: { ...s.connector, ...patch } }));

  // Placeholder art applies to every node without its own image.
  const onPlaceholderUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await importImage(file);
      setSettings((s) => ({ ...s, placeholderImage: url }));
    } catch {
      alert("Upload failed — you can paste an image URL instead.");
    }
    e.target.value = "";
  };

  // Default node frame applies to every node without its own frame.
  const onFrameUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await importImage(file);
      setSettings((s) => ({ ...s, placeholderFrame: url }));
    } catch {
      alert("Upload failed — you can paste an image URL instead.");
    }
    e.target.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure hotkeys, connectors, default artwork and tab behavior.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="hotkeys" className="flex max-h-[70vh] flex-col">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="hotkeys">Shortcuts & Hotkeys</TabsTrigger>
            <TabsTrigger value="connector">Connectors</TabsTrigger>
            <TabsTrigger value="artwork">Node Artwork</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="project">Project</TabsTrigger>
            <TabsTrigger value="help">Help</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pr-1">
            <TabsContent value="hotkeys" className="mt-3">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-medium">Hotkeys</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setSettings((s) => ({ ...s, hotkeys: { ...DEFAULT_HOTKEYS } }))
                    }
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset to defaults
                  </Button>
                </div>
                {HOTKEY_LABELS.map(([action, label]) => (
                  <HotkeyRow
                    key={action}
                    label={label}
                    combo={settings.hotkeys[action]}
                    onChange={(c) => setHotkey(action, c)}
                  />
                ))}
              </div>

              <div className="mt-4 border-t pt-3">
                <p className="mb-1 text-sm font-medium">Built-in shortcuts</p>
                {FIXED_SHORTCUTS.map(([combo, label]) => (
                  <div key={combo} className="flex items-center justify-between gap-2 py-1">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="w-32 rounded-md border bg-muted px-2 py-1 text-center font-mono text-xs">
                      {combo}
                    </span>
                  </div>
                ))}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  These gestures are fixed and can't be changed.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="connector" className="mt-3 space-y-3">
              <p className="text-sm font-medium">Default connectors</p>
              <div className="flex items-center gap-2">
                <Label className="w-20 text-xs text-muted-foreground">Color</Label>
                <input
                  type="color"
                  value={settings.connector.color}
                  onChange={(e) => setConnector({ color: e.target.value })}
                  className="h-8 w-14 cursor-pointer rounded border bg-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="w-20 text-xs text-muted-foreground">Thickness</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={settings.connector.thickness}
                  onChange={(e) =>
                    setConnector({ thickness: Math.max(1, Number(e.target.value) || 1) })
                  }
                  className="h-8 w-20"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="w-20 text-xs text-muted-foreground">Opacity</Label>
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={settings.connector.opacity}
                  onChange={(e) => setConnector({ opacity: Number(e.target.value) })}
                  className="h-1 flex-1 accent-primary"
                />
                <span className="w-8 text-right text-xs text-muted-foreground">
                  {Math.round(settings.connector.opacity * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Label className="w-20 text-xs text-muted-foreground">Line</Label>
                <Select
                  value={settings.connector.dash}
                  onValueChange={(v) => setConnector({ dash: v })}
                >
                  <SelectTrigger className="h-8 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">Solid</SelectItem>
                    <SelectItem value="dotted">Dotted</SelectItem>
                    <SelectItem value="dashed">Dashed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Connectors can override all of this with their own style — select one
                and turn off "Use global settings" in its editor panel.
              </p>
            </TabsContent>

            <TabsContent value="artwork" className="mt-3 space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Default Node Icon</p>
                <div className="flex items-center gap-2">
                  {settings.placeholderImage ? (
                    <img
                      src={settings.placeholderImage}
                      alt=""
                      className="h-10 w-10 rounded border object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded border text-lg">
                      ⚔️
                    </div>
                  )}
                  <Input
                    className="h-8 flex-1"
                    placeholder="Image URL"
                    value={settings.placeholderImage || ""}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, placeholderImage: e.target.value }))
                    }
                  />
                  <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded border hover:bg-accent" title="Upload image">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={onPlaceholderUpload}
                    />
                  </label>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Shown on every node that has no image of its own, and used as the
                  fallback when a node's art fails to load.
                </p>
              </div>

              <div className="space-y-2 border-t pt-3">
                <p className="text-sm font-medium">Default Node Frame</p>
                <div className="flex items-center gap-2">
                  {settings.placeholderFrame ? (
                    <img
                      src={settings.placeholderFrame}
                      alt=""
                      className="h-10 w-10 rounded border object-contain"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded border text-lg">
                      ▫️
                    </div>
                  )}
                  <Input
                    className="h-8 flex-1"
                    placeholder="Image URL"
                    value={settings.placeholderFrame || ""}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, placeholderFrame: e.target.value }))
                    }
                  />
                  <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded border hover:bg-accent" title="Upload frame image">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={onFrameUpload}
                    />
                  </label>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Drawn over every node without its own frame; the frame's border
                  defines the node's shape.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="general" className="mt-3 space-y-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">Theme</p>
                <div className="space-y-1">
                  <Label className="text-xs">Colour template</Label>
                  <Select
                    value={template}
                    onValueChange={(v) => setTheme({ ...theme, template: v })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOR_TEMPLATES.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    {template === "default"
                      ? "Use the cyberpunk/classic look and the switches below."
                      : template === "custom"
                      ? "Pick your own surface, text, accent, border and font colours."
                      : "A ready-made palette for the whole app, including its fonts."}
                  </p>
                </div>
                {template === "default" && (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <Label className="text-xs">Cyberpunk theme</Label>
                        <p className="text-[10px] text-muted-foreground">
                          Dark neon look with cyan and magenta accents across the app.
                        </p>
                      </div>
                      <Switch
                        checked={!!theme.cyber}
                        onCheckedChange={(v) => setTheme({ ...theme, cyber: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <Label className="text-xs">Dark mode</Label>
                        <p className="text-[10px] text-muted-foreground">
                          Off = light mode: the same neon accents inverted onto a light surface.
                        </p>
                      </div>
                      <Switch
                        checked={!!theme.dark}
                        onCheckedChange={(v) => setTheme({ ...theme, dark: v })}
                      />
                    </div>
                  </>
                )}
                {template === "custom" && (
                  <div className="space-y-2 rounded-md border p-2">
                    <p className="text-xs font-medium">Custom colours</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        ["background", "Background"],
                        ["surface", "Surface"],
                        ["text", "Text / font"],
                        ["muted", "Muted text"],
                        ["accent", "Accent"],
                        ["border", "Border"],
                      ].map(([key, label]) => (
                        <label key={key} className="flex items-center gap-1.5 text-xs">
                          <input
                            type="color"
                            className="h-7 w-9 shrink-0 rounded border"
                            value={customTheme[key]}
                            onChange={(e) => setCustomTheme({ [key]: e.target.value })}
                          />
                          <span className="min-w-0 flex-1 truncate">{label}</span>
                          <span className="font-mono text-[9px] text-muted-foreground">
                            {customTheme[key]}
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Body font</Label>
                      <Input
                        className="h-8"
                        list="theme-fonts"
                        value={customTheme.font}
                        onChange={(e) => setCustomTheme({ font: e.target.value })}
                        placeholder="e.g. Georgia, serif"
                      />
                      <Label className="text-xs">Heading font (blank = body font)</Label>
                      <Input
                        className="h-8"
                        list="theme-fonts"
                        value={customTheme.headingFont}
                        onChange={(e) => setCustomTheme({ headingFont: e.target.value })}
                        placeholder="e.g. 'Palatino Linotype', serif"
                      />
                      <datalist id="theme-fonts">
                        {FONT_OPTIONS.map((f) => (
                          <option key={f} value={f} />
                        ))}
                      </datalist>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTheme({ ...theme, custom: { ...DEFAULT_CUSTOM } })}
                      >
                        Reset custom
                      </Button>
                      <span className="text-[10px] text-muted-foreground">
                        Font colour follows the Text colour.
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 border-t pt-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label className="text-xs">Auto-save</Label>
                    <p className="text-[10px] text-muted-foreground">Save changes automatically (interval in seconds).</p>
                  </div>
                  <Switch
                    checked={!!settings.autoSave}
                    onCheckedChange={(v) => setSettings((s) => ({ ...s, autoSave: v }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-20 text-xs text-muted-foreground">Interval</Label>
                  <Input
                    type="number"
                    min={10}
                    className="h-8 flex-1"
                    value={settings.autoSaveInterval ?? 60}
                    onChange={(e) => setSettings((s) => ({ ...s, autoSaveInterval: Number(e.target.value) || 60 }))}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label className="text-xs">Cache remote images locally</Label>
                    <p className="text-[10px] text-muted-foreground">
                      Also embeds externally linked (http) images when exporting a project. Images
                      imported into the project folder are always included.
                    </p>
                  </div>
                  <Switch
                    checked={!!settings.cacheRemoteImages}
                    onCheckedChange={(v) => setSettings((s) => ({ ...s, cacheRemoteImages: v }))}
                  />
                </div>
              </div>
              <div className="mt-4 border-t pt-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label className="text-xs">Dev mode</Label>
                    <p className="text-[10px] text-muted-foreground">
                      Shows the Values tab on the View screen — the full working sheet for
                      tuning stats, modifiers and resources by hand.
                    </p>
                  </div>
                  <Switch
                    checked={!!character.devMode}
                    onCheckedChange={(v) => setCharacter({ ...character, devMode: v })}
                  />
                </div>
                {character?.devMode && (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={async () => {
                      try {
                        const logs = ["Crash/Diagnostic log", new Date().toISOString(), "User agent: " + navigator.userAgent];
                        const blob = new Blob([logs.join("\n")], { type: "text/plain" });
                        if (window.showSaveFilePicker) {
                          const handle = await window.showSaveFilePicker({ suggestedName: "crash-log.txt" });
                          const writable = await handle.createWritable();
                          await writable.write(blob);
                          await writable.close();
                          toast.success("Crash log saved.");
                        } else {
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "crash-log.txt";
                          a.click();
                          URL.revokeObjectURL(url);
                        }
                      } catch (e) {
                        toast.error("Could not export crash log: " + (e?.message || e));
                      }
                    }}>Export crash log</Button>
                  </div>
                )}
              </div>
            {character?.devMode && (
              <div className="mt-4 border-t pt-3 space-y-2">
                <p className="text-sm font-medium">Console (DevMode)</p>
                <textarea
                  className="h-40 w-full rounded-md border bg-black/80 p-2 font-mono text-xs text-green-300"
                  readOnly
                  value={devLogs.join("\n")}
                />
                <Button size="sm" variant="outline" onClick={() => setDevLogs([])}>Clear</Button>
              </div>
            )}
            </TabsContent>

            <TabsContent value="project" className="mt-3 space-y-3">
              <div className="space-y-1 rounded border p-2">
                <p className="text-xs font-semibold">Automatic project files</p>
                <p className="text-[10px] text-muted-foreground">
                  The project is saved to the browser, and mirrored into{" "}
                  <code>standalone\desktop\userdata\projects</code> on this PC.
                </p>
                <label className="flex items-center justify-between gap-2 text-xs">
                  Auto-save to disk
                  <Switch
                    checked={settings.autoSaveToDisk !== false}
                    onCheckedChange={(value) =>
                      setSettings((s) => ({ ...s, autoSaveToDisk: value }))
                    }
                  />
                </label>
              </div>

              <div className="space-y-1 rounded border p-2">
                <p className="text-xs font-semibold">Project backups</p>
                <p className="text-[10px] text-muted-foreground">
                  A rotating snapshot is kept before New and before loading a save. Manual backups
                  are kept in the browser's project storage.
                </p>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await backupProject?.("Manual backup");
                      setBackups((await listBackups?.()) || []);
                      toast.success("Backup created.");
                    }}
                  >
                    <Archive className="mr-1 h-3.5 w-3.5" /> Create backup
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => setBackups((await listBackups?.()) || [])}
                  >
                    Refresh list
                  </Button>
                </div>
                <div className="space-y-1">
                  {backups.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground">No backups yet.</p>
                  ) : (
                    backups.map((entry) => (
                      <div
                        key={entry.key}
                        className="flex flex-wrap items-center gap-1 rounded border px-1.5 py-1 text-[10px]"
                      >
                        <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                        <span className="text-muted-foreground">
                          {entry.at ? new Date(entry.at).toLocaleString() : ""}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-1 text-[9px]"
                          onClick={async () => {
                            if (!window.confirm("Restore this backup over the current project?")) return;
                            const ok = await restoreBackup?.(entry.key);
                            toast[ok ? "success" : "error"](ok ? "Backup restored." : "Could not restore.");
                          }}
                        >
                          Restore
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-1 rounded border p-2">
                <p className="text-xs font-semibold">Dungeon Builder draft</p>
                <p className="text-[10px] text-muted-foreground">
                  The last dungeon you were editing is kept so leaving the Builder does not reset
                  it.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSettings((s) => ({
                      ...s,
                      library: { ...s.library, dungeonDraft: null },
                    }));
                    toast.success("Dungeon draft cleared.");
                  }}
                >
                  Clear dungeon draft
                </Button>
              </div>

              <div className="space-y-1 rounded border p-2">
                <p className="text-xs font-semibold">Import provenance</p>
                <p className="text-[10px] text-muted-foreground">
                  Remove every record tagged by a tracked import while keeping hand-made entries.
                </p>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      let library = settings.library;
                      const tabIds = [];
                      (settings.library.importHistory || []).forEach((record) => {
                        library = removeImportFromLibrary(library, record.id).library;
                        tabIds.push(...(record.tabIds || []));
                      });
                      setSettings((s) => ({ ...s, library }));
                      tabIds.forEach((id) => deleteTab(id));
                      toast.success("Tracked imports removed.");
                    }}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove tracked imports
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSettings((s) => ({ ...s, library: { ...s.library, importHistory: [] } }));
                      toast.success("Import history cleared.");
                    }}
                  >
                    Clear history
                  </Button>
                </div>
              </div>

              <div className="space-y-1 rounded border p-2">
                <p className="text-xs font-semibold">Onboarding</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSettings((s) => ({ ...s, tourDone: false }));
                    window.dispatchEvent(new CustomEvent("skilltree:start-tutorial"));
                  }}
                >
                  Open the tutorial
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="help" className="mt-3">
              <div className="mb-3 space-y-1 rounded-md border p-2">
                <p className="text-xs font-semibold">New player tutorial</p>
                <p className="text-[10px] text-muted-foreground">
                  A guided walkthrough of every part of the program: the canvas, importing, the
                  Reference Library, rulebook, dungeons, Architect, DM tools and saving.
                </p>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => window.dispatchEvent(new CustomEvent("skilltree:start-tutorial"))}
                >
                  Start tutorial
                </Button>
              </div>
              <HelpContent />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
