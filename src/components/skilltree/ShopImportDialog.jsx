import { useState } from "react";
import { useTree } from "@/lib/treeStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Upload } from "lucide-react";
import { matchesQuery } from "@/lib/textSearch";

// Import items from every reference-library list into the shop's stock.
// The price defaults to the item's "cost" string (e.g. "10 gp" → 10 gold),
// falling back to 10 gold; it can be edited afterwards in the Shop library tab.

export const CATEGORIES = [
  ["weapons", "Weapons", (lib) => lib.weapons || []],
  ["armor", "Armor", (lib) => lib.armor || []],
  ["adventuringGear", "Adventuring Gear", (lib) => lib.adventuringGear || []],
  ["ammo", "Ammunition", (lib) => lib.ammo || []],
  ["trinkets", "Trinkets", (lib) => lib.trinkets || []],
  ["explosives", "Explosives", (lib) => lib.explosives || []],
  ["wondrousItems", "Wondrous Items", (lib) => lib.wondrousItems || []],
  ["tradeGoods", "Trade Goods", (lib) => lib.tradeGoods || []],
  ["poisons", "Poisons", (lib) => lib.poisons || []],
  ["siege", "Siege Equipment", (lib) => lib.siege || []],
  ["vehicles", "Vehicles", (lib) => lib.vehicles || []],
];

// Turn a library "cost" string like "10 gp" into a shop price + currency.
export function parseCost(entry) {
  const m = String(entry?.cost ?? "")
    .trim()
    .match(/(\d+(?:\.\d+)?)\s*(cp|sp|ep|gp|pp)?\b/i);
  const cur = {
    cp: "copper",
    sp: "silver",
    ep: "electrum",
    gp: "gold",
    pp: "platinum",
  }[(m?.[2] || "").toLowerCase()];
  return { price: m ? Number(m[1]) : 10, currency: cur || "gold" };
}

// A short summary line for items without a description.
export function describe(key, e) {
  if (key === "weapons")
    return [
      e.attackType,
      `${e.diceCount ?? 1}${e.dieSize || "d6"}${e.damageType ? ` ${e.damageType}` : ""}`,
      ...(e.properties || []),
    ]
      .filter(Boolean)
      .join(" · ");
  if (key === "armor")
    return [
      e.type ? `${e.type} armor` : "",
      e.ac ? `AC ${e.ac}` : "",
      e.requirement ? `req. ${e.requirement}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  if (key === "ammo")
    return [e.damage, `pack of ${e.packSize ?? 20}`].filter(Boolean).join(" · ");
  if (key === "poisons")
    return [
      e.dc ? `DC ${e.dc}` : "",
      e.damage ? `${e.damage}${e.damageType ? ` ${e.damageType}` : ""}` : "",
      e.status ? `${e.status}${e.duration ? ` (${e.duration})` : ""}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  return [e.category, e.period].filter(Boolean).join(" · ");
}

export function ShopImportDialog({ open, onClose }) {
  const { settings, setSettings } = useTree();
  const [cat, setCat] = useState("weapons");
  const [q, setQ] = useState("");
  const lib = settings?.library || {};
  const def = CATEGORIES.find(([key]) => key === cat) || CATEGORIES[0];
  const shopNames = new Set((lib.shop || []).map((s) => (s.name || "").toLowerCase()));
  const items = def[2](lib).filter((e) => e?.name && matchesQuery(e.name, q));

  const importItem = (e) => {
    const { price, currency } = parseCost(e);
    setSettings((s) => ({
      ...s,
      library: {
        ...s.library,
        shop: [
          ...(s.library?.shop || []),
          {
            name: e.name,
            category: def[1],
            price,
            currency,
            weight: Number(e.weight) || 0,
            description: e.description || describe(cat, e),
          },
        ],
      },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import into shop</DialogTitle>
          <DialogDescription>
            Pull any item from the reference library into the shop's stock. The price comes from
            the item's listed cost (default 10 gold) and can be changed in the library's Shop tab.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Select
            value={cat}
            onValueChange={(v) => {
              setCat(v);
              setQ("");
            }}
          >
            <SelectTrigger className="h-8 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="h-8 w-40"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {items.map((e, i) => {
            const inShop = shopNames.has((e.name || "").toLowerCase());
            return (
              <div key={i} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{e.name}</div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {[e.cost, describe(cat, e), e.description].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {inShop ? (
                  <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                    <Check className="h-3 w-3" /> In shop
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    title={`Import ${e.name} into the shop`}
                    onClick={() => importItem(e)}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {q.trim() ? "No matches in this list." : "Nothing in this library list yet."}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}