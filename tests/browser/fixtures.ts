import type { Page } from "@playwright/test";
export async function authenticateFixture(page: Page, uid: string) {
  await page.addInitScript(
    ({ uid }) => {
      const user = {
        id: uid,
        aud: "authenticated",
        role: "authenticated",
        email: "reader@example.test",
        app_metadata: { provider: "email" },
        user_metadata: { display_name: "Elara" },
        created_at: new Date().toISOString(),
      };
      const jwt =
        "eyJhbGciOiJIUzI1NiJ9." +
        btoa(
          JSON.stringify({
            sub: uid,
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
        ) +
        ".test-signature";
      localStorage.setItem(
        "sb-127-auth-token",
        JSON.stringify({
          access_token: jwt,
          refresh_token: "test-only-refresh",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user,
        }),
      );
    },
    { uid },
  );
}
