const { test, expect } = require('@playwright/test');

test.describe('public smoke', () => {
  test('homepage renders core launch surfaces', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/holler\.works/i);
    await expect(page.getByText('moderated tech jobs for appalachia')).toBeVisible();
    await expect(page.getByText('daily job alerts')).toBeVisible();
    await expect(page.getByPlaceholder('search posts...')).toBeVisible();
    await expect(page.getByText('how the board is run')).toBeHidden();
  });

  test('about page explains board operations', async ({ page }) => {
    await page.goto('/about');

    await expect(page.getByRole('heading', { name: '[about]' })).toBeVisible();
    await expect(page.getByText('how the board is run')).toBeVisible();
    await expect(page.getByText('approved posts expire after 28 days')).toBeVisible();
  });

  test('submit page shows moderation and verification controls', async ({ page }) => {
    await page.goto('/submit');

    await expect(page.getByRole('heading', { name: '// submit a post' })).toBeVisible();
    await expect(page.getByText('Approved posts expire after 28 days unless refreshed.')).toBeVisible();
    await expect(page.getByText('Post a tech or tech-adjacent job tied to Appalachia.')).toBeVisible();
    await expect(page.locator('#turnstileWidget')).toBeVisible();
    await expect(page.locator('#turnstileStatus')).toBeVisible();
    await expect(page.getByText('If no prompt appears, verification may complete automatically.')).toBeVisible();
    await expect(page.getByLabel('company website *')).toBeVisible();
    await expect(page.getByText('need a job')).toHaveCount(0);
  });

  test('core endpoints and blocked files behave correctly', async ({ request }) => {
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    expect(sitemap.headers()['content-type']).toContain('xml');

    const invalidUnsub = await request.get('/alerts/unsubscribe?token=invalid-token');
    expect(invalidUnsub.status()).toBe(404);
    await expect(await invalidUnsub.text()).toContain('alert not found');

    const missingPost = await request.get('/post/not-a-real-post-id');
    expect(missingPost.status()).toBe(404);
    await expect(await missingPost.text()).toContain('post not found');

    for (const blockedPath of ['/functions/index.js', '/docs/launch-copy-draft.md', '/firebase.json']) {
      const blocked = await request.get(blockedPath);
      expect(blocked.status()).toBe(404);
    }
  });

  test('analytics endpoint accepts known events and rejects bad ones', async ({ request }) => {
    const ok = await request.post('/analytics/track', {
      data: { eventName: 'board_view' },
    });
    expect(ok.status()).toBe(204);

    const bad = await request.post('/analytics/track', {
      data: { eventName: 'not_real' },
    });
    expect(bad.status()).toBe(400);
  });
});

test.describe('admin smoke', () => {
  test('admin login screen renders', async ({ page }) => {
    await page.goto('/admin');

    await expect(page.getByRole('heading', { name: '// admin' })).toBeVisible();
    await expect(page.getByText('enter your admin email and we will send a one-time sign-in link.')).toBeVisible();
  });

  test('admin login screen exposes magic-link controls', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByPlaceholder('you@company.com')).toBeVisible();
    await expect(page.getByRole('button', { name: 'send sign-in link' })).toBeVisible();
    await expect(page.getByText('Links expire after 15 minutes and only work once.')).toBeVisible();
  });
});
