import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deleteSelectionFromPlot, copySelection, pasteClipboard, selectionValid } from "@/lib/homesteadEdit";
import { toast } from "sonner";
import { ArrowLeft, Download, Home, Store, Castle, Plus, Trash2, Pencil, Upload, Wrench } from "lucide-react";
import {
  loadPlots, savePlots, newPlot,
} from "@/lib/homesteadStore";
import {
  PLOT_KINDS, STATIONS, COMFORT_LEVELS, OWNERSHIP, FACILITY_TYPES,
  furnishingByName, plotTotals, plotKinds, plotBoundary, containingFacility,
  overlaps, uid,
} from "@/lib/homestead";
import HomesteadCanvas from "./HomesteadCanvas";
import HomesteadPalette from "./HomesteadPalette";
import SelectedPanel from "./SelectedPanel";
import HomesteadSummary from "./HomesteadSummary";
import HomesteadBenefits from "./HomesteadBenefits";
import HomesteadTurns from "./HomesteadTurns";
import HomesteadActions from "./HomesteadActions";
import LaborPanel from "./LaborPanel";
import PlotSetupDialog from "./PlotSetupDialog";
import LivingStylePanel from "./LivingStylePanel";
import LivingQualityPanel from "./LivingQualityPanel";

const KIND_ICONS = { home: Home, business: Store, bastion: Castle };
// One row of icons, one per base role the plot serves (hybrids show several).
function KindIcons({ ids, size = "h-4 w-4" }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {ids.map((k) => {
        const Icon = KIND_ICONS[k];
        return Icon ? <Icon key={k} className={size} /> : null;
      })}
    </span>
  );
}
const ordinal = (n) => `${n}${["th", "st", "nd", "rd"][n % 10 > 3 || Math.floor((n % 100) / 10) === 1 ? 0 : n % 10] || "th"}`;

// The Homebuilder: design homes, businesses and bastions as floor plans.
// Each plot is a stack of floors holding facilities, furnishings and
// connections on a grid of 5 ft spaces; the right panel totals gold, build
// time and upkeep from the Bastions & Property homebrew.
export default function Homebuilder({ onExit }) {
  const [plots, setPlots] = useState(loadPlots);
  const [activeId, setActiveId] = useState(null);
  const [tool, setTool] = useState(null);
  const [selection, setSelection] = useState(null);
  const [floorId, setFloorId] = useState(null);
  const [renaming, setRenaming] = useState(null); // floor id being renamed
  const [draft, setDraft] = useState("");
  const [devMode, setDevMode] = useState(false); // DM-only edits: procurement & boundary
  const [setupKind, setSetupKind] = useState(null); // kind awaiting its setup dialog
  const loadRef = useRef(null);
  const clipRef = useRef(null); // copy/paste clipboard — every copy overwrites it
  const pastRef = useRef([]); // undo history (snapshots of the plot list)
  const futureRef = useRef([]); // redo history

  useEffect(() => {
    const first = plots[0];
    if (first && !activeId) {
      setActiveId(first.id);
      setFloorId(first.floors[0]?.id || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => savePlots(plots), [plots]);

  // Rotate the selected facility or furnishing 90° (R key): swap width and
  // height in place, keeping every attached storey's rooms inside it.
  const rotateSelection = () => {
    if (!plot || !selection || selection.kind === "multi") return;
    const b = plotBoundary(plot);
    if (selection.kind === "facility") {
      const f = plot.facilities.find((x) => x.id === selection.id);
      if (!f) return;
      // A Tower and its upper storeys form one stack and rotate together.
      const rootId = f.stackOf || f.id;
      const stack = plot.facilities.filter((x) => x.id === rootId || x.stackOf === rootId);
      const stackIds = new Set(stack.map((x) => x.id));
      const rotated = stack.map((x) => ({ ...x, w: x.h, h: x.w }));
      if (rotated.some((m) => m.x + m.w > b.w || m.y + m.h > b.h))
        return toast("The rotated room runs outside the property boundary.");
      if (plot.facilities.some((o) => !stackIds.has(o.id) && rotated.some((m) => overlaps(m, o))))
        return toast("No space to rotate — another structure blocks it.");
      update((p) => ({
        ...p,
        facilities: p.facilities.map((x) => {
          if (!stackIds.has(x.id)) return x;
          const next = { ...x, w: x.h, h: x.w };
          for (const key of ["attic", "floor", "cellar"]) {
            const at = x[key];
            if (at?.on && at.items?.length)
              next[key] = { ...at, items: at.items.map((it) => ({ ...it, x: it.y, y: it.x, w: it.h, h: it.w })) };
          }
          return next;
        }),
      }));
    } else if (selection.kind === "furnishing") {
      const fu = plot.furnishings.find((x) => x.id === selection.id);
      if (!fu) return;
      const def = furnishingByName(fu.type) || {};
      const rect = { x: fu.x, y: fu.y, w: fu.h, h: fu.w };
      while (rect.w * rect.h < (def.min || 1)) rect.w++;
      if (rect.x + rect.w > b.w || rect.y + rect.h > b.h)
        return toast("The rotated furnishing runs outside the property boundary.");
      const fac = containingFacility(plot, floorId, rect);
      if (!fac && !def.outdoor)
        return toast("The rotated furnishing would poke outside its room — move it first.");
      if (
        plot.furnishings.some((o) => o.id !== fu.id && overlaps(rect, o)) ||
        (!fac && (plot.facilities || []).some((f) => f.floorId === floorId && overlaps(rect, f)))
      )
        return toast("No space to rotate — something blocks it.");
      update((p) => ({
        ...p,
        furnishings: p.furnishings.map((x) =>
          x.id === fu.id ? { ...x, w: rect.w, h: rect.h, facilityId: fac ? fac.id : null } : x
        ),
      }));
    }
  };

  // Esc cancels the active placement tool, then clears the selection; Delete
  // removes the selection; Ctrl+C / Ctrl+X / Ctrl+V copy, cut and paste;
  // Ctrl+Z / Ctrl+Y undo and redo; R rotates the selection.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (tool) setTool(null);
        else setSelection(null);
        return;
      }
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const meta = e.ctrlKey || e.metaKey;
      if (meta && (e.key === "z" || e.key === "Z")) {
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && (e.key === "y" || e.key === "Y")) {
        redo();
        return;
      }
      if (meta && (e.key === "c" || e.key === "C")) {
        const clip = copySelection(plot, selection, floorId);
        if (clip) {
          clipRef.current = clip;
          toast(`Copied ${clip.length} item${clip.length === 1 ? "" : "s"} — clipboard overwritten.`);
        }
        return;
      }
      if (meta && (e.key === "x" || e.key === "X")) {
        const clip = copySelection(plot, selection, floorId);
        if (clip) {
          clipRef.current = clip;
          update((p) => deleteSelectionFromPlot(p, selection));
          setSelection(null);
          toast(`Cut ${clip.length} item${clip.length === 1 ? "" : "s"}.`);
        }
        return;
      }
      if (meta && (e.key === "v" || e.key === "V")) {
        const res = pasteClipboard(clipRef.current, plot, floorId);
        if (res) {
          update(() => res.plot);
          setSelection(res.selection);
          toast("Pasted.");
        } else if (clipRef.current) {
          toast("No free space nearby to paste the clipboard.");
        }
        return;
      }
      if (tool) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selection) {
          update((p) => deleteSelectionFromPlot(p, selection));
          setSelection(null);
        }
        return;
      }
      if ((e.key !== "r" && e.key !== "R") || e.ctrlKey || e.metaKey || e.altKey) return;
      rotateSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const plot = plots.find((p) => p.id === activeId) || null;
  const update = (fn) =>
    setPlots((ps) => {
      const next = ps.map((p) => (p.id === activeId ? fn(p) : p));
      if (next === ps) return ps;
      pastRef.current.push(ps);
      if (pastRef.current.length > 80) pastRef.current.shift();
      futureRef.current = [];
      return next;
    });

  const undo = () => {
    const prev = pastRef.current.pop();
    if (!prev) return;
    setPlots((cur) => {
      futureRef.current.push(cur);
      return prev;
    });
    setSelection(null);
  };
  const redo = () => {
    const next = futureRef.current.pop();
    if (!next) return;
    setPlots((cur) => {
      pastRef.current.push(cur);
      return next;
    });
    setSelection(null);
  };
  // A deleted selection points at items that no longer exist — drop it so
  // the details panel stops showing a ghost selection.
  useEffect(() => {
    const valid = selectionValid(plot, selection);
    if (valid !== selection) setSelection(valid);
  });
  const totals = plot ? plotTotals(plot) : null;

  // Size & procurement are chosen in the setup dialog at creation.
  const addPlot = (kind) => setSetupKind(kind);

  const createPlot = (p) => {
    pastRef.current.push(plots);
    futureRef.current = [];
    setPlots((ps) => [...ps, p]);
    setActiveId(p.id);
    setFloorId(p.floors[0].id);
    setSelection(null);
    setTool(null);
    setSetupKind(null);
  };

  const deletePlot = () => {
    if (!plot) return;
    pastRef.current.push(plots);
    futureRef.current = [];
    setPlots((ps) => ps.filter((p) => p.id !== plot.id));
    const next = plots.find((p) => p.id !== plot.id);
    setActiveId(next ? next.id : null);
    setFloorId(next ? next.floors[0]?.id : null);
    setSelection(null);
    setTool(null);
    toast("Plot deleted.");
  };

  if (!plots.length) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 bg-background text-foreground">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-primary">Homebuilder</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Design a home, business, bastion or any hybrid of the three — one grid space per square.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {PLOT_KINDS.map((k) => (
            <Button key={k.id} variant="outline" className="h-20 w-44 flex-col gap-1.5" onClick={() => addPlot(k.id)}>
              <KindIcons ids={k.kinds} size="h-5 w-5" />
              <span className="text-sm font-medium">{k.label}</span>
            </Button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={onExit}><ArrowLeft className="h-4 w-4" /> Back to menu</Button>
        <PlotSetupDialog kind={setupKind} onClose={() => setSetupKind(null)} onCreate={createPlot} />
      </div>
    );
  }

  const floors = plot ? [...plot.floors].sort((a, b) => a.index - b.index) : [];
  const floor = floors.find((f) => f.id === floorId) || floors[0] || null;

  const addFloor = (below) => {
    const above = plot.floors.filter((f) => f.index >= 0);
    const cellars = plot.floors.filter((f) => f.index < 0);
    const next = below
      ? { id: uid(), name: `Cellar ${cellars.length + 1}`, index: Math.min(...cellars.map((f) => f.index), 0) - 1 }
      : { id: uid(), name: `${ordinal(above.length + 1)} Floor`, index: Math.max(...above.map((f) => f.index), -1) + 1 };
    update((p) => ({ ...p, floors: [...p.floors, next] }));
    setFloorId(next.id);
    setSelection(null);
    setTool(null);
  };

  // Drag one floor tab onto another to rearrange the storeys; the vertical
  // order (and so each floor's index) follows the new tab order.
  const reorderFloors = (srcId, dstId) => {
    if (!srcId || srcId === dstId) return;
    update((p) => {
      const above = p.floors.filter((f) => f.index >= 0).sort((a, b) => a.index - b.index);
      const from = above.findIndex((f) => f.id === srcId);
      const to = above.findIndex((f) => f.id === dstId);
      if (from < 0 || to < 0) return p; // cellars keep their depth order
      const [moved] = above.splice(from, 1);
      above.splice(to, 0, moved);
      const idx = new Map(above.map((f, i) => [f.id, i]));
      return { ...p, floors: p.floors.map((f) => (idx.has(f.id) ? { ...f, index: idx.get(f.id) } : f)) };
    });
  };

  const renameFloor = () => {
    if (!renaming) return;
    update((p) => ({
      ...p,
      floors: p.floors.map((f) => (f.id === renaming ? { ...f, name: draft.trim() || f.name } : f)),
    }));
    setRenaming(null);
  };

  const deleteFloor = () => {
    if (floors.length <= 1) return;
    const goneIds = new Set(plot.facilities.filter((f) => f.floorId === floor.id).map((f) => f.id));
    const rest = floors.filter((f) => f.id !== floor.id);
    update((p) => ({
      ...p,
      floors: p.floors.filter((f) => f.id !== floor.id),
      facilities: p.facilities.filter((f) => f.floorId !== floor.id),
      furnishings: p.furnishings.filter((fu) => !goneIds.has(fu.facilityId)),
      connections: (p.connections || []).filter((c) => c.floorId !== floor.id),
      walls: (p.walls || []).filter((wl) => wl.floorId !== floor.id),
    }));
    setFloorId(rest[0].id);
    setSelection(null);
    setTool(null);
  };

  const st = plot ? STATIONS[plot.comfort] || STATIONS.modest : null;
  const isLand = plot?.ownership === "land";

  // Save the active plot to a file; Load reads one back, replacing a plot
  // with the same id or adding it as a new one. (Plots also auto-save to the
  // browser on every change.)
  const exportPlot = () => {
    if (!plot) return;
    const blob = new Blob([JSON.stringify(plot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(plot.name || "plot").replace(/[^\w-]+/g, "_")}.homestead.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Plot saved to a file.");
  };

  const importPlotFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const list = (Array.isArray(data) ? data : [data]).filter((p) => p && p.id && Array.isArray(p.floors));
        if (!list.length) return toast("That file doesn't look like a saved plot.");
        setPlots((ps) => {
          const byId = new Map(ps.map((p) => [p.id, p]));
          for (const p of list) byId.set(p.id, p);
          return [...byId.values()];
        });
        setActiveId(list[0].id);
        setFloorId(list[0].floors[0]?.id || null);
        setSelection(null);
        setTool(null);
        toast(`Loaded ${list.length} plot${list.length === 1 ? "" : "s"}.`);
      } catch {
        toast("Couldn't read that file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2">
        <Button size="icon" variant="outline" className="h-8 w-8" title="Back to menu" onClick={onExit}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Select value={activeId} onValueChange={(v) => { setActiveId(v); const p = plots.find((x) => x.id === v); setFloorId(p?.floors[0]?.id || null); setSelection(null); setTool(null); }}>
          <SelectTrigger className="h-8 w-52"><SelectValue placeholder="Plot…" /></SelectTrigger>
          <SelectContent>
            {plots.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="inline-flex items-center gap-1.5">
                  <KindIcons ids={plotKinds(p)} size="h-3.5 w-3.5" />
                  {p.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-8"><Plus className="h-4 w-4" /> New plot</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {PLOT_KINDS.map((k) => (
              <DropdownMenuItem key={k.id} onClick={() => addPlot(k.id)}>
                <KindIcons ids={k.kinds} size="h-4 w-4" /> {k.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {plot && (
          <>
            <Input className="h-8 w-44" value={plot.name} onChange={(e) => update((p) => ({ ...p, name: e.target.value }))} />
            <Select value={plot.kind} onValueChange={(v) => update((p) => ({ ...p, kind: v }))}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLOT_KINDS.map((k) => <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {totals.gp.toLocaleString()} gp · {totals.weeks} wk · {totals.spaces.toLocaleString()} spaces
            </span>
            <Button
              size="sm" variant={devMode ? "secondary" : "outline"} className="h-8"
              title="Devmode: change procurement, land tier and the boundary after creation"
              onClick={() => setDevMode((d) => !d)}
            >
              <Wrench className="h-4 w-4" /> Devmode
            </Button>
            <Button size="sm" variant="outline" className="ml-auto h-8" title="Download this plot as a file" onClick={exportPlot}>
              <Download className="h-4 w-4" /> Save plot
            </Button>
            <Button size="sm" variant="outline" className="h-8" title="Load a saved plot file" onClick={() => loadRef.current?.click()}>
              <Upload className="h-4 w-4" /> Load plot
            </Button>
            <input
              ref={loadRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importPlotFile(f); }}
            />
            <Button size="sm" variant="destructive" className="h-8" onClick={deletePlot}>
              <Trash2 className="h-4 w-4" /> Delete plot
            </Button>
          </>
        )}
      </header>

      <PlotSetupDialog kind={setupKind} onClose={() => setSetupKind(null)} onCreate={createPlot} />

      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 space-y-2 overflow-y-auto border-r p-3">
          {plot && (
            <>
              <MetaPanel plot={plot} update={update} isLand={isLand} devMode={devMode} />
              <p className="pt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Place on the grid</p>
              <HomesteadPalette plot={plot} tool={tool} setTool={setTool} />
            </>
          )}
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
          {plot && floor && (
            <div className="flex flex-wrap items-center gap-1.5">
              {floors.map((f) => (
                <div key={f.id}
                  draggable={f.index >= 0}
                  title={f.index >= 0 ? "Drag onto another floor to rearrange" : undefined}
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", f.id)}
                  onDragOver={(e) => { if (f.index >= 0) e.preventDefault(); }}
                  onDrop={(e) => { e.preventDefault(); reorderFloors(e.dataTransfer.getData("text/plain"), f.id); }}
                  className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${f.id === floor.id ? "border-primary bg-accent font-medium" : "text-muted-foreground hover:bg-accent/60"}`}
                >
                  {renaming === f.id ? (
                    <Input autoFocus className="h-6 w-28 text-xs" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={renameFloor}
                      onKeyDown={(e) => { if (e.key === "Enter") renameFloor(); if (e.key === "Escape") setRenaming(null); }} />
                  ) : (
                    <button className="max-w-32 truncate" title="Double-click to rename" onClick={() => { setFloorId(f.id); setSelection(null); setTool(null); }}
                      onDoubleClick={() => { setRenaming(f.id); setDraft(f.name); }}>
                      {f.name}
                    </button>
                  )}
                  {renaming === f.id && (
                    <button title="Rename floor" onClick={renameFloor}><Pencil className="h-3 w-3" /></button>
                  )}
                </div>
              ))}
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => addFloor(false)}>+ Floor above</Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => addFloor(true)}>+ Cellar below</Button>
              {floors.length > 1 && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={deleteFloor}>Delete floor</Button>
              )}
            </div>
          )}
          {plot && floor ? (
            <HomesteadCanvas
              plot={plot} floor={floor} tool={tool} setTool={setTool}
              selection={selection} onSelect={setSelection} update={update}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Pick or create a plot.</div>
          )}
        </main>

        <aside className="w-72 shrink-0 space-y-3 overflow-y-auto border-l p-3">
          {plot && selection ? (
            <SelectedPanel plot={plot} selection={selection} update={update} />
          ) : plot ? (
            <p className="rounded-lg border bg-accent/30 p-3 text-xs text-muted-foreground">
              Select a facility, furnishing or connection to edit it — or pick a tool on the left and click the grid to place it.
              Basic facilities: {st.fac[2]} Cramped / {st.fac[1]} Roomy / {st.fac[0]} Vast recommended for {st.label}.
            </p>
          ) : null}
          {plot && (
            <Tabs defaultValue="summary">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="summary" className="text-[11px]">Summary</TabsTrigger>
                <TabsTrigger value="benefits" className="text-[11px]">Benefits</TabsTrigger>
                <TabsTrigger value="actions" className="text-[11px]">Actions</TabsTrigger>
              </TabsList>
              <TabsContent value="summary" className="mt-2 space-y-2">
                <HomesteadSummary plot={plot} update={update} />
                <LivingStylePanel plot={plot} />
                <LivingQualityPanel plot={plot} />
              </TabsContent>
              <TabsContent value="benefits" className="mt-2">
                <HomesteadBenefits plot={plot} />
              </TabsContent>
              <TabsContent value="actions" className="mt-2 space-y-2">
                <LaborPanel plot={plot} update={update} />
                <HomesteadTurns plot={plot} update={update} />
                <HomesteadActions plot={plot} update={update} />
              </TabsContent>
            </Tabs>
          )}
        </aside>
      </div>
    </div>
  );
}

// Ownership & meta for the active plot: how it's held, comfort level, staff
// and mortgage tracking.
function MetaPanel({ plot, update, isLand, devMode }) {
  const own = OWNERSHIP.find((o) => o.id === plot.ownership) || OWNERSHIP[0];
  return (
    <div className="space-y-2 rounded-lg border bg-accent/30 p-2.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Property</p>
      <Select value={plot.ownership} onValueChange={(v) => update((p) => ({ ...p, ownership: v }))} disabled={!devMode}>
        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
        <SelectContent>
          {OWNERSHIP.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        {own.note}{!devMode && " Set at creation — enable Devmode to change it."}
      </p>
      {isLand ? (
        <Select value={plot.landTier} onValueChange={(v) => update((p) => ({ ...p, landTier: v }))} disabled={!devMode}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {COMFORT_LEVELS.filter((c) => STATIONS[c].land.spaces > 0).map((c) => (
              <SelectItem key={c} value={c}>{STATIONS[c].label} land — {STATIONS[c].land.cost.toLocaleString()} gp, {STATIONS[c].land.spaces} spaces</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Select value={plot.comfort} onValueChange={(v) => update((p) => ({ ...p, comfort: v }))}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {COMFORT_LEVELS.map((c) => (
              <SelectItem key={c} value={c}>{STATIONS[c].label} — {STATIONS[c].value.toLocaleString()} gp</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <div className="flex items-center gap-2">
        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Staff</Label>
        <Input type="number" min="0" className="h-7 w-16" value={plot.staff}
          onChange={(e) => update((p) => ({ ...p, staff: Math.max(0, Number(e.target.value) || 0) }))} />
        <span className="text-[10px] text-muted-foreground">× 5 gp/mo</span>
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Char level</Label>
        <Input type="number" min="1" max="20" className="h-7 w-16" value={plot.charLevel || 5}
          onChange={(e) => update((p) => ({ ...p, charLevel: Math.min(20, Math.max(1, Number(e.target.value) || 5)) }))} />
        <span className="text-[10px] text-muted-foreground">gates Bastion facilities</span>
      </div>
      {plot.ownership === "mortgaged" && (
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Mortgage (gp)</Label>
          <div className="flex items-center gap-1.5">
            <Input type="number" min="0" className="h-7 w-20" placeholder="Total" value={plot.mortgageTotal || ""} onChange={(e) => update((p) => ({ ...p, mortgageTotal: Number(e.target.value) || 0 }))} />
            <span className="text-[10px] text-muted-foreground">of</span>
            <Input type="number" min="0" className="h-7 w-20" placeholder="Paid" value={plot.mortgagePaid || ""} onChange={(e) => update((p) => ({ ...p, mortgagePaid: Number(e.target.value) || 0 }))} />
          </div>
          <p className="text-[10px] text-muted-foreground">Value +25%, 10% down; missing 3 payments forecloses.</p>
        </div>
      )}
      <Textarea className="h-16 text-xs" placeholder="Notes — lease terms, landlord, conditions…" value={plot.notes} onChange={(e) => update((p) => ({ ...p, notes: e.target.value }))} />
    </div>
  );
}