import { useSyncExternalStore } from "react";
import { getImportStatus, subscribeImportStatus } from "./importStatus";

export function useImportStatus() {
  return useSyncExternalStore(
    subscribeImportStatus,
    getImportStatus,
    () => getImportStatus()
  );
}
