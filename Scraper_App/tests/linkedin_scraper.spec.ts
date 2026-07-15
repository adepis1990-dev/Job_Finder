import { test } from '@playwright/test';
import * as fs from 'fs';
import { ScraperConfig } from './config';
import { scrapeCompanyEmails } from './email_helpers';

interface JobData {
  sursa: 'linkedin';
  titlu: string;
  companie: string;
  locatie: string;
  link: string;
  tip_job: string;
  emailuri: string[];
}

test('Scrape LinkedIn Jobs IT Iasi', async ({ page, context }) => {
  // Block mailto links from opening Outlook
  await context.route('mailto:**', route => route.abort());
  await page.route('mailto:**', route => route.abort());

  console.log('Navigăm pe LinkedIn Jobs (public)...');

  const searchUrl = 'https://www.linkedin.com/jobs/search/?keywords=IT&location=Iasi%2C%20Romania&trk=public_jobs_jobs-search-bar_search-submit';
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

  try {
    await page.waitForSelector('.jobs-search__results-list, .base-search-card', { timeout: 15000 });
  } catch {
    console.log('Încercăm varianta alternativă de selector...');
    await page.waitForTimeout(5000);
  }

  console.log('Pagina s-a încărcat. Extragem joburile...');

  // Scroll pentru a încărca mai multe rezultate
  for (let s = 0; s < 3; s++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
  }

  const jobCards = page.locator('.base-card, .base-search-card, li[class*="jobs-search"]');
  const totalJobs = await jobCards.count();

  console.log(`\n--- Am detectat ${totalJobs} joburi pe LinkedIn. Limită: ${ScraperConfig.MAX_RESULTS}. ---\n`);

  const jobs: JobData[] = [];
  const limit = Math.min(totalJobs, ScraperConfig.MAX_RESULTS);

  // Prima fază: colectăm datele de bază
  interface BasicJob {
    titlu: string;
    companie: string;
    locatie: string;
    link: string;
    tip_job: string;
    companyUrl: string;
  }
  const basicJobs: BasicJob[] = [];

  for (let i = 0; i < limit; i++) {
    try {
      const card = jobCards.nth(i);

      const titleEl = card.locator('h3, .base-search-card__title, [class*="title"]').first();
      const titlu = ((await titleEl.innerText().catch(() => '')) || '').trim();
      if (!titlu) continue;

      const companyEl = card.locator('h4, .base-search-card__subtitle, [class*="company"], a[class*="company"]').first();
      const companie = ((await companyEl.innerText().catch(() => '')) || 'Necunoscut').trim();

      const locationEl = card.locator('.job-search-card__location, [class*="location"], span[class*="bullet"]').first();
      const locatie = ((await locationEl.innerText().catch(() => '')) || 'Iași').trim();

      const linkEl = card.locator('a[href*="/jobs/"]').first();
      const link = (await linkEl.getAttribute('href').catch(() => '')) || '';

      // Încercăm să luăm URL-ul companiei de pe LinkedIn
      const companyLinkEl = card.locator('a[href*="/company/"]').first();
      const companyUrl = (await companyLinkEl.getAttribute('href').catch(() => '')) || '';

      const typeEl = card.locator('[class*="employment"], [class*="type"], .job-search-card__listdate').first();
      const tip_job = ((await typeEl.innerText().catch(() => '')) || '').trim();

      basicJobs.push({
        titlu,
        companie,
        locatie,
        link: link.startsWith('http') ? link.split('?')[0] : `https://www.linkedin.com${link.split('?')[0]}`,
        tip_job: tip_job || 'Nespecificat',
        companyUrl
      });

      console.log(`[${basicJobs.length}] ${titlu} @ ${companie}`);
    } catch {
      // Skip card invalid
    }
  }

  // A doua fază: scanăm site-urile companiilor pentru email
  console.log(`\n--- Faza 2: Extragere email-uri pentru ${basicJobs.length} companii... ---\n`);

  const companyEmailCache = new Map<string, string[]>();

  for (const bj of basicJobs) {
    let emailuri: string[] = [];
    const cacheKey = bj.companie.toLowerCase();

    if (companyEmailCache.has(cacheKey)) {
      emailuri = companyEmailCache.get(cacheKey)!;
      console.log(`   📋 Cache hit pentru ${bj.companie}: ${emailuri.join(', ') || 'nimic'}`);
    } else {
      // Căutăm site-ul companiei pe DuckDuckGo (nu blochează ca Google)
      try {
        const searchPage = await page.context().newPage();
        const query = encodeURIComponent(`${bj.companie} Romania contact email site`);
        await searchPage.goto(`https://duckduckgo.com/?q=${query}`, { timeout: 12000, waitUntil: 'domcontentloaded' });
        await searchPage.waitForTimeout(4000);

        const companySite = await searchPage.evaluate(() => {
          const links = document.querySelectorAll('a[href*="://"]');
          const excludePatterns = [
            'duckduckgo.', 'google.', 'facebook.', 'youtube.', 'twitter.',
            'instagram.', 'linkedin.', 'tiktok.', 'wikipedia.',
            'bestjobs.', 'ejobs.', 'glassdoor.', 'indeed.', 'firme.info', 'econtact.ro', 'contacteaza.ro'
          ];
          for (const l of links) {
            const href = (l as HTMLAnchorElement).href;
            if (!href || !href.startsWith('http')) continue;
            if (excludePatterns.some(p => href.toLowerCase().includes(p))) continue;
            return href;
          }
          return null;
        });

        await searchPage.close();

        if (companySite) {
          console.log(`   🌐 Scanez site ${bj.companie}: ${companySite.slice(0, 60)}...`);
          emailuri = await scrapeCompanyEmails(page.context(), companySite);
        }
      } catch {
        // Eroare la căutare
      }

      emailuri = [...new Set(emailuri.map(e => e.toLowerCase()))];
      companyEmailCache.set(cacheKey, emailuri);
    }

    const job: JobData = {
      sursa: 'linkedin',
      titlu: bj.titlu,
      companie: bj.companie,
      locatie: bj.locatie,
      link: bj.link,
      tip_job: bj.tip_job,
      emailuri: emailuri.length > 0 ? emailuri : ['Nu s-a găsit']
    };

    jobs.push(job);
    console.log(`   💾 ${bj.titlu} | Email-uri: ${job.emailuri.join(', ')}`);
  }

  // Salvăm rezultatele
  const output = { total: jobs.length, sursa: 'linkedin', jobs };
  fs.writeFileSync('rezultate_linkedin.json', JSON.stringify(output, null, 2), 'utf-8');

  console.log(`\n✅ Gata LinkedIn! ${jobs.length} joburi salvate în "rezultate_linkedin.json".`);
});
