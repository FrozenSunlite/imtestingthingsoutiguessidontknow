import { createStart } from "@tanstack/react-start";

// Default TanStack Start instance: the app has no server-side auth or data
// layer anymore — everything runs in the browser and in localStorage.
export const startInstance = createStart(() => ({}));
