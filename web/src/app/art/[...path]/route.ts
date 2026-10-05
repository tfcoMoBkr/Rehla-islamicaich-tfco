import { loadArtManifest, loadRafiqManifest, readArtSvg, readRafiqPose } from "@/lib/content/load";

// Every listed drawing and pose is rendered at build time and served as a static file; nothing
// in content/ is read at runtime, and an unlisted path is a 404.
export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const [{ items }, { poses }] = await Promise.all([loadArtManifest(), loadRafiqManifest()]);
  return [...items.map((item) => item.file), ...poses.map((pose) => pose.file)].map((file) => ({ path: file.split("/") }));
}

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
