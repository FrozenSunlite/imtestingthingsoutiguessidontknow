import { useMemo, useRef, useState } from "react";
import { useTree } from "@/lib/treeStore";
import { searchNodes } from "@/lib/treeSearch";
import { hiddenNodeIds } from "@/lib/nodeVisibility";
import { InfoTip } from "@/components/skilltree/InfoTip";
import { SearchWindow } from "@/components/skilltree/SearchWindow";
import { Search } from "lucide-react";

// The global search bar. Supports field tags (n:, d:, f:, t:, y:, a: — quoted
// or bare), ranks matches by relevance and shows a live dropdown while typing;
// Enter cycles through all matches. Double-clicking the bar opens the floating
// search window — draggable and resizable — for the full result list and the
// syntax reference.
export function SearchBox({ onPick, fullWidth = false }) {
  const { tree, setUi, mode } = useTree();
  const [query, setQuery] = useState("");
  const [dropOpen, setDropOpen] = useState(false);
  const [winOpen, setWinOpen] = useState(false);
  const nextIdx = useRef(0);

  // Players can't search their way to a node the DM hid. Edit mode keeps the
  // full list so the DM can still find and reveal hidden nodes.
  const matches = useMemo(() => {
    if (!query.trim() || !tree) return [];
    const all = searchNodes(tree.nodes, query);
    if (mode === "edit") return all;
    const hidden = hiddenNodeIds(tree.nodes || []);
    return hidden.size ? all.filter((m) => !hidden.has(m.node?.id)) : all;
  }, [tree, query, mode]);
  const shown = matches.slice(0, 10);

  const pick = (node, index) => {
    onPick?.(node);
    nextIdx.current = index + 1;
  };

  return (
    <div className={`relative ${fullWidth ? "w-full" : ""}`}>
      <InfoTip label='Search nodes: plain text searches everything; tag a field with n:"name", d:"description", f:"flavor", t:"talent type", y:"category", a:"attribute". Enter jumps to the next match — double-click for the full search window.'>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            className={`h-8 ${fullWidth ? "w-full" : "w-56"} rounded-md border bg-transparent pl-8 pr-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring`}
            placeholder='Search skills… n:"Fire Bolt"'
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              nextIdx.current = 0;
              setUi((u) => ({ ...u, searchQuery: e.target.value }));
              setDropOpen(true);
            }}
            onFocus={() => setDropOpen(true)}
            onBlur={() =>
              setTimeout(() => {
                setDropOpen(false);
              }, 150)
            }
            onDoubleClick={(e) => {
              e.preventDefault();
              setWinOpen(true);
              setDropOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches.length) {
                const idx = nextIdx.current % matches.length;
                pick(matches[idx].node, idx);
                e.preventDefault();
              } else if (e.key === "Escape") {
                setDropOpen(false);
                setWinOpen(false);
              }
            }}
          />
        </div>
      </InfoTip>

      {dropOpen && !winOpen && shown.length > 0 && (
        <div className="absolute left-0 z-50 mt-1 max-h-72 w-72 overflow-y-auto rounded-md border bg-popover shadow-lg">
          {shown.map((m, i) => (
            <button
              key={m.node.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(m.node, i)}
              className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent"
            >
              <span className="truncate">{m.node.name || m.node.id}</span>
              <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                {m.matched}
              </span>
            </button>
          ))}
          {matches.length > shown.length && (
            <p className="px-2 py-1 text-[10px] text-muted-foreground">
              +{matches.length - shown.length} more — press Enter to cycle, double-click for all
            </p>
          )}
        </div>
      )}

      {winOpen && (
        <SearchWindow
          query={query}
          setQuery={(v) => {
            setQuery(v);
            nextIdx.current = 0;
            setUi((u) => ({ ...u, searchQuery: v }));
          }}
          matches={matches}
          onPick={pick}
          onClose={() => setWinOpen(false)}
        />
      )}
    </div>
  );
}