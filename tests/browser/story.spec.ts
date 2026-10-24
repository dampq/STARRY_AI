import { test, expect } from "@playwright/test";
import { authenticateFixture } from "./fixtures";
// UI-only fixtures. Actual canonical mutations and RLS are tested against PostgreSQL separately.
const sid = "11111111-1111-4111-8111-111111111111",
  bid = "22222222-2222-4222-8222-222222222222",
  uid = "33333333-3333-4333-8333-333333333333";
test("create, continue, revisit, branch, inspect memory, bookmark, and export", async ({
  page,
}, info) => {
  await page.clock.install();
  const now = new Date().toISOString();
  const state = {
    currentLocation: "origin",
    locations: [
      {
        id: "origin",
        name: "The harbor",
        description: "A quiet harbor under the stars.",
      },
    ],
    characters: [
      {
        id: "protagonist",
        name: "Elara",
        personality: "Curious",
        background: "A mapmaker",
        status: "alive",
        location: "origin",
      },
    ],
    inventory: [],
    relationships: [],
    quests: [],
    worldRules: [],
    facts: [],
    abilities: [],
  };
  let story: any = {
    id: sid,
    user_id: uid,
    title: "The Silver Harbor",
    theme: "A lost kingdom calls to a mapmaker from among the stars.",
    genre: "Fantasy",
    mood: "Magical",
    setting: "The harbor",
    preferences: {},
    status: "active",
    created_at: now,
    updated_at: now,
    chapterCount: 0,
  };
  const branches: any[] = [
    {
      id: bid,
      name: "Original journey",
      current_scene_id: null,
      parent_branch_id: null,
      fork_scene_id: null,
    },
  ];
  const scenes: any[] = [];
  const bookmarks: any[] = [];
  let generationCount = 0;
  const actions: any[] = [];
  await authenticateFixture(page, uid);
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const body = req.postDataJSON();
    let data: any = {};
    const method = req.method();
    if (path === "/api/health")
      data = {
        status: "ready",
        auth: true,
        storage: true,
        ai: true,
        model: "test-fixture",
      };
    else if (path === "/api/stories" && method === "GET") data = [story];
    else if (path === "/api/stories" && method === "POST") {
      story = { ...story, preferences: body, title: body.title || story.title };
      data = { id: sid, branchId: bid };
    } else if (path.endsWith("/start") || path.endsWith("/continue")) {
      generationCount++;
      actions.push(body);
      const branch = branches.find((b) => b.id === body.branchId);
      const parent = scenes.find((s) => s.id === branch.current_scene_id);
      const n = (parent?.scene_number || 0) + 1;
      const scene = {
        id: `44444444-4444-4444-8444-${String(generationCount).padStart(12, "0")}`,
        story_id: sid,
        branch_id: branch.id,
        parent_scene_id: parent?.id || null,
        scene_number: n,
        title:
          n === 1
            ? "A Letter from the Stars"
            : branch.parent_branch_id
              ? "The Road Not Taken"
              : "The Bell Beyond the Bay",
        narrative:
          (body.action
            ? "Elara decided to " + body.action + ". "
            : "Elara studied the letter in her hands. ") +
          "The harbor stretched before her, silver beneath the rising moon. A distant bell broke the silence, and the stranger on the pier turned to face her. Somewhere beyond the water, an old kingdom was waking.\n\nThe decision would matter long after this night had passed.",
        choices: [
          { id: "help", text: "Help the stranger on the pier" },
          { id: "follow", text: "Follow the light across the bay" },
          { id: "wait", text: "Wait and listen to the bell" },
        ],
        state_snapshot: {
          ...structuredClone(parent?.state_snapshot || state),
          facts: [
            ...(parent?.state_snapshot.facts || []),
            {
              id: `event_${generationCount}`,
              description: "Elara heard the bell.",
              entities: ["protagonist"],
            },
          ],
        },
        recap: "Elara received a letter and heard the harbor bell.",
        story_finished: false,
        created_at: now,
      };
      scenes.push(scene);
      branch.current_scene_id = scene.id;
      story.chapterCount = n;
      data = { sceneId: scene.id };
    } else if (path.endsWith("/branches") && method === "POST") {
      const branch = {
        id: "55555555-5555-4555-8555-555555555555",
        name: body.name,
        current_scene_id: body.sceneId,
        parent_branch_id: bid,
        fork_scene_id: body.sceneId,
      };
      branches.push(branch);
      data = { branchId: branch.id };
    } else if (path.endsWith("/bookmarks") && method === "GET")
      data = bookmarks;
    else if (path.endsWith("/bookmarks") && method === "POST") {
      data = {
        id: "66666666-6666-4666-8666-666666666666",
        scene_id: body.sceneId,
      };
      bookmarks.push(data);
    } else if (path.includes("/bookmarks/") && method === "DELETE") {
      bookmarks.length = 0;
    } else if (path === `/api/stories/${sid}`) {
      const branch =
        branches.find((b) => b.id === url.searchParams.get("branch")) ||
        branches[0];
      data = {
        story,
        branch,
        branches,
        scenes,
        state:
          scenes.find((s) => s.id === branch.current_scene_id)
            ?.state_snapshot || state,
      };
    } else if (path === "/api/stats")
      data = {
        stories: 1,
        chapters: scenes.length,
        decisions: Math.max(0, scenes.length - 1),
        playthroughs: branches.length,
      };
    else if (path === "/api/profile") data = { id: uid, display_name: "Elara" };
    else
      return route.fulfill({
        status: 404,
        json: { error: "Unknown fixture route" },
      });
    await route.fulfill({ json: data });
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/create");
  await expect(
    page.getByRole("heading", { name: "What’s your spark?" }),
  ).toBeVisible();
  await page.getByLabel("Your story’s spark *").fill(story.theme);
  await page.getByLabel("Main character’s name *").fill("Elara");
  await page.getByRole("button", { name: "Generate My Story" }).click();
  await expect(
    page.getByRole("heading", { name: "A Letter from the Stars" }),
  ).toBeVisible();
  expect(generationCount).toBe(1);
  await page
    .getByRole("button", { name: /Help the stranger on the pier/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "The Bell Beyond the Bay" }),
  ).toBeVisible();
  expect(actions[1].choiceId).toBe("help");
  await page.getByRole("button", { name: "Previous chapter" }).click();
  await expect(
    page.getByRole("heading", { name: "A Letter from the Stars" }),
  ).toBeVisible();
  expect(generationCount).toBe(2);
  await expect(
    page.getByRole("button", { name: "Branch from this chapter" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next saved chapter" }).click();
  await page
    .getByLabel("Or write your own next move…")
    .fill("ask the stranger why the bell is ringing");
  await page.getByRole("button", { name: "Continue Story" }).click();
  await expect(
    page.getByText("Elara decided to ask the stranger"),
  ).toBeVisible();
  expect(actions[2].action).toContain("ask the stranger");
  await page
    .getByRole("button", { name: "Bookmark chapter", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Remove bookmark" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reading settings" }).click();
  await page.getByLabel("Font size").fill("23");
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Markdown", exact: true }).click();
  expect((await dl).suggestedFilename()).toBe("The Silver Harbor.md");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("link", { name: "Story Universe", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Canonical memories" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Elara alive" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Characters", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "The souls of your story." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Timeline", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Every moment left a mark." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Constellation", exact: true }).click();
  await page.getByText("Accessible chapter list").click();
  await page
    .getByRole("button", { name: /Chapter 1 · Original journey/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "A Letter from the Stars" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Branch from this chapter" }).click();
  await page.getByLabel("Branch name").fill("A different sky");
  await page.getByRole("button", { name: "Create alternate journey" }).click();
  await expect(
    page.getByRole("combobox", { name: "Story branch" }),
  ).toHaveValue("55555555-5555-4555-8555-555555555555");
  await page
    .getByRole("button", { name: /Follow the light across the bay/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "The Road Not Taken" }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Story branch" }).selectOption(bid);
  await expect(
    page.getByRole("heading", { name: "The Bell Beyond the Bay" }),
  ).toBeVisible();
  expect(scenes.filter((s) => s.branch_id === bid)).toHaveLength(3);
  expect(generationCount).toBe(4);
  await page.screenshot({
    path: `test-results/reader-${info.project.name}.png`,
    fullPage: true,
  });
  const paper = await page.locator(".reader-paper").boundingBox();
  expect(paper!.x + paper!.width).toBeLessThanOrEqual(
    await page.evaluate(() => innerWidth),
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(await page.evaluate(() => document.activeElement?.className)).not.toBe(
    "skip-link",
  );
  let quotaAttempts = 0;
  await page.route(`**/api/stories/${sid}/continue`, async (route) => {
    quotaAttempts++;
    await route.fulfill({
      status: 429,
      json: {
        error: "Gemini's request limit was reached.",
        code: "GEMINI_COOLDOWN",
        retryAt: Date.now() + 90000,
      },
    });
  });
  await page
    .getByRole("button", { name: /Help the stranger on the pier/ })
    .click();
  await expect(page.getByRole("note")).toContainText("Gemini cooldown");
  await expect(
    page.getByRole("button", { name: /Help the stranger on the pier/ }),
  ).toBeDisabled();
  await page
    .getByLabel("Or write your own next move…")
    .fill("Wait by the harbor");
  await expect(
    page.getByRole("button", { name: "Continue Story" }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Begin Your Story" }).first().click();
  await expect(
    page.getByRole("button", { name: "Generate My Story" }),
  ).toBeDisabled();
  await expect(page.getByRole("note")).toContainText("Your draft is saved");
  await page.goBack();
  await page.clock.fastForward(91000);
  await expect(
    page.getByRole("button", { name: /Help the stranger on the pier/ }),
  ).toBeEnabled();
  await expect(page.getByRole("note")).not.toBeVisible();
  expect(quotaAttempts).toBe(1);
  expect(errors).toEqual([]);
});

test("opening cooldown preserves one saved draft and reuses its request ID", async ({
  page,
}) => {
  await page.clock.install();
  await authenticateFixture(page, uid);
  let drafts = 0;
  const attempts: string[] = [];
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/health")
      return route.fulfill({
        json: {
          status: "ready",
          auth: true,
          storage: true,
          ai: true,
          provider: "gemini",
          generationMode: "free_tier",
          model: "test-fixture",
        },
      });
    if (
      url.pathname === "/api/stories" &&
      route.request().method() === "POST"
    ) {
      drafts++;
      return route.fulfill({ json: { id: sid, branchId: bid } });
    }
    if (url.pathname.endsWith("/start")) {
      attempts.push(route.request().postDataJSON().requestId);
      if (attempts.length === 1)
        return route.fulfill({
          status: 429,
          json: {
            error: "Gemini cooldown",
            code: "GEMINI_COOLDOWN",
            retryAt: Date.now() + 60000,
          },
        });
      return route.fulfill({
        json: { sceneId: "44444444-4444-4444-8444-000000000001" },
      });
    }
    return route.fulfill({
      status: 503,
      json: { error: "Test stops after successful retry." },
    });
  });
  await page.goto("/create");
  await page
    .getByLabel("Your story’s spark *")
    .fill("A dragon opens a bakery in a quiet mountain village.");
  await page.getByLabel("Main character’s name *").fill("Elara");
  await page.getByRole("button", { name: "Generate My Story" }).click();
  await expect(
    page.getByRole("button", { name: "Retry opening chapter" }),
  ).toBeDisabled();
  await expect(page.getByRole("note")).toContainText("Gemini cooldown");
  expect(drafts).toBe(1);
  expect(attempts).toHaveLength(1);
  await page.clock.fastForward(61000);
  await expect(
    page.getByRole("button", { name: "Retry opening chapter" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Retry opening chapter" }).click();
  await expect.poll(() => attempts.length).toBe(2);
  expect(attempts[0]).toBe(attempts[1]);
  expect(drafts).toBe(1);
});
