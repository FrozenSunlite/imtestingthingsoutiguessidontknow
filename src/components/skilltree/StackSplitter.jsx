// Horizontal drag handle between two stacked tree panels. The drag reports a
// fraction of the parent's height so both panels can be resized together and
// the split survives a window resize.
export function StackSplitter({ value = 0.5, onChange, min = 0.18 }) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      title="Drag to resize both trees"
      className="h-1.5 shrink-0 cursor-row-resize bg-border/60 hover:bg-primary/50"
      onPointerDown={(e) => {
        e.preventDefault();
        const parent = e.currentTarget.parentElement;
        if (!parent) return;
        const height = Math.max(1, parent.getBoundingClientRect().height);
        const startY = e.clientY;
        const start = value;
        const move = (ev) => {
          const next = Math.min(1 - min, Math.max(min, start + (ev.clientY - startY) / height));
          onChange?.(next);
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }}
    />
  );
}
