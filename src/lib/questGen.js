import { makeRng } from "@/lib/worldNames";
import { BIOMES, kingdomForNation } from "@/lib/worldGen";

const QUEST_TYPES = [
  {
    id: "hunt",
    label: "Monster Hunt",
    weight: 3,
    titles: ["The {monster} of {place}", "Hunt for the {monster}", "Blood on the {biome}"],
    objectives: [
      "Track and defeat the {monster} preying on travellers near {place}.",
      "Clear the {monster} from the {biome} around {place}.",
      "Bring back proof that the {monster} is dead.",
    ],
  },
  {
    id: "delve",
    label: "Dungeon Delve",
    weight: 3,
    titles: ["The {place} Depths", "Beneath {place}", "The Sealed {place}"],
    objectives: [
      "Explore the ruin beneath {place} and recover the {item}.",
      "Map the tunnels under {place} and return alive.",
      "Break the seal in the {place} dungeon and destroy what waits inside.",
    ],
  },
  {
    id: "escort",
    label: "Escort",
    weight: 2,
    titles: ["Road to {place}", "The {place} Caravan", "Safe Passage"],
    objectives: [
      "Escort {patron} and their cargo safely to {place}.",
      "Guide a caravan from {place} to the capital without losing the goods.",
      "Protect a witness travelling to {place}.",
    ],
  },
  {
    id: "retrieve",
    label: "Retrieve",
    weight: 3,
    titles: ["The Lost {item}", "Recover the {item}", "A Debt of {item}"],
    objectives: [
      "Recover the stolen {item} from the {biome} near {place}.",
      "Find the missing {item} before it leaves the region.",
      "Retrieve the {item} from a rival without starting a war.",
    ],
  },
  {
    id: "investigate",
    label: "Investigate",
    weight: 2,
    titles: ["The {place} Mystery", "Whispers in {place}", "The Vanishing"],
    objectives: [
      "Find out why people are disappearing around {place}.",
      "Investigate the strange lights reported in the {biome}.",
      "Uncover who is spreading unrest in {place}.",
    ],
  },
  {
    id: "diplomacy",
    label: "Diplomacy",
    weight: 2,
    titles: ["The {place} Accord", "Words Before Steel", "An Unquiet Peace"],
    objectives: [
      "Carry terms from {patron} to {place} and secure a meeting.",
      "Prevent a border dispute with {nation} from becoming a war.",
      "Negotiate the release of prisoners held at {place}.",
    ],
  },
  {
    id: "trade",
    label: "Trade",
    weight: 2,
    titles: ["The {place} Contract", "A Matter of Supply", "Coin and Caravans"],
    objectives: [
      "Open a trade route between {place} and the capital.",
      "Find out why shipments to {place} keep disappearing.",
      "Deliver seed and tools to {place} before the planting season ends.",
    ],
  },
  {
    id: "defense",
    label: "Defense",
    weight: 2,
    titles: ["Hold {place}", "The Coming Raid", "Walls of {place}"],
    objectives: [
      "Defend {place} from a raid out of the {biome}.",
      "Repair the watchtower and organise the militia at {place}.",
      "Break the siege lines around {place}.",
    ],
  },
  {
    id: "harvest",
    label: "Harvest",
    weight: 1,
    titles: ["The {item} Harvest", "Gathering at {place}", "Root and Reagent"],
    objectives: [
      "Gather {item} from the {biome} without waking its guardians.",
      "Find a reliable supply of {item} for the settlement.",
      "Escort the harvesters into the {biome} and back.",
    ],
  },
];

const MONSTERS = [
  "bandit captain", "gnoll pack", "giant spider", "ogre", "wyvern", "wight",
  "manticore", "troll", "basilisk", "young dragon", "behir", "chimera",
  "wraith", "vampire spawn", "golem", "elemental", "drake", "hag",
];

const ITEMS = [
  "sealed ledger", "silver reliquary", "mining charter", "ancestral blade",
  "merchant's seal", "stolen icon", "star chart", "healer's chest",
  "noble's signet", "missing caravan strongbox", "ancient seed",
];

const COMPLICATIONS = [
  "A rival party is already looking for the same thing.",
  "The patron is hiding the real reason for the job.",
  "A local official wants the quest to fail.",
  "The target is protected by someone who does not know the truth.",
  "The weather turns before the party reaches the site.",
  "One of the rewards is counterfeit or stolen.",
  "A monster in the area is smarter than it looks.",
  "The route crosses a kingdom that is looking for the party.",
];

const REWARD_ITEMS = [
  "Potion of Healing", "Spell scroll (1st level)", "Silvered weapon",
  "A favour from the patron", "A small land grant", "A guild introduction",
];

// Coherent step chains: the opener, the road, the goal, then the return. The
// goal step always matches the chosen objective so a quest never asks for an
// item that was never introduced.
function stepsForQuest(typeId, variant, fill) {
  const opener = fill(
    ["Speak with {patron} in {settlement}.", "Meet the contact at the {settlement} gate.", "Study the reports in {settlement}."][
      variant % 3
    ]
  );
  const road = fill(
    ["Travel to {place} and find the trail.", "Reach the {biome} without being seen.", "Interview witnesses around {place}."][
      variant % 3
    ]
  );
  const returnStep = fill(
    ["Report back to {patron} in {settlement}.", "Bring proof to the {settlement} hall.", "Return to {patron} with the news."][
      variant % 3
    ]
  );
  switch (typeId) {
    case "hunt":
      return [
        opener,
        road,
        fill(variant === 1 ? "Clear the {monster} from the {biome}." : "Confront and defeat the {monster}."),
        fill("Bring proof of the {monster}'s death back to {patron} in {settlement}."),
      ];
    case "delve":
      return [
        opener,
        fill("Travel to {place} and find the entrance."),
        fill(
          variant === 0
            ? "Explore the ruin and recover the {item}."
            : variant === 1
              ? "Map the tunnels beneath {place} and return alive."
              : "Break the seal and destroy what waits inside."
        ),
        variant === 0 ? fill("Bring the {item} back to {patron} in {settlement}.") : returnStep,
      ];
    case "escort":
      return [
        opener,
        fill("Prepare the caravan and leave {settlement} for {place}."),
        fill("Protect the cargo and travellers through the {biome}."),
        fill("Deliver the caravan safely to {place} and report to {patron}."),
      ];
    case "retrieve":
      return [
        opener,
        fill("Travel to {place} and search the {biome}."),
        fill(
          variant === 0
            ? "Recover the stolen {item} from the {biome} near {place}."
            : variant === 1
              ? "Find the missing {item} before it leaves the region."
              : "Retrieve the {item} from the rival without starting a war."
        ),
        fill("Return the {item} to {patron} in {settlement}."),
      ];
    case "investigate":
      return [
        opener,
        fill("Interview witnesses and study the reports in {settlement}."),
        fill(
          variant === 0
            ? "Find out why people are disappearing around {place}."
            : variant === 1
              ? "Investigate the strange lights in the {biome}."
              : "Uncover who is spreading unrest in {place}."
        ),
        fill("Confront the culprit and report to {patron} in {settlement}."),
      ];
    case "diplomacy":
      return [
        opener,
        fill("Travel to {place} with the patron's terms."),
        fill(
          variant === 0
            ? "Secure a meeting with the {place} council."
            : variant === 1
              ? "Prevent the border dispute from becoming a war."
              : "Negotiate the release of the prisoners held at {place}."
        ),
        returnStep,
      ];
    case "trade":
      return [
        opener,
        fill("Travel to {place} and inspect the route."),
        fill(
          variant === 0
            ? "Open the trade route between {place} and the capital."
            : variant === 1
              ? "Find out why shipments to {place} keep disappearing."
              : "Deliver seed and tools to {place} before the planting season ends."
        ),
        fill("Return to {patron} in {settlement} with the signed contract."),
      ];
    case "defense":
      return [
        opener,
        fill("Reach {place} and inspect its defences."),
        fill(
          variant === 0
            ? "Defend {place} from the raid out of the {biome}."
            : variant === 1
              ? "Repair the watchtower and organise the militia at {place}."
              : "Break the siege lines around {place}."
        ),
        returnStep,
      ];
    case "harvest":
      return [
        opener,
        fill("Travel into the {biome} near {place}."),
        fill(
          variant === 0
            ? "Gather the {item} without waking its guardians."
            : variant === 1
              ? "Find a reliable supply of the {item} for the settlement."
              : "Escort the harvesters into the {biome} and back."
        ),
        fill("Bring the harvest to {patron} in {settlement}."),
      ];
    default:
      return [opener, road, fill("Complete the task at {place}."), returnStep];
  }
}

export function generateQuest(world, { level = 1, seed = "", patronId = "" } = {}) {
  const rng = makeRng(`${world?.id}:${seed || Date.now()}:${Math.random()}`);
  const settlements = world?.settlements || [];
  if (!settlements.length) return null;
  const type = (() => {
    const pool = QUEST_TYPES.flatMap((q) => Array.from({ length: q.weight }, () => q));
    return rng.pick(pool);
  })();
  const patron =
    (world?.npcs || []).find((npc) => npc.id === patronId) ||
    rng.pick((world?.npcs || []).filter((npc) => npc.role !== "ruler" && npc.role !== "court")) ||
    null;
  const settlement = settlements.find((s) => s.id === patron?.settlementId) || rng.pick(settlements);
  const targetSettlement = rng.pick(settlements.filter((s) => s.id !== settlement.id)) || settlement;
  const nation = world?.nations?.find((n) => n.id === settlement.nationId);
  const kingdom = kingdomForNation(world, settlement.nationId);
  const biome = BIOMES.find((b) => b.id === settlement.biome) || BIOMES[0];
  const monster = rng.pick(MONSTERS);
  const item = rng.pick(ITEMS);
  const replacements = {
    monster,
    item,
    place: targetSettlement.name,
    settlement: settlement.name,
    biome: biome.label,
    nation: world?.nations?.find((n) => n.id === targetSettlement.nationId)?.name || nation?.name || "the region",
    patron: patron?.name || "the patron",
  };
  const fill = (text) =>
    String(text || "").replace(/\{(\w+)\}/g, (_, key) => replacements[key] ?? `{${key}}`);
  const difficulty = Math.max(1, Math.min(20, Number(level) + rng.int(-1, 2)));
  const tier = difficulty <= 4 ? "local" : difficulty <= 8 ? "regional" : difficulty <= 12 ? "kingdom" : difficulty <= 16 ? "national" : "legendary";
  const rewardGold = Math.round((100 + difficulty * 75) * (1 + rng.rand() * 0.4));
  const objective = rng.pick(type.objectives);
  const variant = Math.max(0, type.objectives.indexOf(objective));
  const objectiveText = fill(objective);
  const steps = stepsForQuest(type.id, variant, fill);
  const quest = {
    id: `quest_${Date.now().toString(36)}_${Math.floor(rng.rand() * 1e5).toString(36)}`,
    title: fill(rng.pick(type.titles)),
    type: type.id,
    typeLabel: type.label,
    status: "available",
    patronId: patron?.id || "",
    patronName: patron?.name || "A local patron",
    patronOccupation: patron?.occupation || "Patron",
    settlementId: settlement.id,
    settlementName: settlement.name,
    targetSettlementId: targetSettlement.id,
    targetSettlementName: targetSettlement.name,
    nationId: settlement.nationId,
    nationName: nation?.name || "",
    kingdomId: kingdom?.id || "",
    biome: biome.id,
    biomeLabel: biome.label,
    level: difficulty,
    tier,
    objective: objectiveText,
    description: fill(
      `${patron?.name || "A patron"} needs help. ${objectiveText} ` +
        `The work is expected to suit a party around level ${difficulty}.`
    ),
    complication: rng.pick(COMPLICATIONS),
    rewardGold,
    rewardItems: rng.chance(0.35) ? [rng.pick(REWARD_ITEMS)] : [],
    steps,
    stepIndex: 0,
    encounterTable: `${monster} · level ${Math.min(20, difficulty)}`,
    createdAt: new Date().toISOString(),
    completedAt: "",
  };
  return quest;
}

export function generateQuestBoard(world, { count = 8, level = 1 } = {}) {
  const quests = [];
  for (let i = 0; i < count; i += 1) {
    const quest = generateQuest(world, { level, seed: `board-${i}` });
    if (quest) quests.push(quest);
  }
  return quests;
}

export function acceptQuest(world, questId) {
  const quests = (world?.quests || []).map((quest) =>
    quest.id === questId ? { ...quest, status: "active", acceptedAt: new Date().toISOString() } : quest
  );
  return { ...world, quests, logs: [...(world?.logs || []), { at: new Date().toISOString(), text: `Accepted quest: ${quests.find((q) => q.id === questId)?.title}` }] };
}

export function advanceQuest(world, questId) {
  const quests = (world?.quests || []).map((quest) => {
    if (quest.id !== questId) return quest;
    const stepIndex = Math.min(quest.steps.length - 1, (quest.stepIndex || 0) + 1);
    return { ...quest, stepIndex, status: stepIndex >= quest.steps.length - 1 ? "ready" : quest.status };
  });
  const quest = quests.find((q) => q.id === questId);
  return { ...world, quests, logs: [...(world?.logs || []), { at: new Date().toISOString(), text: `Quest advanced: ${quest?.title}` }] };
}

export function completeQuest(world, questId) {
  let reward = null;
  const quests = (world?.quests || []).map((quest) => {
    if (quest.id !== questId) return quest;
    reward = { gold: quest.rewardGold || 0, items: [...(quest.rewardItems || [])] };
    return { ...quest, status: "complete", completedAt: new Date().toISOString() };
  });
  return {
    ...world,
    quests,
    logs: [...(world?.logs || []), { at: new Date().toISOString(), text: `Completed quest: ${quests.find((q) => q.id === questId)?.title} (${reward?.gold || 0} gold)` }],
  };
}

export function questsForSettlement(world, settlementId) {
  return (world?.quests || []).filter(
    (quest) => quest.settlementId === settlementId || quest.targetSettlementId === settlementId
  );
}

export function questDifficultyForEncounter(quest) {
  return Math.max(1, Math.min(30, Number(quest?.level) || 1));
}

export function crBandForQuest(quest) {
  const level = questDifficultyForEncounter(quest);
  return { min: Math.max(0, level - 3), max: level + 1, level };
}

export function questTypeOptions() {
  return QUEST_TYPES.map((q) => ({ id: q.id, label: q.label }));
}
