import { useEffect, useRef, useState } from "react";
import {
  useTree,
  useViewSet,
  denormalizeTree,
  poolUsage,
  effectivePools,
  levelGains,
  profBonusFor,
  statVars,
} from "@/lib/treeStore";
import { statOr10 } from "@/lib/skills";
import { inlineImages, rehydrateImages } from "@/lib/imageStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LevelUpDialog } from "@/components/skilltree/LevelUpDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { SettingsMenu } from "@/components/skilltree/SettingsMenu";
import { Label } from "@/components/ui/label";
import {
  Pencil,
  Eye,
  Grid3x3,
  Upload,
  Download,
  Save,
  ArrowLeftRight,
  DoorOpen,
  ZoomIn,
  ZoomOut,
  Maximize,
  Settings,
  ChevronsUp,
  ChevronsDown,
  BookOpen,
  AppWindow,
} from "lucide-react";
import { LibraryMenu } from "@/components/skilltree/LibraryMenu";
import { SaveLoadMenu } from "@/components/skilltree/SaveLoadMenu";
import { TabBar } from "@/components/skilltree/TabBar";
import { InfoTip } from "@/components/skilltree/InfoTip";
import { SearchBox } from "@/components/skilltree/SearchBox";
import { Database } from "lucide-react";

export function Toolbar({ onAddPoolWindow, onReferenceIndex }) {
  const {
    tree,
    mode,
    setMode,
    setScreen,
    grid,
    setGrid,
    ui,
    setUi,
    pools,
    setPools,
    character,
    setCharacter,
    importTree,
    invertPrerequisites,
    setTree,
    settings,
    mergedTree,
    sheetOnly,
  } = useTree();
  // Only moves the camera — subscribes to the setter, not the view, so
  // panning the canvas never re-renders the toolbar.
  const setView = useViewSet();
  const fileRef = useRef(null);
  const [importData, setImportData] = useState(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  useEffect(() => {
    const openLibrary = () => setLibraryOpen(true);
    window.addEventListener("skilltree:open-library", openLibrary);
    return () => window.removeEventListener("skilltree:open-library", openLibrary);
  }, []);

  // Center the canvas on a search pick and select it.
  const pickSearchNode = (n) => {
    const el = document.getElementById("canvas-viewport");
    setView((v) => ({
      ...v,
      panX: (el?.clientWidth || 800) / 2 - n.x * v.zoom,
      panY: (el?.clientHeight || 600) / 2 - n.y * v.zoom,
    }));
    setUi((u) => ({ ...u, selectedNodeId: n.id }));
  };

  // Level up/down apply the Reference Library's gains for the level, falling
  // back to the per-level defaults in settings.levelRules.
  const levels = settings?.library?.levels || [];
  const [hpDialog, setHpDialog] = useState(false);

  // Level up now asks how the hit die is spent: average or roll (see
  // LevelUpDialog), which also applies the level and pool gains.
  const levelUp = () => setHpDialog(true);

  const levelDown = () => {
    const cur = Number(character.level) || 1;
    if (cur <= 1) return;
    const g = levelGains(cur, settings);
    // Losing a level removes what it granted: the level's average HP and one
    // hit die (when the count is pinned instead of tracking the level).
    const sides = Number(String(character.hitDiceSize || "d6").replace(/\D/g, "")) || 6;
    const statsNow = statVars(character, mergedTree);
    const conMod =
      Math.floor((statOr10(statsNow.CON) - 10) / 2) +
      (Number(character.modifiers?.ability?.CON) || 0);
    const perLevel = Math.max(1, Math.floor(sides / 2) + 1) + conMod;
    const hp = Math.max(0, (Number(character.hitPoints) || 0) - perLevel);
    const hd =
      character.hitDiceCount == null || character.hitDiceCount === ""
        ? ""
        : Math.max(1, (Number(character.hitDiceCount) || 0) - 1);
    setCharacter({
      ...character,
      level: cur - 1,
      hitPoints: hp,
      ...(character.currentHp != null
        ? { currentHp: Math.min(Number(character.currentHp) || 0, hp) }
        : {}),
      ...(hd !== "" ? { hitDiceCount: hd } : {}),
    });
    setPools((p) => ({
      ...p,
      talent: { ...p.talent, total: Math.max(0, (p.talent.total || 0) - g.talentPoints) },
      heritage: { ...p.heritage, total: Math.max(0, (p.heritage.total || 0) - g.heritagePoints) },
      attribute: {
        ...p.attribute,
        total: Math.max(0, (p.attribute?.total ?? 72) - g.attributePoints),
      },
    }));
  };

  const gainsLabel = (level, sign) => {
    const g = levelGains(level, settings);
    const parts = [
      g.talentPoints ? `${sign}${g.talentPoints} Talent` : null,
      g.heritagePoints ? `${sign}${g.heritagePoints} Heritage` : null,
      g.attributePoints ? `${sign}${g.attributePoints} Attribute` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(", ") : "no points";
  };
  const upLevel = (Number(character.level) || 1) + 1;
  const upTip = `Level ${character.level} → ${upLevel}: ${gainsLabel(upLevel, "+")} · Proficiency Bonus ${profBonusFor(upLevel, levels)}`;
  const downLevel = Math.max(1, (Number(character.level) || 1) - 1);
  const downTip = `Level ${character.level} → ${downLevel}: ${gainsLabel(Number(character.level) || 1, "−")} · Proficiency Bonus ${profBonusFor(downLevel, levels)}`;

  // Pool chips count points spent on the main tree and both side-tree panels —
  // the limits are global across every tree.
  const usage = poolUsage(mergedTree);
  const eff = effectivePools(pools, character, mergedTree, levels);

  const onImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        // Exports carry their artwork as embedded data URLs; move those back
        // into the project's image folder so the live tree stays small.
        setImportData(await rehydrateImages(parsed));
      } catch {
        alert("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const runImport = (mode) => {
    importTree(importData, mode);
    setImportData(null);
  };

  const onExport = async () => {
    // The Reference Library travels with the tree so an import restores it.
    const data = { ...denormalizeTree(tree), "Reference Library": settings?.library };
    // Project images are files on disk; embed them so this export is portable.
    const portable = await inlineImages(data, {
      includeRemote: !!settings?.cacheRemoteImages,
    });
    const blob = new Blob([JSON.stringify(portable, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(tree.name || tree.className || "skill-tree").replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fit = () => {
    if (!tree || tree.nodes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    tree.nodes.forEach((n) => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x);
      maxY = Math.max(maxY, n.y);
    });
    const w = maxX - minX + 200;
    const h = maxY - minY + 200;
    const el = document.getElementById("canvas-viewport");
    const vw = el?.clientWidth || 800;
    const vh = el?.clientHeight || 600;
    const z = Math.min(vw / w, vh / h, 1);
    setView({
      zoom: z,
      panX: -(minX - 100) * z,
      panY: -(minY - 100) * z,
    });
  };

  const zoomBy = (f) =>
    setView((v) => ({ ...v, zoom: Math.min(2.5, Math.max(0.03, (v.zoom || 0.1) * f)) }));

  return (
    <div>
      <TabBar />
      <div className="max-h-[40vh] overflow-y-auto border-b bg-card px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
      <InfoTip label="Project name — used for export file names">
        <Input
          className="h-8 w-44"
          placeholder="Project name"
          value={tree.name || ""}
          onChange={(e) => setTree((t) => ({ ...t, name: e.target.value }))}
        />
      </InfoTip>
      <InfoTip label="Load a skill tree from a saved .json file">
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1 h-4 w-4" /> Import
        </Button>
      </InfoTip>
      <InfoTip label="Download the whole tree as a .json file">
        <Button size="sm" variant="outline" onClick={onExport}>
          <Download className="mr-1 h-4 w-4" /> Export
        </Button>
      </InfoTip>
      <InfoTip label="Save this character, or load a saved one (images included)">
        <Button size="sm" variant="outline" onClick={() => setSaveOpen(true)}>
          <Save className="mr-1 h-4 w-4" /> Save / Load
        </Button>
      </InfoTip>
      <InfoTip label="Swap every prerequisite with its dependent — fixes trees imported with reversed parent/child roles">
        <Button size="sm" variant="outline" onClick={invertPrerequisites}>
          <ArrowLeftRight className="mr-1 h-4 w-4" /> Invert Prerequisites
        </Button>
      </InfoTip>
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={onImport} />

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <SearchBox onPick={pickSearchNode} />
        <div className="h-6 w-px bg-border" />
        {/* Back to the main menu sits next to Settings. Returning to the menu
            keeps the working project; only closing the program while dirty
            warns, so there is no exit dialog here. */}
        <InfoTip label="Back to the main menu">
          <Button size="sm" variant="outline" onClick={() => setScreen("launch")}>
            <DoorOpen className="mr-1 h-4 w-4" /> Menu
          </Button>
        </InfoTip>
        <InfoTip label="Settings: hotkeys, camera start, connectors, default artwork">
          <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings className="mr-1 h-4 w-4" /> Settings
          </Button>
        </InfoTip>
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          {/* The Character Creator is view-only; its Edit button stays hidden
              unless Dev Mode is on. */}
          {(!sheetOnly || character.devMode) && (
            <InfoTip label="Edit mode: build, move and configure nodes">
              <Button
                size="sm"
                variant={mode === "edit" ? "default" : "ghost"}
                onClick={() => setMode("edit")}
              >
                <Pencil className="mr-1 h-4 w-4" /> Edit
              </Button>
            </InfoTip>
          )}
          <InfoTip label="View mode: the character screen, with tree panels on either side for investing points">
            <Button
              size="sm"
              variant={mode === "sheet" ? "default" : "ghost"}
              onClick={() => setMode("sheet")}
            >
              <Eye className="mr-1 h-4 w-4" /> View
            </Button>
          </InfoTip>
        </div>
      </div>
      </div>

      {/* Canvas options: grid, connectors and zoom on the left; character
          progress and reference tools on the right. */}
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2">
      <div className="flex items-center gap-2">
        <Grid3x3 className="h-4 w-4 text-muted-foreground" />
        <Select
          value={grid.type}
          onValueChange={(v) => setGrid((g) => ({ ...g, type: v }))}
        >
          <InfoTip label="Grid shape used for node placement and snapping">
            <SelectTrigger className="h-8 w-28">
              <SelectValue />
            </SelectTrigger>
          </InfoTip>
          <SelectContent>
            <SelectItem value="square">Square</SelectItem>
            <SelectItem value="hex">Hexagonal</SelectItem>
            <SelectItem value="circle">Circular</SelectItem>
            <SelectItem value="triangle">Triangular</SelectItem>
          </SelectContent>
        </Select>
        {grid.type === "hex" && (
          <Select
            value={grid.hexOrientation || "vertical"}
            onValueChange={(v) => setGrid((g) => ({ ...g, hexOrientation: v }))}
          >
            <InfoTip label="Hexagon orientation: pointy-top (vertical) or flat-top (horizontal)">
              <SelectTrigger className="h-8 w-28">
                <SelectValue />
              </SelectTrigger>
            </InfoTip>
            <SelectContent>
              <SelectItem value="vertical">Vertical hexes</SelectItem>
              <SelectItem value="horizontal">Horizontal hexes</SelectItem>
            </SelectContent>
          </Select>
        )}
        <InfoTip label="Snap node positions to the grid while dragging">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Switch
              checked={grid.snapEnabled}
              onCheckedChange={(v) => setGrid((g) => ({ ...g, snapEnabled: v }))}
            />
            Snap
          </label>
        </InfoTip>
        <InfoTip label="Grid cell size in pixels">
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min={20}
              max={400}
              step={10}
              value={grid.snapSize || 120}
              onChange={(e) => setGrid((g) => ({ ...g, snapSize: Number(e.target.value) }))}
              className="h-1 w-20 accent-primary"
            />
            <span className="w-10 text-right font-mono text-[10px] text-muted-foreground">
              {grid.snapSize || 120}px
            </span>
          </div>
        </InfoTip>
        <InfoTip label="Show or hide the background grid">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Switch
              checked={grid.visible}
              onCheckedChange={(v) => setGrid((g) => ({ ...g, visible: v }))}
            />
            Grid
          </label>
        </InfoTip>
      </div>

      <div className="h-6 w-px bg-border" />

      <div className="flex items-center gap-2">
        <Select
          value={ui.connectionStyle}
          onValueChange={(v) => setUi((u) => ({ ...u, connectionStyle: v }))}
        >
          <InfoTip label="Shape of the lines between nodes">
            <SelectTrigger className="h-8 w-28">
              <SelectValue />
            </SelectTrigger>
          </InfoTip>
          <SelectContent>
            <SelectItem value="curved">Curved</SelectItem>
            <SelectItem value="angular">Angular</SelectItem>
            <SelectItem value="straight">Straight</SelectItem>
          </SelectContent>
        </Select>
        <InfoTip label="Show direction arrows on connectors">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Switch
              checked={ui.showArrows}
              onCheckedChange={(v) => setUi((u) => ({ ...u, showArrows: v }))}
            />
            Arrows
          </label>
        </InfoTip>
        <InfoTip label="Show node names with type and level tags under each node">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Switch
              checked={ui.showNames}
              onCheckedChange={(v) => setUi((u) => ({ ...u, showNames: v }))}
            />
            Names
          </label>
        </InfoTip>
      </div>

      <div className="h-6 w-px bg-border" />

      <div className="flex items-center gap-1">
        <InfoTip label="Zoom out">
          <Button size="sm" variant="ghost" onClick={() => zoomBy(1 / 1.2)}>
            <ZoomOut className="h-4 w-4" />
          </Button>
        </InfoTip>
        <InfoTip label="Zoom in">
          <Button size="sm" variant="ghost" onClick={() => zoomBy(1.2)}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </InfoTip>
        <InfoTip label="Fit the whole tree in view">
          <Button size="sm" variant="ghost" onClick={fit}>
            <Maximize className="h-4 w-4" />
          </Button>
        </InfoTip>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
          <span className="text-amber-600">Heritage</span>
          <span className="text-muted-foreground">{usage.heritage}/{eff.heritage.total}</span>
          <InfoTip label="Maximum Heritage Points (type to override)">
            <input
              type="number"
              value={pools.heritage.total}
              onChange={(e) =>
                setPools({ ...pools, heritage: { ...pools.heritage, total: Number(e.target.value) } })
              }
              className="w-10 bg-transparent text-center outline-none"
            />
          </InfoTip>
        </div>
        <div className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
          <span className="text-violet-600">Attribute</span>
          <span className="text-muted-foreground">{usage.attribute}/{eff.attribute.total}</span>
          <InfoTip label="Maximum Attribute Points (type to override)">
            <input
              type="number"
              value={pools.attribute?.total ?? 72}
              onChange={(e) =>
                setPools({ ...pools, attribute: { total: Number(e.target.value) } })
              }
              className="w-10 bg-transparent text-center outline-none"
            />
          </InfoTip>
        </div>
        <div className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
          <span className="text-sky-600">Talent</span>
          <span className="text-muted-foreground">{usage.talent}/{eff.talent.total}</span>
          <InfoTip label="Maximum Talent Points (type to override)">
            <input
              type="number"
              value={pools.talent.total}
              onChange={(e) =>
                setPools({ ...pools, talent: { ...pools.talent, total: Number(e.target.value) } })
              }
              className="w-10 bg-transparent text-center outline-none"
            />
          </InfoTip>
        </div>

        {character.devMode && (
          <InfoTip label="Open a floating point-pool window (dev mode)">
            <Button size="sm" variant="ghost" onClick={onAddPoolWindow}>
              <AppWindow className="h-4 w-4" />
            </Button>
          </InfoTip>
        )}

        <InfoTip label={upTip}>
          <Button size="sm" variant="outline" onClick={levelUp}>
            <ChevronsUp className="mr-1 h-4 w-4" /> Level Up
          </Button>
        </InfoTip>
        <InfoTip label={downTip}>
          <Button size="sm" variant="outline" onClick={levelDown}>
            <ChevronsDown className="mr-1 h-4 w-4" /> Level Down
          </Button>
        </InfoTip>

        <InfoTip label="Reference library: weapons, armor, speed types, senses, resources and lists">
          <Button size="sm" variant="ghost" onClick={() => setLibraryOpen(true)}>
            <BookOpen className="mr-1 h-4 w-4" /> Library
          </Button>
        </InfoTip>
        <InfoTip label="Reference Index: browse official, homebrew and prerelease 5eTools data">
          <Button size="sm" variant="ghost" onClick={() => onReferenceIndex?.()}>
            <Database className="mr-1 h-4 w-4" /> Ref. Index
          </Button>
        </InfoTip>
      </div>
      </div>
      </div>

      <Dialog open={!!importData} onOpenChange={(v) => !v && setImportData(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Import skill tree</DialogTitle>
            <DialogDescription>Where should the imported tree go?</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button onClick={() => runImport("overwrite")}>Replace current tree</Button>
            <Button variant="outline" onClick={() => runImport("merge")}>
              Merge into current tree
            </Button>
            <Button variant="outline" onClick={() => runImport("newTab")}>
              Create a new tab from it
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SettingsMenu open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LibraryMenu open={libraryOpen} onClose={() => setLibraryOpen(false)} />
      <SaveLoadMenu open={saveOpen} onClose={() => setSaveOpen(false)} />
      <LevelUpDialog open={hpDialog} onClose={() => setHpDialog(false)} />
    </div>
  );
}