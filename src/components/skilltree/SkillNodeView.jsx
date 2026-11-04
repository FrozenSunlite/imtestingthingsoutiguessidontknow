import { memo } from "react";
import { ChevronDown, EyeOff } from "lucide-react";
import { IconArt } from "@/components/skilltree/IconArt";
import { displayLevel, nodeMaxPoints, tierPlan } from "@/lib/nodeTiers";
import { isBridgeNode } from "@/lib/geometry";

// One node on the canvas. Memoized: while panning only the canvas transform
// changes, so every prop stays identical and the node skips re-rendering.
export const SkillNodeView = memo(function SkillNodeView({
  node,
  editable,
  selected,
  showNames,
  available,
  dmHidden = false,
  popIn,
  placeholder,
  placeholderFrame,
  highlighted,
  onSelect,
  onPointerDown,
  onContextMenu,
  onInvest,
  onOpenSubtree,
  onReturnParent,
  dblClickInvest,
  onHover,
  onHoverMove,
  onHoverEnd,
  detailLevel = "full",
}) {
  // Zero-cost / zero-point bridge nodes count as unlocked as soon as their own
  // prerequisites are met, so they can pass availability through a chain.
  const autoBridge = isBridgeNode(node) && available;
  const unlocked = (node.currentPoints || 0) > 0 || autoBridge;
  const dim = !unlocked && !available;
  const simplified = !!detailLevel && detailLevel !== "full";
  const minimal = detailLevel === "minimal";
  const size = node.size || 100;
  const max = nodeMaxPoints(node);
  const plan = tierPlan(node);
  const cost = Math.max(0, Number(node.cost ?? 1) || 0);
  // A node's own frame wins; otherwise the default node frame applies and its
  // border defines the node's shape.
  const frame = node.frameImage || placeholderFrame || null;
  // Crop: with a frame, the artwork fills the node and is clipped to the
  // frame's inner circle (12% inset by default, editable) so it never bleeds
  // underneath the border art.
  const inset = frame ? Math.min(35, Math.max(0, Number(node.iconInset ?? 12))) : 0;
  const iconBox = `${Math.max(30, 100 - inset * 2)}%`;
  // The socket glow and silhouette outline: drop-shadows follow the rendered
  // alpha of the art/frame, so transparent pixels are ignored automatically.
  const hasArt = !!(node.image || placeholder);
  const outlineColor = unlocked
    ? "#008000"
    : available
      ? "rgba(245,158,11,0.9)"
      : "rgba(148,163,184,0.65)";
  const artFilter = minimal
    ? ""
    : simplified
      ? dim
        ? "grayscale(1)"
        : [
            hasArt ? `drop-shadow(0 0 1.5px ${outlineColor})` : "",
            hasArt ? "drop-shadow(0 1.5px 0 rgba(0,0,0,0.7))" : "",
            hasArt && unlocked ? "drop-shadow(0 0 5px rgba(0,128,0,0.75))" : "",
            hasArt && !unlocked && available
              ? "drop-shadow(0 0 4px rgba(245,158,11,0.3))"
              : "",
          ]
            .filter(Boolean)
            .join(" ")
      : [
          dim ? "grayscale(1)" : "",
          hasArt ? `drop-shadow(0 0 1.5px ${outlineColor})` : "",
          hasArt ? `drop-shadow(0 0 1.5px ${outlineColor})` : "",
          hasArt ? "drop-shadow(0 -1px 0 rgba(255,255,255,0.18))" : "",
          hasArt ? "drop-shadow(0 3px 0 rgba(0,0,0,0.8))" : "",
          hasArt ? "drop-shadow(0 7px 7px rgba(0,0,0,0.45))" : "",
          hasArt && unlocked ? "drop-shadow(0 0 7px rgba(0,128,0,0.9))" : "",
          hasArt && unlocked ? "drop-shadow(0 0 14px rgba(0,128,0,0.45))" : "",
          hasArt && !unlocked && available
            ? "drop-shadow(0 0 6px rgba(245,158,11,0.35))"
            : "",
          hasArt && selected ? "drop-shadow(0 0 5px rgba(0,229,255,0.5))" : "",
        ]
          .filter(Boolean)
          .join(" ");
  const slotShadow = minimal
    ? "inset 0 1px 2px rgba(0,0,0,0.8)"
    : simplified
      ? "inset 0 2px 6px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.45)"
      : [
          "inset 0 3px 10px rgba(0,0,0,0.95)",
          "inset 0 -2px 4px rgba(255,255,255,0.06)",
          unlocked ? "0 0 8px rgba(0,128,0,0.25)" : "",
          highlighted ? "0 0 0 2px rgba(245,158,11,0.8)" : "",
          "0 2px 6px rgba(0,0,0,0.55)",
        ]
          .filter(Boolean)
          .join(", ");

  return (
    <div
      data-node-id={node.id}
      onPointerDown={(e) => onPointerDown(e, node)}
      onPointerEnter={(e) => onHover?.(e, node)}
      onPointerMove={(e) => onHoverMove?.(e)}
      onPointerLeave={() => onHoverEnd?.()}
      onContextMenu={(e) => onContextMenu(e, node)}
      onClick={(e) => {
        e.stopPropagation();
        if (editable) {
          onSelect(node);
        } else if (node.__returnNode) {
          // Navigation marker: a single click just selects it.
          onSelect?.(node);
        } else if (dblClickInvest) {
          // Floating windows: single click selects, double-click invests.
          onSelect?.(node);
        } else if (!isBridgeNode(node) && (available || unlocked)) {
          onInvest(node, 1);
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (node.__returnNode) {
          onReturnParent?.(node);
          return;
        }
        if (!editable && dblClickInvest) onInvest(node, 1);
      }}
      style={{
        position: "absolute",
        // Whole pixels keep node labels and borders sharp at every zoom.
        left: Math.round(node.x - size / 2),
        top: Math.round(node.y - size / 2),
        width: size,
        height: size,
        cursor: editable ? "grab" : "pointer",
        textRendering: "geometricPrecision",
      }}
      className={`group ${
        dmHidden ? "opacity-60 " : ""
      }${
        // Blind run: newly revealed nodes pop in; a press squishes the node
        // like a button before the click lands.
        popIn ? "animate-[node-pop-in_0.28s_ease-out]" : ""
      } ${!editable ? "transition-transform duration-100 active:scale-90" : ""}`}
    >
      {/* Recessed socket: the artwork sits in it like a raised button. */}
      <div
        className={`ttt-node-slot pointer-events-none absolute inset-0 rounded-2xl border ${
          selected
            ? "border-primary/80"
            : dmHidden
              ? "border-destructive/70"
              : minimal && unlocked
                ? "border-[#008000]/80"
                : minimal && available
                  ? "border-amber-400/60"
                  : "border-white/10"
        }`}
        style={{
          background:
            "linear-gradient(145deg, rgba(30,41,59,0.92), rgba(2,6,23,0.97))",
          boxShadow: slotShadow,
        }}
      />
      {/* Frame + artwork only: flips and rotation never move or mirror the text.
          The filter follows the rendered alpha, so transparent/empty pixels are
          left alone and the outline hugs the actual image silhouette. */}
      <div
        style={{
          transform: `rotate(${node.rotation}deg) scaleX(${node.flipped ? -1 : 1}) scaleY(${node.flipV ? -1 : 1})`,
          transformOrigin: "center",
          filter: artFilter,
        }}
        className={`ttt-node-art absolute inset-0 flex items-center justify-center overflow-hidden ${
          dim ? "opacity-40" : ""
        }`}
      >
        {/* Invalid art falls back to the default node icon, then hides. */}
        {node.image ? (
          <IconArt
            src={node.image}
            circular={!!frame && node.circularCrop !== false}
            iconBox={iconBox}
            size={size}
            fallbackSrc={placeholder}
            hideOnInvalid
          />
        ) : placeholder ? (
          <IconArt
            src={placeholder}
            circular={!!frame && node.circularCrop !== false}
            iconBox={iconBox}
            size={size}
            className="opacity-70"
            hideOnInvalid
          />
        ) : (
          <span className="text-2xl font-bold text-muted-foreground">?</span>
        )}
        {frame && (
          <img
            src={frame}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
      </div>

      {/* Quantity: always visible, bottom center between name and node edge */}
      {!minimal && !node.__returnNode && (
        <div
          className={`absolute -bottom-2.5 left-1/2 flex h-5 min-w-5 -translate-x-1/2 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${
            unlocked ? "bg-[#008000]" : "bg-muted-foreground"
          }`}
        >
          {(node.currentPoints || 0)}/{max}
          {cost !== 1 && (
            <span className="ml-1 opacity-80">{cost === 0 ? "free" : `${cost}×`}</span>
          )}
        </div>
      )}

      {!minimal && showNames && (
        <div className="pointer-events-none absolute -bottom-8 left-1/2 max-w-[140px] -translate-x-1/2 whitespace-nowrap rounded bg-background/80 px-1 text-[10px] leading-tight text-foreground shadow-sm">
          {/* Talent (left) and level requirement (right), styled alike */}
          <div className="flex items-baseline justify-between gap-2 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>
              {node.nodeType === "attribute"
                ? `${node.attributeStat || "?"} +1`
                : (node.talentTypes?.length
                    ? node.talentTypes.join(", ")
                    : node.talentType || "N/A")}
            </span>
            <span>
              lvl: {displayLevel(node) > 0 ? displayLevel(node) : "N/A"}
              {plan.active?.label && plan.tiers.length > 1 ? ` - ${plan.active.label}` : ""}
            </span>
          </div>
          {node.name}
        </div>
      )}

      {/* Subtree chevron: opposite corner of the refund control, play-only,
          shown when the node is unlocked and owns a subtree with content.
          Opens a chooser of its trees (already-open ones are greyed out). */}
      {!minimal && !editable && onOpenSubtree && unlocked &&
        (node.subtrees || []).some((s) => (s.nodes || []).length > 0) && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpenSubtree(node);
          }}
          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white opacity-0 transition-opacity group-hover:opacity-100"
          title="Choose one of this skill's subtree trees to open"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      )}

      {/* DM-only marker: the node is hidden from players, either directly or
          because every prerequisite path leading to it is hidden. */}
      {!minimal && (dmHidden || node.hidden) && (
        <div
          className="pointer-events-none absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white shadow"
          title={
            node.hidden
              ? "Hidden from players"
              : "Hidden from players because all of its prerequisites are hidden"
          }
        >
          <EyeOff className="h-3 w-3" />
        </div>
      )}

      {!minimal && !editable && !node.__returnNode && (
        <div className="absolute -left-1 -top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onInvest(node, -1);
            }}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-white"
          >
            −
          </button>
        </div>
      )}
    </div>
  );
});