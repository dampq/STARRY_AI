# Starry AI ✦

**Your Universe, Your Story.**

Starry AI is an interactive AI storytelling application. Enter a story idea, choose a genre and mood, and generate a story. Continue by choosing suggested actions or writing your own. Saved stories include characters, locations, inventory, quests, and a timeline of events.

## Features

- Generate and continue interactive stories.
- Sign in and save stories in a private library.
- Explore characters, the story universe, and timelines.
- Create alternate story branches.
- Bookmark and export saved chapters.

Built with React, TypeScript, Vite, Express, Gemini, and Supabase.

## Run in GitHub Codespaces

No installation on your computer is needed.

**Before the demonstration:** the project owner must configure the service credentials privately in the Codespace being used. Credentials are not included in this repository or automatically shared with another GitHub account. The steps below assume this setup is complete.

1. Open [this repository](https://github.com/dampq/STARRY_AI).
2. Click **Code → Codespaces**, then open your existing Codespace or select **Create codespace on main**.
3. Wait for the editor and automatic dependency installation to finish.
4. Open **Terminal → New Terminal** and run:

   ```bash
   AI_PROVIDER=gemini AI_GENERATION_MODE=free_tier GEMINI_MODEL=gemini-3.1-flash-lite npm run dev
   ```

5. Wait for both messages:

   ```text
   Local: http://localhost:5173/
   Starry API listening on port 3001
   ```

6. Open the **Ports** tab next to Terminal. Find port **5173** and click **Open in Browser** (the globe icon).
7. Sign in, select **Begin Your Story**, fill in the story form, and click **Generate My Story**.

Keep the terminal and Codespace running while using the application. Use the website opened from the Ports tab rather than typing localhost into your computer's browser.

If dependencies were not installed automatically, run `npm ci` in the terminal before the start command.

## Sample story

| Field | Example |
| --- | --- |
| Story's spark | A young lighthouse keeper receives a message from a kingdom hidden among the stars, warning that it is falling toward Earth. |
| Story title | The Lighthouse Between Stars |
| Genre | Fantasy |
| Mood | Magical |
| World / setting | A quiet seaside town beneath a hidden kingdom of floating islands. |

Generation can take time. Click once and wait; free-tier mode normally uses two AI requests spaced at least 15 seconds apart. If the provider is busy or its quota is exhausted, keep the saved draft and retry later.

## Stop and run again

- To stop the app, press **Ctrl+C** in the terminal.
- To run it again, reopen the Codespace and use the same start command above.
- Stop the Codespace from GitHub when finished to conserve usage. Codespaces is not an always-on hosting service.

For owner setup, architecture, database configuration, and development checks, see the [technical guide](docs/TECHNICAL_GUIDE.md).
