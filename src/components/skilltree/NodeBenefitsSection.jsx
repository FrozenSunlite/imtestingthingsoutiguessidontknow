import { useState } from "react";
import { useTree } from "@/lib/treeStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import { BenefitTableDialog } from "@/components/skilltree/BenefitTableDialog";
import {
  BENEFIT_CATEGORIES,
  BENEFIT_CATEGORY_FOR_5E,
  benefitId,
  benefitOptions,
  benefitSpells,
  tableSummary,
} from "@/lib/benefits";

// A compact drop grid for node benefits. Drop a Reference Index entry onto a
// category, or type/choose a name from the library list for that category.
export function NodeBenefitsSection({ node, set }) {
  const { settings } = useTree();
  const [drafts, setDrafts] = useState({});
  const [tableOpen, setTableOpen] = useState(false);
  const benefits = node.benefits || [];

  const add = (category, value, extra = {}) => {
    const name = String(value || "").trim();
    if (!name) return;
    set({
      benefits: [
        ...benefits,
        {
          id: benefitId(),
          category,
          name,
          source: extra.source || "",
          description: extra.description || "",
          image: extra.image || "",
          table: extra.table || null,
          ...(extra.value != null ? { value: Number(extra.value) || 0 } : {}),
        },
      ],
    });
  };

  const remove = (id) =>
    set({ benefits: benefits.filter((b) => b.id !== id) });

  const onDrop = (e, category) => {
    e.preventDefault();
    let payload = null;
    try {
      const rawBenefit = e.dataTransfer.getData("application/x-benefit");
      if (rawBenefit) payload = JSON.parse(rawBenefit);
      else {
        const raw5e = e.dataTransfer.getData("application/x-5etools-entry");
        if (raw5e) {
          const p = JSON.parse(raw5e);
          payload = {
            name: p.name,
            description: p.description,
            image: p.image,
            source: p.flavor,
            category: BENEFIT_CATEGORY_FOR_5E[p.category] || "other",
          };
        }
      }
    } catch {
      payload = null;
    }
    if (!payload?.name) return;
    add(category, payload.name, payload);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Granted Benefits</Label>
        <span className="text-[10px] text-muted-foreground">
          Drop from the Reference Library or type a name
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {BENEFIT_CATEGORIES.map((cat) => {
          const options = benefitOptions(settings, cat.id);
          const list = `benefit-${cat.id}-${node.id}`;
          const mine = benefits.filter((b) => b.category === cat.id);
          return (
            <div
              key={cat.id}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDrop={(e) => onDrop(e, cat.id)}
              className="rounded-md border border-dashed p-1.5"
              title="Drop a Reference Library entry here"
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {cat.label}
                </span>
                <span className="text-[10px] text-muted-foreground">{mine.length}</span>
              </div>
              <div className="flex items-center gap-1">
                {cat.id === "table" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-full text-[10px]"
                    onClick={() => setTableOpen(true)}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> New table
                  </Button>
                ) : (
                  <>
                    <Input
                      className="h-7 min-w-0 flex-1 text-[11px]"
                      list={options.length ? list : undefined}
                      placeholder="Type or choose…"
                      value={drafts[cat.id] || ""}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [cat.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        add(cat.id, drafts[cat.id], {
                          value: drafts[`${cat.id}:value`],
                        });
                        setDrafts((d) => ({ ...d, [cat.id]: "" }));
                      }}
                    />
                    {options.length > 0 && (
                      <datalist id={list}>
                        {[...new Set(options)].map((name) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                    )}
                    {cat.id === "attribute" && (
                      <Input
                        className="h-7 w-12 text-[11px]"
                        type="number"
                        title="Attribute bonus amount"
                        value={drafts[`${cat.id}:value`] ?? 1}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [`${cat.id}:value`]: e.target.value,
                          }))
                        }
                      />
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      title={`Add ${cat.label.toLowerCase()}`}
                      onClick={() => {
                        add(cat.id, drafts[cat.id], {
                          value: drafts[`${cat.id}:value`],
                        });
                        setDrafts((d) => ({ ...d, [cat.id]: "" }));
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
              {mine.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {mine.map((b) => (
                    <span
                      key={b.id}
                      title={
                        b.table
                          ? tableSummary(b.table, benefitSpells(settings))
                          : b.description || b.name
                      }
                      className="inline-flex max-w-full items-center gap-0.5 rounded bg-muted px-1 py-0.5 text-[9px]"
                    >
                      <span className="truncate">
                        {b.name}
                        {b.category === "attribute"
                          ? ` +${Number(b.value) || 1}`
                          : ""}
                      </span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive"
                        title="Remove benefit"
                        onClick={() => remove(b.id)}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <BenefitTableDialog
        open={tableOpen}
        onClose={() => setTableOpen(false)}
        onSave={({ name, table }) => add("table", name, { table })}
        spells={benefitSpells(settings)}
        schools={settings?.library?.spellSchools || []}
      />
    </div>
  );
}
