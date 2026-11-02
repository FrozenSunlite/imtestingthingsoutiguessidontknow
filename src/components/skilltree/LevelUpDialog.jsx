import { useEffect, useMemo, useState } from "react";
import { useTree, levelGains } from "@/lib/treeStore";
import { levelZeroPointsFor } from "@/lib/pointTypes";
import {
  classBenefitsFor,
  classChoices,
  subclassChoices,
} from "@/lib/characterCreation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { playSfx } from "@/lib/audio";
import { SFX } from "@/lib/sfx";

const classKey = (entry) => `${entry.name}|${entry.source || ""}`;

// Level-up hit point choice plus class/subclass progression. Benefits are read
// from the imported class tab, so a Fighter never sees a Wizard feature and a
// Champion never sees Battle Master branches. Multiclassing adds (or switches
// to) another class instead of advancing the current one.
export function LevelUpDialog({ open, onClose }) {
  const { character, setCharacter, setPools, settings, tree } = useTree();
  const nextLevel = (Number(character.level) || 1) + 1;

  const [target, setTarget] = useState("none");
  const [newClassId, setNewClassId] = useState("");
  const [subclassId, setSubclassId] = useState("");

  const availableClasses = useMemo(() => classChoices(settings), [settings]);
  const characterClasses = useMemo(() => {
    if (Array.isArray(character.classes) && character.classes.length) {
      return character.classes;
    }
    if (character.class && character.class !== "Dilettante") {
      return [
        {
          name: character.class,
          source: "",
          subclass: character.subclass || "",
          subclassSource: "",
          level: Number(character.level) || 1,
        },
      ];
    }
    return [];
  }, [character.classes, character.class, character.subclass, character.level]);

  // Reset the picker to the primary class whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    if (characterClasses.length) {
      setTarget("0");
      setSubclassId(characterClasses[0].subclass || "");
    } else {
      setTarget("none");
      setSubclassId("");
    }
    setNewClassId("");
  }, [open, characterClasses]);

  const isNew = target === "new";
  const existing =
    !isNew && target !== "none" ? characterClasses[Number(target)] : null;
  const newClass = availableClasses.find((option) => option.id === newClassId);

  const activeClass = isNew
    ? newClass
    : existing
      ? {
          name: existing.name,
          source: existing.source || "",
          entry: availableClasses.find(
            (option) => classKey(option) === classKey(existing)
          )?.entry,
        }
      : null;

  const activeClassName = activeClass?.name || "";
  const activeClassSource = activeClass?.source || "";

  const subclassOptions = useMemo(
    () =>
      activeClassName
        ? subclassChoices(settings, activeClassName, activeClassSource)
        : [],
    [settings, activeClassName, activeClassSource]
  );

  const subclass = subclassOptions.find((option) => option.id === subclassId);
  // Keep a plain name from an older character even when it is not in the list.
  const subclassName =
    subclass?.name || (subclassOptions.length ? "" : subclassId) || "";

  const classLevel =
    isNew || target === "none"
      ? 1
      : (Number(existing?.level) || 1) + 1;

  const benefits = useMemo(
    () =>
      activeClassName
        ? classBenefitsFor(tree, {
            className: activeClassName,
            classSource: activeClassSource,
            subclassName,
            level: classLevel,
          })
        : [],
    [tree, activeClassName, activeClassSource, subclassName, classLevel]
  );

  const dieSize = activeClass?.entry?.hd?.faces || character.hitDiceSize || "d6";
  const sides = Number(String(dieSize).replace(/\D/g, "")) || 6;
  const conMod =
    Math.floor((((character.stats || {}).CON ?? 10) - 10) / 2) +
    (Number(character.modifiers?.ability?.CON) || 0);
  const average = Math.max(1, Math.floor(sides / 2) + 1) + conMod;

  const classesAfter = () => {
    const list = characterClasses.map((entry) => ({ ...entry }));
    if (isNew) {
      list.push({
        name: activeClassName,
        source: activeClassSource,
        subclass: subclassName,
        subclassSource: subclass?.source || "",
        level: 1,
      });
      return list;
    }
    if (target === "none") return list;
    const index = Number(target);
    const current = list[index];
    if (!current) return list;
    list[index] = {
      ...current,
      level: (Number(current.level) || 1) + 1,
      subclass: subclassName || current.subclass || "",
      subclassSource: subclass?.source || current.subclassSource || "",
    };
    return list;
  };

  const confirm = (gain) => {
    if (isNew && !activeClassName) {
      playSfx(SFX.error, { gain: 0.7 });
      toast.error("Choose the class to multiclass into.");
      return;
    }
    const g = levelGains(nextLevel, settings);
    const classes = classesAfter();
    const primary = classes[0];
    const hdBlank = character.hitDiceCount == null || character.hitDiceCount === "";
    setCharacter({
      ...character,
      level: nextLevel,
      hitPoints: (Number(character.hitPoints) || 0) + gain,
      hitDiceCount: hdBlank ? nextLevel : (Number(character.hitDiceCount) || 0) + 1,
      classes,
      class: primary?.name || character.class,
      subclass: primary?.subclass || character.subclass || "",
    });
    setPools((p) => {
      const next = { ...p };
      const zero = levelZeroPointsFor(settings);
      Object.entries(g.points || {}).forEach(([id, amount]) => {
        const base = Number(p[id]?.total);
        next[id] = {
          ...(p[id] || {}),
          total:
            (Number.isFinite(base) ? base : zero[id] ?? 0) + (Number(amount) || 0),
        };
      });
      return next;
    });
    const targetLabel = activeClassName
      ? ` · ${activeClassName} level ${classLevel}`
      : "";
    toast.success(`Reached character level ${nextLevel}${targetLabel}`);
    onClose();
  };

  const roll = () => {
    const r = 1 + Math.floor(Math.random() * sides);
    const gain = Math.max(1, r + conMod);
    confirm(gain);
    toast.success(`Rolled ${r} on 1d${sides} → +${gain} HP`);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Level Up to {nextLevel}</DialogTitle>
          <DialogDescription>
            Choose which class gains this level. Benefits are filtered to that
            class and its subclass.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Class gaining the level
            </Label>
            <Select
              value={target}
              onValueChange={(value) => {
                setTarget(value);
                setSubclassId(
                  value === "new"
                    ? ""
                    : characterClasses[Number(value)]?.subclass || ""
                );
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No class (talent tree only)</SelectItem>
                {characterClasses.map((entry, index) => (
                  <SelectItem key={`${classKey(entry)}-${index}`} value={String(index)}>
                    {entry.name}
                    {entry.source ? ` (${entry.source})` : ""} · level{" "}
                    {Number(entry.level) || 1}
                  </SelectItem>
                ))}
                <SelectItem value="new">Multiclass into another class…</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isNew && (
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                New class
              </Label>
              <Select value={newClassId} onValueChange={setNewClassId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Choose a class" />
                </SelectTrigger>
                <SelectContent>
                  {availableClasses.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Multiclassing starts this class at level 1 instead of advancing
                your current class. Both editions stay separate choices.
              </p>
            </div>
          )}

          {activeClassName && (
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Subclass
              </Label>
              {subclassOptions.length ? (
                <Select value={subclassId} onValueChange={setSubclassId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choose a subclass (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {subclassOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="rounded-md border bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
                  No imported subclass for {activeClassName}. Import one in the
                  Reference Index to filter its features.
                </p>
              )}
            </div>
          )}

          {activeClassName ? (
            <div className="rounded-md border p-2">
              <p className="mb-1.5 text-xs font-semibold">
                {activeClassName}
                {subclassName ? ` · ${subclassName}` : ""} benefits at class
                level {classLevel}
              </p>
              {benefits.length ? (
                <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                  {benefits.map((benefit) => (
                    <div key={`${benefit.group}-${benefit.name}`} className="rounded bg-accent/40 p-2">
                      <p className="text-xs font-semibold">{benefit.name}</p>
                      {benefit.text ? (
                        <p className="mt-0.5 line-clamp-3 text-[10px] leading-snug text-muted-foreground">
                          {benefit.text}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  No imported features found for this class level. Import the
                  class from the Reference Index to populate level benefits.
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-md border bg-muted/40 p-2 text-[10px] text-muted-foreground">
              No class is advancing. The character still gains a level, hit
              points and talent points from the talent tree.
            </p>
          )}

          <p className="text-[10px] text-muted-foreground">
            Hit points come from 1d{sides}
            {conMod !== 0
              ? ` ${conMod > 0 ? "+" : "−"} ${Math.abs(conMod)} CON`
              : ""}
            . You also gain +1 hit die at the current size.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => confirm(average)}>
              Take Average (+{average} HP)
            </Button>
            <Button onClick={roll}>Roll 1d{sides}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
