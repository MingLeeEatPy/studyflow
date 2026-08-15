import { expect, test } from '@playwright/test';

test('导出后可覆盖导入、自动安全备份并同步其他标签页', async ({ page, context }) => {
  await page.goto('/');
  const other = await context.newPage();
  await other.goto('/');
  await other.getByRole('link', { name: 'Categories' }).click();
  await expect(other.getByRole('heading', { name: '导入分类' })).toHaveCount(0);
  await page.getByRole('button', { name: '数据管理' }).click();

  const exportDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出全部数据' }).click();
  expect((await exportDownload).suggestedFilename()).toMatch(/^studyflow-backup-\d{4}-\d{2}-\d{2}\.json$/);

  await page.getByLabel('导入备份文件').setInputFiles({
    name: 'valid-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      format: 'studyflow-backup', version: 1, exportedAt: new Date().toISOString(),
      data: { categories: [{ id: 'imported', name: '导入分类', sortOrder: 0, archivedAt: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }], tasks: [], taskEvents: [] },
    })),
  });
  await expect(page.getByRole('dialog', { name: '覆盖导入' })).toContainText(/替换|覆盖/);

  const safetyDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '确认覆盖导入' }).click();
  await safetyDownload;
  await expect(page.getByRole('status')).toContainText('导入成功');
  await expect(other.getByRole('heading', { name: '导入分类' })).toBeVisible();
});

test('无效文件不触发确认，也不改变当前数据', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '数据管理' }).click();
  await page.getByLabel('导入备份文件').setInputFiles({
    name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"bad":true}'),
  });
  await expect(page.getByRole('alert')).toContainText(/无效|格式|版本/);
  await expect(page.getByRole('dialog', { name: '覆盖导入' })).toHaveCount(0);
});
