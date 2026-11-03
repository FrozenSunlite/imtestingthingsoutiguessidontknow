import { useEffect } from "react";
import { useTree } from "@/lib/treeStore";

// Keeps the Electron main process pointed at the same update host as the
// Settings field. The desktop updater itself checks /desktop-update.json.
export function DesktopUpdater() {
  const { settings } = useTree();
  useEffect(() => {
    const api = typeof window !== "undefined" ? window.talentDesktop : null;
    if (!api) return;
    // Empty is deliberate: the desktop app falls back to its own localhost
    // update feed (http://localhost:4173).
    api.setUpdateUrl(String(settings?.desktopUpdateUrl || "").trim());
  }, [settings?.desktopUpdateUrl]);
  return null;
}
