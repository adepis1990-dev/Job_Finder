import { Page } from '@playwright/test';

/**
 * Extrage toate email-urile unice dintr-un text.
 * Filtrează fals-pozitivele (imagini, fișiere, placeholder-uri).
 */
export function extractEmails(text: string): string[] {
  const emailRegex = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
  const matches = text.match(emailRegex) || [];
  const filtered = matches.filter(email => {
    const lower = email.toLowerCase();
    if (/\.(png|jpg|jpeg|gif|svg|webp|css|js|map|woff|ttf|ico)$/i.test(lower)) return false;
    if (lower.includes('example.com') || lower.includes('sentry') || lower.includes('webpack')) return false;
    if (lower.includes('noreply') || lower.includes('no-reply')) return false;
    return true;
  });
  return [...new Set(filtered)];
}

/**
 * Scanează o pagină web pentru email-uri (mailto + text).
 */
export async function scrapeEmailsFromPage(pageInstance: Page, url: string, timeout = 10000): Promise<string[]> {
  try {
    await pageInstance.goto(url, { timeout, waitUntil: 'domcontentloaded' });
    await pageInstance.waitForTimeout(1500);

    const mailtoEmails: string[] = [];
    const mailtoLinks = pageInstance.locator('a[href^="mailto:"]');
    const mailtoCount = await mailtoLinks.count();
    for (let m = 0; m < mailtoCount; m++) {
      const href = await mailtoLinks.nth(m).getAttribute('href');
      if (href) {
        const email = href.replace('mailto:', '').split('?')[0].trim();
        if (email.includes('@')) mailtoEmails.push(email);
      }
    }

    const bodyText = await pageInstance.locator('body').innerText();
    const textEmails = extractEmails(bodyText);

    return [...new Set([...mailtoEmails, ...textEmails])];
  } catch {
    return [];
  }
}

/**
 * Scanează site-ul unei companii pe toate paginile relevante (contact, careers, etc.)
 * și returnează toate email-urile unice găsite.
 */
export async function scrapeCompanyEmails(context: { newPage: () => Promise<Page> }, website: string): Promise<string[]> {
  const allEmails: string[] = [];
  const newPage = await context.newPage();

  try {
    // Pagina principală
    const homeEmails = await scrapeEmailsFromPage(newPage, website);
    allEmails.push(...homeEmails);

    // Căutăm link-uri relevante (contact, careers, about, etc.)
    const relevantLinks = newPage.locator([
      'a[href*="contact"]',
      'a[href*="career"]',
      'a[href*="carier"]',
      'a[href*="jobs"]',
      'a[href*="recrutare"]',
      'a[href*="about"]',
      'a[href*="despre"]',
      'a[href*="echipa"]',
      'a[href*="team"]',
      'a[href*="join"]',
      'a[href*="aplica"]',
      'a[href*="cv"]',
      'a[href*="hire"]',
    ].join(', '));

    const linkCount = await relevantLinks.count();
    const visitedUrls = new Set<string>([website]);
    const maxPages = Math.min(linkCount, 5);

    for (let l = 0; l < maxPages; l++) {
      try {
        const href = await relevantLinks.nth(l).getAttribute('href');
        if (!href || href === '#' || href.startsWith('javascript:')) continue;

        const fullUrl = href.startsWith('http') ? href : new URL(href, website).href;
        if (visitedUrls.has(fullUrl)) continue;
        visitedUrls.add(fullUrl);

        const subEmails = await scrapeEmailsFromPage(newPage, fullUrl);
        allEmails.push(...subEmails);
      } catch {
        // Link invalid
      }
    }
  } catch {
    // Site-ul nu a răspuns
  }

  await newPage.close();
  return [...new Set(allEmails.map(e => e.toLowerCase()))];
}
