import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { RafiqPosesProvider, type RafiqPoses } from "@/components/rafiq/rafiq-figure";
import { loadKhutuwat, loadSituations } from "@/lib/content/load";
import { situationStop, testGroups, toSituationView } from "@/lib/content/situation-view";
import type { TurnOutcome } from "@/lib/mawqif/turn";
import type { SituationView } from "@/lib/mawqif/types";

import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import { MawqifMap } from "./mawqif-map";
import { TestResult } from "./mawqif-test";
import { Feedback, RoleplayTurn } from "./roleplay-turn";
import { SituationArt, SITUATION_ART } from "./situation-art";
import { SituationCheck } from "./situation-check";
import { SituationPlayer } from "./situation-player";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string | { pathname: string; query: Record<string, string> }; children: ReactNode }) => (
    <a href={typeof href === "string" ? href : `${href.pathname}?ask=${encodeURIComponent(href.query.ask ?? "")}`}>{children}</a>
  ),
}));

// next/font runs only in a Next build; the answer's font classes do not matter here.
vi.mock("@/lib/answer-fonts", () => ({ ANSWER_FONT_VARIABLES: { ar: "", en: "", ur: "", bn: "", fr: "" } }));

const MESSAGES = { ar, en };
type Locale = keyof typeof MESSAGES;
const pose = { src: "/art/rafiq/hello.png", width: 400, height: 600 };
const poses = new Proxy({}, { get: () => pose }) as RafiqPoses;
const noop = () => undefined;

function render(locale: Locale, node: ReactNode): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      <RafiqPosesProvider poses={poses}>{node}</RafiqPosesProvider>
    </NextIntlClientProvider>,
  )
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&");
}

async function view(locale: Locale, id = "greeting"): Promise<SituationView> {
  const situation = (await loadSituations()).find((candidate) => candidate.id === id)!;
  return toSituationView(situation, await loadKhutuwat(), locale);
}

describe("a situation", () => {
  it.each(["ar", "en"] as const)("opens on what to say, with the scene as the team's wording and the way ahead (%s)", async (locale) => {
    const situation = await view(locale);
    const html = render(locale, <SituationPlayer situation={situation} next={null} />);
    const t = MESSAGES[locale].Mawqif;
    expect(html).toContain(situation.scene);
    expect(html).toContain(t.teamWording);
    for (const step of Object.values(t.steps)) expect(html).toContain(step);
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
  });

  it.each(["ar", "en"] as const)("offers both ways to reply: choosing one of three, or writing (%s)", async (locale) => {
    const situation = await view(locale);
    const html = render(locale, <RoleplayTurn situationId={situation.id} exchange={situation.exchanges[0]!} index={0} character={situation.character} items={situation.items} onDone={noop} />);
    const t = MESSAGES[locale].Mawqif;
    expect(html).toContain(situation.character);
    expect(html).toContain(t.modeChoose);
    expect(html).toContain(t.modeWrite);
    expect(html.match(/role="radio"/g)).toHaveLength(2);
    // The three written replies, quoted words marked as quotes.
    for (const choice of situation.exchanges[0]!.choices) {
      const part = choice.reply[0]!;
      expect(html).toContain(part.kind === "text" ? part.text : part.quote.text);
    }
    expect(html).toContain("<q");
  });
});

describe("feedback after a turn", () => {
  const outcome = (fields: Partial<TurnOutcome>): TurnOutcome => ({ reply: [], met: [], quality: "avoid", gentler: false, encouragement: null, ...fields });

  it.each(["ar", "en"] as const)("for the fullest reply: what was good, and nothing scolding (%s)", async (locale) => {
    const situation = await view(locale);
    const exchange = situation.exchanges[0]!;
    const t = MESSAGES[locale].Mawqif;
    const html = render(locale, <Feedback exchange={exchange} outcome={outcome({ quality: "best", met: exchange.keyPoints.map((point) => point.id) })} itemOf={() => undefined} name={null} onNext={noop} onRetry={noop} />);
    expect(html).toContain(t.feedbackBest);
    expect(html).toContain(t.whatWasGood);
    expect(html).not.toContain(t.whatWasMissing);
    expect(html).not.toContain(t.tryAgain);
    expect(html).not.toMatch(/\{\{|\}\}/);
  });

  it.each(["ar", "en"] as const)("for a partial reply: the missing point with its source, and a way to try again (%s)", async (locale) => {
    const situation = await view(locale);
    const exchange = situation.exchanges[0]!;
    const t = MESSAGES[locale].Mawqif;
    const missing = exchange.keyPoints[1]!;
    const item = situation.items.find((candidate) => candidate.id === missing.quote.ref);
    const html = render(
      locale,
      <Feedback exchange={exchange} outcome={outcome({ quality: "acceptable", met: [exchange.keyPoints[0]!.id], gentler: true })} itemOf={() => item} name={null} onNext={noop} onRetry={noop} />,
    );
    expect(html).toContain(t.feedbackAcceptable);
    expect(html).toContain(t.whatWasMissing);
    expect(html).toContain(missing.quote.text);
    expect(html).toContain(t.readWholeSource);
    expect(html).toContain(t.gentler);
    expect(html).toContain(t.tryAgain);
  });

  it("uses the learner's name in the warm line, and leaves it out cleanly without one", async () => {
    const situation = await view("en");
    const exchange = situation.exchanges[0]!;
    const best = outcome({ quality: "best", met: exchange.keyPoints.map((point) => point.id) });
    const named = render("en", <Feedback exchange={exchange} outcome={best} itemOf={() => undefined} name="Amina" onNext={noop} onRetry={noop} />);
    expect(named).toContain("You covered every point, ⁨Amina⁩.");
    const unnamed = render("en", <Feedback exchange={exchange} outcome={best} itemOf={() => undefined} name={null} onNext={noop} onRetry={noop} />);
    expect(unnamed).toContain("You covered every point.");
    const arabic = render("ar", <Feedback exchange={exchange} outcome={best} itemOf={() => undefined} name={null} onNext={noop} onRetry={noop} />);
    expect(arabic).toContain("غطّيت كل النقاط.");
  });

  it("shows the service's sentence when it passed the checks", async () => {
    const situation = await view("en");
    const exchange = situation.exchanges[0]!;
    const html = render("en", <Feedback exchange={exchange} outcome={outcome({ encouragement: "A polite start, {{name}}." })} itemOf={() => undefined} name="Sam" onNext={noop} onRetry={noop} />);
    expect(html).toContain("A polite start, ⁨Sam⁩.");
  });
});

describe("the checks and the final test", () => {
  it.each(["ar", "en"] as const)("asks one question at a time, the right answer quoted from its source (%s)", async (locale) => {
    const situation = await view(locale);
    const html = render(locale, <SituationCheck checks={situation.check} items={situation.items} onAnswer={noop} onDone={noop} />);
    expect(html).toContain(situation.check[0]!.prompt);
    expect(html).not.toContain(situation.check[1]!.prompt);
    const right = situation.check[0]!.options.find((option) => option.correct)!;
    expect(right.part.kind).toBe("quote");
  });

  it.each(["ar", "en"] as const)("ends with a score, what the learner handles well, what to practise and lessons to revisit (%s)", async (locale) => {
    const [greeting, colleague] = [await view(locale, "greeting"), await view(locale, "colleague")];
    const t = MESSAGES[locale].Mawqif;
    const questions = [
      { situation: "greeting", check: greeting.check[0]! },
      { situation: "colleague", check: colleague.check[0]! },
    ];
    const situations = [greeting, colleague].map((item) => ({ id: item.id, title: item.title, href: `/mawqif/${item.id}` as const, related: item.related }));
    const html = render(
      locale,
      <TestResult
        questions={questions}
        situations={situations}
        answers={[
          { situation: "greeting", check: questions[0]!.check.id, correct: true },
          { situation: "colleague", check: questions[1]!.check.id, correct: false },
        ]}
        onAgain={noop}
      />,
    );
    expect(html).toContain(t.checkScore.replace("{correct}", "1").replace("{total}", "2"));
    expect(html).toContain(t.handlesWell);
    expect(html).toContain(greeting.title);
    expect(html).toContain(t.practiseAgainTitle);
    expect(html).toContain('href="/mawqif/colleague"');
    expect(html).toContain(t.lessonsToRevisit);
    expect(html).toContain(colleague.related[0]!.title);
    expect(html).toContain(t.reviewTitle);
  });
});

describe("the map of situations", () => {
  it.each(["ar", "en"] as const)("shows every situation as a stop, a test after every few and one for the section (%s)", async (locale) => {
    const situations = await loadSituations();
    const stops = situations.map((situation) => situationStop(situation, locale));
    const html = render(locale, <MawqifMap stops={stops} tests={testGroups(situations)} />);
    const t = MESSAGES[locale].Mawqif;
    for (const stop of stops) expect(html).toContain(`href="${stop.href}"`);
    expect(html).toContain('href="/mawqif/test/1"');
    expect(html).toContain('href="/mawqif/test/all"');
    expect(html).toContain(t.testAll);
    expect(html.split(t.status.notStarted).length - 1).toBe(stops.length);
  });

  it("draws every situation", async () => {
    for (const situation of await loadSituations()) {
      expect(SITUATION_ART).toContain(situation.art);
      expect(renderToStaticMarkup(<SituationArt art={situation.art} />)).toContain('aria-hidden="true"');
    }
  });
});
