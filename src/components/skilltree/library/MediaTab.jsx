import { useEffect, useMemo, useState } from "react";
import { useTree } from "@/lib/treeStore";
import { optimizeImageUrl } from "@/lib/imageStore";
import {
  collectImageReferences,
  formatBytes,
  imageNameFromUrl,
  replaceImageReferences,
} from "@/lib/projectAssets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Image as ImageIcon, RefreshCw, Trash2, Wand2 } from "lucide-react";

// Project Media: list every picture referenced by the project, show which
// files are still used, compress large artwork and remove orphaned files from
// the desktop image folder.
export function MediaTab() {
  const { settings, setSettings, tree, setTree, character, setCharacter } = useTree();
  const [serverImages, setServerImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [referencedOnly, setReferencedOnly] = useState(false);
  const [working, setWorking] = useState("");

  const refs = useMemo(() => {
    const map = collectImageReferences({ settings, tree, character });
    return map;
  }, [settings, tree, character]);

  const loadImages = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/images");
      if (!res.ok) throw new Error("no image server");
      const data = await res.json();
      setServerImages(Array.isArray(data.images) ? data.images : []);
    } catch {
      setServerImages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImages();
  }, []);

  const rows = useMemo(() => {
    const byName = new Map(serverImages.map((image) => [image.name, image]));
    const urls = new Set([
      ...serverImages.map((image) => image.url),
      ...refs.keys(),
    ]);
    return [...urls]
      .map((url) => {
        const name = imageNameFromUrl(url);
        const file = name ? byName.get(name) : null;
        const used = refs.get(url);
        return {
          url,
          name: name || url,
          bytes: file?.bytes || 0,
          modified: file?.modified || "",
          count: used?.count || 0,
          onDisk: !!file,
          remote: !url.startsWith("/images/"),
        };
      })
      .filter((row) => `${row.name} ${row.url}`.toLowerCase().includes(query.trim().toLowerCase()))
      .filter((row) => !referencedOnly || row.count > 0)
      .sort((a, b) => {
        if (a.count !== b.count) return a.count - b.count;
        return String(a.name).localeCompare(String(b.name));
      });
  }, [query, referencedOnly, refs, serverImages]);

  const totalBytes = serverImages.reduce((n, image) => n + (Number(image.bytes) || 0), 0);
  const orphans = serverImages.filter((image) => !refs.has(image.url));

  const deleteImage = async (row) => {
    if (!row?.onDisk || !row.name) return;
    if (!window.confirm(`Delete ${row.name} from the project image folder?`)) return;
    try {
      const res = await fetch(`/api/images/delete?name=${encodeURIComponent(row.name)}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("delete failed");
      setServerImages((list) => list.filter((image) => image.name !== row.name));
      toast.success(`Deleted ${row.name}.`);
    } catch {
      toast.error("Could not delete that image.");
    }
  };

  const removeOrphans = async () => {
    if (!orphans.length) {
      toast("No orphaned images.");
      return;
    }
    if (!window.confirm(`Delete ${orphans.length} unreferenced image(s)?`)) return;
    let deleted = 0;
    for (const image of orphans) {
      try {
        const res = await fetch(`/api/images/delete?name=${encodeURIComponent(image.name)}`, {
          method: "POST",
        });
        if (res.ok) deleted += 1;
      } catch {
        /* keep going */
      }
    }
    await loadImages();
    toast.success(`Removed ${deleted} orphaned image(s).`);
  };

  const compress = async (row) => {
    if (!row?.url || row.remote) {
      toast("Only images stored in the project folder can be compressed here.");
      return;
    }
    setWorking(row.url);
    try {
      const nextUrl = await optimizeImageUrl(row.url, { maxEdge: 1280, quality: 0.82 });
      if (!nextUrl || nextUrl === row.url) {
        toast("That image could not be compressed.");
        return;
      }
      setSettings((s) => replaceImageReferences(s, row.url, nextUrl));
      setTree((t) => (t ? replaceImageReferences(t, row.url, nextUrl) : t));
      setCharacter((c) => replaceImageReferences(c, row.url, nextUrl));
      toast.success("Image compressed and references updated. Delete the old file when ready.");
      await loadImages();
    } finally {
      setWorking("");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium">Project media</p>
          <p className="text-[10px] text-muted-foreground">
            {serverImages.length} file{serverImages.length === 1 ? "" : "s"} ·{" "}
            {formatBytes(totalBytes)} · {orphans.length} orphaned · {refs.size} referenced URL
            {refs.size === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Input
            className="h-7 w-40 text-xs"
            placeholder="Filter images…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Switch checked={referencedOnly} onCheckedChange={setReferencedOnly} />
            Used only
          </label>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={loadImages}
            disabled={loading}
          >
            <RefreshCw className="mr-1 h-3 w-3" /> Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={removeOrphans}
            disabled={!orphans.length}
          >
            <Trash2 className="mr-1 h-3 w-3" /> Orphans
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
          No project images yet. Import an entry with artwork or upload an image on a node.
        </div>
      ) : (
        <div className="grid max-h-[58vh] grid-cols-1 gap-1.5 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.url} className="flex gap-2 rounded-md border p-1.5">
              <div className="flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted/30">
                {/^(data:|\/images\/|\/api\/|https?:)/i.test(row.url) ? (
                  <img
                    src={row.url}
                    alt=""
                    loading="lazy"
                    className="max-h-20 max-w-full object-contain"
                  />
                ) : (
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-[11px] font-medium" title={row.url}>
                  {row.name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {row.count ? `${row.count} reference${row.count === 1 ? "" : "s"}` : "orphaned"}
                  {row.bytes ? ` · ${formatBytes(row.bytes)}` : row.remote ? " · remote" : ""}
                  {row.onDisk ? " · on disk" : ""}
                </p>
                <div className="flex flex-wrap gap-1">
                  {row.onDisk && row.count > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-1 text-[9px]"
                      onClick={() => compress(row)}
                      disabled={!!working}
                    >
                      <Wand2 className="mr-1 h-3 w-3" />
                      {working === row.url ? "Compressing…" : "Compress"}
                    </Button>
                  )}
                  {row.onDisk && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1 text-[9px]"
                      onClick={() => deleteImage(row)}
                    >
                      <Trash2 className="mr-1 h-3 w-3" /> Delete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">
        Images stay in the project folder and are embedded when you export a project file.
        Deleting an image that is still referenced will leave a broken picture.
      </p>
    </div>
  );
}
