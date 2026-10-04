import { textStore } from "@/lib/device-store";

/*
 * The city a learner chose for referrals: kept on this device only, never sent anywhere, and listed
 * in "what Rafiq remembers". It is chosen, never guessed from language, text or location.
 */
const city = textStore("rehla.city.v1");

export const chooseCity = (value: string | null) => city.set(value);
/** The chosen city; the server and the first render know none. */
export const useChosenCity = city.use;
