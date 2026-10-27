import { useEffect, useState } from "react";

// App theme, shared by every Settings menu instance; the choice persists in
// localStorage:
// - cyber: the cyberpunk neon look (dark neon, cyan/magenta accents); off =
//   the original classic look.
// - dark: dark background. Toggling it inverts the colors of whichever theme
//   is active (light mode = the same neon accents on a light surface).
function readTheme() {
  try {
    const raw = localStorage.getItem("skilltree:theme");
    if (raw) return JSON.parse(raw);
    // Migrate the old toolbar dark-mode flag.
    const old = localStorage.getItem("skilltree:dark");
    if (old) return { cyber: true, dark: old === "1" };
  } catch {
    /* ignore */
  }
  return { cyber: true, dark: true };
}

export function useTheme() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("cyberpunk", !!theme.cyber);
    el.classList.toggle("dark", !!theme.dark);
    try {
      localStorage.setItem("skilltree:theme", JSON.stringify(theme));
    } catch {
      /* ignore */
    }
  }, [theme]);
  return [theme, setTheme];
}