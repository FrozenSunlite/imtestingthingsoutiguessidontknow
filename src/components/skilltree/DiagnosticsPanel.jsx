import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  clearDiagnostics,
  copyDiagnostics,
  downloadDiagnostics,
  formatDiagnostics,
  getDiagnostics,
  subscribeDiagnostics,
} from "@/lib/diagnostics";

const FILTERS = [
  ["all", "All"],
  ["error", "Errors"],
  ["warn", "Warnings"],
];

// Settings > Diagnostics. Deliberately a plain textarea: the point is to make
// the exact failure easy to select, copy and paste into a bug report.
export function DiagnosticsPanel() {
  const [entries, setEntries] = useState(() => getDiagnostics());
  const [filter, setFilter] = useState("all");

  useEffect(() => subscribeDiagnostics(setEntries), []);

  const visible = useMemo(
    () => (filter === "all" ? entries : entries.filter((entry) => entry.level === filter)),
    [entries, filter]
  );
  const text = useMemo(
    () =>
      visible.length
        ? formatDiagnostics(visible)
        : "No errors captured yet.\n\nRetry the action that failed; the message and stack will appear here.",
    [visible]
  );

  const copy = async () => {
    const ok = await copyDiagnostics(visible.length ? visible : entries);
    if (ok) toast.success("Diagnostic log copied.");
    else toast.error("Could not copy the diagnostic log.");
  };

  const download = () => {
    const ok = downloadDiagnostics(visible.length ? visible : entries);
    if (ok) toast.success("Diagnostic log downloaded.");
    else toast.error("Could not download the diagnostic log.");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Error console</p>
          <p className="text-[10px] text-muted-foreground">
            Console errors and warnings, uncaught exceptions, promise rejections,
            failed local API calls, and every error toast. Logs stay on this device
            until you clear them.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={copy}>
            Copy
          </Button>
          <Button size="sm" variant="outline" onClick={download}>
            Download
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              clearDiagnostics();
              toast("Diagnostic log cleared.");
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {FILTERS.map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            variant={filter === id ? "secondary" : "ghost"}
            className="h-6 px-2 text-[10px]"
            onClick={() => setFilter(id)}
          >
            {label}
          </Button>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {visible.length} of {entries.length} entries · newest first
        </span>
      </div>

      <textarea
        readOnly
        spellCheck={false}
        value={text}
        className="h-72 w-full resize-y rounded-md border bg-black/85 p-2 font-mono text-[10px] leading-relaxed text-green-300"
      />

      <p className="text-[10px] text-muted-foreground">
        If something fails, open this tab, press Copy, and paste the text into the
        issue report. Clear it before sending if you want to start a fresh capture.
      </p>
    </div>
  );
}
