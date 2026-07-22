import { expect, test } from "@playwright/test";

test("login page loads with sign-in affordance", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("body")).toContainText(/sign in|google|hernandez|login/i);
});

test("billing redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/billing");
  await expect(page).toHaveURL(/\/login/);
});

test("tasks app redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
});

test("calendar day deep link redirects to login", async ({ page }) => {
  await page.goto("/app?nav=calendar&section=day&tab=week&cal=day");
  await expect(page).toHaveURL(/\/login/);
});

test("office instructions page is reachable", async ({ page }) => {
  await page.goto("/office-hub/instructions");
  await expect(page.locator("body")).toContainText(/office|firm|billing|tasks/i);
});
