import { test } from '@playwright/test';
import * as fs from 'fs';
import { ScraperConfig } from './config';
import { extractEmails } from './email_helpers';

interface JobData {
  sursa: 'hipo';
  nume: string;
  titlu: string;
  locatie: string;
  link: string;
  emailuri: string[];
}

/**
 * hipo.ro scraper.
 * Only extracts actual job listings (URLs matching /locuri_de_munca/locuri_de_munca/ID/COMPANY/TITLE).
 *
 * Environment variables (optional):
 *   HIPO_CATEGORY  - category (default: 'IT Software')
 *   HIPO_MAX       - max results (default: ScraperConfig.MAX_RESULTS)
 *   HIPO_LOCATION  - city (default: 'Iasi')
 */
test('Scrape Hipo.ro', async ({ page, context }) => {
  const category = process.env.HIPO_CATEGORY || 'IT Software';
  const maxResults = parseInt(process.env.HIPO_MAX || String(ScraperConfig.MAX_RESULTS), 10);
  const location = process.env.HIPO_LOCATION || 'Iasi';

  // Block mailto from opening Outlook
  await context.route('mailto:**', route => route.abort());
  await page.route('mailto:**', route => route.abort());

  const encodedCategory = encodeURIComponent(category);
  const encodedLocation = encodeURIComponent(location);
  const keywords = process.env.SCRAPER_KEYWORDS || process.env.HIPO_KEYWORDS || '';

  // If keywords provided, use them as category search term
  const searchCategory = keywords || category;
  const url = `https://www.hipo.ro/locuri-de-munca/cautajob/${encodeURIComponent(searchCategory)}/${encodedLocation}`;
  console.log(`Navigam pe Hipo.ro: ${url}`);
  console.log(`Categorie: ${searchCategory} | Locatie: ${location} | Max: ${maxResults} | Keywords: ${keywords || '(none)'}`);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

  // Handle cookies if present
  try {
    const cookieBtn = page.locator('button:has-text("Acceptă"), button:has-text("Accept"), [class*="cookie"] button');
    await cookieBtn.first().click({ timeout: 3000 });
    console.log('Cookies accepted.');
  } catch {
    // No cookies popup
  }

  // Wait for page content to load
  await page.waitForTimeout(4000);

  // Scroll to load all content
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);

  console.log('Page loaded. Extracting jobs...');

  // Extract ONLY real job links.
  // Real job URLs on hipo.ro look like:
  // /locuri-de-munca/locuri_de_munca/269700/COMPANY-NAME/Job-Title-Slug
  // Pattern: /locuri_de_munca/ followed by a numeric ID, then company slug, then job title slug
  const rawJobs = await page.evaluate(() => {
    const jobs: Array<{ titlu: string; companie: string; link: string }> = [];
    const seenLinks = new Set<string>();

    const allLinks = document.querySelectorAll('a[href*="/locuri_de_munca/"]');

    for (const a of allLinks) {
      const href = (a as HTMLAnchorElement).href || '';
      if (!href) continue;

      // Only match real job detail URLs: /locuri-de-munca/locuri_de_munca/DIGITS/Company/Title
      const match = href.match(/\/locuri_de_munca\/(\d{4,})\/([^/]+)\/([^/]+)/);
      if (!match) continue;

      if (seenLinks.has(href)) continue;
      seenLinks.add(href);

      const companySlug = match[2]; // e.g. "SCHAEFFLER" or "Hipo-Job-Finder"
      const titleSlug = match[3];   // e.g. "Polarion-Software-Developer"

      // Convert slugs to readable names
      const companie = decodeURIComponent(companySlug).replace(/-/g, ' ').trim();
      const titlu = decodeURIComponent(titleSlug).replace(/-/g, ' ').replace(/,/g, ', ').trim();

      if (!titlu || titlu.length < 3) continue;

      jobs.push({ titlu, companie, link: href });
    }

    return jobs;
  });

  console.log(`Found ${rawJobs.length} actual job links.`);

  if (rawJobs.length === 0) {
    console.log('No jobs found. Saving empty result.');
    fs.writeFileSync('rezultate_hipo.json', JSON.stringify({ total: 0, sursa: 'hipo', jobs: [] }, null, 2), 'utf-8');
    return;
  }

  // Show preview
  for (let i = 0; i < Math.min(rawJobs.length, 5); i++) {
    console.log(`  [${i+1}] ${rawJobs[i].titlu.slice(0, 50)} @ ${rawJobs[i].companie}`);
  }

  const limit = Math.min(rawJobs.length, maxResults);
  console.log(`\n--- Processing ${limit} jobs (from ${rawJobs.length} found). ---\n`);

  const jobs: JobData[] = [];
  const companyEmailCache = new Map<string, string[]>();

  // Single reusable page for email lookups
  const searchPage = await context.newPage();
  await searchPage.route('mailto:**', route => route.abort());

  for (let i = 0; i < limit; i++) {
    const raw = rawJobs[i];
    let companie = raw.companie;

    // Skip generic "Hipo Job Finder" company — it's a recruiter proxy
    const isProxy = companie.toLowerCase().includes('hipo job finder');

    // For proxy listings, try to extract real company from the title
    // e.g. "Senior Fullstack Engineer   Levi9" -> company is "Levi9"
    if (isProxy) {
      const titleParts = raw.titlu.split(/\s{2,}|\s+[-–—]\s+/);
      if (titleParts.length > 1) {
        companie = titleParts[titleParts.length - 1].trim();
      } else {
        companie = 'Unknown';
      }
    }

    console.log(`[${i + 1}] ${raw.titlu.slice(0, 55)} @ ${companie}`);

    let emailuri: string[] = [];
    const cacheKey = companie.toLowerCase();

    if (cacheKey === 'unknown' || cacheKey.length < 3) {
      // Skip
    } else if (companyEmailCache.has(cacheKey)) {
      emailuri = companyEmailCache.get(cacheKey)!;
      console.log(`   📋 Cache: ${emailuri.join(', ') || 'nothing'}`);
    } else {
      try {
        const query = encodeURIComponent(`${companie} Romania contact email`);
        await searchPage.goto(`https://duckduckgo.com/?q=${query}`, {
          timeout: 12000, waitUntil: 'domcontentloaded',
        });
        await searchPage.waitForTimeout(3000);

        const companySite = await searchPage.evaluate(() => {
          const links = document.querySelectorAll('a[href*="://"]');
          const exclude = [
            'duckduckgo.', 'google.', 'facebook.', 'youtube.', 'twitter.',
            'instagram.', 'linkedin.', 'tiktok.', 'wikipedia.',
            'bestjobs.', 'ejobs.', 'glassdoor.', 'indeed.', 'firme.info',
            'econtact.ro', 'contacteaza.ro', 'hipo.ro', 'mailto:'
          ];
          for (const l of links) {
            const href = (l as HTMLAnchorElement).href;
            if (!href || !href.startsWith('http')) continue;
            if (exclude.some(p => href.toLowerCase().includes(p))) continue;
            return href;
          }
          return null;
        });

        if (companySite) {
          console.log(`   🌐 Scanning: ${companySite.slice(0, 55)}...`);
          try {
            await searchPage.goto(companySite, { timeout: 10000, waitUntil: 'domcontentloaded' });
            await searchPage.waitForTimeout(1500);

            // mailto links
            const mailtos = await searchPage.locator('a[href^="mailto:"]').all();
            for (const m of mailtos) {
              const href = await m.getAttribute('href');
              if (href) {
                const email = href.replace('mailto:', '').split('?')[0].trim();
                if (email.includes('@')) emailuri.push(email);
              }
            }
            // Text emails
            const bodyText = await searchPage.locator('body').innerText();
            emailuri.push(...extractEmails(bodyText));

            // Try contact page if no emails found
            if (emailuri.length === 0) {
              const contactLink = searchPage.locator('a[href*="contact"]').first();
              if (await contactLink.count() > 0) {
                const contactHref = await contactLink.getAttribute('href');
                if (contactHref) {
                  const contactUrl = contactHref.startsWith('http')
                    ? contactHref : new URL(contactHref, companySite).href;
                  await searchPage.goto(contactUrl, { timeout: 8000, waitUntil: 'domcontentloaded' });
                  await searchPage.waitForTimeout(1500);
                  const cm = await searchPage.locator('a[href^="mailto:"]').all();
                  for (const m of cm) {
                    const href = await m.getAttribute('href');
                    if (href) {
                      const email = href.replace('mailto:', '').split('?')[0].trim();
                      if (email.includes('@')) emailuri.push(email);
                    }
                  }
                  const ct = await searchPage.locator('body').innerText();
                  emailuri.push(...extractEmails(ct));
                }
              }
            }
          } catch { /* site failed */ }
        }
      } catch { /* search failed */ }

      emailuri = [...new Set(emailuri.map(e => e.toLowerCase()))];
      companyEmailCache.set(cacheKey, emailuri);
    }

    jobs.push({
      sursa: 'hipo',
      nume: companie,
      titlu: raw.titlu.slice(0, 150),
      locatie: location,
      link: raw.link,
      emailuri: emailuri.length > 0 ? emailuri : ['Nu s-a gasit'],
    });
    console.log(`   💾 Emails: ${jobs[jobs.length-1].emailuri.join(', ')}`);
  }

  await searchPage.close();

  // Save
  const output = { total: jobs.length, sursa: 'hipo', jobs };
  fs.writeFileSync('rezultate_hipo.json', JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\n✅ Done Hipo.ro! ${jobs.length} jobs saved to "rezultate_hipo.json".`);
});
