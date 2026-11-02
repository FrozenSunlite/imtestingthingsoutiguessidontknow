import { useTree } from "@/lib/treeStore";
import { backgroundInfo } from "@/lib/characterCreation";
import { PortraitDisplay } from "./PortraitDisplay";
import { TokenForge } from "./TokenForge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Appearance, personality and backstory — the "fluff" side of the character,
// all fillable, with a copy of the portrait at the top.
const APPEARANCE = [
  ["eyes", "Eyes"],
  ["skin", "Skin"],
  ["hair", "Hair"],
  ["height", "Height"],
  ["weight", "Weight"],
];
const PERSONALITY = [
  ["traits", "Personality Traits"],
  ["ideals", "Ideals"],
  ["bonds", "Bonds"],
  ["flaws", "Flaws"],
];
const LONGFORM = [
  ["alliesOrganizations", "Allies & Organizations"],
  ["backstory", "Backstory"],
  ["notes", "Notes"],
];

// Identity details that live here rather than on the main Character tab.
const DETAILS = [
  ["name", "Name"],
  ["background", "Background"],
  ["age", "Age"],
];

function Card({ title, children }) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function FluffTab() {
  const { character, setCharacter, settings } = useTree();
  const set = (patch) => setCharacter({ ...character, ...patch });
  const setAppearance = (key, value) =>
    set({ appearance: { ...character.appearance, [key]: value } });
  const background = backgroundInfo(settings, character);
  const chosenOptions = Object.entries(
    character.creation?.background?.options || {}
  )
    .map(([groupId, choiceId]) => {
      const group = background?.optionGroups?.find((item) => item.id === groupId);
      const choice = group?.choices?.find((item) => item.id === choiceId);
      return choice ? `${group.label}: ${choice.label}` : "";
    })
    .filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <Card title="Portrait">
        <PortraitDisplay />
        <div className="mt-3">
          <TokenForge />
        </div>
      </Card>

      <Card title="Details">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {DETAILS.map(([key, label]) => (
            <div key={key} className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">{label}</Label>
              <Input
                className="h-8"
                value={character[key] || ""}
                onChange={(e) => set({ [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </Card>

      {background && (
        <Card title={`Background — ${background.name}`}>
          <p className="mb-2 text-[10px] text-muted-foreground">
            {[background.source, background.entry?.page ? `p.${background.entry.page}` : ""]
              .filter(Boolean)
              .join(" · ") || "Imported background"}
          </p>
          {background.details?.fields?.length ? (
            <dl className="mb-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
              {background.details.fields.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="font-medium text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 whitespace-pre-wrap break-words">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {chosenOptions.length > 0 && (
            <div className="mb-3 space-y-1">
              {chosenOptions.map((option) => (
                <p key={option} className="rounded border bg-accent/40 px-2 py-1 text-xs">
                  {option}
                </p>
              ))}
            </div>
          )}
          <div className="space-y-2">
            {background.details?.sections?.map((section, index) => (
              <div key={`${section.title || "section"}-${index}`}>
                {section.title ? (
                  <p className="text-xs font-semibold">{section.title}</p>
                ) : null}
                {section.text ? (
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                    {section.text}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          {background.features.length > 0 && (
            <div className="mt-3 space-y-1 border-t pt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Feature
              </p>
              {background.features.map((feature, index) => (
                <div key={`${feature.name}-${index}`}>
                  <p className="text-xs font-semibold">
                    {feature.name.replace(/^feature\s*:\s*/i, "")}
                  </p>
                  <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                    {feature.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card title="Appearance">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {APPEARANCE.map(([key, label]) => (
            <div key={key} className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">{label}</Label>
              <Input
                className="h-8"
                value={(character.appearance || {})[key] || ""}
                onChange={(e) => setAppearance(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card title="Personality">
        <div className="grid gap-3 sm:grid-cols-2">
          {PERSONALITY.map(([key, label]) => (
            <div key={key} className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">{label}</Label>
              <Textarea
                rows={2}
                value={character[key] || ""}
                onChange={(e) => set({ [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </Card>

      {LONGFORM.map(([key, label]) => (
        <Card key={key} title={label}>
          <Textarea
            rows={key === "alliesOrganizations" ? 4 : 6}
            value={character[key] || ""}
            onChange={(e) => set({ [key]: e.target.value })}
          />
        </Card>
      ))}
    </div>
  );
}