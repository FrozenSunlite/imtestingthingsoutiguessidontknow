import { InfoTip } from "@/components/skilltree/InfoTip";
import { GitBranch, Trash2 } from "lucide-react";

// Right-click menu on a connector: fork a new child off the line, or delete.
// Fork adds a bend at the click point and links a new node from the
// connector's source node.
export function ConnectorMenu({ menu, editable, onFork, onDelete, onClose }) {
  if (!editable || !menu) return null;

  const item = (label, icon, onClick, danger) => (
    <InfoTip label={label} side="right">
      <button
        onClick={() => {
          onClick();
          onClose();
        }}
        className={`flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm hover:bg-accent ${
          danger ? "text-destructive" : "text-foreground"
        }`}
      >
        {icon}
        {label}
      </button>
    </InfoTip>
  );

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        className="fixed z-50 w-52 rounded-md border bg-popover p-1 shadow-lg"
        style={{ left: menu.x, top: menu.y }}
      >
        {item(
          "Fork here — new child node",
          <GitBranch className="h-4 w-4" />,
          () => onFork(menu.world),
          false
        )}
        {item("Delete connector", <Trash2 className="h-4 w-4" />, () => onDelete(menu.conn.id), true)}
      </div>
    </>
  );
}