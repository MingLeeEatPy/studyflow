import { expect, test, type Page } from "@playwright/test";

const FIXED_TIME = new Date("2026-08-15T03:00:00.000Z");

async function createTask(page: Page, title: string, category: string, minutes: number, important: boolean, urgent: boolean) {
  await page.getByRole("button", { name: "新建任务" }).click();
  await page.getByLabel("任务标题").fill(title);
  await page.getByLabel("所属分类").selectOption({ label: category });
  await page.getByLabel("预计完成时长").fill(String(minutes));
  await page.getByLabel("截止日期").fill("2026-08-15");
  if (important) await page.getByRole("checkbox", { name: /^重要 / }).check();
  if (urgent) await page.getByRole("checkbox", { name: /^紧急 / }).check();
  await page.getByRole("button", { name: "保存" }).click();
}

test("Today、Plan、Focus 的正式视觉在桌面和手机宽度保持稳定", async ({ page }) => {
  test.setTimeout(60_000);
  await page.clock.install({ time: FIXED_TIME });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("link", { name: "Plan" }).click();

  await createTask(page, "高数：复习微分中值定理", "高数", 45, true, true);
  await createTask(page, "CS50 Week 4 笔记整理", "CS50", 35, true, false);
  await createTask(page, "线性代数习题 3.2", "线性代数", 30, false, true);

  await expect(page).toHaveScreenshot("plan-nature-desktop.png", { animations: "disabled", maxDiffPixels: 150 });
  await page.getByRole("link", { name: "Today" }).click();
  await expect(page).toHaveScreenshot("today-nature-desktop.png", { animations: "disabled", maxDiffPixels: 150 });

  await page.getByRole("link", { name: "Plan" }).click();
  await page.getByRole("article", { name: /高数：复习微分中值定理/ }).getByRole("button", { name: "开始学习" }).click();
  await page.getByLabel("本次目标（可选）").fill("完成本章定理复习与两道例题");
  await page.getByRole("button", { name: "进入 Focus" }).click();
  await page.clock.runFor(8 * 60 * 1000);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 250));
  await page.locator(".focus-orbit time").evaluate((element) => { element.textContent = "08:00"; });
  await expect(page).toHaveScreenshot("focus-nature-desktop.png", { animations: "disabled", maxDiffPixels: 150 });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".focus-orbit time").evaluate((element) => { element.textContent = "08:00"; });
  await expect(page).toHaveScreenshot("focus-nature-mobile.png", { animations: "disabled", maxDiffPixels: 150 });
  await page.getByRole("button", { name: "返回 StudyFlow" }).click();
  await page.getByRole("link", { name: "Today" }).click();
  await page.locator(".active-session-bar time").evaluate((element) => { element.textContent = "08:00"; });
  await expect(page).toHaveScreenshot("today-nature-mobile.png", { animations: "disabled", maxDiffPixels: 150 });
  await page.getByRole("link", { name: "Plan" }).click();
  await page.locator(".active-session-bar time").evaluate((element) => { element.textContent = "08:00"; });
  await expect(page).toHaveScreenshot("plan-nature-mobile.png", { animations: "disabled", maxDiffPixels: 150 });
});

test("正式视觉支持键盘焦点与减少动画", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "闲时要有吃紧的心思，忙处要有悠闲的趣味。" })).toBeVisible();
  await page.keyboard.press("Tab");
  const todayLink = page.getByRole("link", { name: "Today" });
  await expect(todayLink).toBeFocused();
  const transitionSeconds = await todayLink.evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration));
  expect(transitionSeconds).toBeLessThanOrEqual(0.001);
});

test("Focus 暂停、超时和三按钮状态在手机宽度保持清晰", async ({ page }) => {
  await page.clock.install({ time: FIXED_TIME });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "开始学习" }).click();
  await page.getByLabel("学习名称").fill("移动端番茄视觉检查");
  await page.getByRole("radio", { name: /番茄钟/ }).check();
  await page.getByLabel("本次专注时长").fill("1");
  await page.getByLabel("本次短休息").fill("1");
  await page.getByRole("button", { name: "进入 Focus" }).click();

  await page.getByRole("button", { name: "暂停" }).click();
  await expect(page.locator(".focus-botanical")).toHaveClass(/paused/);
  await page.getByRole("button", { name: "继续" }).click();
  await page.clock.runFor(61_000);
  await expect(page.getByText("超时专注 · 正计时")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "当前专注阶段进度" })).toHaveAttribute("aria-valuenow", "100");
  await expect(page.locator(".focus-botanical")).toHaveClass(/overtime/);

  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 250));
  await page.locator(".focus-orbit time").evaluate((element) => { element.textContent = "00:01"; });
  await expectNoButtonOverlap(page);
  await expect(page).toHaveScreenshot("focus-overtime-mobile.png", { animations: "disabled", maxDiffPixels: 150 });

  await page.getByRole("button", { name: "开始休息" }).click();
  await page.getByRole("button", { name: "暂停" }).click();
  await expect(page.locator(".focus-botanical")).toHaveClass(/paused/);
  await expectNoButtonOverlap(page);
  await expect(page).toHaveScreenshot("focus-break-paused-mobile.png", { animations: "disabled", maxDiffPixels: 150 });

  await page.setViewportSize({ width: 320, height: 844 });
  await expectNoButtonOverlap(page);
});

test("Meditation 的入口、沉浸计时与复盘在桌面和手机宽度保持稳定", async ({ page }) => {
  test.setTimeout(60_000);
  await page.clock.install({ time: FIXED_TIME });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("link", { name: "Meditation" }).click();
  await expect(page.getByRole("heading", { name: "风恬浪静中，见人生之真境；味淡声希处，识心体之本然。" })).toBeVisible();
  await expect(page).toHaveScreenshot("meditation-entry-desktop.png", { animations: "disabled", maxDiffPixels: 150 });

  await page.getByLabel("自定义冥想分钟").fill("1");
  await page.getByLabel("呼吸引导").selectOption("none");
  await page.getByRole("button", { name: "进入 Meditation" }).click();
  await page.clock.runFor(31_000);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 250));
  await expect(page.getByText("正在冥想", { exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot("meditation-focus-desktop.png", { animations: "disabled", maxDiffPixels: 150 });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page).toHaveScreenshot("meditation-focus-mobile.png", { animations: "disabled", maxDiffPixels: 150 });
  await page.getByRole("button", { name: "结束冥想" }).click();
  await expect(page.getByRole("dialog", { name: "结束本次冥想" })).toBeVisible();
  await expect(page).toHaveScreenshot("meditation-review-mobile.png", { animations: "disabled", maxDiffPixels: 150 });
});

async function expectNoButtonOverlap(page: Page) {
  const boxes = await page.locator(".focus-actions > .button").evaluateAll((buttons) => buttons.map((button) => {
    const box = button.getBoundingClientRect();
    return {
      left: box.left,
      right: box.right,
      top: box.top,
      bottom: box.bottom,
      contentFits: button.scrollWidth <= button.clientWidth,
    };
  }));
  expect(boxes.every((box) => box.contentFits)).toBe(true);
  for (let first = 0; first < boxes.length; first += 1) {
    for (let second = first + 1; second < boxes.length; second += 1) {
      const a = boxes[first]; const b = boxes[second];
      const overlaps = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      expect(overlaps).toBe(false);
    }
  }
}
