import { expect, test, type Page } from "@playwright/test";

const FIXED_TIME = new Date("2026-08-14T08:00:00.000Z");

async function openAtFixedTime(page: Page) {
  await page.clock.install({ time: FIXED_TIME });
  await page.goto("/");
}

test("从任务开始正计时，暂停恢复后结束并同步完成状态", async ({ page }) => {
  await openAtFixedTime(page);
  await page.getByRole("link", { name: "Plan" }).click();
  await page.getByRole("button", { name: "新建任务" }).click();
  await page.getByLabel("任务标题").fill("V2 执行测试");
  await page.getByLabel("预计完成时长").fill("30");
  await page.getByLabel("截止日期").fill("2026-08-14");
  await page.getByRole("button", { name: "保存" }).click();

  const task = page.getByRole("article", { name: "V2 执行测试" });
  await task.getByRole("button", { name: "开始学习" }).click();
  await page.getByLabel("本次目标（可选）").fill("完成测试章节");
  await page.getByRole("button", { name: "进入 Focus" }).click();
  await expect(page.getByRole("heading", { name: "V2 执行测试" })).toBeVisible();

  await page.clock.runFor(30_000);
  await page.getByRole("button", { name: "暂停" }).click();
  await page.clock.runFor(30_000);
  await page.getByRole("button", { name: "继续" }).click();
  await page.clock.runFor(31_000);
  await page.getByRole("button", { name: "结束学习" }).click();
  await expect(page.getByRole("dialog", { name: "结束本次学习" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "结束本次学习" }).getByText(/^01:0[01]$/)).toBeVisible();
  await page.getByRole("button", { name: "确认结束" }).click();

  await page.getByRole("link", { name: "History" }).click();
  const history = page.getByRole("article").filter({ hasText: "V2 执行测试" });
  await expect(history).toContainText("完成");
  await history.getByRole("button", { name: "修正" }).click();
  await page.getByLabel("执行结果").selectOption("partial");
  await page.getByLabel("主要原因").selectOption("interrupted");
  await page.getByLabel("修正原因（必填）").fill("复盘后确认只完成一部分");
  await page.getByRole("button", { name: "保存修正" }).click();
  await expect(history).toContainText("部分完成");
  await page.getByRole("link", { name: "Plan" }).click();
  await page.getByLabel("按状态筛选").selectOption("completed");
  await expect(page.getByRole("article", { name: "V2 执行测试" })).toHaveAttribute("data-completed", "true");
});

test("不足一分钟的临时学习会话自动丢弃", async ({ page }) => {
  await openAtFixedTime(page);
  await page.getByRole("button", { name: "开始学习" }).click();
  await page.getByLabel("学习名称").fill("误触计时");
  await page.getByRole("button", { name: "进入 Focus" }).click();
  await page.clock.runFor(10_000);
  await page.getByRole("button", { name: "结束学习" }).click();
  await expect(page.getByText(/不足 1 分钟/)).toBeVisible();
  await page.getByRole("button", { name: "确认结束" }).click();
  await page.getByRole("link", { name: "History" }).click();
  await expect(page.getByText("误触计时")).toHaveCount(0);
});

test("Focus 按真实投入成长，结束后植物进入今日花园", async ({ page }) => {
  await openAtFixedTime(page);
  await page.getByRole("link", { name: "Plan" }).click();
  await page.getByRole("button", { name: "新建任务" }).click();
  await page.getByLabel("任务标题").fill("一分钟成长实验");
  await page.getByLabel("预计完成时长").fill("1");
  await page.getByLabel("截止日期").fill("2026-08-14");
  await page.getByRole("button", { name: "保存" }).click();
  await page.getByRole("article", { name: "一分钟成长实验" }).getByRole("button", { name: "开始学习" }).click();
  await page.getByRole("button", { name: "进入 Focus" }).click();

  await expect(page.locator(".focus-botanical .tree-stage")).toHaveClass(/stage-0/);
  await page.clock.runFor(30_000);
  await expect(page.locator(".focus-botanical .tree-stage")).toHaveClass(/stage-2/);
  await page.clock.runFor(31_000);
  await expect(page.locator(".focus-botanical .tree-stage")).toHaveClass(/stage-4/);
  await page.getByRole("button", { name: "结束学习" }).click();
  await page.getByRole("button", { name: "确认结束" }).click();
  await page.getByRole("link", { name: "Today" }).click();

  const garden = page.getByRole("list", { name: "今日成长植物" });
  await expect(garden).toBeVisible();
  await expect(garden.getByRole("listitem")).toHaveCount(1);
  await expect(garden.getByRole("img", { name: "成熟树" })).toBeVisible();
});

test("番茄钟到时后等待确认，再进入休息阶段", async ({ page }) => {
  await openAtFixedTime(page);
  await page.getByRole("link", { name: "专注设置" }).click();
  await page.getByLabel("专注时长").fill("1");
  await page.getByLabel("短休息").fill("1");
  await page.getByRole("button", { name: "保存设置" }).click();

  await page.getByRole("button", { name: "开始学习" }).click();
  await page.getByLabel("学习名称").fill("番茄阶段测试");
  await page.getByRole("radio", { name: /番茄钟/ }).check();
  await page.getByRole("button", { name: "进入 Focus" }).click();
  await page.clock.runFor(61_000);
  await expect(page.getByText("超时专注 · 正计时")).toBeVisible();
  const overtimeTimer = page.locator(".focus-orbit time");
  await expect(overtimeTimer).toHaveText(/^00:0[01]$/);
  await page.clock.runFor(4_000);
  await expect(overtimeTimer).toHaveText(/^00:0[45]$/);
  await page.getByRole("button", { name: "开始休息" }).click();
  await expect(page.getByText("休息", { exact: true })).toBeVisible();
  await page.clock.runFor(61_000);
  await expect(page.getByRole("button", { name: "开始下一轮" })).toBeVisible();
});

test("番茄专注到时会触发三声提示音", async ({ page }) => {
  await page.addInitScript(() => {
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (...args) {
      sessionStorage.setItem("studyflow-test-tone-count", String(Number(sessionStorage.getItem("studyflow-test-tone-count") ?? "0") + 1));
      return original.apply(this, args);
    };
  });
  await openAtFixedTime(page);
  await page.getByRole("button", { name: "开始学习" }).click();
  await page.getByLabel("学习名称").fill("到时声音测试");
  await page.getByRole("radio", { name: /番茄钟/ }).check();
  await page.getByLabel("本次专注时长").fill("1");
  await page.getByRole("button", { name: "进入 Focus" }).click();
  await page.clock.runFor(61_000);
  await expect.poll(() => page.evaluate(() => Number(sessionStorage.getItem("studyflow-test-tone-count") ?? "0"))).toBe(3);
});

test("开始时可独立设置番茄参数，Focus 修改从下一阶段生效", async ({ page }) => {
  await openAtFixedTime(page);
  await page.getByRole("button", { name: "开始学习" }).click();
  await page.getByLabel("学习名称").fill("独立番茄设置测试");
  await page.getByRole("radio", { name: /番茄钟/ }).check();
  await expect(page.getByLabel("本次专注时长")).toHaveValue("25");
  await page.getByLabel("本次专注时长").fill("1");
  await page.getByLabel("本次短休息").fill("1");
  await page.getByRole("button", { name: "进入 Focus" }).click();
  await expect(page.getByText("目标 1 分钟")).toBeVisible();

  await page.getByRole("button", { name: "调整本次番茄设置" }).click();
  await page.getByLabel("后续专注时长").fill("3");
  await page.getByLabel("后续短休息").fill("2");
  await page.getByRole("button", { name: "保存本次设置" }).click();
  await expect(page.getByText("目标 1 分钟")).toBeVisible();

  await page.clock.runFor(61_000);
  await page.getByRole("button", { name: "开始休息" }).click();
  await expect(page.getByText("目标 2 分钟")).toBeVisible();
  await page.getByRole("button", { name: "跳过休息" }).click();
  await expect(page.getByText("目标 3 分钟")).toBeVisible();
});

test("正计时达到任务预计时长后只提示并继续计时", async ({ page }) => {
  await openAtFixedTime(page);
  await page.getByRole("link", { name: "Plan" }).click();
  await page.getByRole("button", { name: "新建任务" }).click();
  await page.getByLabel("任务标题").fill("预计时长提醒");
  await page.getByLabel("预计完成时长").fill("1");
  await page.getByLabel("截止日期").fill("2026-08-14");
  await page.getByRole("button", { name: "保存" }).click();
  await page.getByRole("article", { name: "预计时长提醒" }).getByRole("button", { name: "开始学习" }).click();
  await page.getByRole("button", { name: "进入 Focus" }).click();
  await page.clock.runFor(61_000);
  await expect(page.getByText("已达到任务预计时长，计时会继续进行")).toBeVisible();
  await expect(page.getByRole("button", { name: "暂停" })).toBeVisible();
});

test("番茄休息可以暂停并跳过进入下一轮", async ({ page }) => {
  await openAtFixedTime(page);
  await page.getByRole("link", { name: "专注设置" }).click();
  await page.getByLabel("专注时长").fill("1");
  await page.getByRole("button", { name: "保存设置" }).click();
  await page.getByRole("button", { name: "开始学习" }).click();
  await page.getByLabel("学习名称").fill("休息控制测试");
  await page.getByRole("radio", { name: /番茄钟/ }).check();
  await page.getByRole("button", { name: "进入 Focus" }).click();
  await page.clock.runFor(61_000);
  await page.getByRole("button", { name: "开始休息" }).click();
  await page.getByRole("button", { name: "暂停" }).click();
  await expect(page.getByText("休息已暂停")).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();
  await page.getByRole("button", { name: "跳过休息" }).click();
  await expect(page.getByText("POMODORO · ROUND 2")).toBeVisible();
  await expect(page.getByText("正在专注")).toBeVisible();
});

test("可见页面发生明显 wall-clock 跳跃时要求处理休眠间隔", async ({ page }) => {
  await openAtFixedTime(page);
  await page.getByRole("button", { name: "开始学习" }).click();
  await page.getByLabel("学习名称").fill("休眠检测测试");
  await page.getByRole("button", { name: "进入 Focus" }).click();

  await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe("visible");
  await page.clock.runFor(1_000);
  const before = await page.evaluate(() => Date.now());
  // 只移动 wall clock，不触发定时器；随后模拟系统恢复后窗口重新获得焦点。
  await page.clock.setSystemTime(new Date(before + 60_000));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const jumped = await page.evaluate(() => Date.now()) - before;
  expect(jumped).toBeGreaterThanOrEqual(60_000);
  expect(jumped).toBeLessThan(61_000);
  await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe("visible");
  await expect(page.getByRole("dialog", { name: "检测到计时中断" })).toBeVisible();
  await expect(page.getByText(/排除这段时间/)).toBeVisible();
});

test("开始和结束会广播到同源的另一个标签页", async ({ page, context }) => {
  await openAtFixedTime(page);
  const other = await context.newPage();
  await other.clock.install({ time: FIXED_TIME });
  await other.goto("/");

  await page.getByRole("button", { name: "开始学习" }).click();
  await page.getByLabel("学习名称").fill("跨标签同步测试");
  await page.getByRole("button", { name: "进入 Focus" }).click();
  await expect(other.getByRole("complementary", { name: "正在进行的学习" })).toContainText("跨标签同步测试");

  await page.clock.runFor(61_000);
  await page.getByRole("button", { name: "结束学习" }).click();
  await page.getByRole("button", { name: "确认结束" }).click();
  await expect(other.getByRole("complementary", { name: "正在进行的学习" })).toHaveCount(0);
});

test("设置修改会广播到同源的另一个标签页", async ({ page, context }) => {
  await openAtFixedTime(page);
  const other = await context.newPage();
  await other.clock.install({ time: FIXED_TIME });
  await other.goto("/");

  await other.getByRole("link", { name: "专注设置" }).click();
  await page.getByRole("link", { name: "专注设置" }).click();
  await expect(page.getByLabel("提示音音量")).toHaveValue("80");
  await page.getByLabel("专注时长").fill("50");
  await page.getByLabel("提示音音量").fill("95");
  await page.getByRole("button", { name: "保存设置" }).click();
  await expect(other.getByLabel("专注时长")).toHaveValue("50");
  await expect(other.getByLabel("提示音音量")).toHaveValue("95");
});

test("用户可以调节并试听提示音音量", async ({ page }) => {
  await page.addInitScript(() => {
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (...args) {
      sessionStorage.setItem("studyflow-preview-tone-count", String(Number(sessionStorage.getItem("studyflow-preview-tone-count") ?? "0") + 1));
      return original.apply(this, args);
    };
  });
  await openAtFixedTime(page);
  await page.getByRole("link", { name: "专注设置" }).click();
  await page.getByLabel("提示音音量").fill("100");
  await page.getByRole("button", { name: "试听提示音" }).click();
  await expect.poll(() => page.evaluate(() => Number(sessionStorage.getItem("studyflow-preview-tone-count") ?? "0"))).toBe(3);
});
