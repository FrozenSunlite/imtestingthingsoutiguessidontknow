import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { matchesQuery } from "@/lib/textSearch";

// Searchable node picker: type to filter, click a result to choose.
export function NodePicker({
  nodes,
  value,
  onChange,
  placeholder = "Search nodes…",
  className = "",
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const selected = nodes.find((n) => n.id === value);
  const filtered = nodes
    .filter((n) => matchesQuery(n?.name, q))
    .slice(0, 8);

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
        <Input
          className="h-8 pl-8"
          placeholder={selected ? selected.name || "Selected" : placeholder}
          value={open ? q : selected?.name || ""}
          onFocus={() => {
            setOpen(true);
            setQ("");
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setOpen(true);
            setQ(e.target.value);
          }}
        />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 max-h-40 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
          {filtered.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No matching nodes</p>
          )}
          {filtered.map((n) => (
            <button
              key={n.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(n.id);
                setOpen(false);
              }}
              className="block w-full truncate px-2 py-1 text-left text-xs hover:bg-accent"
            >
              {n.name || n.id}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}