// Global status for long 5eTools imports. The importer keeps running after the
// Reference Index unmounts, so this store lives outside React and is shown by
// ImportStatusBanner on every screen.
const initial = {
  state: "idle", // idle | running | done | error
  label: "",
  done: 0,
  total: 0,
  detail: "",
  startedAt: 0,
  finishedAt: 0,
  result: null,
  error: "",
};

let current = initial;
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeImportStatus(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getImportStatus() {
  return current;
}

export function beginImport({ label = "Importing 5eTools data", total = 0 } = {}) {
  current = {
    ...initial,
    state: "running",
    label,
    total: Math.max(0, Number(total) || 0),
    startedAt: Date.now(),
  };
  emit();
}

export function updateImport({ done, total, detail } = {}) {
  if (current.state !== "running") return;
  current = {
    ...current,
    done: done == null ? current.done : Math.max(0, Number(done) || 0),
    total: total == null ? current.total : Math.max(0, Number(total) || 0),
    detail: detail == null ? current.detail : String(detail),
  };
  emit();
}

export function finishImport({ count = 0, tabs = 0, errors = 0, label } = {}) {
  const total = current.total || count;
  current = {
    ...current,
    state: "done",
    label: label || current.label,
    done: total,
    total,
    detail: "",
    finishedAt: Date.now(),
    result: {
      count: Math.max(0, Number(count) || 0),
      tabs: Math.max(0, Number(tabs) || 0),
      errors: Math.max(0, Number(errors) || 0),
    },
  };
  emit();
}

export function failImport(error) {
  current = {
    ...current,
    state: "error",
    detail: "",
    error: String(error?.message || error || "Import failed"),
    finishedAt: Date.now(),
  };
  emit();
}

export function dismissImport() {
  current = initial;
  emit();
}
