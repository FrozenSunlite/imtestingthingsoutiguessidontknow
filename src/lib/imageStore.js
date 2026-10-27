// Imported artwork is stored as a project file, not as a giant inline data URL.
//
// The desktop launcher (Serve.ps1) answers `POST /api/upload?name=<file>` by
// writing the bytes into `standalone/desktop/userdata/images` and replying
// `{ url: "/images/img_...png" }`, which the project then references. That
// keeps tree JSON small and survives a rebuild of the app.
//
// When no such endpoint is reachable (e.g. plain `vite dev`), we fall back to
// an embedded data URL so uploads still work. The fallback is drawn with image
// smoothing disabled and never scaled up, so pixel art stays crisp.

const UPLOAD_ENDPOINT = "/api/upload";
const MAX_FALLBACK_EDGE = 512;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Draw the image to a canvas with nearest-neighbour sampling, optionally
// shrinking it to fit `maxEdge`. Never enlarges (that would blur pixels).
async function toSharpDataUrl(file, maxEdge = MAX_FALLBACK_EDGE) {
  const bitmap = await createImageBitmap(file);
  let w = bitmap.width;
  let h = bitmap.height;
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  w = Math.max(1, Math.round(w * scale));
  h = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.mozImageSmoothingEnabled = false;
  ctx.webkitImageSmoothingEnabled = false;
  ctx.msImageSmoothingEnabled = false;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/png");
}

// Upload one image file and return the reference to store on the node.
// Resolves to a short `/images/...` URL when the project server is available,
// otherwise to a data URL.
export async function importImage(file, { maxEdge = MAX_FALLBACK_EDGE } = {}) {
  if (!file || !String(file.type || "").startsWith("image/")) {
    throw new Error("Not an image file");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Image is too large (max 25 MB)");
  }

  try {
    const res = await fetch(`${UPLOAD_ENDPOINT}?name=${encodeURIComponent(file.name || "image.png")}`, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!res.ok) throw new Error(`upload failed: ${res.status}`);
    const data = await res.json();
    if (!data || typeof data.url !== "string" || !data.url) throw new Error("upload returned no url");
    return data.url;
  } catch {
    return toSharpDataUrl(file, maxEdge);
  }
}
