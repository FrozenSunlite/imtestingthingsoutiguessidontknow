import { useTree } from "@/lib/treeStore";
import {
  pointTypesFor,
  pointDefaultsFor,
  levelZeroPointsFor,
} from "@/lib/pointTypes";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/skilltree/InfoTip";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, X } from "lucide-react";

const legacyKey = (id) =>
  id === "talent"
    ? "talentPoints"
    : id === "heritage"
      ? "heritagePoints"
      : id === "attribute"
        ? "attributePoints"
        : null;

// Per-level progression editor: level-0 starting values, a defaults row (used
// when a level has no entry below), and per-level overrides for every point
// type plus the proficiency bonus. Blank fields fall back to the defaults.
export function LevelsTab() {
  const { settings, setSettings } = useTree();
  const levels = settings?.library?.levels || [];
  const pointTypes = pointTypesFor(settings);
  const rules = settings?.levelRules || {};
  const pointDefaults = pointDefaultsFor(settings);
  const levelZero = levelZeroPointsFor(settings);
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

  const setPointDefault = (id, value) => {
    const nextDefaults = { ...(rules.pointDefaults || pointDefaults), [id]: value };
    const key = legacyKey(id);
    setRules({ pointDefaults: nextDefaults, ...(key ? { [key]: value } : {}) });
  };

  const setLevelZero = (id, value) => {
    const nextZero = { ...(rules.levelZeroPoints || levelZero), [id]: value };
    setRules({
      levelZeroPoints: nextZero,
      ...(id === "talent" ? { levelZeroTalentPoints: value } : {}),
    });
  };

  const setLevelPoint = (i, id, value) => {
    const current = levels[i];
    const points = { ...(current.points || {}), [id]: value };
    const key = legacyKey(id);
    patch(i, { points, ...(key ? { [key]: value } : {}) });
  };

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

  const columns = `70px repeat(${pointTypes.length + 3}, minmax(0, 1fr)) 28px`;

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-primary/30 bg-primary/5 p-2">
        <p className="mb-1.5 text-xs font-semibold">Level 0 starting values</p>
        <div className="grid grid-cols-3 gap-1.5">
          {pointTypes.map((pt) => (
            <div key={pt.id} className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground">{pt.label}</span>
              {numField(
                pt.label,
                levelZero[pt.id],
                (e) =>
                  setLevelZero(
                    pt.id,
                    e.target.value === ""
                      ? 0
                      : Math.max(0, Number(e.target.value) || 0)
                  ),
                `${pt.currency} a fresh character starts with at level 0`
              )}
            </div>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          These are the pools a character begins with. They are separate from the
          per-level defaults below.
        </p>
      </div>

      <div className="rounded-md border p-2">
        <p className="mb-1.5 text-xs font-semibold">
          Defaults (used when a level isn't listed below)
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {pointTypes.map((pt) => (
            <div key={pt.id} className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground">{pt.label}</span>
              {numField(
                pt.label,
                pointDefaults[pt.id],
                (e) =>
                  setPointDefault(
                    pt.id,
                    e.target.value === ""
                      ? 0
                      : Math.max(0, Number(e.target.value) || 0)
                  ),
                `${pt.currency} gained per level when a level has no row`
              )}
            </div>
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {numField("Talents/level", rules.talentLimit ?? 1, (e) =>
            setRules({ talentLimit: e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0) }),
            "How many talents may be purchased per character level (cumulative: level × this number)"
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
          <div
            className="grid items-center gap-1.5 px-2 text-[10px] font-semibold uppercase text-muted-foreground"
            style={{ gridTemplateColumns: columns }}
          >
            <span>Level</span>
            {pointTypes.map((pt) => (
              <span key={pt.id}>{pt.label}</span>
            ))}
            <span>Prof.</span>
            <span>Hit Dice</span>
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
              <div
                key={i}
                className="grid items-center gap-1.5 rounded-md border p-2"
                style={{ gridTemplateColumns: columns }}
              >
                <InfoTip label="The level this row applies to.">
                  <Input
                    type="number"
                    min={0}
                    value={l.level}
                    onChange={(e) => patch(i, { level: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </InfoTip>
                {pointTypes.map((pt) => {
                  const value = l.points?.[pt.id] ?? l[`${pt.id}Points`] ?? "";
                  return (
                    <div key={pt.id}>
                      {numField(
                        pt.label,
                        value,
                        (e) =>
                          setLevelPoint(
                            i,
                            pt.id,
                            e.target.value === ""
                              ? ""
                              : Math.max(0, Number(e.target.value) || 0)
                          ),
                        `${pt.currency} at this level`
                      )}
                    </div>
                  );
                })}
                {numField("Prof.", l.profBonus, setNum("profBonus"), "Proficiency Bonus at this level")}
                {numField("Hit Dice", l.hitDice, setNum("hitDice"), "Hit Dice gained at this level")}
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
