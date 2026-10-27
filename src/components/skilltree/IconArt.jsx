// Node artwork. Plain nodes show it contained inside the node; framed nodes
// crop it to the frame's inner circle (full-size cover, never shrunk).
export function IconArt({
  src,
  circular,
  iconBox,
  size,
  className = "",
  fallbackSrc = "",
  hideOnInvalid = false,
}) {
  if (circular) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden rounded-full ${className}`}
        style={{ width: iconBox, height: iconBox, imageRendering: "pixelated" }}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          className="absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2"
          style={{ width: size, height: size, objectFit: "cover", imageRendering: "pixelated" }}
          onError={(e) => {
            if (fallbackSrc && e.currentTarget.dataset.fallback !== "1") {
              e.currentTarget.dataset.fallback = "1";
              e.currentTarget.src = fallbackSrc;
            } else {
              e.currentTarget.style.visibility = "hidden";
            }
          }}
        />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className={`object-contain ${className}`}
      style={{ width: iconBox, height: iconBox, imageRendering: "pixelated" }}
      onError={(e) => {
        if (hideOnInvalid && fallbackSrc && e.currentTarget.dataset.fallback !== "1") {
          e.currentTarget.dataset.fallback = "1";
          e.currentTarget.src = fallbackSrc;
        } else {
          e.currentTarget.style.visibility = "hidden";
        }
      }}
    />
  );
}