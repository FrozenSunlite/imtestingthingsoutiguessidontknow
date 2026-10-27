import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

// A labelled group of editor fields, used to keep the node editor organized.
// Pass collapsible to hide the body behind a chevron (used to de-clutter the
// node editor); defaultOpen shows it expanded initially. sub renders a nested
// group: indented under a rule and with a lighter heading.
const OPEN_STATE = new Map();
export function FieldGroup({ label, children, className = "", collapsible = false, defaultOpen = false, sub = false }) {
  const [open, setOpenState] = useState(() => (OPEN_STATE.has(label) ? OPEN_STATE.get(label) : defaultOpen));
  const setOpen = (v) => setOpenState((prev) => { const next = typeof v === "function" ? v(prev) : v; OPEN_STATE.set(label, next); return next; });
  const shell = sub ? "ml-1 border-l-2 border-border/70 pl-3" : "";
  const head = sub
    ? "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80"
    : "text-[10px] font-bold uppercase tracking-wider text-muted-foreground";
  if (!collapsible)
    return (
      <section className={`space-y-2 ${shell} ${className}`}>
        <h4 className={`border-b pb-1 ${head}`}>{label}</h4>
        {children}
      </section>
    );
  return (
    <section className={`${shell} ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-1 border-b pb-1 ${head} transition-colors hover:text-foreground`}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        {label}
      </button>
      {open && <div className="mt-2 space-y-2">{children}</div>}
    </section>
  );
}
