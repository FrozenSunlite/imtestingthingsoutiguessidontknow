import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Dices } from "lucide-react";
import { BIOMES, ERAS, SCALES, THEMES } from "@/lib/worldGen";

const randomSeed = () =>
  `${Math.random().toString(36).slice(2, 7)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

export function SettingForm({ onCreate, compact = false }) {
  const [name, setName] = useState("");
  const [seed, setSeed] = useState(randomSeed);
  const [eraId, setEraId] = useState("medieval");
  const [theme, setTheme] = useState("High Fantasy");
  const [scaleId, setScaleId] = useState("kingdom");
  const [realmName, setRealmName] = useState("");
  const [biomes, setBiomes] = useState(["grassland", "forest", "hills", "mountains", "coast"]);

  const toggleBiome = (id) =>
    setBiomes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const surprise = () => {
    setSeed(randomSeed());
    setTheme(THEMES[Math.floor(Math.random() * THEMES.length)]);
    setEraId(ERAS[Math.floor(Math.random() * ERAS.length)].id);
    setScaleId(SCALES[Math.floor(Math.random() * SCALES.length)].id);
  };

  return (
    <div className={`space-y-3 ${compact ? "" : "rounded-lg border bg-card p-4"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold">Create a setting</h2>
          <p className="text-xs text-muted-foreground">
            Choose an era, theme, scale and the biomes that shape the world. Everything is
            procedural and editable afterward.
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={surprise}>
          <Dices className="mr-1 h-3.5 w-3.5" /> Surprise me
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">Setting name</Label>
          <Input className="h-8" placeholder="The Shattered Crown" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Seed</Label>
          <div className="flex gap-1">
            <Input className="h-8" value={seed} onChange={(e) => setSeed(e.target.value)} />
            <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => setSeed(randomSeed())}>
              <Dices className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Era</Label>
          <Select value={eraId} onValueChange={setEraId}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ERAS.map((era) => (
                <SelectItem key={era.id} value={era.id}>{era.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Theme</Label>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {THEMES.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Scale</Label>
          <Select value={scaleId} onValueChange={setScaleId}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SCALES.map((scale) => (
                <SelectItem key={scale.id} value={scale.id}>{scale.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Primary realm / planet / plane</Label>
          <Input className="h-8" placeholder="Auto-generated" value={realmName} onChange={(e) => setRealmName(e.target.value)} />
        </div>
      </div>

      <div>
        <Label className="text-[10px] text-muted-foreground">Biomes</Label>
        <div className="mt-1 flex flex-wrap gap-1">
          {BIOMES.map((biome) => {
            const active = biomes.includes(biome.id);
            return (
              <button
                key={biome.id}
                type="button"
                onClick={() => toggleBiome(biome.id)}
                className={`rounded-full border px-2 py-1 text-[10px] ${
                  active ? "border-primary bg-primary/15 font-medium" : "text-muted-foreground hover:bg-accent"
                }`}
                title={biome.assets.join(", ")}
              >
                <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: biome.color }} />
                {biome.label}
              </button>
            );
          })}
        </div>
      </div>

      <Button
        className="w-full"
        onClick={() =>
          onCreate({
            name: name.trim(),
            seed: seed.trim() || randomSeed(),
            eraId,
            theme,
            scaleId,
            realmName: realmName.trim(),
            selectedBiomes: biomes,
          })
        }
      >
        <Sparkles className="mr-1 h-4 w-4" /> Generate setting
      </Button>
    </div>
  );
}
