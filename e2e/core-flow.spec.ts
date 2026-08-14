import { expect, test } from '@playwright/test';

function localToday(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

test.beforeEach(async ({ page }) => page.goto('/'));

test('新建、编辑、完成、重开及归档任务的主流程', async ({ page }) => {
  await page.getByRole('link', { name: 'Plan' }).click();
  await page.getByRole('button', { name: '新建任务' }).click();
  await page.getByLabel('任务标题').fill('完成 CS50 Lab');
  await page.getByLabel('所属分类').selectOption({ label: 'CS50' });
  await page.getByLabel('预计完成时长').fill('90');
  await page.getByLabel('截止日期').fill(localToday());
  await page.getByRole('checkbox', { name: /^重要 / }).check();
  await page.getByRole('checkbox', { name: /^紧急 / }).check();
  await page.getByRole('button', { name: '保存' }).click();

  const card = page.getByRole('article', { name: /完成 CS50 Lab/ });
  await expect(card).toContainText('90 分钟');
  await expect(page.getByRole('region', { name: '重要且紧急' })).toContainText('完成 CS50 Lab');

  await card.getByRole('button', { name: '编辑' }).click();
  await page.getByLabel('预计完成时长').fill('75');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(card).toContainText('75 分钟');

  await card.getByRole('checkbox', { name: '标记完成' }).click();
  await expect(card).toHaveCount(0);
  await page.getByLabel('按状态筛选').selectOption('completed');
  const completedCard = page.getByRole('article', { name: /完成 CS50 Lab/ });
  await expect(completedCard).toHaveAttribute('data-completed', 'true');
  await completedCard.getByRole('checkbox', { name: '标记完成' }).click();
  await expect(completedCard).toHaveCount(0);
  await page.getByLabel('按状态筛选').selectOption('active');
  await expect(card).toHaveAttribute('data-completed', 'false');

  await card.getByRole('button', { name: '删除' }).click();
  await expect(page.getByRole('dialog', { name: '删除任务' })).toBeVisible();
  await page.getByRole('button', { name: '确认删除' }).click();
  await expect(card).toHaveCount(0);
});

test('Today 展示统计，并在页面刷新后保持数据', async ({ page }) => {
  // Seed through the public UI so this test also proves IndexedDB persistence.
  await page.getByRole('link', { name: 'Plan' }).click();
  for (const [title, minutes] of [['高数习题', '40'], ['C 语言练习', '30']] as const) {
    await page.getByRole('button', { name: '新建任务' }).click();
    await page.getByLabel('任务标题').fill(title);
    await page.getByLabel('预计完成时长').fill(minutes);
    await page.getByLabel('截止日期').fill(localToday());
    await page.getByRole('button', { name: '保存' }).click();
  }
  const completedTodayCard = page.getByRole('article', { name: /C 语言练习/ });
  await completedTodayCard.getByRole('checkbox', { name: '标记完成' }).click();
  await expect(completedTodayCard).toHaveCount(0);
  await page.reload();
  await page.getByRole('link', { name: 'Today' }).click();

  await expect(page.getByTestId('planned-minutes')).toHaveText('70');
  await expect(page.getByTestId('completed-minutes')).toHaveText('30');
  await expect(page.getByTestId('remaining-minutes')).toHaveText('40');
  await expect(page.getByText('高数习题')).toBeVisible();
  await expect(page.getByText('C 语言练习')).toBeVisible();
});

test('分类限制提供明确错误反馈', async ({ page }) => {
  await page.getByRole('link', { name: 'Categories' }).click();
  await page.getByLabel('分类名称').fill('cs50');
  await page.getByRole('button', { name: '添加分类' }).click();
  await expect(page.getByRole('alert')).toContainText(/重复|已存在/);

  const cs50 = page.locator('article.category-row').filter({
    has: page.getByRole('heading', { name: 'CS50', exact: true }),
  });
  await expect(cs50).toContainText(/任务/);
});
