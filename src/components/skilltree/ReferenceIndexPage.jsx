import { Button } from "@/components/ui/button";
import { ArrowLeft, Database } from "lucide-react";
import { ReferenceIndexTab } from "@/components/skilltree/library/ReferenceIndexTab";

// Full-screen Reference Index. This is its own workspace rather than a tab
// inside the Reference Library dialog, so it has room for the category, file,
// entry and preview panes.
export function ReferenceIndexPage({ onExit }) {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b bg-muted/30 px-3 py-2">
        <Button size="icon" variant="outline" className="h-8 w-8" title="Back" onClick={onExit}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Database className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-base font-semibold leading-tight">Reference Index</h1>
          <p className="text-[10px] text-muted-foreground">
            Browse official and partnered 5eTools data, the public homebrew catalog and
            prerelease Unearthed Arcana. Preview files and import selected entries into the project.
          </p>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <ReferenceIndexTab />
      </div>
    </div>
  );
}
