# Privacy

Rehla serves people at a sensitive moment in their lives. It is built so that it never needs to know who they are, and never works out anything about them. The page `/[locale]/privacy` says the same to learners, in both languages.

- **No account needed.** Everything works without one, and a guest's data stays on the device. An account is optional and asks only for an email, a password, a display name and, if the learner wishes, a country.
- **Nothing inferred.** No field, column or log stores or infers a religious background, a date of conversion, a former faith, family, health or any other sensitive attribute. The learner chooses their own starting point; nothing is concluded from their behaviour, their questions or their language. A country is never guessed from an address, a language or anything else.
- **On the device by default.** What the product remembers stays in the learner's own browser, unless they create an account; even then, conversations with Rafiq stay on the device.

## Optional accounts

Accounts exist only when the Supabase project is configured (`docs/DEPLOY.md`). An account holds:

| Where | What | Why |
|---|---|---|
| Supabase Auth | Email and password (the password only as a hash) | To sign in |
| `profiles` | Display name (1–40 characters, any name the learner likes), country (ISO code, optional, picked from a list), page language, created and updated times | To show the learner's name and country in their account |
| `progress_items` | One row per progress item, under the ids the device uses: completed lessons, chosen starting station, question histories, quiz, baseline and exam results, the sentence kept in the journal, provisions earned and best rounds, the tour-seen flag | So progress follows the learner to any device |

- **Row level security** on both tables: a signed-in learner reaches only their own rows; anonymous visitors reach nothing. The tables stay owner-only: Rehla Community never reads the display name, and shows the country only through its own view, for a member who switched it on (below).
- **Never in the account:** Rafiq's conversations, the conversations beside lesson boards, the name given to Rafiq, the chosen city, personal checklists and the anonymous session id.
- **Never sent to the AI service:** the display name, the country, the email or anything else from the account. A test (`web/src/lib/account/boundaries.test.ts`) checks that no module that talks to the AI service reads the account.
- **Download:** the account page's "Download my data" gives a JSON file of the profile and every progress row.
- **Delete:** "Delete my account and data", confirmed by typing a word, deletes the user through `POST /api/account/delete` (which checks the learner's own session first); the profile and progress rows go with it by cascade, and the device is emptied.
- **Sign-out** sends anything waiting, then removes the account's data from the device. Only the language, the board sound setting and the dismissed invitation remain.

## What is kept on the device

Everything below lives in the browser's `localStorage`. For a guest, none of it is sent to a server. For a signed-in learner, the progress record and the tour flag are also kept in the account (above); nothing else is. If storage is blocked (a private window, for example), each value holds in memory until the page is left.

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
| `rehla.auth.v1` | The account session (supabase-js), only when signed in. | Sign out, or delete the account |
| `rehla.account.v1` | The display name and country to show in the header, only when signed in. | Sign out |
| `rehla.invite.v1` | That the invitation to create an account was dismissed, so it is not shown again. | Kept on sign-out |
| `rehla.choice.v1` | Whether the visitor chose an account or guest use on the first visit, so the choice is offered once. | Kept on sign-out |
| `rehla.name.unused.v1` | That a signed-in learner asked Rafiq not to use their account's name. | "What Rafiq remembers", the account page, "Clear everything" |

### The name

The name Rafiq calls the learner by is optional and can be changed or removed at any time, in "What Rafiq remembers" and, when signed in, on the account page.

- **Where it is kept.** A guest's name stays on the device (`rehla.name.v1`). A signed-in learner's is the display name in their own profile row; they can ask Rafiq not to use it (`rehla.name.unused.v1`, on the device).
- **Never sent to the AI service or the model provider.** Rafiq writes the placeholder `{{name}}` in a warm line, and the page puts the name there on the device, or removes the placeholder when there is none. Code keeps the placeholder out of the cited answer and out of two replies in a row. Tests check that a request to Rafiq carries no name (`web/src/lib/rafiq/memory.test.ts`) and that the placeholder never reaches the screen.
- The greeting ("Welcome back, {name}") and the next step are built in code from the message files. Rafiq builds no profile from the name and guesses nothing from it.

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

## Replies written in Mawqif

A reply the learner writes in a Mawqif role-play is sent to the AI model provider to be checked against that turn's points, and is not kept. It is not logged (logs carry counts and timings only), and nothing about the learner is inferred from it. Choosing one of the written replies sends nothing. Mawqif progress (provisions and best rounds) is kept like the rest of the learner's progress: on the device, and in the account when signed in.

## Rehla Community

A new Muslim may not have told their family, so the community is built to show as little as possible.

- **Joining is its own choice**, after signing in: the member picks a community name (empty by default, never the account's display name; a nickname is fine) and reads and accepts the rules. Nothing else from the account is shown. The country appears next to the name only if the member switches it on.
- **No profile pages, no member list, no private messages.** Others see a writer only as community name, a badge if the team gave one ("Rehla team" for moderators, "Guide"), and the opt-in country. The public view of members (`community_authors`) lists only members with something visible posted, and "this helped me" is shown as a count (`community_helped`): who reacted is readable only by that member.
- **Reading is open to everyone**, guests included. Posting, replying, reacting and reporting need an account that has joined. The database enforces this with row level security on every table (`supabase/migrations/20261006000000_community.sql` and `20261006010000_community_guard.sql`), together with length limits, hourly limits (5 posts, 30 replies) and the rule that an item reported by three different members is hidden until a moderator reviews it. A hidden item is visible only to its writer and the moderators.
- **Before sharing**, the text of a post or reply is sent to the AI service, which looks for danger or distress (the danger check runs in code first) and for a request for a ruling on the writer's own situation. The service stores and logs none of the text: logs carry the flags and the timing only. Personal details (phone numbers, emails, addresses) are spotted by patterns in the browser. Each check only offers help; the writer decides whether to share. Rafiq never posts.
- **Leaving** is possible at any time, from the account page: the member's posts and replies are deleted, or kept and shown as from a "Former member", as they choose. Their reactions and reports are removed either way. **Deleting the account** removes the membership and everything written under it. **Download my data** includes the membership, posts and replies.
- **No inference.** Nothing about a member is worked out from what they write, and there are no analytics on post content.
- **Asking Rafiq about a post.** "Ask Rafiq about this" keeps the post's text on this device until the learner sends a question; it never goes into a link. When the question is sent, the post's title and text (and the reply asked about) go to the AI service with it, like any question, and are not kept or logged. Nothing about the post's writer is sent.
- **Sample posts.** The team may show sample posts to illustrate the space. They are written by the team, marked "Sample" on every post and reply, announced on the home, and belong to sample accounts that cannot sign in. They hold no one's personal data.

## Photos shown to Lens

The photo is sent to an AI model provider to be read; nothing is kept.

- **In the browser.** The photo is downscaled to at most 1280 px and re-encoded as JPEG, which leaves its metadata (location, camera, time) behind, before it is sent.
- **In the service.** It is held in memory for the reading call only, never stored or logged. Logs carry the kind of photo, the row of the decision table that applied, and the timing.
- **The model provider** (OpenRouter, with data collection refused) receives the photo to read it. Lens never describes people, does not read out or translate personal documents, and infers nothing about the person from a photo.

## Clearing everything

On the Rafiq page, "What Rafiq remembers" lists what is kept: the name, the learner's place in the lessons, the size of this conversation and the chosen city. "Clear everything" (with a confirmation) removes the name, both conversations, the conversations beside lesson boards and the city. Lesson progress is kept in the journal and cleared there, so that clearing a chat never erases a learner's road by surprise.

