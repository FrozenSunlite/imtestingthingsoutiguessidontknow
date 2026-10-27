// Bastion special-facility orders: the order each facility takes on a Bastion
// turn and what issuing it does (DMG'24 core facilities, plus the facility
// sets from Forgotten Realms: Heroes of Faerûn, Eberron: Forge of the
// Artificer, Ravenloft: The Horrors Within and Arcana Unleashed — level-gated
// only, their membership / renown prerequisites are cut for homebrew play).

export const BASTION_ORDERS = {
  "Amethyst Dragon Den": {
    "order": "Empower",
    "effect": "When you issue the Empower order to this facility, latent draconic power fills the facility, allowing you to train in psionic combat. This training takes 8 hours per day for 7 days, after which you gain Resistance to Psychic damage. This benefit lasts for 7 days.",
    "fixed": "Forgotten Realms"
  },
  "Ancient Altar": {
    "order": "Empower",
    "effect": "You commission your hireling to lead a ritual that takes 7 days, during which time you must remain in the Bastion. At the end of the ritual, you must offer a worthy sacrifice, which can be monetary (1,000 GP) or blood (the fresh corpse of at least one Large creature or four Medium creatures that aren't Constructs or Undead). If you make a blood sacrifice, roll on the Bastion Hauntings table. Once the ritual is complete, the sacrifice is destroyed. Choose a Haunted special facility in this Bastion or in a Bastion…",
    "fixed": "Ravenloft"
  },
  "Arcane Study": {
    "order": "Craft",
    "effect": "Craft an Arcane Focus (7 days, free), a blank book (7 days, 10 gp), or — at level 9+ — a Common or Uncommon magic item from the Arcana tables.",
    "fixed": "DMG'24"
  },
  "Archive": {
    "order": "Research",
    "effect": "When you issue the Research order to this facility, you commission the facility's hireling to search the Archive for helpful lore. The work takes 7 days. The hireling gains knowledge as if they had cast the Legend Lore spell, then shares this knowledge with you the next time you speak with them.",
    "fixed": "DMG'24"
  },
  "Armory": {
    "order": "Trade",
    "effect": "When you issue the Trade order to this facility, you commission the facility's hireling to stock the Armory with armor, Shield, weapons, and ammunition. This equipment costs you 100 GP plus an extra 100 GP for each Bastion Defender in your Bastion. If your Bastion has a Smithy, the total cost is halved. While your Armory is stocked, your Bastion Defenders are harder to kill. When any event causes you to roll dice to determine if your Bastion loses one or more of its defenders (see \"Bastion Events\" at the end of…",
    "fixed": "DMG'24"
  },
  "Artificer's Forge": {
    "order": "Craft",
    "effect": "When you issue the Craft order to this facility, you commission the facility's hirelings to craft a Common or an Uncommon magic item chosen by you from the Dungeon Master's Guide. The facility has the tool required to craft the item, and the hirelings have proficiency with that tool as well as proficiency in the Arcana skill. The two hirelings assist each other, reducing the time required to craft the item. If the item allows its user to cast any spells from it, the hirelings have those spells prepared.",
    "fixed": "Eberron"
  },
  "Barrack": {
    "order": "Recruit",
    "effect": "Each time you issue the Recruit order to this facility, up to four Bastion Defenders are recruited to your Bastion and assigned quarters in this Barrack. The recruitment costs no money. You can't issue the Recruit order to this facility if it's fully occupied. Keep track of the Bastion Defenders housed in each of your Barracks. If you lose Bastion Defenders, deduct them from your roster. Assign names and personalities to your Bastion Defenders as you see fit.",
    "fixed": "DMG'24"
  },
  "Cabinet of Curiosities": {
    "order": "Trade",
    "effect": "When you issue the Trade order to this facility, you supply this facility's hireling with a certain amount of gold and commission them to purchase strange items from unusual sources. It takes 28 days for the hireling to return to the Bastion with one or more magic items for you. Your investment determines the rarity of these items, and the quantity of magic items depends on the number of Haunted special facilities in your Bastion at the time of the hireling's return, as shown on the Curio Investment and Curios…",
    "fixed": "Ravenloft"
  },
  "Circus Tent": {
    "order": "Trade",
    "effect": "When you issue the Trade order to this facility, the facility's hirelings turn the Circus Tent into a performance venue for 7 days. At the end of the seventh day, your portion of the proceeds is equal to 2d6 × 10 GP.",
    "fixed": "Arcana Unleashed"
  },
  "Construct Forge": {
    "order": "Recruit",
    "effect": "When you issue the Recruit order to this facility, you commission the facility's hirelings to craft a Construct from the Forge Constructs table. The construction takes the time and costs you the amount listed in the table. Constructs made in this facility count as Bastion Defenders. Deduct any you lose from your Bastion Defenders roster. You can choose not to count one or more of these creatures as Bastion Defenders, in which case they can't be called on to defend the Bastion. Instead, they act in accordance with…",
    "fixed": "Eberron"
  },
  "Cult of the Dragon Archive": {
    "order": "Research",
    "effect": "When you issue the Research order to this facility, you commission the facility's hireling to search the archive for lore. The work takes 7 days. The hireling gains knowledge as if they had cast the Legend Lore spell, then shares this knowledge with you the next time you speak with them.",
    "fixed": "Forgotten Realms"
  },
  "Demiplane": {
    "order": "Empower",
    "effect": "When you issue the Empower order to this facility, magical runes appear on the Demiplane's walls and last for 7 days. Until the runes disappear, you gain Temporary Hit Points equal to five times your level after spending an entire Long Rest in the Demiplane.",
    "fixed": "DMG'24"
  },
  "Dragonmark Outpost": {
    "order": "Empower",
    "effect": "When you issue the Empower order to this facility, you instruct your hireling to call in a favor from your dragonmarked house. You can use any benefit of your house that your Renown Score affords you (as described in chapter 5), and this favor doesn't count against the total number of favors available to you. Once you use this feature, you can't use it again until your Renown Score with your house increases.",
    "fixed": "Eberron"
  },
  "Emerald Enclave Grove": {
    "order": "Recruit",
    "effect": "When you issue the Recruit order to this facility, you invite a creature from the Emerald Enclave Grove Creatures table to your Emerald Enclave Grove. Roll any die. If the number rolled is odd, the creature doesn't accept your invitation and you gain no benefit from having issued the order. If the number rolled is even, a creature accepts your invitation and moves into your Emerald Enclave Grove after 7 days. Your hirelings care for the creature and perform upkeep in the facility. Creatures in your Emerald Enclave…",
    "fixed": "Forgotten Realms"
  },
  "Entertainment Salon": {
    "order": "Research",
    "effect": "When you issue the Research order to this facility, you direct the facility's hirelings to entertain well-informed contacts and learn about a specific creature you name within 50 miles of your Bastion. After 7 days of work, the hirelings gain 1d4 facts about the named creature that aren't widely known and might be amusing, embarrassing, or useful. The hirelings also discover the creature's power relative to yours (such as whether the creature's CR is higher than, lower than, or the same as your level). At the DM's…",
    "fixed": "Arcana Unleashed"
  },
  "Gaming Hall": {
    "order": "Trade",
    "effect": "When you issue the Trade order to this facility, the facility's hirelings turn the Gaming Hall into a gambling den for 7 days. At the end of the seventh day, roll 1d100 and consult the following table to determine your portion of the house's winnings.",
    "fixed": "DMG'24"
  },
  "Garden": {
    "order": "Harvest",
    "effect": "When you issue the Harvest order to this facility, you commission the facility's hireling to collect items from the Garden as noted in the Garden Types table. The work takes 7 days and costs no money.",
    "fixed": "DMG'24"
  },
  "Geothermal Vent": {
    "order": "Empower",
    "effect": "When you issue the Empower order to this facility, for the next 7 days, the facility's hireling teaches a series of meditative techniques that allow a character to mitigate the injuries they suffer from flames. Any character who trains here for at least 8 hours on each of those days gains the following benefit at the end of the training period:",
    "fixed": "Arcana Unleashed"
  },
  "Greenhouse": {
    "order": "Harvest",
    "effect": "Harvest: grow a Potion of Healing (greater) from healing herbs (7 days, 25 gp), or extract one application of a poison from rare plants or fungi (7 days, cost listed per poison).",
    "fixed": "DMG'24"
  },
  "Guildhall": {
    "order": "Recruit",
    "effect": "Each time you issue the Recruit order to this facility, you commission the facility's hireling to recruit guild members to perform a special assignment. Each guild in the Sample Guilds table specifies the nature of that assignment. With your DM's permission and help, you can create new assignments for guild members to complete.",
    "fixed": "DMG'24"
  },
  "Harper Hideout": {
    "order": "Empower",
    "effect": "When you issue the Empower order to this facility, the facility's hireling extends an invitation to another Harper agent nearby. Roll any die. If the number is odd, no Harper needs your facility and you gain no benefit from having issued the order. If the number rolled is even, a Friendly [Attitude] Harper takes up temporary residence in your hideout. The Harper stays for 7 days. While at your Bastion, the Harper can share their knowledge. Any character who trains with the Harper here for at least 8 hours on each…",
    "fixed": "Forgotten Realms"
  },
  "Heist Planning Chamber": {
    "order": "Research",
    "effect": "When you issue the Research order to this facility, your hireling sends spies to evaluate a building within 50 miles of your Bastion. This work takes 7 days. At the end of the seventh day, the hireling provides a model of the building on the planning table. Public areas of the building are depicted accurately, and private areas are depicted only generally. Any area concealed by magic or protected by powerful guardians, at the DM's discretion, might not be depicted accurately or at all. The spies avoid all…",
    "fixed": "Arcana Unleashed"
  },
  "Infirmary": {
    "order": "Craft",
    "effect": "Craft two vials of Antitoxin (7 days, free — 50/100 gp enhances one or both), or enhance up to two Potions of Healing into Potions of Healing (greater) (14 days; superior at level 13+).",
    "fixed": "Ravenloft"
  },
  "Inquisitive Agency": {
    "order": "Research",
    "effect": "When you issue the Research order to this facility, you commission the agency's secretary to gather information from contacts and agents regarding a specific individual you designate, assembling a comprehensive picture of that person's activities during the previous 7 days and over the course of the next 7 days, within 10 miles of your Bastion. Unless the DM deems that certain information is beyond these agents' ability to uncover, you learn the following information: If your Bastion is mobile, it takes time to…",
    "fixed": "Eberron"
  },
  "Kundarak Vault": {
    "order": "Trade",
    "effect": "When you issue the Trade order to this facility, its hireling spends the next 7 days procuring nonmagical items that have a total value of 2,000 GP or less and stores them in the Kundarak Vault, or the hireling uses those 7 days to sell goods in the Kundarak Vault. You bear the total cost of any purchases, and the maximum value of the items purchased increases to 5,000 GP when you reach level 13. When you sell goods from your Kundarak Vault, the buyer pays you 20 percent more than the standard price; this profit…",
    "fixed": "Eberron"
  },
  "Laboratory": {
    "order": "Craft",
    "effect": "Craft anything made with Alchemist's Supplies per the PHB crafting rules, or a vial of one chosen poison. Potions and other consumables take half the usual time and cost half the gold.",
    "fixed": "DMG'24"
  },
  "Library": {
    "order": "Research",
    "effect": "When you issue the Research order to this facility, you commission the facility's hireling to research a topic. The topic can be a legend, a known event or location, a person of significance, a type of creature, or a famous object. The work takes 7 days. When the research concludes, the hireling obtains up to three accurate pieces of information about the topic that were previously unknown to you and shares this knowledge with you the next time you speak with them. The DM determines what information you learn.",
    "fixed": "DMG'24"
  },
  "Lighthouse": {
    "order": "Harvest",
    "effect": "When you issue the Harvest order to this facility, you instruct the facility's hireling to watch the surrounding area for lost or discarded valuables. The hireling watches for 7 days. At the end of that time, you can hire salvagers to retrieve treasures your hireling spotted. You must spend 100 GP to hire the salvagers, who return with treasure worth 1d4 × 100 GP.",
    "fixed": "Arcana Unleashed"
  },
  "Lightning Generator": {
    "order": "Empower",
    "effect": "The facility's hireling channels the Generator's energy to cast Animate Objects, targeting one Large or Huge object of your choice in the Bastion. The spell's duration is 7 days and doesn't require Concentration.",
    "fixed": "Ravenloft"
  },
  "Liminal Space": {
    "order": "Recruit",
    "effect": "When you issue the Recruit order to this facility, you instruct the facility's hireling to conduct a ritual and petition an entity from the demiplane for aid. This ritual takes 7 days and costs 1,000 GP. At the ritual's end, roll any die. On an odd number, the summoned entity refuses your request and kills the hireling, and this facility can't be used until your next Bastion turn, at which point the hireling is replaced at no cost to you; on an even number, the summoned entity agrees to your request and takes up…",
    "fixed": "Ravenloft"
  },
  "Lords' Alliance Noble Residence": {
    "order": "Recruit",
    "effect": "When you issue the Recruit order to your Lords' Alliance Noble Residence, you forgo sleeping in it for 14 days and instead make it available to a noble from a settlement that is a member of the Lords' Alliance. Roll any die. If the number rolled is odd, no one accepts your invitation and you gain no benefit from having issued the order. If the number rolled is even, a noble from the settlement you chose accepts your invitation, arriving within 7 days and staying for another 7 days. The visiting noble gossips about…",
    "fixed": "Forgotten Realms"
  },
  "Lyrandar Helm": {
    "order": "Empower",
    "effect": "When you issue the Empower order to this facility, you instruct its hireling to pilot the Bastion to a destination you specify. The Bastion travels at the vehicle's speed, 8 hours per day, for the duration of the Bastion turn. The Bastion stops early when it reaches the specified destination or if something happens to stop your travel. When you issue the Empower order to this facility, the DM rolls on the Bastion Events table as if you had issued the Maintain order to your Bastion.",
    "fixed": "Eberron"
  },
  "Manifest Zone": {
    "order": "Empower",
    "effect": "When you issue the Empower order to this facility, the facility's hireling conducts magical rites for the next 7 days. At the end of that period, you gain a special Charm (see \"Supernatural Gifts\" in the Dungeon Master's Guide) called a Manifest Charm, which lasts until you use it. You don't need to be in the Bastion while the rites are performed to gain their benefit. The effects of the Charm depend on the facility's linked plane: If your Bastion is mobile, its connection to the linked plane of existence is…",
    "fixed": "Eberron"
  },
  "Meditation Chamber": {
    "order": "Empower",
    "effect": "When you issue the Empower order to this facility, your Bastion's hirelings can use the Meditation Chamber to gain a measure of inner peace. The next time you roll for a Bastion event, you can roll twice and choose either result.",
    "fixed": "DMG'24"
  },
  "Menagerie": {
    "order": "Recruit",
    "effect": "When you issue the Recruit order to this facility, you commission the facility's hirelings to add a creature from the Menagerie Creatures table to your Menagerie. The recruitment takes 7 days and costs you the amount listed in the table. The hirelings look after the creature. Creatures in your Menagerie count as Bastion Defenders. Deduct any you lose from your Bastion Defenders roster. You can choose not to count one or more of these creatures as Bastion Defenders, in which case they can't be called on to defend…",
    "fixed": "DMG'24"
  },
  "Morgue": {
    "order": "Research",
    "effect": "When you issue the Research order to this facility, you instruct the facility's hireling to carefully inspect the corpses. This work takes 7 days. The next time you speak with the hireling, the hireling can share the cause of death of each corpse present and answer one question you have for each corpse as though the hireling had cast the Speak with Dead spell on it.",
    "fixed": "Arcana Unleashed"
  },
  "Museum": {
    "order": "Research",
    "effect": "When you issue the Research order to this facility, you commission the hireling to study particular treasures in the museum. The work takes 7 days. The hireling gains knowledge regarding some question of ancient history as if they had cast the Legend Lore spell, then shares this knowledge with you the next time you speak with them.",
    "fixed": "Eberron"
  },
  "Navigator's Helm": {
    "order": "Empower",
    "effect": "When you issue the Empower order to this facility, you instruct its hireling to pilot the Bastion to a destination you specify. The Bastion sails at the vehicle's speed, 8 hours per day, for the duration of the Bastion turn. The Bastion stops early when it reaches the specified destination or if something happens to stop your travel. When you issue the Empower order to this facility, the DM rolls on the Bastion Events table as if you had issued the Maintain order to your Bastion.",
    "fixed": "Eberron"
  },
  "Observatory": {
    "order": "Empower",
    "effect": "When you issue the Empower order to this facility, you enable yourself or the facility's hireling to explore the eldritch mysteries of the stars for 7 consecutive nights. At the end of that time, roll a die. If the number rolled is even, nothing is gained. If the number rolled is odd, an unknown power bestows one of the following Charms on you or another creature of your choice that is on the same plane of existence as you: Charm of Darkvision, Charm of Heroism, or Charm of Vitality (all described in chapter 3).",
    "fixed": "DMG'24"
  },
  "Order of the Gauntlet Tournament Field": {
    "order": "Empower",
    "effect": "When you issue the Empower order to this facility, you host a tournament at your Bastion. It takes 7 days for word of the tournament to spread to nearby settlements, and another 7 days for contestants to travel to your Bastion and participate in the tournament. You must spend 2,000 GP for prizes. At the conclusion of the tournament, your Renown Score with the Order of the Gauntlet increases by 1.",
    "fixed": "Forgotten Realms"
  },
  "Orien Helm": {
    "order": "Empower",
    "effect": "When you issue the Empower order to this facility, you instruct its hireling to pilot the Bastion to a destination you specify. The Bastion travels at a rate of 30 miles per hour, 8 hours per day, along an existing route of conductor stones for the duration of the Bastion turn. The Bastion stops early when it reaches the specified destination or if something happens to stop your travel. When you issue the Empower order to this facility, the DM rolls on the Bastion Events table as if you had issued the Maintain order to your Bastion.",
    "fixed": "Eberron"
  },
  "Planar Gateway": {
    "order": "Empower",
    "effect": "When you issue the Empower order to this facility, you instruct the facility's hireling to tune the archway to a place on another plane of existence. Tuning the archway takes 7 days, at the end of which time the gateway opens. If you provide a diamond worth 5,000+ GP as part of the tuning, the gate connects to a place you specify on another plane, as with the Gate spell (for transport only, not to draw a specific creature through) and destroys the diamond. If you don't provide a diamond or if a deity or another…",
    "fixed": "Arcana Unleashed"
  },
  "Pub": {
    "order": "Research",
    "effect": "When you issue the Research order to this facility, you commission the Pub's bartender to gather information from spies who are aware of all important events happening within 10 miles of your Bastion over the next 7 days. During that time, these spies can divulge the location of any creature that is familiar to you, provided the creature is within 50 miles of your Bastion and not hidden by magic or confined to a location that the DM deems is beyond the spy network's ability to locate. If the spies learn the…",
    "fixed": "DMG'24"
  },
  "Red Wizard Necropolis": {
    "order": "Recruit",
    "effect": "Each time you issue the Recruit action to this facility, up to four Undead Bastion Defenders are created and take shelter in the crypts and burial chambers of your Red Wizard Necropolis. You can't issue the Recruit order to this facility if it's fully occupied. Keep track of Undead Bastion Defenders you lose and deduct them from your Bastion Defenders roster. An Undead Bastion Defender returns to your Red Wizard Necropolis 14 days after being destroyed. Undead Bastion Defenders can't return from being killed if the…",
    "fixed": "Forgotten Realms"
  },
  "Reliquary": {
    "order": "Harvest",
    "effect": "When you issue the Harvest order to this facility, you commission its hireling to produce a specially prepared talisman for your use. The talisman usually takes the form of an amulet, a rune-carved box, or a statuette, but it can be any Tiny, nonmagical object that has religious significance. The work takes 7 days and costs no money. You can use this talisman in place of one spell's Material components, provided the components have a cost of 1,000 GP or less. If the spell normally consumes its components, the…",
    "fixed": "DMG'24"
  },
  "Rookery": {
    "order": "Craft",
    "effect": "When you issue the Craft order to this facility, you can commission the hireling to send ravens to various contacts in a Domain of Dread you have either visited previously or heard about from a creature that has been within said domain. This work takes 21 days, during which time no other activity can occur within this facility. At the end of this period, the hireling produces a Mist talisman linked to the chosen Domain of Dread.",
    "fixed": "Ravenloft"
  },
  "Sacristy": {
    "order": "Craft",
    "effect": "Craft a flask of Holy Water (7 days, free — spend GP during creation to improve its damage), or a Common or Uncommon magic item from the Relics tables (level 9+).",
    "fixed": "DMG'24"
  },
  "Sanctuary": {
    "order": "Craft",
    "effect": "When you issue the Craft order to this facility, you commission the facility's hireling to craft a Druidic Focus (wooden staff) or a Holy Symbol. The work takes 7 days and costs no money. The item remains in your Bastion until you claim it.",
    "fixed": "DMG'24"
  },
  "Sanctum": {
    "order": "Empower",
    "effect": "When you issue the Empower order to this facility, you inspire its hirelings to perform daily rites that benefit you or another character you name. The beneficiary doesn't need to be in the Bastion when the rites are performed to gain their benefit. Each time the beneficiary finishes a Long Rest, they gain Temporary Hit Points equal to your level. This effect lasts for 7 days.",
    "fixed": "DMG'24"
  },
  "Scriptorium": {
    "order": "Craft",
    "effect": "Craft a book replica (7 days), a Spell Scroll of a Cleric or Wizard spell of level 3 or lower (7 days), or up to fifty copies of a broadsheet or pamphlet (7 days).",
    "fixed": "DMG'24"
  },
  "Smithy": {
    "order": "Craft",
    "effect": "Craft anything made with Smith's Tools per the PHB crafting rules, or — at level 9+ — a Common or Uncommon magic item from the Armaments tables.",
    "fixed": "DMG'24"
  },
  "Soup Kitchen": {
    "order": "Recruit",
    "effect": "When you issue the Recruit order to this facility, you instruct your hireling to operate the soup kitchen for 7 days. Ingredients cost you 50 GP. If you would lose a Bastion Defender or a hireling on the next roll on the Bastion Events table, someone who believes in your work steps into their place and takes over immediately. You don't count as losing that Bastion Defender or hireling.",
    "fixed": "Arcana Unleashed"
  },
  "Spirit Vault": {
    "order": "Research",
    "effect": "When you issue the Research order to this facility, you or its hireling study the various relics and question the imprisoned entities within your Spirit Vault. This work takes 7 days. At the end of this time, roll 1d6. On a 1, the work is psychically taxing; if you did the research, you take 6d6 Psychic damage, and if the hireling did the research, they immediately die, and this facility can't be used again until your next Bastion turn. Otherwise, you or the hireling gain information as if you had successfully cast…",
    "fixed": "Ravenloft"
  },
  "Stable": {
    "order": "Trade",
    "effect": "When you issue the Trade order to this facility, you commission the facility's hireling to buy or sell one or more mounts at normal cost, keeping the ones you buy in your Stable. The work takes 7 days, and the DM decides what types of animals are available for purchase—horses, ponies, and mules being the most common. The Mounts and Vehicles; Mounts and Other Animals table in the Player's Handbook gives standard prices for various mounts. You bear the total cost of any purchases. When you sell a mount from your…",
    "fixed": "DMG'24"
  },
  "Storehouse": {
    "order": "Trade",
    "effect": "When you issue the Trade order to this facility, its hireling spends the next 7 days procuring nonmagical items that have a total value of 500 GP or less and stores them in the Storehouse, or the hireling uses those 7 days to sell goods in the Storehouse. You bear the total cost of any purchases, and the maximum value of the items purchased increases to 2,000 GP when you reach level 9 and 5,000 GP when you reach level 13. When you sell goods from your Storehouse, the buyer pays you 10 percent more than the standard…",
    "fixed": "DMG'24"
  },
  "Séance Parlor": {
    "order": "Research",
    "effect": "When you issue the Research order to this facility, you commission its hireling to read your fortune by casting bones, interpreting tea leaves, performing a tarokka reading, or using some other means. After your fortune is read, you gain Heroic Inspiration. You can't gain this benefit again until you finish a Long Rest.",
    "fixed": "Ravenloft"
  },
  "Teleportation Circle": {
    "order": "Recruit",
    "effect": "Each time you issue the Recruit order to this facility, its hireling extends an invitation to a Friendly [Attitude] NPC spellcaster. Roll any die. If the number rolled is odd, the invitee declines the invitation, and you gain no benefit from having issued the order. If the number rolled is even, the invitee accepts the invitation and arrives in your Bastion via your Teleportation Circle. While you are in your Bastion, you can ask the spellcaster to cast one Wizard spell of level 4 or lower; if you are level 17+,…",
    "fixed": "DMG'24"
  },
  "Theater": {
    "order": "Empower",
    "effect": "When you issue the Empower order to this facility, its hirelings begin work on a theatrical production or concert. Rehearsals and other preparations take 14 days, followed by at least 7 days of performances. The performances can continue indefinitely until a new production gets underway. You or another character can contribute to a production in the following ways: At the end of a rehearsal period, each character who contributed to the concert or production can make a {@dc 15} Charisma (Performance) check. If more…",
    "fixed": "DMG'24"
  },
  "Training Area": {
    "order": "Empower",
    "effect": "When you issue the Empower order to this facility, the facility's hirelings conduct training exercises for the next 7 days. Any character who trains here for at least 8 hours on each of those days gains a benefit at the end of the training period. The benefit depends on which trainer is present in the facility, as noted in the Expert Trainers table. The benefit lasts for 7 days.",
    "fixed": "DMG'24"
  },
  "Transmutation Vat": {
    "order": "Harvest",
    "effect": "When you issue the Harvest order to this facility, you instruct your hireling to pour a substance into the vat and transform it into something else. You must expend a Common or Uncommon potion, which is destroyed in the vat. At the end of 7 days, the hireling produces your choice of a flask of Alchemist's Fire, a vial of Antitoxin, a vial of Basic Poison, or a Common or Uncommon potion of your choice.",
    "fixed": "Arcana Unleashed"
  },
  "Trophy Room": {
    "order": "Research",
    "effect": "Research a chosen topic (7 days — legend, creature or famous object), or send the hireling to search for a trinket that might be of use (7 days).",
    "fixed": "DMG'24"
  },
  "War Room": {
    "order": "Recruit",
    "effect": "Recruit a new lieutenant (up to ten total), or commission lieutenants to muster a small army — one hundred Guard per lieutenant (1 day per hundred).",
    "fixed": "DMG'24"
  },
  "Workshop": {
    "order": "Craft",
    "effect": "Craft anything made with the Workshop's chosen Artisan's Tools per the PHB crafting rules, or — at level 9+ — a Common or Uncommon magic item from the Implements tables.",
    "fixed": "DMG'24"
  },
  "Zhentarim Travel Station": {
    "order": "Research",
    "effect": "When you issue the Research order to this facility, you commission the Zhentarim Travel Station's hirelings to gather information that facilitates an upcoming journey. This work takes 7 days. For the duration of the journey, you have Advantage on Wisdom (Survival) checks to forage or navigate.",
    "fixed": "Forgotten Realms"
  }
};
