import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { Network, Plus, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { useTree } from "@/lib/treeStore";
import {
  displayLevel,
  nodeMaxPoints,
  tierGate,
} from "@/lib/nodeTiers";
import {
  snapPoint,
  isAvailable,
  isExclusiveBlocked,
  collectUnlockedNames,
  connectionPoints,
  nearestConnectionTarget,
} from "@/lib/geometry";
import {
  poolUsage,
  effectivePools,
  applyNodeProficiencies,
  poolForNode,
  effectiveChoices,
  useView,
  useViewSet,
  statVars,
  effectiveCharacterLevel,
  talentPurchaseLimit,
  talentPurchasesUsed,
} from "@/lib/treeStore";
import { poolLabel } from "@/lib/pointTypes";
import { abilityReqStatus } from "@/lib/skills";
import { comboMatches } from "@/lib/hotkeys";
import { searchNodes } from "@/lib/treeSearch";
import { NodeTooltip } from "@/components/skilltree/NodeTooltip";
import { AltDescriptionWindow } from "@/components/skilltree/AltDescriptionWindow";
import { toast } from "sonner";
import { SkillNodeView } from "@/components/skilltree/SkillNodeView";
import { ConnectionLayer } from "@/components/skilltree/ConnectionLayer";
import { GridLayer } from "@/components/skilltree/GridLayer";
import { MiniMap } from "@/components/skilltree/MiniMap";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { AbilityChoiceDialog } from "@/components/skilltree/AbilityChoiceDialog";
import { SubtreePickerDialog } from "@/components/skilltree/SubtreePickerDialog";
import { ConnectorMenu } from "@/components/skilltree/ConnectorMenu";
import { CarryGhost } from "@/components/skilltree/CarryGhost";
import { BenefitTableDialog } from "@/components/skilltree/BenefitTableDialog";
import { playSfx } from "@/lib/audio";
import { SFX } from "@/lib/sfx";
import { hiddenNodeIds } from "@/lib/nodeVisibility";
import {
  benefitCategoryForDrop,
  benefitSpells,
  spellTableForDrop,
} from "@/lib/benefits";

// Camera framing bookkeeping. Module scope on purpose: it must survive canvas
// unmounts, so returning from the character sheet keeps the current view.
// lastCentredKey is the tab/start-node pair currently framed; emptyTabs marks
// tabs with no nodes yet so their first node can pull the camera over.
let lastCentredKey = "";
const emptyTabs = new Set();

export function SkillTreeCanvas({ editable = false, onNodeContextMenu, onBackgroundContextMenu }) {
  const isMobile = useIsMobile();
  const {
    tree,
    nodesById,
    grid,
    ui,
    setUi,
    updateNode,
    addNodeBenefit,
    addNode,
    rotateNodes,
    deleteNodes,
    deleteConnection,
    flipNode,
    investPoint,
    pools,
    character,
    setCharacter,
    settings,
    undo,
    redo,
    addBend,
    moveBend,
    moveNodes,
    toggleDependency,
    copyNodes,
    cutNodes,
    pasteClipboard,
    mergedTree,
    openSubtreePanel,
    startCarry,
    exitSubtreeEditor,
  } = useTree();
  // View lives in its own context: panning no longer re-renders the editor
  // panel, character sheet or toolbar — only this canvas.
  const view = useView();
  const setView = useViewSet();
  // Latest view in a ref: the handlers below stay identity-stable so memoized
  // node and connector components skip re-rendering while panning.
  const viewRef = useRef(view);
  viewRef.current = view;
  // During a pan or wheel-zoom the world moves by writing the CSS transform
  // straight to the DOM — no React render per frame. The final camera is
  // committed to state when the gesture ends (or after wheeling pauses).
  const transformRef = useRef(null);
  const pendingViewRef = useRef(null);
  const commitTimer = useRef(null);
  const transformRaf = useRef(0);

  const applyTransform = () => {
    const pv = pendingViewRef.current;
    const layer = transformRef.current;
    if (!pv || !layer) return;
    // One composited layer for the whole world. During the gesture we disable
    // expensive node shadows/transitions (see index.css) so zooming stays
    // smooth even with hundreds of nodes.
    layer.dataset.navigating = "true";
    layer.style.transform = `translate3d(${pv.panX}px, ${pv.panY}px, 0) scale(${pv.zoom})`;
  };

  // Wheel/trackpad input can arrive several times per frame. Coalesce the
  // expensive DOM write so the browser composites only once per frame.
  const scheduleTransform = () => {
    if (transformRaf.current) return;
    transformRaf.current = requestAnimationFrame(() => {
      transformRaf.current = 0;
      applyTransform();
    });
  };

  const endNavigation = () => {
    if (transformRaf.current) {
      cancelAnimationFrame(transformRaf.current);
      transformRaf.current = 0;
    }
    if (transformRef.current) transformRef.current.dataset.navigating = "false";
  };

  useEffect(
    () => () => {
      if (transformRaf.current) cancelAnimationFrame(transformRaf.current);
      clearTimeout(commitTimer.current);
    },
    []
  );

  const containerRef = useRef(null);
  const touchPointers = useRef(new Map());
  const pinchRef = useRef(null);
  const [vp, setVp] = useState({ w: 800, h: 600 });

  // Move the camera so a world point sits in the middle of the canvas. The
  // editor panel opens in the same click that creates a node, which resizes
  // the canvas a moment later, so run again on the next frame and once more
  // after the layout settles.
  const centreOnWorld = useCallback(
    (wx, wy) => {
      const run = () => {
        const el = containerRef.current;
        if (!el) return;
        const w = el.clientWidth;
        const h = el.clientHeight;
        if (w < 10 || h < 10) return;
        const z = viewRef.current.zoom || 0.16;
        pendingViewRef.current = null;
        clearTimeout(commitTimer.current);
        setView({ zoom: z, panX: w / 2 - wx * z, panY: h / 2 - wy * z });
      };
      run();
      requestAnimationFrame(run);
      setTimeout(run, 140);
    },
    [setView]
  );

  // Entering a subtree swaps the canvas over to the branch's own node list;
  // centre the camera on the seeded copy of the host node (the branch root),
  // so the editor opens focused on it instead of the parent-space position.
  const subtreeStackLen = tree?.subtreeEditing?.stack?.length || 0;
  const prevSubtreeDepthRef = useRef(0);
  const preSubtreeViewRef = useRef(null);
  useEffect(() => {
    const prev = prevSubtreeDepthRef.current;
    prevSubtreeDepthRef.current = subtreeStackLen;
    pendingViewRef.current = null;
    clearTimeout(commitTimer.current);
    if (subtreeStackLen > prev) {
      // Entering: remember the parent-space camera, then centre on the
      // subtree's return node (the branch root).
      preSubtreeViewRef.current = viewRef.current;
      const copy =
        (tree?.nodes || []).find((n) => n.__returnNode) ||
        (tree?.nodes || []).find((n) => n.__hostCopy);
      if (!copy) return;
      const z = viewRef.current.zoom || 0.1;
      setView({ zoom: z, panX: vp.w / 2 - copy.x * z, panY: vp.h / 2 - copy.y * z });
    } else if (subtreeStackLen < prev && preSubtreeViewRef.current) {
      // Leaving: put the parent-space camera back.
      setView(preSubtreeViewRef.current);
      preSubtreeViewRef.current = null;
    }
  }, [subtreeStackLen, tree, vp, setView]);

  // Auto-centre the camera on the tab's camera-start node — or, when none is
  // set, on the first node in the tab. Re-centres when the active tab or its
  // start node changes, and when a tab's very first node is placed; stays put
  // otherwise (including after leaving for the character sheet and back).
  useEffect(() => {
    if (!tree) return;
    const tab = (tree.tabs || []).find((t) => t.id === tree.activeTabId);
    const tabId = tab?.id || tree.activeTabId || "tab";
    const nm = String(tab?.cameraStartNode || "").trim().toLowerCase();
    const key = tabId + "|" + nm;

    if (!(tree.nodes || []).length) {
      emptyTabs.add(tabId);
      lastCentredKey = "";
      return;
    }

    const forced = emptyTabs.delete(tabId); // first node just placed here
    if (!forced && lastCentredKey === key) return;
    lastCentredKey = key;

    const node =
      (nm && tree.nodes.find((m) => (m.name || "").trim().toLowerCase() === nm)) ||
      tree.nodes[0];
    if (!node) return;
    centreOnWorld(node.x, node.y);
  }, [tree, centreOnWorld]);

  const dragRef = useRef(null); // {type:'pan'|'node'|'bend', ...}
  const rightDragRef = useRef(null); // last right-drag that moved (suppresses node menu)
  const [altActive, setAltActive] = useState(false);
  const [hover, setHover] = useState(null);
  // The node under the pointer (before the 1.2s hover delay) — holding Alt
  // over it in View mode opens the description window.
  const [overNode, setOverNode] = useState(null);
  const [altWin, setAltWin] = useState(null);
  const [marquee, setMarquee] = useState(null);
  const [choiceNode, setChoiceNode] = useState(null);
  // Subtree chooser: unlocked talents with their own skill trees open this so
  // the player can pick which tree to open in a side panel.
  const [subtreePicker, setSubtreePicker] = useState(null);
  const [connMenu, setConnMenu] = useState(null); // {x, y, conn, world}
  const [dropNodeId, setDropNodeId] = useState(null);
  const [schoolDrop, setSchoolDrop] = useState(null);
  const hoverTimer = useRef(null);
  // Set when a link completes, so the click that finishes it doesn't also
  // select the target node and open the editor panel.
  const linkDoneRef = useRef(false);

  useEffect(() => {
    const track = (e) => setAltActive(e.altKey);
    const blur = () => setAltActive(false);
    window.addEventListener("keydown", track);
    window.addEventListener("keyup", track);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", track);
      window.removeEventListener("keyup", track);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // Hover a node for ~1.2s to preview its contents. The preview then follows
  // the cursor and stays up for as long as the pointer remains on the node —
  // it is hidden only by leaving the node, clicking, or starting a drag.
  const pendingPos = useRef({ x: 0, y: 0 });
  const pendingNode = useRef(null);
  const overRef = useRef(false);

  const clampPos = (e) => ({
    x: Math.min(e.clientX + 14, window.innerWidth - 280),
    y: Math.min(e.clientY + 14, window.innerHeight - 240),
  });

  const startHover = useCallback((e, node) => {
    overRef.current = true;
    pendingNode.current = node;
    // A fresh entry re-arms the Alt description window even for the same node.
    setOverNode({ node, seq: Date.now() });
    pendingPos.current = clampPos(e);
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      hoverTimer.current = null;
      setHover({ node: pendingNode.current, ...pendingPos.current });
    }, 1200);
  }, []);

  // Moving within the node repositions the tooltip and re-arms it after a
  // click hid it, so it never vanishes while the pointer is still hovering.
  const moveHover = useCallback((e) => {
    if (!overRef.current || dragRef.current) return;
    pendingPos.current = clampPos(e);
    setHover((h) => (h ? { ...h, ...pendingPos.current } : h));
    if (!hoverTimer.current) {
      hoverTimer.current = setTimeout(() => {
        hoverTimer.current = null;
        setHover({ node: pendingNode.current, ...pendingPos.current });
      }, 300);
    }
  }, []);

  const clearHover = useCallback(() => {
    overRef.current = false;
    setOverNode(null);
    clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    setHover(null);
  }, []);

  useEffect(() => () => clearTimeout(hoverTimer.current), []);
  useEffect(() => () => clearTimeout(commitTimer.current), []);

  // View mode: holding Alt over a node opens its description as a floating
  // window with clickable [[...]] links; releasing Alt closes it.
  useEffect(() => {
    if (!altActive) setAltWin(null);
    else if (!editable && overNode)
      setAltWin({ node: overNode.node, ...pendingPos.current });
  }, [altActive, overNode, editable]);

  // Clicking anywhere (invest, select, drag start) closes the preview; leaving
  // the node hides it via onHoverEnd. No global mousemove hide anymore.
  useEffect(() => {
    const hide = () => clearHover();
    window.addEventListener("pointerdown", hide);
    return () => window.removeEventListener("pointerdown", hide);
  }, [clearHover]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setVp({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setVp({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Configurable hotkeys (edit mode): undo/redo plus selected-node transforms.
  useEffect(() => {
    if (!editable || !settings?.hotkeys) return;
    const hk = settings.hotkeys;
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (comboMatches(e, hk.undo)) {
        undo();
        e.preventDefault();
      } else if (comboMatches(e, hk.redo)) {
        redo();
        e.preventDefault();
      } else if (comboMatches(e, hk.delete)) {
        // Delete key removes the current selection: a connector or node(s).
        if (ui.selectedConnectionId) {
          deleteConnection(ui.selectedConnectionId);
          e.preventDefault();
        } else if ((ui.selectedNodeIds || []).length) {
          deleteNodes(ui.selectedNodeIds);
          e.preventDefault();
        } else if (ui.selectedNodeId) {
          deleteNodes([ui.selectedNodeId]);
          e.preventDefault();
        }
      } else if (comboMatches(e, hk.selectAll)) {
        // Select every node currently on screen.
        const z = viewRef.current.zoom || 0.1;
        const x1 = -viewRef.current.panX / z;
        const x2 = (vp.w - viewRef.current.panX) / z;
        const y1 = -viewRef.current.panY / z;
        const y2 = (vp.h - viewRef.current.panY) / z;
        const ids = (tree?.nodes || [])
          .filter((n) => n.x >= x1 && n.x <= x2 && n.y >= y1 && n.y <= y2)
          .map((n) => n.id);
        setUi((u) => ({
          ...u,
          selectedNodeIds: ids,
          selectedNodeId: ids[0] || null,
          selectedConnectionId: null,
        }));
        e.preventDefault();
      } else if (comboMatches(e, hk.selectAllTab)) {
        // Select every node on the current tab.
        setUi((u) => ({
          ...u,
          selectedNodeIds: (tree?.nodes || []).map((n) => n.id),
          selectedNodeId: null,
          selectedConnectionId: null,
        }));
        e.preventDefault();
      } else if (comboMatches(e, hk.copy)) {
        // Copy the selection to the clipboard (Ctrl+V pastes it in any tab);
        // the next copy or cut replaces the clipboard contents.
        const ids = (ui.selectedNodeIds || []).length
          ? ui.selectedNodeIds
          : ui.selectedNodeId
          ? [ui.selectedNodeId]
          : [];
        if (ids.length) {
          copyNodes(ids);
          e.preventDefault();
        }
      } else if (comboMatches(e, hk.cut)) {
        // Cut the selection to the clipboard (Ctrl+V pastes it in any tab).
        const ids = (ui.selectedNodeIds || []).length
          ? ui.selectedNodeIds
          : ui.selectedNodeId
          ? [ui.selectedNodeId]
          : [];
        if (ids.length) {
          cutNodes(ids);
          e.preventDefault();
        }
      } else if (comboMatches(e, hk.paste)) {
        const pasted = pasteClipboard();
        if (pasted.length) {
          setUi((u) => ({
            ...u,
            selectedNodeIds: pasted,
            selectedNodeId: pasted[0],
            selectedConnectionId: null,
          }));
          e.preventDefault();
        }
      } else if (e.key === "Escape" && ui.linkingFromId) {
        // Esc cancels link mode.
        setUi((u) => ({ ...u, linkingFromId: null }));
        e.preventDefault();
      } else if ((ui.selectedNodeIds || []).length || ui.selectedNodeId) {
        const ids = (ui.selectedNodeIds || []).length
          ? ui.selectedNodeIds
          : [ui.selectedNodeId];
        if (comboMatches(e, hk.rotateRight)) {
          rotateNodes(ids, 15);
          e.preventDefault();
        } else if (comboMatches(e, hk.rotateLeft)) {
          rotateNodes(ids, -15);
          e.preventDefault();
        } else if (comboMatches(e, hk.flipH)) {
          ids.forEach((id) => flipNode(id, "h"));
          e.preventDefault();
        } else if (comboMatches(e, hk.flipV)) {
          ids.forEach((id) => flipNode(id, "v"));
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    editable,
    settings,
    ui.selectedNodeId,
    ui.selectedNodeIds,
    ui.selectedConnectionId,
    undo,
    redo,
    deleteConnection,
    deleteNodes,
    rotateNodes,
    flipNode,
    copyNodes,
    cutNodes,
    pasteClipboard,
    tree,
    vp,
    ui.linkingFromId,
  ]);

  // Grid covers the node extent plus 5 grid cells — nothing else. No viewport
  // term: panning and zooming never rebuild the grid (the zoom lag source);
  // the overflow-hidden viewport clips whatever falls outside the screen.
  // An empty tab has no extent, so it falls back to a patch around the world
  // origin (where its first node will anchor) — otherwise the grid vanished.
  const gridBounds = useMemo(() => {
    const nodes = tree?.nodes || [];
    const s = grid?.snapSize || 120;
    if (!nodes.length) {
      const m = 20 * s;
      return { minX: -m, maxX: m, minY: -m, maxY: m };
    }
    let nMinX = Infinity, nMaxX = -Infinity, nMinY = Infinity, nMaxY = -Infinity;
    for (const n of nodes) {
      if (n.x < nMinX) nMinX = n.x;
      if (n.x > nMaxX) nMaxX = n.x;
      if (n.y < nMinY) nMinY = n.y;
      if (n.y > nMaxY) nMaxY = n.y;
    }
    const m = 5 * s;
    return {
      minX: Math.floor((nMinX - m) / s) * s,
      maxX: Math.ceil((nMaxX + m) / s) * s,
      minY: Math.floor((nMinY - m) / s) * s,
      maxY: Math.ceil((nMaxY + m) / s) * s,
    };
  }, [tree?.nodes, grid?.snapSize]);

  // Preload window: a generous region around the camera, quantized to large
  // steps, so ordinary panning and zooming moves only the CSS transform and
  // re-renders almost never. Only crossing the window edge triggers one cheap
  // update, which pulls in another big margin. (Preloading the entire tree
  // instead made the browser repaint the whole oversized layer every frame —
  // the lag source — and would sink mobile.)
  const region = useMemo(() => {
    const z = view.zoom || 0.1;
    const step = 600;
    const m = 1200 + step; // world-units of margin beyond the camera
    const f = (v) => Math.floor(v / step) * step;
    const c = (v) => Math.ceil(v / step) * step;
    const minX = f(-view.panX / z) - m;
    const maxX = c((vp.w - view.panX) / z) + m;
    const minY = f(-view.panY / z) - m;
    const maxY = c((vp.h - view.panY) / z) + m;
    return { minX, maxX, minY, maxY, key: `${minX}|${minY}|${maxX}|${maxY}` };
  }, [view.panX, view.panY, view.zoom, vp.w, vp.h]);

  // Names unlocked anywhere (main tree + open side trees + node subtrees):
  // cross-tree prerequisites check against this set.
  const unlockedNames = useMemo(
    () => collectUnlockedNames(mergedTree?.nodes || []),
    [mergedTree]
  );

  // DM-hidden nodes and their exclusive descendants. Edit mode still renders
  // them (dimmed) so the DM can toggle them back; player View removes them.
  const dmHiddenIds = useMemo(() => hiddenNodeIds(tree?.nodes || []), [tree]);

  // Blind run (View mode only): hide unlocked=no nodes whose prerequisites
  // aren't met — and, optionally, whose level requirement exceeds the level.
  const hiddenIds = useMemo(() => {
    const ids = new Set();
    if (!editable) dmHiddenIds.forEach((id) => ids.add(id));
    if (!editable && character?.hideLockedNodes && tree) {
      const level = effectiveCharacterLevel(character, mergedTree);
      const includeLevel = !!character.hideLockedIncludeLevel;
      for (const n of tree.nodes) {
        if ((n.currentPoints || 0) > 0 || ids.has(n.id)) continue;
        if (!isAvailable(n, nodesById, unlockedNames)) ids.add(n.id);
        else if (includeLevel && displayLevel(n) > level) ids.add(n.id);
      }
    }
    return ids.size ? ids : null;
  }, [editable, character, tree, nodesById, unlockedNames, mergedTree, dmHiddenIds]);

  const visibleNodes = useMemo(() => {
    if (!tree) return [];
    return tree.nodes.filter(
      (n) =>
        // Informative nodes are editor-only reference — hidden outside Edit.
        (editable || (n.nodeType || "") !== "informative") &&
        (editable || !dmHiddenIds.has(n.id)) &&
        !hiddenIds?.has(n.id) &&
        n.x >= region.minX && n.x <= region.maxX && n.y >= region.minY && n.y <= region.maxY
    );
     
  }, [tree, region.key, hiddenIds, editable, dmHiddenIds]);

  // Large or zoomed-out trees switch to a cheaper node/connector treatment:
  // the alpha outline and 3D socket are still there, but with far fewer filters.
  const detailLevel = useMemo(() => {
    const zoom = view.zoom || 0.1;
    if (zoom < 0.28 || visibleNodes.length > 700) return "minimal";
    if (zoom < 0.5 || visibleNodes.length > 250) return "low";
    return "full";
  }, [view.zoom, visibleNodes.length]);
  const lowDetail = detailLevel !== "full";

  const visibleIds = useMemo(() => visibleNodes.map((n) => n.id), [visibleNodes]);

  // Availability is status for every visible node; compute it once per tree
  // change instead of once per node on every selection/hover render.
  const availableIds = useMemo(() => {
    const set = new Set();
    for (const node of visibleNodes) {
      if (isAvailable(node, nodesById, unlockedNames)) set.add(node.id);
    }
    return set;
  }, [visibleNodes, nodesById, unlockedNames]);

  // Blind-run pop-out: nodes that just became hidden shrink away as ghost
  // copies for a moment before disappearing entirely.
  const [exiting, setExiting] = useState([]);
  const exitingTimer = useRef(null);
  const prevVisibleRef = useRef({});
  useEffect(() => {
    const prev = prevVisibleRef.current;
    const next = {};
    visibleNodes.forEach((n) => (next[n.id] = n));
    if (hiddenIds) {
      const gone = Object.values(prev)
        .filter((n) => !next[n.id] && hiddenIds.has(n.id))
        .map((n) => ({ node: n, available: isAvailable(n, nodesById, unlockedNames) }));
      if (gone.length) {
        setExiting(gone);
        clearTimeout(exitingTimer.current);
        exitingTimer.current = setTimeout(() => setExiting([]), 320);
      }
    }
    prevVisibleRef.current = next;
  }, [visibleNodes, hiddenIds, nodesById, unlockedNames]);
  useEffect(() => () => clearTimeout(exitingTimer.current), []);

  // Search highlighting: same ranking logic the toolbar's SearchBox uses, so
  // the canvas lights up exactly the ranked matches.
  const searchSet = useMemo(() => {
    if (!tree) return null;
    const q = (ui.searchQuery || "").trim();
    if (!q) return null;
    return new Set(searchNodes(tree.nodes, q).map((m) => m.node.id));
  }, [tree, ui.searchQuery]);

  // Effective ability choices: manual picks plus auto grants plus options
  // attached to granted ones — requirements and the choice dialog see them all.
  const effChoices = useMemo(
    () => effectiveChoices(character, mergedTree),
    [character, mergedTree]
  );

  const screenToWorld = (sx, sy) => {
    const z = viewRef.current.zoom || 0.1;
    return { x: (sx - view.panX) / z, y: (sy - view.panY) / z };
  };

  const onBackgroundPointerDown = (e) => {
    setAltWin(null);
    if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
    // Track touch contacts for pinch-to-zoom before deciding pan vs marquee.
    if (e.pointerType === "touch") {
      const el = containerRef.current;
      const rect = el ? el.getBoundingClientRect() : { left: 0, top: 0 };
      touchPointers.current.set(e.pointerId, {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      if (touchPointers.current.size >= 2) {
        const pts = [...touchPointers.current.values()].slice(0, 2);
        const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        const base = pendingViewRef.current || viewRef.current;
        pinchRef.current = {
          startDist: Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)),
          startMid: mid,
          zoom: base.zoom || 0.1,
          panX: base.panX,
          panY: base.panY,
        };
        dragRef.current = null;
        setMarquee(null);
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        return;
      }
    }
    // Stop the browser's native drag-selection (blue highlight + caret) from
    // starting on a canvas press — panning and box-selecting are ours.
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    if (e.button === 0 && editable && !isMobile) {
      // Left-drag in edit mode: box-select nodes. On touch screens a one-finger
      // drag pans the camera instead; box-select stays a mouse/desktop tool.
      const start = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      dragRef.current = { type: "marquee", startScreen: start };
      setMarquee({ x1: start.x, y1: start.y, x2: start.x, y2: start.y });
    } else {
      dragRef.current = {
        type: "pan",
        startScreen: { x: e.clientX, y: e.clientY },
        startPan: { x: viewRef.current.panX, y: viewRef.current.panY },
        button: e.button,
        fromBackground: true,
      };
    }
    (e.currentTarget).setPointerCapture?.(e.pointerId);
  };

  const onNodePointerDown = useCallback(
    (e, node) => {
    e.stopPropagation();
    if (e.button === 0) {
      // No native text-selection/drag-image on node drags and link clicks.
      e.preventDefault();
    }
    if (e.button === 2) {
      // Right-hold anywhere (nodes included) pans like the middle mouse button.
      dragRef.current = {
        type: "pan",
        startScreen: { x: e.clientX, y: e.clientY },
        startPan: { x: viewRef.current.panX, y: viewRef.current.panY },
        fromNode: true,
      };
      (e.currentTarget).setPointerCapture?.(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    // Link mode (context menu or Alt+click): clicking a node completes the
    // link and exits the mode instead of selecting it.
    if (editable && ui.linkingFromId) {
      if (ui.linkingFromId !== node.id) {
        toggleDependency(ui.linkingFromId, node.id);
        playSfx(SFX.connector, { gain: 0.55 });
      }
      linkDoneRef.current = true;
      setUi((u) => ({ ...u, linkingFromId: null }));
      return;
    }
    // Alt+click: with a node selected, link from it to this one — hold Alt and
    // click further nodes to chain several connectors off the selection.
    // Otherwise Alt+click starts a link from this node; Alt+click another to
    // finish.
    if (editable && e.altKey) {
      if (ui.selectedNodeId && ui.selectedNodeId !== node.id) {
        toggleDependency(ui.selectedNodeId, node.id);
        playSfx(SFX.connector, { gain: 0.55 });
        linkDoneRef.current = true;
        return;
      }
      setUi((u) => ({ ...u, linkingFromId: node.id }));
      return;
    }
    // Ctrl+click toggles the node in a multi-selection.
    if (editable && (e.ctrlKey || e.metaKey)) {
      const cur = ui.selectedNodeIds || [];
      const group = cur.includes(node.id)
        ? cur.filter((id) => id !== node.id)
        : [...cur, node.id];
      setUi((u) => ({
        ...u,
        selectedNodeId: node.id,
        selectedNodeIds: group,
        selectedConnectionId: null,
      }));
      if (!group.length) return;
      dragRef.current = {
        type: "node",
        el: e.currentTarget,
        id: node.id,
        startScreen: { x: e.clientX, y: e.clientY },
        startPositions: group.map((id) => ({
          id,
          x: nodesById[id]?.x ?? node.x,
          y: nodesById[id]?.y ?? node.y,
        })),
      };
      (e.currentTarget).setPointerCapture?.(e.pointerId);
      return;
    }
    const groupIds =
      (ui.selectedNodeIds || []).includes(node.id) && ui.selectedNodeIds.length > 1
        ? [...ui.selectedNodeIds]
        : [node.id];
    setUi((u) => ({
      ...u,
      selectedNodeId: node.id,
      selectedNodeIds: editable ? groupIds : [],
      selectedConnectionId: null,
    }));
    if (!editable) return;
    dragRef.current = {
      type: "node",
      el: e.currentTarget,
      id: node.id,
      startScreen: { x: e.clientX, y: e.clientY },
      startPositions: groupIds.map((id) => ({
        id,
        x: nodesById[id]?.x ?? node.x,
        y: nodesById[id]?.y ?? node.y,
      })),
    };
    (e.currentTarget).setPointerCapture?.(e.pointerId);
    },
    [editable, nodesById, setUi, ui.selectedNodeIds, ui.linkingFromId, ui.selectedNodeId, toggleDependency]
  );

  // Fork a connector: a bend is created at the click point and a new child
  // node hangs off the connector's source node.
  const forkConnector = useCallback(
    (conn, world) => {
      const from = nodesById[conn.from];
      const p = snapPoint(world.x, world.y, grid);
      const id = addNode(p.x, p.y);
      updateNode(id, {
        talentType: from?.talentType || "",
        talentTypes: [...(from?.talentTypes || [])],
        size: from?.size || 100,
      });
      toggleDependency(conn.from, id);
      playSfx(SFX.connector, { gain: 0.55 });
      addBend(conn.id, world.x, world.y, 0);
      setUi((u) => ({
        ...u,
        selectedNodeId: id,
        editingNodeId: id,
        selectedConnectionId: null,
      }));
    },
    [nodesById, grid, addNode, updateNode, toggleDependency, addBend, setUi]
  );

  // With a node selected, alt+clicking a connector (or using its menu) makes
  // that node a new parent of the connector's destination, with a bend added
  // at the click point.
  const linkSelectedToConn = useCallback(
    (conn, world) => {
      if (!ui.selectedNodeId) return;
      toggleDependency(ui.selectedNodeId, conn.to);
      playSfx(SFX.connector, { gain: 0.55 });
      addBend(conn.id, world.x, world.y, 0);
      setConnMenu(null);
    },
    [ui.selectedNodeId, toggleDependency, addBend]
  );

  // Right-click on a connector opens its menu (fork / delete).
  const onConnContext = useCallback(
    (e, conn) => {
      if (!editable) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = containerRef.current.getBoundingClientRect();
      setConnMenu({
        x: e.clientX,
        y: e.clientY,
        conn,
        world: screenToWorld(e.clientX - rect.left, e.clientY - rect.top),
      });
    },
    [editable]
  );

  // Alt+press on a connector: drag to bend/morph; plain alt-click selects,
  // and a second alt-click on the selected connector adds another bend point.
  const onConnPointerDown = useCallback((e, conn) => {
    if (!e.altKey || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    // With a node selected, Alt+click reparents through this connector.
    if (editable && ui.selectedNodeId) {
      linkSelectedToConn(conn, w);
      return;
    }
    const from = nodesById[conn.from];
    const to = nodesById[conn.to];
    if (!from || !to) return;
    const pts = connectionPoints(conn, from, to);
    const target = nearestConnectionTarget(pts, w.x, w.y);
    const grabThreshold = 40 / (viewRef.current.zoom || 0.1);
    setUi((u) => ({
      ...u,
      selectedNodeId: null,
      editingNodeId: null,
      selectedConnectionId: conn.id,
    }));
    dragRef.current = {
      type: "bend",
      connId: conn.id,
      wasSelected: ui.selectedConnectionId === conn.id,
      world: w,
      segIndex: target.segIndex,
      bendIndex: target.bendDist < grabThreshold ? target.bendIndex : null,
      startScreen: { x: e.clientX, y: e.clientY },
      moved: false,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, [
    nodesById,
    ui.selectedConnectionId,
    setUi,
    editable,
    ui.selectedNodeId,
    linkSelectedToConn,
  ]);

  const onPointerMove = (e) => {
    // Pinch-to-zoom on touch screens: two contacts scale around their midpoint.
    if (e.pointerType === "touch" && touchPointers.current.has(e.pointerId)) {
      const rect = containerRef.current.getBoundingClientRect();
      touchPointers.current.set(e.pointerId, {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      if (pinchRef.current && touchPointers.current.size >= 2) {
        const pts = [...touchPointers.current.values()].slice(0, 2);
        const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        const dist = Math.max(
          1,
          Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
        );
        const pin = pinchRef.current;
        const z = Math.min(2.5, Math.max(0.03, pin.zoom * (dist / pin.startDist)));
        const wx = (pin.startMid.x - pin.panX) / pin.zoom;
        const wy = (pin.startMid.y - pin.panY) / pin.zoom;
        pendingViewRef.current = {
          zoom: z,
          panX: mid.x - wx * z,
          panY: mid.y - wy * z,
        };
        scheduleTransform();
        return;
      }
    }
    const d = dragRef.current;
    if (!d) return;
    if (d.type === "marquee") {
      const rect = containerRef.current.getBoundingClientRect();
      const cur = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (Math.hypot(cur.x - d.startScreen.x, cur.y - d.startScreen.y) > 4) d.moved = true;
      setMarquee({ x1: d.startScreen.x, y1: d.startScreen.y, x2: cur.x, y2: cur.y });
      const z = viewRef.current.zoom || 0.1;
      const wx1 = (Math.min(d.startScreen.x, cur.x) - view.panX) / z;
      const wx2 = (Math.max(d.startScreen.x, cur.x) - view.panX) / z;
      const wy1 = (Math.min(d.startScreen.y, cur.y) - view.panY) / z;
      const wy2 = (Math.max(d.startScreen.y, cur.y) - view.panY) / z;
      const ids = tree.nodes
        .filter((n) => n.x >= wx1 && n.x <= wx2 && n.y >= wy1 && n.y <= wy2)
        .map((n) => n.id);
      setUi((u) => ({
        ...u,
        selectedNodeIds: ids,
        // A one-node box should behave like clicking that node: it becomes the
        // primary selection so Edit/link actions and the mobile toolbar see it.
        selectedNodeId: ids.length === 1 ? ids[0] : null,
        selectedConnectionId: null,
      }));
    } else if (d.type === "pan") {
      const dx = e.clientX - d.startScreen.x;
      const dy = e.clientY - d.startScreen.y;
      if (Math.hypot(dx, dy) > 4) d.moved = true;
      pendingViewRef.current = {
        zoom: viewRef.current.zoom,
        panX: d.startPan.x + dx,
        panY: d.startPan.y + dy,
      };
      scheduleTransform();
    } else if (d.type === "node") {
      // Dragging the node out of the canvas — over a tab header or the
      // Subtrees section of the editor panel — turns the move into a carry.
      // Inside the canvas it stays a normal reposition.
      const bounds = containerRef.current.getBoundingClientRect();
      if (
        e.clientX <= bounds.left ||
        e.clientX >= bounds.right ||
        e.clientY <= bounds.top ||
        e.clientY >= bounds.bottom
      ) {
        const carried = d.startPositions
          .map((sp) => nodesById[sp.id])
          .filter(Boolean);
        if (carried.length) {
          const world = transformRef.current;
          if (world)
            for (const pos of d.positions || []) {
              const el = world.querySelector(`[data-node-id="${pos.id}"]`);
              if (el) el.style.transform = "";
            }
          startCarry(carried, {
            kind: tree?.subtreeEditing?.stack?.length ? "subtree" : "tab",
          });
          try {
            d.el?.releasePointerCapture?.(e.pointerId);
          } catch {
            /* not captured */
          }
          dragRef.current = { type: "carry" };
          return;
        }
      }
      const z = viewRef.current.zoom || 0.1;
      const dx = (e.clientX - d.startScreen.x) / z;
      const dy = (e.clientY - d.startScreen.y) / z;
      // Ghost the dragged nodes straight on the DOM: the tree (and every
      // memoized node and connector) only updates once, on pointer release.
      d.positions = d.startPositions.map((sp) => {
        const p = snapPoint(sp.x + dx, sp.y + dy, grid);
        return { id: sp.id, x: p.x, y: p.y, ox: sp.x, oy: sp.y };
      });
      const world = transformRef.current;
      if (world) {
        // Cache the dragged DOM nodes for this gesture. Querying every node on
        // every pointermove was a measurable cost with large trees.
        if (!d.elements) {
          d.elements = new Map();
          for (const pos of d.positions) {
            d.elements.set(pos.id, world.querySelector(`[data-node-id="${pos.id}"]`));
          }
        }
        for (const pos of d.positions) {
          const el = d.elements.get(pos.id);
          if (el) {
            el.style.transform = `translate3d(${Math.round(pos.x - pos.ox)}px, ${Math.round(pos.y - pos.oy)}px, 0)`;
          }
        }
      }
    } else if (d.type === "bend") {
      const rect = containerRef.current.getBoundingClientRect();
      const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      if (!d.moved) {
        if (Math.hypot(e.clientX - d.startScreen.x, e.clientY - d.startScreen.y) < 4)
          return;
        d.moved = true;
        if (d.bendIndex == null) {
          addBend(d.connId, w.x, w.y, d.segIndex);
          d.bendIndex = d.segIndex;
        }
      }
      moveBend(d.connId, d.bendIndex, w.x, w.y);
    }
  };

  const onPointerUp = (e) => {
    if (e?.pointerType === "touch") {
      touchPointers.current.delete(e.pointerId);
      if (pinchRef.current) {
        if (touchPointers.current.size < 2) {
          const pv = pendingViewRef.current;
          if (pv) {
            pendingViewRef.current = null;
            setView(pv);
          }
          pinchRef.current = null;
          endNavigation();
        }
        return;
      }
    }
    const d = dragRef.current;
    // End of a pan gesture: commit the camera to React state in one render.
    if (pendingViewRef.current) {
      const pv = pendingViewRef.current;
      pendingViewRef.current = null;
      setView(pv);
    }
    endNavigation();
    if (d?.type === "bend" && !d.moved && d.wasSelected) {
      addBend(d.connId, d.world.x, d.world.y, d.segIndex);
    }
    // End of a node drag: commit the ghosted positions to the tree in one
    // update, then clear the ghost transforms (this discrete update re-renders
    // before the next paint, so there is no flicker).
    if (d?.type === "node" && d.positions) {
      moveNodes(d.positions.map(({ id, x, y }) => ({ id, x, y })));
      const world = transformRef.current;
      if (world)
        for (const pos of d.positions) {
          const el = world.querySelector(`[data-node-id="${pos.id}"]`);
          if (el) el.style.transform = "";
        }
    }
    if (d?.type === "pan" && d.moved)
      rightDragRef.current = { moved: true, at: Date.now() };
    if (d?.type === "marquee") {
      setMarquee(null);
      if (!d.moved) {
        setUi((u) => ({
          ...u,
          selectedNodeId: null,
          editingNodeId: null,
          selectedNodeIds: [],
          selectedConnectionId: null,
        }));
      } else {
        // Keep the primary selection in step with the final box contents.
        setUi((u) => {
          const ids = u.selectedNodeIds || [];
          return { ...u, selectedNodeId: ids.length === 1 ? ids[0] : null };
        });
      }
    }
    // A plain left click (no pan) on empty canvas in View mode deselects too.
    if (d?.type === "pan" && !d.moved && d.button === 0 && d.fromBackground) {
      setUi((u) => ({
        ...u,
        selectedNodeId: null,
        editingNodeId: null,
        selectedNodeIds: [],
        selectedConnectionId: null,
      }));
    }
    dragRef.current = null;
  };

  // Plain click on a connector selects it for per-line editing.
  const onConnSelect = useCallback(
    (e, conn) => {
      if (!editable) return;
      e.stopPropagation();
      setUi((u) => ({
        ...u,
        selectedNodeId: null,
        editingNodeId: null,
        selectedNodeIds: [],
        selectedConnectionId: conn.id,
      }));
    },
    [editable, setUi]
  );

  const onWheel = (e) => {
    // React attaches wheel listeners passively, so preventDefault() only logs a
    // console warning; the workspace is overflow-hidden and cannot scroll.
    // Wheel pressed/tilted on its sides (deltaX only) must not affect zoom.
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const rect = containerRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const base = pendingViewRef.current || viewRef.current;
    const z = Math.min(2.5, Math.max(0.03, (base.zoom || 0.1) * factor));
    // zoom toward cursor: keep world point under cursor fixed
    const wx = (sx - base.panX) / (base.zoom || 0.1);
    const wy = (sy - base.panY) / (base.zoom || 0.1);
    pendingViewRef.current = { zoom: z, panX: sx - wx * z, panY: sy - wy * z };
    scheduleTransform();
    clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      const pv = pendingViewRef.current;
      if (pv) {
        pendingViewRef.current = null;
        setView(pv);
      }
      endNavigation();
    }, 180);
  };

  const commitPendingView = (delay = 180) => {
    clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      const pv = pendingViewRef.current;
      if (pv) {
        pendingViewRef.current = null;
        setView(pv);
      }
      endNavigation();
    }, delay);
  };

  // On-screen camera controls for touch screens (zoom around the view centre).
  const zoomViewBy = (factor) => {
    const base = pendingViewRef.current || viewRef.current;
    const sx = (vp?.w || 0) / 2;
    const sy = (vp?.h || 0) / 2;
    const z = Math.min(2.5, Math.max(0.03, (base.zoom || 0.1) * factor));
    const wx = (sx - base.panX) / (base.zoom || 0.1);
    const wy = (sy - base.panY) / (base.zoom || 0.1);
    pendingViewRef.current = { zoom: z, panX: sx - wx * z, panY: sy - wy * z };
    scheduleTransform();
    commitPendingView();
  };

  const fitView = () => {
    const nodes = tree?.nodes || [];
    if (!nodes.length) {
      centreOnWorld(0, 0);
      return;
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const node of nodes) {
      if (node.x < minX) minX = node.x;
      if (node.x > maxX) maxX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.y > maxY) maxY = node.y;
    }
    const pad = 240;
    const w = Math.max(1, maxX - minX + pad);
    const h = Math.max(1, maxY - minY + pad);
    const z = Math.min(
      2.5,
      Math.max(0.03, Math.min((vp?.w || 800) / w, (vp?.h || 600) / h))
    );
    pendingViewRef.current = {
      zoom: z,
      panX: (vp?.w || 800) / 2 - ((minX + maxX) / 2) * z,
      panY: (vp?.h || 600) / 2 - ((minY + maxY) / 2) * z,
    };
    scheduleTransform();
    commitPendingView(0);
  };

  const onDoubleClick = (e) => {
    if (!editable) return;
    const wasEmpty = !tree?.nodes?.length;
    const rect = containerRef.current.getBoundingClientRect();
    const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    const p = snapPoint(w.x, w.y, grid);
    const id = addNode(p.x, p.y);
    setUi((u) => ({ ...u, selectedNodeId: id, editingNodeId: id }));
    // The tab's very first node anchors at the world origin — bring the camera
    // to it so a new tree starts centred instead of in a corner.
    if (wasEmpty) centreOnWorld(0, 0);
  };

  // Mobile has no double-click convenience, so give the canvas a real Add
  // button that drops a node at the middle of the current view.
  const addNodeAtCenter = () => {
    if (!editable) return;
    const wasEmpty = !tree?.nodes?.length;
    const w = screenToWorld((vp?.w || 0) / 2, (vp?.h || 0) / 2);
    const p = snapPoint(w.x, w.y, grid);
    const id = addNode(p.x, p.y);
    setUi((u) => ({ ...u, selectedNodeId: id, editingNodeId: id }));
    if (wasEmpty) centreOnWorld(0, 0);
  };

  // Drag an entry from the Reference Library or a Library tab:
  // - dropped on an existing node, it becomes a granted benefit on that node;
  // - dropped on empty workspace, it becomes a new node.
  const dropNodeAt = (e) => {
    if (typeof document === "undefined" || !document.elementsFromPoint) return null;
    for (const element of document.elementsFromPoint(e.clientX, e.clientY)) {
      const holder = element.closest?.("[data-node-id]");
      const id = holder?.getAttribute("data-node-id");
      if (id && nodesById[id]) return nodesById[id];
    }
    return null;
  };

  const readDropPayload = (e) => {
    try {
      const raw5e = e.dataTransfer.getData("application/x-5etools-entry");
      if (raw5e) return { kind: "5e", payload: JSON.parse(raw5e) };
      const rawBenefit = e.dataTransfer.getData("application/x-benefit");
      if (rawBenefit) return { kind: "benefit", payload: JSON.parse(rawBenefit) };
    } catch {
      return null;
    }
    return null;
  };

  const onDragOver = (e) => {
    if (!editable) return;
    const types = [...(e.dataTransfer.types || [])];
    if (
      !types.includes("application/x-5etools-entry") &&
      !types.includes("application/x-benefit")
    ) {
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    const node = dropNodeAt(e);
    const next = node?.id || null;
    setDropNodeId((current) => (current === next ? current : next));
  };
  const onDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDropNodeId(null);
  };
  const onDrop = (e) => {
    if (!editable) return;
    const dropped = readDropPayload(e);
    setDropNodeId(null);
    if (!dropped?.payload) return;
    e.preventDefault();
    const payload = dropped.payload;
    const node = dropNodeAt(e);

    if (
      !node &&
      (payload.category === "spellSchool" || payload.category === "spellSubschool")
    ) {
      toast("Drop a spell school onto an existing node to create a spell table.");
      return;
    }

    if (node) {
      if (payload.category === "spellSchool" || payload.category === "spellSubschool") {
        const subschool = payload.category === "spellSubschool";
        setSchoolDrop({
          nodeId: node.id,
          nodeName: node.name || "node",
          name: `${payload.name || "Spell"} Spells`,
          table: spellTableForDrop({
            school: subschool ? "" : payload.name || "",
            subschool: subschool ? payload.name || "" : "",
            parent: subschool ? payload.parent || "" : "",
          }),
        });
        setUi((u) => ({ ...u, selectedNodeId: node.id }));
        return;
      }
      const mapped = benefitCategoryForDrop(payload);
      addNodeBenefit(node.id, {
        // A table row dragged by name has no table definition; keep its text
        // as a Feature instead of creating an empty table benefit.
        category: mapped === "table" && !payload.table ? "feature" : mapped,
        name: payload.name || "Imported Entry",
        source: payload.source || payload.flavor || "",
        description: payload.description || "",
        image: payload.image || "",
        ...(payload.table ? { table: payload.table } : {}),
      });
      setUi((u) => ({ ...u, selectedNodeId: node.id }));
      toast.success(
        `“${payload.name || "Entry"}” added to “${node.name || "node"}”.`
      );
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    const p = snapPoint(w.x, w.y, grid);
    const id = addNode(p.x, p.y);
    updateNode(id, {
      name: payload.name || "Imported Entry",
      description: payload.description || "",
      flavor: payload.flavor || payload.source || "",
      image: payload.image || "",
    });
    setUi((u) => ({ ...u, selectedNodeId: id, editingNodeId: null }));
    toast.success(`“${payload.name || "Entry"}” added to the workspace.`);
  };

  // Point investment. Nodes with ability options (e.g. Fighting Style) open a
  // choice dialog for every take; refunding drops the most recent choice.
  const commitInvest = (n, delta, optionNames) => {
    investPoint(n.id, delta);
    // Proficiency grants stack on the sheet ("times" per skill).
    if (delta !== 0 && (n.proficiencies || []).length) {
      setCharacter((c) => ({
        ...c,
        proficiencies: applyNodeProficiencies(
          c.proficiencies,
          n.proficiencies,
          delta,
          Math.max(0, (Number(n.currentPoints) || 0) + delta)
        ),
      }));
    }
    if (delta > 0 && Array.isArray(optionNames) && optionNames.length) {
      setCharacter((c) => ({
        ...c,
        abilityChoices: {
          ...(c.abilityChoices || {}),
          [n.id]: [...(c.abilityChoices?.[n.id] || []), ...optionNames],
        },
      }));
    }
  };

  const openSubtreeForNode = useCallback(
    (node) => {
      if (!node) return;
      const level = Math.max(1, effectiveCharacterLevel(character, mergedTree));
      const eligible = (node.subtrees || [])
        .map((subtree, index) => ({ subtree, index }))
        .filter(
          ({ subtree }) =>
            !Number(subtree.level) || Number(subtree.level) <= level
        );
      const specific = eligible.filter(({ subtree }) => Number(subtree.level) > 0);
      const fallback = eligible.find(({ subtree }) => subtree.default);
      if (!specific.length && fallback) {
        openSubtreePanel(node.id, fallback.index);
        return;
      }
      setSubtreePicker(node);
    },
    [character?.level, openSubtreePanel]
  );

  const handleInvest = (n, delta) => {
    if ((n.nodeType || "") === "informative") {
      toast.error("Informative nodes are reference only — they can't be invested.");
      return;
    }
    if (delta > 0) {
      const max = nodeMaxPoints(n);
      const cur = Number(n.currentPoints) || 0;
      if (cur >= max) {
        // A talent with its own skill trees: reopening the chooser lets the
        // player keep spending that tree's granted points until they're done.
        if ((n.subtrees || []).length) {
          openSubtreeForNode(n);
          return;
        }
        toast.error("Already at max points.");
        return;
      }
      const level = effectiveCharacterLevel(character, mergedTree);
      const gate = tierGate(n, level);
      if (!gate.ok) {
        toast.error(gate.reason);
        return;
      }
      if (
        cur === 0 &&
        poolForNode(n, settings?.library?.pointTypes) === "talent" &&
        (n.nodeType || "") !== "informative"
      ) {
        const limit = talentPurchaseLimit(level, settings);
        const used = talentPurchasesUsed(mergedTree, settings?.library?.pointTypes);
        if (Number.isFinite(limit) && used >= limit) {
          toast.error(
            `Talent limit reached at level ${level}: ${used}/${limit} talents purchased.`
          );
          return;
        }
      }
      if (cur === 0 && isExclusiveBlocked(n, nodesById)) {
        const other = tree.nodes.find(
          (m) =>
            m.id !== n.id &&
            (m.currentPoints || 0) > 0 &&
            ((n.exclusiveWith || []).includes(m.id) ||
              (m.exclusiveWith || []).includes(n.id))
        );
        toast.error(
          `Mutually exclusive with ${other?.name || "another node"} — refund it first.`
        );
        return;
      }
      if (!(isAvailable(n, nodesById, unlockedNames) || cur > 0)) {
        toast.error("Prerequisites not met — invest in the required skills first.");
        return;
      }
      // Required proficiencies (e.g. a Mundane Talent needing a Skill
      // Proficiency): the character must already have each listed one.
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
      // Ability-score prerequisites, checked against the sheet's effective
      // scores (base + attribute bonuses + manual modifiers).
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
      // Per-node cost: 0 = free, otherwise pool points per invested point.
      // Pool limits are global: side-tree panels share these pools.
      const usage = poolUsage(mergedTree, settings?.library?.pointTypes);
      const cost = Math.max(0, Number(n.cost ?? 1) || 0);
      const poolKey = poolForNode(n, settings?.library?.pointTypes);
      if (cost > 0 && poolKey) {
        const eff = effectivePools(
          pools,
          character,
          mergedTree,
          settings?.library?.levels,
          settings
        );
        if (usage[poolKey] + cost > eff[poolKey].total) {
          toast.error(
            `No ${poolLabel(settings?.library?.pointTypes, poolKey)} Points remaining — raise the limit or refund points.`
          );
          return;
        }
      }
      if ((n.options || []).length) {
        setChoiceNode(n);
        return;
      }
      commitInvest(n, 1);
      // A talent with its own skill trees: open the chooser so the player can
      // pick a tree and spend the pool it grants.
      if ((n.subtrees || []).length) openSubtreeForNode(n);
      return;
    }
    if ((n.options || []).length) {
      const taken = character.abilityChoices?.[n.id] || [];
      if (taken.length) {
        // One invested point grants "options per take" choices; refunding
        // removes that many of the most recent ones.
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

  // Identity-stable handlers for the memoized canvas children.
  const investRef = useRef(handleInvest);
  investRef.current = handleInvest;
  const onInvestStable = useCallback((node, delta) => investRef.current?.(node, delta), []);
  const selectNodeStable = useCallback(
    (node) => {
      // The click that completes a link must not also select the target.
      if (linkDoneRef.current) {
        linkDoneRef.current = false;
        return;
      }
      setUi((u) => ({ ...u, selectedNodeId: node.id, editingNodeId: editable ? node.id : null }));
    },
    [editable, setUi]
  );
  const onNodeContext = useCallback(
    (e, node) => {
      e.preventDefault();
      e.stopPropagation();
      clearHover();
      if (rightDragRef.current?.moved && Date.now() - rightDragRef.current.at < 500) {
        rightDragRef.current = null;
        return;
      }
      rightDragRef.current = null;
      setUi((u) => ({ ...u, selectedNodeId: node.id }));
      onNodeContextMenu?.(e, node);
    },
    [clearHover, setUi, onNodeContextMenu]
  );

  // Minimap jump: recentre the camera on a world point, keeping the zoom.
  const jumpTo = useCallback(
    (wx, wy) => {
      const z = viewRef.current.zoom || 0.1;
      pendingViewRef.current = null;
      clearTimeout(commitTimer.current);
      setView({ zoom: z, panX: vp.w / 2 - wx * z, panY: vp.h / 2 - wy * z });
    },
    [setView, vp]
  );

  if (!tree) return null;

  // Subtree-editor banner state: the outermost frame's host is the currently
  // edited subtree's owner.
  const stack = tree.subtreeEditing?.stack || [];
  const subtreeFrame = stack.length ? stack[stack.length - 1] : null;
  const subtreeDepth = stack.length;
  const subtreeHostName = subtreeFrame
    ? subtreeFrame.nodes.find((n) => n.id === subtreeFrame.hostId)?.name || "node"
    : null;

  // Mid-gesture camera: mid-pan re-renders (e.g. a hover tooltip) keep the
  // imperative transform instead of snapping back to the old state.
  const shown = pendingViewRef.current || view;

  return (
    <>
    <div
      ref={containerRef}
      role="region"
      aria-label="Skill tree workspace"
      className="relative h-full w-full touch-none select-none overflow-hidden bg-background"
      onPointerDown={onBackgroundPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onContextMenu={(e) => {
        e.preventDefault();
        // Suppress the menu right after a right-drag pan.
        if (rightDragRef.current?.moved && Date.now() - rightDragRef.current.at < 500) {
          rightDragRef.current = null;
          return;
        }
        rightDragRef.current = null;
        if (!editable) return;
        const rect = containerRef.current.getBoundingClientRect();
        const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
        onBackgroundContextMenu?.(e, world);
      }}
    >
      <div
        ref={transformRef}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transform: `translate3d(${shown.panX}px, ${shown.panY}px, 0) scale(${shown.zoom})`,
          transformOrigin: "0 0",
          willChange: "transform",
        }}
      >
        <GridLayer bounds={gridBounds} grid={grid} zoom={shown.zoom} />
        <ConnectionLayer
          connections={tree.connections}
          nodesById={nodesById}
          visibleIds={visibleIds}
          style={ui.connectionStyle}
          showArrows={ui.showArrows}
          connector={settings.connector}
          altActive={altActive}
          hidden={hiddenIds}
          selectedId={ui.selectedConnectionId}
          onConnPointerDown={onConnPointerDown}
          onConnSelect={onConnSelect}
          onConnContextMenu={onConnContext}
          lowDetail={lowDetail}
        />
        {visibleNodes.map((n) => (
          <SkillNodeView
            key={n.id}
            node={n}
            editable={editable}
            selected={ui.selectedNodeId === n.id || (ui.selectedNodeIds || []).includes(n.id)}
            showNames={ui.showNames}
            dmHidden={dmHiddenIds.has(n.id)}
            dropTarget={dropNodeId === n.id}
            available={availableIds.has(n.id)}
            placeholder={settings.placeholderImage}
            placeholderFrame={settings.placeholderFrame}
            highlighted={searchSet?.has(n.id) || false}
            onSelect={selectNodeStable}
            onPointerDown={onNodePointerDown}
            onHover={startHover}
            onHoverMove={moveHover}
            onHoverEnd={clearHover}
            onContextMenu={onNodeContext}
            onInvest={onInvestStable}
            onOpenSubtree={editable ? undefined : (n) => setSubtreePicker(n)}
            onReturnParent={editable ? exitSubtreeEditor : undefined}
            popIn={!!hiddenIds}
            detailLevel={detailLevel}
          />
        ))}
        {exiting.map((g) => {
          const s = g.node.size || 100;
          return (
            <div
              key={`exiting-${g.node.id}`}
              className="pointer-events-none animate-[node-pop-out_0.3s_ease-in_forwards]"
              style={{
                position: "absolute",
                left: g.node.x - s / 2,
                top: g.node.y - s / 2,
                width: s,
                height: s,
              }}
            >
              <SkillNodeView
                node={g.node}
                editable={false}
                selected={false}
                available={g.available}
                showNames={false}
                onSelect={() => {}}
                onPointerDown={() => {}}
                onInvest={() => {}}
              />
            </div>
          );
        })}
      </div>

      {marquee && (
        <div
          className="pointer-events-none absolute z-10 rounded border border-primary bg-primary/10"
          style={{
            left: Math.min(marquee.x1, marquee.x2),
            top: Math.min(marquee.y1, marquee.y2),
            width: Math.abs(marquee.x2 - marquee.x1),
            height: Math.abs(marquee.y2 - marquee.y1),
          }}
        />
      )}

      {!editable && altWin && (
        <AltDescriptionWindow
          win={altWin}
          nodes={tree.nodes || []}
          onJumpNode={(n) => jumpTo(n.x, n.y)}
          onOpenSubtree={openSubtreePanel}
          onClose={() => setAltWin(null)}
        />
      )}

      <NodeTooltip hover={altWin ? null : hover} nodesById={nodesById} subtreePreview={!editable && altActive} />

      {editable && ui.linkingFromId && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-md bg-amber-400 px-3 py-1.5 text-xs font-medium text-black shadow">
          Linking — click the target node (Esc to cancel)
        </div>
      )}

      {/* Subtree editor banner: the canvas is currently showing a node's own
          skill tree; Back restores the parent space (one level per click). */}
      {editable && subtreeFrame && !ui.linkingFromId && (
        <div
          className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-md bg-amber-400 px-3 py-1.5 text-xs font-medium text-black shadow"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Network className="h-3.5 w-3.5" />
          <span>
            Editing subtree of “{subtreeHostName}”{subtreeDepth > 1 ? ` (level ${subtreeDepth})` : ""}
          </span>
          <button
            className="rounded bg-black/15 px-2 py-0.5 hover:bg-black/25"
            onClick={exitSubtreeEditor}
          >
            Back to parent tree
          </button>
        </div>
      )}

      <AbilityChoiceDialog
        node={choiceNode}
        nodesById={nodesById}
        choices={effChoices}
        perTake={choiceNode ? Number(choiceNode.optionsPerTake) || 1 : 1}
        onPick={(optionNames) => {
          commitInvest(choiceNode, 1, optionNames);
          if ((choiceNode.subtrees || []).length) openSubtreeForNode(choiceNode);
          setChoiceNode(null);
        }}
        onClose={() => setChoiceNode(null)}
      />

      <SubtreePickerDialog
        node={subtreePicker}
        sideTrees={tree.sideTrees}
        onPick={(i) => {
          openSubtreePanel(subtreePicker.id, i);
          setSubtreePicker(null);
        }}
        onClose={() => setSubtreePicker(null)}
      />

      <BenefitTableDialog
        open={!!schoolDrop}
        initial={schoolDrop}
        spells={benefitSpells(settings)}
        schools={settings?.library?.spellSchools || []}
        onClose={() => setSchoolDrop(null)}
        onSave={({ name, table }) => {
          if (!schoolDrop) return;
          addNodeBenefit(schoolDrop.nodeId, {
            category: "table",
            name,
            table,
          });
          toast.success(`“${name}” added to “${schoolDrop.nodeName}”.`);
          setSchoolDrop(null);
        }}
      />

      {!isMobile && (
        <MiniMap
          nodes={hiddenIds ? tree.nodes.filter((n) => !hiddenIds.has(n.id)) : tree.nodes}
          gridBounds={gridBounds}
          view={view}
          vp={vp}
          onJump={jumpTo}
        />
      )}

      {isMobile && (
        <>
          <div className="pointer-events-none absolute left-1/2 top-14 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-background/85 px-2.5 py-1 text-[10px] text-muted-foreground shadow">
            Drag to pan · Pinch to zoom · + adds a node
          </div>
          <div
            className="absolute bottom-20 right-4 z-20 flex flex-col gap-1 rounded-full border bg-background/90 p-1 shadow-lg"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Zoom in"
              title="Zoom in"
              onClick={() => zoomViewBy(1.25)}
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-accent active:scale-95"
            >
              <ZoomIn className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              title="Zoom out"
              onClick={() => zoomViewBy(1 / 1.25)}
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-accent active:scale-95"
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Fit tree"
              title="Fit the whole tree"
              onClick={fitView}
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-accent active:scale-95"
            >
              <Maximize className="h-5 w-5" />
            </button>
          </div>
        </>
      )}

      {isMobile && editable && (
        <button
          type="button"
          aria-label="Add node"
          title="Add a node in the centre of the view"
          onClick={addNodeAtCenter}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-4 right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-background/80 px-2 py-1 text-xs text-muted-foreground shadow">
        {visibleNodes.length} / {tree.nodes.length} nodes · {Math.round((view.zoom || 0.1) * 100)}%
      </div>
    </div>

    {/* Rendered outside the canvas container: its pan handler captures the
        pointer on left-press, so a menu inside never receives the click. */}
    <ConnectorMenu
      menu={connMenu}
      editable={editable}
      onFork={(w) => forkConnector(connMenu.conn, w)}
      onDelete={(id) => {
        deleteConnection(id);
        setConnMenu(null);
      }}
      onClose={() => setConnMenu(null)}
    />
    <CarryGhost />
    </>
  );
}