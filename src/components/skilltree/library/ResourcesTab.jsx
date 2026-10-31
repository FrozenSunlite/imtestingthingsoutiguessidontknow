import { useTree } from "@/lib/treeStore";
import { useLibList, ListHeader, EmptyNote, EntryCard } from "./shared";
import { Input } from "@/components/ui/input";
import { benefitDragProps } from "@/lib/benefits";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfoTip } from "@/components/skilltree/InfoTip";
import { dieLadder, resolveResourceDie } from "@/lib/dieScaling";

const DIE_SIZES = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];
const modeOf = (e) => e.dieMode || (e.dieSize ? "static" : e.dieScale ? "scale" : "none");

// Reference Library tab for custom resources: points/pools the character
// sheet tracks (Ki, Channel Divinity, Arcanovital Energy…). A resource may
// carry a static die (with a quantity) or start somewhere on the die-scaling
// ladder — the sheet shows e.g. "Ki Points 4 · 2d6" and nodes can move that
// die up or down the ladder, or pin it outright.
export function ResourcesTab() {
  const { settings } = useTree();
  const { items, add, patch, remove, query, setQuery, shown } = useLibList("resources");
  const ladder = dieLadder(settings?.library);

  const setMode = (i, e, mode) => {
    patch(i, {
      dieMode: mode,
      ...(mode === "none" ? { dieSize: "", dieScale: "" } : {}),
      ...(mode === "scale" && !e.dieScale ? { dieScale: ladder[0] } : {}),
    });
  };

  return (
    <div className="space-y-2">
      <ListHeader
        onAdd={() =>
          add({
            name: "",
            color: "#ffffff",
            dieMode: "none",
            dieSize: "",
            dieCount: 1,
            dieScale: "",
            description: "",
          })
        }
        addLabel="Add resource"
        query={query}
        setQuery={setQuery}
        searchPlaceholder="Search resources…"
      />
      <p className="text-[10px] text-muted-foreground">
        Resources defined here appear on the character sheet. Their die can be static (e.g. 2d6) or
        follow the die-scaling ladder from a chosen step. Nodes can raise or lower it by steps, or
        override it.
      </p>
      {shown.length === 0 ? (
        <EmptyNote items={items} query={query} />
      ) : (
        shown.map(({ e, i }) => {
          const mode = modeOf(e);
          const resolved = resolveResourceDie(e, settings?.library);
          return (
            <EntryCard
              key={i}
              entry={e}
              onPatch={(p) => patch(i, p)}
              onDelete={() => remove(i)}
              dragProps={benefitDragProps("resource", e.name, {
                description: e.description,
              })}
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <InfoTip label="The resource's display name — node resources can add to or replace it by this name.">
                    <Input
                      className="h-8 flex-1"
                      placeholder="Resource name (e.g. Ki Points)"
                      value={e.name || ""}
                      onChange={(ev) => patch(i, { name: ev.target.value })}
                    />
                  </InfoTip>
                  <InfoTip label="Colour used for the resource on the sheet.">
                    <input
                      type="color"
                      className="h-8 w-9 shrink-0 rounded border"
                      value={e.color || "#ffffff"}
                      onChange={(ev) => patch(i, { color: ev.target.value })}
                    />
                  </InfoTip>
                </div>
                <div className="flex items-center gap-1">
                  <InfoTip label="No die for this resource, a fixed die, or a die that grows along the scaling ladder.">
                    <Select value={mode} onValueChange={(v) => setMode(i, e, v)}>
                      <SelectTrigger className="h-8 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— no die —</SelectItem>
                        <SelectItem value="static">Static die</SelectItem>
                        <SelectItem value="scale">Scaling die</SelectItem>
                      </SelectContent>
                    </Select>
                  </InfoTip>
                  {mode === "static" && (
                    <>
                      <InfoTip label="How many of that die are rolled when the resource is used.">
                        <Input
                          className="h-8 w-16"
                          type="number"
                          min={1}
                          placeholder="1"
                          value={e.dieCount ?? 1}
                          onChange={(ev) =>
                            patch(i, {
                              dieCount: ev.target.value === "" ? 1 : Number(ev.target.value) || 1,
                            })
                          }
                        />
                      </InfoTip>
                      <InfoTip label="The size of a single die.">
                        <Select
                          value={e.dieSize || "d6"}
                          onValueChange={(v) => patch(i, { dieSize: v })}
                        >
                          <SelectTrigger className="h-8 w-20">
                            <SelectValue placeholder="Die" />
                          </SelectTrigger>
                          <SelectContent>
                            {DIE_SIZES.map((d) => (
                              <SelectItem key={d} value={d}>
                                {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </InfoTip>
                    </>
                  )}
                  {mode === "scale" && (
                    <InfoTip label="The ladder step this die starts at. Nodes can then raise or lower it step by step.">
                      <Select
                        value={e.dieScale || ladder[0]}
                        onValueChange={(v) => patch(i, { dieScale: v })}
                      >
                        <SelectTrigger className="h-8 min-w-0 flex-1">
                          <SelectValue placeholder="Starting step" />
                        </SelectTrigger>
                        <SelectContent>
                          {ladder.map((step, idx) => (
                            <SelectItem key={`${step}-${idx}`} value={step}>
                              {idx + 1}. {step}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </InfoTip>
                  )}
                  {resolved && /\d*d\d/.test(resolved.text) && (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-1 font-mono text-[10px] text-muted-foreground">
                      {resolved.text}
                    </span>
                  )}
                </div>
              </div>
            </EntryCard>
          );
        })
      )}
    </div>
  );
}
