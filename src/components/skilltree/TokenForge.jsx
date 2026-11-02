import { useEffect, useRef, useState } from "react";
import { useTree } from "@/lib/treeStore";
import { importImage } from "@/lib/imageStore";
import { loadImageSource } from "@/lib/imageBitmap";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Download, X } from "lucide-react";

const PREVIEW = 224;

// Images are project files or data URLs now, so there is nothing to sign.
// Anything else (a stale cloud file URI) is dropped rather than rendered raw.
export async function signUri(uri) {
  if (!uri) return "";
  return /^(https?:|data:|blob:|\/)/.test(uri) ? uri : "";
}

async function loadBitmap(url) {
  try {
    const res = await fetch(url);
    return await loadImageSource(await res.blob());
  } catch {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx || !canvas.width || !canvas.height) {
          reject(new Error("Could not decode the image"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      };
      img.onerror = reject;
      img.src = url;
    });
  }
}

// Token Maker: portrait upload with a circular crop preview (drag to pan,
// zoom slider), the node frame as the default token frame, and a PNG token
// export for VTT platforms.
export function TokenForge() {
  const { character, setCharacter, settings } = useTree();
  const [portraitUrl, setPortraitUrl] = useState("");
  const [frameUrl, setFrameUrl] = useState("");
  const [dims, setDims] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const dragRef = useRef(null);

  useEffect(() => {
    let live = true;
    signUri(character.portraitUri).then((u) => live && setPortraitUrl(u));
    return () => {
      live = false;
    };
  }, [character.portraitUri]);

  // The token frame is the same frame the nodes use; a custom upload wins.
  useEffect(() => {
    let live = true;
    if (character.tokenFrameUri) {
      signUri(character.tokenFrameUri).then((u) => live && setFrameUrl(u));
    } else {
      setFrameUrl(settings?.placeholderFrame || "");
    }
    return () => {
      live = false;
    };
  }, [character.tokenFrameUri, settings?.placeholderFrame]);

  useEffect(() => {
    if (!portraitUrl) {
      setDims(null);
      return;
    }
    const img = new Image();
    img.onload = () => setDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = portraitUrl;
  }, [portraitUrl]);

  const upload = async (file, key) => {
    if (!file) return;
    setErr("");
    try {
      // Imported into the project's image folder, like node artwork — the
      // short reference then rides along inside saves, exports and imports.
      const uri = await importImage(file, { maxEdge: 1024 });
      setCharacter({ ...character, [key]: uri });
      // Fresh portrait: clear any pan/zoom left over from the previous image.
      if (key === "portraitUri") {
        setOff({ x: 0, y: 0 });
        setZoom(1);
      }
    } catch {
      setErr("Upload failed — try a smaller image.");
    }
  };

  const onPointerDown = (e) => {
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: off.x, oy: off.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const d = dragRef.current;
    setOff({ x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) });
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  const imgStyle = (() => {
    if (!dims) return { opacity: 0 };
    const s = Math.max(PREVIEW / dims.w, PREVIEW / dims.h) * zoom;
    return {
      width: dims.w * s,
      height: dims.h * s,
      left: PREVIEW / 2 - (dims.w * s) / 2 + off.x,
      top: PREVIEW / 2 - (dims.h * s) / 2 + off.y,
    };
  })();

  const exportToken = async () => {
    if (!portraitUrl) return;
    setBusy(true);
    setErr("");
    try {
      const size = 512;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d");
      const bmp = await loadBitmap(portraitUrl);
      const s = Math.max(size / bmp.width, size / bmp.height) * zoom;
      const w = bmp.width * s;
      const h = bmp.height * s;
      const kx = size / PREVIEW;
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        bmp,
        size / 2 - w / 2 + off.x * kx,
        size / 2 - h / 2 + off.y * kx,
        w,
        h
      );
      ctx.restore();
      if (frameUrl) {
        const fbmp = await loadBitmap(frameUrl);
        const fs = Math.min(size / fbmp.width, size / fbmp.height);
        ctx.drawImage(
          fbmp,
          size / 2 - (fbmp.width * fs) / 2,
          size / 2 - (fbmp.height * fs) / 2,
          fbmp.width * fs,
          fbmp.height * fs
        );
      }
      canvas.toBlob((blob) => {
        if (!blob) {
          setErr("Export failed — the image could not be read.");
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${character.name || "character"}-token.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch {
      setErr("Export failed — try re-uploading the image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border p-3">
      <Label className="text-xs font-medium">Token Maker</Label>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Portrait</Label>
          <div className="flex items-center gap-1">
            <input
              type="file"
              accept="image/*"
              className="w-full text-xs"
              onChange={(e) => upload(e.target.files?.[0], "portraitUri")}
            />
            {character.portraitUri && (
              <Button
                size="sm"
                variant="ghost"
                title="Remove portrait"
                onClick={() => {
                  setCharacter({ ...character, portraitUri: "" });
                  setOff({ x: 0, y: 0 });
                  setZoom(1);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">
            Token frame (defaults to the node frame)
          </Label>
          <input
            type="file"
            accept="image/*"
            className="w-full text-xs"
            onChange={(e) => upload(e.target.files?.[0], "tokenFrameUri")}
          />
        </div>
      </div>

      {portraitUrl && (
        <div className="mt-2">
          <Label className="text-[10px] text-muted-foreground">Original (unedited)</Label>
          <img
            src={portraitUrl}
            alt="Original portrait"
            draggable={false}
            className="mt-0.5 max-h-52 w-full rounded-md object-contain"
          />
        </div>
      )}

      <div className="mt-2 flex items-center gap-3">
        <div
          className="relative shrink-0 cursor-grab touch-none select-none overflow-hidden rounded-full border"
          style={{ width: PREVIEW, height: PREVIEW }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {portraitUrl && (
            <img
              src={portraitUrl}
              alt="Portrait"
              draggable={false}
              className="absolute max-w-none"
              style={imgStyle}
            />
          )}
          {frameUrl && (
            <img
              src={frameUrl}
              alt="Token frame"
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
          )}
          {/* Crop overlay only while a portrait is selected — deselecting it
              leaves a plain empty circle, not a lingering dark mask. */}
          {portraitUrl && (
            <div
              className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/80"
              style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" }}
            />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">Zoom</Label>
            <Slider
              value={[zoom]}
              min={1}
              max={4}
              step={0.05}
              onValueChange={([v]) => setZoom(v)}
            />
          </div>
          <Button size="sm" className="w-full" disabled={!portraitUrl || busy} onClick={exportToken}>
            <Download className="mr-1 h-4 w-4" />
            {busy ? "Exporting…" : "Export Token (PNG)"}
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Drag the portrait to position it; the circle marks the exported token edge
            (512×512 PNG, ready for Foundry and other VTTs).
          </p>
        </div>
      </div>
      {err && <p className="mt-1 text-[10px] text-destructive">{err}</p>}
    </div>
  );
}