import { useTree } from "@/lib/treeStore";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/skilltree/InfoTip";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, X } from "lucide-react";

// Per-level progression editor: a defaults row (used when a level has no entry
// below) plus per-level overrides for every kind of point and the proficiency
// bonus. Blank fields fall back to the defaults.
export function LevelsTab() {
  const { settings, setSettings } = useTree();
  const levels = settings?.library?.levels || [];
  const rules = settings?.levelRules || {
    talentPoints: 1,
    heritagePoints: 0,
    attributePoints: 0,
    talentLimit: 1,
    levelZeroTalentPoints: 2,
    talentLimitEnabled: true,
  };
  const setLevels = (next) =>
    setSettings((s) => ({ ...s, library: { ...s.library, levels: next } }));
  const setRules = (p) =>
    setSettings((s) => ({ ...s, levelRules: { ...(s.levelRules || {}), ...p } }));

  const sorted = [...levels].sort((a, b) => (Number(a.level) || 0) - (Number(b.level) || 0));
  const nextLevel = levels.length
    ? Math.max(...levels.map((l) => Number(l.level) || 0)) + 1
    : 0;
  const add = () => setLevels([...levels, { level: nextLevel }]);
  const patch = (i, p) => {
    const next = [...levels];
    next[i] = { ...next[i], ...p };
    setLevels(next);
  };
  const remove = (i) => setLevels(levels.filter((_, j) => j !== i));

  const numField = (label, value, onChange, tip) => (
    <InfoTip label={tip || label}>
      <Input
        type="number"
        min={0}
        placeholder={label}
        value={value ?? ""}
        onChange={onChange}
      />
    </InfoTip>
  );

  return (
    <div className="space-y-3">
      <div className="rounded-md border p-2">
        <p className="mb-1.5 text-xs font-semibold">Defaults (used when a level isn't listed below)</p>
        <div className="grid grid-cols-3 gap-1.5">
          {numField("Talent", rules.talentPoints, (e) =>
            setRules({ talentPoints: e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0) })
          )}
          {numField("Heritage", rules.heritagePoints, (e) =>
            setRules({ heritagePoints: e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0) })
          )}
          {numField("Attribute", rules.attributePoints, (e) =>
            setRules({ attributePoints: e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0) })
          )}
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {numField("Talents/level", rules.talentLimit, (e) =>
            setRules({ talentLimit: e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0) }),
            "How many talents may be purchased per character level (cumulative: level × this number)"
          )}
          {numField("Level 0 Talent", rules.levelZeroTalentPoints, (e) =>
            setRules({ levelZeroTalentPoints: e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0) }),
            "Talent Points a fresh character starts with before any level-ups"
          )}
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs">
          <Switch
            checked={rules.talentLimitEnabled !== false}
            onCheckedChange={(v) => setRules({ talentLimitEnabled: v })}
          />
          Limit talents purchased per level
        </label>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Proficiency Bonus defaults to D&D scaling (+2 at levels 1-4, then +1 every 4 levels);
          set it per level below to override.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Per-level overrides — blank fields use the defaults above.
        </span>
        <Button size="sm" variant="outline" onClick={add}>
          <Plus className="mr-1 h-4 w-4" /> Add level {nextLevel}
        </Button>
      </div>
      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground">No levels defined yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-[70px_repeat(6,1fr)_28px] items-center gap-1.5 px-2 text-[10px] font-semibold uppercase text-muted-foreground">
            <span>Level</span>
            <span>Talent</span>
            <span>Prof.</span>
            <span>Hit Dice</span>
            <span>Heritage</span>
            <span>Attribute</span>
            <span>Talents</span>
            <span />
          </div>
          {sorted.map((l) => {
            const i = levels.indexOf(l);
            const setNum = (key) => (e) =>
              patch(i, {
                [key]: e.target.value === "" ? "" : Math.max(0, Number(e.target.value) || 0),
              });
            return (
              <div key={i} className="grid grid-cols-[70px_repeat(6,1fr)_28px] items-center gap-1.5 rounded-md border p-2">
                <InfoTip label="The level this row applies to.">
                  <Input
                    type="number"
                    min={0}
                    value={l.level}
                    onChange={(e) => patch(i, { level: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </InfoTip>
                {numField("Talent", l.talentPoints, setNum("talentPoints"), "Talent Points at this level")}
                {numField("Prof.", l.profBonus, setNum("profBonus"), "Proficiency Bonus at this level")}
                {numField("Hit Dice", l.hitDice, setNum("hitDice"), "Hit Dice gained at this level")}
                {numField("Heritage", l.heritagePoints, setNum("heritagePoints"), "Heritage Points at this level")}
                {numField("Attribute", l.attributePoints, setNum("attributePoints"), "Attribute Points at this level")}
                {numField("Talents", l.talentLimit, setNum("talentLimit"), "Talents purchasable per level at this level")}
                <Button size="sm" variant="ghost" onClick={() => remove(i)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}