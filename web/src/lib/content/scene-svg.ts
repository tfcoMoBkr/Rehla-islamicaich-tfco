/*
 * The team's scene drawings are inlined on the lesson board so their parts can light up. Inline
 * markup must be inert and its ids must not collide with the page's, so every drawing is
 * checked, trimmed to what is drawn, and has its ids prefixed.
 */

const UNSAFE = [/<script\b/i, /<foreignObject\b/i, /\son\w+\s*=/i, /javascript:/i, /\bhref\s*=\s*"(?!#)/i];

/**
 * The drawing without its embedded metadata (provenance data, not drawing) and without its
 * <title>: on the board a drawing illustrates the text next to it, so it is decorative.
 */
export function cleanSvg(raw: string, name: string): string {
  if (UNSAFE.some((pattern) => pattern.test(raw))) {
    throw new Error(`content/art: "${name}" contains scripts, event handlers or external links`);
  }
  return raw
    .replace(/<metadata\b[\s\S]*?<\/metadata>/gi, "")
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/\s+xmlns:c2pa="[^"]*"/g, "")
    .replace(/\s+role="img"/g, "")
    .replace(/\s+aria-labelledby="[^"]*"/g, "")
    .replace(/<svg\b/, '<svg aria-hidden="true" focusable="false"');
}

/** Every id the drawing declares. */
export function svgIds(svg: string): string[] {
  return [...svg.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1] ?? "").filter(Boolean);
}

/** Prefixes each id and every reference to it, so several drawings can share a page. */
export function prefixSvgIds(svg: string, prefix: string): string {
  return svg
    .replace(/\sid="([^"]+)"/g, ` id="${prefix}$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`)
    .replace(/href="#([^"]+)"/g, `href="#${prefix}$1"`);
}
