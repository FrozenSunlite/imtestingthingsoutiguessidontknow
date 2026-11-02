import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { evalResource } from "@/lib/geometry";
import { mergePlots } from "@/lib/homesteadStore";
import { DEFAULT_SKILL_ABILITIES, normalizeListEntry, statOr10 } from "@/lib/skills";
import {
  STATS,
  resolveResourceValue,
  numericResourceMap,
  sizeShift,
  SIZE_LADDER,
  SIZE_MULT,
  DEFAULT_SPEED_TYPES,
  DEFAULT_SENSES,
} from "@/lib/resources";
import { DEFAULT_HOTKEYS } from "@/lib/hotkeys";
import { DEFAULT_AUDIO_SETTINGS, playSfx } from "@/lib/audio";
import { SFX } from "@/lib/sfx";
import { DEFAULT_DIE_SCALING, dieText } from "@/lib/dieScaling";
import { STARTER_DUNGEON_ROOMS } from "@/lib/dungeonRooms";
import { restoreFiveEToolsSources } from "@/lib/fiveEToolsCache";
import { featureMechanics } from "@/lib/fiveETools";
import { optionAtPath } from "@/lib/optionTree";
import {
  DEFAULT_SUBTREE,
  flattenSubtreeForPlay,
  setSubtreePoint,
  subtreeChainHasNode,
  nextSubtreeId,
  makeReturnNode,
  stripLegacyAutoGrants,
  migrateReturnNodes,
  sharedDefinition,
  instantiateSharedSubtree,
  syncSharedSubtree,
  unlinkSharedSubtree,
  SHARED_STRUCTURAL_KEYS,
} from "@/lib/subtrees";
import { migrateTalentNames } from "@/lib/treeMigrations";
import {
  DEFAULT_NODE_TYPES,
  DEFAULT_POINT_TYPES,
  normalizeNodeTypes,
  normalizePointTypes,
  pointTypesFor,
  pointTypeForNodeType,
  poolForNodeType,
  pointDefaultsFor,
  levelZeroPointsFor,
} from "@/lib/pointTypes";
import { nodeMaxPoints } from "@/lib/nodeTiers";
import {
  LEGACY_KEYS,
  readProjectValue,
  writeProjectValue,
  listSaves,
  putSave,
  removeSave,
  migrateLegacyStorage,
} from "@/lib/projectStore";
import { toast } from "sonner";
import { saveProjectToDisk } from "@/lib/projectFiles";
import { loadPlots } from "@/lib/homesteadStore";
import { SRD_SEED_VERSION, fetchAndMergeSrdSeed } from "@/lib/srdSeed";

export const TIME_PERIODS = ["Medieval", "Renaissance", "Modern", "Futuristic"];

export const DEFAULT_LIBRARY = {
  levels: [],
  attributes: ["STR", "DEX", "CON", "INT", "WIS", "CHA"],
  creatureTypes: [
    "Humanoid", "Fey", "Monstrosity", "Aberration", "Undead", "Fiend",
    "Celestial", "Construct", "Dragon", "Elemental", "Giant", "Ooze",
    "Plant", "Beast", "Swarm",
  ],
  properties: [
    "Finesse", "Light", "Heavy", "Two-Handed", "Reach", "Thrown", "Versatile",
    "Loading", "Ammunition", "Range", "Special",
  ],
  // 2024 Weapon Masteries (XPHB, p. 214). Weapons carry a `mastery` name; the
  // Reference Library keeps the readable rules text for each.
  weaponMasteries: [
    { name: "Cleave", description: "If you hit a creature with a melee attack using this weapon, you can make a melee attack with it against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon's damage, but don't add your ability modifier unless it is negative. Once per turn." },
    { name: "Graze", description: "If your attack roll with this weapon misses a creature, you can deal damage to it equal to the ability modifier used to make the attack roll. The damage is the weapon's type and can be increased only by increasing that modifier." },
    { name: "Nick", description: "When you make the extra attack of the Light property, you can make it as part of the Attack action instead of as a Bonus Action. Once per turn." },
    { name: "Push", description: "If you hit a creature with this weapon, you can push it up to 10 feet straight away from yourself if it is Large or smaller." },
    { name: "Sap", description: "If you hit a creature with this weapon, it has Disadvantage on its next attack roll before the start of your next turn." },
    { name: "Slow", description: "If you hit a creature with this weapon and deal damage, you can reduce its Speed by 10 feet until the start of your next turn. Multiple hits don't stack beyond 10 feet." },
    { name: "Topple", description: "If you hit a creature with this weapon, you can force it to make a Constitution saving throw (DC 8 + the ability modifier used for the attack + your Proficiency Bonus). On a failure, it has the Prone condition." },
    { name: "Vex", description: "If you hit a creature with this weapon and deal damage, you have Advantage on your next attack roll against it before the end of your next turn." },
  ],
  actions: [
    { name: "Attack", description: "Make one attack with a weapon or an unarmed strike.", category: "action", resolve: "weapon" },
    { name: "Cast a Spell", description: "Cast a spell with a casting time of one action.", category: "action", resolve: "spell" },
    { name: "Dash", description: "Gain extra movement equal to your speed for the rest of the turn.", category: "action" },
    { name: "Disengage", description: "Your movement doesn't provoke opportunity attacks for the rest of the turn.", category: "action" },
    { name: "Dodge", description: "Until the start of your next turn, attacks against you have disadvantage and you make Dexterity saving throws with advantage.", category: "action" },
    { name: "Help", description: "Give advantage to an ally's attack roll against a creature within 1 space, or assist with an ability check.", category: "action" },
    { name: "Hide", description: "Attempt to hide with a Dexterity (Stealth) check.", category: "action" },
    { name: "Ready", description: "Prepare an action or movement to take in response to a trigger, acting on your reaction.", category: "action" },
    { name: "Search", description: "Devote your attention toward finding something.", category: "action" },
    { name: "Study", description: "Devote your attention toward recalling or deducing lore.", category: "action" },
    { name: "Utilize", description: "Use a non-weapon object or a tool.", category: "action", resolve: "item" },
    { name: "Use an Object", description: "Interact with an object other than a weapon.", category: "action" },
    { name: "Off-Hand Attack", description: "Attack with a light weapon in your other hand.", category: "bonus", resolve: "weapon" },
    { name: "Cast a Spell", description: "Cast a spell with a casting time of one bonus action.", category: "bonus", resolve: "spell" },
    { name: "Opportunity Attack", description: "Make one melee attack against a creature that leaves your reach.", category: "reaction", resolve: "weapon" },
    { name: "Cast a Spell", description: "Cast a spell with a casting time of one reaction.", category: "reaction", resolve: "spell" },
    { name: "Readied Action", description: "Release the action you prepared with Ready.", category: "reaction" },
    { name: "Interact with an Object", description: "Interact with one object or environmental feature at no cost.", category: "free" },
    { name: "No Action Required", description: "Talent effect that happens without spending any action.", category: "free" },
  ],
  // Spells start empty — the spell list is built by the character, not preset.
  spells: [],
  weaponCategories: ["Simple", "Martial"],
  armorTypes: ["Light", "Medium", "Heavy", "Shield"],
  vehicleCategories: ["Land", "Sea", "Sky", "Space"],
  spellSchools: [
    "Abjuration", "Conjuration", "Divination", "Enchantment",
    "Evocation", "Illusion", "Necromancy", "Transmutation",
  ],
  // SRD spells have no subschools; the field stays editable for homebrew.
  spellSubschools: [],
  triggers: [
    "On Attack", "On Hit", "On Miss", "On Critical Hit", "On Critical Miss",
    "On Kill", "On Being Hit", "On Taking Damage", "On Dropping to 0 HP",
    "On Failing a Roll", "On Succeeding a Roll", "On Failing a Save",
    "On Succeeding a Save", "On Casting a Spell", "On Taking a Reaction",
    "On an Opportunity Attack", "When a Creature Enters Your Reach",
    "When a Creature Leaves Your Reach", "At the Start of Your Turn",
    "At the End of Your Turn", "At the Start of Another Creature's Turn",
    "On Short Rest", "On Long Rest", "On Level Up", "On Being Grappled",
    "On Escaping a Grapple", "When You Take the Attack Action",
    "On Cast", "On Successful Save", "While Concentrating",
  ],
  statusEffects: [
    { name: "Burning", kind: "debuff", description: "Take fire damage at the start of each of your turns until the flames are doused.", effects: ["1d10 fire damage at the start of each of your turns", "Ends if you are doused with water or smother it"] },
    { name: "Charmed", kind: "condition", description: "A charm holds you in the charmer's sway.", effects: ["Can't attack the charmer", "The charmer has advantage on ability checks to interact socially with you"] },
    { name: "Frightened", kind: "condition", description: "Fear grips you in the presence of its source.", effects: ["Disadvantage on ability checks and attack rolls while the source is in sight", "Can't willingly move closer to the source of your fear"] },
    { name: "Poisoned", kind: "condition", description: "Toxicity saps your body and focus.", effects: ["Disadvantage on attack rolls and ability checks"] },
    { name: "Stunned", kind: "condition", description: "Staggered and unable to act coherently.", effects: ["Incapacitated and can't move", "Automatically fail STR and DEX saving throws", "Attack rolls against you have advantage"] },
    { name: "Prone", kind: "condition", description: "Knocked down on the ground.", effects: ["Disadvantage on your attack rolls", "Melee attacks against you have advantage, ranged have disadvantage", "Standing up costs half your movement"] },
    { name: "Restrained", kind: "condition", description: "Bound and unable to move freely.", effects: ["Speed becomes 0", "Disadvantage on attack rolls and DEX saving throws", "Attack rolls against you have advantage"] },
    { name: "Blinded", kind: "condition", description: "You can't see.", effects: ["Automatically fail ability checks requiring sight", "Disadvantage on attack rolls", "Attack rolls against you have advantage"] },
    { name: "Deafened", kind: "condition", description: "You can't hear.", effects: ["Automatically fail ability checks requiring hearing"] },
    { name: "Grappled", kind: "condition", description: "A creature is holding you fast.", effects: ["Speed becomes 0", "Ends if the grappler becomes incapacitated"] },
    { name: "Incapacitated", kind: "condition", description: "Unable to take any meaningful action.", effects: ["Can't take actions or reactions", "Can't concentrate on spells"] },
    { name: "Paralyzed", kind: "condition", description: "Rigid and utterly helpless.", effects: ["Incapacitated and can't move or speak", "Automatically fail STR and DEX saving throws", "Attack rolls within 1 space against you are critical hits"] },
    { name: "Unconscious", kind: "condition", description: "Senseless and defenseless.", effects: ["Incapacitated, can't move or speak, and unaware of surroundings", "Automatically fail STR and DEX saving throws", "Attack rolls within 1 space are critical hits"] },
    { name: "Invisible", kind: "buff", description: "You are unseen without magical detection.", effects: ["Attack rolls against you have disadvantage", "Your attack rolls have advantage"] },
    { name: "Concentrating", kind: "condition", description: "You are maintaining a concentration spell.", effects: ["Spell ends if you are incapacitated or die", "CON saving throw to maintain when taking damage"] },
    { name: "Raging", kind: "buff", description: "Battle fury courses through you.", effects: ["Bonus damage on melee weapon attacks using STR", "Resistance to bludgeoning, piercing and slashing damage", "Can't cast spells or concentrate"] },
    { name: "Hasted", kind: "buff", description: "Time bends around your quickened form.", effects: ["Speed is doubled", "+2 AC", "Advantage on DEX saving throws", "One additional limited action each turn"] },
    { name: "Blessed", kind: "buff", description: "Divine favor guides your strikes.", effects: ["+1d4 on attack rolls and saving throws"] },
    { name: "Bleeding", kind: "debuff", description: "Wounds refuse to close.", effects: ["Lose hit points at the start of each of your turns until healed or treated"] },
  ],
  lists: {
    // Seeded with the 18 D&D skills, each pre-assigned its governing ability.
    skills: Object.entries(DEFAULT_SKILL_ABILITIES).map(([name, ability]) => ({
      name,
      ability,
    })),
    tools: [],
    artisanTools: [],
    gamingSets: [],
    miscTools: [],
    instruments: [],
    vehicles: [],
  },
  weapons: [],
  weaponUpgrades: [],
  sharedSubtrees: [],
  nodeTypes: DEFAULT_NODE_TYPES,
  pointTypes: DEFAULT_POINT_TYPES,
  armor: [],
  currencies: [
    { name: "Copper", key: "copper" },
    { name: "Silver", key: "silver" },
    { name: "Gold", key: "gold" },
    { name: "Electrum", key: "electrum" },
    { name: "Platinum", key: "platinum" },
  ],
  adventureGearCategories: [
    "Equipment Pack", "Common Items", "Useable Items", "Clothes", "Arcane Focus",
    "Druidic Focus", "Holy Symbols", "Containers", "Special",
  ],
  timePeriods: TIME_PERIODS,
  rarities: ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact", "Unique"],
  wondrousTypes: [
    "Weapon", "Armor", "Ring", "Potion", "Scroll", "Staff", "Wand", "Rod",
    "Mounts", "Vehicles", "Wondrous Item",
  ],
  adventuringGear: [],
  trinkets: [],
  trinketTables: [],
  damageTypes: [],
  // Movement and sense types shown on the sheet. The library is the source of
  // truth; the standard types are seeded here so they can be edited or removed.
  speedTypes: DEFAULT_SPEED_TYPES.map((name) => ({ name, description: "" })),
  senses: DEFAULT_SENSES.map((name) => ({ name, description: "" })),
  // The die-scaling ladder used when a node raises or lowers a die. Entries
  // are editable in the Reference Library, so homebrew ladders are possible.
  dieScaling: DEFAULT_DIE_SCALING.map((name) => ({ name })),
  // Custom resources tracked on the sheet. A resource can carry a scaling die
  // (e.g. a Martial Arts-style d6 → d10) that the sheet displays next to it.
  resources: [
    { name: "Channel Divinity", color: "#f59e0b", dieSize: "", description: "" },
    { name: "Metamagic Points", color: "#ec4899", dieSize: "", description: "" },
    { name: "Ki Points", color: "#22c55e", dieSize: "", description: "" },
  ],
  rollTables: [],
  explosives: [],
  wondrousItems: [],
  tradeGoods: [],
  poisons: [],
  siege: [],
  vehicles: [],
  // Procedural dungeon room templates and saved generated dungeons.
  dungeonRooms: STARTER_DUNGEON_ROOMS.map((r) => ({
    ...r,
    traps: [...(r.traps || [])],
    spawns: [...(r.spawns || [])],
    loot: [...(r.loot || [])],
    harvest: [...(r.harvest || [])],
    objects: [...(r.objects || [])],
  })),
  dungeonRoomsSeeded: true,
  dungeonDraft: null,
  dungeons: [],
  // Generated setting/world for the World Builder.
  world: null,
  // Entries imported from the local 5eTools Reference Index that do not map to
  // an existing library list are kept here by category.
  fiveETools: {},
  // 5eTools books converted to Rulebook chapters. Kept with the project rather
  // than in the small localStorage rulebook, because full books are large.
  fiveEToolsBooks: [],
};

// Node types and the RPG file format live in treeFormat.js — re-exported so
// existing imports keep working.
export {
  NODE_TYPES,
  NODE_TYPE_VALUES,
  POOL_LABELS,
  normalizeTree,
  denormalizeTree,
} from "@/lib/treeFormat";
import { normalizeTree } from "@/lib/treeFormat";

// Which point pool a node is spent from: the node's own currency override when
// set, otherwise the point type assigned to its node type.
export function poolForNode(node, pointTypes) {
  const o = node?.poolOverride;
  // Subtree nodes draw from their tree's own pool, never the global ones.
  if (o === "__subtree") return "__subtree";
  const list = normalizePointTypes(pointTypes);
  if (o && list.some((pt) => pt.id === o)) return o;
  const t = node?.nodeType || (node?.pointType === "heritage" ? "heritage" : "skill");
  return poolForNodeType(t, list);
}

// One-time migration: existing nodes gain a nodeType from their point type.
export function migrateNodeTypes(tree) {
  if (!tree?.nodes) return tree;
  let changed = false;
  const nodes = tree.nodes.map((n) => {
    if (n.nodeType) return n;
    changed = true;
    return { ...n, nodeType: n.pointType === "heritage" ? "heritage" : "skill" };
  });
  return changed ? { ...tree, nodes } : tree;
}

// Option requirements used to be a single object; they are now a list so one
// option can require several things at once.
export function migrateOptionRequires(tree) {
  if (!tree?.nodes) return tree;
  let changed = false;
  const nodes = tree.nodes.map((n) => {
    if (!(n.options || []).length) return n;
    let nodeChanged = false;
    const options = n.options.map((o) => {
      if (Array.isArray(o.requires)) return o;
      nodeChanged = true;
      const r = o.requires;
      return { ...o, requires: r && r.type && r.type !== "none" ? [r] : [] };
    });
    if (!nodeChanged) return n;
    changed = true;
    return { ...n, options };
  });
  return changed ? { ...tree, nodes } : tree;
}

// A reload can land mid-subtree-edit (the editor physically swaps the active
// node list for the subtree's). Unwind the stack: write the current space back
// into its host node's subtree and restore the parent space, level by level.
export function unwrapSubtreeEditing(tree) {
  if (!tree || !Array.isArray(tree.subtreeEditing?.stack) || !tree.subtreeEditing.stack.length)
    return tree;
  const stack = [...tree.subtreeEditing.stack];
  let out = { ...tree, nodes: tree.nodes || [], connections: tree.connections || [] };
  while (stack.length) {
    const frame = stack.pop();
    let sharedId = null;
    let sharedSource = null;
    const saved = (frame.nodes || []).map((n) => {
      if (n.id !== frame.hostId) return n;
      if (frame.subtreeIndex != null) {
        const subtrees = (n.subtrees || []).map((st, i) => {
          if (i !== frame.subtreeIndex) return st;
          const next = {
            ...st,
            nodes: out.nodes,
            connections: out.connections,
          };
          if (st.sharedId) {
            sharedId = st.sharedId;
            sharedSource = next;
          }
          return next;
        });
        return { ...n, subtrees };
      }
      // Saved mid-edit before subtrees were migrated: the old single field.
      return {
        ...n,
        subtree: { ...(n.subtree || {}), nodes: out.nodes, connections: out.connections },
      };
    });
    out = { ...out, nodes: saved, connections: frame.connections || [] };
    if (sharedId && sharedSource) {
      out = syncSharedSubtree(out, sharedId, sharedSource);
    }
  }
  const tabs = (tree.tabs || []).map((tab) =>
    tab.id === tree.activeTabId
      ? { ...tab, nodes: out.nodes, connections: out.connections }
      : tab
  );
  return {
    ...out,
    nodes: out.nodes,
    connections: out.connections,
    tabs,
    subtreeEditing: null,
  };
}

// One-time migration: a node's single `subtree` becomes a list of subtrees,
// so a node can own several, each with its own pool and settings.
export function migrateSubtrees(tree) {
  if (!tree?.nodes) return tree;
  let changed = false;
  const nodes = tree.nodes.map((n) => {
    if (n.subtrees) return n;
    changed = true;
    const st = n.subtree
      ? [{ id: nextSubtreeId(), name: "Subtree 1", ...n.subtree }]
      : [];
    const out = { ...n, subtrees: st };
    delete out.subtree;
    return out;
  });
  return changed ? { ...tree, nodes } : tree;
}

export function migrateTree(tree) {
  const migrateOne = (t) =>
    migrateReturnNodes(
      stripLegacyAutoGrants(
        migrateSubtrees(
          migrateOptionRequires(
            migrateNodeTypes(migrateTalentNames(unwrapSubtreeEditing(t)))
          )
        )
      )
    );
  const out = migrateOne(tree);
  // Tabs keep their own node lists; ensureTabs() later promotes the active
  // tab's nodes, so every tab has to be migrated too or the cleanup is lost.
  if (Array.isArray(out?.tabs) && out.tabs.length) {
    let changed = false;
    const tabs = out.tabs.map((tab) => {
      const next = migrateOne(tab);
      if (next !== tab) changed = true;
      return next;
    });
    return changed ? { ...out, tabs } : out;
  }
  return out;
}

const TreeContext = createContext(null);
// The camera view lives in its own contexts so panning only re-renders the
// canvas: useView() subscribes to the view value; useViewSet() returns the
// stable setter (controls like the toolbar that only move the camera).
const ViewContext = createContext(null);
const ViewSetterContext = createContext(null);
export function useView() {
  const c = useContext(ViewContext);
  if (!c) throw new Error("useView must be used within TreeProvider");
  return c;
}
export function useViewSet() {
  const c = useContext(ViewSetterContext);
  if (!c) throw new Error("useViewSet must be used within TreeProvider");
  return c;
}

const DEFAULT_POOLS = {
  heritage: { total: 12 },
  talent: { total: 2 },
  attribute: { total: 72 },
};
const DEFAULT_GRID = {
  type: "square",
  snapEnabled: true,
  snapSize: 120,
  visible: true,
  opacity: 0.16,
  hexOrientation: "vertical",
};
const DEFAULT_VIEW = { panX: 0, panY: 0, zoom: 0.16 };
const DEFAULT_CHARACTER = {
  name: "",
  race: "Heritage",
  creatureType: "Humanoid",
  background: "",
  age: "",
  class: "Dilettante",
  alignment: "",
  level: 1,
  hitDiceSize: "d6",
  hitDiceCount: "",
  size: "",
  sizeCountAs: "medium",
  sizeBeforeSmallRace: "",
  stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
  smallRaceHeritage: false,
  bonusTalentFromProf: false,
  // Standard movement in spaces (6 by default).
  speed: 6,
  // Movement in spaces: per-type speeds, jump distances (2 horizontal / 1
  // vertical by default) and sense ranges. Nodes modify them via resources.
  speeds: {},
  jumpH: 2,
  jumpV: 1,
  senses: {},
  manualResources: [
    { name: "Arcanovital Energy", value: "0", color: "#a855f7" },
    { name: "Channel Divinity", value: "0", color: "#f59e0b" },
    { name: "Metamagic Points", value: "0", color: "#ec4899" },
    { name: "Ki Points", value: "0", color: "#22c55e" },
  ],
  modifiers: { ability: {}, ac: 0, speed: 0, spellAttack: 0, weaponAttack: 0, saves: 0 },
  coins: { copper: 0, silver: 0, gold: 0, electrum: 0, platinum: 0 },
  inventory: [],
  appliedUpgrades: [],
  spellList: [],
  // Properties imported from the Homebuilder (snapshot copies of plots).
  properties: [],
  hideLockedNodes: false,
  hideLockedIncludeLevel: false,
  proficiencies: { skills: [], tools: [], languages: [], instruments: [] },
  abilityChoices: {},
  portraitUri: "",
  activityLog: [],
  tokenFrameUri: "",
  inspiration: 0,
  exhaustion: 0,
  exertion: 0,
  trackEncumbrance: false,
  backstory: "",
  appearance: { eyes: "", skin: "", hair: "", height: "", weight: "" },
  traits: "",
  ideals: "",
  bonds: "",
  flaws: "",
  alliesOrganizations: "",
  notes: "",
};

// Bundled default artwork (public/default-node.svg), so nothing depends on a
// remote host. Older saves may still point at the old bundled JPG or the old
// hosted image.
const DEFAULT_PLACEHOLDER = "/default-node.svg";
const LEGACY_PLACEHOLDER = "/default-node.jpg";
const isLegacyHostedImage = (url) =>
  typeof url === "string" && url.includes("media.base44.com");

const DEFAULT_SETTINGS = {
  hotkeys: { ...DEFAULT_HOTKEYS },
  connector: { thickness: 2, color: "#94a3b8", opacity: 0.6, dash: "solid" },
  placeholderImage: DEFAULT_PLACEHOLDER,
  placeholderFrame: "",
  cameraStartNode: "",
  // True once a project has been started or loaded; keeps the launch menu's
  // project-only tiles enabled even for an empty project.
  projectStarted: false,
  autoSave: true,
  autoSaveToDisk: true,
  autoSaveInterval: 60,
  cacheRemoteImages: false,
  audio: { ...DEFAULT_AUDIO_SETTINGS },
  // Currency suffix used by dungeon rewards and Architect payouts.
  rewardCurrency: "gp",
  tourDone: false,
  // Set once the bundled SRD 5.1/5.2 reference content has been merged.
  srdSeedVersion: 0,
  // Per-level defaults used when a level has no row in the Reference Library.
  levelRules: {
    talentPoints: 1,
    heritagePoints: 0,
    attributePoints: 0,
    pointDefaults: { talent: 1, heritage: 0, attribute: 0 },
    levelZeroPoints: { talent: 2, heritage: 12, attribute: 72 },
    talentLimit: 1,
    talentLimitEnabled: true,
    levelZeroTalentPoints: 2,
  },
  library: DEFAULT_LIBRARY,
  // Native APK update host. Empty on the web (the service worker handles it).
  // The current tunnel is a convenient default; change it in Settings if the
  // hosting address moves.
  updateUrl: "https://abc-bennett-graphical-liabilities.trycloudflare.com",
};

// Library list entries used to be plain names; both movement/sense types and
// resources now carry optional extra fields.
const normalizeTypeEntry = (e) =>
  typeof e === "string" ? { name: e, description: "" } : { name: e?.name || "", ...e };
const normalizeResourceEntry = (e) =>
  typeof e === "string"
    ? { name: e, color: "", dieMode: "", dieSize: "", dieCount: 1, dieScale: "", description: "" }
    : {
        name: e?.name || "",
        color: e?.color || "",
        dieMode: e?.dieMode || "",
        dieSize: e?.dieSize || "",
        dieCount: e?.dieCount ?? 1,
        dieScale: e?.dieScale || "",
        ...e,
      };

function mergeLibrary(lib) {
  const d = DEFAULT_LIBRARY;
  return {
    levels: lib?.levels || [],
    attributes: lib?.attributes?.length ? lib.attributes : d.attributes,
    creatureTypes: (lib?.creatureTypes?.length ? lib.creatureTypes : d.creatureTypes).map((t) =>
      typeof t === "string" ? { name: t, description: "" } : t
    ),
    // Saved libraries from before action "resolve" (weapon/spell/item picking)
    // existed have no resolve anywhere: refresh them to the new defaults.
    actions: (() => {
      const base =
        lib?.actions?.length && lib.actions.some((a) => a.resolve) ? lib.actions : d.actions;
      // Make sure the free-action defaults exist on older saves too.
      const missing = d.actions
        .filter((a) => a.category === "free")
        .filter((f) => !base.some((a) => a.name === f.name && (a.category || "action") === "free"));
      return missing.length ? [...base, ...missing] : base;
    })(),
    spells: lib?.spells?.length ? lib.spells : d.spells,
    // Properties used to be plain names; they now carry a description.
    properties: (lib?.properties?.length ? lib.properties : d.properties).map((p) =>
      typeof p === "string" ? { name: p, description: "" } : p
    ),
    weaponMasteries: (lib?.weaponMasteries?.length
      ? lib.weaponMasteries
      : d.weaponMasteries
    ).map((m) => (typeof m === "string" ? { name: m, description: "" } : m)),
    sharedSubtrees: Array.isArray(lib?.sharedSubtrees) ? lib.sharedSubtrees : [],
    nodeTypes: normalizeNodeTypes(lib?.nodeTypes),
    pointTypes: normalizePointTypes(lib?.pointTypes),
    weaponCategories: lib?.weaponCategories?.length ? lib.weaponCategories : d.weaponCategories,
    armorTypes: lib?.armorTypes?.length ? lib.armorTypes : d.armorTypes,
    spellSchools: lib?.spellSchools?.length ? lib.spellSchools : d.spellSchools,
    spellSubschools: (lib?.spellSubschools?.length ? lib.spellSubschools : d.spellSubschools).map(
      (s) => (typeof s === "string" ? { name: s, parent: "" } : s)
    ),
    lists: (() => {
      const l = { ...d.lists, ...(lib?.lists || {}) };
      // Migrate the old "Vehicle Types" key and drop the redundant "Tool Types".
      if (!l.vehicles?.length && l.vehicleTypes?.length) l.vehicles = l.vehicleTypes;
      delete l.toolTypes;
      delete l.vehicleTypes;
      // Skill/tool/instrument entries used to be plain names; they now carry
      // an ability assignment (skills default to their D&D ability).
      const norm = (key, kind) => (l[key] || []).map((e) => normalizeListEntry(e, kind));
      l.skills = norm("skills", "skill");
      if (!l.skills.length) l.skills = d.lists.skills;
      // Religion is a Wisdom skill and Technology is an Intelligence skill.
      // Add Technology to older libraries and correct the old Religion default.
      const skillByName = new Map(
        l.skills.map((skill) => [String(skill.name || "").toLowerCase(), skill])
      );
      const religion = skillByName.get("religion");
      if (religion) religion.ability = "WIS";
      if (!skillByName.has("technology")) {
        l.skills.push({ name: "Technology", ability: "INT" });
      }
      if (!skillByName.has("presence")) {
        l.skills.push({ name: "Presence", ability: "CHA" });
      }
      l.tools = norm("tools", "tool");
      l.artisanTools = norm("artisanTools", "tool");
      l.gamingSets = norm("gamingSets", "tool");
      l.miscTools = norm("miscTools", "tool");
      l.instruments = norm("instruments", "instrument");
      // Language names for proficiency suggestions; seeded with the standard
      // D&D languages the first time the library loads.
      if (!l.languages?.length)
        l.languages = [
          "Common", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Orc",
          "Abyssal", "Celestial", "Draconic", "Deep Speech", "Infernal", "Primordial",
          "Sylvan", "Undercommon",
        ];
      return l;
    })(),
    weapons: lib?.weapons || [],
    weaponUpgrades: lib?.weaponUpgrades || [],
    armor: lib?.armor || [],
    currencies: lib?.currencies?.length ? lib.currencies : d.currencies,
    adventureGearCategories: lib?.adventureGearCategories?.length
      ? lib.adventureGearCategories
      : d.adventureGearCategories,
    timePeriods: lib?.timePeriods?.length ? lib.timePeriods : d.timePeriods,
    rarities: lib?.rarities?.length ? lib.rarities : d.rarities,
    wondrousTypes: lib?.wondrousTypes?.length ? lib.wondrousTypes : d.wondrousTypes,
    adventuringGear: lib?.adventuringGear || [],
    trinkets: lib?.trinkets || [],
    trinketTables: lib?.trinketTables || [],
    damageTypes: lib?.damageTypes || [],
    speedTypes: (lib?.speedTypes?.length ? lib.speedTypes : d.speedTypes)
      .map(normalizeTypeEntry)
      .filter((t) => t.name),
    senses: (lib?.senses?.length ? lib.senses : d.senses)
      .map(normalizeTypeEntry)
      .filter((t) => t.name),
    // The die-scaling ladder is seeded with the standard progression; saved
    // libraries refresh to it until the user edits their own ladder.
    dieScaling: (lib?.dieScaling?.length ? lib.dieScaling : d.dieScaling)
      .map(normalizeTypeEntry)
      .filter((t) => dieText(t)),
    // Older saves have no resource list: seed the built-in defaults.
    resources: (Array.isArray(lib?.resources) ? lib.resources : d.resources)
      .map(normalizeResourceEntry)
      .filter((r) => r.name),
    rollTables: lib?.rollTables || [],
    explosives: lib?.explosives || [],
    wondrousItems: lib?.wondrousItems || [],
    tradeGoods: lib?.tradeGoods || [],
    poisons: lib?.poisons || [],
    shop: lib?.shop || [],
    ammo: lib?.ammo || [],
    siege: lib?.siege || [],
    vehicles: lib?.vehicles || [],
    // Triggers previously weren't merged at all — saved libraries lost them.
    triggers: lib?.triggers?.length ? lib.triggers : d.triggers,
    lootTables: lib?.lootTables || [],
    downtimeActions: lib?.downtimeActions || [],
    vehicleCategories: lib?.vehicleCategories?.length ? lib.vehicleCategories : d.vehicleCategories,
    statusEffects: lib?.statusEffects?.length ? lib.statusEffects : d.statusEffects,
    monsters: lib?.monsters || [],
    monsterTemplates: lib?.monsterTemplates || [],
    lootPools: lib?.lootPools || [],
    encounterTables: lib?.encounterTables || [],
    dungeonRooms: (() => {
      const existing = Array.isArray(lib?.dungeonRooms) ? lib.dungeonRooms : [];
      const seeded = !!lib?.dungeonRoomsSeeded;
      const ids = new Set(existing.map((r) => r.id));
      const freshById = new Map(STARTER_DUNGEON_ROOMS.map((r) => [r.id, r]));
      const rooms = (
        seeded
          ? existing
          : [
              ...existing,
              ...STARTER_DUNGEON_ROOMS.filter((r) => !ids.has(r.id)),
            ]
      ).map((room) => {
        const fresh = freshById.get(room?.id);
        if (!fresh) return room;
        if (Number(room.starterVersion) >= 2) return room;
        // Upgrade untouched pre-v2 starter rooms to the furnished, shaped
        // versions while leaving user-painted/edited rooms alone.
        const hasGrid =
          room.cells?.length ||
          room.w ||
          room.h ||
          room.objects?.length ||
          room.coverPoints?.length ||
          room.heights?.length ||
          room.water?.length ||
          room.lava?.length ||
          room.difficult?.length ||
          room.trapPoints?.length ||
          room.hazardPoints?.length ||
          room.stairs?.length ||
          room.spawnPoints?.length ||
          room.ingressPoints?.length;
        const oldDefault =
          /Designed for .* encounters/i.test(room.notes || "") ||
          /shaped for tactical play/i.test(room.description || "");
        if (hasGrid || !oldDefault) {
          return { ...room, starterVersion: room.starterVersion || 1 };
        }
        return {
          ...fresh,
          name: room.name || fresh.name,
          category: room.category || fresh.category,
          enabled: room.enabled !== false,
        };
      });
      return rooms.map((r) => ({
        ...r,
        traps: [...(r.traps || [])],
        spawns: [...(r.spawns || [])],
        loot: [...(r.loot || [])],
        harvest: [...(r.harvest || [])],
        objects: [...(r.objects || [])],
      }));
    })(),
    dungeonRoomsSeeded: true,
    dungeonDraft: lib?.dungeonDraft && typeof lib.dungeonDraft === "object" ? lib.dungeonDraft : null,
    dungeons: Array.isArray(lib?.dungeons) ? lib.dungeons : [],
    world: lib?.world && typeof lib.world === "object" ? lib.world : null,
    fiveETools: lib?.fiveETools && typeof lib.fiveETools === "object" ? lib.fiveETools : {},
    fiveEToolsBooks: Array.isArray(lib?.fiveEToolsBooks) ? lib.fiveEToolsBooks : [],
  };
}


// Tabs: every tab is its own tree of nodes and connectors. The active tab's
// data is mirrored to the top level (tree.nodes / tree.connections) so the
// rest of the app keeps reading and writing it unchanged; every write syncs
// the active tab back.
// Side trees (View screen): up to two extra tree slots flanking the character
// sheet. The left one defaults to a live play view of the main tree; either
// slot can hold a snapshot of another tree (an imported file, a project tab or
// a saved character) with node ids prefixed "left-"/"right-" so they never
// collide with the main tree's. Points invested anywhere draw from the same
// global pools — see mergedTree in TreeProvider.
export function ensureTabs(tree) {
  if (!tree) return tree;
  const sideTrees = tree.sideTrees || { left: { kind: "main" }, right: null };
  if (Array.isArray(tree.tabs) && tree.tabs.length) {
    const tab = tree.tabs.find((t) => t.id === tree.activeTabId) || tree.tabs[0];
    return {
      ...tree,
      sideTrees,
      activeTabId: tab.id,
      nodes: tab.nodes || [],
      connections: tab.connections || [],
    };
  }
  const tab = {
    id: "tab-main",
    name: tree.name || "Main",
    nodes: tree.nodes || [],
    connections: tree.connections || [],
  };
  return { ...tree, sideTrees, tabs: [tab], activeTabId: tab.id };
}

// One-time carry-over: a camera start node saved in the old global setting
// becomes the first tab's per-tab camera start. The stored settings are passed
// in during hydration (the legacy localStorage copy is gone by then).
export function seedCameraStart(tree, savedSettings = null) {
  if (!tree || !tree.tabs?.length || tree.tabs[0].cameraStartNode != null) return tree;
  try {
    const s =
      savedSettings || JSON.parse(localStorage.getItem(LEGACY_KEYS.settings) || "null");
    if (!s?.cameraStartNode) return tree;
    return {
      ...tree,
      tabs: tree.tabs.map((tab, i) =>
        i === 0 ? { ...tab, cameraStartNode: s.cameraStartNode } : tab
      ),
    };
  } catch {
    return tree;
  }
}

// Character save slots: a bundle of the tree, character, point pools and the
// reference library. Images travel with the data — node artwork is stored as
// permanent upload URLs and portraits as permanent file references. Slots live
// in IndexedDB because a bundle is easily bigger than localStorage allows.
export function listCharacterSaves() {
  return listSaves();
}

const MAX_SAVES = 40;

export async function writeCharacterSave(name, bundle) {
  const entry = {
    id: "save-" + Date.now(),
    name: name || "Untitled character",
    date: new Date().toISOString(),
    ...bundle,
  };
  try {
    await putSave(entry);
    // Keep the slot list bounded: drop the oldest bundles past the limit.
    const existing = (await listSaves()).filter((s) => s.id !== entry.id);
    for (const old of existing.slice(MAX_SAVES - 1)) await removeSave(old.id);
  } catch (e) {
    throw new Error(
      "Could not save the project: " + (e?.message || "the browser refused the write.")
    );
  }
  return entry;
}

export async function deleteCharacterSave(id) {
  try {
    await removeSave(id);
  } catch {
    /* already gone */
  }
}

// Resolve a nested subtree chain. Each segment is { hostId, subIndex } where
// hostId is a node in the parent space and subIndex picks that node's subtree.
// The first segment starts from the main tree.
export function subtreeAtChain(nodes, chain) {
  let current = nodes || [];
  let host = null;
  let subtree = null;
  for (const seg of chain || []) {
    host = current.find((n) => n.id === seg.hostId);
    if (!host) return null;
    subtree = (host.subtrees || [])[seg.subIndex ?? 0];
    if (!subtree) return null;
    current = subtree.nodes || [];
  }
  return { host, subtree };
}

// Replace one subtree wherever it lives in a nested chain.
function updateSubtreeAtChain(nodes, chain, update, level = 0) {
  const seg = chain?.[level];
  if (!seg) return nodes;
  return (nodes || []).map((n) => {
    if (n.id !== seg.hostId) return n;
    const subtrees = (n.subtrees || []).map((st, i) => {
      if (i !== (seg.subIndex ?? 0)) return st;
      if (level === chain.length - 1) return update(st);
      return {
        ...st,
        nodes: updateSubtreeAtChain(st.nodes || [], chain, update, level + 1),
      };
    });
    return { ...n, subtrees };
  });
}

let importedTabSeq = 0;

// Build one imported feature tab (also used by bulk imports, which append many
// tabs in a single state update).
function buildImportedTab(name, features, meta = {}) {
  const list = (features || []).filter((f) => f && (f.name || f.text));
  if (!list.length) return null;
  const seq = importedTabSeq++;
  const stamp = `${Date.now()}t${seq}`;
  const id = `tab-${stamp}`;
  const classLayout = meta.layout === "class" || list.some((f) => f.group && f.group !== "Feature");
  const groups = classLayout
    ? [...new Set(list.map((f) => f.group || "Class"))].sort((a, b) =>
        a === "Class" ? -1 : b === "Class" ? 1 : a.localeCompare(b)
      )
    : ["Feature"];
  const nodesByGroup = {};
  let n = 0;

  groups.forEach((group, gi) => {
    const groupFeatures = list
      .filter((f) => (classLayout ? (f.group || "Class") === group : true))
      .sort((a, b) => (Number(a.level) || 0) - (Number(b.level) || 0));
    const groupNodes = [];
    const levelCounts = {};
    groupFeatures.forEach((f, i) => {
      const nodeId = `n${stamp}i${n++}`;
      const mech = classLayout ? featureMechanics(f) : { actions: [], resources: [] };
      const level = Number(f.level) || 0;
      const withinLevel = levelCounts[level] || 0;
      levelCounts[level] = withinLevel + 1;
      groupNodes.push({
        id: nodeId,
        name: String(f.name || `Feature ${i + 1}`),
        description: String(f.text || ""),
        flavor: "",
        x: classLayout && level ? (Math.min(20, level) - 1) * 230 : i * 190,
        y: classLayout ? gi * 180 + withinLevel * 140 : (i % 2) * 130,
        maxPoints: 1,
        currentPoints: 0,
        cost: 0,
        nodeType: classLayout ? "skill" : "informative",
        pointType: "talent",
        talentType: meta.category || "5eTools",
        size: 100,
        rotation: 0,
        flipped: false,
        flipV: false,
        image: "",
        frameImage: "",
        resources: mech.resources,
        actions: mech.actions,
        levelReq: classLayout ? Number(f.level) || 0 : 0,
        // Keep the import grouping so level-up benefits can filter a class
        // ladder from its subclass branches after the fact.
        featureGroup: group,
        subclassFeature: !!f.subclass,
        dependencies: i ? [groupNodes[i - 1].id] : [],
        exclusiveWith: [],
      });
    });
    nodesByGroup[group] = groupNodes;
  });

  const nodes = groups.flatMap((g) => nodesByGroup[g]);
  const connections = [];
  groups.forEach((group) => {
    const groupNodes = nodesByGroup[group] || [];
    groupNodes.slice(1).forEach((node, i) => {
      connections.push({
        id: `${groupNodes[i].id}->${node.id}`,
        from: groupNodes[i].id,
        to: node.id,
      });
    });
  });
  const base = nodesByGroup.Class || [];
  groups
    .filter((g) => g !== "Class")
    .forEach((group) => {
      const first = (nodesByGroup[group] || [])[0];
      if (!first) return;
      const level = Number(first.levelReq) || 0;
      const anchor =
        [...base].reverse().find((b) => (Number(b.levelReq) || 0) <= level) || base[0];
      if (anchor) {
        connections.push({
          id: `${anchor.id}->${first.id}`,
          from: anchor.id,
          to: first.id,
        });
        first.dependencies = [anchor.id];
      }
    });
  return {
    id,
    name: String(name || "Imported Features"),
    className: meta.className || "",
    classSource: meta.classSource || "",
    nodes,
    connections,
    cameraStartNode: nodes[0]?.id || "",
  };
}

export function TreeProvider({ children }) {
  const [treeRaw, setTreeRaw] = useState(null);
  // Unsaved-changes tracking: any edit marks the project dirty, while an
  // explicit save, a load and New clear it again. Only a dirty project warns
  // when the program is closed — backing out to the menu never nags.
  const [dirty, setDirty] = useState(false);
  const hydratedRef = useRef(false);
  const srdSeedStartedRef = useRef(false);
  const markDirty = useCallback(() => setDirty(true), []);
  const clearDirty = useCallback(() => setDirty(false), []);

  const setTree = useCallback((updater) => {
    markDirty();
    setTreeRaw((prev) => {
      if (!prev) return prev;
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!next || !next.tabs) return next;
      const tabs = next.tabs.map((tab) =>
        tab.id === next.activeTabId
          ? { ...tab, nodes: next.nodes || [], connections: next.connections || [] }
          : tab
      );
      return { ...next, tabs };
    });
  }, [markDirty]);

  const tree = treeRaw;

  // Side-tree slots shown beside the View screen. Investing a point in a
  // snapshot slot mutates that slot; the "main" kind invests in the live tree.
  // mergedTree folds the main tree and every snapshot slot together so every
  // derivation (resources, stats, pools, actions, bonus dice…) sees the
  // effects of nodes chosen on any tree, and pool limits stay global.
  const sideTrees = tree?.sideTrees || { left: null, right: null };
  const setSideTree = useCallback((slot, data) => {
    setTree((t) =>
      t
        ? {
            ...t,
            sideTrees: {
              ...(t.sideTrees || { left: { kind: "main" }, right: null }),
              [slot]: data,
            },
          }
        : t
    );
  }, []);
  const [ui, setUi] = useState({
    selectedNodeId: null,
    pinnedNodeIds: [],
    pinPositions: {},
    editingNodeId: null,
    selectedConnectionId: null,
    selectedNodeIds: [],
    connectionStyle: "curved",
    showArrows: true,
    showNames: true,
  });

  // Subtree editing physically swaps the canvas node list for the host node's
  // subtree, so the full editor (placement, prerequisites, nested subtrees)
  // works unchanged; the parent space is stashed and restored on exit.
  const enterSubtreeEditor = useCallback(
    (hostId, subIndex = 0) => {
      setTree((t) => {
        if (!t) return t;
        const host = t.nodes.find((n) => n.id === hostId);
        if (!host) return t;
        const st = (host.subtrees || [])[subIndex] || DEFAULT_SUBTREE;
        return {
          ...t,
          nodes: st.nodes || [],
          connections: st.connections || [],
          subtreeEditing: {
            stack: [
              ...(t.subtreeEditing?.stack || []),
              { hostId, subtreeIndex: subIndex, nodes: t.nodes, connections: t.connections },
            ],
          },
        };
      });
      setUi((u) => ({
        ...u,
        selectedNodeId: null,
        editingNodeId: null,
        selectedNodeIds: [],
        selectedConnectionId: null,
      }));
    },
    [setUi]
  );

  const exitSubtreeEditor = useCallback(() => {
    setTree((t) => {
      if (!t?.subtreeEditing?.stack?.length) return t;
      const stack = [...t.subtreeEditing.stack];
      const frame = stack.pop();
      let sharedId = null;
      let sharedSource = null;
      const nodes = (frame.nodes || []).map((n) => {
        if (n.id !== frame.hostId) return n;
        const subtrees = (n.subtrees || []).map((st, i) => {
          if (i !== (frame.subtreeIndex ?? 0)) return st;
          const next = { ...st, nodes: t.nodes, connections: t.connections };
          if (st.sharedId) {
            sharedId = st.sharedId;
            sharedSource = next;
          }
          return next;
        });
        return { ...n, subtrees };
      });
      const next = {
        ...t,
        nodes,
        connections: frame.connections || [],
        subtreeEditing: { stack },
      };
      // Editing a shared subtree updates every other host that uses it.
      return sharedId && sharedSource
        ? syncSharedSubtree(next, sharedId, sharedSource)
        : next;
    });
    setUi((u) => ({
      ...u,
      selectedNodeId: null,
      editingNodeId: null,
      selectedNodeIds: [],
      selectedConnectionId: null,
    }));
  }, [setUi]);

  // Write a play-time investment back to the host's stored subtree (path =
  // chain of original node ids), so points survive reloads.
  const setSubtreeNodePoints = useCallback((hostChain, path, points) => {
    setTree((t) => {
      if (!t || !hostChain?.length) return t;
      return {
        ...t,
        nodes: updateSubtreeAtChain(t.nodes || [], hostChain, (st) => ({
          ...st,
          nodes: setSubtreePoint(st.nodes || [], path, points),
        })),
      };
    });
    if (Number(points) > 0) playSfx(SFX.unlockNode, { gain: 0.5 });
  }, []);

  // Patch one subtree instance. Structural edits on a shared subtree also
  // update its canonical definition and every other host using it; per-host
  // settings (exclusive, level, default) and play state stay local.
  const updateSubtreeInstance = useCallback((hostId, subIndex, patch) => {
    setTree((t) => {
      if (!t) return t;
      const host = (t.nodes || []).find((n) => n.id === hostId);
      const current = (host?.subtrees || [])[subIndex];
      if (!current) return t;
      const nextSt = { ...current, ...patch };
      const nodes = t.nodes.map((n) =>
        n.id !== hostId
          ? n
          : {
              ...n,
              subtrees: (n.subtrees || []).map((st, i) =>
                i === subIndex ? nextSt : st
              ),
            }
      );
      const next = { ...t, nodes };
      const structural = Object.keys(patch).some((key) =>
        SHARED_STRUCTURAL_KEYS.includes(key)
      );
      return current.sharedId && structural
        ? syncSharedSubtree(next, current.sharedId, nextSt)
        : next;
    });
  }, []);

  // Load a saved library subtree as a shared instance. Re-loading the same
  // entry reuses the project's canonical definition, so every host stays in
  // sync while keeping its own purchases and exclusivity toggle.
  const loadSharedSubtree = useCallback((hostId, entry) => {
    if (!entry?.id) return;
    setTree((t) => {
      if (!t) return t;
      const host = (t.nodes || []).find((n) => n.id === hostId);
      if (!host) return t;
      const definition = t.sharedSubtrees?.[entry.id] || sharedDefinition(entry);
      const instance = instantiateSharedSubtree(definition, entry.id);
      return {
        ...t,
        nodes: t.nodes.map((n) =>
          n.id !== hostId
            ? n
            : { ...n, subtrees: [...(n.subtrees || []), instance] }
        ),
        sharedSubtrees: { ...(t.sharedSubtrees || {}), [entry.id]: definition },
      };
    });
  }, []);

  // Detach one instance from its shared definition; it becomes a local copy.
  const unlinkSubtree = useCallback((hostId, subIndex) => {
    setTree((t) => {
      if (!t) return t;
      const host = (t.nodes || []).find((n) => n.id === hostId);
      const current = (host?.subtrees || [])[subIndex];
      if (!current?.sharedId) return t;
      const nextSt = unlinkSharedSubtree(current);
      return {
        ...t,
        nodes: t.nodes.map((n) =>
          n.id !== hostId
            ? n
            : {
                ...n,
                subtrees: (n.subtrees || []).map((st, i) =>
                  i === subIndex ? nextSt : st
                ),
              }
        ),
      };
    });
  }, []);

  // Open (or re-close) a node's subtree in a side panel for play investment.
  // Mirrors devMode: in dev mode the subtree's duplicate host node is kept in
  // the flattened snapshot so it shows on the panel.
  const devModeRef = useRef(false);
  const openSubtreePanel = useCallback((hostId, subIndex = 0, parentChain = []) => {
    setTree((prev) => {
      if (!prev) return prev;
      const chain = [
        ...(Array.isArray(parentChain) ? parentChain : []),
        { hostId, subIndex: subIndex ?? 0 },
      ];
      const key = chain.map((s) => `${s.hostId}:${s.subIndex ?? 0}`).join("|");
      let nodes = prev.nodes || [];
      let resolved = subtreeAtChain(nodes, chain);
      if (!resolved) return prev;
      let purchases = Math.max(0, Number(resolved.subtree.purchases) || 0);
      // Selecting/opening a tree is its first purchase. Later purchases add
      // another batch of the tree's granted points.
      if (purchases < 1) {
        nodes = updateSubtreeAtChain(nodes, chain, (st) => ({
          ...st,
          purchases: Math.max(1, Number(st.purchases) || 1),
        }));
        resolved = subtreeAtChain(nodes, chain);
        if (!resolved) return prev;
        purchases = Math.max(1, Number(resolved.subtree.purchases) || 1);
      }
      const batchPoints = Number(resolved.subtree.grantedPoints) || 0;
      const finalIndex = chain[chain.length - 1].subIndex ?? 0;
      const flat = flattenSubtreeForPlay(
        resolved.host,
        finalIndex,
        !!devModeRef.current
      );
      const tab = {
        key,
        hostChain: chain,
        subtreeHostId: hostId,
        subtreeIndex: finalIndex,
        name: `${resolved.host.name || "Node"} — ${resolved.subtree.name || "subtree"}`,
        grantedPoints: batchPoints * purchases,
        batchPoints,
        purchases,
        maxPurchases: Math.max(0, Number(resolved.subtree.maxPurchases) || 0),
        poolName: resolved.subtree.poolName || "",
        exclusive: !!resolved.subtree.exclusive,
        abilityReqs: resolved.subtree.abilityReqs || [],
        nodes: flat.nodes,
        connections: flat.connections,
      };
      const side = prev.sideTrees || { left: { kind: "main" }, right: null };
      // Keep the macro/main tree on the left; subtrees stack as tabs on the
      // right. Re-picking an already-open tree focuses its tab instead of
      // closing it.
      const left = { ...(side.left || {}), kind: "main", closed: false, tabs: undefined };
      const right = side.right || {};
      const tabs = Array.isArray(right.tabs) ? [...right.tabs] : [];
      const existing = tabs.findIndex((t) => t.key === key);
      if (existing >= 0) tabs[existing] = { ...tabs[existing], ...tab };
      else tabs.push(tab);
      return {
        ...prev,
        nodes,
        sideTrees: {
          ...side,
          left,
          right: {
            ...right,
            ...tab,
            kind: "subtrees",
            tabs,
            activeKey: key,
            closed: false,
          },
        },
      };
    });
  }, [setTree]);

  // Buy another batch of a subtree's granted points. `maxPurchases` 0 means
  // unlimited; the first open counts as purchase 1.
  const purchaseSubtree = useCallback(
    (hostChain, hostId, subIndex = 0) => {
      setTree((t) => {
        if (!t) return t;
        const chain =
          Array.isArray(hostChain) && hostChain.length
            ? hostChain
            : [{ hostId, subIndex }];
        const resolved = subtreeAtChain(t.nodes || [], chain);
        if (!resolved) return t;
        const max = Math.max(0, Number(resolved.subtree.maxPurchases) || 0);
        const cur = Math.max(1, Number(resolved.subtree.purchases) || 0);
        if (max > 0 && cur >= max) return t;
        return {
          ...t,
          nodes: updateSubtreeAtChain(t.nodes || [], chain, (st) => ({
            ...st,
            purchases: Math.max(1, Number(st.purchases) || 0) + 1,
          })),
        };
      });
    },
    [setTree]
  );

  // Carry drag: nodes picked up by dragging them off the canvas. Dropping on
  // a node's Subtrees section copies them into that subtree (linked to the
  // host's copy); dropping on a tab header moves them into that tab's tree.
  // The ref mirrors the state so drop handlers read the freshest value.
  const [carry, setCarryState] = useState(null);
  const carryRef = useRef(null);
  const startCarry = useCallback((nodes, from) => {
    const c = { nodes, from };
    carryRef.current = c;
    setCarryState(c);
  }, []);
  const endCarry = useCallback(() => {
    carryRef.current = null;
    setCarryState(null);
  }, []);

  const dropCarriedOnSubtree = useCallback((hostId, subtreeIndex) => {
    const c = carryRef.current;
    endCarry();
    if (!c) return;
    // Safety: a node can never be dropped into its own subtree — the host is
    // the carried node itself or lives inside its subtree chain.
    if (c.nodes.some((n) => subtreeChainHasNode(n, hostId))) {
      toast.error("A node can't be dropped into its own subtree.");
      return;
    }
    setTreeRaw((prev) => {
      if (!prev) return prev;
      const host = prev.nodes.find((n) => n.id === hostId);
      if (!host) return prev;
      const existing = (host.subtrees || [])[subtreeIndex];
      const base = existing || {
        id: nextSubtreeId(),
        name: `Subtree ${(host.subtrees || []).length + 1}`,
        nodes: [makeReturnNode()],
        connections: [],
        grantedPoints: 3,
        poolName: "",
        exclusive: false,
        maxPurchases: 0,
        purchases: 0,
      };
      // Every subtree is seeded with a return node; new arrivals are connected
      // to it. Legacy trees may still use a host copy as their anchor.
      const hostCopy =
        (base.nodes || []).find((n) => n.__returnNode) ||
        (base.nodes || []).find((n) => n.__hostCopy) ||
        null;
      const clones = c.nodes.map((n, i) => {
        const copy = JSON.parse(JSON.stringify(n));
        const id = "n" + Date.now() + "d" + i + "-" + Math.floor(Math.random() * 1000);
        return {
          ...copy,
          id,
          currentPoints: 0,
          dependencies: [],
          exclusiveWith: [],
          x: (hostCopy?.x ?? 0) + 180,
          y: (hostCopy?.y ?? 0) + i * 180,
        };
      });
      const links = hostCopy
        ? clones.map((cl) => ({ id: `${hostCopy.id}->${cl.id}`, from: hostCopy.id, to: cl.id }))
        : [];
      const nextSt = {
        ...base,
        nodes: [...(base.nodes || []), ...clones],
        connections: [...(base.connections || []), ...links],
      };
      const nodes = prev.nodes.map((n) =>
        n.id !== hostId
          ? n
          : {
              ...n,
              subtrees: existing
                ? (n.subtrees || []).map((st, i) => (i === subtreeIndex ? nextSt : st))
                : [...(n.subtrees || []), nextSt],
            }
      );
      const next = { ...prev, nodes };
      return nextSt.sharedId
        ? syncSharedSubtree(next, nextSt.sharedId, nextSt)
        : next;
    });
  }, []);

  const dropCarriedOnTab = (tabId) => {
      const c = carryRef.current;
      endCarry();
      if (!c) return;
      if (c.from?.kind !== "subtree") {
        // Tab → tab: move via the existing cross-tab move.
        moveNodesToTab(
          c.nodes.map((n) => n.id),
          tabId
        );
        return;
      }
      // Subtree → tab: pull the copies out of the subtree and into the tab.
      setTreeRaw((prev) => {
        if (!prev) return prev;
        const stack = prev.subtreeEditing?.stack || [];
        const frame = stack[stack.length - 1];
        if (!frame) return prev;
        const ids = new Set(c.nodes.map((n) => n.id));
        const keptNodes = prev.nodes
          .filter((n) => !ids.has(n.id))
          .map((n) => ({
            ...n,
            dependencies: (n.dependencies || []).filter((d) => !ids.has(d)),
            exclusiveWith: (n.exclusiveWith || []).filter((d) => !ids.has(d)),
          }));
        const keptConns = prev.connections.filter(
          (cn) => !ids.has(cn.from) && !ids.has(cn.to)
        );
        const parentNodes = (frame.nodes || []).map((n) =>
          n.id === frame.hostId
            ? {
                ...n,
                subtrees: (n.subtrees || []).map((st, i) =>
                  i === (frame.subtreeIndex ?? 0)
                    ? { ...st, nodes: keptNodes, connections: keptConns }
                    : st
                ),
              }
            : n
        );
        const idMap = {};
        const clones = c.nodes.map((n, i) => {
          const id = "n" + Date.now() + "t" + i + "-" + Math.floor(Math.random() * 1000);
          idMap[n.id] = id;
          return {
            ...JSON.parse(JSON.stringify(n)),
            id,
            currentPoints: 0,
            dependencies: [],
            exclusiveWith: [],
            __hostCopy: false,
          };
        });
        const conns = (prev.connections || [])
          .filter((cn) => ids.has(cn.from) && ids.has(cn.to))
          .map((cn) => ({
            ...cn,
            id: `${idMap[cn.from]}->${idMap[cn.to]}`,
            from: idMap[cn.from],
            to: idMap[cn.to],
          }));
        const tabs = (prev.tabs || []).map((tab) =>
          tab.id === tabId
            ? {
                ...tab,
                nodes: [...(tab.nodes || []), ...clones],
                connections: [...(tab.connections || []), ...conns],
              }
            : tab
        );
        // Stay in the subtree editor; the carried nodes now live in the tab.
        return {
          ...prev,
          tabs,
          nodes: keptNodes,
          connections: keptConns,
          subtreeEditing: { stack: [...stack.slice(0, -1), { ...frame, nodes: parentNodes }] },
        };
      });
  };

  // Send nodes into a parent's own subtree: fresh ids, points reset, each
  // keeps its distance from the parent (offset to the subtree's starter host
  // copy), connections between sent siblings survive, and every clone
  // autoconnects to the starter node.
  const sendNodesToSubtree = useCallback((entries) => {
    if (!entries?.length) return;
    setTreeRaw((prev) => {
      if (!prev) return prev;
      const byId = new Map(prev.nodes.map((n) => [n.id, n]));
      const groups = new Map(); // "hostId:subIndex" → [{ node, host }]
      const sent = new Set();
      entries.forEach(({ id, hostId, subIndex }) => {
        const n = byId.get(id);
        const host = byId.get(hostId);
        if (!n || !host || sent.has(id)) return;
        if (id === hostId || subtreeChainHasNode(n, hostId)) {
          toast.error(`“${n.name || "node"}” can't be sent into its own subtree.`);
          return;
        }
        const key = `${hostId}:${subIndex ?? 0}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ node: n, host });
        sent.add(id);
      });
      if (!groups.size) return prev;
      let nodes = prev.nodes.filter((n) => !sent.has(n.id));
      let connections = prev.connections.filter(
        (c) => !sent.has(c.from) && !sent.has(c.to)
      );
      nodes = nodes.map((n) => ({
        ...n,
        dependencies: (n.dependencies || []).filter((d) => !sent.has(d)),
        exclusiveWith: (n.exclusiveWith || []).filter((d) => !sent.has(d)),
      }));
      const hostUpdates = [];
      groups.forEach((items, key) => {
        const sep = key.lastIndexOf(":");
        const hostId = key.slice(0, sep);
        const subIndex = Number(key.slice(sep + 1)) || 0;
        const host = items[0].host;
        const existing = (host.subtrees || [])[subIndex];
        const base = existing || {
          id: nextSubtreeId(),
          name: `Subtree ${(host.subtrees || []).length + 1}`,
          nodes: [makeReturnNode()],
          connections: [],
          grantedPoints: 3,
          poolName: "",
          exclusive: false,
          maxPurchases: 0,
          purchases: 0,
        };
        const hostCopy =
          (base.nodes || []).find((n) => n.__returnNode) ||
          (base.nodes || []).find((n) => n.__hostCopy) ||
          null;
        const clones = [];
        const idMap = {};
        items.forEach(({ node: n }, i) => {
          const clone = JSON.parse(JSON.stringify(n));
          const id = "n" + Date.now() + "s" + i + "-" + Math.floor(Math.random() * 1000);
          idMap[n.id] = id;
          clone.id = id;
          clone.currentPoints = 0;
          clone.dependencies = [];
          clone.exclusiveWith = [];
          // Keep each clone's distance from its parent.
          clone.x = (hostCopy?.x ?? 0) + (n.x - host.x);
          clone.y = (hostCopy?.y ?? 0) + (n.y - host.y);
          clones.push(clone);
        });
        // Connections between sent siblings carry over into the subtree.
        const internal = prev.connections
          .filter((c) => sent.has(c.from) && sent.has(c.to) && idMap[c.from] && idMap[c.to])
          .map((c) => ({
            ...c,
            id: `${idMap[c.from]}->${idMap[c.to]}`,
            from: idMap[c.from],
            to: idMap[c.to],
          }));
        const links = hostCopy
          ? clones.map((cl) => ({ id: `${hostCopy.id}->${cl.id}`, from: hostCopy.id, to: cl.id }))
          : [];
        const nextSt = {
          ...base,
          nodes: [...(base.nodes || []), ...clones],
          connections: [...(base.connections || []), ...links, ...internal],
        };
        hostUpdates.push({ hostId, subIndex, existed: !!existing, nextSt });
      });
      hostUpdates.forEach(({ hostId, subIndex, existed, nextSt }) => {
        nodes = nodes.map((n) =>
          n.id !== hostId
            ? n
            : {
                ...n,
                subtrees: existed
                  ? (n.subtrees || []).map((st, i) => (i === subIndex ? nextSt : st))
                  : [...(n.subtrees || []), nextSt],
              }
        );
      });
      let next = { ...prev, nodes, connections };
      hostUpdates.forEach(({ nextSt }) => {
        if (nextSt.sharedId) next = syncSharedSubtree(next, nextSt.sharedId, nextSt);
      });
      return next;
    });
  }, []);

  const mergedTree = useMemo(() => {
    if (!tree) return tree;
    const extras = [
      ...(sideTrees.left?.kind === "snapshot" ? sideTrees.left.nodes || [] : []),
      ...(sideTrees.right?.kind === "snapshot" ? sideTrees.right.nodes || [] : []),
    ];
    if (!extras.length) return tree;
    return { ...tree, nodes: [...tree.nodes, ...extras] };
  }, [tree, sideTrees]);

  const [view, setView] = useState(DEFAULT_VIEW);
  const [grid, setGrid] = useState(DEFAULT_GRID);
  const [mode, setMode] = useState("edit");
  // Character Creator enters the sheet with editing disabled; any other
  // entry point (New, Load) clears it again.
  const [sheetOnly, setSheetOnly] = useState(false);
  const [pools, setPools] = useState(DEFAULT_POOLS);
  const [character, setCharacter] = useState(DEFAULT_CHARACTER);
  devModeRef.current = !!character.devMode;
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Save a subtree as a reusable library template and link the source instance
  // to it, so edits on this node and every other linked host stay in sync.
  const saveSharedSubtree = useCallback((hostId, subIndex, name) => {
    const host = (tree?.nodes || []).find((n) => n.id === hostId);
    const current = (host?.subtrees || [])[subIndex];
    if (!current) return;
    const sharedId = nextSubtreeId();
    const sharedName = String(name || current.name || "Shared subtree").trim();
    const definition = { ...sharedDefinition(current), name: sharedName };
    setTree((t) => {
      if (!t) return t;
      return {
        ...t,
        nodes: t.nodes.map((n) =>
          n.id !== hostId
            ? n
            : {
                ...n,
                subtrees: (n.subtrees || []).map((st, i) =>
                  i === subIndex ? { ...st, sharedId, name: sharedName } : st
                ),
              }
        ),
        sharedSubtrees: { ...(t.sharedSubtrees || {}), [sharedId]: definition },
      };
    });
    setSettings((s) => ({
      ...s,
      library: {
        ...(s.library || {}),
        sharedSubtrees: [
          ...(s.library?.sharedSubtrees || []),
          { ...definition, id: sharedId, name: sharedName },
        ],
      },
    }));
  }, [tree, setSettings]);

  // Keep reusable library templates in step with edits made to linked
  // instances, so loading one later yields the current structure.
  useEffect(() => {
    const definitions = tree?.sharedSubtrees;
    if (!definitions) return;
    setSettings((s) => {
      const entries = s.library?.sharedSubtrees || [];
      let changed = false;
      const next = entries.map((entry) => {
        const definition = definitions[entry.id];
        if (!definition) return entry;
        const merged = {
          ...entry,
          ...definition,
          id: entry.id,
          name: definition.name || entry.name,
        };
        if (JSON.stringify(merged) === JSON.stringify(entry)) return entry;
        changed = true;
        return merged;
      });
      return changed
        ? { ...s, library: { ...s.library, sharedSubtrees: next } }
        : s;
    });
  }, [tree?.sharedSubtrees, setSettings]);
  // Double-click jump from the Character tab: a node id plus a sequence so
  // repeated jumps to the same node still fire. The panel that holds the
  // node centres its camera on it and claims the request.
  const [treeFocus, setTreeFocus] = useState(null);
  const focusNode = useCallback(
    (nodeId) => setTreeFocus({ nodeId, seq: Date.now() }),
    []
  );
  const clearTreeFocus = useCallback(() => setTreeFocus(null), []);

  // Hydrate the working project from IndexedDB once. Old localStorage copies
  // (from earlier builds) are migrated first, then deleted so the space they
  // held is released.
  useEffect(() => {
    let alive = true;
    const blankProject = () =>
      seedCameraStart(
        ensureTabs({
          name: "New Skill Tree",
          nodes: [],
          connections: [],
          sharedSubtrees: {},
          tabs: [{ id: "tab-main", name: "Main", nodes: [], connections: [] }],
          activeTabId: "tab-main",
        })
      );

    (async () => {
      await migrateLegacyStorage();
      const [storedTree, storedCharacter, storedSettings] = await Promise.all([
        readProjectValue(LEGACY_KEYS.tree),
        readProjectValue(LEGACY_KEYS.character),
        readProjectValue(LEGACY_KEYS.settings),
      ]);
      if (!alive) return;

      if (storedSettings) {
        const storedAudio = storedSettings.audio || {};
        const audioSettings = {
          ...DEFAULT_AUDIO_SETTINGS,
          ...storedAudio,
          // v2 lowered the initial music level from 50% to 30%. Only the old
          // untouched default is migrated; a deliberate custom level stays.
          musicVolume:
            Number(storedAudio.defaultsVersion) >= 2
              ? storedAudio.musicVolume ?? DEFAULT_AUDIO_SETTINGS.musicVolume
              : Number(storedAudio.musicVolume) === 0.5
                ? DEFAULT_AUDIO_SETTINGS.musicVolume
                : storedAudio.musicVolume ?? DEFAULT_AUDIO_SETTINGS.musicVolume,
          defaultsVersion: DEFAULT_AUDIO_SETTINGS.defaultsVersion,
        };
        setSettings({
          hotkeys: { ...DEFAULT_HOTKEYS, ...(storedSettings.hotkeys || {}) },
          connector: { ...DEFAULT_SETTINGS.connector, ...(storedSettings.connector || {}) },
          placeholderImage:
            isLegacyHostedImage(storedSettings.placeholderImage) ||
            storedSettings.placeholderImage === LEGACY_PLACEHOLDER
              ? DEFAULT_SETTINGS.placeholderImage
              : storedSettings.placeholderImage || DEFAULT_SETTINGS.placeholderImage,
          placeholderFrame: isLegacyHostedImage(storedSettings.placeholderFrame)
            ? ""
            : storedSettings.placeholderFrame || "",
          cameraStartNode: storedSettings.cameraStartNode || "",
          rewardCurrency: storedSettings.rewardCurrency || "gp",
          tourDone: !!storedSettings.tourDone,
          srdSeedVersion: Number(storedSettings.srdSeedVersion) || 0,
          autoSave: storedSettings.autoSave !== false,
          autoSaveToDisk: storedSettings.autoSaveToDisk !== false,
          autoSaveInterval: storedSettings.autoSaveInterval || 60,
          audio: audioSettings,
          updateUrl: storedSettings.updateUrl ?? DEFAULT_SETTINGS.updateUrl,
          levelRules: { ...DEFAULT_SETTINGS.levelRules, ...(storedSettings.levelRules || {}) },
          library: mergeLibrary(storedSettings.library),
        });
      }

      if (storedTree) {
        try {
          setTreeRaw(
            seedCameraStart(
              ensureTabs(migrateTree(storedTree)),
              storedSettings
            )
          );
        } catch {
          setTreeRaw(blankProject());
        }
      } else {
        // No hardcoded starting tree: a fresh launch begins with a blank project.
        setTreeRaw(blankProject());
      }

      if (storedCharacter) {
        setCharacter({
          ...DEFAULT_CHARACTER,
          ...storedCharacter,
          stats: { ...DEFAULT_CHARACTER.stats, ...(storedCharacter.stats || {}) },
          abilityChoices: storedCharacter.abilityChoices || {},
          appearance: { ...DEFAULT_CHARACTER.appearance, ...(storedCharacter.appearance || {}) },
          // Movement switched from feet to spaces: migrate the old 30 ft default.
          ...(storedCharacter.speed === 30 ? { speed: 6 } : {}),
        });
      }

      hydratedRef.current = true;
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  // Merge the bundled SRD 5.1/5.2 reference content once per project. Only
  // missing entries are added: a user's imports and hand edits always win.
  // 5eTools imports stay optional and are stored per person.
  useEffect(() => {
    if (loading || !hydratedRef.current || srdSeedStartedRef.current) return;
    if (Number(settings?.srdSeedVersion) >= SRD_SEED_VERSION) return;
    srdSeedStartedRef.current = true;
    let alive = true;
    fetchAndMergeSrdSeed(settings?.library || {})
      .then(({ library, added }) => {
        if (!alive) return;
        setSettings((s) => ({ ...s, library, srdSeedVersion: SRD_SEED_VERSION }));
        if (added) {
          toast.success("SRD reference data added", {
            description: `${added} entries from the free SRD 5.1 and 5.2 documents (CC-BY 4.0).`,
          });
        }
      })
      .catch(() => {
        // Leave the version unset so the next launch retries.
        srdSeedStartedRef.current = false;
      });
    return () => {
      alive = false;
    };
  }, [loading, settings?.srdSeedVersion, settings?.library, setSettings]);

  // Autosave the working project so Continue resumes where the player left
  // off. IndexedDB has no practical size cap, so big trees and save bundles no
  // longer fail to write.
  useEffect(() => {
    if (!tree || !hydratedRef.current) return;
    const t = setTimeout(() => {
      writeProjectValue(LEGACY_KEYS.tree, tree).catch(() => {
        /* reported by the explicit Save action */
      });
    }, 800);
    return () => clearTimeout(t);
  }, [tree]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const t = setTimeout(() => {
      writeProjectValue(LEGACY_KEYS.settings, settings).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [settings]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const t = setTimeout(() => {
      writeProjectValue(LEGACY_KEYS.character, character).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [character]);

  // Mirror the working project into a real file on the PC. The browser copy is
  // still the live save; this is the automatic system-level backup.
  useEffect(() => {
    if (!hydratedRef.current || !tree || !dirty || settings.autoSaveToDisk === false) return undefined;
    // Never mirror a completely empty launch over an existing project on disk.
    // A fresh browser profile sees an empty IndexedDB; without this guard its
    // first autosave would replace the real project file with a blank one.
    const treeHasContent =
      (tree.nodes || []).length > 0 ||
      (tree.tabs || []).some((tab) => (tab.nodes || []).length > 0);
    const worldHasContent = !!settings.library?.world;
    const characterHasContent = !!character?.name;
    if (!treeHasContent && !worldHasContent && !characterHasContent) {
      return undefined;
    }
    const t = setTimeout(() => {
      const payload = {
        name: tree.name || character?.name || "Terrific Talent Tree Project",
        savedAt: new Date().toISOString(),
        tree,
        character,
        pools,
        library: settings.library,
        settings: {
          rewardCurrency: settings.rewardCurrency,
          autoSaveToDisk: settings.autoSaveToDisk,
          levelRules: settings.levelRules,
          updateUrl: settings.updateUrl,
        },
        plots: loadPlots(),
      };
      saveProjectToDisk(payload, { name: payload.name }).catch(() => {});
    }, 2500);
    return () => clearTimeout(t);
  }, [tree, character, pools, settings.library, settings.rewardCurrency, settings.autoSaveToDisk, settings.levelRules, settings.updateUrl, dirty]);

  // Warn before the program closes only while edits are unsaved. Leaving the
  // workspace for the main menu deliberately does not ask.
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Camera start: the canvas recentres itself on the active tab's chosen start
  // node (or its first node) once it is mounted and measured — see
  // SkillTreeCanvas's camera effect. Kept out of the store so it never runs
  // while the canvas is hidden (launch menu / character sheet).

  const nodesById = useMemo(() => {
    const m = {};
    tree?.nodes.forEach((n) => (m[n.id] = n));
    return m;
  }, [tree]);

  const updateNode = useCallback((id, patch) => {
    setTree((t) =>
      t
        ? {
            ...t,
            nodes: t.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
          }
        : t
    );
  }, []);

  const addNode = useCallback((x, y) => {
    // The id is computed once — inside and outside the updater must agree.
    const id = "n" + Date.now() + "-" + Math.floor(Math.random() * 10000);
    setTree((t) => {
      if (!t) return t;
      // The tree's first node anchors at the world origin (0, 0): the natural
      // center point of the circular, hexagonal and triangular grids.
      if (!t.nodes?.length) {
        x = 0;
        y = 0;
      }
      const node = {
        id,
        name: "New Skill",
        x,
        y,
        flavor: "",
        maxPoints: 1,
        currentPoints: 0,
        cost: 1,
        image: "",
        description: "",
        dependencies: [],
        prerequisite: "-",
        resources: [],
        actions: [],
        requirementMode: "none",
        requiredPoints: 1,
        talentType: "",
        talentTypes: [],
        tiers: [],
        levelReq: 0,
        nodeType: "skill",
        attributeStat: "",
        grantsExpertise: false,
        proficiencyGrant: "none",
        proficiencies: [],
        options: [],
        grants: [],
        exclusiveWith: [],
        requiredProficiencies: [],
        abilityReqs: [],
        poolOverride: "",
        frameImage: "",
        iconInset: 12,
        optionsPerTake: 1,
        rotation: 0,
        flipped: false,
        pointType: "talent",
        subtrees: [],
        size: 100,
      };
      // Inside a subtree editor, new nodes are auto-linked with a connector
      // from that subtree's return node (the seed node of this subtree).
      const hostCopy = t.subtreeEditing?.stack?.length
        ? t.nodes.find((n) => n.__returnNode) || t.nodes.find((n) => n.__hostCopy)
        : null;
      return {
        ...t,
        nodes: [...t.nodes, node],
        connections: hostCopy
          ? [...t.connections, { id: `${hostCopy.id}->${id}`, from: hostCopy.id, to: id }]
          : t.connections,
      };
    });
    playSfx(SFX.placeNode, { gain: 0.6 });
    return id;
  }, []);

  const deleteNode = useCallback((id) => {
    setTree((t) =>
      t
        ? {
            ...t,
            nodes: t.nodes
              .filter((n) => n.id !== id)
              .map((n) => ({
                ...n,
                dependencies: n.dependencies.filter((d) => d !== id),
              })),
            connections: t.connections.filter(
              (c) => c.from !== id && c.to !== id
            ),
          }
        : t
    );
    setUi((u) =>
      u.selectedNodeId === id || u.editingNodeId === id
        ? { ...u, selectedNodeId: null, editingNodeId: null }
        : u
    );
  }, []);

  // Delete several nodes (Delete key / multi-selection).
  const deleteNodes = useCallback((ids) => {
    const set = new Set(ids);
    setTree((t) =>
      t
        ? {
            ...t,
            nodes: t.nodes
              .filter((n) => !set.has(n.id))
              .map((n) => ({
                ...n,
                dependencies: n.dependencies.filter((d) => !set.has(d)),
              })),
            connections: t.connections.filter(
              (c) => !set.has(c.from) && !set.has(c.to)
            ),
          }
        : t
    );
    setUi((u) => {
      const next = { ...u };
      if (set.has(u.selectedNodeId)) next.selectedNodeId = null;
      if (set.has(u.editingNodeId)) next.editingNodeId = null;
      next.selectedNodeIds = (u.selectedNodeIds || []).filter((id) => !set.has(id));
      return next;
    });
  }, []);

  const deleteConnection = useCallback((id) => {
    // Removing a connector also clears the matching prerequisite on the
    // target node, so its "Prerequisite nodes" list stays in sync.
    setTree((t) => {
      if (!t) return t;
      const conn = t.connections.find((c) => c.id === id);
      if (!conn) return { ...t, connections: t.connections.filter((c) => c.id !== id) };
      return {
        ...t,
        connections: t.connections.filter((c) => c.id !== id),
        nodes: t.nodes.map((n) =>
          n.id === conn.to
            ? { ...n, dependencies: n.dependencies.filter((d) => d !== conn.from) }
            : n
        ),
      };
    });
    setUi((u) =>
      u.selectedConnectionId === id ? { ...u, selectedConnectionId: null } : u
    );
  }, []);

  // Rotate one or more nodes. For a multi-selection the group orbits its own
  // center; a single node spins in place.
  const rotateNodes = useCallback((ids, deg) => {
    setTree((t) => {
      if (!t) return t;
      const sel = t.nodes.filter((n) => ids.includes(n.id));
      if (!sel.length) return t;
      if (sel.length === 1) {
        const n = sel[0];
        return {
          ...t,
          nodes: t.nodes.map((m) =>
            m.id === n.id ? { ...m, rotation: (m.rotation + deg + 360) % 360 } : m
          ),
        };
      }
      const cx = sel.reduce((a, n) => a + n.x, 0) / sel.length;
      const cy = sel.reduce((a, n) => a + n.y, 0) / sel.length;
      const rad = (deg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const posById = {};
      sel.forEach((n) => {
        const dx = n.x - cx;
        const dy = n.y - cy;
        posById[n.id] = {
          x: cx + dx * cos - dy * sin,
          y: cy + dx * sin + dy * cos,
          rotation: (n.rotation + deg + 360) % 360,
        };
      });
      return {
        ...t,
        nodes: t.nodes.map((n) => (posById[n.id] ? { ...n, ...posById[n.id] } : n)),
      };
    });
  }, []);

  const rotateNode = useCallback(
    (id, deg) => {
      const n = nodesById[id];
      if (n) updateNode(id, { rotation: (n.rotation + deg + 360) % 360 });
    },
    [nodesById, updateNode]
  );

  const flipNode = useCallback(
    (id, axis = "h") => {
      const n = nodesById[id];
      if (!n) return;
      if (axis === "v") updateNode(id, { flipV: !n.flipV });
      else updateNode(id, { flipped: !n.flipped });
    },
    [nodesById, updateNode]
  );

  const toggleDependency = useCallback((fromId, toId) => {
    setTree((t) => {
      if (!t) return t;
      const target = t.nodes.find((n) => n.id === toId);
      if (!target) return t;
      const has = (target.dependencies || []).includes(fromId);
      const deps = has
        ? (target.dependencies || []).filter((d) => d !== fromId)
        : [...(target.dependencies || []), fromId];
      const depSet = new Set(deps);
      return {
        ...t,
        nodes: t.nodes.map((n) => (n.id !== toId ? n : { ...n, dependencies: deps })),
        // Keep connectors in step with the prerequisite list itself. Using
        // the dependency state (rather than toggling on connector presence)
        // means a stale or duplicated line can never invert the relationship
        // when a chip is removed. Removing a chip also prunes any unmatched
        // connector into this node, cleaning up older broken copies.
        connections: has
          ? t.connections.filter(
              (c) =>
                !(c.from === fromId && c.to === toId) &&
                !(c.to === toId && !depSet.has(c.from))
            )
          : t.connections.some((c) => c.from === fromId && c.to === toId)
          ? t.connections
          : [...t.connections, { id: `${fromId}->${toId}`, from: fromId, to: toId }],
      };
    });
  }, []);

  // Move one or more nodes in a single tree update (group/marquee drags).
  const moveNodes = useCallback((positions) => {
    setTree((t) => {
      if (!t) return t;
      const byId = {};
      positions.forEach((p) => (byId[p.id] = p));
      return {
        ...t,
        nodes: t.nodes.map((n) =>
          byId[n.id] ? { ...n, x: byId[n.id].x, y: byId[n.id].y } : n
        ),
      };
    });
  }, []);

  // Cut/paste clipboard: full node objects plus the connections between them,
  // kept in a ref so it survives tab switches (but not page reloads).
  const clipboardRef = useRef({ nodes: [], connections: [] });

  // Cut the given nodes: stash them (with their internal connectors) and
  // delete them from the current tab.
  const cutNodes = useCallback(
    (ids) => {
      const t = tree;
      if (!t || !ids.length) return;
      const set = new Set(ids);
      clipboardRef.current = {
        nodes: t.nodes.filter((n) => set.has(n.id)),
        connections: t.connections.filter(
          (c) => set.has(c.from) && set.has(c.to)
        ),
      };
      setTree((prev) =>
        prev
          ? {
              ...prev,
              nodes: prev.nodes
                .filter((n) => !set.has(n.id))
                .map((n) => ({
                  ...n,
                  dependencies: n.dependencies.filter((d) => !set.has(d)),
                  exclusiveWith: (n.exclusiveWith || []).filter((d) => !set.has(d)),
                })),
              connections: prev.connections.filter(
                (c) => !set.has(c.from) && !set.has(c.to)
              ),
            }
          : prev
      );
      setUi((u) => ({
        ...u,
        selectedNodeId: null,
        editingNodeId: null,
        selectedNodeIds: [],
        selectedConnectionId: null,
      }));
    },
    [tree, setUi]
  );

  // Copy the given nodes to the clipboard without removing them. A later copy
  // or cut replaces the clipboard contents entirely.
  const copyNodes = useCallback(
    (ids) => {
      const t = tree;
      if (!t || !ids.length) return;
      const set = new Set(ids);
      clipboardRef.current = {
        nodes: t.nodes.filter((n) => set.has(n.id)),
        connections: t.connections.filter(
          (c) => set.has(c.from) && set.has(c.to)
        ),
      };
    },
    [tree]
  );

  // Paste the clipboard into the active tab. Ids are regenerated; only links
  // between the pasted nodes survive — prerequisites left behind in another
  // tab are dropped, and invested points reset.
  const pasteClipboard = useCallback(() => {
    const clip = clipboardRef.current;
    if (!clip || !clip.nodes.length) return [];
    const idMap = {};
    clip.nodes.forEach((n, i) => (idMap[n.id] = "n" + Date.now() + "p" + i));
    const nodes = clip.nodes.map((n) => ({
      ...n,
      id: idMap[n.id],
      // Remap links to the clones' fresh ids — filtering alone would leave the
      // old ids in place, producing "?" prerequisites and connectors that no
      // longer match the node they belong to.
      dependencies: (n.dependencies || []).filter((d) => idMap[d]).map((d) => idMap[d]),
      exclusiveWith: (n.exclusiveWith || []).filter((d) => idMap[d]).map((d) => idMap[d]),
      currentPoints: 0,
    }));
    const connections = clip.connections.map((c) => ({
      ...c,
      id: `${idMap[c.from]}->${idMap[c.to]}`,
      from: idMap[c.from],
      to: idMap[c.to],
    }));
    setTree((prev) =>
      prev
        ? {
            ...prev,
            nodes: [...prev.nodes, ...nodes],
            connections: [...prev.connections, ...connections],
          }
        : prev
    );
    return nodes.map((n) => n.id);
  }, [setTree]);

  // Move the given nodes to another tab: they keep the links between them and
  // lose any prerequisites that stay behind.
  const moveNodesToTab = useCallback(
    (ids, tabId) => {
      const t = tree;
      if (!t || !tabId || tabId === t.activeTabId) return;
      const set = new Set(ids);
      const nodes = t.nodes.filter((n) => set.has(n.id));
      if (!nodes.length) return;
      const idMap = {};
      nodes.forEach((n, i) => (idMap[n.id] = "n" + Date.now() + "m" + i));
      const movedNodes = nodes.map((n) => ({
        ...n,
        id: idMap[n.id],
        dependencies: (n.dependencies || []).filter((d) => idMap[d]).map((d) => idMap[d]),
        exclusiveWith: (n.exclusiveWith || []).filter((d) => idMap[d]).map((d) => idMap[d]),
      }));
      const movedConns = t.connections
        .filter((c) => set.has(c.from) && set.has(c.to))
        .map((c) => ({
          ...c,
          id: `${idMap[c.from]}->${idMap[c.to]}`,
          from: idMap[c.from],
          to: idMap[c.to],
        }));
      setTreeRaw((prev) => {
        if (!prev) return prev;
        const tabs = prev.tabs.map((tab) => {
          if (tab.id === tabId)
            return {
              ...tab,
              nodes: [...(tab.nodes || []), ...movedNodes],
              connections: [...(tab.connections || []), ...movedConns],
            };
          if (tab.id === prev.activeTabId)
            return {
              ...tab,
              nodes: (tab.nodes || [])
                .filter((n) => !set.has(n.id))
                .map((n) => ({
                  ...n,
                  dependencies: n.dependencies.filter((d) => !set.has(d)),
                  exclusiveWith: (n.exclusiveWith || []).filter((d) => !set.has(d)),
                })),
              connections: (tab.connections || []).filter(
                (c) => !set.has(c.from) && !set.has(c.to)
              ),
            };
          return tab;
        });
        const target = tabs.find((x) => x.id === tabId);
        return {
          ...prev,
          tabs,
          activeTabId: tabId,
          nodes: target?.nodes || [],
          connections: target?.connections || [],
        };
      });
      setUi((u) => ({
        ...u,
        selectedNodeId: null,
        editingNodeId: null,
        selectedNodeIds: [],
        selectedConnectionId: null,
      }));
    },
    [tree, setUi]
  );

  const investPoint = useCallback(
    (id, delta) => {
      setTree((t) => {
        if (!t) return t;
        // Acquisition order: a node's first point stamps it with a sequence
        // number, so View lists can show the order talents were bought in.
        const seq = (Number(t.acquireSeq) || 0) + 1;
        return {
          ...t,
          acquireSeq: seq,
          nodes: t.nodes.map((n) => {
            if (n.id !== id) return n;
            const max = nodeMaxPoints(n);
            const cur = Number(n.currentPoints) || 0;
            const next = Math.max(0, Math.min(max, cur + delta));
            if (cur === 0 && next > 0 && !n.acquiredOrder)
              return { ...n, currentPoints: next, acquiredOrder: seq };
            return { ...n, currentPoints: next };
          }),
        };
      });
      if (Number(delta) > 0) playSfx(SFX.unlockNode, { gain: 0.5 });
    },
    []
  );

  // Undo/redo history: tree snapshots, newest last.
  const historyRef = useRef({ stack: [], index: -1, applying: false });
  useEffect(() => {
    if (!tree) return;
    const h = historyRef.current;
    if (h.applying) {
      h.applying = false;
      return;
    }
    h.stack = h.stack.slice(0, h.index + 1);
    h.stack.push(tree);
    if (h.stack.length > 50) h.stack.shift();
    h.index = h.stack.length - 1;
  }, [tree]);
  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.index > 0) {
      h.index -= 1;
      h.applying = true;
      setTree(h.stack[h.index]);
    }
  }, []);
  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.index < h.stack.length - 1) {
      h.index += 1;
      h.applying = true;
      setTree(h.stack[h.index]);
    }
  }, []);

  const addBend = useCallback((connId, x, y, index) => {
    setTree((t) => {
      if (!t) return t;
      return {
        ...t,
        connections: t.connections.map((c) => {
          if (c.id !== connId) return c;
          const bends = [...(c.bends || [])];
          const at =
            index == null ? bends.length : Math.max(0, Math.min(index, bends.length));
          bends.splice(at, 0, { x, y });
          return { ...c, bends };
        }),
      };
    });
  }, []);

  const moveBend = useCallback((connId, index, x, y) => {
    setTree((t) => {
      if (!t) return t;
      return {
        ...t,
        connections: t.connections.map((c) => {
          if (c.id !== connId || !c.bends || !c.bends[index]) return c;
          const bends = c.bends.map((b, i) => (i === index ? { x, y } : b));
          return { ...c, bends };
        }),
      };
    });
  }, []);

  const removeBend = useCallback((connId, index) => {
    setTree((t) => {
      if (!t) return t;
      return {
        ...t,
        connections: t.connections.map((c) => {
          if (c.id !== connId || !c.bends) return c;
          const bends = c.bends.filter((_, i) => i !== index);
          return { ...c, bends };
        }),
      };
    });
  }, []);

  const updateConnection = useCallback((id, patch) => {
    setTree((t) =>
      t
        ? {
            ...t,
            connections: t.connections.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          }
        : t
    );
  }, []);

  // Invert every prerequisite relationship on the current tab: each node's
  // prerequisites (dependencies) and connectors are swapped with its
  // dependents, fixing trees whose import stored the parent/child roles
  // reversed. Prerequisite name strings are rewritten to match the new gates.
  const invertPrerequisites = useCallback(() => {
    setTree((t) => {
      if (!t) return t;
      const byId = {};
      (t.nodes || []).forEach((n) => (byId[n.id] = n));
      const newDeps = {};
      (t.nodes || []).forEach((n) => (newDeps[n.id] = []));
      const connections = (t.connections || []).map((c) => {
        if (newDeps[c.from]) newDeps[c.from].push(c.to);
        return {
          ...c,
          id: `${c.to}->${c.from}`,
          from: c.to,
          to: c.from,
          bends: (c.bends || []).slice().reverse(),
        };
      });
      const nodes = (t.nodes || []).map((n) => {
        const deps = [...new Set(newDeps[n.id] || [])].filter((d) => d !== n.id);
        return {
          ...n,
          dependencies: deps,
          prerequisite: deps.length ? byId[deps[0]]?.name || "-" : "-",
        };
      });
      const activeId = t.activeTabId;
      const tabs = (t.tabs || []).map((tab) =>
        tab.id === activeId ? { ...tab, nodes, connections } : tab
      );
      return { ...t, tabs, nodes, connections };
    });
  }, []);

  // Import a skill-tree file. mode: "overwrite" (replace the current tab's
  // tree), "merge" (add its nodes to the current tab) or "newTab" (its own
  // new tab, which becomes active).
  const importTree = useCallback((data, mode = "overwrite") => {
    // A tree file can carry its Reference Library — importing one restores it.
    if (data && data["Reference Library"]) {
      setSettings((s) => ({ ...s, library: mergeLibrary(data["Reference Library"]) }));
    }
    const t = migrateTree(normalizeTree(data));
    setUi((u) => ({
      ...u,
      selectedNodeId: null,
      editingNodeId: null,
      selectedNodeIds: [],
      selectedConnectionId: null,
    }));
    if (mode === "merge") {
      // Fresh ids so merged nodes can never collide with existing ones.
      const idMap = {};
      t.nodes.forEach((n, i) => (idMap[n.id] = "n" + Date.now() + "m" + i));
      const nodes = t.nodes.map((n) => ({
        ...n,
        id: idMap[n.id],
        dependencies: (n.dependencies || []).map((d) => idMap[d] || d),
        exclusiveWith: (n.exclusiveWith || []).map((d) => idMap[d] || d),
      }));
      const connections = t.connections.map((c) => ({
        ...c,
        id: `${idMap[c.from]}->${idMap[c.to]}`,
        from: idMap[c.from],
        to: idMap[c.to],
      }));
      setTree((prev) => {
        if (!prev || !(prev.tabs || []).length) return ensureTabs({ ...t, nodes, connections });
        return {
          ...prev,
          nodes: [...prev.nodes, ...nodes],
          connections: [...prev.connections, ...connections],
        };
      });
      return;
    }
    if (mode === "newTab") {
      setTreeRaw((prev) => {
        if (!prev) return ensureTabs(t);
        const tab = {
          id: "tab" + Date.now(),
          name: t.name || `Tree ${(prev.tabs?.length || 0) + 1}`,
          nodes: t.nodes,
          connections: t.connections,
          cameraStartNode: "",
        };
        return {
          ...prev,
          tabs: [...prev.tabs, tab],
          activeTabId: tab.id,
          nodes: tab.nodes,
          connections: tab.connections,
        };
      });
      return;
    }
    // overwrite: replace the current tab's tree; other tabs are kept.
    setTree((prev) => {
      if (!prev || !(prev.tabs || []).length) return ensureTabs(t);
      const tabs = prev.tabs.map((tab) =>
        tab.id === prev.activeTabId
          ? { ...tab, nodes: t.nodes, connections: t.connections }
          : tab
      );
      return { ...prev, tabs, nodes: t.nodes, connections: t.connections };
    });
    setView(DEFAULT_VIEW);
  }, [setSettings]);

  const resetView = useCallback(() => setView(DEFAULT_VIEW), []);

  // Tab management: switching a tab swaps in that tab's nodes/connections.
  const setActiveTab = useCallback((tabId) => {
    setTreeRaw((prev) => {
      if (!prev) return prev;
      const tab = (prev.tabs || []).find((t) => t.id === tabId);
      if (!tab) return prev;
      return {
        ...prev,
        activeTabId: tabId,
        nodes: tab.nodes || [],
        connections: tab.connections || [],
      };
    });
    setUi((u) => ({
      ...u,
      selectedNodeId: null,
      editingNodeId: null,
      selectedNodeIds: [],
      selectedConnectionId: null,
    }));
  }, []);

  const addTab = useCallback(() => {
    setTreeRaw((prev) => {
      if (!prev) return prev;
      const tab = {
        id: "tab" + Date.now(),
        name: `Tree ${(prev.tabs?.length || 0) + 1}`,
        nodes: [],
        connections: [],
        cameraStartNode: "",
      };
      return {
        ...prev,
        tabs: [...(prev.tabs || []), tab],
        activeTabId: tab.id,
        nodes: [],
        connections: [],
      };
    });
    setUi((u) => ({
      ...u,
      selectedNodeId: null,
      editingNodeId: null,
      selectedNodeIds: [],
      selectedConnectionId: null,
    }));
  }, []);

  const renameTab = useCallback((tabId, name) => {
    setTreeRaw((prev) =>
      prev
        ? { ...prev, tabs: prev.tabs.map((t) => (t.id === tabId ? { ...t, name } : t)) }
        : prev
    );
  }, []);

  // Import a 5eTools class/feat/option as a new tree tab. Features are
  // informative nodes chained in order, so they read like a feature ladder
  // without touching any point pool.
  const addImportedTab = useCallback((name, features, meta = {}) => {
    const tab = buildImportedTab(name, features, meta);
    if (!tab) return null;
    const activate = meta.activate !== false;
    setTreeRaw((prev) =>
      prev
        ? {
            ...prev,
            tabs: [...(prev.tabs || []), tab],
            ...(activate
              ? { activeTabId: tab.id, nodes: tab.nodes, connections: tab.connections }
              : {}),
          }
        : prev
    );
    setUi((u) => ({
      ...u,
      selectedNodeId: null,
      editingNodeId: null,
      selectedNodeIds: [],
      selectedConnectionId: null,
    }));
    return tab.id;
  }, []);

  // Append many imported tabs in one update. Bulk homebrew imports can create
  // hundreds of class/feature tabs, so this avoids re-rendering per tab.
  const addImportedTabs = useCallback((specs, { activate = false } = {}) => {
    const tabs = (specs || [])
      .map((spec) => buildImportedTab(spec.name, spec.features, spec.meta))
      .filter(Boolean);
    if (!tabs.length) return [];
    setTreeRaw((prev) => {
      if (!prev) return prev;
      const first = tabs[0];
      return {
        ...prev,
        tabs: [...(prev.tabs || []), ...tabs],
        ...(activate
          ? { activeTabId: first.id, nodes: first.nodes, connections: first.connections }
          : {}),
      };
    });
    setUi((u) => ({
      ...u,
      selectedNodeId: null,
      editingNodeId: null,
      selectedNodeIds: [],
      selectedConnectionId: null,
    }));
    return tabs.map((tab) => tab.id);
  }, []);

  const deleteTab = useCallback((tabId) => {
    setTreeRaw((prev) => {
      if (!prev || (prev.tabs || []).length <= 1) return prev;
      const tabs = prev.tabs.filter((t) => t.id !== tabId);
      if (prev.activeTabId !== tabId) return { ...prev, tabs };
      const tab = tabs[0];
      return {
        ...prev,
        tabs,
        activeTabId: tab.id,
        nodes: tab.nodes || [],
        connections: tab.connections || [],
      };
    });
    setUi((u) => ({
      ...u,
      selectedNodeId: null,
      editingNodeId: null,
      selectedNodeIds: [],
      selectedConnectionId: null,
    }));
  }, []);

  // Patch one tab's own fields (name, per-tab camera start node, …).
  const patchTab = useCallback((tabId, patch) => {
    setTreeRaw((prev) =>
      prev
        ? { ...prev, tabs: prev.tabs.map((t) => (t.id === tabId ? { ...t, ...patch } : t)) }
        : prev
    );
  }, []);

  // Launch screen: the home menu is always the app's front page on startup;
  // the workspace opens once an option is picked (or via the toolbar's door).
  const [screen, setScreen] = useState("launch");
  const enterApp = useCallback((nextMode, opts = {}) => {
    try {
      localStorage.setItem("skilltree:launched", "1");
    } catch {
      /* ignore */
    }
    setSheetOnly(!!opts.sheetOnly);
    if (nextMode) setMode(nextMode);
    setScreen("app");
  }, []);

  // "New" on the launch menu: a fresh blank project. The LaunchMenu asks for
  // confirmation itself, so no second prompt here.
  const BACKUP_KEYS = ["backup-1", "backup-2", "backup-3", "backup-4", "backup-5"];
  const backupProject = useCallback(
    async (label = "Manual backup") => {
      const entry = {
        at: new Date().toISOString(),
        label,
        tree,
        settings,
        character,
      };
      const existing = await Promise.all(
        BACKUP_KEYS.map((key) => readProjectValue(key).catch(() => null))
      );
      for (let i = BACKUP_KEYS.length - 1; i > 0; i -= 1) {
        if (existing[i - 1]) await writeProjectValue(BACKUP_KEYS[i], existing[i - 1]);
      }
      await writeProjectValue(BACKUP_KEYS[0], entry);
      return entry;
    },
    [tree, settings, character]
  );

  const listBackups = useCallback(async () => {
    const entries = await Promise.all(
      BACKUP_KEYS.map(async (key) => {
        const value = await readProjectValue(key).catch(() => null);
        return value ? { key, at: value.at || "", label: value.label || "Backup" } : null;
      })
    );
    return entries.filter(Boolean);
  }, []);

  const restoreBackup = useCallback(
    async (key) => {
      const entry = await readProjectValue(key).catch(() => null);
      if (!entry) return false;
      if (entry.tree) setTreeRaw(seedCameraStart(ensureTabs(migrateTree(entry.tree))));
      if (entry.character) {
        setCharacter({
          ...DEFAULT_CHARACTER,
          ...entry.character,
          stats: { ...DEFAULT_CHARACTER.stats, ...(entry.character.stats || {}) },
          abilityChoices: entry.character.abilityChoices || {},
          appearance: { ...DEFAULT_CHARACTER.appearance, ...(entry.character.appearance || {}) },
        });
      }
      if (entry.settings) {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...entry.settings,
          library: mergeLibrary(entry.settings.library),
          projectStarted: true,
        });
      }
      setUi((u) => ({
        ...u,
        selectedNodeId: null,
        editingNodeId: null,
        selectedNodeIds: [],
        selectedConnectionId: null,
      }));
      clearDirty();
      return true;
    },
    [clearDirty]
  );

  const startNewTree = useCallback(() => {
    backupProject("Before New").catch(() => {});
    setTreeRaw({
      name: "New Skill Tree",
      nodes: [],
      connections: [],
      tabs: [{ id: "tab-main", name: "Main", nodes: [], connections: [] }],
      activeTabId: "tab-main",
      sideTrees: { left: { kind: "main" }, right: null },
    });
    setUi((u) => ({
      ...u,
      selectedNodeId: null,
      editingNodeId: null,
      selectedNodeIds: [],
      selectedConnectionId: null,
      pinnedNodeIds: [],
      pinPositions: {},
    }));
    setSettings((s) => ({
      ...s,
      projectStarted: true,
      library: { ...s.library, dungeonDraft: null },
    }));
    const zero = levelZeroPointsFor(settings);
    setPools(
      Object.fromEntries(
        Object.entries(zero).map(([id, total]) => [id, { total }])
      )
    );
    clearDirty();
    enterApp("edit");
  }, [enterApp, clearDirty, backupProject, settings]);

  // Load a saved character bundle (tree + character + pools + library).
  const applyLoadedSave = useCallback(
    (entry, nextMode) => {
      if (!entry) return;
      backupProject("Before load").catch(() => {});
      if (entry.tree) setTreeRaw(seedCameraStart(ensureTabs(migrateTree(entry.tree))));
      if (entry.character)
        setCharacter({
          ...DEFAULT_CHARACTER,
          ...entry.character,
          stats: { ...DEFAULT_CHARACTER.stats, ...(entry.character.stats || {}) },
          abilityChoices: entry.character.abilityChoices || {},
          appearance: { ...DEFAULT_CHARACTER.appearance, ...(entry.character.appearance || {}) },
          // Movement switched from feet to spaces: migrate the old 30 ft default.
          ...(entry.character.speed === 30 ? { speed: 6 } : {}),
        });
      if (entry.pools) setPools({ ...DEFAULT_POOLS, ...entry.pools });
      else {
        const zero = levelZeroPointsFor(settings);
        setPools(
          Object.fromEntries(
            Object.entries(zero).map(([id, total]) => [id, { total }])
          )
        );
      }
      if (entry.library) setSettings((s) => ({ ...s, library: mergeLibrary(entry.library) }));
      if (entry.referenceSources) restoreFiveEToolsSources(entry.referenceSources);
      // Homebuilder plots ride with the save: fold them back into the store.
      if (Array.isArray(entry.plots) && entry.plots.length) mergePlots(entry.plots);
      setUi((u) => ({
        ...u,
        selectedNodeId: null,
        editingNodeId: null,
        selectedNodeIds: [],
        selectedConnectionId: null,
        pinnedNodeIds: [],
        pinPositions: {},
      }));
      setSettings((s) => ({ ...s, projectStarted: true }));
      clearDirty();
      enterApp(nextMode || "sheet");
    },
    [enterApp, clearDirty, backupProject, settings]
  );

  // Edits made from the interface mark the project dirty. Loading, New and the
  // initial hydration use the raw setters above, so they stay clean.
  const editCharacter = useCallback(
    (next) => {
      markDirty();
      setCharacter(next);
    },
    [markDirty]
  );
  const editPools = useCallback(
    (next) => {
      markDirty();
      setPools(next);
    },
    [markDirty]
  );
  const editSettings = useCallback(
    (next) => {
      markDirty();
      setSettings(next);
    },
    [markDirty]
  );

  const value = {
    tree,
    mergedTree,
    sideTrees,
    setSideTree,
    nodesById,
    grid,
    mode,
    sheetOnly,
    ui,
    pools,
    character,
    loading,
    settings,
    setSettings: editSettings,
    dirty,
    clearDirty,
    undo,
    redo,
    addBend,
    moveBend,
    removeBend,
    updateConnection,
    setGrid,
    setMode,
    setUi,
    setPools: editPools,
    setCharacter: editCharacter,
    treeFocus,
    focusNode,
    clearTreeFocus,
    updateNode,
    addNode,
    deleteNode,
    deleteNodes,
    deleteConnection,
    rotateNode,
    rotateNodes,
    flipNode,
    toggleDependency,
    invertPrerequisites,
    investPoint,
    moveNodes,
    copyNodes,
    cutNodes,
    pasteClipboard,
    moveNodesToTab,
    importTree,
    resetView,
    setTree,
    enterSubtreeEditor,
    exitSubtreeEditor,
    openSubtreePanel,
    purchaseSubtree,
    setSubtreeNodePoints,
    updateSubtreeInstance,
    loadSharedSubtree,
    unlinkSubtree,
    saveSharedSubtree,
    carry,
    startCarry,
    endCarry,
    dropCarriedOnSubtree,
    dropCarriedOnTab,
    sendNodesToSubtree,
    tabs: tree?.tabs || [],
    activeTabId: tree?.activeTabId || null,
    setActiveTab,
    addTab,
    addImportedTab,
    addImportedTabs,
    renameTab,
    deleteTab,
    patchTab,
    screen,
    setScreen,
    enterApp,
    startNewTree,
    applyLoadedSave,
    backupProject,
    listBackups,
    restoreBackup,
  };

  return (
    <TreeContext.Provider value={value}>
      <ViewSetterContext.Provider value={setView}>
        <ViewContext.Provider value={view}>{children}</ViewContext.Provider>
      </ViewSetterContext.Provider>
    </TreeContext.Provider>
  );
}

export function useTree() {
  const c = useContext(TreeContext);
  if (!c) throw new Error("useTree must be used within TreeProvider");
  return c;
}

// Resolve a resource's value: numeric base + scaling bonuses, or a text formula.
function scaledValue(r, node, vars, profBonus, tagCounts) {
  const raw = String(r.uses ?? r.value ?? "0").trim() || "0";
  const ev = evalResource(raw, vars);
  if (!/^-?\d+(\.\d+)?$/.test(String(ev).trim())) return ev; // text formula: pass through
  const base = parseFloat(ev) || 0;
  const sc = r.scaling || {};
  const per = Number(sc.per) || 0;
  let bonus = 0;
  if (sc.mode === "level") bonus = (vars.level || 1) * per;
  else if (sc.mode === "prof") bonus = profBonus * per;
  else if (sc.mode === "stat") bonus = Math.floor((statOr10(vars[sc.stat]) - 10) / 2) * per;
  else if (sc.mode === "talents") {
    const tag = sc.talentTag || talentTypesOf(node)[0] || "";
    bonus = tag ? (tagCounts[tag] || 0) * per : 0;
  } else if (sc.mode === "taken") bonus = (node?.currentPoints || 0) * per;
  return String(base + bonus);
}

export function talentTypesOf(node) {
  if (Array.isArray(node?.talentTypes) && node.talentTypes.length) {
    return node.talentTypes.map((type) => String(type || "").trim()).filter(Boolean);
  }
  return String(node?.talentType || "")
    .split(/[,;]/)
    .map((type) => type.trim())
    .filter(Boolean);
}

function tagCountsFor(tree) {
  const counts = {};
  tree?.nodes.forEach((n) => {
    if ((n.currentPoints || 0) <= 0) return;
    talentTypesOf(n).forEach((type) => {
      counts[type] = (counts[type] || 0) + 1;
    });
  });
  return counts;
}

// +1 per invested point on Attribute nodes (by node type, regardless of which
// pool pays for them), grouped by the node's attribute.
// Effective ability choices: manual picks (character.abilityChoices) plus
// node-level auto grants (granted on take regardless of the chosen benefit,
// e.g. a detriment) plus options attached to a granted option ("take one,
// get both"). Attachment chains are followed; cycles are guarded. Derived —
// never stored — so refunds remove attached grants automatically.
export function effectiveChoices(character, tree) {
  const choices = {};
  const byId = {};
  const nodes = tree?.nodes || [];
  for (const n of nodes) byId[n.id] = n;
  for (const [id, names] of Object.entries(character?.abilityChoices || {})) {
    if (Array.isArray(names) && names.length) choices[id] = [...names];
  }
  const addChoice = (id, name) => {
    if (!choices[id]) choices[id] = [];
    if (!choices[id].includes(name)) choices[id].push(name);
  };
  const queue = [];
  for (const n of nodes) {
    if ((n.currentPoints || 0) > 0 && Array.isArray(n.grants)) {
      for (const g of n.grants) {
        // A grant that names another node grants that node's chosen option;
        // one with only a name is an ability forced onto this node itself.
        if (g?.nodeId && byId[g.nodeId]) {
          const opts = Array.isArray(byId[g.nodeId].options) ? byId[g.nodeId].options : [];
          const idx = opts.findIndex(
            (o, j) => (o.name || `Benefit ${j + 1}`) === g.optionName
          );
          const name =
            idx >= 0 ? opts[idx].name || `Benefit ${idx + 1}` : g.name || opts[0]?.name;
          if (name) {
            addChoice(g.nodeId, name);
            queue.push({ nodeId: g.nodeId, optionName: name });
          }
        } else if (g?.name) {
          addChoice(n.id, g.name);
          queue.push({ nodeId: n.id, optionName: g.name });
        }
      }
    }
  }
  for (const [id, names] of Object.entries(choices)) {
    for (const name of names) queue.push({ nodeId: id, optionName: name });
  }
  const seen = new Set();
  while (queue.length) {
    const { nodeId, optionName } = queue.shift();
    const key = nodeId + "::" + optionName;
    if (seen.has(key)) continue;
    seen.add(key);
    // Subtree paths ("A > B") chain from their first segment's attachments.
    const opt = ((byId[nodeId] || {}).options || []).find(
      (o) => o.name === optionName || String(optionName).split(" > ")[0] === o.name
    );
    const atts = Array.isArray(opt?.attached) ? opt.attached : [];
    for (const a of atts) {
      if (a?.optionName && byId[a.nodeId]) {
        addChoice(a.nodeId, a.optionName);
        queue.push({ nodeId: a.nodeId, optionName: a.optionName });
      }
    }
  }
  return choices;
}

export function attributeBonuses(tree) {
  const out = {};
  const statKey = (name) => {
    const s = String(name || "").trim().toUpperCase();
    if (["STR", "DEX", "CON", "INT", "WIS", "CHA"].includes(s)) return s;
    return (
      {
        STRENGTH: "STR",
        DEXTERITY: "DEX",
        CONSTITUTION: "CON",
        INTELLIGENCE: "INT",
        WISDOM: "WIS",
        CHARISMA: "CHA",
      }[s] || ""
    );
  };
  const walk = (nodes) => {
    (nodes || []).forEach((n) => {
      if ((n.currentPoints || 0) > 0 && n.nodeType === "attribute" && n.attributeStat) {
        out[n.attributeStat] = (out[n.attributeStat] || 0) + (n.currentPoints || 0);
      }
      if ((n.currentPoints || 0) > 0) {
        (n.benefits || [])
          .filter((b) => b?.category === "attribute")
          .forEach((b) => {
            const key = statKey(b.name);
            if (!key) return;
            const amount = Number(b.value);
            out[key] = (out[key] || 0) + (Number.isFinite(amount) ? amount : 1);
          });
      }
      (n.subtrees || []).forEach((st) => walk(st.nodes));
    });
  };
  walk(tree?.nodes);
  return out;
}

// Character stats including attribute-node bonuses — also feeds formulas.
// Prepend one line to the character's activity log (kept newest first).
export function pushActivityLog(character, text) {
  return {
    ...character,
    activityLog: [{ text, at: new Date().toLocaleTimeString() }, ...(character.activityLog || [])].slice(0, 50),
  };
}

export function statVars(character, tree) {
  const bonuses = attributeBonuses(tree);
  const stats = { ...(character?.stats || {}) };
  Object.entries(bonuses).forEach(([k, v]) => {
    stats[k] = statOr10(stats[k]) + v;
  });
  return stats;
}

// Aggregate all resources from invested nodes + manual entries.
// Numeric contributions stack in .uses (they may be negative); a resource
// with mode "replace" stores its value in .replaced instead. "Equal to"
// entries resolve in a second pass so they can reference any other resource
// regardless of node order.
export function aggregateResources(tree, character, levels = []) {
  const profBonus = profBonusFor(character?.level || 1, levels);
  const stats = statVars(character, tree);
  // Formulas also see each ability's modifier (STRmod…) and the hit die's
  // numeric size (hitDie = 6 for a d6).
  const vars = { level: character.level || 1, ...stats, prof: profBonus };
  STATS.forEach((s) => (vars[s + "mod"] = Math.floor((statOr10(stats[s]) - 10) / 2)));
  vars.hitDie = Number(String(character?.hitDiceSize || "d6").replace(/\D/g, "")) || 6;
  const tagCounts = tagCountsFor(tree);
  const map = new Map();
  const pendingEqual = [];

  // Apply a resolved value: "replace" overrides; anything else stacks.
  const applyResolved = (entry, r, node, value) => {
    const isCT = entry.name === "Creature Type";
    if (Number.isFinite(value.num)) {
      const sc = r.scaling || {};
      const per = Number(sc.per) || 0;
      let bonus = 0;
      if (sc.mode === "level") bonus = (vars.level || 1) * per;
      else if (sc.mode === "prof") bonus = profBonus * per;
      else if (sc.mode === "stat") bonus = Math.floor((statOr10(vars[sc.stat]) - 10) / 2) * per;
      else if (sc.mode === "talents") {
        const tag = sc.talentTag || talentTypesOf(node)[0] || "";
        bonus = tag ? (tagCounts[tag] || 0) * per : 0;
      } else if (sc.mode === "taken") bonus = (node?.currentPoints || 0) * per;
      if (r.mode === "replace") entry.replaced = value.num + bonus;
      else entry.uses += value.num + bonus;
    } else if (r.mode === "replace") {
      entry.replaced = value.text;
      // Creature types: every full replacement is kept, not just the last,
      // so an illithid + zombie pair shows "Aberration Undead".
      if (isCT) entry.typeParts.push({ mode: "replace", text: value.text });
    } else {
      entry.text = entry.text ? `${entry.text} + ${value.text}` : value.text;
      if (isCT && value.text) entry.typeParts.push({ mode: "add", text: value.text });
    }
  };

  const add = (r, node) => {
    if (!r || !r.name) return;
    const key = String(r.name).trim();
    if (!map.has(key))
      map.set(key, {
        name: key,
        color: r.color || "#ffffff",
        uses: 0,
        diceParts: [],
        text: "",
        typeParts: [],
        grant: null,
        replaced: null,
        dieSize: "",
        dieAdjust: 0,
        dieOverride: "",
        recovery: "",
        recoveryAmount: "",
      });
    const entry = map.get(key);
    if (r.color) entry.color = r.color;
    if (r.dieSize) entry.dieSize = r.dieSize;
    // Nodes raise/lower a resource's die by steps and can pin it outright;
    // multiple invested nodes stack their adjustments.
    if (r.dieAdjust) entry.dieAdjust += Number(r.dieAdjust) || 0;
    if (r.dieOverride) entry.dieOverride = r.dieOverride;
    if (r.recovery && r.recovery !== "none") {
      entry.recovery = r.recovery;
      if (r.recoveryAmount) entry.recoveryAmount = r.recoveryAmount;
    }
    // A chosen option can change how this node's resources recover (e.g.
    // long rest → short rest). Choices are stored per invested point in
    // order, so the most recent choice wins — refunding a point reverts to
    // the previous level's choice.
    const chosen = node ? character?.abilityChoices?.[node.id] || [] : [];
    for (const name of chosen) {
      // Choices may be subtree paths ("Archery > Precision") — resolve the
      // final option; a plain name still matches the root list.
      const opt = optionAtPath(node, name);
      if (opt?.recovery && opt.recovery !== "none") {
        entry.recovery = opt.recovery;
        entry.recoveryAmount = opt.recoveryAmount || "";
      }
    }
    if (r.type === "grant") {
      // Grants Talent/Heritage Points (general or for a specific skill/type).
      entry.uses += Number(scaledValue(r, node, vars, profBonus, tagCounts)) || 0;
      entry.grant = {
        pool:
          r.grantPool === "heritage"
            ? "heritage"
            : r.grantPool === "attribute"
            ? "attribute"
            : "talent",
        variant: r.grantVariant || "general",
        name: r.grantName || "",
      };
      return;
    }
    if (r.type === "dice") {
      entry.diceParts.push(`${String(r.uses ?? r.value ?? "0")}×${r.diceSize || "d6"}`);
      return;
    }
    const vt = r.valueType || "flat";
    if (vt === "equal") {
      pendingEqual.push({ key, r, node });
      return;
    }
    const value = resolveResourceValue(r, vars);
    if (value.dice) entry.diceParts.push(value.dice);
    applyResolved(entry, r, node, value);
  };

  tree?.nodes.forEach((n) => {
    if ((n.currentPoints || 0) <= 0) return;
    (n.resources || []).forEach((r, i) => {
      // Toggleable resources apply only while their effect is switched on.
      if (r.toggle && !(character.activeToggles || []).includes(`${n.id}:${i}`)) return;
      add(r, n);
    });
    // Benefits assigned to the node's Resources category are real resources
    // too; a numeric amount stacks into the resource's uses.
    (n.benefits || [])
      .filter((b) => b?.category === "resource" && b.name)
      .forEach((b) =>
        add(
          {
            name: b.name,
            type: "point",
            valueType: "flat",
            uses: Number(b.value) || 1,
            color: "#ffffff",
          },
          n
        )
      );
    (n.benefits || [])
      .filter(
        (b) =>
          b?.category === "stat" &&
          ["Hit Points", "Exertion", "Exhaustion"].includes(String(b.name || "").trim())
      )
      .forEach((b) =>
        add(
          {
            name: String(b.name).trim(),
            type: "point",
            valueType: "flat",
            uses: Number(b.value) || 1,
            color: "#ffffff",
          },
          n
        )
      );
  });
  pendingEqual.forEach(({ key, r, node }) => {
    const entry = map.get(key);
    const value = resolveResourceValue(r, {
      ...vars,
      ...numericResourceMap([...map.values()]),
    });
    applyResolved(entry, r, node, value);
  });
  (character.manualResources || []).forEach((r) =>
    add({ type: "point", valueType: "flat", uses: r.uses ?? r.value, ...r }, null)
  );
  return [...map.values()].map((e) => ({
    ...e,
    value:
      e.replaced != null
        ? String(e.replaced)
        : e.diceParts.length
        ? e.diceParts.join(" + ")
        : e.uses !== 0 || !e.text
        ? String(e.uses)
        : e.text,
  }));
}

// Point currencies granted by invested nodes' "grant" resources (scaled).
export function grantedPoolBonus(tree, character, levels = [], pointTypes = DEFAULT_POINT_TYPES) {
  const types = normalizePointTypes(pointTypes);
  const out = Object.fromEntries(
    types.map((pt) => [pt.id, { general: 0, specific: [] }])
  );
  const profBonus = profBonusFor(character?.level || 1, levels);
  const vars = { level: character.level || 1, ...statVars(character, tree) };
  const tagCounts = tagCountsFor(tree);
  tree?.nodes.forEach((n) => {
    if ((n.currentPoints || 0) <= 0) return;
    (n.resources || []).forEach((r, i) => {
      if (r.type !== "grant") return;
      // Toggleable grants apply only while their effect is switched on.
      if (r.toggle && !(character.activeToggles || []).includes(`${n.id}:${i}`)) return;
      const amt = Number(scaledValue(r, n, vars, profBonus, tagCounts)) || 0;
      const requested = r.grantPool || "talent";
      const pool = out[requested]
        ? requested
        : pointTypeForNodeType(types, requested).id;
      if ((r.grantVariant || "general") === "general") out[pool].general += amt;
      else out[pool].specific.push({ name: r.grantName || "?", amount: amt });
    });
  });
  types.forEach((pt) => {
    out[pt.id].specific = out[pt.id].specific.filter((s) => s.amount !== 0);
  });
  return out;
}

// Proficiency bonus at a level: the Reference Library's row for that level when
// it defines one, otherwise D&D scaling (+2 at 1-4, then +1 every 4 levels).
export function profBonusFor(level, levels = []) {
  const entry = (levels || []).find((l) => Number(l.level) === Number(level));
  if (entry && entry.profBonus != null && entry.profBonus !== "" && Number.isFinite(Number(entry.profBonus)))
    return Number(entry.profBonus);
  return 2 + Math.floor(((level || 1) - 1) / 4);
}

// Points gained on reaching a level: the library row's values when set,
// otherwise the per-level defaults for each configured point type.
export function levelGains(level, settings) {
  const rules = settings?.levelRules || DEFAULT_SETTINGS.levelRules;
  const entry = (settings?.library?.levels || []).find(
    (l) => Number(l.level) === Number(level)
  );
  const num = (v) =>
    v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v);
  const defaults = pointDefaultsFor(settings);
  const points = {};
  pointTypesFor(settings).forEach((pt) => {
    const v = num(entry?.points?.[pt.id] ?? entry?.[`${pt.id}Points`]);
    points[pt.id] = v != null ? v : defaults[pt.id] ?? 0;
  });
  const limit = num(entry?.talentLimit);
  return {
    points,
    talentLimit: limit != null ? limit : Math.max(0, Number(rules.talentLimit) || 0),
  };
}

// Starting point totals at character level 0.
export function levelZeroPoints(settings) {
  return levelZeroPointsFor(settings);
}

// Starting talent budget at character level 0 (legacy helper).
export function levelZeroTalentPoints(settings) {
  return Math.max(0, Number(levelZeroPointsFor(settings).talent) || 0);
}

// Levels granted by invested nodes (including nodes inside host subtrees).
export function grantedLevels(tree) {
  const walk = (nodes) => {
    let sum = 0;
    for (const n of nodes || []) {
      if ((Number(n.currentPoints) || 0) > 0) sum += Math.max(0, Number(n.levelGain) || 0);
      (n.subtrees || []).forEach((st) => {
        sum += walk(st.nodes);
      });
      if (n.subtree) sum += walk(n.subtree.nodes);
    }
    return sum;
  };
  return walk(tree?.nodes);
}

// The level used for tier gates, subtree unlock checks and purchase limits.
export function effectiveCharacterLevel(character, tree) {
  return Math.max(0, (Number(character?.level) || 1) + grantedLevels(tree));
}

// Total talents already bought (each talent counts once, however many points
// are invested). Informative nodes and subtree points are not talent purchases.
export function talentPurchasesUsed(tree, pointTypes = DEFAULT_POINT_TYPES) {
  const seen = new Set();
  let count = 0;
  const walk = (nodes, inSubtree = false) => {
    for (const n of nodes || []) {
      (n.subtrees || []).forEach((st) => walk(st.nodes, true));
      if (inSubtree) continue;
      if ((Number(n.currentPoints) || 0) <= 0) continue;
      if ((n.nodeType || "") === "informative") continue;
      if (poolForNode(n, pointTypes) !== "talent") continue;
      const key = `${String(n.name || "").toLowerCase()}|${String(n.source || "")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      count += 1;
    }
  };
  walk(tree?.nodes);
  return count;
}

// Talents purchasable at a character level: level × the per-level talent limit.
export function talentPurchaseLimit(level, settings) {
  const rules = settings?.levelRules || DEFAULT_SETTINGS.levelRules;
  if (rules.talentLimitEnabled === false) return Infinity;
  const limit = Math.max(0, Number(levelGains(level, settings).talentLimit) || 0);
  return Math.max(0, Math.floor((Number(level) || 0) * limit));
}

// Effective point pools: level-0 starting values + character-sheet rules +
// points granted by nodes, for every configured point type.
export function effectivePools(pools, character, tree, levels = [], settings = null) {
  const profBonus = profBonusFor(character?.level || 1, levels);
  const types = pointTypesFor(settings);
  const zero = levelZeroPointsFor(settings);
  const out = {};
  types.forEach((pt) => {
    const explicit = Number(pools?.[pt.id]?.total);
    out[pt.id] = {
      total: Number.isFinite(explicit) ? explicit : zero[pt.id] ?? 0,
    };
  });
  if (out.heritage) out.heritage.total += character?.smallRaceHeritage ? 1 : 0;
  if (out.talent) {
    out.talent.total += character?.bonusTalentFromProf ? profBonus : 0;
  }
  if (tree) {
    const g = grantedPoolBonus(tree, character, levels, types);
    types.forEach((pt) => {
      out[pt.id].total += g[pt.id]?.general || 0;
    });
    // Plain resource adds that target a point pool by its currency name.
    tree.nodes.forEach((n) => {
      if ((n.currentPoints || 0) <= 0) return;
      (n.resources || []).forEach((r) => {
        if (r.type === "grant" || r.mode === "replace") return;
        const name = String(r?.name || "").trim().toLowerCase();
        const raw = String(r.uses ?? r.value ?? "").trim();
        const num = parseFloat(raw);
        if (!Number.isFinite(num) || !/^-?\d+(\.\d+)?$/.test(raw)) return;
        const pt = types.find(
          (type) =>
            type.currency.toLowerCase() === name ||
            `${type.label} points`.toLowerCase() === name
        );
        if (pt) out[pt.id].total += num;
      });
    });
  }
  out.profBonus = profBonus;
  return out;
}

// Apply a node's proficiency grants to the sheet; repeats stack via "times".
export function applyNodeProficiencies(profs, nodeProfs, delta) {
  const next = {
    skills: [...(profs?.skills || [])],
    tools: [...(profs?.tools || [])],
    languages: [...(profs?.languages || [])],
    instruments: [...(profs?.instruments || [])],
  };
  const keyFor = {
    skill: "skills",
    tool: "tools",
    language: "languages",
    instrument: "instruments",
  };
  (nodeProfs || []).forEach((p) => {
    const key = keyFor[p.type];
    if (!key || !p.name) return;
    const i = next[key].findIndex((e) => (e.name || "") === p.name);
    if (i >= 0) {
      next[key][i] = { ...next[key][i], times: Math.max(0, (next[key][i].times ?? 1) + delta) };
    } else if (delta > 0) {
      next[key].push({ name: p.name, expertise: !!p.expertise, times: 1 });
    }
  });
  Object.keys(next).forEach((k) => {
    next[k] = next[k].filter((e) => e.name && (e.times ?? 1) > 0);
  });
  return next;
}

export function carryCapacity(character, tree = null) {
  const str = Number(character?.stats?.STR) || 0;
  const idx = SIZE_LADDER.indexOf(String(character?.sizeCountAs || "medium").toLowerCase());
  const shifted = Math.min(
    SIZE_LADDER.length - 1,
    Math.max(0, (idx < 0 ? 2 : idx) + (tree ? sizeShift(tree, "Count as Size") : 0))
  );
  const mult = SIZE_MULT[SIZE_LADDER[shifted]] ?? 1;
  return str * 15 * mult;
}

export function totalCoins(coins) {
  return Object.values(coins || {}).reduce((a, b) => a + (Number(b) || 0), 0);
}

// Shop discount (%) granted by invested nodes via a resource named
// "Shop Discount" whose numeric value is the percent; capped at 100.
export function shopDiscount(tree) {
  let disc = 0;
  (tree?.nodes || []).forEach((n) => {
    if ((n.currentPoints || 0) <= 0) return;
    (n.resources || []).forEach((r) => {
      if (String(r?.name || "").trim().toLowerCase() === "shop discount") {
        const num = parseFloat(String(r.uses ?? r.value ?? ""));
        if (Number.isFinite(num)) disc += num;
      }
    });
  });
  return Math.min(100, Math.max(0, disc));
}

// Compute spent points per pool. Each node has a cost (0 = free) per invested
// point; the pool comes from its node type unless overridden on the node.
export function poolUsage(tree, pointTypes = DEFAULT_POINT_TYPES) {
  const types = normalizePointTypes(pointTypes);
  const usage = Object.fromEntries(types.map((pt) => [pt.id, 0]));
  tree?.nodes.forEach((n) => {
    if ((n.currentPoints || 0) > 0) {
      const pool = poolForNode(n, types);
      if (pool && usage[pool] != null)
        usage[pool] += (n.currentPoints || 0) * Math.max(0, Number(n.cost ?? 1) || 0);
    }
  });
  return usage;
}

