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
//
// Projects reference files, so exported files (.json / .gz) embed every
// referenced image as a data URL instead (inlineImages) — a copy of the export
// carries its artwork. Importing one uploads those images back into the local
// project folder and keeps the short references (rehydrateImages).

const UPLOAD_ENDPOINT = "/api/upload";
const MAX_FALLBACK_EDGE = 512;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const REMOTE_IMAGE_RE = /^https?:\/\/\S+\.(png|apng|jpe?g|gif|webp|bmp|avif|svg)(?:[?#]\S*)?$/i;
const MARKDOWN_IMAGE_RE = /(!\[[^\]]*\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g;

const isDataUrl = (s) => typeof s === "string" && s.startsWith("data:image/");
const isProjectImage = (s) => typeof s === "string" && s.startsWith("/images/");
const isRemoteImage = (s) => typeof s === "string" && REMOTE_IMAGE_RE.test(s);

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("could not read image"));
    reader.readAsDataURL(blob);
  });
}

// GIF, APNG and animated WebP must keep their original bytes: decoding through
// createImageBitmap() and re-encoding a PNG would keep only the first frame.
function hasAscii(bytes, text) {
  const needle = [...text].map((char) => char.charCodeAt(0));
  outer: for (let i = 0; i <= bytes.length - needle.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (bytes[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

export async function isAnimatedImage(blob) {
  if (!blob) return false;
  const type = String(blob.type || "").toLowerCase();
  if (type === "image/gif" || type === "image/apng") return true;
  const head = new Uint8Array(
    await blob.slice(0, Math.min(blob.size, 64 * 1024)).arrayBuffer()
  );
  // GIF header: "GIF87a" / "GIF89a".
  if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) return true;
  if (type === "image/png" || (!type && head[0] === 0x89)) {
    return hasAscii(head, "acTL"); // APNG animation control chunk
  }
  if (type === "image/webp" || hasAscii(head.subarray(0, 12), "RIFF")) {
    return hasAscii(head, "ANIM"); // animated WebP
  }
  return false;
}

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

// POST bytes to the project server. Throws when the endpoint is unavailable so
// callers can decide whether to fall back to an inline image or keep one.
async function uploadBlob(blob, name) {
  const res = await fetch(`${UPLOAD_ENDPOINT}?name=${encodeURIComponent(name || "image.png")}`, {
    method: "POST",
    headers: { "Content-Type": blob.type || "application/octet-stream" },
    body: blob,
  });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
  const data = await res.json();
  if (!data || typeof data.url !== "string" || !data.url) throw new Error("upload returned no url");
  return data.url;
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
    return await uploadBlob(file, file.name || "image.png");
  } catch {
    // Keep animation frames instead of flattening to a single PNG.
    if (await isAnimatedImage(file)) return blobToDataUrl(file);
    return toSharpDataUrl(file, maxEdge);
  }
}

// Read an image's bytes from a direct URL, falling back to the local server
// proxy when the remote host blocks cross-origin reads.
async function fetchImageBlob(url) {
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (res.ok) return await res.blob();
  } catch {
    /* try the proxy below */
  }
  if (/^https?:/i.test(url)) {
    const res = await fetch(`/api/image-proxy?url=${encodeURIComponent(url)}`);
    if (res.ok) return await res.blob();
  }
  throw new Error("image fetch failed");
}

// Import an image referenced by a URL (local 5eTools image, remote artwork)
// into the project's image folder. Falls back to the original URL.
export async function importImageFromUrl(url) {
  if (!url || isDataUrl(url) || isProjectImage(url)) return url;
  try {
    const blob = await fetchImageBlob(url);
    const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
    try {
      return await uploadBlob(blob, `5etools.${ext}`);
    } catch {
      return await blobToDataUrl(blob);
    }
  } catch {
    return url;
  }
}

// Re-encode an image at a smaller edge/quality and store the result as a new
// project image. Returns the new `/images/...` URL (or the original when the
// browser/server cannot process it).
export async function optimizeImageUrl(url, { maxEdge = 1280, quality = 0.82 } = {}) {
  if (!url) return url;
  try {
    const blob = await fetchImageBlob(url);
    if (!String(blob.type || "").startsWith("image/")) return url;
    if (await isAnimatedImage(blob)) return url;
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const out = await new Promise((resolve) =>
      canvas.toBlob((result) => resolve(result), "image/webp", quality)
    );
    if (!out) return url;
    try {
      return await uploadBlob(out, "optimized.webp");
    } catch {
      return await blobToDataUrl(out);
    }
  } catch {
    return url;
  }
}

// Rebuild an object with one async string transform applied everywhere,
// including inside arrays and nested objects.
async function mapDeep(value, fn) {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) out.push(await mapDeep(item, fn));
    return out;
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = await mapDeep(item, fn);
    return out;
  }
  return value;
}

// Apply `resolve` to every image URL inside a markdown string, preserving the
// surrounding alt text and title.
async function mapMarkdownImages(text, resolve) {
  if (!text.includes("![")) return text;
  let out = text;
  for (const match of [...text.matchAll(MARKDOWN_IMAGE_RE)]) {
    const url = match[2];
    const next = await resolve(url);
    if (next !== url) out = out.replace(match[0], match[1] + next + match[3]);
  }
  return out;
}

// Import every markdown image inside a chapter into the project image folder
// (or leave the URL untouched when it cannot be read). Used by 5eTools book
// imports so illustrations render even when the source data is gone.
export async function importImagesInText(text, resolve = importImageFromUrl) {
  if (typeof text !== "string" || !text.includes("![")) return text;
  return mapMarkdownImages(text, resolve);
}

async function embedUrl(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`could not fetch ${url}`);
  const blob = await res.blob();
  if (!String(blob.type || "").startsWith("image/")) throw new Error("not an image");
  return blobToDataUrl(blob);
}

// Returns a copy of a project payload with every project-file image (and,
// when `includeRemote` is set, remote image URLs) replaced by a data URL so
// exporting one file keeps the artwork. Images that cannot be read keep their
// original reference.
export async function inlineImages(payload, { includeRemote = false } = {}) {
  const cache = new Map();
  const resolve = async (url) => {
    if (cache.has(url)) return cache.get(url);
    let next = url;
    try {
      if (isProjectImage(url) || (includeRemote && isRemoteImage(url))) next = await embedUrl(url);
    } catch {
      /* keep the original reference */
    }
    cache.set(url, next);
    return next;
  };

  return mapDeep(payload, async (text) => {
    const whole = text.trim();
    if (isProjectImage(whole) || (includeRemote && isRemoteImage(whole))) return resolve(whole);
    return mapMarkdownImages(text, resolve);
  });
}

// Turns embedded data URLs back into project files: uploads each one and
// replaces it with the short `/images/...` reference. If the project server is
// unavailable the data URL is kept, so an imported project still works.
export async function rehydrateImages(payload) {
  const cache = new Map();
  const resolve = async (dataUrl) => {
    if (!isDataUrl(dataUrl)) return dataUrl;
    if (cache.has(dataUrl)) return cache.get(dataUrl);
    let next = dataUrl;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
      next = await uploadBlob(blob, `restored.${ext}`);
    } catch {
      /* keep the embedded image */
    }
    cache.set(dataUrl, next);
    return next;
  };

  return mapDeep(payload, async (text) => {
    if (isDataUrl(text.trim())) return resolve(text.trim());
    return mapMarkdownImages(text, resolve);
  });
}
