import type { SupabaseClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";

import { tourSeen } from "@/lib/guide-store";
import { progressActions, readProgress, subscribeProgress } from "@/lib/learn/progress-store";

import { changes, fingerprint, fromItems, itemFromRow, merge, toItems, type Row, type Snapshot } from "./items";
import { hasStoredSession } from "./session";

/*
 * Keeps a signed-in learner's progress in their account. The device is always written first; the
 * account follows in the background, a couple of seconds after the last change, in batches. When
 * the connection drops, changes wait on the device and are sent when it returns.
 *
 * Only progress is carried. Rafiq's conversations, lesson threads and the name given to Rafiq are
 * never read here.
 */

export type SyncStatus = "saved" | "saving" | "offline" | "retrying";

const DEBOUNCE_MS = 2000;
const RETRY_MS = 30_000;
const BATCH = 500;
const PAGE = 1000;

type Engine = {
  client: SupabaseClient;
  userId: string;
  /** The account's rows as last read or written: item id → fingerprint. Null until the first pull. */
  stored: Map<string, string> | null;
  timer: ReturnType<typeof setTimeout> | null;
  queue: Promise<boolean>;
  dispose: () => void;
};

let engine: Engine | null = null;
let status: SyncStatus = "saved";
const listeners = new Set<() => void>();

function setStatus(next: SyncStatus): void {
  if (status === next) return;
  status = next;
  listeners.forEach((listener) => listener());
}

function subscribeStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Null when no account is syncing on this page. */
export function useSyncStatus(): SyncStatus | null {
  return useSyncExternalStore(
    subscribeStatus,
    () => (engine ? status : null),
    () => null,
  );
}

const offline = () => typeof navigator !== "undefined" && navigator.onLine === false;

const deviceSnapshot = (): Snapshot => ({ progress: readProgress(), tourSeen: tourSeen.read() });

function chunks<T>(list: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(list.length / size) }, (_, index) => list.slice(index * size, (index + 1) * size));
}

export type StoredRow = Row & { updated_at: string };

/** Every progress row the account holds, a page at a time (the API returns at most 1,000 rows per request). */
export async function readProgressRows(client: SupabaseClient, userId: string): Promise<StoredRow[]> {
  const rows: StoredRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from("progress_items")
      .select("item_id, kind, value, updated_at")
      .eq("user_id", userId)
      .order("item_id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const page = (data ?? []) as StoredRow[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

/** Joins the account's progress with this device's, once per page load or sign-in. */
async function join(active: Engine): Promise<void> {
  const account = (await readProgressRows(active.client, active.userId)).flatMap((row) => itemFromRow(row) ?? []);
  if (engine !== active) return;
  const merged = merge(deviceSnapshot(), fromItems(account));
  active.stored = new Map(account.map((item) => [item.id, fingerprint(item)]));
  progressActions.replace(merged.progress);
  if (merged.tourSeen && !tourSeen.read()) tourSeen.mark();
}

async function send(active: Engine): Promise<boolean> {
  if (engine !== active) return false;
  // Signed out in another tab: the device may be emptied next, and that must never reach the account.
  if (!hasStoredSession()) {
    stopSync();
    return false;
  }
  if (offline()) {
    setStatus("offline");
    return false;
  }
  try {
    if (!active.stored) await join(active);
    const stored = active.stored;
    if (!stored || engine !== active) return false;
    const { upserts, removals } = changes(stored, toItems(deviceSnapshot()));
    if (upserts.length > 0 || removals.length > 0) setStatus("saving");
    for (const batch of chunks(upserts, BATCH)) {
      const rows = batch.map((item) => ({ user_id: active.userId, item_id: item.id, kind: item.kind, value: item.value }));
      const { error } = await active.client.from("progress_items").upsert(rows, { onConflict: "user_id,item_id" });
      if (error) throw error;
      batch.forEach((item) => stored.set(item.id, fingerprint(item)));
    }
    for (const batch of chunks(removals, BATCH)) {
      const { error } = await active.client.from("progress_items").delete().eq("user_id", active.userId).in("item_id", batch);
      if (error) throw error;
      batch.forEach((id) => stored.delete(id));
    }
    setStatus("saved");
    return true;
  } catch {
    if (engine !== active) return false;
    setStatus(offline() ? "offline" : "retrying");
    schedule(RETRY_MS);
    return false;
  }
}

/** Sends what changed now, after anything already on its way. */
function push(): Promise<boolean> {
  const active = engine;
  if (!active) return Promise.resolve(true);
  if (active.timer) clearTimeout(active.timer);
  active.timer = null;
  active.queue = active.queue.then(() => send(active));
  return active.queue;
}

function schedule(delay = DEBOUNCE_MS): void {
  const active = engine;
  if (!active) return;
  if (active.timer) clearTimeout(active.timer);
  active.timer = setTimeout(() => void push(), delay);
}

/** Starts carrying this device's progress to the account; joins the two first. */
export function startSync(client: SupabaseClient, userId: string): Promise<boolean> {
  if (engine?.userId === userId) return push();
  stopSync();
  const onChange = () => {
    if (engine?.stored) setStatus(offline() ? "offline" : "saving");
    schedule();
  };
  const onOnline = () => void push();
  const onOffline = () => setStatus("offline");
  const unsubscribeProgress = subscribeProgress(onChange);
  const unsubscribeTour = tourSeen.subscribe(onChange);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  engine = {
    client,
    userId,
    stored: null,
    timer: null,
    queue: Promise.resolve(true),
    dispose: () => {
      unsubscribeProgress();
      unsubscribeTour();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    },
  };
  status = "saving";
  listeners.forEach((listener) => listener());
  return push();
}

/** Sends everything still waiting. True when the account holds all of this device's progress. */
export function flush(): Promise<boolean> {
  return push();
}

export function stopSync(): void {
  if (!engine) return;
  if (engine.timer) clearTimeout(engine.timer);
  engine.dispose();
  engine = null;
  status = "saved";
  listeners.forEach((listener) => listener());
}
