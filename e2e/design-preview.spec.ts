import { expect, test } from "@playwright/test";

test.describe("隔离设计样板", () => {
  test("可以浏览代表页面并且不会创建正式数据库", async ({ page }) => {
    await page.goto("/?design-preview=1");

    await expect(page.getByRole("heading", { name: "今天，按自己的节奏前进" })).toBeVisible();
    await expect(page.getByText("今日花园")).toBeVisible();
    expect(await page.evaluate(async () => (await indexedDB.databases()).length)).toBe(0);

    await page.getByRole("button", { name: "Plan", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "把精力放在真正重要的地方" })).toBeVisible();

    await page.getByRole("button", { name: "Focus", exact: true }).first().click();
    await page.getByRole("button", { name: "暂停", exact: true }).click();
    await expect(page.getByText("已暂停 · 植物也在休息")).toBeVisible();
    await page.getByRole("button", { name: "超时", exact: true }).click();
    await expect(page.getByText("本轮已完成 · 超时专注")).toBeVisible();

    await page.getByRole("button", { name: "Meditation", exact: true }).click();
    await expect(page.getByRole("heading", { name: "此刻，你需要怎样的停留？" })).toBeVisible();
    await page.getByRole("button", { name: "开始这次停留" }).click();
    await expect(page.getByText("吸气")).toBeVisible();
    await page.getByRole("button", { name: "冥想", exact: true }).click();
    await expect(page.getByText("安静地停留")).toBeVisible();

    expect(await page.evaluate(async () => (await indexedDB.databases()).length)).toBe(0);
  });

  test("手机预览使用 390×844 设计画布", async ({ page }) => {
    await page.goto("/?design-preview=1&screen=today");
    await page.getByRole("button", { name: "手机宽度" }).click();
    const viewport = page.locator(".preview-viewport");
    await expect(viewport).toHaveCSS("width", "390px");
    await expect(viewport).toHaveCSS("height", "844px");
    await expect(page.locator(".mobile-nav")).toBeVisible();
  });
});
