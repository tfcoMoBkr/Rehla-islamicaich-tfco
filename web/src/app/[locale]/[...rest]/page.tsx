import { notFound } from "next/navigation";

// Routes unknown paths through the localized not-found page instead of Next's unstyled default.
export default function CatchAllPage() {
  notFound();
}
