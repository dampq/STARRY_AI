# Starry AI ✦

**Your Universe, Your Story.**

Starry AI is an interactive AI storytelling web application. Enter a story idea, choose a genre and mood, and generate an opening chapter. Continue by selecting a suggested choice or writing your own action. The application saves your chapters and tracks characters, locations, inventory, quests, and events as the story develops.

## Main features

- AI-generated stories with suggested choices and custom actions.
- Email-based accounts and private story storage.
- A personal library to revisit saved stories.
- Story universe, character, timeline, and constellation views.
- Alternate story branches from saved checkpoints.
- Bookmarks, story export, and browser-supported read-aloud.
- Continuity validation before generated chapters are saved.

## Technology used

| Part                        | Technology                              |
| --------------------------- | --------------------------------------- |
| Frontend                    | React, TypeScript, Vite, Tailwind CSS   |
| Backend                     | Node.js, Express                        |
| AI generation               | Gemini API; optional OpenAI integration |
| Authentication and database | Supabase Auth and PostgreSQL            |
| Browser-based development   | GitHub Codespaces                       |

## Run using GitHub Codespaces

No installation on your computer is required. You need a GitHub account, a configured Supabase project, and a Gemini API key. Codespaces and external services have their own usage limits and possible charges.

**For evaluators:** the repository does not contain private API keys. Use your own service credentials, or arrange authorized access to the project's configured services privately with the project owner. Opening the repository alone does not provide a running application.

### 1. Open the project

1. Open [dampq/STARRY_AI](https://github.com/dampq/STARRY_AI).
2. Select **Code → Codespaces → Create codespace on main**. If needed, fork the repository into your account first and create a Codespace from your fork.
3. Wait for the browser editor and automatic dependency installation to finish.
4. Select **Terminal → New Terminal** from the editor menu.

Run all commands below in the repository's root folder, where `package.json` is located. Codespaces normally opens there automatically. If dependency installation failed, run:

```bash
npm ci
```

### 2. Add the environment settings

If `.env` does not exist, create it from the template:

```bash
cp -n .env.example .env
```

Open `.env` in the editor. Fill in the following settings, replacing the placeholder values with your own credentials:

```dotenv
PORT=3001
APP_ORIGIN=http://localhost:5173

SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

AI_PROVIDER=gemini
AI_GENERATION_MODE=free_tier
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-3.1-flash-lite
```

**Save with Ctrl+S.** Replace existing settings rather than adding duplicate lines.

- Obtain the Supabase project URL and keys from your project's settings. The frontend and backend must use the same project URL and anon/public key.
- Obtain a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).
- `gemini-3.1-flash-lite` is the model confirmed working for this project's demonstration. Set it explicitly: the repository's template/default may name a different model. Availability and quota depend on your Google project.
- The model value must be only the ID shown above, without a URL or `models/` prefix.
- `.env` is ignored by Git. Never commit it, share screenshots of its contents, or put a service-role/AI key in a variable starting with `VITE_`.
- Credentials from another cloud workspace or the repository owner's account are not automatically available in your Codespace.

### 3. Prepare Supabase

**If using an already configured project, skip the migration. Do not run it again.**

For a new Supabase project:

1. Open **SQL Editor → New query** in Supabase.
2. Copy the entire contents of [supabase/migrations/001_starry.sql](supabase/migrations/001_starry.sql), paste into the SQL editor, and run it once. This creates the database tables, access policies, and functions.
3. In **Authentication → Providers**, enable email authentication.

### 4. Start the application

In the Codespaces terminal, run:

```bash
AI_PROVIDER=gemini AI_GENERATION_MODE=free_tier GEMINI_MODEL=gemini-3.1-flash-lite npm run dev
```

Wait for both startup messages:

```text
Local: http://localhost:5173/
Starry API listening on port 3001
```

**Keep this terminal running.** It runs both the frontend and backend. Pressing Ctrl+C stops the application.

Open the **Ports** tab beside Terminal, find **5173**, and select **Open in Browser** (the globe icon). If the port is missing, use **Forward a Port** and enter `5173`. Keep its visibility **Private**; each evaluator should use their own Codespace.

Use the forwarded HTTPS address, which looks like:

```text
https://YOUR-CODESPACE-NAME-5173.app.github.dev
```

Do not open `localhost:5173` on your own computer. Port **3001** is the internal backend and does not need to be exposed. The app automatically detects its Codespaces origin; leave `APP_ORIGIN` as shown for this workflow.

### 5. Configure email confirmation redirects

Copy your actual forwarded website address from step 4. In **Supabase → Authentication → URL Configuration**:

1. For a project dedicated to this demo, set **Site URL** to that website address. If sharing an existing production project, coordinate with its owner before changing its Site URL.
2. Add these exact **Redirect URLs**, replacing the hostname with your own:

   ```text
   https://YOUR-CODESPACE-NAME-5173.app.github.dev/dashboard
   https://YOUR-CODESPACE-NAME-5173.app.github.dev/settings
   ```

3. Save the changes.

Create an account in Starry AI and confirm your email if required, then sign in. Use the newest confirmation email; expired or already-used links will not work. Keep the Codespace running when opening the confirmation link. New Codespaces have different website addresses, so update the redirects if you create another one.

## Suggested demonstration

1. Sign in and select **Begin Your Story**.
2. Enter this example:

   | Field           | Example                                                                                                                                                                              |
   | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | Story's spark   | A young lighthouse keeper discovers that the light is receiving messages from a kingdom hidden among the stars. Tonight, one message warns that the kingdom is falling toward Earth. |
   | Story title     | The Lighthouse Between Stars                                                                                                                                                         |
   | Genre           | Fantasy                                                                                                                                                                              |
   | Mood            | Magical                                                                                                                                                                              |
   | World / setting | A quiet seaside town beneath a hidden kingdom of floating islands.                                                                                                                   |

3. Click **Generate My Story** once and wait. Free-tier mode normally uses two AI requests, spaced at least 15 seconds apart, so generation is not instant.
4. Read the opening chapter and choose a suggested action or enter your own.
5. Explore **Story Universe**, **Characters**, **Timeline**, and **Constellation** as the story develops.
6. Return to **My Library**, reopen the story, and verify that saved chapters remain available after refreshing.

Generation requires working external services. If generation fails, the saved draft can be reopened and retried without creating a new story. The landing page and editorial previews can be viewed without credentials, but live generation and private storage require setup.

## Stop, resume, and update

- **Stop:** press **Ctrl+C** in the running terminal. Stop the Codespace from GitHub when finished to conserve usage.
- **Resume:** reopen the Codespace, run the start command from step 4, and open port 5173 again.
- **Get updates:** stop the app, run `git pull --ff-only origin main`, then `npm ci`, and start it again. This command assumes a checkout of the original repository; forks need to sync with the original repository first.
- **After editing `.env`:** stop and restart the app, then refresh the website.

Codespaces runs the app while the environment is active. It is not an always-on public hosting service, and GitHub Pages cannot run this Express backend.

## Troubleshooting

| Problem                                          | What to check                                                                                                                                       |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website shows HTTP 502                           | Start the app, wait for both startup messages, and open port 5173 from the Ports tab.                                                               |
| “Unreadable response” or connection setup screen | Check the terminal for backend startup errors. Both frontend and API must be running.                                                               |
| `GEMINI_MODEL must be a Gemini model ID`         | Use exactly `gemini-3.1-flash-lite`, without a URL, prefix, or trailing slash.                                                                      |
| Signup shows “Failed to fetch”                   | Check the public Supabase URL/key, whether the Supabase project is active, and whether your browser/network can reach it.                           |
| Confirmation opens localhost                     | Correct Supabase Site URL and redirect URLs, then request a fresh confirmation email if needed.                                                     |
| Gemini HTTP 429 / quota limit                    | Wait for the displayed cooldown or provider quota reset. Repeated clicks and new keys in the same project do not replenish quota.                   |
| Gemini HTTP 503                                  | The provider returned a service-unavailable response. Keep the saved draft and retry later; changing Supabase settings will not resolve this error. |
| Gemini rejects the model/request                 | Confirm your Google project supports the selected model and structured output. A dashboard quota listing alone does not guarantee access.           |

For backend diagnosis, open a second terminal while the app is running:

```bash
curl -i http://127.0.0.1:3001/api/health
```

This checks configuration and database connectivity without generating a story. It does not prove that a live AI request will succeed. Connection refused means the API is not listening on port 3001; inspect its startup output.

## Development checks and further documentation

```bash
npm run typecheck
npm test
npm run build
```

These checks do not require a live AI generation request. Browser tests are also available through `npm run test:browser` with a compatible Chromium installation.

See the [technical guide](docs/TECHNICAL_GUIDE.md) for architecture, API routes, database details, provider options, validation limits, and deployment instructions. Automated tests use mocked provider responses; successful tests do not guarantee external API availability or perfect narrative consistency.
