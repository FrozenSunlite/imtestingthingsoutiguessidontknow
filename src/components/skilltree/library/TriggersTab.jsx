import { Button } from "@/components/ui/button";
import { useTree } from "@/lib/treeStore";
import { NameList } from "./shared";
import { Plus } from "lucide-react";

// Common triggers auto-filled on request (and by default in a fresh library).
const COMMON_TRIGGERS = [
  "On Attack", "On Hit", "On Miss", "On Critical Hit", "On Kill",
  "On Cast", "On Being Hit", "On Taking Damage", "On Dropping to 0 HP",
  "On Successful Save", "On Failed Save", "On Taking a Reaction",
  "On an Opportunity Attack", "At the Start of Your Turn", "At the End of Your Turn",
  "On Short Rest", "On Long Rest", "On Level Up", "While Concentrating",
];

// Reference Library tab: the triggers an action or ability can hang off —
// On Hit, At the End of Your Turn, and so on. Fully editable name list, with
// a one-click fill of the common trigger phrases.
export function TriggersTab() {
  const { settings, setSettings } = useTree();
  if (!settings) return null;
  const triggers = settings.library.triggers || [];
  const setTriggers = (next) =>
    setSettings((s) => ({ ...s, library: { ...s.library, triggers: next } }));
  const missing = COMMON_TRIGGERS.filter((t) => !triggers.includes(t));
  return (
    <div className="space-y-2">
      <NameList
        label="Triggers (On Hit, At the End of Your Turn…)"
        entries={triggers}
        onChange={setTriggers}
        placeholder="Trigger (e.g. On Hit)"
      />
      {missing.length > 0 && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setTriggers([...triggers, ...missing])}
        >
          <Plus className="mr-1 h-4 w-4" /> Add common triggers ({missing.length})
        </Button>
      )}
    </div>
  );
}