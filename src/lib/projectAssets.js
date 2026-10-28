// Find and rewrite image references across a whole project payload. Used by
// the Media tab to mark used artwork, remove orphans, and replace a large image
// with a compressed copy after the user optimizes it.

const IMAGE_URL_RE =
  /^(?:data:image\/|\/images\/|\/api\/5etools\/(?:image|brew-image)|\/api\/image-proxy|https?:\/\/\S+\.(?:png|jpe?g|gif|webp|bmp|avif|svg)(?:[?#]\S*)?$)/i;
const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g;

export const isImageReference = (value) =>
  typeof value === "string" && IMAGE_URL_RE.test(value.trim());

export function imageUrlsInText(text) {
  if (typeof text !== "string") return [];
  const out = [];
  for (const match of text.matchAll(MARKDOWN_IMAGE_RE)) out.push(match[2]);
  const whole = text.trim();
  if (IMAGE_URL_RE.test(whole)) out.push(whole);
  return out;
}

// Map<url, { count, paths:Set<string> }>
export function collectImageReferences(payload, path = "", refs = new Map()) {
  if (typeof payload === "string") {
    const urls = imageUrlsInText(payload);
    urls.forEach((url) => {
      const entry = refs.get(url) || { count: 0, paths: new Set() };
      entry.count += 1;
      if (path) entry.paths.add(path);
      refs.set(url, entry);
    });
    return refs;
  }
  if (Array.isArray(payload)) {
    payload.forEach((item, index) =>
      collectImageReferences(item, `${path}[${index}]`, refs)
    );
    return refs;
  }
  if (payload && typeof payload === "object") {
    Object.entries(payload).forEach(([key, value]) =>
      collectImageReferences(value, path ? `${path}.${key}` : key, refs)
    );
  }
  return refs;
}

const replaceInText = (text, from, to) => {
  if (typeof text !== "string" || !text.includes(from)) return text;
  let next = text.split(from).join(to);
  next = next.replace(MARKDOWN_IMAGE_RE, (whole, alt, url, title) =>
    url === from ? `![${alt}](${to}${title || ""})` : whole
  );
  return next;
};

export function replaceImageReferences(payload, from, to) {
  if (!from || from === to) return payload;
  if (typeof payload === "string") return replaceInText(payload, from, to);
  if (Array.isArray(payload)) return payload.map((item) => replaceImageReferences(item, from, to));
  if (payload && typeof payload === "object") {
    const out = {};
    Object.entries(payload).forEach(([key, value]) => {
      out[key] = replaceImageReferences(value, from, to);
    });
    return out;
  }
  return payload;
}

export const imageNameFromUrl = (url) => {
  if (typeof url !== "string") return "";
  const match = url.match(/^\/images\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : "";
};

export const formatBytes = (bytes) => {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};
