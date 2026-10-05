# Deploying Rehla on Vercel

Rehla deploys as **two Vercel projects from this one repository**:

| Project | Root Directory | Framework preset | What it is |
|---|---|---|---|
| `ai` | `ai/` | FastAPI | Rafiq: the Python service (`app.main:app`), one Vercel Function |
| `web` | `web/` | Next.js | The product: static pages, plus a small proxy to the AI service |

Both projects need the setting **"Include source files outside of the Root Directory in the Build Step"** (Settings → Build and Deployment → Root Directory). It is on by default for new projects. Both builds read `../content`; neither reads it at runtime.

## The `ai` project

Nothing to configure beyond the root directory; the repository carries the rest.

- **Runtime.** Python 3.12 (`ai/.python-version`), with dependencies from `ai/pyproject.toml` and `ai/uv.lock`. The entrypoint is `app.main:app` (`[tool.vercel] entrypoint`).
- **Build step.** `python -m app.prepare` (`[tool.vercel.scripts] build`) runs after the install. It copies the files the service reads at runtime from `content/` into `ai/data/index/` and checks that the committed index is complete. It stops the build with the name of any missing file. It calls no model.
- **Function.** `ai/vercel.json` sets region `fra1`, a maximum duration of 60 s, and leaves tests, caches, `.venv` and the Dockerfile out of the bundle.
- **The index** (`ai/data/index/`, about 7 MB) is built offline with `uv run python -m app.ingest`, which calls the embedding model, and is committed. Deployment never rebuilds it.

### Environment variables (`ai`)

| Variable | Required | Value |
|---|---|---|
| `OPENROUTER_API_KEY` | yes | OpenRouter key. Secret. |
| `LLM_MODEL` | yes | The model Rafiq answers with. |
| `LLM_FALLBACK_MODEL` | recommended | Used when the main model fails or is rate limited. |
| `EMBEDDING_MODEL` | yes | Must be the model the committed index was built with: `baai/bge-m3` (see `ai/data/index/meta.json`). |
| `AI_SERVICE_KEY` | yes in production | A long random string, the same as in `web`. Requests without it are refused. Secret. |
| `OPENROUTER_DATA_COLLECTION` | no | `deny` (default) or `allow`. |
| `ASKS_PER_MINUTE` | no | Questions per address per minute, per instance (default 10). |
| `MCP_URL` | no | Defaults to `https://mcp.islamiccontent.org/mcp`. |
| `VLM_MODEL` | for Lens | The vision model that reads photos for Lens. Without it `/lens` answers 503. |
| `VLM_FALLBACK_MODEL` | recommended | Used when the vision model fails or returns invalid JSON twice. |
| `LENS_PER_MINUTE` | no | Photos per address per minute, per instance (default 5). |
| `RAFIQ_DEBUG` | no | Leave unset. It is ignored on Vercel anyway (`VERCEL` is set). |

The AI service never talks to Supabase and has no Supabase variables.

## The `web` project

- **Build.** `npm run build`: `scripts/check-content.mjs`, then `next build`, then `scripts/check-static.mjs`.
  - `check-content.mjs` fails if any content file the build reads is missing.
  - `check-static.mjs` fails if a main page, a drawing or an image is not rendered at build time.
- **Functions.** `web/vercel.json` sets region `fra1`. Only two routes run as functions:
  - `/api/ai/[path]`, the proxy, with up to 90 s;
  - `/api/health`.
- **Node.** 22.

### Environment variables (`web`)

| Variable | Required | Value |
|---|---|---|
| `AI_SERVICE_URL` | yes | The `ai` project's production URL, e.g. `https://rehla-ai.vercel.app` (no trailing slash needed). |
| `AI_SERVICE_KEY` | yes | The same value as in `ai`. Secret: never prefix it with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SUPABASE_URL` | for accounts | The project URL, `https://<project-ref>.supabase.co`. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | for accounts | The publishable key, `sb_publishable_…`. Public by design: row level security decides what it can reach. |
| `SUPABASE_SECRET_KEY` | for accounts | A secret key, `sb_secret_…`. Server only: used by `/api/account/delete` and nowhere else. Never prefix it with `NEXT_PUBLIC_`. |

`ISLAMHOUSE_API_KEY` is used only by the content scripts on a developer's machine; neither project needs it.

Set the variables for **Production** and **Preview** under the `web` project's **Settings → Environment Variables**, then redeploy: the `NEXT_PUBLIC_` values are built into the pages, so a change needs a new build. Accounts are on only when both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set.

## Accounts (Supabase)

Accounts are optional. Without the Supabase variables the web project builds and runs with no account entry points at all; with them, learners can create an account. Only the `web` project talks to Supabase.

### 1. Create the tables

In the Supabase dashboard, open **SQL Editor** and run each file in `supabase/migrations/` in name order, pasting the whole file each time: `20261005000000_accounts.sql` (the tables and their security), then `20261005010000_profiles_country_not_il.sql` (the country list's rule, kept by the database too). Each is safe to run again. Then check that row level security is on:

```sql
select c.relname as table_name, c.relrowsecurity as rls_on,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('profiles', 'progress_items');
```

Expect two rows, both with `rls_on = true`: `profiles` with 2 policies and `progress_items` with 4.

### 2. Dashboard settings

- **Authentication → Sign In / Providers → Email:** enabled. **Confirm email** may be off (a new account is signed in at once) or on (the learner is asked to check their email first); both work.
- **Authentication → URL Configuration:**
  - **Site URL:** `https://rehla-islamicaich-tfco-6igd.vercel.app`
  - **Redirect URLs:** add
    - `https://rehla-islamicaich-tfco-6igd.vercel.app/ar/account`
    - `https://rehla-islamicaich-tfco-6igd.vercel.app/en/account`
    - for local work, `http://localhost:3000/**`
- **Project Settings → API Keys:** copy the **publishable** key (`sb_publishable_…`) and create or copy a **secret** key (`sb_secret_…`). Do not use the legacy `anon` and `service_role` keys.

### 3. Rehla Community

The community uses the same Supabase project. Without the Supabase variables the community pages show a calm "not available here" state, and the build still passes.

1. **Create its tables.** In **SQL Editor**, run the whole of `supabase/migrations/20261006000000_community.sql`, then the whole of `supabase/migrations/20261006010000_community_guard.sql` (after the account migrations, in that order). Each is safe to run again. Check row level security:

   ```sql
   select c.relname as table_name, c.relrowsecurity as rls_on,
          (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('community_members', 'community_posts', 'community_replies', 'community_reactions', 'community_reports')
   order by 1;
   ```

   Expect five rows, all with `rls_on = true`: `community_members` 4, `community_posts` 4, `community_reactions` 3, `community_replies` 4, `community_reports` 3.

2. **Check the rules** (optional, recommended). Paste the whole of `supabase/tests/community_rules.sql` into the SQL Editor and run it (with psql: `psql -1 -f supabase/tests/community_rules.sql`). It acts as a guest, four members, someone who has not joined and a moderator, then undoes everything it wrote, so it leaves nothing behind. The result is one row: `all community rules hold` with `13` checks. If a rule does not hold, it stops with an error naming it (`FAIL: …`).

3. **Seed the team's posts.** Sign up in the site with the account the Rehla team will post from. In `supabase/seed/community.sql`, replace `TEAM_EMAIL` with that account's email and run the whole file. It makes that account a member named «فريق رحلة» with the moderator role (badge "Rehla team") and adds, in both languages, a pinned welcome post, the pinned full rules, and one discussion prompt per category. It is safe to run again.

4. **Assign roles.** Roles are changed only in the SQL editor (or by a moderator); a member can never raise their own. The person must have joined the community first, from their account page.

   ```sql
   -- "Rehla team" badge: may pin, hide, unhide and review reports.
   update public.community_members set role = 'moderator'
   where user_id = (select id from auth.users where email = 'person@example.org');

   -- "Guide" badge: a badge only, with no moderation rights.
   update public.community_members set role = 'guide'
   where user_id = (select id from auth.users where email = 'person@example.org');

   -- Back to a plain member.
   update public.community_members set role = 'member'
   where user_id = (select id from auth.users where email = 'person@example.org');
   ```

   Give the guide role only to real people whose role the team has confirmed. The product never claims that a scholar or da'iyah is present.

## Order

1. **Generate the key**, for example `openssl rand -hex 32`.
2. **Import `ai`.** Set its root directory and its variables, including `AI_SERVICE_KEY`, then deploy.
3. **Check `ai`** by opening `https://<ai-url>/health`. It should answer **401** because the key is required. That shows it is protected and running.
4. **Import `web`.** Set its root directory, `AI_SERVICE_URL` (the `ai` URL) and the same `AI_SERVICE_KEY`, then deploy.
5. **Changing the key later:** set the new value in both projects and redeploy both. Requests fail between the two redeploys, so do them back to back.

## Checking that it works

1. **Health.** Open `https://<web-url>/api/health`. Expect `200` with `"ai": {"reachable": true, "status": 200, …}`.
   - A `503` with `"status": 401` means the two `AI_SERVICE_KEY` values differ.
   - A `503` with `"status": null` means the web project cannot reach `AI_SERVICE_URL`.
2. **One question to Rafiq.** On `/<locale>/rafiq`, ask «ما أركان الإسلام؟» or "What are the pillars of Islam?". Expect a cited answer with numbered source cards. The first question on a cold instance takes longer, because it loads the index once (about 0.3 s locally).
3. **One lesson.** Open `/<locale>/learn`, skip the tour, and play a lesson from start to end. Check the board writes, an activity completes, and the journal shows the lesson's stamp.
4. **Accounts** (when on). Create an account from the header's "Sign in", then open the journal: it should say "Saved". In Supabase, **Table Editor → progress_items** shows the lesson. Sign out, sign in again on another browser, and the stamp is there.

5. **Community** (when accounts are on). Sign in, open your account page, join the community with a community name and accept the rules, then write a post on `/<locale>/community/write`. Open `/<locale>/community` in a private window: as a guest you can read the post but not reply or react.

## Rolling back

Vercel keeps every deployment. In each project's **Deployments** list, open the last good one and choose **Instant Rollback**. If the two projects must match, roll back both: for example, the web proxy and the service's key check changed together in the same commit. Environment variables are not rolled back with a deployment, so restore any changed value by hand.

## Limits to keep in mind

- **The AI function:** the bundle is the dependencies (FastAPI, LangGraph, LangChain, numpy) plus the 7 MB index, well under Vercel's 500 MB Python limit.
- **Function duration:** answers that need a repair round can take 20–60 s. The service may run up to 60 s and the proxy waits up to 90 s, so a slow answer ends as "unavailable" rather than hanging.
- **In-memory state:** the rate limit and the MCP cache are per instance and best effort (see `docs/ARCHITECTURE.md`).
