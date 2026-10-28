import { useMemo } from "react";
import ReactMarkdown from "react-markdown";

// Renders a Homebrewery-style chapter: standard markdown plus pipe tables.
// Pipe-table rows are split out first and rendered as real <table>s;
// everything else renders through markdown, so pasted Homebrewery content
// keeps its look. \pagebreak renders as a rule.
export function Homebrewery({ text = "", className = "" }) {
  const blocks = useMemo(() => splitBlocks(text), [text]);
  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((b, i) =>
        b.kind === "table" ? (
          <TableBlock key={i} rows={b.rows} />
        ) : b.kind === "break" ? (
          <div key={i} className="page-break my-6 border-t border-dashed border-primary/40 pt-2 text-[9px] uppercase tracking-widest text-muted-foreground">
            page break
          </div>
        ) : (
          <MarkdownBlock key={i} text={b.text} />
        )
      )}
    </div>
  );
}

const headingText = (children) =>
  Array.isArray(children)
    ? children.map((child) => (typeof child === "string" ? child : "")).join("")
    : String(children || "");

const headingId = (children) =>
  headingText(children)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";

function splitBlocks(text) {
  const lines = String(text || "").replace(/\\pagebreak/g, "---").split(/\r?\n/);
  const blocks = [];
  let para = [];
  let table = [];
  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: "md", text: para.join("\n") });
      para = [];
    }
  };
  const flushTable = () => {
    if (table.length) {
      blocks.push({ kind: "table", rows: table });
      table = [];
    }
  };
  for (const line of lines) {
    if (/^\s*\|/.test(line)) {
      flushPara();
      table.push(line.trim());
    } else if (/^\s*---+\s*$/.test(line)) {
      flushPara();
      flushTable();
      blocks.push({ kind: "break" });
    } else {
      flushTable();
      para.push(line);
    }
  }
  flushPara();
  flushTable();
  return blocks;
}

// Renders **bold** inside table cells without the full markdown pipeline.
function Fmt({ text }) {
  const parts = String(text || "").split(/\*\*([^*]+)\*\*/);
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p))}
    </>
  );
}

function TableBlock({ rows }) {
  const parse = (row) =>
    row
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
  const cells = rows.map(parse);
  const body = cells.filter(
    (r, i) => i !== 0 && !(i === 1 && r.every((c) => /^:?-{2,}:?$/.test(c)))
  );
  return (
    <table className="my-2 w-full border-collapse overflow-hidden rounded-md text-xs">
      <thead>
        <tr>
          {cells[0].map((c, i) => (
            <th key={i} className="border px-2 py-1 text-left">
              <Fmt text={c} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {body.map((r, i) => (
          <tr key={i} className={i % 2 ? "bg-muted/40" : ""}>
            {r.map((c, j) => (
              <td key={j} className="border px-2 py-1 align-top">
                <Fmt text={c} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MarkdownBlock({ text }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children, ...p }) => (
          <h1 id={headingId(children)} className="mt-4 scroll-mt-4 border-b pb-1 font-display text-2xl font-bold" {...p}>
            {children}
          </h1>
        ),
        h2: ({ children, ...p }) => (
          <h2 id={headingId(children)} className="mt-4 scroll-mt-4 font-display text-xl font-bold" {...p}>
            {children}
          </h2>
        ),
        h3: ({ children, ...p }) => (
          <h3 id={headingId(children)} className="mt-3 scroll-mt-4 font-semibold" {...p}>
            {children}
          </h3>
        ),
        p: (p) => <p className="leading-relaxed" {...p} />,
        ul: (p) => <ul className="list-disc pl-5" {...p} />,
        ol: (p) => <ol className="list-decimal pl-5" {...p} />,
        blockquote: (p) => (
          <blockquote
            className="border-l-4 border-primary/60 bg-muted/40 px-3 py-2 text-muted-foreground"
            {...p}
          />
        ),
        code: (p) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs" {...p} />,
        img: ({ alt, src, ...p }) => (
          <figure className="my-3">
            <img
              src={src}
              alt={alt || ""}
              loading="lazy"
              className="mx-auto max-h-96 max-w-full rounded border object-contain"
              {...p}
            />
            {alt && (
              <figcaption className="mt-1 text-center text-[10px] italic text-muted-foreground">
                {alt}
              </figcaption>
            )}
          </figure>
        ),
        hr: (p) => <hr className="my-4 border-border" {...p} />,
        a: (p) => <a className="text-primary underline" {...p} />,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}