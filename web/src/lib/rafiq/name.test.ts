import { describe, expect, it } from "vitest";

import { fillName, withoutName } from "./name";

const isolated = (name: string) => `⁨${name}⁩`;

describe("the name in Rafiq's warm lines", () => {
  it.each([
    ["That is a good thing to ask, {{name}}.", "That is a good thing to ask."],
    ["{{name}}, that is a good thing to ask.", "That is a good thing to ask."],
    ["Thank you. {{ Name }}, shall we go on?", "Thank you. Shall we go on?"],
    ["Thank you, {{name}}, for asking.", "Thank you for asking."],
    ["سؤال جميل يا {{name}}.", "سؤال جميل."],
    ["يا {{name}}، هذا سؤال جميل.", "هذا سؤال جميل."],
    ["أهلًا بك، يا {{name}}، في رحلتك.", "أهلًا بك في رحلتك."],
    ["No name here.", "No name here."],
  ])("leaves cleanly when there is no name: %s", (text, expected) => {
    expect(withoutName(text)).toBe(expected);
    expect(fillName(text, null)).toBe(expected);
  });

  it("puts the name exactly as typed, in both languages, kept whole beside text in another script", () => {
    expect(fillName("That is a good thing to ask, {{name}}.", "Amina")).toBe(`That is a good thing to ask, ${isolated("Amina")}.`);
    expect(fillName("سؤال جميل يا {{name}}.", "أمينة")).toBe(`سؤال جميل يا ${isolated("أمينة")}.`);
    expect(fillName("سؤال جميل يا {{name}}.", "Amina")).toBe(`سؤال جميل يا ${isolated("Amina")}.`);
  });

  it("never leaves the placeholder on the screen", () => {
    for (const name of ["Amina", null]) {
      expect(fillName("{{name}}, hello. {{ NAME }}!", name)).not.toMatch(/\{\{|\}\}/);
    }
  });
});
