import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Homebrewery } from "@/components/rulebook/Homebrewery";
import { loadRulebook, saveRulebook, newChapterId } from "@/lib/rulebookStore";
import { BookOpen, ChevronDown, ChevronUp, Eye, Pencil, Plus, Trash2 } from "lucide-react";

// The Document Library: an organized rulebook separated by chapters, written
// in Homebrewery-style markdown, with view and edit modes. Chapter 1 doubles
// as the quick start guide — it sits on the app's first page.
export default function Rulebook({ className = "" }) {
  const [rb, setRb] = useState(loadRulebook);
  const [activeId, setActiveId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => saveRulebook(rb), [rb]);

  const chapters = rb.chapters || [];
  const active = chapters.find((c) => c.id === activeId) || chapters[0] || null;
  const idx = chapters.findIndex((c) => c.id === active?.id);

  const startEdit = () => {
    setDraft(active?.content || "");
    setEditing(true);
  };
  const saveEdit = () => {
    setRb((r) => ({
      ...r,
      chapters: r.chapters.map((c) => (c.id === active.id ? { ...c, content: draft } : c)),
    }));
    setEditing(false);
  };
  const addChapter = () => {
    const ch = { id: newChapterId(), title: `Chapter ${chapters.length + 1}`, content: `# Chapter ${chapters.length + 1}\n\n` };
    setRb((r) => ({ ...r, chapters: [...r.chapters, ch] }));
    setActiveId(ch.id);
    setDraft(ch.content);
    setEditing(true);
  };
  const removeChapter = () => {
    if (chapters.length <= 1) return;
    setRb((r) => ({ ...r, chapters: r.chapters.filter((c) => c.id !== active.id) }));
    setActiveId(null);
    setEditing(false);
  };
  const move = (dir) => {
    const to = idx + dir;
    if (to < 0 || to >= chapters.length) return;
    setRb((r) => {
      const next = [...r.chapters];
      const [m] = next.splice(idx, 1);
      next.splice(to, 0, m);
      return { ...r, chapters: next };
    });
  };
  const commitRename = () => {
    if (renamingId)
      setRb((r) => ({
        ...r,
        chapters: r.chapters.map((c) => (c.id === renamingId ? { ...c, title: nameDraft.trim() || c.title } : c)),
      }));
    setRenamingId(null);
  };

  if (!active) return null;
  return (
    <div className={`flex min-h-0 overflow-hidden rounded-lg border bg-card ${className}`}>
      <aside className="flex w-44 shrink-0 flex-col border-r">
        <p className="flex items-center gap-1 border-b px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <BookOpen className="h-3 w-3" /> Chapters
        </p>
        <div className="flex-1 overflow-y-auto p-1">
          {chapters.map((c, i) => (
            <div key={c.id} className="group/ch flex items-center gap-0.5">
              {renamingId === c.id ? (
                <Input
                  autoFocus
                  className="h-6 text-xs"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                />
              ) : (
                <button
                  className={`flex-1 truncate rounded px-1.5 py-1 text-left text-xs ${
                    c.id === active.id ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/60"
                  }`}
                  title={`${i + 1}. ${c.title}${i === 0 ? " — quick start" : ""}`}
                  onClick={() => {
                    setActiveId(c.id);
                    setEditing(false);
                  }}
                  onDoubleClick={() => {
                    setRenamingId(c.id);
                    setNameDraft(c.title);
                  }}
                >
                  {i + 1}. {c.title}
                </button>
              )}
              {c.id === active.id && renamingId !== c.id && (
                <div className="flex shrink-0">
                  <button className="text-muted-foreground hover:text-foreground" title="Move up" onClick={() => move(-1)}>
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button className="text-muted-foreground hover:text-foreground" title="Move down" onClick={() => move(1)}>
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <Button size="sm" variant="ghost" className="justify-start" onClick={addChapter}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add chapter
        </Button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{active.title}</h3>
            <p className="text-[10px] text-muted-foreground">
              Chapter {idx + 1} of {chapters.length}
              {idx === 0 ? " — quick start guide" : ""}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            {editing ? (
              <>
                <Button size="sm" onClick={saveEdit}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={startEdit}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                </Button>
                {chapters.length > 1 && (
                  <Button size="sm" variant="outline" title="Delete this chapter" onClick={removeChapter}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
          {editing ? (
            <Textarea
              className="h-full min-h-64 w-full font-mono text-xs"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          ) : (
            <Homebrewery text={active.content} />
          )}
        </div>
        <p className="border-t px-3 py-1.5 text-[10px] text-muted-foreground">
          {editing ? (
            <>
              Homebrewery markdown: <code># heading</code>, <code>**bold**</code>, <code>*italics*</code>, <code>&gt; quote</code>, <code>- list</code>, <code>| table | rows |</code>. Edits save when you press Save.
            </>
          ) : (
            <>
              Written in Homebrewery markdown — paste from your homebrew and it renders. Double-click a chapter to rename.
            </>
          )}
        </p>
      </div>
    </div>
  );
}