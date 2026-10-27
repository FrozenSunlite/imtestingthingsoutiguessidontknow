// Weapon Upgrade helpers shared by the Reference Library tab, the View sheet
// and the dice roller. An upgrade carries its own matching rules (weapon
// category, melee/ranged, exact name, spellcasting requirement) and effects:
// add/remove damage dice, change the damage type, add a rider damage type,
// and a tagged effect/ability with its own trigger.

// Does the character have a spellcasting modifier: spells known, a spellcasting
// stat chosen, or a spell-attack modifier set.
export function hasSpellcasting(character = {}) {
  return (
    (character?.spellList || []).length > 0 ||
    !!character?.spellStat ||
    Number(character?.modifiers?.spellAttack || 0) !== 0
  );
}

// Does this upgrade fit the weapon? A field left blank imposes no restriction,
// so an upgrade with no rules at all fits every weapon.
export function upgradeMatches(upg, weapon = {}, character = {}) {
  if (!upg) return false;
  if (upg.category && String(weapon.category || "") !== upg.category) return false;
  if (upg.attackType && String(weapon.attackType || "") !== upg.attackType) return false;
  if (
    upg.weaponName &&
    String(weapon.name || "").toLowerCase() !== String(upg.weaponName).toLowerCase()
  )
    return false;
  if (upg.requiresSpellcasting && !hasSpellcasting(character)) return false;
  return true;
}

// Why an upgrade doesn't fit — shown as the apply button's tooltip.
export function upgradeBlockReason(upg, weapon = {}, character = {}) {
  if (upg.category && String(weapon.category || "") !== upg.category)
    return `Requires a ${upg.category} weapon`;
  if (upg.attackType && String(weapon.attackType || "") !== upg.attackType)
    return `Requires a ${upg.attackType} weapon`;
  if (upg.weaponName && String(weapon.name || "").toLowerCase() !== String(upg.weaponName).toLowerCase())
    return `Only fits ${upg.weaponName}`;
  if (upg.requiresSpellcasting && !hasSpellcasting(character))
    return "Requires a spellcasting modifier";
  return "";
}

// One-line summary of what the upgrade changes (tooltips, list rows).
export function upgradeSummary(upg) {
  const bits = [];
  const remove = Number(upg.removeDice) || 0;
  if (remove > 0) bits.push(`−${remove} die${remove > 1 ? "s" : ""}`);
  const add = Number(upg.addDiceCount) || 0;
  if (add > 0)
    bits.push(`+${add}${upg.addDieSize || ""}${upg.addDamageType ? ` ${upg.addDamageType}` : ""}`);
  else if (upg.addDamageType) bits.push(`+${upg.addDamageType} damage`);
  if (upg.replaceDamageType) bits.push(`damage becomes ${upg.replaceDamageType}`);
  if (upg.effectName)
    bits.push(`${upg.effectName}${upg.effectTrigger ? ` (${upg.effectTrigger})` : ""}`);
  return bits.join(" · ");
}

// Fold applied upgrades into a base weapon: the effective dice, damage type,
// rider damage lines and tagged effects. Dice can't drop below 1.
export function applyUpgrades(base = {}, upgrades = []) {
  let diceCount = Number(base.diceCount) || 0;
  let dieSize = base.dieSize || "";
  let damageType = base.damageType || "";
  const riders = [];
  const effects = [];
  (upgrades || []).forEach((up) => {
    if (!up) return;
    if (up.replaceDamageType) damageType = up.replaceDamageType;
    const add = Number(up.addDiceCount) || 0;
    if (add > 0)
      riders.push(`${add}${up.addDieSize || dieSize}${up.addDamageType ? ` ${up.addDamageType}` : ""}`);
    else if (up.addDamageType) riders.push(up.addDamageType);
    const remove = Number(up.removeDice) || 0;
    if (remove > 0) diceCount = Math.max(1, diceCount - remove);
    if (up.effectName)
      effects.push({ name: up.effectName, trigger: up.effectTrigger || "", text: up.effectText || "" });
  });
  const baseText =
    diceCount && dieSize ? `${diceCount}${dieSize}${damageType ? ` ${damageType}` : ""}` : "";
  return {
    diceCount,
    dieSize,
    damageType,
    riders,
    effects,
    damage: [baseText, ...riders].filter(Boolean).join(" + "),
  };
}