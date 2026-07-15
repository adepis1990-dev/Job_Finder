import { test } from '@playwright/test';
test('Debug DDG', async ({ page }) => {
  await page.goto('https://duckduckgo.com/?q=Regina+Maria+Romania+contact+email+site', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  console.log('URL:', page.url());
  const links = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll('a').forEach(l => {
      if (l.href && l.href.startsWith('http') && !l.href.includes('duckduckgo')) {
        results.push(l.href + ' | ' + (l.innerText?.trim().slice(0, 50) || ''));
      }
    });
    return results.slice(0, 10);
  });
  console.log('LINKS:', JSON.stringify(links, null, 2));
});
