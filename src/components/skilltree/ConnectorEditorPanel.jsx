import { Button } from "@/components/ui/button";
import { useTree } from "@/lib/treeStore";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import { usePanelWidth } from "@/hooks/use-panel-width";
import { PanelResizer } from "@/components/skilltree/PanelResizer";

export function ConnectorEditorPanel({ mobile = false }) {
  const { tree, nodesById, ui, setUi, updateConnection, removeBend } = useTree();
  const [panelWidth] = usePanelWidth();
  const conn = tree.connections.find((c) => c.id === ui.selectedConnectionId);
  if (!conn) return null;

  const own = !!conn.ownStyle;
  const ov = conn.styleOverride || {};
  const setOv = (patch) =>
    updateConnection(conn.id, { styleOverride: { ...ov, ...patch } });

  return (
    <div
      className={`relative flex h-full flex-col bg-card ${mobile ? "w-full border-0" : "border-l"}`}
      style={mobile ? undefined : { width: panelWidth }}
    >
      {!mobile && <PanelResizer />}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Edit Connector</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setUi((u) => ({ ...u, selectedConnectionId: null }))}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
        <div className="rounded-md bg-muted/50 p-2 text-xs">
          <span className="font-medium">{nodesById[conn.from]?.name || "?"}</span>
          <span className="mx-1 text-muted-foreground">→</span>
          <span className="font-medium">{nodesById[conn.to]?.name || "?"}</span>
        </div>

        <label className="flex items-center gap-2 text-xs">
          <Switch
            checked={!own}
            onCheckedChange={(v) => updateConnection(conn.id, { ownStyle: !v })}
          />
          Use global settings
        </label>

        {!own && (
          <div className="space-y-3 rounded-md border p-3">
            <div className="space-y-1">
              <Label>Line type</Label>
              <Select
                value={ov.dash || "solid"}
                onValueChange={(v) => setOv({ dash: v })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">Solid</SelectItem>
                  <SelectItem value="dotted">Dotted</SelectItem>
                  <SelectItem value="dashed">Dashed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Thickness</Label>
              <Input
                type="number"
                min={1}
                max={20}
                className="h-8"
                value={ov.thickness ?? 2}
                onChange={(e) => setOv({ thickness: Math.max(1, Number(e.target.value) || 1) })}
              />
            </div>
            <div className="space-y-1">
              <Label>Color</Label>
              <input
                type="color"
                value={ov.color || "#94a3b8"}
                onChange={(e) => setOv({ color: e.target.value })}
                className="h-8 w-14 cursor-pointer rounded border bg-transparent"
              />
            </div>
            <div className="space-y-1">
              <Label>Opacity</Label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={ov.opacity ?? 0.6}
                  onChange={(e) => setOv({ opacity: Number(e.target.value) })}
                  className="h-1 flex-1 accent-primary"
                />
                <span className="w-8 text-right text-xs text-muted-foreground">
                  {Math.round((ov.opacity ?? 0.6) * 100)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {(conn.bends || []).length > 0 && (
          <div className="space-y-1">
            <Label>Bend points</Label>
            {conn.bends.map((b, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md border px-2 py-1 text-xs"
              >
                <span className="font-mono text-muted-foreground">
                  {Math.round(b.x)}, {Math.round(b.y)}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5"
                    disabled={i === 0}
                    title="Move earlier"
                    onClick={() => {
                      const bends = [...conn.bends];
                      [bends[i - 1], bends[i]] = [bends[i], bends[i - 1]];
                      updateConnection(conn.id, { bends });
                    }}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5"
                    disabled={i === conn.bends.length - 1}
                    title="Move later"
                    onClick={() => {
                      const bends = [...conn.bends];
                      [bends[i], bends[i + 1]] = [bends[i + 1], bends[i]];
                      updateConnection(conn.id, { bends });
                    }}
                  >
                    ↓
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5 text-destructive"
                    title="Remove this bend point"
                    onClick={() => removeBend(conn.id, i)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Click a connector to select it. Hold Alt and click along the line to add
          or drag bend points; remove them from the list above.
        </p>
      </div>
    </div>
  );
}