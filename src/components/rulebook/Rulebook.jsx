import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Homebrewery } from "@/components/rulebook/Homebrewery";
import { useTree } from "@/lib/treeStore";
import { importImage } from "@/lib/imageStore";
import {
  loadRulebook,
  saveRulebook,
  newChapterId,
  newBookId,
  creditsContent,
} from "@/lib/rulebookStore";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

// The Document Library: one or more rulebooks, each split into chapters
// written in Homebrewery-style markdown. Books and chapters live in
// localStorage and are carried along with a saved project.
export default function Rulebook({ className = "" }) {
  const { settings, setSettings } = useTree();
  const [rb, setRb] = useState(() => loadRulebook());
  const [bookId, setBookId] = useState(() => loadRulebook().activeBookId);
  const [chapterId, setChapterId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [nameDraft, setNameDraft] = useState("");
  const [creditDraft, setCreditDraft] = useState("");
  const fileRef = useRef(null);
  const areaRef = useRef(null);

  const localBooks = rb.books || [];
  const importedBooks = (settings?.library?.fiveEToolsBooks || []).filter(
    (b) => !localBooks.some((local) => local.id === b.id)
  );
  const books = [...localBooks, ...importedBooks];
  const book = books.find((b) => b.id === bookId) || books[0] || null;
  const isImported = !!book?.imported;
  const chapters = book?.chapters || [];
  const active = chapters.find((c) => c.id === chapterId) || chapters[0] || null;
  const idx = chapters.findIndex((c) => c.id === active?.id);
  const isCredits = !!active?.credits && !isImported;

  const updateCredits = (names) =>
    updateBook((b) => ({
      ...b,
      chapters: (b.chapters || []).map((c) =>
        c.id === active.id ? { ...c, names, content: creditsContent(names) } : c
      ),
    }));

  const addCredit = () => {
    const n = creditDraft.trim();
    if (!n || !active) return;
    updateCredits([...(active.names || []), n]);
    setCreditDraft("");
  };

  const removeCredit = (i) => {
    if (!active) return;
    updateCredits((active.names || []).filter((_, j) => j !== i));
  };

  // Persist whenever the rulebook changes, keeping the active book in sync.
  useEffect(() => {
    saveRulebook({ ...rb, activeBookId: book?.id || rb.activeBookId });
  }, [rb, book?.id, rb.activeBookId]);

  const updateBook = (fn) => {
    if (!book || isImported) return;
    setRb((r) => ({
      ...r,
      books: (r.books || []).map((b) => (b.id === book.id ? fn(b) : b)),
    }));
  };

  const selectBook = (id) => {
    setBookId(id);
    setChapterId(null);
    setEditing(false);
  };

  // A 5eTools book import opens the Rulebook immediately when it is already
  // mounted; otherwise the active id is remembered for the next open.
  useEffect(() => {
    const onImport = (event) => {
      const id = event?.detail?.bookId;
      if (id) selectBook(id);
    };
    const onCredits = () => setRb(loadRulebook());
    window.addEventListener("skilltree:rulebook-import", onImport);
    window.addEventListener("skilltree:rulebook-credits", onCredits);
    return () => {
      window.removeEventListener("skilltree:rulebook-import", onImport);
      window.removeEventListener("skilltree:rulebook-credits", onCredits);
    };
  }, []);

  const addBook = () => {
    const b = {
      id: newBookId(),
      title: `Book ${books.length + 1}`,
      chapters: [
        { id: newChapterId(), title: "Chapter 1", content: "# Chapter 1\n\n" },
      ],
    };
    setRb((r) => ({ ...r, books: [...(r.books || []), b], activeBookId: b.id }));
    setBookId(b.id);
    setChapterId(b.chapters[0].id);
    setEditing(false);
  };

  const removeBook = () => {
    if (!book) return;
    if (isImported) {
      setSettings((s) => ({
        ...s,
        library: {
          ...s.library,
          fiveEToolsBooks: (s.library.fiveEToolsBooks || []).filter((b) => b.id !== book.id),
        },
      }));
      const fallback = localBooks[0] || books.find((b) => b.id !== book.id);
      setBookId(fallback?.id || "");
      setChapterId(null);
      setEditing(false);
      return;
    }
    if (books.length <= 1) return;
    const rest = books.filter((b) => b.id !== book.id);
    setRb((r) => ({ ...r, books: rest, activeBookId: rest[0].id }));
    setBookId(rest[0].id);
    setChapterId(null);
    setEditing(false);
  };

  const renameBook = (title) => {
    if (!book || isImported) return;
    updateBook((b) => ({ ...b, title: title.trim() || b.title }));
  };

  const startEdit = () => {
    if (isImported) return;
    setDraft(active?.content || "");
    setEditing(true);
  };

  const saveEdit = () => {
    if (!active) return;
    updateBook((b) => ({
      ...b,
      chapters: b.chapters.map((c) =>
        c.id === active.id ? { ...c, content: draft } : c
      ),
    }));
    setEditing(false);
  };

  const addChapter = () => {
    if (isImported) return;
    const n = chapters.length + 1;
    const ch = {
      id: newChapterId(),
      title: `Chapter ${n}`,
      content: `# Chapter ${n}\n\n`,
    };
    updateBook((b) => ({ ...b, chapters: [...b.chapters, ch] }));
    setChapterId(ch.id);
    setDraft(ch.content);
    setEditing(true);
  };

  const removeChapter = () => {
    if (isImported || !active || chapters.length <= 1) return;
    updateBook((b) => ({
      ...b,
      chapters: b.chapters.filter((c) => c.id !== active.id),
    }));
    setChapterId(null);
    setEditing(false);
  };

  const moveChapter = (dir) => {
    if (isImported) return;
    const to = idx + dir;
    if (!active || to < 0 || to >= chapters.length) return;
    updateBook((b) => {
      const next = [...b.chapters];
      const [m] = next.splice(idx, 1);
      next.splice(to, 0, m);
      return { ...b, chapters: next };
    });
  };

  const commitRename = () => {
    if (isImported) {
      setRenamingId(null);
      return;
    }
    if (renamingId && active) {
      updateBook((b) => ({
        ...b,
        chapters: b.chapters.map((c) =>
          c.id === renamingId ? { ...c, title: nameDraft.trim() || c.title } : c
        ),
      }));
    }
    setRenamingId(null);
  };

  // Insert the picked image as markdown at the caret so it lands where the
  // author is writing rather than always at the end of the document.
  const insertImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    let src;
    try {
      src = await importImage(file, { maxEdge: 1024 });
    } catch {
      return;
    }
    const markdown = `\n![${file.name.replace(/\.[^.]+$/, "")}](${src})\n`;
    const el = areaRef.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    setDraft((d) => d.slice(0, start) + markdown + d.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      const pos = start + markdown.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  if (!book) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 rounded-lg border bg-card p-6 text-sm text-muted-foreground ${className}`}>
        <p>No rulebook found.</p>
        <Button size="sm" onClick={addBook}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Create a book
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex min-h-0 overflow-hidden rounded-lg border bg-card ${className}`}>
      <aside className="flex w-52 shrink-0 flex-col border-r">
        <div className="space-y-1 border-b p-2">
          <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <BookOpen className="h-3 w-3" /> Book
          </label>
          <select
            className="w-full rounded border bg-background px-1.5 py-1 text-xs"
            title="Choose which rulebook to read or edit"
            value={book.id}
            onChange={(e) => selectBook(e.target.value)}
          >
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
          <Input
            className="h-6 text-xs"
            title={isImported ? "Imported from 5eTools — read only" : "Rename this book"}
            defaultValue={book.title}
            key={book.id}
            readOnly={isImported}
            onBlur={(e) => renameBook(e.target.value)}
          />
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-6 flex-1 px-1 text-[11px]" title="Add a new book" onClick={addBook}>
              <Plus className="mr-1 h-3 w-3" /> New book
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-1"
              title={isImported ? "Remove this imported book" : "Delete this book"}
              onClick={removeBook}
              disabled={!isImported && books.length <= 1}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <p className="border-b px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Chapters
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
                  type="button"
                  className={`flex-1 truncate rounded px-1.5 py-1 text-left text-xs ${
                    c.id === active?.id
                      ? "bg-accent font-medium"
                      : "text-muted-foreground hover:bg-accent/60"
                  }`}
                  title={`${i + 1}. ${c.title}${!isImported && i === 0 ? " — quick start" : ""}`}
                  onClick={() => {
                    setChapterId(c.id);
                    setEditing(false);
                  }}
                  onDoubleClick={() => {
                    if (c.credits || isImported) return;
                    setRenamingId(c.id);
                    setNameDraft(c.title);
                  }}
                >
                  {i + 1}. {c.title}
                </button>
              )}
              {c.id === active?.id && renamingId !== c.id && !isImported && (
                <div className="flex shrink-0">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    title="Move up"
                    onClick={() => moveChapter(-1)}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    title="Move down"
                    onClick={() => moveChapter(1)}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        {!isImported && (
          <Button size="sm" variant="ghost" className="justify-start" title="Add a chapter to this book" onClick={addChapter}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add chapter
          </Button>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{active?.title || "Untitled"}</h3>
            <p className="text-[10px] text-muted-foreground">
              Chapter {idx + 1} of {chapters.length}
              {isImported
                ? ` — imported from 5eTools${book.source ? ` (${book.source})` : ""}`
                : idx === 0
                  ? " — quick start guide"
                  : ""}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            {isImported ? null : isCredits ? null : editing ? (
              <>
                <Button size="sm" onClick={saveEdit} title="Save this chapter">
                  Save
                </Button>
                <Button size="sm" variant="outline" title="Discard changes" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" title="Edit this chapter" onClick={startEdit} disabled={!active}>
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

        {isCredits ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            <p className="text-muted-foreground">
              Credits for this project. Add the creator and any collaborators; this page cannot be
              edited as free text.
            </p>
            <div className="flex items-center gap-1">
              <Input
                className="h-8 flex-1"
                placeholder="Name"
                value={creditDraft}
                onChange={(e) => setCreditDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCredit();
                }}
              />
              <Button size="sm" onClick={addCredit} disabled={!creditDraft.trim()}>
                <Plus className="mr-1 h-4 w-4" /> Add name
              </Button>
            </div>
            <div className="space-y-1">
              {(active.names || []).map((n, i) => (
                <div key={`${n}-${i}`} className="flex items-center gap-1 rounded border px-2 py-1">
                  <span className="flex-1">{n}</span>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeCredit(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {(active.names || []).length === 0 && (
                <p className="text-xs text-muted-foreground">No names added yet.</p>
              )}
            </div>
          </div>
        ) : editing ? (
          <div className="grid min-h-0 flex-1 grid-cols-2 divide-x">
            <Textarea
              ref={areaRef}
              className="h-full min-h-64 w-full resize-none rounded-none border-0 font-mono text-xs"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              title="Homebrewery markdown source"
            />
            <div className="h-full overflow-y-auto p-4 text-sm">
              <Homebrewery text={draft} />
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
            <Homebrewery text={active?.content || ""} />
          </div>
        )}

        <div className="flex items-center gap-2 border-t px-3 py-1.5">
          {editing && (
            <>
              <Button size="sm" variant="outline" title="Insert an image at the cursor" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="mr-1 h-3.5 w-3.5" /> Image
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={insertImage}
              />
            </>
          )}
          <p className="text-[10px] text-muted-foreground">
            {isImported
              ? "Imported 5eTools book — read only. You can remove it and import it again from the Reference Index."
              : isCredits
                ? "Add or remove names only — this page can't be edited as free text."
                : editing
                  ? "Homebrewery markdown — # heading, **bold**, *italics*, > quote, - list, | table | rows |. Edits save when you press Save."
                  : "Written in Homebrewery markdown — paste from your homebrew and it renders. Double-click a chapter to rename."}
          </p>
        </div>
      </div>
    </div>
  );
}
