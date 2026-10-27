// Convert 5eTools book data into Rulebook chapters (Homebrewery markdown).
// Book files contain a `bookData` wrapper with a `data` array of chapters;
// each chapter's `entries` tree is rendered into readable markdown.
import { fiveText } from "@/lib/fiveETools";

const clean = (value) => fiveText(value).replace(/\r\n/g, "\n").trim();
const cell = (value) => clean(value).replace(/\|/g, "\\|");

const tableMarkdown = (table) => {
  const columns = (table.colLabels || []).map(cell);
  const rows = (table.rows || []).map((row) => {
    const cells = (Array.isArray(row) ? row : row?.row || [row]).map((value) => {
      if (value && typeof value === "object") {
        if (value.roll) {
          return value.roll.exact != null
            ? String(value.roll.exact)
            : `${value.roll.min ?? ""}${value.roll.max != null ? `–${value.roll.max}` : ""}`;
        }
        return cell(value.entry ?? value.entries ?? value.name ?? "");
      }
      return cell(value);
    });
    return cells;
  });
  if (!rows.length) return "";
  if (!columns.length) {
    return rows.map((r) => `- ${r.filter(Boolean).join(" — ")}`).join("\n");
  }
  return [
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
};

const imageMarkdown = (node) => {
  const href = node?.href;
  if (typeof href === "string") return `![${clean(node.name) || "Illustration"}](${href})`;
  if (href?.url) return `![${clean(node.name) || "Illustration"}](${href.url})`;
  if (href?.path) return `![${clean(node.name) || "Illustration"}](${href.path})`;
  if (href?.paths?.length) {
    return href.paths
      .map((path) => `![${clean(node.name) || "Illustration"}](${path})`)
      .join("\n\n");
  }
  return "";
};

const refLabel = (node) =>
  clean(
    node?.name ||
      node?.spell ||
      node?.item ||
      node?.creature ||
      node?.condition ||
      node?.optionalfeature ||
      node?.classFeature ||
      node?.subclassFeature ||
      node?.table ||
      node?.book ||
      node?.adventure ||
      ""
  );

function renderEntries(value, depth = 0) {
  if (value == null || value === "") return "";
  if (typeof value === "string") return clean(value);
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((v) => renderEntries(v, depth)).filter(Boolean).join("\n\n");
  if (typeof value !== "object") return clean(value);

  switch (value.type) {
    case "table": {
      const table = tableMarkdown(value);
      return [value.name ? `**${clean(value.name)}**` : "", table].filter(Boolean).join("\n\n");
    }
    case "list":
      return (value.items || [])
        .map((item) => `- ${clean(item).replace(/\n/g, "\n  ")}`)
        .join("\n");
    case "options":
      return [
        value.name ? `**${clean(value.name)}**` : "",
        ...(value.entries || []).map((entry) => renderEntries(entry, depth + 1)),
      ]
        .filter(Boolean)
        .join("\n\n");
    case "inset":
    case "insetReadaloud": {
      const body = renderEntries(value.entries, depth + 1)
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
      return [value.name ? `> **${clean(value.name)}**\n>` : "", body].filter(Boolean).join("\n");
    }
    case "quote": {
      const body = renderEntries(value.entries, depth + 1)
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
      return [value.byline ? `> — ${clean(value.byline)}\n>` : "", body].filter(Boolean).join("\n");
    }
    case "image":
    case "gallery":
      return imageMarkdown(value);
    case "hr":
      return "---";
    case "abilityDc":
    case "abilityAttackMod": {
      const ability = (value.attributes || []).map((a) => String(a).toUpperCase()).join(", ");
      return `**${clean(value.name) || "Ability"}${value.type === "abilityDc" ? " save DC" : " attack modifier"}:** ${ability || "—"}`;
    }
    case "statblock":
    case "statblockInline":
      return [
        value.name ? `**${clean(value.name)}**` : "",
        renderEntries(value.entries, depth + 1),
      ]
        .filter(Boolean)
        .join("\n\n");
    default:
      break;
  }

  if (value.type?.startsWith("ref")) {
    const label = refLabel(value);
    return label ? `*${label}*` : "";
  }

  const heading =
    value.name && Array.isArray(value.entries)
      ? `${"#".repeat(Math.min(6, depth + 2))} ${clean(value.name)}`
      : value.name
        ? `**${clean(value.name)}**`
        : "";
  const body = value.entries
    ? renderEntries(value.entries, depth + 1)
    : value.items
      ? renderEntries(value.items, depth + 1)
      : "";
  return [heading, body].filter(Boolean).join("\n\n");
}

const slug = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "book";

// Build a read-only Rulebook book from a 5eTools book or bookData entry.
export function bookToRulebook(entry, fallbackTitle = "") {
  if (!entry) return null;
  const data = Array.isArray(entry.data)
    ? entry.data
    : Array.isArray(entry.contents)
      ? []
      : [];
  const title =
    clean(entry.name || entry.title || fallbackTitle || entry.id) || "Imported Book";
  const source = clean(entry.source || entry.id || "");
  const id = `rb5e-${slug(source)}-${slug(title)}`;
  let chapters = data
    .map((chapter, i) => {
      const chapterTitle = clean(chapter.name) || `Chapter ${i + 1}`;
      const body = renderEntries(chapter.entries, 1);
      return {
        id: `${id}-ch${i + 1}`,
        title: chapterTitle,
        content: [`# ${chapterTitle}`, body].filter(Boolean).join("\n\n"),
      };
    })
    .filter((chapter) => chapter.content.trim());

  if (!chapters.length) {
    const outline = (entry.contents || [])
      .map((c) => (typeof c === "string" ? c : c?.name))
      .filter(Boolean)
      .map((name) => `- ${clean(name)}`)
      .join("\n");
    const body = renderEntries(entry.entries, 1);
    chapters = [
      {
        id: `${id}-ch1`,
        title,
        content: [`# ${title}`, outline, body].filter(Boolean).join("\n\n"),
      },
    ];
  }

  return {
    id,
    title,
    source,
    imported: true,
    chapters,
  };
}
