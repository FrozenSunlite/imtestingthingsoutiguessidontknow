import { useTree } from "@/lib/treeStore";
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
  const { character, setCharacter } = useTree();
  const set = (patch) => setCharacter({ ...character, ...patch });
  const setAppearance = (key, value) =>
    set({ appearance: { ...character.appearance, [key]: value } });

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