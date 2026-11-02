import { CheckCircle2, Loader2, TriangleAlert, X } from "lucide-react";
import { dismissImport } from "@/lib/importStatus";
import { useImportStatus } from "@/lib/useImportStatus";
import { Button } from "@/components/ui/button";

// Visible on every screen. The importer keeps running after the Reference
// Index closes, so this is the only place that reports progress/completion.
export function ImportStatusBanner() {
  const status = useImportStatus();
  if (!status || status.state === "idle") return null;

  const percent =
    status.total > 0 ? Math.min(100, Math.round((status.done / status.total) * 100)) : 0;

  const openLibrary = () => {
    window.dispatchEvent(new Event("skilltree:open-library"));
  };

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[125] w-[min(24rem,calc(100vw-2rem))]">
      <div className="pointer-events-auto rounded-xl border bg-card/95 p-3 shadow-2xl backdrop-blur">
        {status.state === "running" ? (
          <>
            <div className="flex items-start gap-2">
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{status.label}</p>
                <p className="text-[10px] text-muted-foreground">
                  {status.total > 0
                    ? `${status.done} of ${status.total}${status.total === 1 ? " step" : " steps"}`
                    : "Working…"}
                  {status.detail ? ` · ${status.detail}` : ""}
                </p>
              </div>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${status.total ? percent : 8}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              You can leave the Reference Index — this import keeps running.
            </p>
          </>
        ) : status.state === "done" ? (
          <>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Import finished</p>
                <p className="text-[10px] text-muted-foreground">
                  {status.result?.count || 0} entr
                  {status.result?.count === 1 ? "y" : "ies"} imported
                  {status.result?.tabs
                    ? ` · ${status.result.tabs} tab${status.result.tabs === 1 ? "" : "s"} created`
                    : ""}
                  {status.result?.errors
                    ? ` · ${status.result.errors} failed`
                    : ""}
                  .
                </p>
              </div>
              <button
                type="button"
                aria-label="Dismiss import result"
                onClick={dismissImport}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => {
                  openLibrary();
                  dismissImport();
                }}
              >
                Open library
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Import stopped</p>
              <p className="whitespace-pre-wrap text-[10px] text-muted-foreground">
                {status.error}
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss import error"
              onClick={dismissImport}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
