import { readArtSvg } from "@/lib/content/load";

/**
 * Serves the team's drawings in content/art/ for the sources page, cleaned of embedded metadata.
 * Only files listed in content/art/manifest.json are served, as inert images.
 */
export async function GET(_request: Request, { params }: RouteContext<"/art/[...path]">) {
  const svg = await readArtSvg((await params).path.join("/"));
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
