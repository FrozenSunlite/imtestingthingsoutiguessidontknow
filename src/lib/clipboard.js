// Copy text on HTTPS, HTTP, mobile WebViews and older browsers. The async
// Clipboard API is unavailable in some embedded browsers and non-secure
// contexts, so fall back to the legacy selection method.
export async function copyText(text) {
  const value = String(text ?? "");
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through to execCommand */
  }
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, value.length);
    const ok = document.execCommand("copy");
    area.remove();
    return !!ok;
  } catch {
    return false;
  }
}
