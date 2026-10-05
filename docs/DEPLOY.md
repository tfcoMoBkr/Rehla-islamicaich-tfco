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
| `RAFIQ_DEBUG` | no | Leave unset. It is ignored on Vercel anyway (`VERCEL` is set). |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exist in the settings but nothing uses them yet: leave them unset.

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

`ISLAMHOUSE_API_KEY` is used only by the content scripts on a developer's machine; neither project needs it.

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

## Rolling back

Vercel keeps every deployment. In each project's **Deployments** list, open the last good one and choose **Instant Rollback**. If the two projects must match, roll back both: for example, the web proxy and the service's key check changed together in the same commit. Environment variables are not rolled back with a deployment, so restore any changed value by hand.

## Limits to keep in mind

- **The AI function:** the bundle is the dependencies (FastAPI, LangGraph, LangChain, numpy) plus the 7 MB index, well under Vercel's 500 MB Python limit.
- **Function duration:** answers that need a repair round can take 20–60 s. The service may run up to 60 s and the proxy waits up to 90 s, so a slow answer ends as "unavailable" rather than hanging.
- **In-memory state:** the rate limit and the MCP cache are per instance and best effort (see `docs/ARCHITECTURE.md`).
