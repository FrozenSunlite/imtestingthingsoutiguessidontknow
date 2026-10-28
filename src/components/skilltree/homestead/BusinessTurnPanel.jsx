import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BUSINESS_SKILLS, BUSINESS_COMFORT, PROFIT_EVENTS, LOSS_EVENTS,
  ROUTE_PROFIT_EVENTS, ROUTE_LOSS_EVENTS, ROUTE_TYPES, SPECIALS, SEASONS,
  newBusiness, eventAt, eventGold,
} from "@/lib/homesteadBusiness";
import { rollDice } from "@/lib/homesteadTurns";
import { laborNeeds, laborAssigned } from "@/lib/homesteadLabor";
import { COMFORT_LEVELS, uid } from "@/lib/homestead";
import { useTree } from "@/lib/treeStore";
import { currencyOf } from "@/lib/currency";
import { toast } from "sonner";

const d20 = () => 1 + Math.floor(Math.random() * 20);
const useMoney = () => {
  const { settings } = useTree();
  const coin = currencyOf(settings);
  return {
    coin,
    money: (n) => `${Math.round(n).toLocaleString()} ${coin}`,
  };
};

// The Business Turn (inline on the Actions tab): establish the business with
// a 500 gp investment, then run the weekly flow — Harvest skill check into a
// Sell / Stockpile choice, a Profit/Loss event, Resupply or Scrounge, the
// Specialized Application, and Trade Routes — over the business' own funds,
// stockpile, supplies, debt and morale.
export default function BusinessTurnPanel({ plot, update, log }) {
  const biz = plot.business;
  if (!biz?.established) return <SetupCard plot={plot} update={update} log={log} />;
  return <TurnPanel plot={plot} update={update} log={log} biz={biz} />;
}

// First-time setup: pick a business type and its primary skill, then invest
// the 500 gp of starting capital.
function SetupCard({ plot, update, log }) {
  const { money } = useMoney();
  const [skill, setSkill] = useState("");
  const [type, setType] = useState("");
  const [mod, setMod] = useState("0");
  const s = BUSINESS_SKILLS.find((x) => x.skill === skill);
  const invest = () => {
    if (!s) return;
    update((p) => ({
      ...p,
      business: {
        ...newBusiness(),
        established: true,
        type: type.trim() || `${s.urban} (custom)`,
        skill: s.skill,
        ability: s.ability,
        abilityMod: Number(mod) || 0,
        funds: 500,
      },
    }));
    log({ kind: "business", text: `Business established — ${type.trim() || s.urban} (${s.skill}, ${s.ability}). Invested ${money(500)}.` });
  };
  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Start a business: secure a suitable property, then invest <span className="font-semibold">{money(500)}</span> of
        starting capital for stock, supplies and licenses. Choose the business' type and its primary skill
        (+2 to CON checks).
      </p>
      <div>
        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Business type</Label>
        <Input className="h-8" placeholder={s ? `e.g. ${s.urban}` : "Pick a skill first…"} value={type} onChange={(e) => setType(e.target.value)} />
      </div>
      <div>
        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Primary skill</Label>
        <Select value={skill} onValueChange={setSkill}>
          <SelectTrigger className="h-8"><SelectValue placeholder="Skill…" /></SelectTrigger>
          <SelectContent>
            {BUSINESS_SKILLS.map((x) => (
              <SelectItem key={x.skill} value={x.skill}>
                {x.skill} ({x.ability}) — {x.urban} / {x.suburban} / {x.remote}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {s && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Urban: {s.urban} · Suburban/Rural: {s.suburban} · Remote: {s.remote}
          </p>
        )}
      </div>
      <div>
        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Ability modifier</Label>
        <Input type="number" className="h-8 w-20" value={mod} onChange={(e) => setMod(e.target.value)} />
      </div>
      <Button size="sm" className="h-8" disabled={!s} onClick={invest}>
        Invest {money(500)} & establish
      </Button>
    </div>
  );
}

function TurnPanel({ plot, update, log, biz }) {
  const { coin, money } = useMoney();
  const [notIdeal, setNotIdeal] = useState(false);
  const [noComp, setNoComp] = useState(false);
  const [harv, setHarv] = useState(null); // pending Sell / Stockpile choice
  const [payDebt, setPayDebt] = useState("");
  const [routeType, setRouteType] = useState("local");
  const [dest, setDest] = useState("");

  const furs = plot.furnishings || [];
  const setBiz = (patch) => update((p) => ({ ...p, business: { ...(p.business || {}), ...patch } }));
  // Gains clear debt first; losses hit the funds and spill into debt.
  const gain = (amount) => update((p) => {
    const b = { ...(p.business || {}) };
    if (amount >= 0) {
      const toDebt = Math.min(b.debt || 0, amount);
      b.debt = (b.debt || 0) - toDebt;
      b.funds = (b.funds || 0) + (amount - toDebt);
    } else {
      const pot = (b.funds || 0) + amount;
      if (pot >= 0) b.funds = pot;
      else { b.funds = 0; b.debt = (b.debt || 0) - pot; }
    }
    return { ...p, business: b };
  });

  const bc0 = BUSINESS_COMFORT[plot.comfort] || BUSINESS_COMFORT.modest;
  const bc = biz.buffs?.comfortUp
    ? BUSINESS_COMFORT[COMFORT_LEVELS[Math.min(COMFORT_LEVELS.length - 1, COMFORT_LEVELS.indexOf(plot.comfort || "modest") + 1)]] || bc0
    : bc0;
  const supplies = biz.supplies || 0;
  const stockpile = biz.stockpile || 0;
  const staffBonus = plot.staff || 0;
  const hasLedger = furs.some((f) => f.type === "Ledger Room");
  const hasSNR = furs.some((f) => f.type === "Shipping & Receiving");
  const season = SEASONS[plot.season || "spring"];
  // Security: each fully-staffed Guard Post provides one guard for routes.
  const guardPosts = rows.filter((n) => n.type === "Guard Post" && laborAssigned(plot, n.id) >= n.need).length;
  const roomDice =
    (furs.some((f) => f.type === "Showroom") ? 1 : 0) +
    (furs.some((f) => f.type === "Counting House") ? 1 : 0) +
    furs.filter((f) => f.type === "Taverny").reduce((n, t) => n + Math.floor((t.w * t.h) / 2), 0);

  // Labor gating: rooms only work while staffed (Labor panel).
  const rows = laborNeeds(plot);
  const staffedType = (type) =>
    rows.some((n) => n.type === type && laborAssigned(plot, n.id) >= n.need);
  const harvestLock = rows.some(
    (n) => (n.type === "Taverny" || n.type === "Till Counter" || n.type === "Workstation") &&
      laborAssigned(plot, n.id) >= n.need
  )
    ? null
    : "Assign a worker to a Till Counter, Workstation or Taverny first (Labor panel).";
  const routeLock = (route) =>
    route.courier
      ? (staffedType("Ledger Room") ? null : "Assign a worker to the Ledger Room (Labor panel).")
      : (["Wagonstation", "Fishing Dock", "Airship Dock"].some((t) => staffedType(t))
        ? null
        : "Assign a worker to a Wagonstation, Fishing Dock or Airship Dock (Labor panel).");

  // 1. Harvest — skill check against DC 15 (±5), then Sell or Stockpile.
  const doHarvest = () => {
    const buffs = biz.buffs || {};
    const dc = 15 + (notIdeal ? 5 : 0) - (noComp ? 5 : 0) + (buffs.research ? 5 : 0) + (season.harvestDC || 0);
    const mods = staffBonus + bc.checkMod + (biz.abilityMod || 0) + (biz.ability === "CON" ? 2 : 0);
    const raws = buffs.advantage ? [d20(), d20()] : [d20()];
    const roll = Math.max(...raws) + mods;
    const check = `d20 [${raws.join(", ")}] + ${mods} vs DC ${dc}`;
    if (roll >= dc) {
      const prof = rollDice(`${bc.profitDice}d6`);
      let profit = prof.total + (biz.abilityMod || 0) + 2 * staffBonus;
      if (roomDice) profit += rollDice(`${roomDice}d6`).total;
      if (buffs.profitBonusDice) profit += rollDice(buffs.profitBonusDice).total;
      if (buffs.double) profit *= 2;
      if (season.profitBonusDice) profit += rollDice(season.profitBonusDice).total;
      setHarv({ ok: true, profit, check, prof: prof.detail });
    } else {
      const loss = rollDice(`${bc.lossDice}d6`);
      let total = loss.total;
      if (buffs.lossReduceDice) total = Math.max(0, total - rollDice(buffs.lossReduceDice).total);
      if (buffs.marketing) total += rollDice("2d6").total;
      gain(-total);
      setHarv({ ok: false, loss: total, check, detail: loss.detail });
    }
    // Weekly buffs are spent; morale follows the week's result.
    setBiz({ buffs: {}, morale: Math.min(20, Math.max(1, (biz.morale ?? 11) + (roll >= dc ? 1 : -1))) });
  };

  // 2. Profit/Loss event.
  const rollEvent = () => {
    const r = d20();
    const ev = eventAt(r >= 8 ? PROFIT_EVENTS : LOSS_EVENTS, r);
    let text = `Profit/Loss event d20 [${r}] — ${ev.name}: ${ev.text}`;
    if (ev.gold) {
      const amt = eventGold(ev.gold);
      gain(amt);
      text += ` (${amt >= 0 ? "+" : "−"}${money(Math.abs(amt))})`;
    }
    if (ev.clear === "stockpile") setBiz({ stockpile: 0 });
    if (ev.clear === "supplies") setBiz({ supplies: 0 });
    setBiz({ morale: Math.min(20, Math.max(1, (biz.morale ?? 11) + (r >= 8 ? 1 : -1))) });
    log({ kind: "business", text });
  };

  // 3. Resupply (Ledger Room) or Scrounge.
  const doResupply = () => {
    const r = rollDice("1d6");
    const weeks = r.total + 1 + (hasSNR ? 2 : 0);
    const cost = 4 * weeks;
    if ((biz.funds || 0) < cost) return toast(`Resupply costs ${money(cost)} — the business only holds ${money(biz.funds || 0)}.`);
    gain(-cost);
    setBiz({ supplies: supplies + weeks });
    log({ kind: "business", text: `Resupplied: 1d6 [${r.total}] +1 → ${weeks} weeks of supplies for ${money(cost)}.` });
  };
  const scrounge = () => {
    if ((biz.funds || 0) < 12) return toast(`Scrounging costs 12 ${coin} - the business can't cover it.`);
    gain(-12);
    setBiz({ supplies: supplies + 2 });
    log({ kind: "business", text: `Scrounged local resources - 12 ${coin} for 2 weeks of supplies.` });
  };

  // 4. Specialized Application — one per week across businesses.
  const pendingBuff = Object.keys(biz.buffs || {}).length > 0;
  const applySpecial = () => {
    const a = biz.ability;
    if (a === "STR") setBiz({ buffs: { advantage: true, double: true } });
    else if (a === "DEX") { gain(75); log({ kind: "business", text: "Fine Crafting — created one item worth 75 gp." }); }
    else if (a === "CON") setBiz({ buffs: { profitBonusDice: "1d6", lossReduceDice: "1d6" } });
    else if (a === "INT") setBiz({ buffs: { research: true } });
    else if (a === "WIS") log({ kind: "business", text: "Non-profit mission — no Taxes or Utilities for 1 month." });
    else if (a === "CHA") setBiz({ buffs: { marketing: true, comfortUp: true } });
    if (a !== "DEX" && a !== "WIS")
      log({ kind: "business", text: `${SPECIALS[a].name} used — ${SPECIALS[a].text}` });
  };

  // 5. Trade Routes.
  const routes = biz.routes || [];
  const nonCourier = routes.filter((r) => !r.courier).length;
  const couriers = routes.filter((r) => r.courier).length;
  const guardsAssigned = routes.reduce((n, r) => n + (r.guards || 0), 0);
  const addRoute = (courier) => {
    const rt = ROUTE_TYPES.find((t) => t.id === routeType);
    if (courier) {
      if (!hasLedger) return toast("Couriers need a Ledger Room.");
      if (couriers >= 4) return toast("At most 4 courier-operated routes per business.");
    }
    const cap = hasLedger ? 10 : 3;
    if (routes.length >= cap)
      return toast(`Trade route limit: ${cap}${hasLedger ? " (Ledger Room)" : " — a Ledger Room raises it to 10"}.`);
    setBiz({ routes: [...routes, { id: uid(), type: rt.id, dc: rt.dc, bonus: rt.bonus, courier, destination: dest.trim() }] });
    log({ kind: "business", text: `Established a ${rt.label}${dest.trim() ? ` bound for ${dest.trim()}` : ""}${courier ? " (courier)" : ""} — DC ${rt.dc}${rt.bonus ? `, +${rt.bonus}d6 profit bonus` : ""}.` });
    setDest("");
  };
  const resolveRoute = (route) => {
    const mods = (route.courier ? 2 : (biz.abilityMod || 0)) + 2 * (route.guards || 0) + (season.routeMod || 0);
    const roll = d20() + mods;
    const ok = roll >= route.dc;
    let text = `${(ROUTE_TYPES.find((t) => t.id === route.type) || {}).label || route.type}${route.destination ? ` bound for ${route.destination}` : ""}${route.courier ? " (courier)" : ""}: d20 + ${mods} = ${roll} vs DC ${route.dc} — ${ok ? "success" : "failure"}`;
    if (ok) {
      let profit = Math.ceil(bc.profitDice / 2) + (route.courier ? 0 : (biz.abilityMod || 0));
      if (route.bonus) profit += rollDice(`${route.bonus}d6`).total;
      gain(profit);
      text += ` — earned ${money(profit)}`;
    }
    if (!route.courier) {
      const r = d20();
      const ev = eventAt(ok ? ROUTE_PROFIT_EVENTS : ROUTE_LOSS_EVENTS, r);
      text += `. Route event d20 [${r}] — ${ev.name}: ${ev.text}`;
      if (ev.gold) {
        let amt = eventGold(ev.gold);
        if (amt < 0 && (route.guards || 0)) amt = Math.ceil(amt / 2); // guards blunt losses
        gain(amt);
        text += ` (${amt >= 0 ? "+" : "−"}${money(Math.abs(amt))})`;
      }
    }
    log({ kind: "business", text });
  };

  const settleDebt = () => {
    const amt = Math.min(Number(payDebt) || 0, biz.funds || 0, biz.debt || 0);
    if (amt <= 0) return;
    setBiz({ funds: (biz.funds || 0) - amt, debt: (biz.debt || 0) - amt, morale: Math.min(20, (biz.morale ?? 11) + 1) });
    log({ kind: "business", text: `Paid ${money(amt)} toward the business debt — morale +1.` });
    setPayDebt("");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
        <span className="font-semibold">{biz.type}</span>
        <span className="text-muted-foreground">{biz.skill} ({biz.ability})</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Season</Label>
        <Select value={plot.season || "spring"} onValueChange={(v) => update((p) => ({ ...p, season: v }))}>
          <SelectTrigger className="h-7 w-24 text-[11px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(SEASONS).map(([id, s]) => <SelectItem key={id} value={id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground">{season.note}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
        <KV label="Funds" value={money(biz.funds || 0)} />
        <KV label="Stockpile" value={money(stockpile)} />
        <KV label="Supplies" value={`${supplies} wk`} />
        <KV label="Debt" value={money(biz.debt || 0)} />
        <KV label="Profit roll" value={`${bc.profitDice}d6 · loss ${bc.lossDice}d6`} />
        <KV label="Check mod" value={`${bc.checkMod >= 0 ? "+" : ""}${bc.checkMod}`} />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground">Morale {biz.morale ?? 11}/20</span>
        <Button variant="outline" size="sm" className="h-5 w-5 p-0 text-[10px]" disabled={(biz.morale ?? 11) <= 1}
          onClick={() => setBiz({ morale: Math.max(1, (biz.morale ?? 11) - 1) })}>−</Button>
        <Button variant="outline" size="sm" className="h-5 w-5 p-0 text-[10px]" disabled={(biz.morale ?? 11) >= 20}
          onClick={() => setBiz({ morale: Math.min(20, (biz.morale ?? 11) + 1) })}>+</Button>
        <span className="text-[10px] text-muted-foreground">auto-adjusts with harvests, events and debt payments</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Ability mod</Label>
        <Input type="number" className="h-7 w-16" value={biz.abilityMod ?? 0}
          onChange={(e) => setBiz({ abilityMod: Number(e.target.value) || 0 })} />
        <span className="text-[10px] text-muted-foreground">{staffBonus} hireling{staffBonus === 1 ? "" : "s"}: +{staffBonus} to checks, +{2 * staffBonus} gp to profits</span>
      </div>

      {/* 1. Harvest */}
      <div className="rounded-md border p-2">
        <p className="text-xs font-semibold">1 · Harvest</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          Skill check (DC 15{notIdeal ? " +5 not ideal" : ""}{noComp ? " −5 no competition" : ""}); success rolls
          {" "}{bc.profitDice}d6 + ability mod{roomDice ? ` + ${roomDice}d6 room bonuses` : ""}. Then Sell (2× profit + 2×
          ability mod) or Stockpile. Failure rolls {bc.lossDice}d6 into losses.
        </p>
        <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" checked={notIdeal} onChange={(e) => setNotIdeal(e.target.checked)} /> Not the ideal location (+5 DC)
          </label>
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" checked={noComp} onChange={(e) => setNoComp(e.target.checked)} /> No competition (−5 DC)
          </label>
        </div>
        {supplies === 0 ? (
          stockpile > 0 ? (
            <div className="mt-1.5">
              <p className="text-[11px] text-destructive">Out of supplies — the Harvest auto-fails, but stockpiled goods can be sold in its place.</p>
              <Button size="sm" variant="secondary" className="mt-1 h-6 text-[11px]"
                onClick={() => { gain(stockpile); log({ kind: "business", text: `Sold stockpiled goods — ${money(stockpile)}.` }); setBiz({ stockpile: 0 }); }}>
                Sell stockpile ({money(stockpile)})
              </Button>
            </div>
          ) : (
            <p className="mt-1.5 text-[11px] text-destructive">Out of supplies — the Harvest action auto-fails. Resupply first.</p>
          )
        ) : harvestLock ? (
          <p className="mt-1.5 text-[11px] text-destructive">{harvestLock}</p>
        ) : harv?.ok ? (
          <div className="mt-1.5 space-y-1 rounded border p-2">
            <p className="text-[11px]">{harv.check} — <span className="font-semibold text-primary">Success!</span> Profit: {harv.prof} + mods = {money(harv.profit)}</p>
            <div className="flex gap-1">
              <Button size="sm" variant="secondary" className="h-6 text-[11px]"
                onClick={() => { const amt = 2 * harv.profit + 2 * (biz.abilityMod || 0); gain(amt); log({ kind: "business", text: `Harvest sold — ${harv.check}: ${money(amt)} (2× profit + 2× ability mod).` }); setHarv(null); }}>
                Sell ({money(2 * harv.profit + 2 * (biz.abilityMod || 0))})
              </Button>
              <Button size="sm" variant="secondary" className="h-6 text-[11px]"
                onClick={() => { setBiz({ stockpile: stockpile + harv.profit }); log({ kind: "business", text: `Harvest stockpiled — ${harv.check}: ${money(harv.profit)} stored.` }); setHarv(null); }}>
                Stockpile ({money(harv.profit)})
              </Button>
            </div>
          </div>
        ) : harv ? (
          <div className="mt-1.5 space-y-1 rounded border p-2">
            <p className="text-[11px]">{harv.check} — <span className="font-semibold text-destructive">Failure.</span> Losses: {harv.detail} = {money(harv.loss)}</p>
            {stockpile > 0 && (
              <Button size="sm" variant="secondary" className="h-6 text-[11px]"
                onClick={() => { gain(stockpile); log({ kind: "business", text: `Sold stockpiled goods to cover the failure — ${money(stockpile)}.` }); setBiz({ stockpile: 0 }); }}>
                Sell stockpile instead ({money(stockpile)})
              </Button>
            )}
          </div>
        ) : (
          <Button size="sm" variant="secondary" className="mt-1.5 h-6 text-[11px]" onClick={doHarvest}>
            Harvest check ({biz.skill})
          </Button>
        )}
      </div>

      {/* 2. Profit/Loss event */}
      <div className="rounded-md border p-2">
        <p className="text-xs font-semibold">2 · Profit / Loss event</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">d20: 8 or higher is a Profit event, 7 or lower a Loss event.</p>
        <Button size="sm" variant="secondary" className="mt-1 h-6 text-[11px]" onClick={rollEvent}>Roll event (d20)</Button>
      </div>

      {/* 3. Resupply */}
      <div className="rounded-md border p-2">
        <p className="text-xs font-semibold">3 · Resupply</p>
        {hasLedger && staffedType("Ledger Room") ? (
          <>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Ledger Room: roll 1d6+1 weeks of supplies at 4 gp × the result{hasSNR ? " (+2 weeks from Shipping & Receiving)" : ""}.
            </p>
            <Button size="sm" variant="secondary" className="mt-1 h-6 text-[11px]" onClick={doResupply}>Resupply (1d6+1)</Button>
          </>
        ) : hasLedger ? (
          <p className="mt-1.5 text-[11px] text-destructive">Assign a worker to the Ledger Room to Resupply (Labor panel).</p>
        ) : (
          <>
            <p className="mt-0.5 text-[11px] text-muted-foreground">No Ledger Room - scrounge local resources: 12 {coin} keeps you stocked for 2 weeks.</p>
            <Button size="sm" variant="secondary" className="mt-1 h-6 text-[11px]" onClick={scrounge}>Scrounge (12 {coin}, 2 weeks)</Button>
          </>
        )}
      </div>

      {/* 4. Specialized application */}
      <div className="rounded-md border p-2">
        <p className="text-xs font-semibold">4 · {SPECIALS[biz.ability].name}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{SPECIALS[biz.ability].text} One per week across all businesses.</p>
        {biz.ability === "DEX" || biz.ability === "WIS" ? (
          <Button size="sm" variant="secondary" className="mt-1 h-6 text-[11px]" onClick={applySpecial}>Use {SPECIALS[biz.ability].name}</Button>
        ) : (
          <Button size="sm" variant="secondary" className="mt-1 h-6 text-[11px]" disabled={pendingBuff} onClick={applySpecial}>
            {pendingBuff ? "Buff already waiting for next Harvest" : `Prepare ${SPECIALS[biz.ability].name}`}
          </Button>
        )}
      </div>

      {/* 5. Trade routes */}
      <div className="rounded-md border p-2">
        <p className="text-xs font-semibold">5 · Trade Routes ({routes.length}{hasLedger ? "/10" : "/3"})</p>
        {guardPosts > 0 && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Security: {guardPosts} staffed Guard Post{guardPosts === 1 ? "" : "es"} — assign guards to a route
            (+2 to its check, losses halved), up to 2 per route.
          </p>
        )}
        {routes.length === 0 && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Needs a staffed Wagonstation, Fishing Dock or Airship Dock (or a Ledger Room for couriers at 30 gp/month each).
          </p>
        )}
        <div className="mt-1 space-y-1">
          {routes.map((r) => {
            const lock = routeLock(r);
            const rt = ROUTE_TYPES.find((t) => t.id === r.type) || {};
            return (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded border p-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium">{rt.label || r.type}{r.courier ? " · courier" : ""}</p>
                  <p className="text-[10px] text-muted-foreground">
                    DC {r.dc}{r.bonus ? ` · +${r.bonus}d6` : ""}{r.guards ? ` · ${r.guards} guard${r.guards > 1 ? "s" : ""}` : ""}
                  </p>
                  <Input
                    className="mt-0.5 h-6 text-[11px]"
                    placeholder="Where is it heading?"
                    value={r.destination || ""}
                    onChange={(e) =>
                      setBiz({
                        routes: routes.map((x) => (x.id === r.id ? { ...x, destination: e.target.value } : x)),
                      })
                    }
                  />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {guardPosts > 0 && (
                    <>
                      <Button size="sm" variant="ghost" className="h-6 px-1 text-[10px]"
                        title="Assign a guard (+2 to checks, losses halved)"
                        disabled={(r.guards || 0) >= 2 || guardsAssigned >= guardPosts}
                        onClick={() => setBiz({ routes: routes.map((x) => (x.id === r.id ? { ...x, guards: (x.guards || 0) + 1 } : x)) })}>+g</Button>
                      <Button size="sm" variant="ghost" className="h-6 px-1 text-[10px]"
                        title="Release a guard"
                        disabled={!(r.guards || 0)}
                        onClick={() => setBiz({ routes: routes.map((x) => (x.id === r.id ? { ...x, guards: (x.guards || 0) - 1 } : x)) })}>−g</Button>
                    </>
                  )}
                  <Button size="sm" variant="secondary" className="h-6 text-[11px]" disabled={!!lock} onClick={() => resolveRoute(r)}>Run</Button>
                  <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[11px]" onClick={() => setBiz({ routes: routes.filter((x) => x.id !== r.id) })}>✕</Button>
                </div>
              </div>
            );
          })}
        </div>
        {routes.some((r) => routeLock(r)) && (
          <p className="mt-1 text-[10px] text-destructive">{routes.map((r) => routeLock(r)).find(Boolean)}</p>
        )}
        <div className="mt-1.5 flex items-end gap-1">
          <Input
            className="h-7 min-w-28 flex-1 text-[11px]"
            placeholder="Where is the route heading?"
            value={dest}
            onChange={(e) => setDest(e.target.value)}
          />
          <Select value={routeType} onValueChange={setRouteType}>
            <SelectTrigger className="h-7 w-40 text-[11px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROUTE_TYPES.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.label} — DC {t.dc}{t.bonus ? `, +${t.bonus}d6` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => addRoute(false)}>Add route</Button>
          {hasLedger && (
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => addRoute(true)}>Add courier</Button>
          )}
        </div>
      </div>

      {/* Debt & bookkeeping */}
      {(biz.debt || 0) > 0 && (
        <div className="rounded-md border p-2">
          <p className="text-xs font-semibold">Business debt</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Unpaid losses accrue 25% interest monthly; harvest gains clear debt first. Above 500 {coin} the business fails.
          </p>
          <div className="mt-1 flex items-center gap-1">
            <Input type="number" className="h-7 w-24" placeholder="Pay gp" value={payDebt} onChange={(e) => setPayDebt(e.target.value)} />
            <Button size="sm" variant="secondary" className="h-7 text-[11px]" onClick={settleDebt}>Pay</Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => { setBiz({ debt: Math.ceil((biz.debt || 0) * 1.25), morale: Math.max(1, (biz.morale ?? 11) - 1) }); log({ kind: "business", text: "Monthly interest accrued — debt +25%, morale −1." }); }}>
              +25% interest
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const KV = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);