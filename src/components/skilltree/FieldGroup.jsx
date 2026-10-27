import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

// A labelled group of editor fields, used to keep the node editor organized.
// Pass collapsible to hide the body behind a chevron (used to de-clutter the
// node editor); defaultOpen shows it expanded initially.
export function FieldGroup({ label, children, className = "", collapsible = false, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!collapsible)
    return (
      <section className={`space-y-2 ${className}`}>
        <h4 className="border-b pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </h4>
        {children}
      </section>
    );
  return (
    <section className={className}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 border-b pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        {label}
      </button>
      {open && <div className="mt-2 space-y-2">{children}</div>}
    </section>
  );
}