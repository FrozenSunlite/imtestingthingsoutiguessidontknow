import { useTree } from "@/lib/treeStore";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLibList, ListHeader, EmptyNote, EntryCard, CostField } from "./shared";
import { InfoTip } from "@/components/skilltree/InfoTip";
import { upgradeSummary } from "@/lib/upgrades";

// Reference Library tab: Weapon Upgrades. Each upgrade states which weapons it
// fits (category, melee/ranged, an exact name, or a spellcasting requirement —
// any field left blank imposes no restriction) and what it changes: damage
// dice added or removed, the damage type replaced or a rider type added, and
// an effect/ability with its own trigger that rides on the weapon's text.
export function UpgradesTab() {
  const { settings } = useTree();
  const lib = settings.library;
  const cats = lib.weaponCategories || [];
  const triggers = lib.triggers || [];
  const damageTypes = lib.damageTypes || [];
  const u = useLibList("weaponUpgrades");
  return (
    <div className="space-y-2">
      <ListHeader
        onAdd={() =>
          u.add({
            name: "",
            description: "",
            category: "",
            attackType: "",
            weaponName: "",
            requiresSpellcasting: false,
            replaceDamageType: "",
            addDiceCount: "",
            addDieSize: "",
            addDamageType: "",
            removeDice: "",
            effectName: "",
            effectTrigger: "",
            effectText: "",
            cost: "",
          })
        }
        addLabel="Add upgrade"
        query={u.query}
        setQuery={u.setQuery}
        searchPlaceholder="Search upgrades…"
      />
      <EmptyNote items={u.items} query={u.query} />
      {u.shown.map(({ e, i }) => (
        <EntryCard key={i} entry={e} onPatch={(p) => u.patch(i, p)} onDelete={() => u.remove(i)}>
          <div className="grid grid-cols-2 gap-1.5">
            <InfoTip label="The upgrade's display name, e.g. Flame Tongue.">
              <Input
                className="h-8"
                placeholder="Upgrade name"
                value={e.name || ""}
                onChange={(ev) => u.patch(i, { name: ev.target.value })}
              />
            </InfoTip>
            <InfoTip label="Cost and currency, e.g. 500 gp.">
              <CostField value={e.cost} onChange={(v) => u.patch(i, { cost: v })} />
            </InfoTip>
          </div>

          {/* Matching rules */}
          <div className="rounded-md border p-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Fits which weapons?
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Blank = any. The upgrade can only be applied when every set rule matches.
            </p>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              <InfoTip label="Weapon category it fits, e.g. Simple, Martial.">
                <Select value={e.category || "any"} onValueChange={(v) => u.patch(i, { category: v === "any" ? "" : v })}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Any category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any category</SelectItem>
                    {cats.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </InfoTip>
              <InfoTip label="Melee or ranged weapons only, or either.">
                <Select value={e.attackType || "any"} onValueChange={(v) => u.patch(i, { attackType: v === "any" ? "" : v })}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Melee or ranged" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Melee or ranged</SelectItem>
                    <SelectItem value="melee">Melee only</SelectItem>
                    <SelectItem value="ranged">Ranged only</SelectItem>
                  </SelectContent>
                </Select>
              </InfoTip>
              <InfoTip label="Fits only this exact weapon name; blank fits any weapon.">
                <Input
                  className="h-8"
                  placeholder="Exact weapon name (optional)"
                  list="upgrade-weapon-names"
                  value={e.weaponName || ""}
                  onChange={(ev) => u.patch(i, { weaponName: ev.target.value })}
                />
              </InfoTip>
              <InfoTip label="Requires the character to have a spellcasting modifier (spells known, a spellcasting stat or a spell-attack modifier).">
                <label className="flex h-8 items-center gap-1.5 text-xs">
                  <Switch
                    checked={!!e.requiresSpellcasting}
                    onCheckedChange={(v) => u.patch(i, { requiresSpellcasting: v })}
                  />
                  Requires spellcasting
                </label>
              </InfoTip>
            </div>
          </div>

          {/* Effects on the weapon */}
          <div className="rounded-md border p-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              What it changes
            </p>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              <InfoTip label="The weapon's base damage type becomes this, e.g. fire. Blank keeps the weapon's type.">
                <Input
                  className="h-8"
                  placeholder="Change damage type to…"
                  list="upgrade-damage-types"
                  value={e.replaceDamageType || ""}
                  onChange={(ev) => u.patch(i, { replaceDamageType: ev.target.value })}
                />
              </InfoTip>
              <InfoTip label="Adds this many extra damage dice to every attack, e.g. 1.">
                <Input
                  className="h-8"
                  type="number"
                  min={0}
                  placeholder="Add dice"
                  value={e.addDiceCount ?? ""}
                  onChange={(ev) => u.patch(i, { addDiceCount: ev.target.value === "" ? "" : Math.max(0, Number(ev.target.value)) })}
                />
              </InfoTip>
              <InfoTip label="Die size of the added dice, e.g. d6. Blank uses the weapon's die size.">
                <Input
                  className="h-8"
                  placeholder="Added die size (d6)"
                  value={e.addDieSize || ""}
                  onChange={(ev) => u.patch(i, { addDieSize: ev.target.value })}
                />
              </InfoTip>
              <InfoTip label="Damage type of the added dice, e.g. fire. Without a dice count this is a plain rider damage type.">
                <Input
                  className="h-8"
                  placeholder="Added damage type"
                  list="upgrade-damage-types"
                  value={e.addDamageType || ""}
                  onChange={(ev) => u.patch(i, { addDamageType: ev.target.value })}
                />
              </InfoTip>
              <InfoTip label="Removes this many of the weapon's base damage dice, e.g. a cursed upgrade.">
                <Input
                  className="h-8"
                  type="number"
                  min={0}
                  placeholder="Remove dice"
                  value={e.removeDice ?? ""}
                  onChange={(ev) => u.patch(i, { removeDice: ev.target.value === "" ? "" : Math.max(0, Number(ev.target.value)) })}
                />
              </InfoTip>
              <InfoTip label="Name of the effect or ability this upgrade grants, shown with the weapon when applied.">
                <Input
                  className="h-8"
                  placeholder="Effect name (e.g. Burning Strikes)"
                  value={e.effectName || ""}
                  onChange={(ev) => u.patch(i, { effectName: ev.target.value })}
                />
              </InfoTip>
              <InfoTip label="When the effect happens — pick a trigger from the Triggers tab, e.g. On Hit.">
                <Input
                  className="h-8"
                  placeholder="Trigger (e.g. On Hit)"
                  list="upgrade-triggers"
                  value={e.effectTrigger || ""}
                  onChange={(ev) => u.patch(i, { effectTrigger: ev.target.value })}
                />
              </InfoTip>
            </div>
            <InfoTip label="Full effect text shown with the weapon's other abilities once applied.">
              <Textarea
                className="mt-1.5 min-h-10 text-xs"
                placeholder="Effect text — what happens when the trigger fires…"
                value={e.effectText || ""}
                onChange={(ev) => u.patch(i, { effectText: ev.target.value })}
              />
            </InfoTip>
          </div>

          {(e.name || e.description) && (
            <p className="text-[10px] text-muted-foreground">
              {upgradeSummary(e) || "No changes yet."}
            </p>
          )}
          <datalist id="upgrade-weapon-names">
            {(lib.weapons || []).filter((w) => w.name).map((w) => (
              <option key={w.name} value={w.name} />
            ))}
          </datalist>
          <datalist id="upgrade-damage-types">
            {damageTypes.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
          <datalist id="upgrade-triggers">
            {triggers.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </EntryCard>
      ))}
    </div>
  );
}