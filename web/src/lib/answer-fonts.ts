import { Noto_Nastaliq_Urdu, Noto_Sans_Bengali } from "next/font/google";

/*
 * Faces for answers in Urdu and Bengali. They are imported only by Rafiq's answer view and never
 * preloaded: a browser fetches a file only once text in that script is on screen.
 */

const urdu = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  weight: ["400", "600"],
  variable: "--font-noto-nastaliq",
  display: "swap",
  preload: false,
});

const bengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  weight: ["400", "600"],
  variable: "--font-noto-bengali",
  display: "swap",
  preload: false,
});

/** The class that defines a script's face variable, for the languages that need their own face. */
export const ANSWER_FONT_VARIABLES: Readonly<Partial<Record<string, string>>> = {
  ur: urdu.variable,
  bn: bengali.variable,
};
