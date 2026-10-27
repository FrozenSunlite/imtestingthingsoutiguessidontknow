import { Button } from "@/components/ui/button";
import { ATTACHMENTS, FACILITY_TYPES, furnishingByName } from "@/lib/homestead";

// The canvas right-click menu, for any placed item kind (basic facilities get
// their Cellar / Floor / Attic attachments, everything else gets select /
// rotate / delete actions) plus a wall-the-room shortcut that lines a room's
// exterior with free interior-wall copies.
export default function HomesteadContextMenu({ menu, fac, onAttach, onAddRoom, onWallRoom, onRotate, onDelete, onSelect, onClose }) {
  if (!menu) return null;
  const isFac = menu.kind === "facility" && fac;
  const def = menu.kind === "furnishing" ? furnishingByName(menu.type) : null;
  const title = isFac ? (fac.name || fac.type) : menu.title || menu.type;

  const item = (label, onClick, cls = "") => (
    <button
      className={`block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent ${cls}`}
      onClick={() => { onClick(); onClose(); }}
    >
      {label}
    </button>
  );

  return (
    <>
      {/* Closes on any press. The right button's contextmenu event must NOT
          close it: on Windows it fires on release, which would otherwise shut
          the menu the moment the button is let go. */}
      <div
        className="fixed inset-0 z-40"
        onPointerDown={onClose}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        className="absolute z-50 w-56 rounded-md border bg-popover p-1 shadow-md"
        style={{ left: menu.x, top: menu.y }}
      >
        <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
        {isFac && !fac.bastion && ["cellar", "floor", "attic"].map((key) => (
          <button
            key={key}
            className={`block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent ${fac[key]?.on ? "font-medium text-primary" : ""}`}
            onClick={() => { onAttach(fac.id, key); onClose(); }}
          >
            {ATTACHMENTS[key].label}
            {fac[key]?.on ? " — on" : ""}
          </button>
        ))}
        {isFac && !fac.bastion && ["cellar", "floor", "attic"].filter((k) => fac[k]?.on).map((key) => (
          <div key={key} className="mt-1 border-t pt-1">
            <p className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {ATTACHMENTS[key].label} — place a room
            </p>
            {ATTACHMENTS[key].allowed.map((name) => (
              <button
                key={name}
                className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent"
                onClick={() => { onAddRoom(fac.id, key, name); onClose(); }}
              >
                + {name}
              </button>
            ))}
          </div>
        ))}
        {isFac && (
          <div className="mt-1 border-t pt-1">
            {item("Wall the room (free)", () => onWallRoom(fac.id))}
          </div>
        )}
        {menu.kind === "furnishing" && (
          item("Rotate 90° (R)", () => onRotate({ kind: "furnishing", id: menu.id }))
        )}
        {menu.kind === "wall" && menu.type === "Interior Wall" && (
          item("Rotate 90° (R)", () => onRotate({ kind: "wall", id: menu.id }))
        )}
        {menu.kind !== "empty" && (
          <div className="mt-1 border-t pt-1">
            {item(
              "Select",
              () => onSelect({ kind: menu.kind, id: menu.id })
            )}
            {item("Delete", () => onDelete({ kind: menu.kind, id: menu.id }), "text-destructive")}
          </div>
        )}
      </div>
    </>
  );
}