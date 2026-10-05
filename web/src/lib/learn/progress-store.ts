import { useSyncExternalStore } from "react";

import {
  EMPTY_PROGRESS,
  summarize,
  withAnswer,
  withBestRound,
  withProvisions,
  type ExamRecord,
  type Progress,
  type ScoreRecord,
} from "./progress";

const STORAGE_KEY = "rehla.journey.v1";

let snapshot: Progress | null = null;
const listeners = new Set<() => void>();

function load(): Progress {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (stored && typeof stored === "object" && "version" in stored && stored.version === 1) {
      const progress = { ...EMPTY_PROGRESS, ...(stored as Partial<Progress>) };
      // Records from before practice existed have none yet.
      return { ...progress, practice: { ...EMPTY_PROGRESS.practice, ...progress.practice } };
    }
  } catch {
    // Unreadable or blocked storage: start a fresh journey rather than fail.
  }
  return EMPTY_PROGRESS;
}

function read(): Progress {
  snapshot ??= load();
  return snapshot;
}

function update(change: (progress: Progress) => Progress): void {
  const next = change(read());
  snapshot = { ...next, sessionId: next.sessionId ?? crypto.randomUUID() };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Private mode or a full disk: progress still holds for this visit.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    snapshot = null;
    listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The learner's progress as stored, for code outside a component. */
export const readProgress = (): Progress => read();

/** The server never sees progress, so it always renders the empty journey first. */
export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, read, () => EMPTY_PROGRESS);
}

export const progressActions = {
  answer(questionId: string, correct: boolean) {
    update((progress) => withAnswer(progress, questionId, correct, Date.now()));
  },
  completeLesson(lessonId: string) {
    update((progress) => ({
      ...progress,
      completedLessons: { ...progress.completedLessons, [lessonId]: Date.now() },
    }));
  },
  saveQuiz(lessonId: string, answers: Record<string, boolean>) {
    update((progress) => ({ ...progress, quizzes: { ...progress.quizzes, [lessonId]: summarize(answers, Date.now()) } }));
  },
  saveBaseline(stationId: string, answers: Record<string, boolean>) {
    update((progress) => ({
      ...progress,
      baselines: { ...progress.baselines, [stationId]: summarize(answers, Date.now()) },
    }));
  },
  saveExam(stationId: string, answers: Record<string, boolean>, passRatio: number): ExamRecord {
    const score: ScoreRecord = summarize(answers, Date.now());
    const record = { ...score, passed: score.total > 0 && score.correct / score.total >= passRatio };
    update((progress) => ({ ...progress, exams: { ...progress.exams, [stationId]: record } }));
    return record;
  },
  chooseStart(stationId: string) {
    update((progress) => ({ ...progress, startStation: stationId }));
  },
  pick(lessonId: string, itemId: string) {
    update((progress) => ({ ...progress, picks: { ...progress.picks, [lessonId]: itemId } }));
  },
  setChecklist(key: string, itemIds: string[]) {
    update((progress) => ({ ...progress, checklists: { ...progress.checklists, [key]: itemIds } }));
  },
  /** Provisions for an activity completed or a question answered right; true when they are new. */
  earn(id: string, points: number): boolean {
    const before = read().practice.earned[id];
    if (before) return false;
    update((progress) => withProvisions(progress, id, points, Date.now()));
    return true;
  },
  bestRound(key: string, correct: number, total: number) {
    update((progress) => withBestRound(progress, key, correct, total, Date.now()));
  },
  forget() {
    snapshot = EMPTY_PROGRESS;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing stored, nothing to remove.
    }
    listeners.forEach((listener) => listener());
  },
};
