import "server-only";

/**
 * Drafts (and questions not yet marked `reviewed`) are visible while developing and hidden in
 * production. `CONTENT_SHOW_DRAFTS` overrides this either way, e.g. for a reviewers' preview.
 */
export function showDrafts(): boolean {
  const override = process.env.CONTENT_SHOW_DRAFTS;
  if (override === "true") return true;
  if (override === "false") return false;
  return process.env.NODE_ENV !== "production";
}
