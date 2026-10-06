# Measuring understanding

Track 3 asks whether Rehla improves a learner's understanding. Rehla measures it for each learner, on their own device, and shows the learner their own result. No result is collected, sent or reported anywhere: this repository holds no learner data, and `docs/EVALUATION.md` reports none.

## What is measured

Each station of the road (The Beginning, Purification, Prayer) starts with a short **"What do I already know?"** check and ends with a **station exam**.

- **The exam** is one scored question from each lesson of the station that has one, taken from the lesson's own questions: the checks after its cards, built from the lesson's approved text. No question is written for the measure (`stationParts` in `web/src/lib/content/lesson-view.ts`). A station file may list its own questions instead; the demo station does.
- **The check before the station** is three of those same exam questions, spread across the station's lessons. It is not shown as pass or fail.
- **The gain** is measured on the questions both asked: on those items, the share answered right on the first try in the exam minus the share before (`gain` in `web/src/lib/learn/progress.ts`). The journal shows, for each station, the score at the start, the exam score, and that difference in percentage points.
- **The exam opens the next station** when at least 70% of its questions are right on the first try (`EXAM_PASS_RATIO` in `web/src/config/learning.ts`). Before it, the learner reviews the questions they last missed.

Both results are kept in the learner's progress record: in the browser for a guest, and in their own account when signed in. Nothing about the learner is inferred from them.

## Trying it

1. Open the live site (`https://rehla-islamicaich-tfco-6igd.vercel.app/en/learn`) in a private window, so you start with no progress. Choose an account or guest use, skip or finish the tour, and start at "The Beginning".
2. The road's first step is **What do I already know?**: answer its three questions. You may answer at random to see a low starting point.
3. Play the station's lessons (each takes a few minutes). The road always shows the next step.
4. After the last lesson, take the **station exam**.
5. Open the **journal** (`/en/learn/journal`): under "How your understanding grew", the station shows "At the start", "Station exam" and the gain, on the questions both asked.

To start again, use "Erase my journal" in the journal.

## Limits

- The check before a station is three questions, so the gain is a coarse signal for one learner, not a finding about learners in general.
- The same questions are asked before and after, so the gain also includes having seen them once.
- No study with learners has been run, and no aggregate is reported.
