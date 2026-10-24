import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: {
        status: "setup_required",
        auth: false,
        storage: false,
        ai: false,
        provider: "gemini",
        generationMode: "free_tier",
        model: "test-fixture",
      },
    }),
  );
});
test("landing, editorial showcase, protected navigation, and setup state", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Every Story",
  );
  await page.getByRole("button", { name: /FANTASY The Kingdom/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText(
    "not a saved or AI-generated story",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.screenshot({
    path: `test-results/landing-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "Begin Your Story" }).first().click();
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(
    page.getByText("Your universe needs a connection"),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto("/signup");
  await expect(
    page.getByRole("heading", { name: "Let your story begin." }),
  ).toBeVisible();
  await page.goto("/reset");
  await expect(
    page.getByRole("heading", { name: "Find your way back." }),
  ).toBeVisible();
  await page.goto("/unknown");
  await expect(
    page.getByRole("heading", { name: "An uncharted corner of the cosmos." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("keyboard dialog focus and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Privacy", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Privacy", exact: true }),
  ).toBeFocused();
  expect(
    await page
      .locator(".magic-book")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});
