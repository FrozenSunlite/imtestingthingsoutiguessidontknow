import {
  useTree,
  poolUsage,
  effectivePools,
  statVars,
  aggregateResources,
  profBonusFor,
  applyNodeProficiencies,
  effectiveCharacterLevel,
  talentPurchasesUsed,
  talentPurchaseLimit,
} from "@/lib/treeStore";
import { groupUnlocked, collectSubtreeUnlocked } from "@/lib/unlocked";
import { collectNodeBenefits, BENEFIT_CATEGORIES, tableSummary, tableOptions, benefitSpells } from "@/lib/benefits";
import SkillTestRow from "./SkillTestRow";
import { HitPointsCard } from "./HitPointsCard";
import { ActiveEffects } from "./ActiveEffects";
import {
  STATS,
  derivedSheet,
  BUILTIN_ROW_ORDER,
  SIZE_LABELS,
  numericResourceMap,
  sanitizeKey,
  encumbranceInfo,
  speedTypeList,
  senseList,
  DEFAULT_SENSES,
  customResourceList,
} from "@/lib/resources";
import { resolveResourceDie } from "@/lib/dieScaling";
import { SpeedSection } from "./SpeedSection";
import { SensesSection } from "./SensesSection";
import { ConditionTracks } from "./StatusSection";
import { DamageAffinitiesSection } from "./DamageAffinitiesSection";
import { SaveDCsSection } from "./SaveDCsSection";
import { DEFAULT_SKILL_ABILITIES, statOr10 } from "@/lib/skills";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Sparkles } from "lucide-react";

const signed = (n) => (n >= 0 ? `+${n}` : String(n));
// Identity and appearance fields editable directly on the Character tab.
// Identity and appearance fields editable directly on the Character tab.
// Background, age and looks live on the Fluff tab instead.
const IDENTITY = [
  ["name", "Name"],
  ["class", "Class"],
  ["race", "Race"],
  ["alignment", "Alignment"],
];
const REST_LABEL = { none: "", short: "short rest", long: "long rest" };
// One proficiency card per type, each always visible.
const PROF_TYPES = [
  ["Skill", "skills"],
  ["Tool", "tools"],
  ["Languages", "languages"],
  ["Instruments", "instruments"],
];

function SectionCard({ title, children }) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

// The modernized View "Character" tab: card-based dashboard layout instead of
// the paper-style print sheet (the print sheet stays as the export document).
export function CharacterTab() {
  // Derivations read the merged tree: main tree + side-tree panels.
  const {
    mergedTree: tree,
    character,
    setCharacter,
    pools,
    settings,
    investPoint,
    focusNode,
    openSubtreePanel,
    setSubtreeNodePoints,
  } = useTree();
  const levels = settings?.library?.levels || [];
  const usage = poolUsage(tree);
  const eff = effectivePools(pools, character, tree, levels);
  const stats = statVars(character, tree);
  const aggregated = aggregateResources(tree, character, levels);
  const saveBonus = Number((aggregated.find((e) => e.name === "Saving Throws") || {}).uses) || 0;
  // Saving-throw proficiencies granted by invested nodes (type "savingThrow"
  // on the node's proficiency list). Computed live so refunding the node
  // removes them. Accepts short or full ability names.
  const abilityKey = (name) => {
    const s = String(name || "").trim().toUpperCase();
    const full = {
      STRENGTH: "STR",
      DEXTERITY: "DEX",
      CONSTITUTION: "CON",
      INTELLIGENCE: "INT",
      WISDOM: "WIS",
      CHARISMA: "CHA",
    };
    return full[s] || s;
  };
  const nodeSaveProfs = new Set(
    (tree?.nodes || [])
      .filter((n) => (n.currentPoints || 0) > 0)
      .flatMap((n) =>
        (n.proficiencies || [])
          .filter((p) => p.type === "savingThrow")
          .map((p) => abilityKey(p.name))
      )
  );
  const effectiveLevel = effectiveCharacterLevel(character, tree);
  const talentLimit = talentPurchaseLimit(effectiveLevel, settings);
  const talentsUsed = talentPurchasesUsed(tree);
  const profBonus = profBonusFor(effectiveLevel, levels);
  const sheet = derivedSheet(character, tree, levels, aggregated, profBonus, stats, settings?.library);
  const customs = customResourceList(aggregated, settings?.library)
    .filter(
      (e) => !e.name.endsWith(" Speed") && !DEFAULT_SENSES.includes(e.name)
    )
    .map((e) => {
      const lib = (settings?.library?.resources || []).find(
        (r) => String(r?.name || "").toLowerCase() === e.name.toLowerCase()
      );
      if (!lib) return e;
      return { ...e, color: e.color === "#ffffff" ? lib.color || e.color : e.color };
    });
  const unlocked = (tree?.nodes || []).filter((n) => (n.currentPoints || 0) > 0);
  // Unlocked nodes grouped: Heritage Points purchases first, then
  // Talent-pool nodes by Talent Type (alphabetized), each node in the order
  // its points were invested.
  // Test tool: with dev mode on, every talent is listed here (even ones with
  // no points yet) and its points can be added or removed freely.
  const dev = !!character.devMode;
  const seenIds = new Set(unlocked.map((n) => n.id));
  const subtreeUnlocked = collectSubtreeUnlocked(tree).filter((n) => !seenIds.has(n.id));
  const sourceNodes = dev
    ? [...(tree?.nodes || []), ...subtreeUnlocked]
    : [...unlocked, ...subtreeUnlocked];
  const { heritage: heritageNodes, talentGroups, attributes: attributeNodes, subtreeGroups } =
    groupUnlocked(sourceNodes, { includeAutoGranted: dev });
  const benefitGroups = BENEFIT_CATEGORIES.map((cat) => ({
    ...cat,
    items: collectNodeBenefits(tree).filter((b) => b.category === cat.id),
  })).filter((g) => g.items.length);
  const benefitSpellList = benefitSpells(settings);

  // Test add/remove: a raw point change plus the proficiency side effects the
  // normal invest flow applies — no prerequisite, pool or level gates.
  const testAdjust = (n, delta) => {
    // Subtree rows live in the host's nested tree, not in tree.nodes.
    if (n.__subtreeLabel && Array.isArray(n.__hostChain)) {
      const max = Math.max(1, Number(n.maxPoints) || 1);
      const next = Math.max(0, Math.min(max, (Number(n.currentPoints) || 0) + delta));
      setSubtreeNodePoints(n.__hostChain, n.__path || [n.__originalId], next);
      if ((n.proficiencies || []).length)
        setCharacter((c) => ({
          ...c,
          proficiencies: applyNodeProficiencies(c.proficiencies, n.proficiencies, delta),
        }));
      return;
    }
    investPoint(n.id, delta);
    if ((n.proficiencies || []).length)
      setCharacter((c) => ({
        ...c,
        proficiencies: applyNodeProficiencies(c.proficiencies, n.proficiencies, delta),
      }));
  };

  // Double-click a skill: if its tree is open in a side panel (the main tree
  // or a loaded snapshot), centre that panel on the node; otherwise say so.
  const jumpToNode = (n) => {
    // A node inside a host subtree: open that subtree in a panel (reusing its
    // tab when it is already open) and centre on the flattened copy.
    if (n.__subtreeLabel && Array.isArray(n.__hostChain) && n.__hostChain.length) {
      const final = n.__hostChain[n.__hostChain.length - 1];
      const subIndex = final.subIndex ?? 0;
      openSubtreePanel(final.hostId, subIndex, n.__hostChain.slice(0, -1));
      focusNode(`sub-${final.hostId}-${subIndex}-${n.__originalId || n.id}`);
      return;
    }
    const sideTrees = tree?.sideTrees || {};
    const loaded = ["left", "right"].some((slot) => {
      const st = sideTrees[slot];
      if (!st || st.closed) return false;
      if (st.kind === "main") return (tree?.nodes || []).some((m) => m.id === n.id);
      if (st.kind === "snapshot") return (st.nodes || []).some((m) => m.id === n.id);
      return false;
    });
    if (!loaded) {
      toast.error("This skill's tree isn't open in a panel — load it on the left or right first.");
      return;
    }
    focusNode(n.id);
  };


  // Passive score per skill: 10 + the skill's modifier (ability + proficiency
  // or expertise + custom bonus) + any resource value targeting the skill
  // name, minus the sheet's exhaustion penalty.
  const resNums = numericResourceMap(aggregated);
  const passiveFor = (p) => {
    const ability = p.ability || DEFAULT_SKILL_ABILITIES[p.name] || "";
    const abilMod = ability
      ? Math.floor((statOr10(sheet[ability]?.final ?? stats[ability]) - 10) / 2) +
        (Number(character.modifiers?.ability?.[ability]) || 0)
      : 0;
    const profTimes = (p.times ?? 1) > 0 ? (p.expertise ? 2 : 1) * profBonus : 0;
    const exPenalty =
      2 * Math.max(0, Math.min(6, Math.round(Number(character.exhaustion) || 0)));
    return (
      10 + abilMod + profTimes + (Number(p.bonus) || 0) + (resNums[sanitizeKey(p.name)] || 0) - exPenalty
    );
  };

  const coreCards = [
    ["Armor Class", sheet["Armor Class"]?.final ?? 10],
    ["Initiative", signed(sheet["Initiative"]?.final ?? 0)],
    ["Prof. Bonus", signed(sheet["Proficiency Bonus"]?.final ?? profBonus)],
    ["Hit Dice", `${sheet["Hit Dice"]?.final ?? 0}${sheet["Hit Dice"]?.size || "d6"}`],
  ];

  const derivedRows = BUILTIN_ROW_ORDER.filter(
    (k) =>
      ![
        "STR", "DEX", "CON", "INT", "WIS", "CHA",
        "Hit Points", "Armor Class", "Speed", "Initiative",
        "Proficiency Bonus", "Hit Dice", "Spell Attacks", "Save DCs",
        "Horizontal Jump", "Vertical Jump",
      ].includes(k)
  );
  const derivedText = (k, d) => {
    if (k === "Creature Type") return d.text;
    if (k === "Size" || k === "Count as Size") return SIZE_LABELS[d.idx] ?? "Medium";
    if (k === "Inspiration") return `${d.filled ?? 0}/${d.slots ?? 1}`;
    return String(d.final ?? d);
  };
  const derivedShown = derivedRows.filter(
    (k) => sheet[k] && !k.endsWith(" Speed") && !DEFAULT_SENSES.includes(k)
  );

  const details = [
    ["Traits", character.traits],
    ["Ideals", character.ideals],
    ["Bonds", character.bonds],
    ["Flaws", character.flaws],
    ["Allies & Organizations", character.alliesOrganizations],
    ["Backstory", character.backstory],
    ["Notes", character.notes],
  ].filter(([, v]) => v);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      {/* Hero */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground">
            {(character.name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">
              {character.name || "Unnamed Character"}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {[character.class, character.race, character.background, character.alignment]
                .filter(Boolean)
                .join(" · ") || "—"}
              {"  ·  Level "}
              {effectiveLevel}
              {effectiveLevel !== (character.level || 1) && (
                <span className="text-[10px]">
                  {" "}
                  ({character.level || 1} + {effectiveLevel - (character.level || 1)} from nodes)
                </span>
              )}
            </p>
          </div>
        </div>
        {/* Editable identity + appearance */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {IDENTITY.map(([key, label]) => (
            <div key={key} className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">{label}</Label>
              <Input
                className="h-8"
                value={character[key] || ""}
                onChange={(e) => setCharacter({ ...character, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Ability scores */}
      <SectionCard title="Ability Scores">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {STATS.map((s) => {
            const effective = statOr10(sheet[s]?.final ?? stats[s]);
            const abilBonus = Number(character.modifiers?.ability?.[s]) || 0;
            const mod = Math.floor((effective - 10) / 2) + abilBonus;
            const saveProf = !!(character.savesProf || {})[s];
            const nodeSave = nodeSaveProfs.has(s);
            const hasSaveProf = saveProf || nodeSave;
            const specificSave = Number((aggregated.find((e) => e.name === `${s} Save`) || {}).uses) || 0;
            const saveDC = 8 + profBonus + mod + (Number(character.modifiers?.saves) || 0) + saveBonus + specificSave;
            const isSpellStat = (character.spellStat || "") === s;
            return (
              <div
                key={s}
                className="flex flex-col items-center gap-1.5 rounded-xl border bg-accent/40 p-3"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {s}
                </span>
                <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary/30 bg-background text-lg font-bold">
                  {effective}
                </span>
                <span className="text-xs font-semibold text-primary">{signed(mod)}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title={
                      nodeSave
                        ? "Saving throw proficiency granted by a talent"
                        : "Proficient in saving throws"
                    }
                    onClick={() => {
                      if (nodeSave) return;
                      setCharacter({
                        ...character,
                        savesProf: { ...(character.savesProf || {}), [s]: !saveProf },
                      });
                    }}
                    className={`flex h-6 w-6 items-center justify-center rounded border transition-colors ${
                      hasSaveProf
                        ? nodeSave
                          ? "border-violet-500 bg-violet-500/10 text-violet-600"
                          : "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Spellcasting ability"
                    onClick={() =>
                      setCharacter({ ...character, spellStat: isSpellStat ? "" : s })
                    }
                    className={`flex h-6 w-6 items-center justify-center rounded border transition-colors ${
                      isSpellStat
                        ? "border-violet-500 bg-violet-500/10 text-violet-600"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </button>
                </div>
                {hasSaveProf && (
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    Save DC {saveDC}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Hit points, rest & downtime */}
      <HitPointsCard />

      {/* Conditions, inspiration and the exhaustion/exertion tracks */}
      <SectionCard title="Conditions & Inspiration">
        <ConditionTracks />
      </SectionCard>

      {/* Derived resources */}
      {(derivedShown.length > 0 || customs.length > 0) && (
        <SectionCard title="Derived Resources">
          {derivedShown.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {derivedShown.map((k) => {
                const d = sheet[k];
                const display = derivedText(k, d);
                return (
                  <div key={k} className="rounded-lg border bg-accent/40 px-3 py-1.5">
                    <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {k}
                    </div>
                    <div className="truncate text-sm font-semibold">{display}</div>
                  </div>
                );
              })}
            </div>
          )}
          {customs.length > 0 && (
            <div className={derivedShown.length > 0 ? "mt-2 space-y-1" : "space-y-1"}>
              {customs.map((r) => {
                const die = resolveResourceDie(r, settings?.library);
                return (
                <div
                  key={r.name}
                  className="flex items-center justify-between rounded-lg bg-accent/40 px-2.5 py-1.5 text-xs"
                >
                  <span
                    className="font-medium"
                    style={{ color: r.color && r.color !== "#ffffff" ? r.color : undefined }}
                  >
                    {r.name}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {r.value}
                    {die && /\d*d\d/.test(die.text) ? ` · ${die.text}` : ""}
                    {r.grant
                      ? ` → ${r.grant.pool === "heritage" ? "Heritage" : r.grant.pool === "attribute" ? "Attribute" : "Talent"}${r.grant.variant === "specific" ? ` (${r.grant.name})` : ""} pts`
                      : ""}
                    {r.recovery === "short" || r.recovery === "long"
                      ? ` · ${REST_LABEL[r.recovery]}${r.recoveryAmount ? ` +${r.recoveryAmount}` : " (full)"}`
                      : ""}
                  </span>
                </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}

      {/* Core stats */}
      <SectionCard title="Combat & Core">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {coreCards.map(([label, value]) => (
            <div key={label} className="rounded-xl border bg-accent/40 px-3 py-2.5 text-center">
              <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                {label}
              </div>
              <div className="mt-0.5 text-lg font-bold leading-tight">{value}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Custom save DCs, then damage resistances / immunities / vulnerabilities */}
      <SaveDCsSection />
      <DamageAffinitiesSection />

      {/* Point pools */}
      <SectionCard title="Point Pools">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ["Heritage", usage.heritage, eff.heritage.total],
            ["Talent", usage.talent, eff.talent.total],
            ["Attribute", usage.attribute, eff.attribute.total],
          ].map(([label, used, total]) => (
            <div key={label} className="rounded-xl border bg-accent/40 p-3">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-semibold">{label} Points</span>
                <span className="font-mono text-muted-foreground">
                  {used} / {total}
                </span>
              </div>
              <Progress value={total ? (used / total) * 100 : 0} className="h-2" />
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Talents purchased: {talentsUsed}
          {Number.isFinite(talentLimit) ? ` / ${talentLimit}` : " (unlimited)"} at level{" "}
          {effectiveLevel}.
        </p>
      </SectionCard>

      {/* Speed in spaces, jumps and encumbrance; then senses */}
      <SpeedSection
        sheet={sheet}
        character={character}
        setCharacter={setCharacter}
        tree={tree}
        types={speedTypeList(character, settings?.library || {})}
        enc={encumbranceInfo(character, tree)}
      />
      <SensesSection
        sheet={sheet}
        character={character}
        setCharacter={setCharacter}
        senses={senseList(character, settings?.library || {})}
      />

      {/* Proficiencies — one section per type */}
      <div className="grid gap-3 sm:grid-cols-2">
        {PROF_TYPES.map(([label, key]) => {
          const list = (character.proficiencies || {})[key] || [];
          return (
            <SectionCard key={key} title={`${label} Proficiencies`}>
              <div className="flex flex-wrap gap-1.5">
                {list.map((p, i) => (
                  <span
                    key={i}
                    className="rounded-full border bg-accent/40 px-2.5 py-0.5 text-[11px]"
                  >
                    {p.name || "—"}
                    {p.expertise ? " (Expertise)" : ""}
                    {key === "skills" && p.name && (
                      <span className="text-muted-foreground"> · passive {passiveFor(p)}</span>
                    )}
                  </span>
                ))}
                {list.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">None yet.</p>
                )}
              </div>
            </SectionCard>
          );
        })}
      </div>

      {/* Heritage Traits above Unlocked Talents, underneath the proficiencies */}
      {heritageNodes.length > 0 && (
        <SectionCard title="Heritage Traits">
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {heritageNodes.map((n) => (
              <SkillTestRow key={n.id} node={n} onAdjust={testAdjust} onJump={jumpToNode} />
            ))}
          </div>
        </SectionCard>
      )}
      {(talentGroups.length > 0 || attributeNodes.length > 0 || (subtreeGroups || []).length > 0) && (
        <SectionCard title="Unlocked Talents">
          <div className="space-y-2">
            {dev && (
              <p className="text-[10px] text-muted-foreground">
                Dev mode: − / + adds or removes a point on any talent for testing —
                prerequisites, pools and level gates are ignored.
              </p>
            )}
            {talentGroups.map((g) => (
              <div key={g.type || "__untyped"}>
                <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  {g.type || "Untyped"}
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {g.nodes.map((n) => (
                    <SkillTestRow key={n.id} node={n} onAdjust={testAdjust} onJump={jumpToNode} />
                  ))}
                </div>
              </div>
            ))}
            {(subtreeGroups || []).map((g) => (
              <div key={g.label}>
                <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  {g.label}
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {g.nodes.map((n) => (
                    <SkillTestRow key={n.id} node={n} onAdjust={testAdjust} onJump={jumpToNode} />
                  ))}
                </div>
              </div>
            ))}
            {attributeNodes.length > 0 && (
              <div>
                <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  Attributes
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {attributeNodes.map((n) => (
                    <SkillTestRow key={n.id} node={n} onAdjust={testAdjust} onJump={jumpToNode} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {benefitGroups.length > 0 && (
        <SectionCard title="Benefits">
          <div className="space-y-2">
            {benefitGroups.map((g) => (
              <div key={g.id}>
                <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  {g.label}
                </div>
                <div className="flex flex-wrap gap-1">
                  {g.items.map((b) => {
                    const summary = b.table
                      ? tableSummary(b.table, benefitSpellList)
                      : b.description || b.name;
                    const options = b.table
                      ? tableOptions(b.table, benefitSpellList)
                      : [];
                    return (
                      <span
                        key={b.id}
                        title={[summary, options.slice(0, 20).join(", ")]
                          .filter(Boolean)
                          .join("\n")}
                        className="rounded border bg-accent/40 px-2 py-0.5 text-[10px]"
                      >
                        {b.name}
                        {b.table ? (
                          <span className="ml-1 text-muted-foreground">
                            ({summary})
                          </span>
                        ) : null}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Toggleable talents */}
      <ActiveEffects />

      {/* Details */}
      {details.length > 0 && (
        <SectionCard title="Details">
          <div className="space-y-2">
            {details.map(([label, value]) => (
              <div key={label} className="rounded-lg border bg-accent/40 px-3 py-2">
                <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  {label}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-xs leading-snug">{value}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}