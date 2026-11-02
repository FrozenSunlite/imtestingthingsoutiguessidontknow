import { useEffect, useMemo, useRef, useState } from "react";
import { useTree } from "@/lib/treeStore";
import {
  COIN_TYPES,
  CREATION_MODES,
  backgroundChoices,
  backgroundOptionGroups,
  classChoices,
  featChoices,
  modeUsesTree,
  raceChoices,
  subclassChoices,
  subclassUnlockLevel,
} from "@/lib/characterCreation";
import { rehydrateImages } from "@/lib/imageStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Coins, Sparkles, Swords, TreePine, Upload, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { playSfx } from "@/lib/audio";
import { SFX } from "@/lib/sfx";

const MODE_ICONS = {
  tree: TreePine,
  "tree-race": UserRound,
  "tree-class": Swords,
  "race-class": Users,
  all: Sparkles,
};

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ChoiceSelect({ value, onChange, options, placeholder, manualLabel = "Type a name", disabled = false }) {
  if (!options.length) {
    return (
      <Input
        value={value || ""}
        placeholder={manualLabel}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  return (
    <Select
      value={options.some((option) => option.id === value) ? value : ""}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger className="h-9">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Multi-source character creation: the current talent tree is always the base,
// and race, class/subclass, background (or an origin feat) are added on top.
export function CharacterCreatorDialog({ open, onClose }) {
  const { character, setCharacter, enterApp, settings, tree, importTree } = useTree();

  const classes = useMemo(() => classChoices(settings), [settings]);
  const races = useMemo(() => raceChoices(settings), [settings]);
  const backgrounds = useMemo(() => backgroundChoices(settings), [settings]);
  const feats = useMemo(() => featChoices(settings), [settings]);

  const [name, setName] = useState("");
  const [mode, setMode] = useState("all");
  const [startingLevel, setStartingLevel] = useState("1");
  const [raceId, setRaceId] = useState("");
  const [classId, setClassId] = useState("");
  const [subclassId, setSubclassId] = useState("");
  const [backgroundId, setBackgroundId] = useState("");
  const [useOriginFeat, setUseOriginFeat] = useState(false);
  const [featId, setFeatId] = useState("");
  const [optionChoices, setOptionChoices] = useState({});
  const [currency, setCurrency] = useState("gp");
  const [amount, setAmount] = useState("0");
  const treeFileRef = useRef(null);
  const seededRef = useRef(false);
  const fail = (message) => {
    playSfx(SFX.error, { gain: 0.7 });
    toast.error(message);
  };

  // Re-seed the form from the working character each time it opens. Settings
  // can change while the dialog is open (for example an imported tree carrying
  // a Reference Library), so only the first open seeds the fields.
  useEffect(() => {
    if (!open) {
      seededRef.current = false;
      return;
    }
    if (seededRef.current) return;
    seededRef.current = true;
    const creation = character?.creation || {};
    const firstClass = (character?.classes || [])[0];
    const classEntry = classes.find(
      (option) =>
        option.name === (firstClass?.name || character?.class) &&
        (!firstClass?.source || option.source === firstClass.source)
    );
    const raceEntry = races.find(
      (option) =>
        option.name === (creation.race?.name || character?.race) &&
        (!creation.race?.source || option.source === creation.race.source)
    );
    const backgroundEntry = backgrounds.find(
      (option) =>
        option.name === (creation.background?.name || character?.background) &&
        (!creation.background?.source ||
          option.source === creation.background.source)
    );
    const subOptions = firstClass?.name
      ? subclassChoices(settings, firstClass.name, firstClass.source)
      : [];
    const subEntry = subOptions.find(
      (option) =>
        option.name === (firstClass?.subclass || character?.subclass)
    );
    const featEntry = feats.find(
      (option) =>
        option.name === creation.originFeat?.name &&
        (!creation.originFeat?.source ||
          option.source === creation.originFeat.source)
    );
    setName(character?.name || "");
    setMode(creation.mode || (character?.class && character.class !== "Dilettante" ? "all" : "tree"));
    setStartingLevel(String(creation.startingLevel || character?.level || 1));
    setRaceId(raceEntry?.id || (races.length ? "" : creation.race?.name || character?.race || ""));
    setClassId(classEntry?.id || (classes.length ? "" : firstClass?.name || character?.class || ""));
    setSubclassId(
      subEntry?.id ||
        (subOptions.length ? "" : firstClass?.subclass || character?.subclass || "")
    );
    setBackgroundId(
      backgroundEntry?.id ||
        (backgrounds.length ? "" : creation.background?.name || character?.background || "")
    );
    setUseOriginFeat(!!creation.originFeat);
    setFeatId(
      featEntry?.id || (feats.length ? "" : creation.originFeat?.name || "")
    );
    setOptionChoices(creation.background?.options || {});
    setCurrency(creation.startingCurrency?.type || "gp");
    setAmount(String(creation.startingCurrency?.amount ?? 0));
  }, [open, character, classes, races, backgrounds, feats, settings]);

  const showRace =
    mode === "tree-race" || mode === "race-class" || mode === "all";
  const showClass =
    mode === "tree-class" || mode === "race-class" || mode === "all";
  const usesTree = modeUsesTree(mode);
  const startLevel = Math.max(1, Math.min(20, Number(startingLevel) || 1));

  const race = races.find((option) => option.id === raceId);
  const raceName = race?.name || (races.length ? "" : raceId);
  const raceSource = race?.source || "";

  const baseClass = classes.find((option) => option.id === classId);
  const className = baseClass?.name || (classes.length ? "" : classId);
  const classSource = baseClass?.source || "";

  const subclasses = useMemo(
    () => (className ? subclassChoices(settings, className, classSource) : []),
    [settings, className, classSource]
  );
  const subclass = subclasses.find((option) => option.id === subclassId);
  const subclassName = subclass?.name || (subclasses.length ? "" : subclassId);
  const subclassSource = subclass?.source || "";
  const subclassUnlock = subclassUnlockLevel(
    settings,
    tree,
    className,
    classSource
  );
  const subclassLocked = !!className && startLevel < subclassUnlock;

  useEffect(() => {
    if (subclassLocked) setSubclassId("");
  }, [subclassLocked]);

  const background = backgrounds.find((option) => option.id === backgroundId);
  const backgroundName = background?.name || (backgrounds.length ? "" : backgroundId);
  const backgroundSource = background?.source || "";
  const optionGroups = useMemo(
    () => (useOriginFeat ? [] : backgroundOptionGroups(background?.entry)),
    [background, useOriginFeat]
  );

  const feat = feats.find((option) => option.id === featId);
  const featName = feat?.name || (feats.length ? "" : featId);
  const featSource = feat?.source || "";

  const create = () => {
    if (showRace && !raceName) {
      fail("Choose a race (or switch to a mode without a race).");
      return;
    }
    if (showClass && !className) {
      fail("Choose a class (or switch to a mode without a class).");
      return;
    }
    if (!useOriginFeat && backgroundName && optionGroups.some((group) => !optionChoices[group.id])) {
      fail("This background has options - pick one for each group.");
      return;
    }
    if (useOriginFeat && !featName) {
      fail("Choose an origin feat, or turn the replacement off.");
      return;
    }

    const gained = Math.max(0, Number(amount) || 0);
    const coins = { ...(character?.coins || {}) };
    if (gained > 0) {
      coins[currency] = (Number(coins[currency]) || 0) + gained;
    }

    const hitDie = baseClass?.entry?.hd?.faces;
    const chosenSubclass = subclassLocked ? "" : subclassName;
    const creation = {
      mode,
      usesTree,
      startingLevel: startLevel,
      race: showRace && raceName ? { name: raceName, source: raceSource } : null,
      class:
        showClass && className
          ? {
              name: className,
              source: classSource,
              subclass: chosenSubclass,
              subclassSource: chosenSubclass ? subclassSource : "",
            }
          : null,
      background:
        !useOriginFeat && backgroundName
          ? { name: backgroundName, source: backgroundSource, options: optionChoices }
          : null,
      originFeat:
        useOriginFeat && featName ? { name: featName, source: featSource } : null,
      startingCurrency: { type: currency, amount: gained },
      createdAt: new Date().toISOString(),
    };

    setCharacter({
      ...character,
      name: name.trim() || character?.name || "Unnamed Character",
      level: startLevel,
      hitDiceCount: startLevel,
      race: showRace && raceName ? raceName : "Heritage",
      class: showClass && className ? className : "Dilettante",
      subclass: showClass ? chosenSubclass : "",
      background: useOriginFeat ? "" : backgroundName || "",
      originFeat: useOriginFeat ? featName || "" : "",
      hitDiceSize: hitDie ? `d${hitDie}` : character?.hitDiceSize || "d6",
      classes:
        showClass && className
          ? [
              {
                name: className,
                source: classSource,
                subclass: chosenSubclass,
                subclassSource: chosenSubclass ? subclassSource : "",
                level: startLevel,
              },
            ]
          : [],
      creation,
      coins,
    });
    toast.success(
      `${name.trim() || "Character"} created${className ? ` as a ${className}` : ""}.`
    );
    enterApp("sheet", { sheetOnly: true });
    onClose();
  };

  const treeHasContent = (tree?.nodes || []).length > 0;
  const importTreeFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        if (!parsed || typeof parsed !== "object") {
          throw new Error("That file is empty or not a talent tree.");
        }
        const hydrated = await rehydrateImages(parsed);
        importTree(hydrated, "overwrite");
        if (!usesTree) setMode("all");
        toast.success(`Talent tree imported from ${file.name}.`);
      } catch (error) {
        fail(error?.message || "Could not import that talent tree.");
      }
    };
    reader.onerror = () => fail("Could not read that file.");
    reader.readAsText(file);
    event.target.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Character Creator</DialogTitle>
          <DialogDescription>
            Build from the current talent tree with any combination of race and
            class. Imported 5eTools entries appear here automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
            <Field label="Name">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Character name"
              />
            </Field>
            <Field label="Starting level" hint="1–20">
              <Input
                type="number"
                min={1}
                max={20}
                value={startingLevel}
                onChange={(event) => setStartingLevel(event.target.value)}
              />
            </Field>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Build from
            </Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {CREATION_MODES.map((option) => {
                const Icon = MODE_ICONS[option.id] || TreePine;
                const active = mode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setMode(option.id)}
                    className={`flex items-start gap-2 rounded-lg border p-2.5 text-left transition-colors ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border/60 hover:bg-accent"
                    }`}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {option.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <TreePine className="h-4 w-4" /> Talent tree
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {usesTree
                    ? treeHasContent
                      ? `${tree.name || "Current tree"} · ${tree.nodes.length} nodes`
                      : "No talent tree loaded yet."
                    : "This build has no talent tree."}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => treeFileRef.current?.click()}
              >
                <Upload className="mr-1 h-3.5 w-3.5" /> Import talent tree
              </Button>
              <input
                ref={treeFileRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={importTreeFile}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Importing replaces the current tree. Talent tree points are hidden
              when a build does not use a tree.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {showRace && (
              <Field label="Race" hint={races.length ? undefined : "No species imported — type a name."}>
                <ChoiceSelect
                  value={raceId}
                  onChange={setRaceId}
                  options={races}
                  placeholder="Choose a race"
                  manualLabel="Race name"
                />
              </Field>
            )}
            {showClass && (
              <Field
                label="Class"
                hint={
                  classes.length
                    ? "2014 and 2024 classes are listed separately."
                    : "No classes imported — type a name."
                }
              >
                <ChoiceSelect
                  value={classId}
                  onChange={(value) => {
                    setClassId(value);
                    setSubclassId("");
                  }}
                  options={classes}
                  placeholder="Choose a class"
                  manualLabel="Class name"
                />
              </Field>
            )}
            {showClass && className && (
              <Field
                label="Subclass"
                hint={
                  subclassLocked
                    ? `${className} unlocks its subclass at class level ${subclassUnlock}. Raise the starting level first.`
                    : subclasses.length
                      ? "Shared subclasses appear under every class that owns them."
                      : "No subclass for this class yet."
                }
              >
                <ChoiceSelect
                  value={subclassId}
                  onChange={setSubclassId}
                  options={subclasses}
                  placeholder="Choose a subclass (optional)"
                  manualLabel="Subclass name (optional)"
                  disabled={subclassLocked}
                />
              </Field>
            )}
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                <span className="font-medium">Use an origin feat instead of a background</span>
                <span className="block text-[10px] text-muted-foreground">
                  The origin feat replaces the background choice entirely.
                </span>
              </span>
              <Switch
                checked={useOriginFeat}
                onCheckedChange={(value) => setUseOriginFeat(value)}
              />
            </label>

            {useOriginFeat ? (
              <Field label="Origin feat" hint={feats.length ? undefined : "No feats imported — type a name."}>
                <ChoiceSelect
                  value={featId}
                  onChange={setFeatId}
                  options={feats}
                  placeholder="Choose an origin feat"
                  manualLabel="Origin feat name"
                />
              </Field>
            ) : (
              <>
                <Field
                  label="Background"
                  hint={backgrounds.length ? undefined : "No backgrounds imported — type a name."}
                >
                  <ChoiceSelect
                    value={backgroundId}
                    onChange={setBackgroundId}
                    options={backgrounds}
                    placeholder="Choose a background"
                    manualLabel="Background name"
                  />
                </Field>
                {optionGroups.map((group) => (
                  <Field
                    key={group.id}
                    label={group.label}
                    hint="This background asks you to choose."
                  >
                    <Select
                      value={optionChoices[group.id] || ""}
                      onValueChange={(value) =>
                        setOptionChoices((current) => ({
                          ...current,
                          [group.id]: value,
                        }))
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Choose one" />
                      </SelectTrigger>
                      <SelectContent>
                        {group.choices.map((choice) => (
                          <SelectItem key={choice.id} value={choice.id}>
                            {choice.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                ))}
              </>
            )}
          </div>

          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Coins className="h-4 w-4" /> Starting currency
            </p>
            <p className="mb-2 text-[10px] text-muted-foreground">
              Choose one currency and how much the character starts with. It is
              added to the working purse.
            </p>
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COIN_TYPES.map((coin) => (
                    <SelectItem key={coin.id} value={coin.id}>
                      {coin.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-label="Starting amount"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <p className="text-[10px] text-muted-foreground">
              The current tree stays exactly as it is; only the character's
              origin, class and purse change.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={create}>Create character</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
