import { expect, test } from '@playwright/test';

test('PWA publishes an install manifest and reloads its cached app offline', async ({ page, context }) => {
  await page.goto('/');

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();
  const manifest = await page.evaluate(async (href) => (await fetch(href!)).json(), manifestHref);
  expect(manifest).toMatchObject({ short_name: 'StudyFlow', display: 'standalone', theme_color: '#355d3e' });

  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('StudyFlow', { exact: true })).toBeVisible();
  await context.setOffline(false);
});
