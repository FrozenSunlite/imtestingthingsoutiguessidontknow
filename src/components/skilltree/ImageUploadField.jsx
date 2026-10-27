import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload } from "lucide-react";
import { importImage } from "@/lib/imageStore";

// A small reusable image field: text URL + file picker. Picked or dropped files
// are imported through imageStore: stored as a project file and referenced by
// its short `/images/...` URL (data-URL fallback when no server endpoint).
// `maxSize` only bounds that fallback's longest edge. Pixel art is never
// resampled with smoothing, so it stays sharp.
export function ImageUploadField({ value, onChange, maxSize = 512, disabled = false, className = "" }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file) => {
    if (!file || !String(file.type || "").startsWith("image/")) return;
    setBusy(true);
    try {
      onChange?.(await importImage(file, { maxEdge: maxSize }));
    } catch (e) {
      /* ignore individual failures */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`flex gap-1 ${dragOver ? "rounded-md ring-2 ring-primary/60" : ""} ${className}`}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (disabled) return;
        handleFile(e.dataTransfer.files?.[0]);
      }}
    >
      <Input value={value || ""} onChange={(e) => onChange?.(e.target.value)} placeholder="URL or drop file" />
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      <Button size="sm" variant="outline" disabled={disabled || busy} onClick={() => ref.current?.click()} title="Import image">
        <Upload className="h-4 w-4" />
      </Button>
    </div>
  );
}
