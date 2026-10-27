import { useEffect, useState } from "react";
import { comboFromEvent, formatCombo } from "@/lib/hotkeys";
import { Button } from "@/components/ui/button";

export function HotkeyRow({ label, combo, onChange }) {
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (!listening) return;
    const onKey = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setListening(false);
        return;
      }
      const next = comboFromEvent(e);
      if (next) {
        onChange(next);
        setListening(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [listening, onChange]);

  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Button
        variant="outline"
        size="sm"
        className="w-32 font-mono"
        onClick={() => setListening(true)}
      >
        {listening ? "Press keys…" : formatCombo(combo)}
      </Button>
    </div>
  );
}