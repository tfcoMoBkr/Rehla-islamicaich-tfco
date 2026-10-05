# Privacy

Rehla serves people at a sensitive moment in their lives. It is built so that it never needs to know who they are, and never works out anything about them.

- **No account.** No name, email, phone number or other contact detail is required anywhere.
- **Nothing inferred.** No field stores or infers a religious or sensitive attribute. The learner chooses their own starting point; nothing is concluded from their behaviour, their questions or their language.
- **On the device.** What the product remembers stays in the learner's own browser.

## What is kept on the device

Everything below lives in the browser's `localStorage` and is never sent to a server. If storage is blocked (a private window, for example), each value holds in memory until the page is left.

| Key | What it holds | Shown and cleared in |
|---|---|---|
| `rehla.journey.v1` | Lesson progress: lessons completed, quiz and baseline scores, choices made in activities, the provisions earned in Practice and each activity's best round, and a random session id. | The journal ("forget my journey") |
| `rehla.lessons.v1` | The conversation with Rafiq beside each lesson's board, by lesson. | "What Rafiq remembers": "Clear everything" |
| `rehla.guide.v1` | That the Khutuwat tour was finished or skipped, so it is shown only once. | Asked for again with "How Rehla works" |
| `rehla.rafiq.v1.ar`, `rehla.rafiq.v1.en` | The conversation with Rafiq in each page language: each question, Rafiq's reply as the service returned it, and when it came. | Rafiq: "Start again" clears the current language; "Clear everything" clears both |
| `rehla.name.v1` | The name the learner chose to give Rafiq, if any (at most 40 characters). | "What Rafiq remembers": change, remove, or clear everything |
| `rehla.name.asked.v1` | That the name prompt was answered or skipped, so it is asked only once. | "Clear everything" |
| `rehla.city.v1` | The city chosen in the specialist card, to show that city's associations. | "What Rafiq remembers", and the card itself |
| `rehla:board-sounds` | Whether the lesson board plays its sounds. | The sound switch on the board |

### The name

The name is optional, asked once, and can be skipped, changed or removed at any time.

- Only the page uses it, to greet the learner. The greeting ("Welcome back, {name}") and the next step ("You are at lesson {number}…") are built in code from the message files.
- It is **never sent to the AI service**. A test (`web/src/lib/rafiq/memory.test.ts`) checks that a request to Rafiq carries only the question, the page language, the lessons reached and the conversation history.
- Rafiq builds no profile from it, and does not use it to guess anything about the person.

### The city

The city is chosen by the learner from a list. No location is read from the device, and no city is guessed from language, text or address. It only selects which associations the specialist card shows.

## What reaches the server

The AI service (`ai/`) receives, for each question:

- the question (at most 1,000 characters);
- the page language;
- the ids of the lessons completed, so Rafiq answers at the learner's stage;
- at most the last 8 turns of the conversation, so Rafiq can follow it.

The service keeps none of it after replying: it holds no conversation state and has no database of users.

**Logs** carry only the reply kind, language, level, referral reason, counts and timings, and the categories of any problems the checks found. The text of questions and answers is never logged. `RAFIQ_DEBUG=1` adds draft text for local diagnosis; it is off by default and ignored on a deployment.

**Rate limiting** counts requests per IP address in memory, for one minute, and stores nothing.

**The model provider** (OpenRouter) receives the question and the passages Rafiq retrieved. Provider data collection is refused by default (`OPENROUTER_DATA_COLLECTION=deny`).

## Clearing everything

On the Rafiq page, "What Rafiq remembers" lists what is kept: the name, the learner's place in the lessons, the size of this conversation and the chosen city. "Clear everything" (with a confirmation) removes the name, both conversations, the conversations beside lesson boards and the city. Lesson progress is kept in the journal and cleared there, so that clearing a chat never erases a learner's road by surprise.

