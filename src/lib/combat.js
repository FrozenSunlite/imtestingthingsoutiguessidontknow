// Tactical combat: grid, initiative, movement, attacks, monster/party
// conversion and simple computer-controlled enemy turns.
//
// The whole encounter lives in world.combat so it survives leaving the World
// Builder and reloading the project. Everything here is pure (returns new
// objects) except the dice rolls, which are deliberately random.

export const GRID_WIDTH = 18;
export const GRID_HEIGHT = 12;

const STATS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

export const abilityMod = (score) => Math.floor((Number(score || 10) - 10) / 2);

export const combatantName = (combatant) =>
  combatant?.name || combatant?.monsterName || "Combatant";

// ---------------------------------------------------------------------------
// Dice
// ---------------------------------------------------------------------------

// Roll "2d6+3", "1d8 - 1", "1d10", or a plain number. Returns the total, the
// individual dice and a readable detail string for the combat log.
export function rollDice(expr, rng = Math.random) {
  const text = String(expr ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!text) return { total: 0, rolls: [], detail: "0" };
  const parts = text.match(/[+-]?[^+-]+/g) || [];
  let total = 0;
  const rolls = [];
  const details = [];
  parts.forEach((part) => {
    const dice = /^([+-]?)(\d*)d(\d+)$/.exec(part);
    if (dice) {
      const sign = dice[1] === "-" ? -1 : 1;
      const count = Math.max(1, Math.min(50, Number(dice[2]) || 1));
      const size = Math.max(2, Math.min(1000, Number(dice[3]) || 6));
      const values = Array.from({ length: count }, () => 1 + Math.floor(rng() * size));
      total += sign * values.reduce((a, b) => a + b, 0);
      rolls.push(...values.map((v) => sign * v));
      details.push(`${sign < 0 ? "-" : ""}${count}d${size}[${values.join(",")}]`);
      return;
    }
    const n = Number(part);
    if (Number.isFinite(n)) {
      total += n;
      details.push(String(n));
    }
  });
  return { total, rolls, detail: details.join(" ") || "0" };
}

export const rollD20 = (rng = Math.random) => 1 + Math.floor(rng() * 20);

// ---------------------------------------------------------------------------
// Conversions
// ---------------------------------------------------------------------------

export function parseNumber(value, fallback = 0) {
  if (value == null || value === "") return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const text = String(value);
  const first = text.match(/\d+/);
  return first ? Number(first[0]) : fallback;
}

export function speedSpaces(value, fallback = 6) {
  if (value == null || value === "") return fallback;
  if (typeof value === "number") return value;
  const text = String(value);
  // Speeds are usually written in feet ("30 ft."); the grid is 5 ft / space.
  const feet = text.match(/(\d+)\s*(?:ft|feet|')/i);
  if (feet) return Math.max(1, Math.round(Number(feet[1]) / 5));
  const spaces = text.match(/(\d+)\s*spaces?/i);
  if (spaces) return Math.max(1, Number(spaces[1]));
  const plain = text.match(/\d+/);
  if (plain) {
    const n = Number(plain[0]);
    return n > 12 ? Math.max(1, Math.round(n / 5)) : Math.max(1, n);
  }
  return fallback;
}

export function parseAbilities(source) {
  const out = Object.fromEntries(STATS.map((key) => [key, 10]));
  if (!source) return out;
  if (typeof source === "object" && !Array.isArray(source)) {
    STATS.forEach((key) => {
      const value = source[key] ?? source[key.toLowerCase()];
      if (value != null) out[key] = parseNumber(value, 10);
    });
    return out;
  }
  const text = String(source);
  STATS.forEach((key) => {
    const match = new RegExp(`${key}\\s*[:=]?\\s*(-?\\d+)`, "i").exec(text);
    if (match) out[key] = Number(match[1]);
  });
  return out;
}

const ATTACK_TYPE = {
  melee: 1,
  reach: 1,
  ranged: 8,
};

// Pull usable attacks out of a monster's action list. Most 5e stat blocks put
// the numbers in the text ("Melee Weapon Attack: +5 to hit ... Hit: 12
// (2d8 + 3) slashing damage"), so parse that instead of relying on a schema.
export function attacksFromMonster(monster) {
  const actions = [
    ...(monster?.actions || []),
    ...(monster?.bonusActions || []),
  ];
  const attacks = actions
    .map((action) => {
      const text = String(action?.text || action?.description || "");
      const combined = `${action?.name || ""} ${text}`;
      const bonus =
        /([+-]\d+)\s*to\s*hit/i.exec(combined)?.[1] ??
        /attack\s*(?:roll)?\s*[:=]?\s*([+-]\d+)/i.exec(combined)?.[1];
      const damageExpr =
        /(?:hit|damage)\s*[:=]?\s*[^()]*\(([^)]+)\)/i.exec(combined)?.[1] ||
        /(\d+d\d+(?:\s*[+-]\s*\d+)?)/i.exec(combined)?.[1];
      if (bonus == null && damageExpr == null) return null;
      const numericBonus = Number(bonus || 0);
      const range = /ranged/i.test(combined)
        ? 8
        : /reach\s*(\d+)/i.test(combined)
          ? Math.max(1, Math.round(Number(/reach\s*(\d+)/i.exec(combined)[1]) / 5))
          : ATTACK_TYPE.melee;
      const damageType =
        /(slashing|piercing|bludgeoning|fire|cold|acid|poison|necrotic|radiant|thunder|lightning|psychic|force)/i.exec(
          combined
        )?.[1] || "";
      return {
        name: action?.name || "Attack",
        bonus: numericBonus,
        range,
        damage: String(damageExpr || "1d6").replace(/\s+/g, ""),
        damageType,
        detail: combined.trim(),
      };
    })
    .filter(Boolean)
    .slice(0, 4);
  if (attacks.length) return attacks;
  return [
    {
      name: "Strike",
      bonus: 3,
      range: 1,
      damage: "1d6+1",
      damageType: "",
      detail: "A basic strike.",
    },
  ];
}

export function monsterToCombatant(monster, { side = "enemy", index = 0, x, y } = {}) {
  const abilities = parseAbilities(monster?.abilities);
  const maxHp = Math.max(1, parseNumber(monster?.hp, 4 + index * 4));
  const ac = Math.max(8, parseNumber(monster?.ac, 12));
  const dexMod = abilityMod(abilities.DEX);
  return {
    id: `cmb_mon_${index}_${Math.floor(Math.random() * 1e8).toString(36)}`,
    name: `${monster?.name || "Monster"}${index ? ` ${index + 1}` : ""}`,
    monsterName: monster?.name || "Monster",
    kind: "monster",
    side,
    x: x ?? 0,
    y: y ?? 0,
    maxHp,
    hp: maxHp,
    ac,
    initiative: 0,
    initiativeBonus: dexMod + (monster?.initiative ? Number(monster.initiative) || 0 : 0),
    speed: speedSpaces(monster?.speed, 6),
    abilities,
    attacks: attacksFromMonster(monster),
    image: monster?.image || "",
    cr: monster?.cr || "",
    type: monster?.type || "",
    defeated: false,
    moved: 0,
    acted: false,
    notes: "",
  };
}

// Build a player-side combatant from the character sheet. Weapons come from
// the character's inventory when present, otherwise a simple unarmed strike.
export function characterToCombatant(character, derived, { x = 1, y = 5 } = {}) {
  const stats = Object.fromEntries(
    STATS.map((key) => [key, Math.round(derived?.[key]?.final ?? character?.stats?.[key] ?? 10)])
  );
  const level = Number(character?.level) || 1;
  const prof = 2 + Math.floor((level - 1) / 4);
  const maxHp = Math.max(1, Math.round(derived?.["Hit Points"]?.final ?? 0) || level * 6);
  const ac = Math.max(8, Math.round(derived?.["Armor Class"]?.final ?? 10));
  const dexMod = abilityMod(stats.DEX);
  const weapons = (character?.inventory || [])
    .filter((item) => item?.type === "Weapon" && item?.name)
    .slice(0, 3);
  const attacks = weapons.map((weapon) => {
    const props = String(weapon.properties || "").toLowerCase();
    const ranged = /ranged|ammunition|range/.test(props) || /bow|crossbow|sling|dart/i.test(weapon.name);
    const ability = ranged ? "DEX" : stats.STR >= stats.DEX ? "STR" : "DEX";
    const mod = abilityMod(stats[ability]);
    const damage = String(weapon.damage || "1d8").replace(/\s+/g, "");
    const damageWithMod = /[+-]\d+$/.test(damage)
      ? damage
      : `${damage}${mod >= 0 ? `+${mod}` : mod}`;
    return {
      name: weapon.name,
      bonus: prof + mod + (Number(character?.modifiers?.weaponAttack) || 0),
      range: ranged ? 8 : 1,
      damage: damageWithMod,
      damageType: "",
      detail: `${weapon.name} (${ranged ? "ranged" : "melee"})`,
    };
  });
  if (!attacks.length) {
    const mod = abilityMod(stats.STR);
    attacks.push({
      name: "Unarmed Strike",
      bonus: prof + mod,
      range: 1,
      damage: `1d4${mod >= 0 ? `+${mod}` : mod}`,
      damageType: "bludgeoning",
      detail: "A punch, kick or shove.",
    });
  }
  return {
    id: `cmb_pc_${character?.id || "hero"}`,
    name: character?.name || "The Hero",
    kind: "pc",
    side: "party",
    x,
    y,
    maxHp,
    hp: maxHp,
    ac,
    initiative: 0,
    initiativeBonus: dexMod,
    speed: Math.max(1, Math.round(derived?.["Speed"]?.final ?? character?.speed ?? 6) || 6),
    abilities: stats,
    attacks,
    image: "",
    level,
    defeated: false,
    moved: 0,
    acted: false,
    notes: character?.class || "",
  };
}

export function npcToCombatant(npc, { x = 1, y = 6 } = {}) {
  const abilities = parseAbilities(npc?.abilities);
  const dexMod = abilityMod(abilities.DEX);
  const level = Math.max(1, Math.round((Number(npc?.age) || 30) / 10));
  return {
    id: `cmb_npc_${npc?.id || Math.floor(Math.random() * 1e8).toString(36)}`,
    name: npc?.name || "Ally",
    kind: "npc",
    side: "party",
    x,
    y,
    maxHp: 6 + level * 3,
    hp: 6 + level * 3,
    ac: 12 + Math.max(0, dexMod),
    initiative: 0,
    initiativeBonus: dexMod,
    speed: 6,
    abilities,
    attacks: [
      {
        name: "Weapon",
        bonus: 2 + Math.floor(level / 3) + Math.max(abilityMod(abilities.STR), dexMod),
        range: 1,
        damage: "1d8+1",
        damageType: "",
        detail: "A simple weapon.",
      },
    ],
    image: "",
    defeated: false,
    moved: 0,
    acted: false,
    notes: npc?.occupation || "",
  };
}

// ---------------------------------------------------------------------------
// Grid helpers
// ---------------------------------------------------------------------------

export const distanceBetween = (a, b) =>
  Math.max(Math.abs((a?.x || 0) - (b?.x || 0)), Math.abs((a?.y || 0) - (b?.y || 0)));

export const isInside = (x, y, width = GRID_WIDTH, height = GRID_HEIGHT) =>
  x >= 0 && y >= 0 && x < width && y < height;

export const occupantAt = (combat, x, y) =>
  (combat?.participants || []).find((p) => !p.defeated && p.x === x && p.y === y) || null;

export const obstacleAt = (combat, x, y) =>
  (combat?.terrain || []).find((cell) => cell.x === x && cell.y === y) || null;

export const activeCombatant = (combat) =>
  (combat?.participants || []).find((p) => p.id === combat.activeId) || null;

export function sortByInitiative(participants) {
  return [...participants].sort((a, b) => {
    if ((b.initiative || 0) !== (a.initiative || 0)) return (b.initiative || 0) - (a.initiative || 0);
    return (b.initiativeBonus || 0) - (a.initiativeBonus || 0);
  });
}

// ---------------------------------------------------------------------------
// Starting / advancing combat
// ---------------------------------------------------------------------------

export function makeTerrain(width = GRID_WIDTH, height = GRID_HEIGHT, count = 6) {
  const terrain = [];
  const types = ["rubble", "water", "pillar", "brambles"];
  for (let i = 0; i < count; i += 1) {
    const x = 3 + Math.floor(Math.random() * Math.max(1, width - 6));
    const y = 2 + Math.floor(Math.random() * Math.max(1, height - 4));
    if (terrain.some((cell) => cell.x === x && cell.y === y)) continue;
    terrain.push({ x, y, type: types[Math.floor(Math.random() * types.length)] });
  }
  return terrain;
}

export function startCombat({ participants = [], name = "Encounter", width = GRID_WIDTH, height = GRID_HEIGHT, terrain = null } = {}) {
  const rolled = participants.map((participant) => ({
    ...participant,
    initiative: rollD20() + (participant.initiativeBonus || 0),
    hp: Math.max(1, Number(participant.hp) || 1),
    maxHp: Math.max(1, Number(participant.maxHp) || Number(participant.hp) || 1),
    defeated: false,
    moved: 0,
    acted: false,
  }));
  const order = sortByInitiative(rolled);
  const baseTerrain = terrain || makeTerrain(width, height);
  const safeTerrain = baseTerrain.filter(
    (cell) => !rolled.some((participant) => participant.x === cell.x && participant.y === cell.y)
  );
  return {
    id: `combat_${Date.now().toString(36)}`,
    name,
    round: 1,
    order: order.map((p) => p.id),
    activeId: order[0]?.id || "",
    participants: order,
    width,
    height,
    terrain: safeTerrain,
    log: [
      { at: new Date().toISOString(), kind: "system", text: `Combat begins: ${name}.` },
      ...order.map((p) => ({
        at: new Date().toISOString(),
        kind: "initiative",
        text: `${p.name} rolls initiative ${p.initiative}.`,
      })),
    ],
    startedAt: new Date().toISOString(),
    finished: false,
    winner: "",
  };
}

const living = (combat) => (combat?.participants || []).filter((p) => !p.defeated);

export function victoryState(combat) {
  const aliveParty = living(combat).filter((p) => p.side === "party").length;
  const aliveEnemies = living(combat).filter((p) => p.side === "enemy").length;
  if (aliveParty === 0 && aliveEnemies === 0) return "draw";
  if (aliveParty === 0) return "enemy";
  if (aliveEnemies === 0) return "party";
  return "";
}

export function addLog(combat, text, kind = "action") {
  return {
    ...combat,
    log: [...(combat.log || []), { at: new Date().toISOString(), kind, text }].slice(-200),
  };
}

export function startTurn(combat, id) {
  return {
    ...combat,
    activeId: id,
    participants: combat.participants.map((p) =>
      p.id === id ? { ...p, moved: 0, acted: false } : p
    ),
  };
}

export function nextTurn(combatInput) {
  if (!combatInput || combatInput.finished) return combatInput;
  const combat = { ...combatInput };
  const order = combat.order.filter((id) => {
    const p = combat.participants.find((x) => x.id === id);
    return p && !p.defeated;
  });
  if (!order.length) return { ...combat, finished: true };
  const index = Math.max(0, order.indexOf(combat.activeId));
  let cursor = index;
  let wrapped = false;
  for (let step = 0; step < order.length + 1; step += 1) {
    cursor += 1;
    if (cursor >= order.length) {
      cursor = 0;
      wrapped = true;
    }
    const candidate = order[cursor];
    if (candidate !== combat.activeId) break;
  }
  const round = wrapped ? (combat.round || 1) + 1 : combat.round || 1;
  const next = startTurn({ ...combat, round }, order[cursor]);
  const nextName = combat.participants.find((p) => p.id === order[cursor])?.name || "—";
  return addLog(next, `Round ${round} — ${nextName} acts.`, "turn");
}

export function endCombat(combat, winner = "") {
  return {
    ...combat,
    finished: true,
    winner: winner || victoryState(combat),
    log: [
      ...(combat.log || []),
      {
        at: new Date().toISOString(),
        kind: "system",
        text:
          winner === "party"
            ? "Victory! The party wins the encounter."
            : winner === "enemy"
              ? "Defeat. The enemies overwhelm the party."
              : "The encounter ends.",
      },
    ],
  };
}

export function clearCombat() {
  return null;
}

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

export function moveCombatant(combat, id, x, y) {
  const participant = combat?.participants?.find((p) => p.id === id);
  if (!participant || participant.defeated) return combat;
  if (!isInside(x, y, combat.width, combat.height)) return combat;
  if (obstacleAt(combat, x, y)) return combat;
  const occupant = occupantAt(combat, x, y);
  if (occupant && occupant.id !== id) return combat;
  const cost = distanceBetween(participant, { x, y });
  const remaining = Math.max(0, (participant.speed || 6) - (participant.moved || 0));
  if (cost > remaining) return combat;
  const next = {
    ...combat,
    participants: combat.participants.map((p) =>
      p.id === id ? { ...p, x, y, moved: (p.moved || 0) + cost } : p
    ),
  };
  return addLog(
    next,
    `${participant.name} moves ${cost} space${cost === 1 ? "" : "s"}${cost === 0 ? " (holds position)" : ""}.`,
    "move"
  );
}

export function dashCombatant(combat, id) {
  const participant = combat?.participants?.find((p) => p.id === id);
  if (!participant) return combat;
  const next = {
    ...combat,
    participants: combat.participants.map((p) =>
      p.id === id ? { ...p, moved: Math.max(0, (p.moved || 0) - Math.ceil((p.speed || 6) / 2)), acted: true } : p
    ),
  };
  return addLog(next, `${participant.name} takes the Dash action.`, "action");
}

// ---------------------------------------------------------------------------
// Attacks
// ---------------------------------------------------------------------------

export function attackTarget(combatInput, attackerId, targetId, attackIndex = 0) {
  const attacker = combatInput?.participants?.find((p) => p.id === attackerId);
  const target = combatInput?.participants?.find((p) => p.id === targetId);
  if (!attacker || !target || attacker.defeated || target.defeated) return combatInput;
  if (attacker.side === target.side) return combatInput;
  const attack = (attacker.attacks || [])[attackIndex] || attacker.attacks?.[0];
  if (!attack) return combatInput;
  const distance = distanceBetween(attacker, target);
  let combat = combatInput;
  if (distance > (attack.range || 1)) {
    return addLog(
      combat,
      `${attacker.name} cannot reach ${target.name} with ${attack.name} (${distance} spaces away; range ${attack.range || 1}).`,
      "miss"
    );
  }
  const d20 = rollD20();
  const total = d20 + (attack.bonus || 0);
  const crit = d20 === 20;
  const hit = crit || (d20 !== 1 && total >= (target.ac || 10));
  const damageRoll = hit ? rollDice(attack.damage || "1d6") : { total: 0, detail: "" };
  const damage = crit ? Math.max(1, damageRoll.total * 2) : Math.max(0, damageRoll.total);
  const hp = Math.max(0, (target.hp || 0) - damage);
  const defeated = hp <= 0;
  combat = {
    ...combat,
    participants: combat.participants.map((p) => {
      if (p.id === attackerId) return { ...p, acted: true };
      if (p.id === targetId) return { ...p, hp, defeated };
      return p;
    }),
  };
  const attackText = `${attacker.name} attacks ${target.name} with ${attack.name}: d20 ${d20} ${
    attack.bonus >= 0 ? "+" : ""
  }${attack.bonus} = ${total} vs AC ${target.ac} — ${
    crit ? "CRITICAL HIT" : hit ? "hit" : "miss"
  }${hit ? ` for ${damage} damage (${damageRoll.detail})` : ""}.`;
  combat = addLog(combat, attackText, hit ? "hit" : "miss");
  if (defeated) {
    combat = addLog(combat, `${target.name} is defeated.`, "defeat");
  }
  const verdict = victoryState(combat);
  if (verdict) combat = endCombat(combat, verdict);
  return combat;
}

export function healCombatant(combat, id, amount) {
  return {
    ...combat,
    participants: combat.participants.map((p) =>
      p.id === id
        ? { ...p, hp: Math.max(0, Math.min(p.maxHp, p.hp + Math.max(0, amount))), defeated: false }
        : p
    ),
  };
}

export function damageCombatant(combat, id, amount) {
  let next = {
    ...combat,
    participants: combat.participants.map((p) => {
      if (p.id !== id) return p;
      const hp = Math.max(0, p.hp - Math.max(0, amount));
      return { ...p, hp, defeated: hp <= 0 };
    }),
  };
  next = addLog(next, `DM adjusts ${combatantName(combat.participants.find((p) => p.id === id))}'s hit points by ${amount}.`, "system");
  const verdict = victoryState(next);
  if (verdict) next = endCombat(next, verdict);
  return next;
}

// ---------------------------------------------------------------------------
// Enemy AI
// ---------------------------------------------------------------------------

function stepToward(combat, participant, goal, budget) {
  let current = { ...participant };
  let remaining = budget;
  let moved = 0;
  while (remaining > 0) {
    const dx = goal.x - current.x;
    const dy = goal.y - current.y;
    if (dx === 0 && dy === 0) break;
    const candidates = [];
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);
    if (sx || sy) candidates.push({ x: current.x + sx, y: current.y + sy });
    if (sx) candidates.push({ x: current.x + sx, y: current.y });
    if (sy) candidates.push({ x: current.x, y: current.y + sy });
    // Side steps let a blocked creature route around furniture.
    candidates.push({ x: current.x + 1, y: current.y });
    candidates.push({ x: current.x - 1, y: current.y });
    candidates.push({ x: current.x, y: current.y + 1 });
    candidates.push({ x: current.x, y: current.y - 1 });
    const cell = candidates.find(
      (candidate) =>
        isInside(candidate.x, candidate.y, combat.width, combat.height) &&
        !obstacleAt(combat, candidate.x, candidate.y) &&
        !occupantAt(combat, candidate.x, candidate.y)
    );
    if (!cell) break;
    current = { ...current, x: cell.x, y: cell.y };
    remaining -= 1;
    moved += 1;
  }
  return { x: current.x, y: current.y, moved };
}

// A deterministic, readable enemy turn: close on the nearest party member and
// use the first attack in range, then end.
export function aiTakeTurn(combatInput, id) {
  let combat = combatInput;
  const actor = combat?.participants?.find((p) => p.id === id);
  if (!actor || actor.defeated) return combat;
  const targets = living(combat).filter((p) => p.side !== actor.side);
  if (!targets.length) return combat;
  const nearest = [...targets].sort((a, b) => distanceBetween(actor, a) - distanceBetween(actor, b))[0];
  const reach = Math.min(...(actor.attacks || [{ range: 1 }]).map((attack) => attack.range || 1));
  const currentDistance = distanceBetween(actor, nearest);
  if (currentDistance > reach) {
    const budget = Math.max(0, (actor.speed || 6) - (actor.moved || 0));
    const step = stepToward(combat, actor, nearest, budget);
    if (step.moved > 0) {
      combat = {
        ...combat,
        participants: combat.participants.map((p) =>
          p.id === id ? { ...p, x: step.x, y: step.y, moved: (p.moved || 0) + step.moved } : p
        ),
      };
      combat = addLog(combat, `${actor.name} advances ${step.moved} spaces toward ${nearest.name}.`, "move");
    }
  }
  const updated = combat.participants.find((p) => p.id === id);
  const attackIndex = (updated.attacks || []).findIndex(
    (attack) => distanceBetween(updated, nearest) <= (attack.range || 1)
  );
  if (attackIndex >= 0) {
    combat = attackTarget(combat, id, nearest.id, attackIndex);
  } else {
    combat = addLog(combat, `${actor.name} cannot reach ${nearest.name} this turn.`, "action");
  }
  return combat;
}

export function runEnemyTurns(combatInput, maxSteps = 24) {
  let combat = combatInput;
  let steps = 0;
  while (steps < maxSteps && !combat?.finished) {
    const active = activeCombatant(combat);
    if (!active || active.side === "party") break;
    combat = aiTakeTurn(combat, active.id);
    combat = nextTurn(combat);
    steps += 1;
  }
  return combat;
}

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

const partySlots = [
  [1, 5],
  [1, 4],
  [1, 6],
  [2, 5],
  [2, 4],
  [2, 6],
];

const enemySlots = [
  [15, 5],
  [16, 4],
  [16, 6],
  [14, 4],
  [14, 6],
  [15, 3],
  [15, 7],
  [13, 5],
  [17, 5],
  [13, 4],
  [13, 6],
  [17, 4],
  [17, 6],
];

export function buildParticipantRoster({
  character,
  derived,
  allies = [],
  monsterCounts = [],
  monsters = [],
  width = GRID_WIDTH,
  height = GRID_HEIGHT,
}) {
  const participants = [];
  if (character?.name) {
    participants.push(characterToCombatant(character, derived, { x: partySlots[0][0], y: partySlots[0][1] }));
  }
  allies.slice(0, partySlots.length - 1).forEach((npc, index) => {
    const slot = partySlots[index + 1];
    participants.push(npcToCombatant(npc, { x: slot[0], y: slot[1] }));
  });
  let enemyIndex = 0;
  monsterCounts.forEach((entry) => {
    const monster = monsters.find(
      (m) => String(m.name).toLowerCase() === String(entry.name).toLowerCase()
    );
    const count = Math.max(0, Math.min(12, Number(entry.count) || 0));
    for (let i = 0; i < count; i += 1) {
      const slot = enemySlots[enemyIndex % enemySlots.length];
      const wrap = Math.floor(enemyIndex / enemySlots.length);
      participants.push(
        monsterToCombatant(
          monster || { name: entry.name, hp: 8, ac: 12 },
          {
            index: i,
            x: Math.min(width - 1, slot[0]),
            y: Math.min(height - 1, slot[1] + (wrap % 2)),
          }
        )
      );
      enemyIndex += 1;
    }
  });
  return participants;
}

export const COMBAT_STATUS = [
  { id: "party", label: "Party" },
  { id: "enemy", label: "Enemies" },
];
