import { readMediaFile } from "@/lib/content/load";

/** Serves the images in content/media/. Only files listed in its manifest are served. */
export async function GET(_request: Request, { params }: RouteContext<"/media/[file]">) {
  const media = await readMediaFile((await params).file);
  if (!media) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(media.body), {
    headers: {
      "Content-Type": media.type,
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
