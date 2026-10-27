import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { searchCatalog } from "@/lib/resources";
import { normText } from "@/lib/textSearch";

// Searchable picker over the resource catalog: type to filter, or click the
// magnifier to browse. Typing a name that isn't in the catalog creates a new
// resource.
export function ResourcePicker({ value, onChange, items, placeholder }) {
  const [open, setOpen] = useState(false);
  const matches = searchCatalog(items, value);
  const exact = items.some((i) => normText(i?.name) === normText(value));

  return (
    <div className="relative flex-1">
      <div className="flex gap-1">
        <Input
          className="h-8"
          value={value}
          placeholder={placeholder || "Search resources…"}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        <Button size="sm" variant="ghost" title="Browse resources" onClick={() => setOpen(!open)}>
          <Search className="h-4 w-4" />
        </Button>
      </div>
      {open && matches.length > 0 && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute z-30 mt-1 max-h-44 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
            {matches.map((m) => (
              <button
                key={m.name}
                onClick={() => {
                  onChange(m.name);
                  setOpen(false);
                }}
                className="block w-full truncate px-2 py-1 text-left text-xs hover:bg-accent"
              >
                {m.name}
                {m.builtin ? " · built-in" : " · custom"}
              </button>
            ))}
          </div>
        </>
      )}
      {!exact && String(value || "").trim() !== "" && (
        <div className="pointer-events-none absolute right-9 top-1.5 text-[9px] font-medium text-amber-500">
          new
        </div>
      )}
    </div>
  );
}