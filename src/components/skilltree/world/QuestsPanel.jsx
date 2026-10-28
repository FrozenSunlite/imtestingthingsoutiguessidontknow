import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  acceptQuest,
  advanceQuest,
  completeQuest,
  generateQuest,
  generateQuestBoard,
} from "@/lib/questGen";
import { Coins, Dices, MapPin, ScrollText, Swords, UserRound, Check } from "lucide-react";

const STATUS_ORDER = { available: 0, active: 1, ready: 2, complete: 3 };
const STATUS_LABEL = {
  available: "Available",
  active: "In progress",
  ready: "Ready to turn in",
  complete: "Complete",
};

const fmt = (n) => Number(n || 0).toLocaleString();

export function QuestsPanel({ world, character, onChange, onStartCombat }) {
  const [level, setLevel] = useState(character?.level || 1);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [selectedId, setSelectedId] = useState("");

  const quests = useMemo(() => {
    const text = query.trim().toLowerCase();
    return [...(world?.quests || [])]
      .filter((quest) => statusFilter === "__all__" || quest.status === statusFilter)
      .filter((quest) =>
        !text
          ? true
          : `${quest.title} ${quest.typeLabel} ${quest.patronName} ${quest.settlementName} ${quest.objective}`
              .toLowerCase()
              .includes(text)
      )
      .sort((a, b) => {
        const byStatus = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
        if (byStatus !== 0) return byStatus;
        return (b.level || 0) - (a.level || 0);
      });
  }, [world, query, statusFilter]);

  const selected = (world?.quests || []).find((quest) => quest.id === selectedId) || quests[0] || null;

  if (!(world?.settlements || []).length) {
    return <p className="text-xs text-muted-foreground">Generate a setting with settlements before building a quest board.</p>;
  }

  const generateBoard = () => {
    const board = generateQuestBoard(world, { count: 8, level: Number(level) || 1 });
    if (!board.length) {
      toast.error("Could not generate quests.");
      return;
    }
    const next = { ...world, quests: [...board, ...(world.quests || [])].slice(0, 80) };
    onChange?.(next);
    setSelectedId(board[0].id);
    toast.success(`Posted ${board.length} new quests.`);
  };

  const generateOne = () => {
    const quest = generateQuest(world, { level: Number(level) || 1, seed: `single-${Date.now()}` });
    if (!quest) return;
    onChange?.({ ...world, quests: [quest, ...(world.quests || [])].slice(0, 80) });
    setSelectedId(quest.id);
    toast.success("Quest posted.");
  };

  const accept = (quest) => {
    onChange?.(acceptQuest(world, quest.id));
    setSelectedId(quest.id);
    toast.success(`Accepted: ${quest.title}`);
  };

  const advance = (quest) => {
    onChange?.(advanceQuest(world, quest.id));
    setSelectedId(quest.id);
    toast.success("Quest advanced.");
  };

  const complete = (quest) => {
    onChange?.(completeQuest(world, quest.id));
    setSelectedId(quest.id);
    toast.success(`Completed: ${quest.title} · ${fmt(quest.rewardGold)} gp`);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={generateBoard}>
          <Dices className="mr-1 h-3.5 w-3.5" /> Generate quest board
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={generateOne}>
          + One quest
        </Button>
        <Select value={String(level)} onValueChange={(value) => setLevel(Number(value))}>
          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Array.from({ length: 20 }, (_, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>Level {i + 1}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            {Object.entries(STATUS_LABEL).map(([id, label]) => (
              <SelectItem key={id} value={id}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="h-7 w-52 text-xs"
          placeholder="Search quests, patrons, places…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="ml-auto text-[10px] text-muted-foreground">{quests.length} shown</span>
      </div>

      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
        <div className="max-h-[60vh] space-y-1 overflow-y-auto rounded-md border p-2">
          {quests.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No quests yet. Generate a board to fill the taverns with work.
            </p>
          )}
          {quests.map((quest) => (
            <button
              key={quest.id}
              type="button"
              onClick={() => setSelectedId(quest.id)}
              className={`w-full rounded border px-2 py-1.5 text-left text-[10px] ${
                selected?.id === quest.id ? "border-primary/60 bg-primary/10" : "hover:bg-accent/50"
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="min-w-0 flex-1 truncate text-xs font-semibold">{quest.title}</span>
                <span
                  className={`rounded px-1 py-0.5 text-[9px] ${
                    quest.status === "complete"
                      ? "bg-green-500/15 text-green-400"
                      : quest.status === "ready"
                        ? "bg-amber-500/15 text-amber-400"
                        : quest.status === "active"
                          ? "bg-blue-500/15 text-blue-400"
                          : "bg-muted text-muted-foreground"
                  }`}
                >
                  {STATUS_LABEL[quest.status] || quest.status}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-2 text-[9px] text-muted-foreground">
                <span>{quest.typeLabel}</span>
                <span>Level {quest.level}</span>
                <span>· {quest.patronName}</span>
                <span>· {quest.settlementName}</span>
                <span className="ml-auto flex items-center gap-0.5">
                  <Coins className="h-2.5 w-2.5" /> {fmt(quest.rewardGold)} gp
                </span>
              </div>
            </button>
          ))}
        </div>

        {selected && (
          <div className="space-y-2 rounded-md border p-2">
            <div>
              <p className="text-sm font-semibold">{selected.title}</p>
              <p className="text-[10px] text-muted-foreground">
                {selected.typeLabel} · Level {selected.level} ({selected.tier}) · {STATUS_LABEL[selected.status]}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <span className="flex items-center gap-1">
                <UserRound className="h-3 w-3" /> {selected.patronName}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {selected.settlementName}
              </span>
              <span className="flex items-center gap-1">
                <Coins className="h-3 w-3" /> {fmt(selected.rewardGold)} gp
              </span>
              <span className="flex items-center gap-1">
                <ScrollText className="h-3 w-3" /> {selected.nationName || "—"}
              </span>
            </div>

            <p className="text-[11px]">{selected.objective}</p>
            <p className="text-[10px] text-muted-foreground">{selected.description}</p>
            <p className="rounded border border-amber-500/30 bg-amber-500/5 px-1.5 py-1 text-[10px] text-amber-300">
              <strong>Complication:</strong> {selected.complication}
            </p>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Steps</p>
              <ol className="mt-0.5 space-y-0.5 text-[10px]">
                {(selected.steps || []).map((step, index) => {
                  const done = index < (selected.stepIndex || 0) || selected.status === "complete";
                  const current = index === (selected.stepIndex || 0) && selected.status !== "complete";
                  return (
                    <li
                      key={index}
                      className={`flex gap-1 rounded px-1 py-0.5 ${
                        current ? "bg-primary/10 font-medium" : ""
                      } ${done ? "text-muted-foreground line-through" : ""}`}
                    >
                      <span className="w-4 shrink-0">{done ? <Check className="inline h-3 w-3" /> : index + 1}</span>
                      <span>{step}</span>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="flex flex-wrap gap-1">
              {selected.status === "available" && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => accept(selected)}>
                  Accept quest
                </Button>
              )}
              {(selected.status === "active" || selected.status === "ready") && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => advance(selected)}>
                  Advance step
                </Button>
              )}
              {selected.status !== "complete" && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => complete(selected)}>
                  <Check className="mr-1 h-3.5 w-3.5" /> Complete
                </Button>
              )}
              {onStartCombat && selected.status !== "complete" && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onStartCombat?.(selected)}>
                  <Swords className="mr-1 h-3.5 w-3.5" /> Stage battle
                </Button>
              )}
              {selected.rewardItems?.length > 0 && (
                <span className="w-full text-[10px] text-muted-foreground">
                  Also offered: {selected.rewardItems.join(", ")}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
