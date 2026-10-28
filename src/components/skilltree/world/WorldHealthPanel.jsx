import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Info, RefreshCw, Wrench } from "lucide-react";
import { repairWorld, validateWorld } from "@/lib/worldHealth";

const severityStyles = {
  error: {
    icon: AlertTriangle,
    border: "border-red-500/30 bg-red-500/5",
    text: "text-red-400",
    label: "Error",
  },
  warning: {
    icon: AlertTriangle,
    border: "border-amber-500/30 bg-amber-500/5",
    text: "text-amber-400",
    label: "Warning",
  },
  info: {
    icon: Info,
    border: "border-sky-500/30 bg-sky-500/5",
    text: "text-sky-400",
    label: "Info",
  },
};

export function WorldHealthPanel({ world, character, onChange }) {
  const report = useMemo(() => validateWorld(world), [world]);
  const { issues, summary } = report;
  const total = summary.errors + summary.warnings + summary.info;

  const repair = () => {
    const next = repairWorld(world, character);
    onChange?.(next);
    toast.success("World repair pass complete. Review the remaining notes.");
  };

  return (
    <div className="space-y-2">
      <div className="rounded-md border p-2">
        <div className="flex flex-wrap items-center gap-1">
          <p className="text-xs font-semibold">World health</p>
          <span className="text-[10px] text-muted-foreground">
            {total === 0 ? "No structural issues found." : `${total} note${total === 1 ? "" : "s"}`}
          </span>
          <div className="ml-auto flex flex-wrap gap-1">
            <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-300">
              {summary.errors} errors
            </span>
            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">
              {summary.warnings} warnings
            </span>
            <span className="rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-300">
              {summary.info} info
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px]"
              onClick={repair}
              disabled={total === 0}
            >
              <Wrench className="mr-1 h-3 w-3" /> Repair world
            </Button>
          </div>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Repair runs the safe upgrade pass: square terrain grids, v6 interiors, capital seats,
          ruler levels, dispositions, active-event arrays, and any interior that fails the
          structural checks. It does not overwrite local images or project assets.
        </p>
      </div>

      {total === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          Rooms, doors, stairs, maps, kingdoms and events all pass the structural checks.
        </div>
      ) : (
        <div className="space-y-1">
          {issues.slice(0, 240).map((issue, index) => {
            const style = severityStyles[issue.severity] || severityStyles.info;
            const Icon = style.icon;
            return (
              <div
                key={`${issue.area}:${issue.message}:${index}`}
                className={`flex items-start gap-1.5 rounded border px-2 py-1 text-[10px] ${style.border}`}
              >
                <Icon className={`mt-0.5 h-3 w-3 shrink-0 ${style.text}`} />
                <div className="min-w-0 flex-1">
                  <p>
                    <span className={`font-medium ${style.text}`}>{style.label}</span>{" "}
                    <span className="uppercase tracking-wide text-muted-foreground/70">
                      {issue.area}
                    </span>
                  </p>
                  <p className="break-words">{issue.message}</p>
                  {issue.legacyLinks?.length > 0 && (
                    <p className="mt-0.5 text-muted-foreground">
                      Open Stickers → Terrain textures to replace these, or let the load-time
                      importer copy them locally.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          {issues.length > 240 && (
            <p className="text-[10px] text-muted-foreground">
              Showing the first 240 of {issues.length} notes.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[10px]"
          onClick={() => {
            const next = repairWorld(world, character);
            onChange?.(next);
            toast.info("Repair pass run again.");
          }}
        >
          <RefreshCw className="mr-1 h-3 w-3" /> Run repair again
        </Button>
        <span className="self-center text-[10px] text-muted-foreground">
          The Health tab is read-only apart from the repair action.
        </span>
      </div>
    </div>
  );
}
