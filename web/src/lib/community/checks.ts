import * as z from "zod/mini";

/*
 * What is looked at before a post or reply is shared, in this order: danger or distress (the AI
 * service, which finds danger in code before any model), personal data (patterns, here in the
 * browser), and a request for a ruling on one's own situation (the AI service). Each only offers
 * help; the writer decides whether to post. Two things are not published: a text the service
 * reads as a ruling, a claim about what Islam says or quoted scripture (the writer is pointed to
 * Rafiq or a specialist), and a text that could not be checked (held; it fails closed). The
 * service keeps nothing of the text.
 */

export const CHECK_PATH = "/api/ai/community-check";

const DIGIT = "[0-9\\u0660-\\u0669\\u06F0-\\u06F9]";
const PATTERNS = {
  email: /[^\s@]+@[^\s@]+\.[^\s@]{2,}/u,
  phone: new RegExp(`(?:\\+|00)?${DIGIT}(?:[\\s\\-.()]*${DIGIT}){7,}`, "u"),
  address: /\b\d{1,5}\s+(?:[A-Za-z]+\s+){1,3}(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|boulevard|blvd)\b|(?:شارع|طريق|عمارة|شقة|مبنى|ص\.\s?ب)\s*(?:رقم\s*)?[^\s،.]+/iu,
} as const;

export type PersonalData = keyof typeof PATTERNS;

/** The kinds of personal data the text seems to hold: phone numbers, emails, addresses. */
export function personalData(text: string): PersonalData[] {
  return (Object.keys(PATTERNS) as PersonalData[]).filter((kind) => PATTERNS[kind].test(text));
}

const checkSchema = z.object({
  checked: z.boolean(),
  danger: z._default(z.boolean(), false),
  distress: z._default(z.boolean(), false),
  personalRuling: z._default(z.boolean(), false),
  religiousClaim: z._default(z.boolean(), false),
});

export type ServiceCheck = z.infer<typeof checkSchema>;

const UNCHECKED: ServiceCheck = { checked: false, danger: false, distress: false, personalRuling: false, religiousClaim: false };

/** The service's reading of the text, or "unchecked" when it cannot be had: the post is then held. */
export async function checkText(text: string, locale: "ar" | "en", fetcher: typeof fetch = fetch): Promise<ServiceCheck> {
  try {
    const response = await fetcher(CHECK_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim().slice(0, 3200), locale }),
    });
    if (!response.ok) return UNCHECKED;
    const parsed = checkSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : UNCHECKED;
  } catch {
    return UNCHECKED;
  }
}

export type Notice =
  | { kind: "care"; danger: boolean }
  | { kind: "personalData"; found: PersonalData[] }
  | { kind: "ruling" }
  | { kind: "religious" }
  | { kind: "held" };

/** Notices that stop the text: it is not published, whatever the writer chooses. */
export const STOPS: ReadonlySet<Notice["kind"]> = new Set(["religious", "held"]);

/** The notices to show, one after another, before the text is shared. */
export function noticesFor(text: string, service: ServiceCheck): Notice[] {
  if (!service.checked) return [{ kind: "held" }];
  const notices: Notice[] = [];
  if (service.danger || service.distress) notices.push({ kind: "care", danger: service.danger });
  const found = personalData(text);
  if (found.length > 0) notices.push({ kind: "personalData", found });
  if (service.religiousClaim) return [...notices.filter((notice) => notice.kind === "care"), { kind: "religious" }];
  if (service.personalRuling) notices.push({ kind: "ruling" });
  return notices;
}

export type Pending = { notices: Notice[]; index: number; tagged: boolean };

/** Past one notice: on to the next, or ready to share, carrying the specialist tag if it was chosen. */
export function advance(pending: Pending, tag = false): Pending | { share: true; needsSpecialist: boolean } {
  const tagged = pending.tagged || tag;
  if (pending.index + 1 < pending.notices.length) return { ...pending, index: pending.index + 1, tagged };
  return { share: true, needsSpecialist: tagged };
}
