import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { fetchAssetFolders, fetchAssetsSmart, importAsset } from "@/lib/worldAssets";

// Browse a subfolder of the sticker library for node or frame artwork. The
// folder is stored per project in settings.nodeImageFolder; picking an image
// imports a local copy into the project's image folder.
export function NodeImagePicker({
  open,
  onClose,
  folder = "Icons",
  onFolderChange,
  onPick,
  title = "Choose node artwork",
}) {
  const [draftFolder, setDraftFolder] = useState(folder || "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState("");
  const [folders, setFolders] = useState([]);

  useEffect(() => {
    if (!open) return;
    setDraftFolder(folder || "");
  }, [open, folder]);

  const load = async (overrides = {}) => {
    setLoading(true);
    try {
      const result = await fetchAssetsSmart({
        q: overrides.q ?? query,
        dir: overrides.dir ?? draftFolder,
        limit: 160,
      });
      setResults(result.items || []);
      setTotal(result.total || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    load({ q: "", dir: folder });
    fetchAssetFolders("icon", 40).then(setFolders);
     
  }, [open, folder]);

  const applyFolder = () => {
    onFolderChange?.(draftFolder.trim());
    load({ q: query, dir: draftFolder.trim() });
  };

  const pick = async (asset) => {
    if (!asset) return;
    setPicking(asset.path);
    try {
      const url = await importAsset(asset.path);
      if (url) {
        onPick?.(url, asset);
        onClose?.();
      }
    } finally {
      setPicking("");
    }
  };

  const label = useMemo(
    () => (draftFolder.trim() ? `Library subfolder: ${draftFolder.trim()}` : "Whole sticker library"),
    [draftFolder]
  );

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose?.()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Browse a folder inside the sticker library, then click an image to copy it into this
            project and assign it to the node. {label}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-1">
          <Input
            className="h-8 min-w-0 flex-1 text-xs"
            value={draftFolder}
            onChange={(event) => setDraftFolder(event.target.value)}
            placeholder="Folder inside the sticker library, e.g. Icons"
          />
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={applyFolder}>
            Use folder
          </Button>
          <Input
            className="h-8 w-48 text-xs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") load({ q: query, dir: draftFolder });
            }}
            placeholder="Search this folder…"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => load({ q: query, dir: draftFolder })}
            disabled={loading}
          >
            <Search className="mr-1 h-3.5 w-3.5" /> Search
          </Button>
        </div>
        {folders.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
              Icon folders:
            </span>
            {folders.slice(0, 12).map((item) => (
              <button
                key={item.dir}
                type="button"
                className="rounded border px-1 py-0.5 text-[9px] hover:bg-accent"
                onClick={() => {
                  setDraftFolder(item.dir);
                  onFolderChange?.(item.dir);
                  load({ q: "", dir: item.dir });
                }}
                title={`${item.dir} (${item.count} images)`}
              >
                {item.dir.split("/").slice(-2).join("/")} ({item.count})
              </button>
            ))}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          {loading ? "Searching…" : `${results.length} shown · ${total.toLocaleString()} matches`}
        </p>
        <div className="grid max-h-[58vh] grid-cols-3 gap-2 overflow-y-auto rounded-md border p-2 sm:grid-cols-5 lg:grid-cols-7">
          {results.map((asset) => (
            <button
              key={asset.path}
              type="button"
              className="overflow-hidden rounded border text-left hover:border-primary disabled:opacity-50"
              disabled={!!picking}
              onClick={() => pick(asset)}
              title={asset.path}
            >
              <img
                src={asset.url}
                alt={asset.name}
                loading="lazy"
                className="h-16 w-full bg-muted/30 object-contain"
              />
              <span className="block truncate px-1 py-0.5 text-[8px] text-muted-foreground">
                {picking === asset.path ? "Importing…" : asset.name}
              </span>
            </button>
          ))}
          {!loading && results.length === 0 && (
            <p className="col-span-full p-3 text-xs text-muted-foreground">
              No images found. Check the folder name, or use the Stickers page to change the source
              library.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
