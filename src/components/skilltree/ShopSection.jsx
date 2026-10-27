import { useState } from "react";
import { useTree, shopDiscount, pushActivityLog } from "@/lib/treeStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { matchesQuery } from "@/lib/textSearch";
import { ShopImportDialog } from "@/components/skilltree/ShopImportDialog";
import { ShoppingCart, Upload } from "lucide-react";

// Shop: buy from the library's Shop list. Items can be imported here from
// every reference-library list (weapons, armor, gear, ammo, trinkets,
// explosives, wondrous items, trade goods, poisons, siege, vehicles).
// Invested nodes can grant a discount via a resource named "Shop Discount"
// whose value is a percent. Buying subtracts the (discounted) price from
// that currency and adds the item to the inventory, logged in the activity log.
export function ShopSection() {
  const { mergedTree: tree, character, setCharacter, settings } = useTree();
  const [q, setQ] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const shop = (settings?.library?.shop || []).filter((s) => s.name);
  const disc = shopDiscount(tree);
  const currencies = settings?.library?.currencies?.length
    ? settings.library.currencies
    : [{ key: "gold", name: "Gold" }];
  const coinName = (key) =>
    currencies.find((c) => (c.key || String(c.name || "").toLowerCase()) === key)?.name || key;

  const buy = (entry) => {
    const key = entry.currency || "gold";
    const price = Math.max(0, Math.ceil((Number(entry.price) || 0) * ((100 - disc) / 100)));
    const coins = { ...(character.coins || {}) };
    const have = Number(coins[key]) || 0;
    if (have < price) return;
    coins[key] = have - price;
    setCharacter((c) =>
      pushActivityLog(
        {
          ...c,
          coins,
          inventory: [
            ...(c.inventory || []),
            {
              name: entry.name,
              qty: 1,
              weight: Number(entry.weight) || 0,
              tag: entry.tag || "Mundane",
              rarity: entry.rarity || "Common",
              type: entry.type || "Item",
              category: entry.category || "",
              description: entry.description || "",
            },
          ],
        },
        `Bought ${entry.name} for ${price} ${coinName(key)}${disc ? ` (${disc}% discount)` : ""}`
      )
    );
  };

  const shown = q.trim() ? shop.filter((s) => matchesQuery(s.name, q)) : shop;
  // Group entries by category (Uncategorized last) for category-based buying.
  const groups = [];
  shown.forEach((entry, i) => {
    const cat = entry.category || "Uncategorized";
    let g = groups.find((x) => x.cat === cat);
    if (!g) {
      g = { cat, items: [] };
      groups.push(g);
    }
    g.items.push({ entry, i });
  });
  groups.sort((a, b) =>
    a.cat === "Uncategorized" ? 1 : b.cat === "Uncategorized" ? -1 : a.cat.localeCompare(b.cat)
  );
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Shop</Label>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            title="Import items from the reference library (weapons, armor, gear, ammunition, trinkets, explosives, wondrous items, trade goods, poisons, siege equipment, vehicles)"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="mr-1 h-4 w-4" /> Import
          </Button>
          <Input
            className="h-7 w-40"
            placeholder="Search shop…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        {groups.map((g) => (
          <div key={g.cat}>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {g.cat}
            </div>
            <div className="space-y-1">
              {g.items.map(({ entry, i }) => {
                const key = entry.currency || "gold";
                const price = Math.ceil((Number(entry.price) || 0) * ((100 - disc) / 100));
                const afford = (Number((character.coins || {})[key]) || 0) >= price;
                return (
                  <div key={i} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{entry.name}</div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {entry.category ? `${entry.category} · ` : ""}
                        {Number(entry.weight) > 0 ? `${entry.weight} lb · ` : ""}
                        {entry.description || ""}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      {disc > 0 && (
                        <span className="mr-1 text-[10px] text-muted-foreground line-through">
                          {entry.price}
                        </span>
                      )}
                      <span className="font-mono font-medium">{price}</span>{" "}
                      <span className="text-[10px] text-muted-foreground">{coinName(key)}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!afford}
                      title={afford ? "Buy" : `Not enough ${coinName(key)}`}
                      onClick={() => buy(entry)}
                    >
                      <ShoppingCart className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {shop.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            The shop is empty — import items from the reference library, or add them in the
            library's Shop tab.
          </p>
        ) : (
          shown.length === 0 && <p className="text-xs text-muted-foreground">No matches.</p>
        )}
      </div>
      {disc > 0 && (
        <p className="text-[10px] text-emerald-600">
          Talent discount: −{disc}% (from invested nodes granting a "Shop Discount" resource).
        </p>
      )}
      <ShopImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}