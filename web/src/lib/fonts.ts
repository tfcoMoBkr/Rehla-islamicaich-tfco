import { Amiri_Quran, IBM_Plex_Sans, IBM_Plex_Sans_Arabic, Reem_Kufi } from "next/font/google";

const display = Reem_Kufi({
  subsets: ["arabic", "latin"],
  variable: "--font-reem-kufi",
  display: "swap",
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex-sans",
  display: "swap",
});

// Includes Latin so Arabic pages can set everything in this one face (see globals.css).
const sansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-arabic",
  display: "swap",
});

// Not preloaded: the file is only fetched once Quran text is actually rendered.
const quran = Amiri_Quran({
  subsets: ["arabic"],
  weight: "400",
  variable: "--font-amiri-quran",
  display: "swap",
  preload: false,
});

export const fontVariables = [display, sans, sansArabic, quran]
  .map((font) => font.variable)
  .join(" ");
