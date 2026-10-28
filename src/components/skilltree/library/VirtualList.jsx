import { useEffect, useRef, useState } from "react";

// Minimal fixed-row virtual list. Reference Index "Display all" can produce
// tens of thousands of entries, which would otherwise mount that many DOM rows
// at once and freeze the page. Only the visible window plus an overscan band is
// rendered; the spacer keeps the scrollbar honest.
export function VirtualList({
  items = [],
  rowHeight = 46,
  overscan = 8,
  render,
  getKey,
  className = "",
  empty = null,
}) {
  const ref = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(420);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setHeight(el.clientHeight || 420);
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!items.length) return empty;

  const total = items.length * rowHeight;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(items.length, Math.ceil((scrollTop + height) / rowHeight) + overscan);
  const windowItems = items.slice(start, end);

  return (
    <div
      ref={ref}
      className={`overflow-y-auto ${className}`}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: total, position: "relative" }}>
        {windowItems.map((item, i) => {
          const index = start + i;
          return (
            <div
              key={getKey ? getKey(item, index) : index}
              style={{
                position: "absolute",
                top: index * rowHeight,
                left: 0,
                right: 0,
                height: rowHeight,
                overflow: "hidden",
              }}
            >
              {render(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
