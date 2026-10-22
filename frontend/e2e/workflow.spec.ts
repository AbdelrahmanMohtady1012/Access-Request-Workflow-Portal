import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

async function signIn(page: Page, role: string) {
  await page.goto('/');
  await page.getByLabel('Work email').fill(`${role}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill(process.env.DEMO_PASSWORD || 'AccessDemo123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
}

async function reviewer(browser: Browser, role: string, id: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, role);
  await page.getByRole('link', { name: 'Pending approvals' }).click();
  await expect(page.locator(`a[href="/requests/${id}"]`).first()).toBeVisible();
  await page.locator(`a[href="/requests/${id}"]`).first().click();
  await expect(page.getByRole('heading', { name: 'Your review' })).toBeVisible();
  return { page, context };
}

test('request, manager approval, information round-trip, owner and security approval', async ({ page, browser }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await signIn(page, 'employee');
  await page.screenshot({ path: testInfo.outputPath('dashboard-desktop.png'), fullPage: true });
  await page.getByRole('link', { name: 'New access request', exact: true }).click();
  await page.getByRole('radio', { name: /Salesforce/ }).check();
  await page.getByLabel('Business justification').fill('I need Salesforce access to manage the Cairo enterprise customer accounts.');
  await page.getByRole('button', { name: 'Submit request', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Salesforce access' })).toBeVisible();
  const id = new URL(page.url()).pathname.split('/').pop()!;
  await expect(page.getByText('Currently with Omar Hassan', { exact: false })).toBeVisible();

  const manager = await reviewer(browser, 'manager', id);
  await manager.page.getByRole('button', { name: 'Submit decision' }).click();
  await expect(manager.page.getByText('Currently with Nour Ahmed', { exact: false })).toBeVisible();
  await manager.context.close();

  const owner = await reviewer(browser, 'owner', id);
  await owner.page.getByRole('radio', { name: 'Ask for information' }).check();
  await owner.page.getByLabel('Comment').fill('Which customer accounts will you manage?');
  await owner.page.getByRole('button', { name: 'Submit decision' }).click();
  await expect(owner.page.locator('.badge')).toHaveText('Needs information');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Additional information needed' })).toBeVisible();
  await page.getByLabel('Your response').fill('I manage the Cairo enterprise accounts for the commercial sales team.');
  await page.getByRole('button', { name: 'Send response' }).click();
  await expect(page.getByText('Currently with Nour Ahmed', { exact: false })).toBeVisible();

  await owner.page.reload();
  await owner.page.getByRole('button', { name: 'Submit decision' }).click();
  await expect(owner.page.getByText('Currently with Youssef Ali', { exact: false })).toBeVisible();
  await owner.context.close();

  const security = await reviewer(browser, 'security', id);
  await security.page.getByLabel('Comment').fill('Security checks completed.');
  await security.page.getByRole('button', { name: 'Submit decision' }).click();
  await expect(security.page.locator('.badge')).toHaveText('Approved');
  await security.context.close();

  await page.reload();
  await expect(page.locator('.badge')).toHaveText('Approved');
  await expect(page.locator('.history-list li')).toHaveCount(6);
  await expect(page.getByRole('button', { name: 'Submit decision' })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('request-approved.png'), fullPage: true });
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile navigation and filtered request list remain usable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, 'employee');
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath('dashboard-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'My requests', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My requests', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search requests' }).fill('no-such-application');
  await expect(page.getByRole('heading', { name: 'No requests to show' })).toBeVisible();
});
