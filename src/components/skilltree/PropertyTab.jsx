import { useState } from "react";
import { useTree } from "@/lib/treeStore";
import { loadPlots, snapshotPlot } from "@/lib/homesteadStore";
import {
  plotTotals, plotUpkeep, STATIONS, OWNERSHIP_BY_ID, FACILITY_TYPES,
  plotKinds, plotKindLabel,
} from "@/lib/homestead";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Home, Store, Castle, Download, RefreshCw, Trash2 } from "lucide-react";

const KIND_ICONS = { home: Home, business: Store, bastion: Castle };
const KindIcons = ({ ids, size = "h-5 w-5" }) => (
  <span className="inline-flex items-center gap-0.5">
    {ids.map((k) => {
      const Icon = KIND_ICONS[k];
      return Icon ? <Icon key={k} className={`${size} text-primary`} /> : null;
    })}
  </span>
);

// The sheet's Property tab: properties imported (snapshotted) from the
// Homebuilder — everything shows: ownership, comfort, costs, upkeep, and the
// full floor-by-floor facility / furnishing layout.
export function PropertyTab() {
  const { character, setCharacter } = useTree();
  const [importOpen, setImportOpen] = useState(false);
  const props_ = character.properties || [];

  const importPlots = (ids) => {
    const store = loadPlots();
    const snaps = ids.map((id) => store.find((p) => p.id === id)).filter(Boolean).map(snapshotPlot);
    if (!snaps.length) return;
    setCharacter({
      ...character,
      properties: [...props_.filter((p) => !ids.includes(p.id)), ...snaps],
    });
    setImportOpen(false);
    toast(`Imported ${snaps.length} propert${snaps.length === 1 ? "y" : "ies"}.`);
  };

  const refresh = (snapId) => {
    const snap = props_.find((p) => p.id === snapId);
    const fresh = loadPlots().find((p) => p.id === snapId);
    if (!fresh) return toast("That plot no longer exists in the Homebuilder.");
    setCharacter({
      ...character,
      properties: props_.map((p) => (p.id === snapId ? { ...snapshotPlot(fresh), importedAt: snap.importedAt } : p)),
    });
    toast("Refreshed from the Homebuilder.");
  };

  const remove = (snapId) =>
    setCharacter({ ...character, properties: props_.filter((p) => p.id !== snapId) });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setImportOpen(true)}>
          <Download className="h-4 w-4" /> Import property
        </Button>
      </div>
      {props_.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          No properties yet. Build one in the Homebuilder (front page) and import it here.
        </p>
      ) : (
        props_.map((p) => <PropertyCard key={p.id} prop={p} onRefresh={() => refresh(p.id)} onRemove={() => remove(p.id)} />)
      )}
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={importPlots} existing={props_.map((p) => p.id)} />
    </div>
  );
}

function PropertyCard({ prop, onRefresh, onRemove }) {
  const t = plotTotals(prop);
  const up = plotUpkeep(prop);
  const isLand = prop.ownership === "land";
  const st = STATIONS[isLand ? prop.landTier : prop.comfort] || STATIONS.modest;
  const kinds = plotKinds(prop);
  const own = OWNERSHIP_BY_ID[prop.ownership];
  const floors = [...(prop.floors || [])].sort((a, b) => a.index - b.index);
  const upkeepTotal = Math.round((up.utilities + up.taxes + up.staff + up.privies) * 100) / 100;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <KindIcons ids={kinds} />
        <span className="font-display text-base font-semibold">{prop.name}</span>
        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">{plotKindLabel(prop)}</span>
        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{own?.label || prop.ownership}</span>
        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{st.label}</span>
        <span className="ml-auto flex gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Re-import latest version from the Homebuilder" onClick={onRefresh}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Remove from sheet" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Construction cost" value={`${t.gp.toLocaleString()} gp`} />
        <Stat label="Build time" value={`${t.weeks} wk`} />
        <Stat label="Spaces" value={t.spaces.toLocaleString()} />
        <Stat label="Facilities (V/R/C)" value={`${t.facCounts.Vast}/${t.facCounts.Roomy}/${t.facCounts.Cramped}`} />
        <Stat label="Upkeep / month" value={`${upkeepTotal.toLocaleString()} gp`} />
        <Stat label="Utilities" value={`${up.utilities.toLocaleString()} gp`} />
        <Stat label="Taxes" value={`${up.taxes.toLocaleString()} gp`} />
        {prop.staff > 0 && <Stat label="Staff" value={`${prop.staff} × 5 gp`} />}
        {prop.ownership === "mortgaged" && (
          <Stat label="Mortgage" value={`${prop.mortgagePaid || 0} / ${prop.mortgageTotal || 0} gp`} />
        )}
      </div>

      <div className="mt-3 space-y-2 border-t pt-2">
        {floors.map((fl) => {
          const facs = (prop.facilities || []).filter((f) => f.floorId === fl.id);
          return (
            <div key={fl.id}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{fl.name}</p>
              {facs.length === 0 && <p className="text-[11px] text-muted-foreground">No structures.</p>}
              <div className="mt-1 space-y-1">
                {facs.map((f) => {
                  const def = FACILITY_TYPES[f.type];
                  const inside = (prop.furnishings || []).filter((fu) => fu.facilityId === f.id);
                  const attach = ["attic", "cellar"].map((k) => ({ k, at: f[k] })).filter((x) => x.at?.on && x.at.items?.length);
                  return (
                    <div key={f.id} className="rounded-lg border bg-accent/20 px-2.5 py-1.5">
                      <p className="text-xs font-medium">
                        {f.name || f.type}
                        <span className="ml-1.5 text-[10px] text-muted-foreground">
                          {f.type} · {f.w}×{f.h} ({f.w * f.h} sp) · {def?.desc || ""}
                        </span>
                      </p>
                      {inside.length > 0 && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {inside.map((fu) => `${fu.label || fu.type}${fu.option ? ` (${fu.option})` : ""} — ${fu.w}×${fu.h}`).join(" · ")}
                        </p>
                      )}
                      {attach.map(({ k, at }) => (
                        <p key={k} className="mt-0.5 text-[11px] text-muted-foreground">
                          {k === "attic" ? "Attic" : "Cellar"}: {at.items.map((it) => `${it.type} (${it.w * it.h} sp)`).join(", ")}
                        </p>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {prop.notes && <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">{prop.notes}</p>}
    </div>
  );
}

const Stat = ({ label, value }) => (
  <div>
    <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
    <p className="font-medium">{value}</p>
  </div>
);

function ImportDialog({ open, onClose, onImport, existing }) {
  const plots = open ? loadPlots() : [];
  const [picked, setPicked] = useState([]);
  const fresh = plots.filter((p) => !existing.includes(p.id));
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setPicked([]); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import properties</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          A snapshot copy is stored on this character; use Refresh on a property card to pull in later edits.
        </p>
        <div className="max-h-72 space-y-1.5 overflow-y-auto">
          {plots.length === 0 && <p className="text-sm text-muted-foreground">No plots saved in the Homebuilder yet.</p>}
          {plots.map((p) => (
            <label key={p.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <Checkbox
                checked={picked.includes(p.id)}
                onCheckedChange={(c) => setPicked((s) => (c ? [...s, p.id] : s.filter((x) => x !== p.id)))}
              />
              <span className="flex-1">{p.name}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {plotKindLabel(p)}
                {!fresh.includes(p) && " · imported"}
              </span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!picked.length} onClick={() => { onImport(picked); setPicked([]); }}>
            Import {picked.length || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}