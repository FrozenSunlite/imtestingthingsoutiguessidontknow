import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Homebrewery } from "@/components/rulebook/Homebrewery";
import { bookChapterMarkdown } from "@/lib/fiveEToolsRulebook";

// Read a 5eTools book inside the Preview panel: pick a chapter, then read its
// rendered text without leaving the Reference Index.
function BookReader({ book }) {
  const [index, setIndex] = useState(0);
  const safeIndex = Math.min(index, Math.max(0, book.chapters.length - 1));
  const chapter = book.chapters[safeIndex];
  const markdown = useMemo(() => bookChapterMarkdown(chapter), [chapter]);
  return (
    <section className="space-y-1 border-t pt-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Read the book ({book.chapters.length} chapters)
      </h3>
      <select
        className="w-full rounded border bg-background px-1 py-1 text-[11px]"
        value={safeIndex}
        onChange={(e) => setIndex(Number(e.target.value))}
        title={`Choose a chapter of ${book.title}`}
      >
        {book.chapters.map((c, i) => (
          <option key={c.id} value={i}>
            {i + 1}. {c.title}
          </option>
        ))}
      </select>
      <div className="rounded border bg-muted/10 p-2 text-[11px] [&_h1]:mt-2 [&_h1]:text-base [&_h2]:mt-2 [&_h2]:text-sm [&_h3]:mt-2 [&_h3]:text-xs [&_h4]:text-[11px] [&_p]:leading-relaxed">
        <Homebrewery text={markdown} />
      </div>
    </section>
  );
}

// Renders the category-aware preview for one 5eTools entry. The parent builds
// `details` with entryDetails(), so this component only lays out text, lists,
// tables and the optional image.
export function ReferenceEntryPreview({ details, imageSrc, onImport, importingLabel }) {
  if (!details) {
    return (
      <p className="text-muted-foreground">
        Select an entry to preview its source material.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold leading-tight">{details.name}</p>
        <p className="text-[11px] text-muted-foreground">
          {[details.source, details.page ? `p.${details.page}` : "", details.edition]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {imageSrc && (
        <img
          src={imageSrc}
          alt=""
          className="max-h-64 w-full rounded border object-contain"
          style={{ imageRendering: "pixelated" }}
        />
      )}

      {details.fields.length > 0 && (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
          {details.fields.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="font-medium text-muted-foreground">{label}</dt>
              <dd className="min-w-0 whitespace-pre-wrap break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {details.sections.map((section, i) => (
        <section key={`${section.title}-${i}`} className="space-y-1 border-t pt-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {section.title}
          </h3>
          {section.text && (
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
              {section.text}
            </p>
          )}
          {section.list?.length > 0 && (
            <ul className="space-y-1">
              {section.list.map((item, j) => (
                <li key={`${item.label}-${j}`} className="text-xs leading-relaxed">
                  <span className="font-medium">{item.label}</span>
                  {item.text && (
                    <span className="text-muted-foreground"> — {item.text}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {section.columns?.length > 0 && (
            <div className="overflow-x-auto rounded border">
              <table className="w-full border-collapse text-[11px]">
                <thead className="bg-muted/60">
                  <tr>
                    {section.columns.map((col, j) => (
                      <th key={j} className="whitespace-nowrap px-1.5 py-1 text-left font-semibold">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row, r) => (
                    <tr key={r} className="border-t">
                      {row.map((cell, c) => (
                        <td key={c} className="px-1.5 py-0.5 align-top">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      {details.book?.chapters?.length > 0 && (
        <BookReader book={details.book} />
      )}

      {onImport && (
        <Button size="sm" variant="outline" onClick={onImport} disabled={!!importingLabel}>
          {importingLabel || "Import this entry"}
        </Button>
      )}
    </div>
  );
}
