import { Download, Monitor, FolderDown, MonitorCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IS_STANDALONE } from "@/lib/env";

// Permanent public download links for the packaged personal copies
// (regenerated from standalone/ whenever the app changes).
const COPIES = [
  {
    key: "desktop",
    icon: Monitor,
    title: "Desktop app",
    sub: "Pre-built — double-click a launcher, no installs",
    url: "https://base44.app/api/apps/6ad5a344b0f13ab4b8864366/files/mp/public/6ad5a344b0f13ab4b8864366/0863f5704_Standalone.zip",
    filename: "Standalone.zip",
    steps: [
      "Unzip, then double-click the launcher for your OS",
      "Windows: .bat · macOS: .command · Linux: start.sh",
      "Opens in your browser — no npm install, no Electron",
    ],
  },
  {
    key: "source",
    icon: FolderDown,
    title: "Source archive",
    sub: "The full editor source for tinkering",
    url: "https://base44.app/api/apps/6ad5a344b0f13ab4b8864366/files/mp/public/6ad5a344b0f13ab4b8864366/1e0e9b42d_Standalone-SourceCode.zip",
    filename: "Standalone - Source Code.zip",
    steps: [
      "Unzip, then run npm install in the folder",
      "Run npm run dev and open http://localhost:5173",
      "Or use the desktop folder's one-click launchers",
    ],
  },
];

// Lets anyone grab a personal, offline copy of the editor (desktop or source).
export function StandaloneCopyDialog({ open, onClose }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Get a personal copy</DialogTitle>
          <DialogDescription>
            A standalone copy runs entirely on your own machine — your trees and
            characters keep working even if this service goes away. Each copy keeps
            its own save space; use the Save menu's file export to move data between
            copies. For personal use.
          </DialogDescription>
        </DialogHeader>
        {IS_STANDALONE ? (
          <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-card/80 px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MonitorCheck className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-display text-base font-semibold">
                You're already running the desktop version
              </span>
              <span className="block text-xs text-muted-foreground">
                Copies can only be downloaded from the hosted app.
              </span>
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            {COPIES.map((c) => (
            <a
              key={c.key}
              href={c.url}
              download={c.filename}
              className="group flex w-full items-center gap-4 rounded-xl border border-border/60 bg-card/80 px-5 py-4 text-left shadow-sm transition-colors hover:border-primary/60 hover:bg-accent"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <c.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-base font-semibold">{c.title}</span>
                <span className="block text-xs text-muted-foreground">{c.sub}</span>
                <span className="mt-1 block text-[11px] leading-snug text-muted-foreground/80">
                  {c.steps.join(" · ")}
                </span>
              </span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors group-hover:border-primary/60 group-hover:text-primary">
                <Download className="h-4 w-4" />
              </span>
            </a>
          ))}
            </div>
        )}
        {!IS_STANDALONE && (
          <p className="text-[11px] text-muted-foreground">
            Node.js 18 or newer is required (nodejs.org). Full instructions are inside
            each package's README.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}