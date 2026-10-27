import { useTree, effectiveChoices } from "@/lib/treeStore";
import { optionAtPath } from "@/lib/optionTree";
import { Label } from "@/components/ui/label";

// Every ability the character holds: benefits chosen on taken nodes, grants
// forced with the node (e.g. detriments), and options attached to a chosen
// benefit ("take one, get both"). All derived live from the tree.
export function AbilitiesSection() {
  const { mergedTree: tree, character } = useTree();
  const choices = effectiveChoices(character, tree);
  const byId = Object.fromEntries((tree?.nodes || []).map((n) => [n.id, n]));

  const rows = (tree?.nodes || [])
    .map((n) => {
      const names = choices[n.id] || [];
      if (!names.length) return null;
      const manual = character.abilityChoices?.[n.id] || [];
      const autoNames = Array.isArray(n.grants)
        ? (n.currentPoints || 0) > 0
          ? n.grants.map((g) => g?.name).filter(Boolean)
          : []
        : [];
      const items = names.map((name) => {
        // A choice may be a subtree path ("Archery > Precision") — describe it
        // from the final option it resolves to.
        const opt = optionAtPath(n, name, byId);
        const tag = autoNames.includes(name)
          ? "Granted"
          : manual.includes(name)
          ? "Chosen"
          : "Via link";
        return { name, description: opt?.description || "", tag };
      });
      return { node: n, items };
    })
    .filter(Boolean);

  const tagCls = {
    Granted: "bg-amber-500/15 text-amber-600",
    "Via link": "bg-emerald-500/15 text-emerald-600",
    Chosen: "bg-muted text-muted-foreground",
  };

  return (
    <div>
      <Label className="mb-1.5 block">Abilities & Grants</Label>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No abilities yet — invest points in nodes with ability options or grants.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map(({ node, items }) => (
            <div key={node.id} className="rounded-md border p-2">
              <div className="text-xs font-medium">{node.name || node.id}</div>
              <div className="mt-1 space-y-1">
                {items.map((it, i) => (
                  <div key={i} className="rounded bg-muted/50 px-2 py-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">{it.name}</span>
                      <span
                        className={`shrink-0 rounded px-1 py-0.5 text-[9px] uppercase tracking-wide ${tagCls[it.tag]}`}
                      >
                        {it.tag}
                      </span>
                    </div>
                    {it.description && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{it.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}