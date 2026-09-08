import { test, expect } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("smoke: local fixture page shows title", async ({ page }) => {
  const fixturePath = path.resolve(__dirname, "fixtures", "smoke.html");
  await page.goto(pathToFileURL(fixturePath).href);
  await expect(page.getByRole("heading", { name: "LivSight E2E Smoke" })).toBeVisible();
});
