import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  blankPlot, defaultBoundary, OWNERSHIP, OWNERSHIP_BY_ID,
  COMFORT_LEVELS, STATIONS, PLOT_KIND_BY_ID,
} from "@/lib/homestead";

// New-property setup: the plot's size and how it was procured are chosen here,
// at creation — they're not editable afterwards without Devmode.
export default function PlotSetupDialog({ kind, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [ownership, setOwnership] = useState("purchased");
  const [comfort, setComfort] = useState("modest");
  const [landTier, setLandTier] = useState("modest");
  const [w, setW] = useState(4);
  const [h, setH] = useState(4);

  // Re-seed the form each time the dialog opens for a kind.
  useEffect(() => {
    if (!kind) return;
    const p = blankPlot(kind);
    setName("");
    setOwnership(p.ownership);
    setComfort(p.comfort);
    setLandTier(p.landTier || "modest");
    const d = defaultBoundary({ ownership: p.ownership, comfort: p.comfort, landTier: p.landTier });
    setW(d.w);
    setH(d.h);
  }, [kind]);

  const isLand = ownership === "land";
  const tier = STATIONS[isLand ? landTier : comfort] || STATIONS.modest;
  const def = defaultBoundary({ ownership, comfort, landTier });

  // Keep the boundary in step with the procurement/comfort choice; the fields
  // remain editable afterwards for extra land tiles.
  useEffect(() => {
    if (!kind) return;
    const d = defaultBoundary({ ownership, comfort, landTier });
    setW(d.w);
    setH(d.h);
  }, [kind, ownership, comfort, landTier]);

  const create = () => {
    if (!kind) return;
    const p = blankPlot(kind);
    p.name = name.trim() || p.name;
    p.ownership = ownership;
    p.comfort = comfort;
    p.landTier = landTier;
    const bw = Math.max(2, Math.min(40, Number(w) || def.w));
    const bh = Math.max(2, Math.min(40, Number(h) || def.h));
    p.boundary = { w: bw, h: bh };
    const tiles = Math.max(0, bw * bh - def.w * def.h);
    p.landTiles = tiles;
    p.landGold = tiles * 25;
    onCreate(p);
  };

  return (
    <Dialog open={!!kind} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New property — size & procurement</DialogTitle>
        </DialogHeader>
        <div className="space-y-2.5 text-xs">
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Name</Label>
            <Input className="h-8" placeholder={kind ? PLOT_KIND_BY_ID[kind]?.label : ""} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">How it was procured</Label>
            <Select value={ownership} onValueChange={setOwnership}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {OWNERSHIP.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{OWNERSHIP_BY_ID[ownership]?.note}</p>
          </div>
          {isLand ? (
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Land tier</Label>
              <Select value={landTier} onValueChange={setLandTier}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMFORT_LEVELS.filter((c) => STATIONS[c].land.spaces > 0).map((c) => (
                    <SelectItem key={c} value={c}>
                      {STATIONS[c].label} land — {STATIONS[c].land.cost.toLocaleString()} gp, {STATIONS[c].land.spaces} spaces
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Comfort level</Label>
              <Select value={comfort} onValueChange={setComfort}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMFORT_LEVELS.map((c) => (
                    <SelectItem key={c} value={c}>{STATIONS[c].label} — {STATIONS[c].value.toLocaleString()} gp</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Boundary (grid spaces)</Label>
            <div className="flex items-center gap-1.5">
              <Input type="number" min="2" max="40" className="h-8 w-16" value={w} onChange={(e) => setW(e.target.value)} />
              <span className="text-muted-foreground">×</span>
              <Input type="number" min="2" max="40" className="h-8 w-16" value={h} onChange={(e) => setH(e.target.value)} />
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Default {def.w}×{def.h} from the {tier.label} land table — extra tiles cost 25 gp each at purchase.
            </p>
          </div>
          <Button className="w-full" onClick={create}>Create property</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}