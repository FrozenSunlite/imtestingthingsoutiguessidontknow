import { useEffect, useRef, useState } from "react";
import {
  useTree,
  listCharacterSaves,
  writeCharacterSave,
  deleteCharacterSave,
} from "@/lib/treeStore";
import { loadPlots } from "@/lib/homesteadStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, FolderOpen, Save, Trash2, Upload } from "lucide-react";
import { inlineImages, rehydrateImages } from "@/lib/imageStore";
import { getFiveEToolsSources } from "@/lib/fiveEToolsCache";

// Save & load characters: named slots in the browser plus .json export/import.
// A save bundles the skill tree, the character, the point pools and the
// reference library, so uploaded images — stored as permanent URLs or file
// references — travel with the saved data.
export function SaveLoadMenu({ open, onClose }) {
  const { tree, character, pools, settings, applyLoadedSave, clearDirty } = useTree();
  const [saves, setSaves] = useState([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [includeSources, setIncludeSources] = useState(false);
  const fileRef = useRef(null);

  // Save slots live in IndexedDB, so listing them is asynchronous.
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    listCharacterSaves()
      .then((rows) => alive && setSaves(rows))
      .catch(() => alive && setSaves([]));
    setName(character?.name || "");
    return () => {
      alive = false;
    };
  }, [open, character?.name]);

  const refresh = async () => {
    try {
      setSaves(await listCharacterSaves());
    } catch {
      setSaves([]);
    }
  };

  const doSave = async () => {
    setBusy(true);
    try {
      await writeCharacterSave(name, {
        tree,
        character,
        pools,
        library: settings?.library,
        plots: loadPlots(),
        ...(includeSources ? { referenceSources: getFiveEToolsSources() } : {}),
      });
      await refresh();
      clearDirty?.();
      toast.success(`Saved "${name || "Untitled character"}".`);
    } catch (e) {
      toast.error(e?.message || "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const doLoad = (entry) => {
    applyLoadedSave(entry, "sheet");
    onClose();
  };

  const doDelete = async (id) => {
    await deleteCharacterSave(id);
    await refresh();
  };

  const download = async (entry) => {
    // Embed referenced artwork so the downloaded copy is self-contained.
    const portable = await inlineImages(entry, {
      includeRemote: !!settings?.cacheRemoteImages,
    });
    const blob = new Blob([JSON.stringify(portable, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(entry.name || "character").replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadBundle = async (entry) => {
    try {
      const portable = await inlineImages(entry, {
        includeRemote: !!settings?.cacheRemoteImages,
      });
      const json = JSON.stringify(portable);
      const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
      const blob = await new Response(stream).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (entry.name || "character").replace(/\s+/g, "-") + ".gz";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Bundle exported.");
    } catch (e) {
      toast.error("Could not create bundle: " + (e?.message || e));
    }
  };

  const importBundle = async (file) => {
    try {
      const text = file.name.endsWith(".gz")
        ? await (async () => {
            const ds = new DecompressionStream("gzip");
            const stream = file.stream().pipeThrough(ds);
            return await new Response(stream).text();
          })()
        : await file.text();
      const data = JSON.parse(text);
      if (!data || (!data.tree && !data.character)) throw new Error("bad file");
      // Embedded images get uploaded into this machine's project folder again.
      applyLoadedSave(await rehydrateImages(data), "sheet");
      onClose();
    } catch (e) {
      toast.error("Not a valid bundle: " + (e?.message || e));
    }
  };

  const doImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const data = JSON.parse(await file.text());
      if (!data || (!data.tree && !data.character)) throw new Error("bad file");
      applyLoadedSave(await rehydrateImages(data), "sheet");
      onClose();
    } catch {
      toast.error("Not a valid character save file.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save / Load Project</DialogTitle>
          <DialogDescription>
            A save bundles the skill tree, character, pools, library and Homebuilder properties — images included.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Save project as</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
            />
          </div>
          <Button onClick={doSave} disabled={!tree || busy}>
            <Save className="mr-1 h-4 w-4" /> Save
          </Button>
        </div>

        <label className="flex items-start gap-2 rounded-md border bg-muted/20 p-2 text-[10px] text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={includeSources}
            onChange={(e) => setIncludeSources(e.target.checked)}
          />
          <span>
            Also include raw 5eTools source JSON that was browsed but not imported. Leave this
            off to keep saves small; imported entries are always included.
          </span>
        </label>

        <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-1">
          {saves.length === 0 && (
            <p className="p-3 text-center text-xs text-muted-foreground">No saves yet.</p>
          )}
          {saves.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-accent"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{s.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {new Date(s.date).toLocaleString("en-US", { timeZone: "UTC" })}
                </div>
              </div>
              <Button size="sm" variant="ghost" title="Load" onClick={() => doLoad(s)}>
                <FolderOpen className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" title="Download .json" onClick={() => download(s)}>
                <Download className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" title="Delete" onClick={() => doDelete(s.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1 h-4 w-4" /> Import file
          </Button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={doImport} />
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}




