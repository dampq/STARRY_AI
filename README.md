# Starry AI ✦

**Your Universe, Your Story.** An interactive storytelling application with a React/Vite frontend, Express API, Gemini or OpenAI structured generation, Supabase authentication, and PostgreSQL world memory.

## Current implementation and verification limits

The repository contains the application and database migration, not a preconfigured hosted service. Without credentials, the landing page and editorial concept previews work; private routes lead to an informative setup screen. There is **no simulated AI backend or guest persistence**. No private stories are published.

Local automated tests exercise Gemini and OpenAI adapters with explicit mocked transport responses and the agent with deterministic test providers, PostgreSQL transactions/RLS using PGlite, API boundaries, and desktop/mobile browser behavior. These tests do **not** establish live AI provider quality, live Supabase authentication, email delivery, or a production deployment. Complete the live checklist below after connecting your own services.

## Run in your browser with GitHub Codespaces

You do not need to download this project or install Node on your PC.

1. In GitHub, open **Settings → Codespaces → Secrets**, and create these Codespaces secrets with access to `dampq/STARRY_AI`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `GEMINI_API_KEY`. The two URL values must match, and the two anon/public keys must match. Use the values from your existing Supabase and Google projects; cloud-workspace secrets are not transferred to GitHub automatically. Do not paste keys into repository files.
2. Open this repository → **Code → Codespaces → Create codespace on main**. The checked-in dev container installs Node 24 and project dependencies. GitHub Codespaces has usage allowances and may incur charges; check your GitHub account's quota.
3. In the browser editor, choose **Terminal → New Terminal** and run:

   ```bash
   AI_PROVIDER=gemini npm run dev
   ```

   The default Gemini model is `gemini-3.8-flash`, verified during setup. Set `GEMINI_MODEL` if your project needs another supported model. The app automatically derives and trusts this Codespace’s exact forwarded HTTPS origin, even if an old `.env` or secret sets `APP_ORIGIN` to localhost or another Codespace. Outside Codespaces, `APP_ORIGIN` still controls the deployment address. Port 5173 is fixed for this development workflow; an occupied port produces an explicit error rather than silently switching ports. The API prints its chosen application origin at startup. In Codespaces it trusts only the loopback Vite proxy for forwarded headers. It also accepts the exact `http://localhost:5173` / `http://127.0.0.1:5173` Origin used by local tunnel forwarding, only when the API connection itself comes from loopback. Unrelated origins and ports remain rejected, and authentication is still required. Other deployments keep proxy trust disabled until explicitly configured. If an origin is rejected, the error reports the public expected/received origins so a mismatch can be diagnosed without printing keys.

4. Open the **Ports** tab, find **5173**, and click **Open in Browser**. Keep the port **Private** unless you intentionally want to expose the development app. Port 3001 stays internal; the frontend proxies API requests to it.
5. Copy the forwarded port 5173 HTTPS address. In Supabase → **Authentication → URL Configuration**, add that address plus `/dashboard` and `/settings` as exact allowed redirect URLs (for example `https://YOUR-CODESPACE-5173.app.github.dev/dashboard`). For a Codespaces-only project, use the forwarded frontend origin as the Site URL; preserve an existing production Site URL if other deployments use the same project. Redirect URLs change if you create a new Codespace.
6. Sign up or sign in and generate a story. If using the same Supabase project configured during cloud setup, **do not run the migration again**. New projects need the migration described below. Keep the Codespace running while using the app; a stopped Codespace does not host an always-on website.

Secrets added after a Codespace was created require stopping and restarting that Codespace to be available to its processes. This repository does not deploy to GitHub Pages: the Express backend needs a running Node environment. For an always-on site, use the deployment instructions below with a Node hosting provider. The Codespaces configuration is included; validation in this workspace does not prove that GitHub has provisioned a Codespace for your account.

## Requirements

- Node.js 22.12 or newer (Node 24 was used during development), npm, a Supabase project, and either a Gemini API key or an OpenAI API account with access to a Structured Outputs compatible model.
- No local database or Docker is required for development against hosted Supabase.
- Chromium for browser tests; this environment provides `/usr/bin/chromium`. Else set `CHROMIUM_PATH` to your browser executable. Alternatively adapt Playwright's `launchOptions.executablePath` to use an installed Playwright browser.

## Local setup

Run all commands from the checkout root:

```bash
cd /workspace/STARRY_AI
npm ci --cache /workspace/.cache/npm
cp .env.example .env
```

Only run `cp` when `.env` does not already exist; preserve existing values. Fill `.env` securely:

| Variable                    | Purpose                                                                                                             | Exposed to browser?                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `SUPABASE_URL`              | Supabase project URL                                                                                                | No; duplicate its public value below |
| `SUPABASE_ANON_KEY`         | Project anon/publishable key                                                                                        | No; duplicate its public value below |
| `SUPABASE_SERVICE_ROLE_KEY` | Legacy service-role secret or supported backend secret key; canonical mutation RPCs require the `service_role` role | **Never**                            |
| `VITE_SUPABASE_URL`         | Same project URL                                                                                                    | Yes                                  |
| `VITE_SUPABASE_ANON_KEY`    | Same anon/publishable key                                                                                           | Yes; protected by RLS                |
| `AI_PROVIDER`               | `gemini` or `openai`; unset preserves OpenAI for existing deployments                                               | No                                   |
| `GEMINI_API_KEY`            | Gemini Developer API key (only required when selected)                                                              | **Never**                            |
| `GEMINI_MODEL`              | Defaults to `gemini-3.8-flash`; use an available JSON Schema capable text model                                     | No                                   |
| `STARRY_OPENAI_API_KEY`     | OpenAI API key (only required when selected)                                                                        | **Never**                            |
| `OPENAI_MODEL`              | Defaults to `gpt-4.1-mini`; must support strict structured responses                                                | No                                   |
| `APP_ORIGIN`                | Exact browser origin, defaults to `http://localhost:5173`                                                           | No                                   |
| `PORT`                      | API port, defaults to `3001`                                                                                        | No                                   |
| `GENERATION_LIMIT_PER_HOUR` | Backend generation-attempt allowance per user, defaults to `30`                                                     | No                                   |

`OPENAI_API_KEY` is also accepted as a backend fallback if already present. The `STARRY_` name allows secure proxy binding in cloud environments that reserve `OPENAI_` names. Never prefix backend secrets with `VITE_`. Never commit `.env`.

### Choose Gemini or OpenAI

New `.env.example` configurations select Gemini. Configure these backend variables:

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=your-key-entered-securely
GEMINI_MODEL=gemini-3.8-flash
```

Obtain a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) and enter it only in your ignored `.env` or secure environment settings. Never put it in a `VITE_` variable, frontend source, or chat. Choose a text model available to your project that supports JSON Schema structured output; override `GEMINI_MODEL` if the default model is unavailable. This adapter targets the Gemini Developer API, not Vertex AI service-account authentication. Provider quotas and billing depend on your Google project.

To use the existing OpenAI integration instead:

```dotenv
AI_PROVIDER=openai
STARRY_OPENAI_API_KEY=your-key-entered-securely
OPENAI_MODEL=gpt-4.1-mini
```

Only the selected provider needs a key. There is no automatic cross-provider fallback or transfer of story context to the other provider. If `AI_PROVIDER` is unset, existing deployments retain OpenAI as the default for compatibility. An invalid provider name fails startup rather than silently choosing another provider. Restart the API after changing provider settings; saved stories and branch snapshots remain compatible. The public health endpoint reports the selected `provider` and `model`, but key presence does not verify live provider access.

In the cloud configuration draft, select `AI_PROVIDER=gemini`, supply `GEMINI_API_KEY` securely, and allow `generativelanguage.googleapis.com`. If the earlier OpenAI secret requirement is still listed, remove that requirement in environment settings when using Gemini; OpenAI credentials are not needed. Supabase configuration is still required for authentication and durable storage.

### Supabase configuration

1. Create or choose a Supabase project. In its SQL editor, run the **entire** `supabase/migrations/001_starry.sql` once, as the database owner. The migration runs in a transaction and creates the tables, indexes, RLS policies, and atomic RPC functions. It intentionally does not drop an existing schema. Use a fresh project or inspect naming conflicts rather than deleting existing data.
2. Enable the Email authentication provider. Keep email confirmation enabled for a public deployment. Configure an SMTP provider for reliable production confirmation and password-reset email.
3. Set Authentication → URL Configuration → Site URL to your app origin. Add `http://localhost:5173/dashboard` and `http://localhost:5173/settings` to redirect URLs for local development, plus the matching HTTPS production routes. Avoid broad production wildcard redirects.
4. Obtain the public project URL and anon/publishable key for both backend verification and frontend auth. Obtain the backend service-role key from API settings and keep it strictly server-side. No service key is used by the frontend.
5. Restart Vite and the API after editing `.env`. Vite loads the root `.env`; public values are embedded at build time, so rebuild for deployment after changing them.

### Start and check

```bash
npm run dev
```

Vite serves the frontend on port 5173 and proxies `/api` to the API on port 3001. Use local HTTP requests to validate the service; cloud onboarding does not provide user-facing loopback previews.

```bash
curl --fail http://127.0.0.1:3001/api/health
```

Health reports `setup_required` until auth configuration, a successful database table read, and an AI key are present. A configured AI key is **not** a verified provider call; generate a chapter to test it. No AI call is made by a health probe. A database failure reports `storage: false` without exposing credentials or error bodies.

In cloud environment settings, allow `generativelanguage.googleapis.com` for Gemini (or `api.openai.com` for OpenAI) and **your exact Supabase project hostname** (typically `<project-ref>.supabase.co`) for runtime API requests. Package installation needs `registry.npmjs.org`. Browser authentication must also be able to reach the Supabase project. Do not broaden an unknown allowlist.

## Development and tests

```bash
npm run typecheck
npm test
npm run test:browser
npm run build
npm start
```

- `npm test`: deterministic continuity tests, bounded repair/refusal behavior, ten-scene identity/history preservation, inventory availability, relevant memory retrieval, SQL atomic commit/replay, failed-save rollback, branch isolation, ownership checks, RLS, and API authentication/origin/body-size boundaries. PGlite runs an actual PostgreSQL engine in-process. Its `auth.users` and `auth.uid()` test shim does not substitute for testing hosted Supabase auth.
- `npm run test:browser`: Chromium tests with desktop/mobile viewports, protected routes, editorial previews, setup notices, dialog focus, and reduced motion. Authenticated UI fixtures also exercise story creation, suggested/custom continuation, saved navigation without regeneration, memory/character/timeline views, branching, bookmarks, reading preferences, and export. Those explicit fixtures test UI behavior, not hosted provider connectivity. Screenshots/results are ignored under `test-results/`.
- `npm run build`: frontend type check, Vite production assets, and Node-compatible backend compilation. `npm start` serves the compiled frontend and API together. Stop the dev API first to avoid a port conflict.

### Live acceptance checklist (requires configured services)

1. Register two distinct test users. Confirm email, log in, log out, reset a password, and verify session persistence after reload.
2. As user A, create a short story. Confirm the opening saves and `/api/health` is ready. Test a suggested choice and a custom action. Reload and verify the same scenes remain; simply viewing saved chapters must not generate a chapter or charge for generation.
3. Continue at least ten scenes; inspect character names/statuses, acquired/lost/consumed inventory, relationships, known world rules, and remembered events. A request to use a nonexistent object should produce a grounded consequence, never silently grant the object. AI-assisted narrative checking is probabilistic and needs human review.
4. Fork an earlier checkpoint in the constellation or reader. Continue differently and switch back: original chapters and state must remain unchanged. Test two simultaneous continuation requests: at most one commits on the branch head. Retry a request with the same request UUID and exact action: it returns the committed scene rather than generating again.
5. As user B, request A's story UUID with B's access token and query the private tables with B's JWT. Both must deny access. End-user JWTs must be unable to execute the privileged state-mutation RPCs. A public/anon request must not access any private story.
6. Simulate provider failure and a database outage. Previously committed scenes must remain intact, save status must stay honest, and recovery must not duplicate chapters. Inspect provider billing while tuning the model and limits.
7. Exercise bookmarks, export, speech synthesis on a supported browser, reader preferences, search/filter/sort, archive/restore, rename, and confirmed deletion. Test mobile touch and keyboard-only interaction.

## Architecture

```text
React + TanStack Query + Zustand
       ↓ verified Supabase access token
Express: authentication → ownership → input validation → generation reservation
       ↓
Memory retrieval → private story plan → structured scene → deterministic reducer
       ↓
Independent AI continuity review → bounded repair (maximum two scene proposals)
       ↓
PostgreSQL atomic commit: scene + decision + snapshot + memory + request receipt
```

`backend/src/agents/storyteller.ts` orchestrates the configured provider with planning, generation, and review calls. The model has no backend tools. User actions and retrieved prose are untrusted fictional data. Zod validates inputs and Structured Outputs. Prompts and plans are never returned to the reader.

`backend/src/memory/retrieve.ts` retrieves five recent scenes, the last recap, active quests, canonical current state, and up to 30 lexically relevant historical facts. It does not repeatedly send the entire transcript. Original facts and world rules are append-only, separate from generated recaps. Recaps are navigation aids, not authority to rewrite history.

`backend/src/validators/continuity.ts` applies proposed changes to a clone, rejects unavailable item/ability use, identity changes, resurrection, duplicate identifiers, unknown locations/entities, rewritten facts/rules, and invalid quest transitions. Death is currently irreversible. Acquired objects cannot be used until the next scene. Nuanced contradictions, personality changes, and unreported item use receive a separate model review; that check cannot guarantee perfect consistency.

Canonical state is JSONB in `story_state`, with an immutable snapshot in every scene. `story_characters`, `story_events`, and `story_summaries` are queryable projections. Character locations and relationship metadata live in JSONB. Branches copy a checkpoint snapshot, inherit its ancestry through parent-scene links, and keep future mutable state isolated. The map is built from these stored edges; future, ungenerated possibilities are not presented as saved scenes.

A persistent generation receipt binds request UUID, authenticated owner, story, branch, base scene, and action hash. Reservations lock the user quota and branch, use a ten-minute lease and a unique token, and enforce a durable per-user hourly attempt quota. Commits recheck the token and head in one transaction. Failed attempts release their lease; a server crash recovers after expiry. Keep retries on the exact same request UUID/action to safely recover a lost HTTP response. Multi-instance generation safety comes from PostgreSQL, while general HTTP rate limits are per process.

Each generation uses one planning call, one or two scene calls, and corresponding independent review calls. Each provider request has a 55-second timeout and at most one transient provider retry. Gemini uses the native Google REST API with `x-goog-api-key` authentication and JSON Schema structured output; The submitted schema omits string and array bounds to avoid excessive grammar complexity across nested story-memory arrays; Zod still enforces every bound locally before any state is saved. Blocked, incomplete, empty, or malformed responses cannot commit state. Thought parts are discarded. Set proxy timeouts to accommodate the complete orchestration, or use an asynchronous job queue before high-traffic deployment. No automatic infinite continuation is included.

Safety limits include input lengths, a 32KB request limit, a 120,000-character model context bound, a 500-story limit per account, 25 branches per story, a 200-chapter limit per playthrough, and structured memory caps. The UI currently lists at most 500 stories; graph loading pages through saved scenes and has a 10,000-scene guard. These bounds fail explicitly instead of silently corrupting state. Long-running production use should add pagination controls, queued generation, shared HTTP throttling, monitoring, and budget alerts.

## API

All routes except health require a verified bearer access token. Ownership is checked through RLS and in privileged mutation RPCs. Invalid/missing-owned IDs do not expose another user's story.

| Routes                                                              | Purpose                                                     |
| ------------------------------------------------------------------- | ----------------------------------------------------------- |
| `GET /api/health`                                                   | Configuration and database connectivity status              |
| `GET, POST /api/stories`                                            | List private stories / create a saved draft                 |
| `GET, PATCH, DELETE /api/stories/:id`                               | Read bundle / rename or archive / delete                    |
| `POST /api/stories/:id/start`, `/continue`                          | Generate and atomically save                                |
| `GET /api/stories/:id/scenes`, `/scenes/:sceneId`                   | Saved scenes only                                           |
| `GET, POST /api/stories/:id/branches`                               | List / fork a checkpoint                                    |
| `GET /api/stories/:id/memory`, `/characters`, `/timeline`, `/state` | Branch memory views                                         |
| `GET, POST /api/stories/:id/bookmarks`                              | List / bookmark a saved scene                               |
| `DELETE /api/stories/:id/bookmarks/:bookmarkId`                     | Remove a bookmark                                           |
| `GET /api/stats`                                                    | Real owner-scoped story/chapter/decision/playthrough counts |
| `GET, PATCH /api/profile`                                           | Read/update display name                                    |

Bundle and memory routes accept `?branch=<uuid>`. Generation body:

```json
{
  "branchId": "<uuid>",
  "baseSceneId": "<uuid or null for start>",
  "requestId": "<unique uuid>",
  "choiceId": "<saved choice id>"
}
```

For a custom action, replace `choiceId` with `action`. The server resolves suggested choice text from the saved chapter. Client-supplied owner IDs, memory, scene content, and state are not accepted. Export and speech synthesis run locally in the browser. Browser speech synthesis availability and voices depend on the browser/OS.

## Deployment

### Single Node service

1. Apply the Supabase migration and configure auth redirect URLs for the production HTTPS origin.
2. Install with `npm ci`, set **only public** `VITE_SUPABASE_*` variables for the build, then run `npm run build`.
3. Inject backend variables securely at runtime and set `APP_ORIGIN=https://your-app-domain.example`. Run `npm start` from the project root with a supported Node version.
4. Terminate HTTPS at your platform/reverse proxy; route all application paths to this Node service so client-side routes fall back to the frontend. Keep `/api` same-origin. Set an appropriate long request timeout for generation. Only enable Express `trust proxy` after configuring the exact trusted proxy topology; it is deliberately off by default outside Codespaces; Codespaces trusts only the loopback frontend proxy.
5. Restrict runtime egress to the required provider/project hosts and monitor costs and failures without logging authorization headers, prompts, private story text, or keys. Configure database backups and restoration tests.

### Docker

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=YOUR-PUBLIC-ANON-KEY \
  -t starry-ai .
docker run --rm -p 3001:3001 --env-file .env starry-ai
```

Set `.env`'s `APP_ORIGIN` to the browser origin before running. Never supply a service-role, Gemini, or OpenAI secret as a build argument. The Dockerfile is supplied for deployment; building/running the container is separate from the tested local Node workflow.

## Repository map

- `frontend/src/components`: accessible shadcn-style Radix button/dialog primitives, original SVG celestial artwork.
- `frontend/src/pages`: landing, auth, dashboard/library, creation, reader/universe/characters/timeline/constellation, account settings.
- `backend/src`: Express boundaries, agent, memory retrieval, canonical reducer, scoped persistence.
- `supabase/migrations`: schema, RLS, branch snapshots, atomic mutation functions.
- `tests`: agent, PostgreSQL, API, and Playwright coverage.

This cloud task already uses an isolated checkout. Work in the existing repository; do not create a Git worktree unless explicitly requested. No optional ambient-audio or autonomous auto-continue mode is implemented. Public deployment should add operator-specific contact details, legal terms, content moderation policies, observability, and load testing.
