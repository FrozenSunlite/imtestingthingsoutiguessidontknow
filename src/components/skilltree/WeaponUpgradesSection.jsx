import { useState } from "react";
import { useTree } from "@/lib/treeStore";
import {
  upgradeMatches,
  upgradeBlockReason,
  upgradeSummary,
  applyUpgrades,
} from "@/lib/upgrades";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfoTip } from "./InfoTip";
import { X } from "lucide-react";

// View screen (Inventory tab): apply Weapon Upgrades from the Reference
// Library to a weapon. The weapon can come from the library itself or from a
// carried weapon-type inventory item. An upgrade only appears as applicable
// when its matching rules allow it — category, melee/ranged, exact name or a
// spellcasting requirement. Applied upgrades recompute the weapon's damage
// (dice added or removed, type changed, rider types) and attach their tagged
// effects with their triggers; the dice roller rolls the effective damage.

export function WeaponUpgradesSection() {
  const { character, setCharacter, settings } = useTree();
  const lib = settings?.library || {};
  const upgrades = (lib.weaponUpgrades || []).filter((u) => u.name);
  const [weaponKey, setWeaponKey] = useState("");

  // Weapons to upgrade: library weapons (full stats) and carried Weapon items.
  const libWeapons = (lib.weapons || []).filter((w) => w.name);
  const invWeapons = (character.inventory || []).filter((it) => it.type === "Weapon" && it.name);
  const options = [
    ...libWeapons.map((w) => ({
      key: `Library:${w.name}`,
      source: "Library",
      name: w.name,
      category: w.category || "",
      attackType: w.attackType || "",
      base: w,
    })),
    ...invWeapons.map((it) => ({
      key: `Carried:${it.name}`,
      source: "Carried",
      name: it.name,
      category: "",
      attackType: "",
      base: it,
    })),
  ];
  const weapon = options.find((o) => o.key === weaponKey) || null;

  const applied = (character.appliedUpgrades || []).filter((a) => a.weapon === weaponKey);
  const appliedNames = new Set(applied.map((a) => a.upgrade));
  const byName = (n) => upgrades.find((u) => u.name === n);

  const apply = (u) =>
    setCharacter({
      ...character,
      appliedUpgrades: [...(character.appliedUpgrades || []), { weapon: weaponKey, upgrade: u.name }],
    });
  const remove = (name) =>
    setCharacter({
      ...character,
      appliedUpgrades: (character.appliedUpgrades || []).filter(
        (a) => !(a.weapon === weaponKey && a.upgrade === name)
      ),
    });

  const effective = weapon
    ? applyUpgrades(weapon.base, applied.map((a) => byName(a.upgrade)).filter(Boolean))
    : null;
  const compatible = weapon
    ? upgrades.filter((u) => !appliedNames.has(u.name) && upgradeMatches(u, weapon, character))
    : [];
  const blocked = weapon
    ? upgrades.filter((u) => !appliedNames.has(u.name) && !upgradeMatches(u, weapon, character))
    : [];

  return (
    <div className="rounded-md border p-2">
      <div className="flex items-center justify-between">
        <Label>Weapon Upgrades</Label>
        {weapon && (
          <InfoTip label="The weapon's damage with every applied upgrade folded in.">
            <span className="font-mono text-xs">{effective.damage || "—"}</span>
          </InfoTip>
        )}
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        Pick a weapon, then apply upgrades that fit it. Changes flow into its damage and abilities.
      </p>

      <InfoTip label="Which weapon to upgrade — library weapons, or a weapon carried in inventory.">
        <Select value={weaponKey} onValueChange={setWeaponKey}>
          <SelectTrigger className="mt-1 h-8 text-xs">
            <SelectValue placeholder="Choose a weapon…" />
          </SelectTrigger>
          <SelectContent>
            {libWeapons.length > 0 && (
              <SelectGroup>
                <SelectLabel>Library</SelectLabel>
                {libWeapons.map((w) => (
                  <SelectItem key={`Library:${w.name}`} value={`Library:${w.name}`}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {invWeapons.length > 0 && (
              <SelectGroup>
                <SelectLabel>Carried</SelectLabel>
                {invWeapons.map((it) => (
                  <SelectItem key={`Carried:${it.name}`} value={`Carried:${it.name}`}>
                    {it.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      </InfoTip>

      {weapon && (
        <div className="mt-2 space-y-2">
          {/* Applied upgrades */}
          {applied.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">No upgrades applied yet.</p>
          ) : (
            <div className="space-y-1">
              {applied.map((a) => {
                const u = byName(a.upgrade);
                if (!u) return null;
                const eff = applyUpgrades(weapon.base, [u]);
                return (
                  <div key={a.upgrade} className="rounded-md border bg-muted/40 p-1.5">
                    <div className="flex items-center gap-1">
                      <span className="flex-1 truncate text-xs font-semibold">{u.name}</span>
                      {eff.damage && (
                        <span className="font-mono text-[10px] text-muted-foreground">{eff.damage}</span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        title="Remove this upgrade"
                        onClick={() => remove(u.name)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {(u.description || u.effectName) && (
                      <div className="mt-0.5 space-y-0.5 text-[10px] text-muted-foreground">
                        {u.effectName && (
                          <p>
                            <span className="font-medium text-foreground">{u.effectName}</span>
                            {u.effectTrigger && (
                              <span className="ml-1 rounded bg-sky-100 px-1 py-0.5 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                                ⚡ {u.effectTrigger}
                              </span>
                            )}
                            {u.effectText ? ` — ${u.effectText}` : ""}
                          </p>
                        )}
                        {u.description && <p>{u.description}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="text-[10px] text-muted-foreground">
                Effective damage: <span className="font-mono">{effective.damage || "—"}</span>
              </p>
            </div>
          )}

          {/* Applicable upgrades */}
          {compatible.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Fits this weapon
              </p>
              {compatible.map((u) => (
                <div key={u.name} className="flex items-center gap-1.5 rounded-md border px-2 py-1">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{u.name}</div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      {upgradeSummary(u) || u.description || ""}
                    </div>
                  </div>
                  <InfoTip label={upgradeSummary(u) || "Adds this upgrade to the weapon."}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 shrink-0"
                      title={`Apply ${u.name}`}
                      onClick={() => apply(u)}
                    >
                      Apply
                    </Button>
                  </InfoTip>
                </div>
              ))}
            </div>
          )}

          {/* Incompatible upgrades, with the reason */}
          {blocked.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Doesn't fit
              </p>
              {blocked.map((u) => (
                <div
                  key={u.name}
                  className="flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1 opacity-70"
                  title={upgradeBlockReason(u, weapon, character)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs">{u.name}</div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      {upgradeBlockReason(u, weapon, character)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {compatible.length === 0 && blocked.length === 0 && (
            <p className="text-[10px] text-muted-foreground">
              No upgrades in the library yet — add them in the Reference Library's Weapon Upgrades
              tab.
            </p>
          )}
        </div>
      )}
    </div>
  );
}