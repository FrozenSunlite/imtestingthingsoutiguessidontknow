// Static quick-reference rules tables for the Dungeon Master's Screen.
// Concise 5e summaries — each entry is [name, one-line rule].

export const CONDITIONS = [
  ["Blinded", "Can't see; auto-fail sight checks; attack rolls against you have advantage, yours have disadvantage."],
  ["Charmed", "Can't attack the charmer; the charmer has advantage on social interaction checks with you."],
  ["Deafened", "Can't hear; auto-fail hearing checks."],
  ["Frightened", "Disadvantage while the source of fear is in sight; can't willingly move closer to it."],
  ["Grappled", "Speed becomes 0; ends if the grappler is incapacitated."],
  ["Incapacitated", "Can't take actions or reactions."],
  ["Invisible", "Attacks against you have disadvantage; your attacks have advantage; can't be seen without special sense."],
  ["Paralyzed", "Incapacitated, can't move or speak; auto-fail STR/DEX saves; melee hits are crits."],
  ["Petrified", "Incapacitated, transformed to stone; auto-fail STR/DEX saves; resistance to all damage."],
  ["Poisoned", "Disadvantage on attack rolls and ability checks."],
  ["Prone", "Disadvantage on attacks; melee attacks against you have advantage, ranged have disadvantage; half movement to stand."],
  ["Restrained", "Speed 0; disadvantage on attacks and DEX saves; attacks against you have advantage."],
  ["Stunned", "Incapacitated, auto-fail STR/DEX saves; attacks against you have advantage."],
  ["Unconscious", "Incapacitated, can't move or speak, unaware; auto-fail STR/DEX saves; melee hits are crits."],
];

export const ACTIONS_IN_COMBAT = [
  ["Attack", "Make one melee or ranged weapon or spell attack."],
  ["Cast a Spell", "Cast a spell with a casting time of 1 action."],
  ["Dash", "Move again up to your speed."],
  ["Disengage", "Your movement doesn't provoke opportunity attacks this turn."],
  ["Dodge", "Attacks against you have disadvantage; DEX saves you make have advantage until your next turn."],
  ["Help", "Give an ally advantage on their next attack or ability check against a target."],
  ["Hide", "Make a Stealth check against passive Perception."],
  ["Ready", "Prepare an action to trigger on a circumstance as a reaction."],
  ["Search", "Look for something hidden."],
  ["Use an Object", "Interact with a second object or use an item's ability."],
  ["Bonus action", "One bonus action per turn, if a feature grants one."],
  ["Reaction", "One reaction per round, e.g. an opportunity attack when an enemy leaves your reach."],
  ["Interact", "One free object interaction per turn, e.g. draw a weapon."],
];

export const COVER = [
  ["Half cover", "+2 AC and DEX saving throws — a low wall, furniture, another creature."],
  ["Three-quarters cover", "+5 AC and DEX saving throws — an arrow slit, an arrow loop."],
  ["Total cover", "Can't be targeted directly by an attack or spell."],
];

export const RESTING = [
  ["Short rest", "1 hour of light activity: spend Hit Dice to heal, use some class features."],
  ["Long rest", "8 hours, no more than 1 hour of light activity: regain all HP, half spent Hit Dice, finish a long-rest feature. 24 hours of work between long rests."],
  ["Forced march", "Each hour beyond 8 hours of travel: CON save vs DC 10 + hours traveled, or gain exhaustion."],
];

export const DEATH_AND_DYING = [
  ["Dropping to 0 HP", "Instant death only if damage ≥ max HP + current HP; otherwise unconscious and dying."],
  ["Death saving throws", "At the start of your turn: d20 ≥ 10 is a success, below 10 a failure; three failures die, three successes stabilize. 20 = regain 1 HP; 1 = two failures."],
  ["Damage while dying", "Any hit causes one automatic failure; a critical hit causes two."],
  ["Stabilizing", "A DC 10 Medicine check or any magical healing stops the dying."],
  ["Mending wounds", "Regain 1 HP with any healing to wake up; you stay prone."],
];

export const EXHAUSTION = [
  ["1", "Disadvantage on ability checks"],
  ["2", "Speed halved"],
  ["3", "Disadvantage on attack rolls and saving throws"],
  ["4", "Hit point maximum halved"],
  ["5", "Speed reduced to 0"],
  ["6", "Death"],
];