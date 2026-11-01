import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FACILITY_TYPES, ATTACHMENTS, furnishingByName, WALL_TYPES, firstFitRoom, uid,
  bastionFacilityByName,
} from "@/lib/homestead";
import { Trash2, ImagePlus } from "lucide-react";
import { deleteSelectionFromPlot } from "@/lib/homesteadEdit";
import { importImage } from "@/lib/imageStore";
import { FLOOR_TEXTURES, floorTexture } from "@/lib/worldAssets";

// Details for the selected facility, furnishing or connection: rename, resize
// (where allowed), "chosen at creation" options, per-facility Attic/Cellar
// attachments with their rooms, and the delete action.
export default function SelectedPanel({ plot, selection, update }) {
  if (!selection) return null;

  // Box-selected group: counts by type and a bulk delete.
  if (selection.kind === "multi") {
    const items = selection.items;
    if (!items.length) return null;
    const facIds = new Set(items.filter((i) => i.kind === "facility").map((i) => i.id));
    const furIds = new Set(items.filter((i) => i.kind === "furnishing").map((i) => i.id));
    const conIds = new Set(items.filter((i) => i.kind === "connection").map((i) => i.id));
    const walIds = new Set(items.filter((i) => i.kind === "wall").map((i) => i.id));
    const parts = [];
    if (facIds.size) parts.push(`${facIds.size} facilit${facIds.size === 1 ? "y" : "ies"}`);
    if (furIds.size) parts.push(`${furIds.size} furnishing${furIds.size === 1 ? "" : "s"}`);
    if (conIds.size) parts.push(`${conIds.size} connection${conIds.size === 1 ? "" : "s"}`);
    if (walIds.size) parts.push(`${walIds.size} wall${walIds.size === 1 ? "" : "s"}`);
    return (
      <div className="space-y-3">
        <Header title={`${items.length} selected`} sub={parts.join(" · ")} />
        <p className="text-[11px] text-muted-foreground">
          Click one item to edit it on its own, or drag a new box to change the selection.
        </p>
        <DeleteBtn
          onDelete={() => update((p) => deleteSelectionFromPlot(p, selection))}
          label="Delete selected"
          note="Furnishings placed inside deleted facilities are removed too."
        />
      </div>
    );
  }

  const { kind, id } = selection;

  if (kind === "facility") {
    const f = plot.facilities.find((x) => x.id === id);
    if (!f) return null;
    const bf = bastionFacilityByName(f.bastion);
    const def = FACILITY_TYPES[f.type];
    const area = f.w * f.h;
    const gp = def.costPerSpace ? def.costPerSpace * area : def.cost || 0;
    const weeks = def.weeksPerArea ? Math.ceil(area / def.weeksPerArea) : def.weeks || 0;
    return (
      <div className="space-y-3">
        <Header
          title={f.name || f.type}
          sub={bf
            ? bf.seatOfPower
              ? "Seat of Power · 4×4 · Bastion only · free · does not count against known facilities"
              : `${f.type} · Level ${bf.level} special facility — claimed free, no gold or build time`
            : `${f.type} · ${area} spaces · ${gp.toLocaleString()} gp · ${weeks} wk`}
        />
        <Row label="Name">
          <Input className="h-8" value={f.name || ""} onChange={(e) => updFac(update, f.id, { name: e.target.value })} />
        </Row>
        <Row label="Floor texture">
          <select
            className="h-8 w-full rounded border bg-background px-1 text-xs"
            value={f.floorTexture || "stone"}
            onChange={(e) =>
              updFac(update, f.id, { floorTexture: e.target.value, floorImage: "" })
            }
          >
            {f.floorTexture === "custom" && <option value="custom">Custom image</option>}
            {FLOOR_TEXTURES.map((texture) => (
              <option key={texture.id} value={texture.id}>{texture.label}</option>
            ))}
          </select>
        </Row>
        <div className="flex flex-wrap items-center gap-1">
          <label className="flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-[10px] hover:bg-accent">
            <ImagePlus className="h-3.5 w-3.5" /> Import floor image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const url = await importImage(file, { maxEdge: 1024 });
                updFac(update, f.id, { floorImage: url });
              }}
            />
          </label>
          {f.floorImage && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-1 text-[9px]"
              onClick={() => updFac(update, f.id, { floorImage: "" })}
            >
              Clear image
            </Button>
          )}
          <span className="text-[9px] text-muted-foreground">
            {floorTexture(f.floorTexture).label}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {bf
            ? bf.seatOfPower
              ? "Seat of Power. This 4×4 throne room is a Bastion-only special facility. It is free, and it does not count against your known Bastion facilities."
              : `Level ${bf.level} special facility${bf.prereq ? ` — requires ${bf.prereq}` : ""}. ${bf.hirelings} hireling${bf.hirelings === 1 ? "" : "s"}. Can be swapped for another qualifying facility on a level-up.`
            : def.desc}
        </p>
        {def.resizable && (
          <Row label={`Size (${def.minSpaces || 1}+ spaces)`}>
            <SizeInput value={f.w} onChange={(w) => updFac(update, f.id, { w: Math.max(1, w) })} />
            <span className="text-muted-foreground">×</span>
            <SizeInput value={f.h} onChange={(h) => updFac(update, f.id, { h: Math.max(1, h) })} />
          </Row>
        )}
        {!bf && (f.type === "Cramped" || f.type === "Roomy" || f.type === "Vast") &&
          ["attic", "floor", "cellar"].map((keyName) => (
            <AttachmentEditor key={keyName} plot={plot} f={f} keyName={keyName} update={update} />
          ))}
        <DeleteBtn
          onDelete={() => update((p) => deleteSelectionFromPlot(p, selection))}
          label="Delete facility"
          note="Furnishings placed inside it are removed too."
        />
      </div>
    );
  }

  if (kind === "furnishing") {
    const fu = plot.furnishings.find((x) => x.id === id);
    if (!fu) return null;
    const def = furnishingByName(fu.type) || {};
    return (
      <div className="space-y-3">
        <Header title={fu.type} sub={`${fu.w * fu.h} spaces · ${25 * fu.w * fu.h} gp · ${Math.ceil((fu.w * fu.h) / 4)} wk`} />
        <Row label="Label (optional)">
          <Input className="h-8" value={fu.label || ""} placeholder={fu.type} onChange={(e) => updFur(update, fu.id, { label: e.target.value })} />
        </Row>
        {def.options && (
          <Row label="Chosen at creation">
            <Input className="h-8" value={fu.option || ""} placeholder={def.options[0]} onChange={(e) => updFur(update, fu.id, { option: e.target.value })} />
          </Row>
        )}
        <Row label="Size (spaces)">
          <SizeInput value={fu.w} onChange={(w) => updFur(update, fu.id, { w: Math.max(1, w) })} />
          <span className="text-muted-foreground">×</span>
          <SizeInput value={fu.h} onChange={(h) => updFur(update, fu.id, { h: Math.max(1, h) })} />
        </Row>
        {def.min > fu.w * fu.h && (
          <p className="text-[11px] font-medium text-destructive">
            Minimum {def.min} spaces ({def.foot[0]}×{def.foot[1]}) for a {fu.type}.
          </p>
        )}
        <p className="text-[11px] leading-relaxed">
          <span className="font-semibold">Requirements: </span>
          <span className="text-muted-foreground">{def.req || "None"}</span>
        </p>
        <p className="text-[11px] leading-relaxed">
          <span className="font-semibold">Benefits: </span>
          <span className="text-muted-foreground">{def.benefits}</span>
        </p>
        {def.limit && <p className="text-[11px] text-muted-foreground">Limit: {def.limit === 1 ? 1 : def.limit}</p>}
        <DeleteBtn onDelete={() => update((p) => deleteSelectionFromPlot(p, selection))} label="Remove furnishing" />
      </div>
    );
  }

  if (kind === "connection") {
    const c = (plot.connections || []).find((x) => x.id === id);
    if (!c) return null;
    return (
      <div className="space-y-3">
        <Header title={c.type} sub={c.w > 1 || c.h > 1 ? `${Math.max(c.w, c.h)} spaces · 25 gp · 1 week` : "1 space · 25 gp · 1 week"} />
        <p className="text-[11px] text-muted-foreground">
          {c.type === "Doorway" && (c.w > 1 || c.h > 1)
            ? "A drawn door — drag it to slide it along its wall or frame."
            : "Connects 2+ facilities; corridors may be built as unfurnishable hallways between facilities."}
        </p>
        <DeleteBtn onDelete={() => update((p) => deleteSelectionFromPlot(p, selection))} label="Remove connection" />
      </div>
    );
  }

  if (kind === "wall") {
    const wl = (plot.walls || []).find((x) => x.id === id);
    if (!wl) return null;
    const def = WALL_TYPES[wl.type] || WALL_TYPES.Wall;
    return (
      <div className="space-y-3">
        <Header
          title={wl.type}
          sub={`${wl.w * wl.h} spaces · ${(def.gpPerSpace * wl.w * wl.h).toLocaleString()} gp · ${Math.ceil((wl.w * wl.h) / def.weeksPer)} wk`}
        />
        <p className="text-[11px] text-muted-foreground">{def.desc}</p>
        <DeleteBtn onDelete={() => update((p) => deleteSelectionFromPlot(p, selection))} label={`Remove ${wl.type.toLowerCase()}`} />
      </div>
    );
  }

  return null;
}

function Header({ title, sub }) {
  return (
    <div>
      <p className="font-display text-sm font-semibold">{title}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</Label>
      <div className="mt-1 flex items-center gap-1.5">{children}</div>
    </div>
  );
}

const SizeInput = ({ value, onChange }) => (
  <Input type="number" min="1" className="h-8 w-16" value={value} onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))} />
);

const DeleteBtn = ({ onDelete, label, note }) => (
  <div>
    <Button variant="destructive" size="sm" className="w-full" onClick={onDelete}>
      <Trash2 className="h-4 w-4" /> {label}
    </Button>
    {note && <p className="mt-1 text-[10px] text-muted-foreground">{note}</p>}
  </div>
);

const updFac = (update, id, patch) =>
  update((p) => ({ ...p, facilities: p.facilities.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
const updFur = (update, id, patch) =>
  update((p) => ({ ...p, furnishings: p.furnishings.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));

// Per-facility attic or cellar: toggle it on the facility, then add rooms
// from the homebrew's allowed list. Each room costs 50 gp per space and the
// attachment takes 2 weeks to install.
function AttachmentEditor({ plot: _plot, f, keyName, update }) {
  const at = f[keyName] || { on: false, items: [] };
  const conf = ATTACHMENTS[keyName];
  const used = at.items.reduce((n, it) => n + it.w * it.h, 0);
  const capacity = f.w * f.h;

  const setUp = (patch) =>
    update((p) => ({
      ...p,
      facilities: p.facilities.map((x) =>
        x.id === f.id ? { ...x, [keyName]: { on: false, items: [], ...at, ...patch } } : x
      ),
    }));

  const addRoom = (type) => {
    const def = furnishingByName(type);
    if (!def) return;
    const pos = firstFitRoom(f, at.items, def.foot[0], def.foot[1]);
    if (!pos) return;
    setUp({ items: [...at.items, { id: uid(), type, w: def.foot[0], h: def.foot[1], x: pos.x, y: pos.y }] });
  };

  return (
    <div className="rounded-lg border bg-accent/30 p-2.5">
      <label className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">{conf.label}</span>
        <input
          type="checkbox"
          className="h-4 w-4 accent-[hsl(var(--primary))]"
          checked={!!at.on}
          onChange={(e) => setUp({ on: e.target.checked })}
        />
      </label>
      <p className="mt-1 text-[10px] text-muted-foreground">{conf.desc}</p>
      {at.on && (
        <div className="mt-2 space-y-1.5">
          {at.items.map((it, i) => (
            <div key={it.id || i} className="flex items-center gap-1.5 text-xs">
              <span className="min-w-0 flex-1 truncate">{it.type}</span>
              <span className="text-muted-foreground">{it.w * it.h} sp · {50 * it.w * it.h} gp</span>
              <Button
                size="icon" variant="ghost" className="h-6 w-6"
                onClick={() => setUp({ items: at.items.filter((_, j) => j !== i) })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Select value="" onValueChange={addRoom}>
            <SelectTrigger className="h-8" disabled={used >= capacity}>
              <SelectValue placeholder={used >= capacity ? "Attic full" : `Add a room… (${used}/${capacity} spaces)`} />
            </SelectTrigger>
            <SelectContent>
              {conf.allowed.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">
            Total: {50 * used} gp · 2 weeks · allowed here: {conf.allowed.join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}