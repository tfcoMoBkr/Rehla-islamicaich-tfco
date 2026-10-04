#!/usr/bin/env node
// Converts the team lead's list of licensed bodies (content/referral-centers.source.json, from the
// directory of the National Center for Non-Profit Sector) into content/referral-centers.json, the
// file the product renders. Every value is copied as given; a field the source does not have is
// null, never filled in.
//
//   node scripts/referral-centers.mjs

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(root, "content", "referral-centers.source.json");
const TARGET = path.join(root, "content", "referral-centers.json");
/** The directory's entry in content/sources.json. */
const DIRECTORY = "ncnp-directory";
const TYPES = { national_channel: "nationalChannel", association: "association" };

const or = (value) => (value === undefined || value === "" ? null : value);

/** @param {Record<string, unknown>} record */
function centre(record) {
  const type = TYPES[record.type];
  if (!type) throw new Error(`${record.id}: unknown type "${record.type}"`);
  if (!record.name_ar) throw new Error(`${record.id}: an Arabic name is required`);
  return {
    id: record.id,
    type,
    name: { ar: record.name_ar, en: or(record.name_en) },
    city: { ar: record.city, en: or(record.city_en) },
    neighbourhood: or(record.neighborhood),
    address: or(record.address),
    phone: or(record.phone),
    phoneAlt: or(record.phone_alt),
    email: or(record.email),
    website: or(record.website),
    mapUrl: or(record.map_url),
    languages: record.languages ? { ar: record.languages, en: or(record.languages_en) } : null,
  };
}

const source = JSON.parse(await readFile(SOURCE, "utf8"));
const centers = source.records.map(centre);
if (centers.length !== source.count) throw new Error(`expected ${source.count} records, found ${centers.length}`);
await writeFile(
  TARGET,
  `${JSON.stringify({ source: DIRECTORY, verifiedOn: source.generated, centers }, null, 2)}\n`,
);
console.log(`${centers.length} referral bodies written to content/referral-centers.json`);
