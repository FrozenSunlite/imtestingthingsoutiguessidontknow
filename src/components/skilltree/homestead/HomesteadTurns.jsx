import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { bastionFacilityByName, plotKinds } from "@/lib/homestead";
import { BASTION_ORDERS } from "@/lib/homesteadBastionOrders";
import BusinessTurnPanel from "./BusinessTurnPanel";

// Bastion & business turns, side by side on the Actions tab: switch between
// the two turn panels, issue each special facility its documented order, run
// the business flow, and keep the results in a clearable feed on the plot.
export default function HomesteadTurns({ plot, update }) {
  const [mode, setMode] = useState("bastion");
  if (!plot) return null;
  const bastion = plotKinds(plot).includes("bastion");
  const business = plotKinds(plot).includes("business");
  const eff = mode === "bastion" && !bastion ? (business ? "business" : "bastion") : mode;

  const log = (entry) =>
    update((p) => ({
      ...p,
      turnLog: [...(p.turnLog || []), { at: new Date().toISOString(), ...entry }].slice(-60),
    }));

  const logLine = (e) =>
    `[${new Date(e.at).toLocaleString("en-US", { month: "short", day: "numeric" })}] ${e.text}`;

  return (
    <div className="space-y-1.5 rounded-lg border bg-accent/30 p-3 text-xs">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Turns</p>
      <Tabs value={eff} onValueChange={setMode}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="bastion" disabled={!bastion} className="text-[11px]">Bastion Turn</TabsTrigger>
          <TabsTrigger value="business" disabled={!business} className="text-[11px]">Business Turn</TabsTrigger>
        </TabsList>
        <TabsContent value="bastion" className="mt-2">
          <BastionPanel plot={plot} log={log} />
        </TabsContent>
        <TabsContent value="business" className="mt-2">
          <BusinessTurnPanel plot={plot} update={update} log={log} />
        </TabsContent>
      </Tabs>

      <div className="border-t pt-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Turn feed</p>
          {(plot.turnLog || []).length > 0 && (
            <Button
              variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]"
              onClick={() => update((p) => ({ ...p, turnLog: [] }))}
            >
              Clear feed
            </Button>
          )}
        </div>
        {(plot.turnLog || []).length > 0 && (
          <div className="mt-1 max-h-32 space-y-0.5 overflow-y-auto">
            {[...(plot.turnLog || [])].reverse().slice(0, 12).map((e, i) => (
              <p key={i} className="leading-snug text-muted-foreground">{logLine(e)}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Every placed special facility and its documented order; facilities you
// leave un-ordered default to Maintain.
function BastionPanel({ plot, log }) {
  const placed = (plot.facilities || []).filter((f) => f.bastion && BASTION_ORDERS[f.bastion]);
  if (placed.length === 0) {
    return <p className="text-xs text-muted-foreground">Place special facilities to give them orders.</p>;
  }
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground">
        Every 7 days, issue one order to each special facility (DMG'24). Facilities you
        leave un-ordered default to Maintain.
      </p>
      {placed.map((f) => {
        const o = BASTION_ORDERS[f.bastion];
        const short = (bastionFacilityByName(f.bastion)?.hirelings || 0) - ((plot.labor || {})[f.id] || 0);
        return (
          <div key={f.id} className="rounded-md border p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold">{f.name}</span>
              <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider">{o.order}</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{o.effect}</p>
            <Button
              size="sm" variant="secondary" className="mt-1.5 h-6 text-[11px]"
              disabled={short > 0}
              onClick={() => {
                let text = `${f.name} — ${o.order} issued`;
                if (o.effect) text += `. ${o.effect}`;
                log({ kind: "bastion", text });
              }}
            >
              Issue {o.order} order
            </Button>
            {short > 0 && (
              <p className="mt-1 text-[11px] text-destructive">
                Needs {short} more hireling{short === 1 ? "" : "s"} assigned — use the Labor panel.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}