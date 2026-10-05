/*
 * Every failure the account screens can meet, as a key into the "Account.errors" messages. The
 * provider's own message is never shown. Errors are read by shape, so this module does not load
 * the sign-in library.
 */

export type AccountError =
  | "wrongPassword"
  | "currentPasswordWrong"
  | "emailUsed"
  | "weakPassword"
  | "samePassword"
  | "badEmail"
  | "countryNotListed"
  | "notConfirmed"
  | "tooMany"
  | "resetUnavailable"
  | "linkExpired"
  | "network"
  | "unknown";

const BY_CODE: Record<string, AccountError> = {
  invalid_credentials: "wrongPassword",
  user_already_exists: "emailUsed",
  email_exists: "emailUsed",
  weak_password: "weakPassword",
  same_password: "samePassword",
  email_address_invalid: "badEmail",
  validation_failed: "badEmail",
  email_not_confirmed: "notConfirmed",
  over_request_rate_limit: "tooMany",
  over_email_send_rate_limit: "tooMany",
  email_address_not_authorized: "resetUnavailable",
  otp_expired: "linkExpired",
  session_not_found: "linkExpired",
  session_expired: "linkExpired",
  // A check constraint on profiles. The app checks the display name first, so it is the country.
  "23514": "countryNotListed",
};

type ProviderError = { name?: unknown; code?: unknown; status?: unknown };

const offline = () => typeof navigator !== "undefined" && navigator.onLine === false;

export function accountError(error: unknown): AccountError {
  if (offline() || error instanceof TypeError) return "network";
  if (!error || typeof error !== "object") return "unknown";
  const { name, code, status } = error as ProviderError;
  if (name === "AuthRetryableFetchError" || status === 0) return "network";
  if (typeof code === "string" && Object.hasOwn(BY_CODE, code)) return BY_CODE[code] as AccountError;
  if (status === 429) return "tooMany";
  return "unknown";
}
