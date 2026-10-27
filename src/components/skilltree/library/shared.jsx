import { useState } from "react";
import { useTree } from "@/lib/treeStore";
import { matchesQuery } from "@/lib/textSearch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, ChevronDown } from "lucide-react";
import { InfoTip } from "@/components/skilltree/InfoTip";

const COIN_SUFFIX = { copper: "cp", silver: "sp", gold: "gp", electrum: "ep", platinum: "pp" };
const FALLBACK_COINS = [
  { key: "copper", name: "Copper" },
  { key: "silver", name: "Silver" },
  { key: "gold", name: "Gold" },
  { key: "electrum", name: "Electrum" },
  { key: "platinum", name: "Platinum" },
];

// Cost entry: a free-text amount plus a currency picker that rewrites the
// suffix (e.g. amount 10 + Gold → "10 gp"), so shop imports can parse the
// currency. The cost stays a plain string in every entry.
export function CostField({ value, onChange, className }) {
  const { settings } = useTree();
  const currencies = (settings?.library?.currencies || []).length
    ? settings.library.currencies
    : FALLBACK_COINS;
  const suffixOf = (c) =>
    COIN_SUFFIX[c.key || String(c.name || "").toLowerCase()] ||
    String(c.key || c.name || "").toLowerCase();
  const m = String(value ?? "").match(/^([\d,]+(?:\.\d+)?)\s*([a-z]+)?\s*$/i);
  const amount = m ? m[1] : String(value ?? "").trim();
  const active = currencies.find(
    (c) => suffixOf(c) === (m?.[2] || "").toLowerCase()
  );
  const setCurrency = (key) => {
    const c = currencies.find((x) => (x.key || x.name) === key);
    onChange(`${amount || 0} ${suffixOf(c)}`);
  };
  return (
    <div className="flex items-center gap-1">
      <Input
        className={className || "h-8 min-w-0 flex-1"}
        placeholder="Cost"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
      <Select value={active ? active.key || active.name : ""} onValueChange={setCurrency}>
        <SelectTrigger className="h-8 w-20 shrink-0 text-xs" title="Currency">
          <SelectValue placeholder="gp" />
        </SelectTrigger>
        <SelectContent>
          {currencies.map((c) => (
            <SelectItem key={c.key || c.name} value={c.key || c.name}>
              {c.name || c.key}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Library list editing helpers shared by every Reference Library tab.

export function useLibList(key) {
  const { settings, setSettings } = useTree();
  const [query, setQuery] = useState("");
  const items = settings?.library?.[key] || [];
  const setItems = (next) =>
    setSettings((s) => ({ ...s, library: { ...s.library, [key]: next } }));
  const add = (template) => setItems([...items, template]);
  const patch = (i, p) => {
    const next = [...items];
    next[i] = { ...next[i], ...p };
    setItems(next);
  };
  const remove = (i) => setItems(items.filter((_, j) => j !== i));
  const shown = (items || [])
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => matchesQuery(e?.name, query));
  return { items, add, patch, remove, query, setQuery, shown };
}

export function ListHeader({ onAdd, addLabel, query, setQuery, searchPlaceholder }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Button size="sm" variant="outline" onClick={onAdd}>
        <Plus className="mr-1 h-4 w-4" /> {addLabel}
      </Button>
      <InfoTip label="Filter this list by name.">
        <Input
          className="h-8 w-48"
          placeholder={searchPlaceholder || "Search…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </InfoTip>
    </div>
  );
}

export function EmptyNote({ items, query }) {
  return (
    <p className="text-xs text-muted-foreground">
      {(items || []).length === 0 ? "Nothing added yet." : "No matches."}
    </p>
  );
}

// One entry card with an optional, collapsible description box (collapsed by default).
export function EntryCard({ entry, onPatch, onDelete, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1.5 rounded-md border p-2">
      {children}
      <div>
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(!open)}
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
          />
          Description{entry.description ? "" : " (empty)"}
        </button>
        {open && (
          <InfoTip label="Description shown in tooltips and on the character sheet.">
            <Textarea
              className="mt-1 min-h-16"
              placeholder="Description…"
              value={entry.description || ""}
              onChange={(e) => onPatch({ description: e.target.value })}
            />
          </InfoTip>
        )}
      </div>
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function PeriodSelect({ periods, value, onChange, className }) {
  return (
    <Select value={value || ""} onValueChange={onChange}>
      <InfoTip label="Which time period or setting this entry belongs to.">
        <SelectTrigger className={className || "h-8"}>
          <SelectValue placeholder="Time period" />
        </SelectTrigger>
      </InfoTip>
      <SelectContent>
        {(periods || []).map((p) => (
          <SelectItem key={p} value={p}>
            {p}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

import { STATS } from "@/lib/skills";

// An editable list of name + ability entries (skills, tools, instruments).
// The ability assignment drives the auto-calculated check modifiers.
export function AbilityList({ label, entries, onChange, placeholder }) {
  const [q, setQ] = useState("");
  const shown = (entries || [])
    .map((e, i) => ({ e: typeof e === "string" ? { name: e, ability: "" } : e, i }))
    .filter(({ e }) => matchesQuery(e?.name, q));
  return (
    <div className="rounded-md border p-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{label}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onChange([...(entries || []), { name: "", ability: "" }])}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <InfoTip label="Filter this list by name.">
        <Input className="mt-1 h-7" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      </InfoTip>
      <div className="mt-1 space-y-1">
        {shown.map(({ e, i }) => (
          <div key={i} className="flex items-center gap-1">
            <InfoTip label="One entry per row — the assigned ability powers auto-calculated check modifiers.">
              <Input
                className="h-8 flex-1"
                placeholder={placeholder}
                value={e.name || ""}
                onChange={(ev) => {
                  const next = [...(entries || [])];
                  next[i] = { ...e, name: ev.target.value };
                  onChange(next);
                }}
              />
            </InfoTip>
            <Select
              value={e.ability || "—"}
              onValueChange={(v) => {
                const next = [...(entries || [])];
                next[i] = { ...e, ability: v };
                onChange(next);
              }}
            >
              <SelectTrigger className="h-8 w-16 shrink-0 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="—">—</SelectItem>
                {STATS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onChange((entries || []).filter((_, j) => j !== i))}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {shown.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {q.trim() ? "No matches." : "Empty."}
          </p>
        )}
      </div>
    </div>
  );
}

// One editable list of simple text entries, with a search box.
export function NameList({ label, entries, onChange, placeholder }) {
  const [q, setQ] = useState("");
  const shown = (entries || [])
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => matchesQuery(v, q));
  return (
    <div className="rounded-md border p-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{label}</span>
        <Button size="sm" variant="ghost" onClick={() => onChange([...entries, ""])}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <InfoTip label="Filter this list by name.">
        <Input
          className="mt-1 h-7"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </InfoTip>
      <div className="mt-1 space-y-1">
        {shown.map(({ v, i }) => (
          <div key={i} className="flex items-center gap-1">
            <InfoTip label="One entry per row — press + to add another.">
              <Input
                className="h-8 flex-1"
                placeholder={placeholder}
                value={v}
                onChange={(e) => {
                  const next = [...entries];
                  next[i] = e.target.value;
                  onChange(next);
                }}
              />
            </InfoTip>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onChange(entries.filter((_, j) => j !== i))}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {shown.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {q.trim() ? "No matches." : "Empty."}
          </p>
        )}
      </div>
    </div>
  );
}