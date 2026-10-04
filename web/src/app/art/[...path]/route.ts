import { readArtSvg, readRafiqPose } from "@/lib/content/load";

/**
 * Serves the team's art in content/art/: Rafiq's poses (PNG, listed in content/art/rafiq/manifest.json)
 * and the drawings (SVG, listed in content/art/manifest.json, cleaned of embedded metadata and
 * served as inert images). Nothing unlisted is served.
 */
export async function GET(_request: Request, { params }: RouteContext<"/art/[...path]">) {
  const file = (await params).path.join("/");
  if (file.endsWith(".png")) {
    const pose = await readRafiqPose(file);
    if (!pose) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(pose), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const svg = await readArtSvg(file);
  if (!svg) return new Response(null, { status: 404 });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
