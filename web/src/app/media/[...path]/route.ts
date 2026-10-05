import { loadMediaManifest, readMediaFile } from "@/lib/content/load";

// Every listed image is rendered at build time and served as a static file; nothing in content/
// is read at runtime, and an unlisted path is a 404.
export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const { images } = await loadMediaManifest();
  return images.map((image) => ({ path: image.src.split("/") }));
}

/** Serves the images in content/media/. Only files listed in its manifest are served. */
export async function GET(_request: Request, { params }: RouteContext<"/media/[...path]">) {
  const media = await readMediaFile((await params).path.join("/"));
  if (!media) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(media.body), {
    headers: {
      "Content-Type": media.type,
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
