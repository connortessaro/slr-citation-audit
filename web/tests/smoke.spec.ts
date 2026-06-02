import { test, expect } from "@playwright/test";

test.describe("slr.audit smoke", () => {
  test("home renders hero, big stat, table", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Citation coverage audit")).toBeVisible();
    await expect(page.getByText("Mean coverage of the canonical")).toBeVisible();
    await expect(page.getByText("Every review, ranked")).toBeVisible();
    // KPI value rendered (mean coverage)
    await expect(page.getByText(/\d+\.\d%/).first()).toBeVisible();
  });

  test("/slrs renders sidebar + empty state", async ({ page }) => {
    await page.goto("/slrs");
    await expect(page.getByPlaceholder("Filter SLRs…")).toBeVisible();
    await expect(page.getByText("Pick a review to inspect")).toBeVisible();
  });

  test("/papers renders sidebar + empty state", async ({ page }) => {
    await page.goto("/papers");
    await expect(page.getByPlaceholder("Filter top-50…")).toBeVisible();
    await expect(page.getByText("Pick a canonical paper")).toBeVisible();
  });

  test("/consensus shows stats", async ({ page }) => {
    await page.goto("/consensus");
    await expect(page.getByText("Papers most cited across")).toBeVisible();
    await expect(page.getByText("Unique papers referenced")).toBeVisible();
  });

  test("/compare shows Jaccard picker", async ({ page }) => {
    await page.goto("/compare");
    await expect(page.getByText("Pairwise SLR reference overlap")).toBeVisible();
    await expect(page.getByText("Most similar pairs")).toBeVisible();
  });

  test("/graph renders network legend", async ({ page }) => {
    await page.goto("/graph");
    await expect(page.getByText("Citation network").first()).toBeVisible();
    await expect(page.getByText(/\d+ nodes · \d+ edges/)).toBeVisible({ timeout: 15_000 });
  });

  test("⌘K opens command palette via header button", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open command palette" }).click();
    await expect(page.getByPlaceholder("Search SLRs, papers, navigation…")).toBeVisible();
  });

  test("⌘K opens via keyboard shortcut", async ({ page, browserName }) => {
    await page.goto("/");
    const modifier = browserName === "webkit" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+k`);
    await expect(page.getByPlaceholder("Search SLRs, papers, navigation…")).toBeVisible();
  });

  test("clicking an SLR opens its detail page", async ({ page }) => {
    await page.goto("/slrs");
    const firstItem = page.locator("aside a").first();
    const title = await firstItem.locator("> div div").first().textContent();
    await firstItem.click();
    if (title) {
      // Detail page should also show this title (in h1 or list).
      await expect(page.locator("h1")).toContainText(title.trim().slice(0, 30));
    }
  });
});
