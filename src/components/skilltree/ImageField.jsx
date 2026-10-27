import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X } from "lucide-react";
import { importImage } from "@/lib/imageStore";

// Artwork field shared by monsters and familiars. Uploads go into the
// project's image folder (or fall back to a data URL), and the stored value is
// just a short reference. Drop an image on the row to import it too.
export function ImageField({
  label = "Image",
  value = "",
  onChange,
  placeholder = "Image URL or upload…",
  info = "",
  previewClass = "h-28 w-28",
}) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange(await importImage(file));
    } catch (e) {
      setError(e?.message || "Could not import the image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-start gap-2">
        <div
          className={`${previewClass} flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40`}
        >
          {value ? (
            <img
              src={value}
              alt=""
              className="h-full w-full object-contain"
              style={{ imageRendering: "pixelated" }}
            />
          ) : (
            <span className="px-1 text-center text-[10px] text-muted-foreground">No image</span>
          )}
        </div>
        <div
          className="min-w-0 flex-1 space-y-1"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(e) => {
            e.preventDefault();
            upload(e.dataTransfer.files?.[0]);
          }}
        >
          <div className="flex gap-1">
            <Input
              className="h-8 min-w-0 flex-1"
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              disabled={busy}
              title="Upload an image"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
            </Button>
            {value && (
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0"
                title="Clear the image"
                onClick={() => onChange("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {info && <p className="text-[10px] text-muted-foreground">{info}</p>}
          {error && <p className="text-[10px] text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  );
}
