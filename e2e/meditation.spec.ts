import { expect, test, type Page } from "@playwright/test";

const FIXED_TIME = new Date("2026-08-15T03:00:00.000Z");

async function openAtFixedTime(page: Page) {
  await page.clock.install({ time: FIXED_TIME });
  await page.goto("/");
}

async function openMeditation(page: Page) {
  await page.getByRole("link", { name: "Meditation" }).click();
  await expect(page.getByRole("heading", { name: "给思绪留一点安静" })).toBeVisible();
}

async function startOneMinuteMeditation(page: Page, breathing: "guided" | "none" = "none") {
  await openMeditation(page);
  await page.getByLabel("自定义冥想分钟").fill("1");
  if (breathing === "none") {
    await page.getByLabel("呼吸引导").selectOption("none");
  }
  await page.getByRole("button", { name: "进入 Meditation" }).click();
}

test("开始冥想、跳过呼吸并完成复盘后同步 Today 花朵与 History 类型筛选", async ({ page }) => {
  await openAtFixedTime(page);
  await startOneMinuteMeditation(page, "guided");

  await expect(page.getByText("呼吸引导", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "跳过引导" }).click();
  await expect(page.getByText("正在冥想", { exact: true })).toBeVisible();
  await page.clock.runFor(61_000);

  await page.getByRole("button", { name: "结束冥想" }).click();
  const review = page.getByRole("dialog", { name: "结束本次冥想" });
  await expect(review).toBeVisible();
  await expect(review.getByText(/^01:0[01]$/)).toBeVisible();
  await review.getByRole("radio", { name: /4.*更放松/ }).check();
  await review.getByPlaceholder("此刻注意到了什么？").fill("呼吸慢下来以后，注意力更稳定了。");
  await review.getByRole("button", { name: "保存冥想" }).click();

  await page.getByRole("link", { name: "Today" }).click();
  const garden = page.getByRole("list", { name: "今日成长植物" });
  await expect(garden).toBeVisible();
  await expect(garden.getByRole("listitem")).toHaveCount(1);
  await expect(garden.getByRole("img", { name: "盛开的花" })).toBeVisible();

  await page.getByRole("link", { name: "History" }).click();
  const meditationRecord = page.getByRole("article").filter({ hasText: "平静" });
  await page.getByLabel("记录类型").selectOption("meditation");
  await expect(meditationRecord).toBeVisible();
  await expect(meditationRecord).toContainText(/01:0[12]/);
  await expect(meditationRecord).toContainText("更放松");
  await page.getByLabel("记录类型").selectOption("study");
  await expect(meditationRecord).toHaveCount(0);
});

test("定时冥想到时后继续正计时并显示超时成长状态", async ({ page }) => {
  await openAtFixedTime(page);
  await startOneMinuteMeditation(page);

  await page.clock.runFor(61_000);
  await expect(page.getByText("定时结束 · 正计时", { exact: true })).toBeVisible();
  await expect(page.locator(".meditation-controls-glass time")).toHaveText(/^00:0[01]$/);
  await expect(page.locator(".meditation-flower .plant-illustration")).toHaveClass(/is-overtime/);
  await page.clock.runFor(4_000);
  await expect(page.locator(".meditation-controls-glass time")).toHaveText(/^00:0[45]$/);
  await expect(page.getByRole("button", { name: "结束冥想" })).toBeVisible();
});

test("活动冥想在刷新后恢复，并在同源标签页间同步暂停、继续与结束", async ({ page, context }) => {
  await openAtFixedTime(page);
  const other = await context.newPage();
  await other.clock.install({ time: FIXED_TIME });
  await other.goto("/");

  await openMeditation(page);
  await page.getByRole("radio", { name: "自由计时" }).check();
  await page.getByLabel("呼吸引导").selectOption("none");
  await page.getByRole("button", { name: "进入 Meditation" }).click();
  await expect(other.getByRole("complementary", { name: "正在进行的冥想" })).toBeVisible();

  await page.clock.runFor(10_000);
  await page.reload();
  const restored = page.getByRole("complementary", { name: "正在进行的冥想" });
  await expect(restored).toBeVisible();
  await restored.getByRole("button", { name: /Meditation/ }).click();
  await expect(page.getByText("自由冥想", { exact: true })).toBeVisible();

  await other.getByRole("button", { name: "暂停冥想" }).click();
  await expect(page.getByText("冥想已暂停", { exact: true })).toBeVisible();
  await other.getByRole("button", { name: "继续冥想" }).click();
  await expect(page.getByText("自由冥想", { exact: true })).toBeVisible();

  await other.getByRole("button", { name: "结束冥想" }).click();
  const review = other.getByRole("dialog", { name: "结束本次冥想" });
  await expect(review.getByText(/不足 1 分钟/)).toBeVisible();
  await review.getByRole("button", { name: "跳过复盘并保存" }).click();
  await expect(page.getByRole("complementary", { name: "正在进行的冥想" })).toHaveCount(0);
  await expect(other.getByRole("complementary", { name: "正在进行的冥想" })).toHaveCount(0);
});
