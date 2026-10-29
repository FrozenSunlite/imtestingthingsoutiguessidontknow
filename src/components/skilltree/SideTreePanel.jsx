import { useEffect, useMemo, useRef, useState } from "react";
import {
  useTree,
  poolUsage,
  effectivePools,
  applyNodeProficiencies,
  poolForNode,
  POOL_LABELS,
  effectiveChoices,
  listCharacterSaves,
  ensureTabs,
  migrateTree,
  normalizeTree,
  statVars,
} from "@/lib/treeStore";
import { abilityReqStatus } from "@/lib/skills";
import { tierGate, nodeMaxPoints } from "@/lib/nodeTiers";
import { isAvailable, isExclusiveBlocked, collectUnlockedNames } from "@/lib/geometry";
import { SkillNodeView } from "@/components/skilltree/SkillNodeView";
import { ConnectionLayer } from "@/components/skilltree/ConnectionLayer";
import { NodeTooltip } from "@/components/skilltree/NodeTooltip";
import { AbilityChoiceDialog } from "@/components/skilltree/AbilityChoiceDialog";
import { SubtreePickerDialog } from "@/components/skilltree/SubtreePickerDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PanelResizer } from "@/components/skilltree/PanelResizer";
import { usePanelWidth } from "@/hooks/use-panel-width";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FolderOpen, Maximize, Upload, X } from "lucide-react";

// Prefix node ids so side-tree nodes can never collide with the main tree's
// (both number from "n0") — character ability choices are keyed by node id.
function prefixTree(nodes, connections, prefix) {
  const idMap = {};
  nodes.forEach((n) => (idMap[n.id] = `${prefix}-${n.id}`));
  return {
    nodes: nodes.map((n) => ({
      ...n,
      id: idMap[n.id],
      dependencies: (n.dependencies || []).map((d) => idMap[d]).filter(Boolean),
      exclusiveWith: (n.exclusiveWith || []).map((d) => idMap[d]).filter(Boolean),
    })),
    connections: connections
      .filter((c) => idMap[c.from] && idMap[c.to])
      .map((c) => ({
        ...c,
        id: `${idMap[c.from]}->${idMap[c.to]}`,
        from: idMap[c.from],
        to: idMap[c.to],
      })),
  };
}

// A play-only skill tree panel flanking the View screen: no edit tools — the
// tree is visible, nodes selectable, and investing a point applies its effects
// (resources, proficiencies, attribute bonuses…) to the character sheet.
// Points spent here draw from the same global pools as the main tree.
export function SideTreePanel({ slot, floating = false, stacked = false }) {
  const {
    tree,
    mergedTree,
    sideTrees,
    setSideTree,
    treeFocus,
    clearTreeFocus,
    investPoint,
    pools,
    character,
    setCharacter,
    settings,
    ui,
    setSubtreeNodePoints,
    openSubtreePanel,
  } = useTree();
  const st = (sideTrees || {})[slot];
  const [width, setPanelWidth] = usePanelWidth(440, 260, 720, "skilltree:sideWidth:" + slot);
  const [view, setView] = useState({ panX: 0, panY: 0, zoom: 0.35 });
  const [selectedId, setSelectedId] = useState(null);
  const [choiceNode, setChoiceNode] = useState(null);
  // Subtree chooser: opening (or reopening) a talent that owns its own skill
  // trees lets the player pick one to open as a floating window.
  const [subtreePickNode, setSubtreePickNode] = useState(null);
  const [vp, setVp] = useState({ w: 440, h: 500 });
  const containerRef = useRef(null);
  const fileRef = useRef(null);
  const dragRef = useRef(null);

  const isMain = st?.kind === "main";
  const nodes = isMain
    ? tree?.nodes || []
    : st?.kind === "snapshot" || st?.kind === "subtrees"
    ? st.nodes || []
    : [];
  const connections = isMain
    ? tree?.connections || []
    : st?.kind === "snapshot" || st?.kind === "subtrees"
    ? st.connections || []
    : [];
  const nodesById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  // Names unlocked anywhere (main tree + side trees + node subtrees):
  // cross-tree prerequisites check against this set.
  const unlockedNames = useMemo(
    () => collectUnlockedNames(mergedTree?.nodes || []),
    [mergedTree]
  );
  // Blind run (same rule as the main canvas): while playing, hide unstarted
  // nodes whose prerequisites aren't met; "include level requirements" also
  // hides nodes gated behind a higher character level.
  const hiddenIds = useMemo(() => {
    if (!character?.hideLockedNodes) return null;
    const level = character.level || 1;
    const includeLevel = !!character.hideLockedIncludeLevel;
    const ids = new Set();
    for (const n of nodes) {
      if ((n.currentPoints || 0) > 0) continue;
      if (!isAvailable(n, nodesById, unlockedNames)) ids.add(n.id);
      else if (includeLevel && Number(n.levelReq) > level) ids.add(n.id);
    }
    return ids;
  }, [character, nodes, nodesById, unlockedNames]);
  // Viewport culling, like the main canvas: only render what's near the
  // camera, quantized so panning doesn't rebuild the list every frame.
  const region = useMemo(() => {
    const z = view.zoom || 0.1;
    const step = 600;
    const m = 900;
    const f = (v) => Math.floor(v / step) * step;
    const c = (v) => Math.ceil(v / step) * step;
    return {
      minX: f(-view.panX / z) - m,
      maxX: c((vp.w - view.panX) / z) + m,
      minY: f(-view.panY / z) - m,
      maxY: c((vp.h - view.panY) / z) + m,
    };
  }, [view, vp]);
  const visibleNodes = useMemo(
    () =>
      nodes.filter(
        (n) =>
          !hiddenIds?.has(n.id) &&
          n.x >= region.minX && n.x <= region.maxX && n.y >= region.minY && n.y <= region.maxY
      ),
    [nodes, region, hiddenIds]
  );
  const visibleIds = useMemo(() => visibleNodes.map((n) => n.id), [visibleNodes]);
  const title = isMain ? tree?.name || "Main tree" : st?.name || "Tree";
  const levels = settings?.library?.levels || [];

  const usage = poolUsage(mergedTree);
  const eff = effectivePools(pools, character, mergedTree, levels);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setVp({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setVp({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [st]);

  // Fit the loaded tree in view (on mount and whenever another tree loads).
  const bounds = useMemo(() => {
    if (!nodes.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x);
      maxY = Math.max(maxY, n.y);
    }
    return { minX, minY, maxX, maxY };
  }, [nodes]);
  const fit = () => {
    if (!bounds) return;
    const w = bounds.maxX - bounds.minX + 200;
    const h = bounds.maxY - bounds.minY + 200;
    const vw = containerRef.current?.clientWidth || vp.w || 440;
    const vh = containerRef.current?.clientHeight || vp.h || 500;
    const z = Math.min(vw / w, vh / h, 1);
    setView({ zoom: z, panX: -(bounds.minX - 100) * z, panY: -(bounds.minY - 100) * z });
  };
  // The node the View camera opens on: the configured starter node, else the
  // first node placed (or the auto-granted first node of a subtree).
  const startNode = (() => {
    if (!nodes.length) return null;
    if (isMain) {
      const id = String(settings?.cameraStartNode || "");
      const configured = id ? nodesById[id] : null;
      if (configured) return configured;
    }
    return nodes.find((n) => n.__autoGranted) || nodes[0];
  })();
  const sig = nodes.length + ":" + (nodes[0]?.id || "") + ":" + (startNode?.id || "");
  useEffect(() => {
    // Entering the View page (or opening another subtree tab) centres the
    // camera on the configured starter node, or the first node placed. This
    // view state is local to the panel, so View panning never touches Edit.
    if (startNode) {
      const vw = containerRef.current?.clientWidth || vp.w || 440;
      const vh = containerRef.current?.clientHeight || vp.h || 500;
      const z = Math.max(0.4, Math.min(0.8, view.zoom || 0.5));
      setView({
        zoom: z,
        panX: vw / 2 - startNode.x * z,
        panY: vh / 2 - startNode.y * z,
      });
    }
    setSelectedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  // Double-click jump from the Character tab: when this panel holds the
  // requested node, centre the camera on it, select it, and claim the request.
  useEffect(() => {
    if (!treeFocus?.nodeId) return;
    const n = nodesById[treeFocus.nodeId];
    if (!n) return;
    const z = Math.max(view.zoom || 0.35, 0.5);
    setView({
      zoom: z,
      panX: (vp.w || 440) / 2 - n.x * z,
      panY: (vp.h || 500) / 2 - n.y * z,
    });
    setSelectedId(n.id);
    clearTreeFocus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeFocus, nodesById]);

  // Pan and wheel-zoom, mirroring the main canvas.
  const onPointerDown = (e) => {
    if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, panX: view.panX, panY: view.panY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setSelectedId(null);
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.hypot(dx, dy) > 4) dragRef.current.moved = true;
    setView((v) => ({ ...v, panX: d.panX + dx, panY: d.panY + dy }));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };
  const onWheel = (e) => {
    e.preventDefault();
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const rect = containerRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setView((v) => {
      const z = Math.min(2.5, Math.max(0.05, (v.zoom || 0.3) * factor));
      const wx = (sx - v.panX) / (v.zoom || 0.3);
      const wy = (sy - v.panY) / (v.zoom || 0.3);
      return { zoom: z, panX: sx - wx * z, panY: sy - wy * z };
    });
  };

  // Hover preview, like the main canvas.
  const [hover, setHover] = useState(null);
  const hoverTimer = useRef(null);
  const overRef = useRef(false);
  const pendingNode = useRef(null);
  const pendingPos = useRef({ x: 0, y: 0 });
  const clampPos = (e) => ({
    x: Math.min(e.clientX + 14, window.innerWidth - 280),
    y: Math.min(e.clientY + 14, window.innerHeight - 240),
  });
  const onHover = (e, node) => {
    overRef.current = true;
    pendingNode.current = node;
    pendingPos.current = clampPos(e);
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      hoverTimer.current = null;
      setHover({ node: pendingNode.current, ...pendingPos.current });
    }, 1200);
  };
  const onHoverMove = (e) => {
    if (!overRef.current || dragRef.current) return;
    pendingPos.current = clampPos(e);
    setHover((h) => (h ? { ...h, ...pendingPos.current } : h));
    if (!hoverTimer.current) {
      hoverTimer.current = setTimeout(() => {
        hoverTimer.current = null;
        setHover({ node: pendingNode.current, ...pendingPos.current });
      }, 300);
    }
  };
  const onHoverEnd = () => {
    overRef.current = false;
    clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    setHover(null);
  };
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  // Point investment: the same gates as the main canvas, but pool checks run
  // against the merged usage of every tree.
  const applyPoints = (id, delta) => {
    if (isMain) {
      investPoint(id, delta);
      return;
    }
    const updated = nodes.map((m) => {
      if (m.id !== id) return m;
      const rawMax = Number(m.maxPoints);
      const max = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 1;
      const cur = Number(m.currentPoints) || 0;
      const next = Math.max(0, Math.min(max, cur + delta));
      // Acquisition order for the sheet's unlocked lists: first point stamps it.
      return cur === 0 && next > 0
        ? { ...m, currentPoints: next, acquiredOrder: m.acquiredOrder || Date.now() }
        : { ...m, currentPoints: next };
    });
    const nextSt = Array.isArray(st.tabs) && st.activeKey
      ? {
          ...st,
          nodes: updated,
          tabs: st.tabs.map((t) =>
            t.key === st.activeKey ? { ...t, nodes: updated } : t
          ),
        }
      : { ...st, nodes: updated };
    setSideTree(slot, nextSt);
    // Subtree investments persist on the host node's stored subtree (keyed by
    // the node's original id chain), so they survive reloads.
    const target = updated.find((m) => m.id === id);
    if (st.subtreeHostId && Array.isArray(target?.__path)) {
      const chain =
        st.hostChain ||
        [{ hostId: st.subtreeHostId, subIndex: st.subtreeIndex ?? 0 }];
      setSubtreeNodePoints(chain, target.__path, target.currentPoints || 0);
    }
  };

  const commitInvest = (n, delta, optionNames) => {
    applyPoints(n.id, delta);
    // Proficiency grants stack on the shared character sheet.
    if (delta !== 0 && (n.proficiencies || []).length)
      setCharacter((c) => ({
        ...c,
        proficiencies: applyNodeProficiencies(c.proficiencies, n.proficiencies, delta),
      }));
    if (delta > 0 && Array.isArray(optionNames) && optionNames.length)
      setCharacter((c) => ({
        ...c,
        abilityChoices: {
          ...(c.abilityChoices || {}),
          [n.id]: [...(c.abilityChoices?.[n.id] || []), ...optionNames],
        },
      }));
  };

  const handleInvest = (n, delta) => {
    if ((n.nodeType || "") === "informative") {
      toast.error("Informative nodes are reference only — they can't be invested.");
      return;
    }
    // Subtree slots draw from the tree's own points and require the host node
    // to be unlocked on the main tree first.
    const isSub = !!st?.subtreeHostId;
    if (isSub) {
      const host = (tree?.nodes || []).find((m) => m.id === st.subtreeHostId);
      if (!host || (host.currentPoints || 0) <= 0) {
        toast.error(
          `Unlock “${host?.name || st.name || "the node"}” first — invest a point in it.`
        );
        return;
      }
      // Subtree-level ability gate: the character must meet the scores the
      // tree itself requires before spending any of its points.
      if ((st.abilityReqs || []).length) {
        const ab = abilityReqStatus(
          st.abilityReqs,
          statVars(character, mergedTree),
          character.modifiers?.ability
        );
        if (!ab.ok) {
          toast.error(`Requires ${ab.missing.join(", ")} before entering this tree.`);
          return;
        }
      }
    }
    if (delta > 0) {
      const max = nodeMaxPoints(n);
      const cur = Number(n.currentPoints) || 0;
      if (cur >= max) {
        // A talent with its own skill trees: reopening the chooser lets the
        // player keep spending that tree's granted points.
        if (!isSub && (n.subtrees || []).length) {
          setSubtreePickNode(n);
          return;
        }
        toast.error("Already at max points.");
        return;
      }
      // Tiered nodes gate each later tier behind its own character level, just
      // like the main canvas.
      const gate = tierGate(n, character.level || 1);
      if (!gate.ok) {
        toast.error(gate.reason);
        return;
      }
      if (isSub && st.exclusive && cur === 0) {
        const inSet = new Set(nodes.map((m) => m.id));
        const isRoot = !(n.dependencies || []).some((d) => inSet.has(d));
        const takenRoot = isRoot
          ? nodes.find(
              (m) =>
                m.id !== n.id &&
                (m.currentPoints || 0) > 0 &&
                !(m.dependencies || []).some((d) => inSet.has(d))
            )
          : null;
        if (takenRoot) {
          toast.error(
            `Mutually exclusive with “${takenRoot.name || "another branch"}” — refund it first.`
          );
          return;
        }
      }
      if (cur === 0 && isExclusiveBlocked(n, nodesById)) {
        const other = nodes.find(
          (m) =>
            m.id !== n.id &&
            (m.currentPoints || 0) > 0 &&
            ((n.exclusiveWith || []).includes(m.id) || (m.exclusiveWith || []).includes(n.id))
        );
        toast.error(
          `Mutually exclusive with ${other?.name || "another node"} — refund it first.`
        );
        return;
      }
      if (!isAvailable(n, nodesById, unlockedNames) && cur === 0) {
        toast.error("Prerequisites not met — invest in the required skills first.");
        return;
      }
      if (cur === 0) {
        const ab = abilityReqStatus(
          n.abilityReqs,
          statVars(character, mergedTree),
          character.modifiers?.ability
        );
        if (!ab.ok) {
          toast.error(`Requires ${ab.missing.join(", ")} first.`);
          return;
        }
      }
      const profs = character.proficiencies || {};
      const missing = (n.requiredProficiencies || []).filter(
        (r) =>
          !(profs[r.type] || []).some(
            (p) =>
              (p.name || "").trim().toLowerCase() ===
              String(r.name || "").trim().toLowerCase()
          )
      );
      if (missing.length) {
        toast.error(
          `Requires proficiency in ${missing.map((m) => m.name || "?").join(", ")} first.`
        );
        return;
      }
      const cost = Math.max(0, Number(n.cost ?? 1) || 0);
      if (isSub) {
        if (cost > 0) {
          // Free auto-grants (the tree's first node) never cost subtree points.
          const spent = nodes.reduce(
            (a, m) =>
              m.__autoGranted
                ? a
                : a + (m.currentPoints || 0) * Math.max(0, Number(m.cost ?? 1) || 0),
            0
          );
          const grant = Number(st.grantedPoints) || 0;
          if (spent + cost > grant) {
            toast.error(
              `No ${st.poolName || "Subtree"} points left — this tree grants ${grant}.`
            );
            return;
          }
        }
      } else {
        const poolKey = poolForNode(n);
        if (cost > 0 && poolKey) {
          const effPools = effectivePools(pools, character, mergedTree, levels);
          if (usage[poolKey] + cost > effPools[poolKey].total) {
            toast.error(
              `No ${POOL_LABELS[poolKey]} Points remaining — raise the limit or refund points.`
            );
            return;
          }
        }
      }
      if ((n.options || []).length) {
        setChoiceNode(n);
        return;
      }
      commitInvest(n, 1);
      // A talent with its own skill trees: open the chooser to pick one.
      if (!isSub && (n.subtrees || []).length) {
        setSubtreePickNode(n);
        return;
      }
      return;
    }
    // The tree's first node is granted by the talent itself — it isn't paid
    // for, so it can't be refunded for points.
    if (n.__autoGranted) {
      toast.error(`“${n.name || "This node"}” is granted by the talent and can't be refunded.`);
      return;
    }
    if ((n.options || []).length) {
      const taken = character.abilityChoices?.[n.id] || [];
      if (taken.length) {
        const perTake = Math.max(1, Number(n.optionsPerTake) || 1);
        setCharacter((c) => ({
          ...c,
          abilityChoices: {
            ...(c.abilityChoices || {}),
            [n.id]: taken.slice(0, Math.max(0, taken.length - perTake)),
          },
        }));
      }
    }
    commitInvest(n, -1);
  };
  const investStable = useRef(handleInvest);
  investStable.current = handleInvest;
  const onInvest = (node, delta) => investStable.current(node, delta);

  // Loading a tree into the slot: snapshot it with slot-prefixed ids.
  const loadSnapshot = (name, n, c) => {
    const p = prefixTree(n || [], c || [], slot);
    setSideTree(slot, { kind: "snapshot", name: name || "Tree", ...p });
    toast.success(`Loaded "${name || "Tree"}" into the ${slot} panel.`);
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const t = migrateTree(normalizeTree(JSON.parse(reader.result)));
        loadSnapshot(t.name || "Imported tree", t.nodes, t.connections);
      } catch {
        toast.error("Invalid skill tree file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const onNodePointerDown = (e, node) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelectedId(node.id);
  };

  if (!tree || !st || st.closed) return null;
  const selected = selectedId ? nodesById[selectedId] : null;
  const effChoices = effectiveChoices(character, mergedTree);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col bg-card",
        stacked ? "w-full min-h-0 flex-1" : "h-full",
        !floating && !stacked && "relative shrink-0",
        !floating && !stacked && (slot === "left" ? "border-r" : "border-l")
      )}
      style={floating || stacked ? undefined : { width }}
    >
      {!floating && !stacked && (
        <PanelResizer width={width} onResize={setPanelWidth} edge={slot === "left" ? "right" : "left"} />
      )}
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">{title}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              title="Load a saved skill tree into this panel"
            >
              <FolderOpen className="h-4 w-4" /> Load
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 w-60 overflow-y-auto">
            <DropdownMenuItem
              onClick={() =>
                loadSnapshot(tree?.name || "Main tree", tree?.nodes, tree?.connections)
              }
            >
              Current project tree
            </DropdownMenuItem>
            {(tree?.tabs || []).length > 1 && <DropdownMenuSeparator />}
            {(tree?.tabs || []).length > 1 && (
              <DropdownMenuLabel>Project tabs</DropdownMenuLabel>
            )}
            {(tree?.tabs || [])
              .filter((t) => t.id !== tree.activeTabId)
              .map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() => loadSnapshot(t.name, t.nodes, t.connections)}
                >
                  {t.name}
                </DropdownMenuItem>
              ))}
            <SaveItems onPick={(s) => {
              const t = ensureTabs(s.tree);
              loadSnapshot(s.name || "Saved tree", t.nodes, t.connections);
            }} />
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          title="Import a skill tree .json file"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2" title="Fit the tree in view" onClick={fit}>
          <Maximize className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          title="Close this panel — its tree and invested points are kept"
          onClick={() => setSideTree(slot, { ...st, closed: true })}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={onFile} />

      {/* Opened subtrees stack as tabs on the right; the main tree stays left. */}
      {Array.isArray(st?.tabs) && st.tabs.length > 1 && (
        <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 px-1.5 py-1">
          {st.tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              title={tab.name}
              onClick={() => setSideTree(slot, { ...st, ...tab, activeKey: tab.key })}
              className={`max-w-48 truncate rounded border px-2 py-0.5 text-[10px] ${
                tab.key === st.activeKey
                  ? "border-primary/60 bg-primary/10 font-semibold text-foreground"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>
      )}

      {/* Subtree slot: its own tree-specific point pool. */}
      {st?.subtreeHostId ? (
        <div
          className="flex items-center justify-around gap-1 border-b bg-muted/40 px-2 py-1 text-[10px]"
          title="Tree-specific points granted by the node that owns this subtree"
        >
          <span>
            <span className="text-amber-600">{st.poolName || "Subtree"}</span>{" "}
            <span className="font-mono">
              {nodes.reduce(
                (a, m) =>
                  m.__autoGranted
                    ? a
                    : a + (m.currentPoints || 0) * Math.max(0, Number(m.cost ?? 1) || 0),
                0
              )}
              /{Number(st.grantedPoints) || 0}
            </span>
          </span>
          {st.exclusive && <span className="text-rose-600">Mutually exclusive</span>}
        </div>
      ) : (
        /* Global pools shared by the main tree and both side panels */
        <div
          className="flex items-center justify-around gap-1 border-b bg-muted/40 px-2 py-1 text-[10px]"
          title="Shared by every tree — points invested in any panel draw from these pools"
        >
          <span>
            <span className="text-amber-600">Heritage</span>{" "}
            <span className="font-mono">{usage.heritage}/{eff.heritage.total}</span>
          </span>
          <span>
            <span className="text-sky-600">Talent</span>{" "}
            <span className="font-mono">{usage.talent}/{eff.talent.total}</span>
          </span>
          <span>
            <span className="text-violet-600">Attribute</span>{" "}
            <span className="font-mono">{usage.attribute}/{eff.attribute.total}</span>
          </span>
        </div>
      )}

      <div
        ref={containerRef}
        className="relative flex-1 touch-none overflow-hidden bg-background"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {nodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
            <p className="text-xs text-muted-foreground">
              No tree loaded in this panel — use Load or Import above. E.g. one side for
              skills, the other for heritage.
            </p>
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`,
              transformOrigin: "0 0",
              willChange: "transform",
            }}
          >
            <ConnectionLayer
              connections={connections}
              nodesById={nodesById}
              visibleIds={visibleIds}
              style={ui?.connectionStyle || "curved"}
              showArrows
              connector={settings.connector}
              altActive={false}
              hidden={hiddenIds}
              selectedId={null}
              onConnPointerDown={() => {}}
              onConnSelect={() => {}}
              onConnContextMenu={() => {}}
            />
            {visibleNodes.map((n) => (
              <SkillNodeView
                key={n.id}
                node={n}
                editable={false}
                selected={selectedId === n.id}
                showNames
                available={isAvailable(n, nodesById, unlockedNames)}
                placeholder={settings.placeholderImage}
                placeholderFrame={settings.placeholderFrame}
                highlighted={false}
                onSelect={() => {}}
                onPointerDown={onNodePointerDown}
                onHover={onHover}
                onHoverMove={onHoverMove}
                onHoverEnd={onHoverEnd}
                onContextMenu={() => {}}
                onInvest={onInvest}
                onOpenSubtree={
                  isMain || (st?.subtreeHostId && Array.isArray(st?.hostChain))
                    ? (n) => setSubtreePickNode(n)
                    : undefined
                }
                dblClickInvest={floating}
              />
            ))}
          </div>
        )}
        <NodeTooltip hover={hover} nodesById={nodesById} />
      </div>

      {selected && (
        <div className="max-h-28 shrink-0 overflow-y-auto border-t p-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold">{selected.name}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {selected.currentPoints || 0}/{selected.maxPoints}
              {selected.__autoGranted ? " · granted free" : ""}
            </span>
          </div>
          {((selected.talentTypes?.length || selected.talentType) ||
            Number(selected.levelReq) > 0) && (
            <div className="text-[10px] text-muted-foreground">
              {selected.talentTypes?.length
                ? selected.talentTypes.join(", ")
                : selected.talentType || ""}
              {Number(selected.levelReq) > 0
                ? ` · requires level ${selected.levelReq}`
                : ""}
            </div>
          )}
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            {selected.description || "No description."}
          </p>
        </div>
      )}

      <AbilityChoiceDialog
        node={choiceNode}
        nodesById={nodesById}
        choices={effChoices}
        perTake={choiceNode ? Number(choiceNode.optionsPerTake) || 1 : 1}
        onPick={(optionNames) => {
          commitInvest(choiceNode, 1, optionNames);
          setChoiceNode(null);
        }}
        onClose={() => setChoiceNode(null)}
      />

      <SubtreePickerDialog
        node={subtreePickNode}
        sideTrees={tree?.sideTrees}
        onPick={(i) => {
          const n = subtreePickNode;
          const parentChain =
            st?.hostChain ||
            (st?.subtreeHostId
              ? [{ hostId: st.subtreeHostId, subIndex: st.subtreeIndex ?? 0 }]
              : []);
          openSubtreePanel(n.__originalId || n.id, i, parentChain);
          setSubtreePickNode(null);
        }}
        onClose={() => setSubtreePickNode(null)}
      />
    </div>
  );
}

// Saved character bundles whose trees can be loaded into a side panel. Save
// slots are stored in IndexedDB, so they arrive asynchronously.
function SaveItems({ onPick }) {
  const [saves, setSaves] = useState([]);
  useEffect(() => {
    let alive = true;
    listCharacterSaves()
      .then((rows) => alive && setSaves(rows))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  if (!saves.length) return null;
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Saved characters</DropdownMenuLabel>
      {saves.map((s) => (
        <DropdownMenuItem key={s.id} onClick={() => onPick(s)}>
          {s.name}
        </DropdownMenuItem>
      ))}
    </>
  );
}