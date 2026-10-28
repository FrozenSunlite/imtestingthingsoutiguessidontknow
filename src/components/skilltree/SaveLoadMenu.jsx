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
import {
  deleteProjectFile,
  listProjectBackups,
  listProjectFiles,
  loadProjectFile,
  saveProjectToDisk,
} from "@/lib/projectFiles";

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
  const [diskSaves, setDiskSaves] = useState([]);
  const [backupSaves, setBackupSaves] = useState([]);
  const fileRef = useRef(null);

  // Save slots live in IndexedDB, so listing them is asynchronous.
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    listCharacterSaves()
      .then((rows) => alive && setSaves(rows))
      .catch(() => alive && setSaves([]));
    listProjectFiles().then((rows) => alive && setDiskSaves(rows));
    listProjectBackups().then((rows) => alive && setBackupSaves(rows));
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
      const payload = {
        name: name || character?.name || "Terrific Talent Tree Project",
        tree,
        character,
        pools,
        library: settings?.library,
        plots: loadPlots(),
        ...(includeSources ? { referenceSources: getFiveEToolsSources() } : {}),
      };
      await writeCharacterSave(name, payload);
      await saveProjectToDisk(payload, { name: payload.name, manual: true });
      await refresh();
      setDiskSaves(await listProjectFiles());
      setBackupSaves(await listProjectBackups());
      clearDirty?.();
      toast.success(`Saved "${name || "Untitled character"}".`);
    } catch (e) {
      toast.error(e?.message || "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const saveDiskNow = async () => {
    const payload = {
      name: name || character?.name || "Terrific Talent Tree Project",
      tree,
      character,
      pools,
      library: settings?.library,
      plots: loadPlots(),
    };
    const result = await saveProjectToDisk(payload, { name: payload.name, manual: true });
    setDiskSaves(await listProjectFiles());
    setBackupSaves(await listProjectBackups());
    toast[result ? "success" : "error"](
      result ? `Saved to disk: ${result.path}` : "Could not write the project file."
    );
  };

  const loadDisk = async (file, backup = false) => {
    const data = await loadProjectFile(file, { backup });
    if (!data) {
      toast.error("Could not read that project file.");
      return;
    }
    applyLoadedSave(await rehydrateImages(data), "sheet");
    onClose();
  };

  const removeDisk = async (file, backup = false) => {
    if (
      !window.confirm(
        `Delete ${file} from the ${backup ? "backups" : "projects"} folder?`
      )
    ) {
      return;
    }
    await deleteProjectFile(file, { backup });
    if (backup) setBackupSaves(await listProjectBackups());
    else setDiskSaves(await listProjectFiles());
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Save / Load Project</DialogTitle>
          <DialogDescription>
            A save bundles the skill tree, character, pools, library and Homebuilder properties — images included.
            Saves are also mirrored to a project file on this PC.
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

        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Files on this PC
          </p>
          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={saveDiskNow} disabled={!tree}>
            Save now to disk
          </Button>
        </div>
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-1">
          {diskSaves.length === 0 && (
            <p className="p-2 text-[10px] text-muted-foreground">
              No project files yet. Saves are written to <code>desktop\userdata\projects</code>.
            </p>
          )}
          {diskSaves.map((file) => (
            <div key={file.file} className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-accent">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{file.file}</div>
                <div className="text-[9px] text-muted-foreground">
                  {new Date(file.modified).toLocaleString()} - {(file.bytes / 1024).toFixed(0)} KB
                </div>
              </div>
              <Button size="sm" variant="ghost" title="Load this file" onClick={() => loadDisk(file.file)}>
                <FolderOpen className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" title="Delete this file" onClick={() => removeDisk(file.file)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Automatic backups
          </p>
          <p className="mb-1 text-[9px] text-muted-foreground">
            Kept before manual saves and before an unusually small autosave replaces a project.
          </p>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-1">
            {backupSaves.length === 0 && (
              <p className="p-2 text-[10px] text-muted-foreground">
                No backups yet. The first manual save will create one.
              </p>
            )}
            {backupSaves.map((file) => (
              <div key={file.file} className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-accent">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{file.file}</div>
                  <div className="text-[9px] text-muted-foreground">
                    {new Date(file.modified).toLocaleString()} - {(file.bytes / 1024).toFixed(0)} KB
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  title="Restore this backup"
                  onClick={() => loadDisk(file.file, true)}
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  title="Delete this backup"
                  onClick={() => removeDisk(file.file, true)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
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




