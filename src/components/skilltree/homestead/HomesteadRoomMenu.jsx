import { ATTACHMENTS } from "@/lib/homestead";

// Right-click menu on a placed room (basic facility): toggle its Cellar /
// Floor / Attic attachments on or off, and — for each attachment that is on —
// place rooms from the homebrew's allowed list directly into that storey.
export default function HomesteadRoomMenu({ menu, fac, onAttach, onAddRoom, onClose }) {
  if (!fac) return null;
  const onKeys = ["cellar", "floor", "attic"].filter((k) => fac[k]?.on);
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onPointerDown={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <div
        className="absolute z-50 w-56 rounded-md border bg-popover p-1 shadow-md"
        style={{ left: menu.x, top: menu.y }}
      >
        <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Attach to room
        </p>
        {["cellar", "floor", "attic"].map((key) => (
          <button
            key={key}
            className={`block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent ${fac[key]?.on ? "font-medium text-primary" : ""}`}
            onClick={() => onAttach(fac.id, key)}
          >
            {ATTACHMENTS[key].label}
            {fac[key]?.on ? " — on" : ""}
          </button>
        ))}
        {onKeys.map((key) => (
          <div key={key} className="mt-1 border-t pt-1">
            <p className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {ATTACHMENTS[key].label} — place a room
            </p>
            {ATTACHMENTS[key].allowed.map((name) => (
              <button
                key={name}
                className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent"
                onClick={() => onAddRoom(fac.id, key, name)}
              >
                + {name}
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}