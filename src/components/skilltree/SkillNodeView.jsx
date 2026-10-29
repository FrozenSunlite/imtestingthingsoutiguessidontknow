import { memo } from "react";
import { ChevronDown } from "lucide-react";
import { IconArt } from "@/components/skilltree/IconArt";
import { displayLevel, nodeMaxPoints, tierPlan } from "@/lib/nodeTiers";

// One node on the canvas. Memoized: while panning only the canvas transform
// changes, so every prop stays identical and the node skips re-rendering.
export const SkillNodeView = memo(function SkillNodeView({
  node,
  editable,
  selected,
  showNames,
  available,
  popIn,
  placeholder,
  placeholderFrame,
  highlighted,
  onSelect,
  onPointerDown,
  onContextMenu,
  onInvest,
  onOpenSubtree,
  dblClickInvest,
  onHover,
  onHoverMove,
  onHoverEnd,
}) {
  const unlocked = (node.currentPoints || 0) > 0;
  const dim = !unlocked && !available;
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
        } else if (dblClickInvest) {
          // Floating windows: single click selects, double-click invests.
          onSelect?.(node);
        } else if (available || unlocked) {
          onInvest(node, 1);
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
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
        willChange: "transform",
        textRendering: "geometricPrecision",
      }}
      className={`group ${
        // Blind run: newly revealed nodes pop in; a press squishes the node
        // like a button before the click lands.
        popIn ? "animate-[node-pop-in_0.28s_ease-out]" : ""
      } ${!editable ? "transition-transform duration-100 active:scale-90" : ""}`}
    >
      {/* Frame + artwork only: flips and rotation never move or mirror the text */}
      <div
        style={{
          transform: `rotate(${node.rotation}deg) scaleX(${node.flipped ? -1 : 1}) scaleY(${node.flipV ? -1 : 1})`,
          transformOrigin: "center",
        }}
        className={`absolute inset-0 flex items-center justify-center overflow-hidden ${
          // With a frame, the frame's border defines the node's shape — no
          // default square bevel. Status colors survive via ring/glow shadows.
          frame ? "" : "rounded-xl border-2"
        } transition-shadow ${
          selected
            ? "border-primary ring-2 ring-primary/40"
            : unlocked
            ? "border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.45)]"
            : available
            ? "border-amber-400"
            : "border-border"
        } ${dim ? "opacity-40 grayscale" : ""} ${
          highlighted ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-background" : ""
        }`}
      >
        {/* Invalid art falls back to the default node icon, then hides. */}
        {node.image ? (
          <IconArt
            src={node.image}
            circular={!!frame}
            iconBox={iconBox}
            size={size}
            fallbackSrc={placeholder}
            hideOnInvalid
          />
        ) : placeholder ? (
          <IconArt
            src={placeholder}
            circular={!!frame}
            iconBox={iconBox}
            size={size}
            className="opacity-70"
            hideOnInvalid
          />
        ) : (
          <span className="text-2xl">⚔️</span>
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
      <div
        className={`absolute -bottom-2.5 left-1/2 flex h-5 min-w-5 -translate-x-1/2 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${
          unlocked ? "bg-emerald-600" : "bg-muted-foreground"
        }`}
      >
        {(node.currentPoints || 0)}/{max}
        {cost !== 1 && (
          <span className="ml-1 opacity-80">{cost === 0 ? "free" : `${cost}×`}</span>
        )}
      </div>

      {showNames && (
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
      {!editable && onOpenSubtree && unlocked &&
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

      {!editable && (
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