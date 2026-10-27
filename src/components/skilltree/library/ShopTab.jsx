import { useTree } from "@/lib/treeStore";
import { useLibList, ListHeader, EmptyNote, EntryCard } from "./shared";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULT_CURRENCIES = [
  { key: "copper", name: "Copper" },
  { key: "silver", name: "Silver" },
  { key: "gold", name: "Gold" },
  { key: "electrum", name: "Electrum" },
  { key: "platinum", name: "Platinum" },
];

// Shop inventory: items with a price and currency, bought in the Values
// tab's Shop section. Invested nodes can discount purchases via a resource
// named "Shop Discount" (value = percent).
export function ShopTab() {
  const { items, add, patch, remove, query, setQuery, shown } = useLibList("shop");
  const { settings } = useTree();
  const currencies = (settings?.library?.currencies || []).length
    ? settings.library.currencies
    : DEFAULT_CURRENCIES;
  const defaultCurrency = currencies[2]?.key || currencies[0]?.key || "gold";

  return (
    <div className="space-y-2">
      <ListHeader
        onAdd={() =>
          add({ name: "", category: "", price: 10, currency: defaultCurrency, weight: 0, description: "" })
        }
        addLabel="Add shop item"
        query={query}
        setQuery={setQuery}
      />
      <EmptyNote items={items} query={query} />
      {shown.map(({ e, i }) => (
        <EntryCard key={i} entry={e} onPatch={(p) => patch(i, p)} onDelete={() => remove(i)}>
          <div className="flex flex-wrap items-center gap-1">
            <Input
              className="h-8 min-w-24 flex-1"
              placeholder="Item name"
              value={e.name || ""}
              onChange={(ev) => patch(i, { name: ev.target.value })}
            />
            <Input
              className="h-8 w-28"
              placeholder="Category"
              value={e.category || ""}
              onChange={(ev) => patch(i, { category: ev.target.value })}
            />
            <Input
              type="number"
              min={0}
              className="h-8 w-20"
              title="Price"
              value={e.price ?? 0}
              onChange={(ev) => patch(i, { price: Number(ev.target.value) || 0 })}
            />
            <Select
              value={e.currency || defaultCurrency}
              onValueChange={(v) => patch(i, { currency: v })}
            >
              <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c.key || c.name} value={c.key || String(c.name || "").toLowerCase()}>
                    {c.name || c.key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              className="h-8 w-16"
              title="Weight each (lb)"
              value={e.weight ?? 0}
              onChange={(ev) => patch(i, { weight: Number(ev.target.value) || 0 })}
            />
          </div>
        </EntryCard>
      ))}
    </div>
  );
}