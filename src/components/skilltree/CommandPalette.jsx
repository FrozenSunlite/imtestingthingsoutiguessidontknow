import { useEffect, useMemo, useRef, useState } from "react";
import { useTree } from "@/lib/treeStore";
import { Input } from "@/components/ui/input";
import { entryName } from "@/lib/textSearch";
import { Search } from "lucide-react";

// Global Ctrl/Cmd+K command palette. It searches nodes, tabs, library entries,
// dungeon room templates, saved dungeons, rulebook chapters and imported 5eTools
// entries, then navigates to the chosen result.
export function CommandPalette() {
  const { tree, setActiveTab, setUi, settings } = useTree();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
        setCursor(0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const results = useMemo(() => {
    if (!open) return [];
    const out = [];
    const q = query.trim().toLowerCase();
    const match = (text) => !q || String(text || "").toLowerCase().includes(q);
    const add = (item) => {
      if (out.length >= 200) return;
      if (item && match(`${item.label} ${item.detail || ""}`)) out.push(item);
    };

    (tree?.tabs || []).forEach((tab) => {
      add({
        kind: "Tab",
        label: tab.name || "Tab",
        detail: `${(tab.nodes || []).length} nodes`,
        run: () => setActiveTab(tab.id),
      });
      (tab.nodes || []).forEach((node) => {
        add({
          kind: "Node",
          label: node.name || "New Skill",
          detail: `${tab.name || "Tab"} · ${node.nodeType || "skill"}`,
          run: () => {
            setActiveTab(tab.id);
            setUi((u) => ({ ...u, selectedNodeId: node.id }));
          },
        });
      });
    });

    const library = settings?.library || {};
    Object.entries(library).forEach(([key, value]) => {
      if (!Array.isArray(value)) return;
      value.forEach((entry) => {
        const label = entryName(entry);
        if (!label) return;
        add({
          kind: "Library",
          label,
          detail: key,
          run: () => {
            window.dispatchEvent(
              new CustomEvent("skilltree:open-library-tab", { detail: { tab: key } })
            );
            window.dispatchEvent(new CustomEvent("skilltree:open-library"));
          },
        });
      });
    });
    Object.entries(library.lists || {}).forEach(([key, value]) => {
      if (!Array.isArray(value)) return;
      value.forEach((entry) => {
        const label = entryName(entry);
        if (!label) return;
        add({
          kind: "List",
          label,
          detail: key,
          run: () => {
            window.dispatchEvent(
              new CustomEvent("skilltree:open-library-tab", { detail: { tab: key } })
            );
            window.dispatchEvent(new CustomEvent("skilltree:open-library"));
          },
        });
      });
    });
    Object.entries(library.fiveETools || {}).forEach(([key, value]) => {
      if (!Array.isArray(value)) return;
      value.forEach((entry) => {
        const label = entryName(entry);
        if (!label) return;
        add({
          kind: "5eTools",
          label,
          detail: `${key}${entry.source ? ` · ${entry.source}` : ""}`,
          run: () => {
            window.dispatchEvent(new CustomEvent("skilltree:open-library"));
          },
        });
      });
    });
    (library.dungeons || []).forEach((dungeon) => {
      add({
        kind: "Dungeon",
        label: dungeon.name || "Dungeon",
        detail: `${(dungeon.rooms || []).length} rooms · rank ${dungeon.rank || "?"}`,
        run: () => {
          window.dispatchEvent(new CustomEvent("skilltree:open-dungeon"));
        },
      });
    });
    (library.fiveEToolsBooks || []).forEach((book) => {
      (book.chapters || []).forEach((chapter) => {
        add({
          kind: "Rulebook",
          label: chapter.title || book.title,
          detail: book.title,
          run: () => {
            window.dispatchEvent(new CustomEvent("skilltree:open-rulebook"));
            window.dispatchEvent(
              new CustomEvent("skilltree:rulebook-focus", {
                detail: { bookId: book.id, chapterId: chapter.id },
              })
            );
          },
        });
      });
    });

    return out.slice(0, 120);
  }, [open, query, setActiveTab, setUi, settings, tree]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  if (!open) return null;

  const choose = (item) => {
    if (!item) return;
    item.run?.();
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
      onMouseDown={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-lg border bg-background shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            className="h-8 border-0 bg-transparent px-0 focus-visible:ring-0"
            placeholder="Search nodes, tabs, library, rooms, dungeons, rulebook…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(results.length - 1, c + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                choose(results[cursor]);
              }
            }}
          />
          <span className="text-[9px] text-muted-foreground">Ctrl/⌘ K</span>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-1">
          {results.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">No matches.</p>
          ) : (
            results.map((item, i) => (
              <button
                key={`${item.kind}-${item.label}-${i}`}
                type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => choose(item)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs ${
                  i === cursor ? "bg-accent" : "hover:bg-accent/50"
                }`}
              >
                <span className="w-14 shrink-0 text-[9px] uppercase tracking-wide text-muted-foreground">
                  {item.kind}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                {item.detail && (
                  <span className="shrink-0 text-[10px] text-muted-foreground">{item.detail}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
