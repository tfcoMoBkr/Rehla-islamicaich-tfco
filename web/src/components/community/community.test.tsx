import { readFileSync } from "node:fs";
import path from "node:path";

import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { JoinForm, Leave } from "@/components/account/community-section";
import { ReferralCentresProvider } from "@/components/specialists/centres-context";
import type { Thread } from "@/lib/community/data";
import type { Standing } from "@/lib/community/membership";
import type { Post, Reply } from "@/lib/community/types";
import { referralCentresSchema } from "@/lib/content/schema";

import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import { Invitation, SamplesLine } from "./community-home";
import { RULES } from "./community-states";
import { PostCard } from "./post-card";
import { ShareNotice, type ShareState } from "./share-checks";
import { ThreadBody } from "./thread-view";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string | { pathname: string; query: Record<string, string> }; children: ReactNode }) => (
    <a href={typeof href === "string" ? href : `${href.pathname}?${new URLSearchParams(href.query).toString()}`}>{children}</a>
  ),
  useRouter: () => ({ push: () => undefined }),
}));

const MESSAGES = { ar, en };
type Locale = keyof typeof MESSAGES;
const centres = referralCentresSchema.parse(JSON.parse(readFileSync(path.resolve(__dirname, "../../../../content/referral-centers.json"), "utf8")));
const noop = () => undefined;

function render(locale: Locale, node: ReactNode): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="UTC">
      <ReferralCentresProvider value={centres}>{node}</ReferralCentresProvider>
    </NextIntlClientProvider>,
  )
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&");
}

const post: Post = {
  id: "p1",
  author: { id: "u1", name: "Noor", role: "member", country: null },
  authorId: "u1",
  category: "everydayLife",
  title: "Lunch at work",
  body: "How did you explain it to your colleagues?",
  language: "en",
  needsSpecialist: false,
  createdAt: "2026-10-05T10:00:00Z",
  editedAt: null,
  hidden: false,
  pinned: false,
  helped: 2,
  replies: 1,
  isSample: false,
};
const reply: Reply = { id: "r1", post: "p1", author: { id: "t", name: "فريق رحلة", role: "moderator", country: null }, authorId: "t", body: "Welcome.", needsSpecialist: false, createdAt: "2026-10-05T11:00:00Z", hidden: false, helped: 0, isSample: false };
const thread = (me: string | null): Thread => ({ post, replies: [reply], mine: { helped: new Set(), me } });

const member: Standing = { kind: "member", membership: { name: "Sam", showCountry: false, role: "member", joinedAt: "2026-10-05T09:00:00Z" } };
const moderator: Standing = { kind: "member", membership: { name: "Team", showCountry: false, role: "moderator", joinedAt: "2026-10-05T09:00:00Z" } };

describe("reading a thread", () => {
  it.each(["ar", "en"] as const)("lets a guest read only: no reply box, no report, no reaction button (%s)", (locale) => {
    const t = MESSAGES[locale].Community;
    const html = render(locale, <ThreadBody thread={thread(null)} standing={{ kind: "guest" }} onReplied={noop} />);
    expect(html).toContain(post.body);
    expect(html).toContain(reply.body);
    expect(html).toContain(t.calmLine);
    expect(html).toContain(t.guestNote);
    expect(html).toContain('href="/account/sign-in"');
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain(t.report.button);
    expect(html).not.toContain("aria-pressed");
  });

  it.each(["ar", "en"] as const)("gives a member the reply box, “this helped me” and report, and a link to ask Rafiq privately (%s)", (locale) => {
    const t = MESSAGES[locale].Community;
    const html = render(locale, <ThreadBody thread={thread("u2")} standing={member} onReplied={noop} />);
    expect(html).toContain("<textarea");
    expect(html).toContain(t.replyBox.label);
    expect(html).toContain(t.helped);
    expect(html.match(new RegExp(`>${t.report.button}<`, "g"))).toHaveLength(2);
    // Rafiq opens with the post (and, from a reply, that reply) handed over on the device.
    expect(html).toContain('href="/rafiq?about=post"');
    expect(html).toContain('href="/rafiq?about=reply"');
    expect(html).toContain(t.askRafiqReply);
    expect(html).not.toContain(t.moderation.pin);
  });

  it("does not offer to report one's own post", () => {
    const html = render("en", <ThreadBody thread={thread("u1")} standing={member} onReplied={noop} />);
    expect(html.match(/>Report</g)).toHaveLength(1);
  });

  it("shows badges, a former member, and the specialist and hidden tags", () => {
    const html = render("en", <ThreadBody thread={{ ...thread(null), post: { ...post, author: null, authorId: null, needsSpecialist: true, hidden: true } }} standing={{ kind: "guest" }} onReplied={noop} />);
    const t = en.Community;
    expect(html).toContain(t.formerMember);
    expect(html).toContain(t.badges.moderator);
    expect(html).toContain(t.specialistTag);
    expect(html).toContain(t.hiddenTag);
  });

  it("gives moderators pin and hide on the post", () => {
    const html = render("en", <ThreadBody thread={thread("t")} standing={moderator} onReplied={noop} />);
    expect(html).toContain(en.Community.moderation.pin);
    expect(html).toContain(en.Community.moderation.hide);
  });

  it.each(["ar", "en"] as const)("lists a post with its category, its language and its counts (%s)", (locale) => {
    const html = render(locale, <PostCard post={{ ...post, language: "ar" }} />);
    expect(html).toContain(MESSAGES[locale].Community.categories.everydayLife);
    expect(html).toContain('lang="ar" dir="rtl"');
    expect(html).toContain('href="/community/post?id=p1"');
  });
});

describe("who may write", () => {
  it.each(["ar", "en"] as const)("invites a guest to sign in, a signed-in reader to join, and a member to write (%s)", (locale) => {
    const t = MESSAGES[locale].Community;
    const guest = render(locale, <Invitation standing={{ kind: "guest" }} />);
    expect(guest).toContain(t.join);
    expect(guest).toContain('href="/account/sign-in"');
    const signedIn = render(locale, <Invitation standing={{ kind: "signedIn" }} />);
    expect(signedIn).toContain('href="/account#community"');
    const writing = render(locale, <Invitation standing={member} />);
    expect(writing).toContain('href="/community/write"');
    expect(writing).not.toContain("/community/review");
    expect(render(locale, <Invitation standing={moderator} />)).toContain('href="/community/review"');
  });
});

describe("joining and leaving", () => {
  it.each(["ar", "en"] as const)("asks for a community name, offers the country only as a switch, and asks to accept every rule (%s)", (locale) => {
    const t = MESSAGES[locale].Community;
    const html = render(locale, <JoinForm hasCountry={false} onJoined={noop} />);
    expect(html).toContain(t.account.nameLabel);
    expect(html).toContain(t.account.showCountry);
    expect(html).toContain(t.account.noCountry);
    expect(html).toMatch(/type="checkbox"[^>]*disabled/);
    for (const rule of RULES) expect(html).toContain(t.rules[rule]);
    expect(html).toContain(t.account.accept);
    // The account's own name is not offered as the community name.
    expect(html).toContain('value=""');
  });

  it.each(["ar", "en"] as const)("lets a member leave, keeping their words as a former member's or deleting them (%s)", (locale) => {
    const t = MESSAGES[locale].Community.account;
    const html = render(locale, <Leave onLeft={noop} />);
    expect(html).toContain(t.leaveKeep);
    expect(html).toContain(t.leaveDelete);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[^<]*<\/button>/);
  });
});

describe("the checks before sharing", () => {
  const notice = (notices: Extract<ShareState, { kind: "notice" }>["notices"], text = "Is my job allowed for me?"): Extract<ShareState, { kind: "notice" }> => ({ kind: "notice", text, notices, index: 0, tagged: false });

  it.each(["ar", "en"] as const)("shows the emergency card for danger and the specialist card for distress, and leaves the choice to the writer (%s)", (locale) => {
    const rafiq = MESSAGES[locale].Rafiq.referral;
    const t = MESSAGES[locale].Community.notices;
    const danger = render(locale, <ShareNotice state={notice([{ kind: "care", danger: true }])} onPass={noop} onEdit={noop} />);
    expect(danger).toContain(rafiq.danger.title);
    expect(danger).toContain(MESSAGES[locale].Specialist.cardTitle);
    expect(danger).toContain(t.postAnyway);
    expect(danger).toContain(t.edit);
    expect(render(locale, <ShareNotice state={notice([{ kind: "care", danger: false }])} onPass={noop} onEdit={noop} />)).toContain(rafiq.distress.title);
  });

  it.each(["ar", "en"] as const)("names the personal data found, with edit and share anyway (%s)", (locale) => {
    const t = MESSAGES[locale].Community.notices;
    const html = render(locale, <ShareNotice state={notice([{ kind: "personalData", found: ["phone", "email"] }])} onPass={noop} onEdit={noop} />);
    expect(html).toContain(t.personalDataTitle);
    // Inside the writing form: passing a notice must not submit the form again.
    expect(html).toMatch(new RegExp(`<button(?=[^>]*type="button")[^>]*>${t.postAnyway}</button>`));
    expect(html).toMatch(new RegExp(`<button(?=[^>]*type="button")[^>]*>${t.edit}</button>`));
    expect(html).toContain(`${t.found.phone} · ${t.found.email}`);
    expect(html).toContain(t.postAnyway);
  });

  it.each(["ar", "en"] as const)("suggests Rafiq privately or a specialist for a personal ruling, or sharing with the specialist tag (%s)", (locale) => {
    const t = MESSAGES[locale].Community.notices;
    const html = render(locale, <ShareNotice state={{ ...notice([{ kind: "personalData", found: ["phone"] }, { kind: "ruling" }]), index: 1 }} onPass={noop} onEdit={noop} />);
    expect(html).toContain(t.rulingTitle);
    expect(html).toContain(`/rafiq?${new URLSearchParams({ ask: "Is my job allowed for me?" }).toString()}`);
    expect(html).toContain('href="/talk-to-a-specialist"');
    expect(html).toContain(t.postTagged);
    expect(html).toContain(t.step.replace("{current}", "2").replace("{total}", "2"));
  });

  it("never writes «رفيقًا» in the community's Arabic", () => {
    expect(JSON.stringify(ar.Community)).not.toContain("رفيقًا");
    expect(JSON.stringify(ar.Community)).toContain("«رفيق»");
  });
});

describe("sample posts", () => {
  const sample = { ...post, id: "s1", isSample: true, author: null, authorId: null };
  const sampleReply = { ...reply, id: "sr1", post: "s1", isSample: true };

  it.each(["ar", "en"] as const)("carry the Sample badge, and only they do (%s)", (locale) => {
    const t = MESSAGES[locale].Community.sample;
    const badge = `>${t.badge}</span>`;
    expect(render(locale, <PostCard post={sample} />)).toContain(badge);
    expect(render(locale, <PostCard post={post} />)).not.toContain(badge);
    const thread = render(locale, <ThreadBody thread={{ post: sample, replies: [sampleReply, reply], mine: { helped: new Set(), me: "u2" } }} standing={member} onReplied={noop} />);
    expect(thread.split(badge)).toHaveLength(3);
  });

  it.each(["ar", "en"] as const)("are closed: no reply box, reaction or report, and a line that says so (%s)", (locale) => {
    const t = MESSAGES[locale].Community;
    const html = render(locale, <ThreadBody thread={{ post: sample, replies: [sampleReply], mine: { helped: new Set(), me: "u2" } }} standing={member} onReplied={noop} />);
    expect(html).toContain(t.sample.closed);
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain(`>${t.report.button}<`);
    expect(html).not.toContain("aria-pressed");
    // Rafiq can still be asked about it.
    expect(html).toContain('href="/rafiq?about=post"');
  });

  it.each(["ar", "en"] as const)("are announced on the home only while there are some (%s)", (locale) => {
    const note = MESSAGES[locale].Community.sample.note;
    expect(render(locale, <SamplesLine shown />)).toContain(note);
    expect(render(locale, <SamplesLine shown={false} />)).toBe("");
  });
});
