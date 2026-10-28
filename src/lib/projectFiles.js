// Project files on the local disk. The browser keeps the live working copy in
// IndexedDB; these helpers mirror saves into standalone/desktop/userdata/projects
// so the project also exists as an ordinary file on the PC.

export async function saveProjectToDisk(payload, { name = "", manual = false } = {}) {
  if (!payload) return null;
  const safeName = String(name || payload.name || "Terrific Talent Tree Project");
  try {
    const res = await fetch(
      `/api/project/save?name=${encodeURIComponent(safeName)}&mode=${manual ? "manual" : "auto"}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function listProjectFiles() {
  try {
    const res = await fetch("/api/project/list");
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.projects) ? data.projects : [];
  } catch {
    return [];
  }
}

export async function listProjectBackups() {
  try {
    const res = await fetch("/api/project/backups", { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.projects) ? data.projects : [];
  } catch {
    return [];
  }
}

export async function loadProjectFile(file, { backup = false } = {}) {
  if (!file) return null;
  try {
    const params = new URLSearchParams({ name: file });
    if (backup) params.set("backup", "1");
    const res = await fetch(`/api/project/load?${params.toString()}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function deleteProjectFile(file, { backup = false } = {}) {
  if (!file) return false;
  try {
    const params = new URLSearchParams({ name: file });
    if (backup) params.set("backup", "1");
    const res = await fetch(`/api/project/delete?${params.toString()}`, {
      method: "POST",
    });
    return res.ok;
  } catch {
    return false;
  }
}
