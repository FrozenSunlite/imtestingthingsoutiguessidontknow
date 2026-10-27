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

// Save & load characters: named slots in the browser plus .json export/import.
// A save bundles the skill tree, the character, the point pools and the
// reference library, so uploaded images — stored as permanent URLs or file
// references — travel with the saved data.
export function SaveLoadMenu({ open, onClose }) {
  const { tree, character, pools, settings, applyLoadedSave } = useTree();
  const [saves, setSaves] = useState([]);
  const [name, setName] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    if (open) {
      setSaves(listCharacterSaves());
      setName(character?.name || "");
    }
  }, [open, character?.name]);

  const doSave = () => {
    try {
      writeCharacterSave(name, { tree, character, pools, library: settings?.library, plots: loadPlots() });
      setSaves(listCharacterSaves());
      toast.success(`Saved "${name || "Untitled character"}".`);
    } catch (e) {
      toast.error(e?.message || "Could not save.");
    }
  };

  const doLoad = (entry) => {
    applyLoadedSave(entry, "sheet");
    onClose();
  };

  const doDelete = (id) => {
    deleteCharacterSave(id);
    setSaves(listCharacterSaves());
  };

  const download = (entry) => {
    const blob = new Blob([JSON.stringify(entry, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(entry.name || "character").replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadBundle = async (entry) => {
    try {
      const json = JSON.stringify(entry);
      const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
      const blob = await new Response(stream).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (entry.name || "character").replace(/\\s+/g, "-") + ".gz";
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
      applyLoadedSave(data, "sheet");
      onClose();
    } catch (e) {
      toast.error("Not a valid bundle: " + (e?.message || e));
    }
  };

  const doImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || (!data.tree && !data.character)) throw new Error("bad file");
        applyLoadedSave(data, "sheet");
        onClose();
      } catch {
        toast.error("Not a valid character save file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save / Load Character</DialogTitle>
          <DialogDescription>
            A save bundles the skill tree, character, pools, library and Homebuilder properties — images included.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Save current character as</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Character name"
            />
          </div>
          <Button onClick={doSave} disabled={!tree}>
            <Save className="mr-1 h-4 w-4" /> Save
          </Button>
        </div>

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


