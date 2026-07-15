import { test } from '@playwright/test';

test('Debug BestJobs DOM', async ({ page }) => {
  await page.goto('https://www.bestjobs.eu/ro/locuri-de-munca?keyword=IT&location=Iasi', { waitUntil: 'networkidle' });
  
  // Accept cookies
  const cookieButton = page.locator('button:has-text("Acceptă"), button:has-text("Accept"), button[id*="cookie"]');
  try {
    await cookieButton.first().waitFor({ state: 'visible', timeout: 5000 });
    await cookieButton.first().click();
  } catch {}
  
  await page.waitForTimeout(3000);

  const url = page.url();
  console.log('URL final:', url);

  // Căutăm structura joburilor
  const jobStructure = await page.evaluate(() => {
    // Căutăm link-uri de tip job individual
    const links = document.querySelectorAll('a[href*="/ro/loc-de-munca"], a[href*="/job/"]');
    const results: string[] = [];
    links.forEach(l => {
      results.push((l as HTMLAnchorElement).href + ' || ' + ((l as HTMLElement).innerText?.trim().slice(0, 100) || 'no-text'));
    });
    
    // Dacă nu am găsit, încercăm alt patern
    if (results.length === 0) {
      const allA = document.querySelectorAll('a');
      allA.forEach(l => {
        const href = l.href;
        const text = l.innerText?.trim();
        if (text && text.length > 10 && href.includes('bestjobs') && !href.includes('login') && !href.includes('register')) {
          if (href.includes('loc-de-munca') || href.includes('job') || href.match(/\/\d{6,}/)) {
            results.push(href + ' || ' + text.slice(0, 100));
          }
        }
      });
    }
    
    return results.slice(0, 15);
  });
  
  console.log('JOB STRUCTURE:', JSON.stringify(jobStructure, null, 2));

  // Card classes
  const cardInfo = await page.evaluate(() => {
    const cards = document.querySelectorAll('[class*="card"], [class*="Card"], [class*="job"], [class*="Job"]');
    const info: string[] = [];
    cards.forEach(c => {
      const el = c as HTMLElement;
      info.push(`<${el.tagName} class="${el.className?.slice(0, 80)}"> text: ${el.innerText?.trim().slice(0, 80)}`);
    });
    return info.slice(0, 15);
  });
  console.log('CARD INFO:', JSON.stringify(cardInfo, null, 2));
});
