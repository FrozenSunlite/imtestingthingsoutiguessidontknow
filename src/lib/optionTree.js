// Option-subtree helpers.
//
// An option may carry a `subtree` the player picks from after taking it:
//   { mode: "linked", nodeId }   → the linked node's options are the pick list
//   { mode: "embedded", options: [...] } → inline child options
//
// A "path" is an array of indices used while editing: index 0 points at a root
// option of the node; each following index points at a sub-option of the
// previous option's *embedded* subtree (e.g. [0, 1, 2] = root option 0 → its
// sub-option 1 → that sub-option 2). Choices on the character are stored as
// name paths instead ("Archery > Precision").

export function embeddedOptions(opt) {
  const st = opt?.subtree;
  return st?.mode === "embedded" && Array.isArray(st.options) ? st.options : [];
}

export function getOptionAtPath(rootOptions, path) {
  let opts = Array.isArray(rootOptions) ? rootOptions : [];
  let opt = null;
  for (const idx of path) {
    opt = opts[Number(idx)];
    if (!opt) return null;
    opts = embeddedOptions(opt);
  }
  return opt;
}

// Immutably replace the option at `path` with fn(opt) → opt.
export function mapOptionAtPath(rootOptions, path, fn) {
  if (!path.length) return rootOptions;
  const [idx, ...rest] = path;
  const opts = [...(Array.isArray(rootOptions) ? rootOptions : [])];
  const opt = opts[idx];
  if (!opt) return rootOptions;
  if (rest.length === 0) {
    opts[idx] = fn(opt);
    return opts;
  }
  const st =
    opt.subtree?.mode === "embedded" ? opt.subtree : { mode: "embedded", options: [] };
  opts[idx] = {
    ...opt,
    subtree: { ...st, options: mapOptionAtPath(st.options || [], rest, fn) },
  };
  return opts;
}

export function removeOptionAtPath(rootOptions, path) {
  if (!path.length) return rootOptions;
  const [idx, ...rest] = path;
  const opts = [...(Array.isArray(rootOptions) ? rootOptions : [])];
  if (rest.length === 0) {
    opts.splice(idx, 1);
    return opts;
  }
  const opt = opts[idx];
  if (!opt) return rootOptions;
  const st = opt.subtree?.mode === "embedded" ? opt.subtree : null;
  if (!st) return rootOptions;
  opts[idx] = {
    ...opt,
    subtree: { ...st, options: removeOptionAtPath(st.options || [], rest) },
  };
  return opts;
}

// Adds a fresh sub-option to the option at `parentPath` (switching its subtree
// to embedded mode if needed).
export function addSubOptionAt(
  rootOptions,
  parentPath,
  opt = { name: "", description: "", requires: { type: "none" } }
) {
  if (!parentPath.length) return rootOptions;
  return mapOptionAtPath(rootOptions, parentPath, (o) => ({
    ...o,
    subtree: { mode: "embedded", options: [...embeddedOptions(o), opt] },
  }));
}

// Subtree options as the player sees them: linked → the linked node's options,
// embedded → the inline options. nodesById is only needed for linked mode.
export function subtreeOptions(opt, nodesById) {
  const st = opt?.subtree;
  if (!st || st.mode === "none") return [];
  if (st.mode === "linked") return nodesById?.[st.nodeId]?.options || [];
  return Array.isArray(st.options) ? st.options : [];
}

// Resolve a stored choice path ("Archery > Precision") to the final option
// object on the tree; linked subtrees follow across nodes. Returns null when a
// segment no longer matches (e.g. an option was renamed or deleted).
export function optionAtPath(node, pathStr, nodesById) {
  const segs = String(pathStr || "").split(" > ");
  let opts = Array.isArray(node?.options) ? node.options : [];
  let opt = null;
  for (const seg of segs) {
    opt = opts.find((o) => (o.name || "") === seg);
    if (!opt) return null;
    opts = subtreeOptions(opt, nodesById);
  }
  return opt;
}