import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FACILITY_TYPES, CONNECTION_TYPES, FURNISHINGS, FURNISH_CATS, STATIONS,
  WALL_TYPES, plotHasKind, BASTION_FACILITIES, BASTION_LEVELS,
} from "@/lib/homestead";
import { MousePointer2, Hammer, Ban, Search, ChevronDown, ChevronRight } from "lucide-react";

function PaletteSection({ title, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-1 mt-3 flex w-full items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {title}
      </button>
      {open && <div className="space-y-1">{children}</div>}
    </div>
  );
}

// Left-hand tool palette: pick a structure, furnishing or connection, then
// click the canvas to place it. Search and collapsible sections keep the long
// list manageable. Business-only rooms stay disabled on other plot kinds.
export default function HomesteadPalette({ plot, tool, setTool }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const pick = (t) => setTool(tool && tool.type === t.type && tool.kind === t.kind ? null : t);
  const isPick = (kind, type) => tool && tool.kind === kind && tool.type === type;
  const biz = plotHasKind(plot, "business");
  const st = STATIONS[plot.comfort] || STATIONS.modest;
  const level = plot.charLevel || 5;

  const toolBtn = (t, sub, disabled, note) => {
    if (q && !`${t.type} ${sub || ""}`.toLowerCase().includes(q)) return null;
    return (
    <Button
      key={`${t.kind}:${t.type}`}
      variant={isPick(t.kind, t.type) ? "secondary" : "outline"}
      size="sm"
      disabled={disabled}
      title={note || sub}
      className="h-auto w-full justify-start px-2.5 py-1.5 text-left"
      onClick={() => pick(t)}
    >
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium">{t.type}</span>
        <span className="block truncate text-[10px] text-muted-foreground">{sub}</span>
      </span>
    </Button>
    );
  };

  const section = (title, children) => {
    const list = [].concat(children).filter(Boolean);
    if (q && !list.length) return null;
    return (
      <PaletteSection key={title} title={title}>
        {list}
      </PaletteSection>
    );
  };

  return (
    <div className="space-y-0.5">
      <div className="relative">
        <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          className="h-8 pl-7 text-xs"
          placeholder="Search tools and rooms…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <Button
        variant={!tool ? "secondary" : "outline"}
        size="sm"
        className="h-auto w-full justify-start px-2.5 py-1.5"
        onClick={() => setTool(null)}
      >
        <MousePointer2 className="h-3.5 w-3.5" /> Select / Move
      </Button>

      {section("Facilities",
        ["Cramped", "Roomy", "Vast"].map((type) =>
          toolBtn({ kind: "facility", type }, FACILITY_TYPES[type].desc)
        )
      )}

      {section("Bastion special facilities",
        BASTION_LEVELS.map((lv) => {
          const items = BASTION_FACILITIES.filter((b) => b.level === lv)
            .map((b) => {
              const size = FACILITY_TYPES[b.space];
              const locked = level < b.level;
              const base = `${b.space} (${size.w}×${size.h}) · ${b.hirelings} hireling${b.hirelings === 1 ? "" : "s"} · free — no gold or build time`;
              return toolBtn(
                { kind: "bastion", type: b.name },
                locked ? `Level ${b.level} · locked` : base,
                locked,
                locked
                  ? `Requires character level ${b.level}${b.prereq ? ` · ${b.prereq}` : ""}`
                  : `${b.prereq ? `${b.prereq} · ` : ""}${base}${b.multi ? "" : " · one only"}`
              );
            })
            .filter(Boolean);
          if (!items.length) return null;
          return (
            <div key={lv}>
              <p className="mb-1 mt-2 text-[10px] uppercase tracking-widest text-muted-foreground/70">Level {lv}</p>
              <div className="space-y-1">{items}</div>
            </div>
          );
        })
      )}

      {section("Attachments",
        ["Courtyard", "Porch", "Balcony", "Tower"].map((type) =>
          toolBtn({ kind: "attachment", type }, FACILITY_TYPES[type].desc)
        )
      )}

      {section("Connections",
        CONNECTION_TYPES.map(({ type, desc }) => toolBtn({ kind: "connection", type }, desc))
      )}

      {section("Walls & fences",
        Object.keys(WALL_TYPES).map((type) =>
          toolBtn({ kind: "wall", type }, `Drag to draw · ${WALL_TYPES[type].gpPerSpace} gp/space`)
        )
      )}

      {FURNISH_CATS.map((cat) =>
        section(cat === "Business" ? `Business${biz ? "" : " (business only)"}` : cat,
          FURNISHINGS.filter((f) => f.cat === cat).map((f) =>
            toolBtn(
              { kind: "furnish", type: f.name },
              f.foot[0] * f.foot[1] >= (f.min || f.foot[0] * f.foot[1])
                ? `${f.foot[0]}×${f.foot[1]} spaces · 25 gp/space`
                : `${f.min} spaces min · 25 gp/space`,
              f.businessOnly && !biz,
              f.businessOnly && !biz ? "Business property only" : `${f.name} — ${f.foot[0]}×${f.foot[1]} spaces minimum (${f.min || f.foot[0] * f.foot[1]}), 25 gp per space`
            )
          )
        )
      )}

      <p className="mb-1 mt-3 text-[10px] leading-relaxed text-muted-foreground">
        <Hammer className="mr-1 inline h-3 w-3" />
        Bastion special facilities are claimed free at their listed level (DMG'24) — set your character's level in the Property panel. Class prerequisites (spelling foci, Expertise…) are noted on each one and confirmed by your DM.
      </p>
      <p className="mb-1 mt-1 text-[10px] leading-relaxed text-muted-foreground">
        Every furnishing takes 1 week per 4 spaces (rounded up) at 25 gp per space.
        {plot.ownership === "land" && " On undeveloped land, facility construction costs half price."}
      </p>
      {!biz && (
        <p className="flex items-start gap-1 text-[10px] text-muted-foreground">
          <Ban className="mt-0.5 h-3 w-3 shrink-0" />
          Business rooms (Till Counter, Ledger Room, Showroom…) need a Business or hybrid plot.
        </p>
      )}
      <p className="text-[10px] text-muted-foreground">
        Recommended basic facilities for {st.label}: {st.fac[2]} Cramped / {st.fac[1]} Roomy / {st.fac[0]} Vast.
      </p>
    </div>
  );
}