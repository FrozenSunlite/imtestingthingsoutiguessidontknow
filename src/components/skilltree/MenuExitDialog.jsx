import { Download, DoorOpen, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTree, denormalizeTree } from "@/lib/treeStore";
import { inlineImages } from "@/lib/imageStore";

// Shown when leaving the workspace for the main menu: warns about unsaved
// work and offers a .json download of the current skill tree on the way out.
export function MenuExitDialog({ open, onClose, onExit }) {
  const { tree, settings } = useTree();

  const downloadTree = async () => {
    // The Reference Library travels with the tree so an import restores it,
    // and artwork is embedded so the file is portable.
    const data = { ...denormalizeTree(tree), "Reference Library": settings?.library };
    const portable = await inlineImages(data, {
      includeRemote: !!settings?.cacheRemoteImages,
    });
    const blob = new Blob([JSON.stringify(portable, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(tree?.name || tree?.className || "skill-tree").replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onExit();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Back to the main menu?</DialogTitle>
          <DialogDescription>
            Anything you haven't saved will be lost when you leave the workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Button onClick={downloadTree}>
            <Download className="mr-1 h-4 w-4" /> Download tree (.json), then exit
          </Button>
          <Button variant="destructive" onClick={onExit}>
            <DoorOpen className="mr-1 h-4 w-4" /> Exit without saving
          </Button>
          <Button variant="outline" onClick={onClose}>
            <X className="mr-1 h-4 w-4" /> Stay in the workspace
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}