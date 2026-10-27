import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload } from "lucide-react";

// A small reusable image field: text URL + file picker, storing a resized
// data URL. `maxSize` controls the largest dimension (square bounding box).
export function ImageUploadField({ value, onChange, maxSize = 128, disabled = false, className = "" }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setBusy(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = new Image();
          img.onload = () => {
            const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/png"));
          };
          img.onerror = reject;
          img.src = ev.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      onChange?.(dataUrl);
    } catch (e) {
      /* ignore individual failures */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex gap-1 ${className}`}>
      <Input value={value || ""} onChange={(e) => onChange?.(e.target.value)} placeholder="URL or drop file" />
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      <Button size="sm" variant="outline" disabled={disabled || busy} onClick={() => ref.current?.click()} title="Upload image">
        <Upload className="h-4 w-4" />
      </Button>
    </div>
  );
}
