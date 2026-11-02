import { usePanelWidth } from "@/hooks/use-panel-width";
import { noteResizeActivity, startResizeSfx, stopResizeSfx } from "@/lib/audio";

// Drag handle for side panels. By default it follows the shared global width
// (Edit Node, Edit Connector, Character Sheet); pass `width`/`onResize` for an
// independent one, and `edge` ("left" | "right") for which side of the panel
// the handle sits on.
export function PanelResizer({ width, onResize, edge = "left", min = 260, max = 720 }) {
  const [globalWidth, setGlobal] = usePanelWidth();
  const w = width ?? globalWidth;
  const apply = onResize ?? setGlobal;
  const sign = edge === "left" ? -1 : 1;
  return (
    <div
      title="Drag to resize"
      className={`absolute ${edge === "left" ? "left-0" : "right-0"} top-0 z-10 h-full w-1.5 cursor-ew-resize hover:bg-primary/40`}
      onPointerDown={(e) => {
        e.preventDefault();
        startResizeSfx();
        const startX = e.clientX;
        const startW = w;
        const move = (ev) => {
          apply(Math.min(max, Math.max(min, startW + sign * (ev.clientX - startX))));
          noteResizeActivity();
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          window.removeEventListener("pointercancel", up);
          window.removeEventListener("blur", up);
          stopResizeSfx();
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
        window.addEventListener("blur", up);
      }}
    />
  );
}