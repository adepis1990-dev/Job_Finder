import { test } from '@playwright/test';
import * as fs from 'fs';
import { ScraperConfig } from './config';
import { extractEmails } from './email_helpers';

interface JobData {
  sursa: 'ejobs';
  nume: string;
  titlu: string;
  locatie: string;
  link: string;
  emailuri: string[];
}

/**
 * eJobs scraper — click-based approach.
 * eJobs is a SPA so we click each job card and extract from detail page.
 *
 * Environment variables (optional):
 *   EJOBS_CATEGORY  - category slug (default: 'it-software')
 *   EJOBS_MAX       - max results (default: ScraperConfig.MAX_RESULTS)
 *   EJOBS_LOCATION  - location (default: 'iasi')
 */
test('Scrape eJobs', async ({ page, context }) => {
  const category = process.env.EJOBS_CATEGORY || 'it-software';
  const maxResults = parseInt(process.env.EJOBS_MAX || String(ScraperConfig.MAX_RESULTS), 10);
  const location = process.env.EJOBS_LOCATION || 'iasi';

  // Block mailto from opening Outlook
  await context.route('mailto:**', route => route.abort());
  await page.route('mailto:**', route => route.abort());

  const url = `https://www.ejobs.ro/locuri-de-munca/${category}/${location}`;
  console.log(`Navigam pe eJobs: ${url}`);
  console.log(`Categorie: ${category} | Locatie: ${location} | Max: ${maxResults}`);

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  // Remove cookie overlay
  await page.evaluate(() => {
    ['CybotCookiebotDialog', 'CybotCookiebotDialogBodyUnderlay', 'CybotCookiebotDialogOverlay'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    document.querySelectorAll('[class*="cookie" i], [class*="consent" i], [id*="cookie" i]').forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.position === 'fixed' || style.position === 'absolute') {
        (el as HTMLElement).remove();
      }
    });
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  });

  await page.waitForTimeout(2000);

  // Scroll down to trigger lazy loading
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);

  // Get the page text to parse job listings.
  // From the fetched page we know the format is:
  // "Job Title COMPANY NAME" repeated for each job.
  // We'll extract the full visible text and parse it with known company patterns.
  const pageContent = await page.locator('body').innerText();

  // eJobs page text (from our fetch) shows patterns like:
  // "Technicien support informatique Fr&En - Travail hybride Iasi SCC Services Romania"
  // "IT Contract Manager(244485) E.ON ENERGIE ROMÂNIA SA"
  // "Big Data Engineer QUARK TECHNOLOGIES SRL"
  // Company names are typically uppercase or end with SRL/SA/S.R.L.

  // Strategy: find all lines that look like job+company combos
  const lines = pageContent.split('\n').map(l => l.trim()).filter(l => l.length > 10 && l.length < 200);

  // Known company suffixes to detect where company name starts
  const companyPatterns = /\s+((?:[A-Z][A-Z\s.&\-]+(?:SRL|S\.R\.L\.|SA|S\.A\.|GMBH|ROMANIA|România))|(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+(?:\s+(?:Romania|Services|Solutions|Technologies|Worldwide|Software|Systems|Consulting|Corporation))))\s*$/;

  interface ParsedJob {
    titlu: string;
    companie: string;
  }

  const parsedJobs: ParsedJob[] = [];
  const seenTitles = new Set<string>();

  for (const line of lines) {
    // Try to match company at the end of line
    const match = line.match(companyPatterns);
    if (match) {
      const companie = match[1].trim();
      const titlu = line.slice(0, line.lastIndexOf(companie)).trim();
      if (titlu.length > 5 && !seenTitles.has(titlu)) {
        seenTitles.add(titlu);
        parsedJobs.push({ titlu, companie });
      }
    }
  }

  console.log(`\nParsed ${parsedJobs.length} joburi din text.`);

  // If regex parsing didn't find enough, try a simpler approach:
  // Look for lines that contain known company indicators
  if (parsedJobs.length < 3) {
    console.log('Regex a gasit prea putine, incercam matching simplu...');

    // Get all visible clickable job elements
    const jobCount = await page.locator('a[href*="locuri-de-munca"][href*="/"]').count();
    console.log(`Link-uri cu locuri-de-munca: ${jobCount}`);

    // Try to get text blocks that look like job cards
    const cardTexts = await page.evaluate(() => {
      const results: string[] = [];
      // Look for repeated structures
      const elements = document.querySelectorAll('div, li, article, section');
      for (const el of elements) {
        // Only direct children of lists/containers
        if (el.children.length > 10) {
          // This might be the job list container
          for (const child of el.children) {
            const text = child.textContent?.trim() || '';
            if (text.length > 15 && text.length < 300) {
              results.push(text.replace(/\s+/g, ' '));
            }
          }
          if (results.length > 3) break;
        }
      }
      return results;
    });

    console.log(`Card texts gasit: ${cardTexts.length}`);
    for (const ct of cardTexts.slice(0, 3)) {
      console.log(`  > ${ct.slice(0, 80)}...`);
    }

    // Parse card texts
    for (const text of cardTexts) {
      if (parsedJobs.length >= maxResults) break;
      // Try to split by known patterns
      const m = text.match(companyPatterns);
      if (m) {
        const companie = m[1].trim();
        const titlu = text.slice(0, text.lastIndexOf(companie)).trim();
        if (titlu.length > 5 && !seenTitles.has(titlu)) {
          seenTitles.add(titlu);
          parsedJobs.push({ titlu, companie });
        }
      } else if (text.length > 10 && !seenTitles.has(text.slice(0, 50))) {
        // Just use the whole text as title with unknown company
        seenTitles.add(text.slice(0, 50));
        parsedJobs.push({ titlu: text.slice(0, 120), companie: 'Necunoscut' });
      }
    }
  }

  console.log(`\nTotal parsate: ${parsedJobs.length} joburi.`);

  if (parsedJobs.length === 0) {
    console.log('Nu am gasit joburi. Salvam textul paginii pentru debug...');
    console.log('Primele 3000 chars:', pageContent.slice(0, 3000));
    fs.writeFileSync('rezultate_ejobs.json', JSON.stringify({ total: 0, sursa: 'ejobs', jobs: [] }, null, 2), 'utf-8');
    return;
  }

  const limit = Math.min(parsedJobs.length, maxResults);
  console.log(`\n--- Procesez ${limit} joburi. ---\n`);

  const jobs: JobData[] = [];
  const companyEmailCache = new Map<string, string[]>();

  // Single reusable page for email lookups
  const searchPage = await context.newPage();
  await searchPage.route('mailto:**', route => route.abort());

  for (let i = 0; i < limit; i++) {
    const { titlu, companie } = parsedJobs[i];
    console.log(`[${i + 1}] ${titlu.slice(0, 55)} @ ${companie}`);

    let emailuri: string[] = [];
    const cacheKey = companie.toLowerCase();

    if (cacheKey === 'necunoscut' || cacheKey.length < 3) {
      // Skip
    } else if (companyEmailCache.has(cacheKey)) {
      emailuri = companyEmailCache.get(cacheKey)!;
      console.log(`   📋 Cache: ${emailuri.join(', ') || 'nimic'}`);
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
            'econtact.ro', 'contacteaza.ro', 'mailto:'
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
          console.log(`   🌐 Scanez: ${companySite.slice(0, 55)}...`);
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

            // Try contact page
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
      sursa: 'ejobs',
      nume: companie,
      titlu: titlu.slice(0, 150),
      locatie: location.charAt(0).toUpperCase() + location.slice(1),
      link: '',
      emailuri: emailuri.length > 0 ? emailuri : ['Nu s-a gasit'],
    });
    console.log(`   💾 Email-uri: ${jobs[jobs.length-1].emailuri.join(', ')}`);
  }

  await searchPage.close();

  // Save
  const output = { total: jobs.length, sursa: 'ejobs', jobs };
  fs.writeFileSync('rezultate_ejobs.json', JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\n✅ Gata eJobs! ${jobs.length} joburi salvate.`);
});
