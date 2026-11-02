import { useSyncExternalStore } from "react";
import { getCurrentTrack, subscribeCurrentTrack } from "./audio";

export function useCurrentTrack() {
  return useSyncExternalStore(
    subscribeCurrentTrack,
    getCurrentTrack,
    () => null
  );
}
