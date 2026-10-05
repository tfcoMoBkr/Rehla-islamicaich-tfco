/*
 * Rehla Community as the page sees it. A member is shown only by their community name, their role
 * badge, and their country when they switched it on; a post whose writer left and kept it has no
 * author ("former member").
 */

export const CATEGORIES = ["firstSteps", "everydayLife", "encouragement", "learningTogether", "askCommunity"] as const;
export type Category = (typeof CATEGORIES)[number];

export const REPORT_REASONS = ["unkind", "rulingWithoutSource", "personalData", "spam", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export type Role = "member" | "moderator" | "guide";

export const LIMITS = { title: 120, body: 2000, reply: 1000, nameMin: 3, nameMax: 24 } as const;

export type Author = { id: string; name: string; role: Role; country: string | null };

export type Post = {
  id: string;
  author: Author | null;
  authorId: string | null;
  category: Category;
  title: string;
  body: string;
  language: "ar" | "en";
  needsSpecialist: boolean;
  createdAt: string;
  editedAt: string | null;
  hidden: boolean;
  pinned: boolean;
  helped: number;
  replies: number;
  /** Written by the Rehla team to illustrate the space (supabase/seed/community_samples.sql). */
  isSample: boolean;
};

export type Reply = {
  id: string;
  post: string;
  author: Author | null;
  authorId: string | null;
  body: string;
  needsSpecialist: boolean;
  createdAt: string;
  hidden: boolean;
  helped: number;
  isSample: boolean;
};

export type Membership = { name: string; showCountry: boolean; role: Role; joinedAt: string };

export type CommunityError = "notMember" | "nameTaken" | "rateLimited" | "notAllowed" | "network" | "unknown";
