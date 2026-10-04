import type { Locale } from "next-intl";

import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

// Typing every locale with the English shape turns a missing Arabic key into a type error.
export const messages: Record<Locale, typeof en> = { ar, en };
