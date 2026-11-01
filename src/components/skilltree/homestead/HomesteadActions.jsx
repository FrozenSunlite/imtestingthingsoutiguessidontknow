import { Button } from "@/components/ui/button";
import { bastionFacilityByName } from "@/lib/homestead";
import { BASTION_ORDERS } from "@/lib/homesteadBastionOrders";

// The downtime actions this plot can perform right now: the at-home
// activities its placed rooms unlock, the business turn actions, and every
// placed special facility's Bastion order — each listed with its rules text
// and, where the rules roll dice or issue an order, a button to do it.
export default function HomesteadActions({ plot, update }) {
  const log = (entry) =>
    update((p) => ({
      ...p,
      turnLog: [...(p.turnLog || []), { at: new Date().toISOString(), ...entry }].slice(-60),
    }));
  const home = homeActions(plot);
  const bastion = (plot.facilities || []).filter((f) => f.bastion && BASTION_ORDERS[f.bastion]);

  if (!home.length && !bastion.length) {
    return (
      <div className="rounded-lg border bg-accent/30 p-3 text-xs">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Downtime actions</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Nothing to do yet — place rooms and special facilities to unlock downtime actions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded-lg border bg-accent/30 p-3 text-xs">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Downtime actions</p>
      {home.length > 0 && (
        <Section title="Home">
          {home.map((a) => (
            <ActionCard key={a.id} a={a} badge="activity" />
          ))}
        </Section>
      )}
      {bastion.length > 0 && (
        <Section title="Bastion">
          {bastion.map((f) => {
            const o = BASTION_ORDERS[f.bastion];
            const short = (bastionFacilityByName(f.bastion)?.hirelings || 0) - ((plot.labor || {})[f.id] || 0);
            return (
              <ActionCard
                key={f.id}
                a={{ id: f.id, name: f.name, order: o.order, desc: o.effect }}
                badge={o.order}
                locked={short > 0}
                lockNote={short > 0 ? `Needs ${short} more hireling${short === 1 ? "" : "s"} assigned — use the Labor panel.` : null}
                action={
                  <Button
                    size="sm" variant="secondary" className="mt-1.5 h-6 text-[11px]"
                    disabled={short > 0}
                    onClick={() => log({ kind: "bastion", text: `${f.name} — ${o.order} issued. ${o.effect}` })}
                  >
                    Issue {o.order} order
                  </Button>
                }
              />
            );
          })}
        </Section>
      )}
    </div>
  );
}

// The home downtime activities the placed rooms unlock (rooms inside Cellar /
// Floor / Attic attachments count too).
function homeActions(plot) {
  const furs = [...(plot.furnishings || [])];
  for (const f of plot.facilities || []) {
    for (const key of ["attic", "floor", "cellar"]) {
      for (const it of f[key]?.items || []) furs.push({ type: it.type, w: it.w, h: it.h });
    }
  }
  const count = (type) => furs.filter((fu) => fu.type === type).length;
  const spaces = (type) => furs.filter((fu) => fu.type === type).reduce((n, fu) => n + fu.w * fu.h, 0);
  const acts = [];
  const beds = spaces("Bedroom");
  if (beds)
    acts.push({
      id: "longrest", name: "Long rest",
      desc: `Sleep at home: +1 Hit Die per Bedroom space recovered on a long rest here (${beds} space${beds === 1 ? "" : "s"}).`,
    });
  const produce = spaces("Garden") + spaces("Farmland");
  if (produce)
    acts.push({
      id: "harvest", name: "Harvest produce",
      desc: `2 lbs per space per week — ${spaces("Garden")} Garden + ${spaces("Farmland")} Farmland spaces (not in Winter).`,
    });
  if (count("Kitchen") && produce)
    acts.push({
      id: "cook", name: "Cook rations",
      desc: "2 lbs of Garden or Farmland produce become 1 Ration in the Kitchen.",
    });
  if (count("Infirmary")) {
    const staffed = (plot.furnishings || []).some(
      (fu) => fu.type === "Infirmary" && ((plot.labor || {})[fu.id] || 0) >= 1
    );
    acts.push({
      id: "treat", name: "Treat the wounded",
      desc: "5 gp per person; short rests here restore +3 Hit Dice at the cost of one Exhaustion level.",
      locked: staffed ? null : "Assign a worker to the Infirmary to treat the wounded (Labor panel).",
    });
  }
  if (count("Bathhouse"))
    acts.push({
      id: "bathe", name: "Bathe",
      desc: "Bathing grants advantage on saving throws against disease for 24 hours.",
    });
  return acts;
}

function Section({ title, children }) {
  return (
    <div className="border-t pt-1.5 first:border-t-0 first:pt-0">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>
      <div className="mt-1 space-y-1.5">{children}</div>
    </div>
  );
}

function ActionCard({ a, badge, action, result, locked: _locked, lockNote }) {
  return (
    <div className="rounded-md border p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{a.name}</span>
        {badge && (
          <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider">{badge}</span>
        )}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{a.desc}</p>
      {lockNote && <p className="mt-1 text-[11px] text-destructive">{lockNote}</p>}
      {action}
      {result}
    </div>
  );
}