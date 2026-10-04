import { notFound } from "next/navigation";

import { features, type Feature } from "@/config/features";

export function requireFeature(feature: Feature): void {
  if (!features[feature]) {
    notFound();
  }
}
