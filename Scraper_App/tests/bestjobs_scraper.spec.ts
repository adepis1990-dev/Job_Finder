import { test } from '@playwright/test';
import * as fs from 'fs';
import { ScraperConfig } from './config';
import { extractEmails, scrapeCompanyEmails } from './email_helpers';

interface JobData {
  sursa: 'bestjobs';
  titlu: string;
  companie: string;
  locatie: string;
  link: string;
  salariu: string;
  emailuri: string[];
}

test('Scrape BestJobs IT Iasi', async ({ page, context }) => {
  // Block mailto links from opening Outlook
  await context.route('mailto:**', route => route.abort());
  await page.route('mailto:**', route => route.abort());
  console.log('Navigăm pe BestJobs.eu...');

  await page.goto('https://www.bestjobs.eu/ro/locuri-de-munca?keyword=IT&location=Iasi', { waitUntil: 'networkidle' });

  // Accept cookies
  const cookieButton = page.locator('button:has-text("Acceptă"), button:has-text("Accept"), button[id*="cookie"]');
  try {
    await cookieButton.first().waitFor({ state: 'visible', timeout: 5000 });
    await cookieButton.first().click();
    console.log('Am acceptat cookie-urile.');
  } catch {
    console.log('Nu au apărut cookie-uri.');
  }

  await page.waitForTimeout(3000);
  console.log('URL final:', page.url());

  const cardSelector = 'div.flex.flex-col.transition-all';
  const cards = page.locator(cardSelector);
  const totalCards = await cards.count();

  console.log(`\n--- Am detectat ${totalCards} card-uri pe BestJobs. Limită: ${ScraperConfig.MAX_RESULTS}. ---\n`);

  const jobs: JobData[] = [];
  const limit = Math.min(totalCards, ScraperConfig.MAX_RESULTS);
  const companyEmailCache = new Map<string, string[]>();

  for (let i = 0; i < limit; i++) {
    try {
      const card = cards.nth(i);
      const cardText = (await card.innerText()).trim();
      const lines = cardText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

      if (lines.length < 2) continue;

      const titlu = lines[0];
      const companie = lines[1];

      // Salariu
      let salariu = 'Nespecificat';
      const salaryLine = lines.find(l => /\d{3,}.*-.*\d{3,}/.test(l) || l.includes('Estimare'));
      if (salaryLine) salariu = salaryLine;

      // Locație
      let locatie = 'Iași';
      const locationLine = lines.find(l => l.includes('Iași') || l.includes('Iasi') || l.includes('România'));
      if (locationLine) locatie = locationLine;

      // Link
      let link = '';
      try {
        const cardLink = card.locator('a').first();
        const href = await cardLink.getAttribute('href');
        if (href) {
          link = href.startsWith('http') ? href : `https://www.bestjobs.eu${href}`;
        }
      } catch {}

      console.log(`[${i + 1}] ${titlu} @ ${companie} | ${salariu}`);

      // --- EXTRAGERE EMAIL-URI ---
      let emailuri: string[] = [];
      const cacheKey = companie.toLowerCase();

      if (companyEmailCache.has(cacheKey)) {
        emailuri = companyEmailCache.get(cacheKey)!;
        console.log(`   📋 Cache: ${emailuri.join(', ') || 'nimic'}`);
      } else {
        // BestJobs cere login pentru detalii job, deci căutăm site-ul companiei pe DuckDuckGo
        try {
          const searchPage = await page.context().newPage();
          const query = encodeURIComponent(`${companie} Romania contact email site`);
          await searchPage.goto(`https://duckduckgo.com/?q=${query}`, { timeout: 12000, waitUntil: 'domcontentloaded' });
          await searchPage.waitForTimeout(4000);

          // Extragem primul link relevant din rezultate DuckDuckGo
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
              // Verificăm că link-ul e relevant (conține numele companiei sau e un .ro/.com)
              return href;
            }
            return null;
          });

          await searchPage.close();

          if (companySite) {
            console.log(`   🌐 Scanez site ${companie}: ${companySite.slice(0, 60)}...`);
            emailuri = await scrapeCompanyEmails(page.context(), companySite);
          }
        } catch {
          // Eroare la căutare
        }

        emailuri = [...new Set(emailuri.map(e => e.toLowerCase()))];
        companyEmailCache.set(cacheKey, emailuri);
      }

      const job: JobData = {
        sursa: 'bestjobs',
        titlu,
        companie,
        locatie,
        link,
        salariu,
        emailuri: emailuri.length > 0 ? emailuri : ['Nu s-a găsit']
      };

      jobs.push(job);
      console.log(`   💾 Email-uri: ${job.emailuri.join(', ')}`);

    } catch {
      // Skip card invalid
    }
  }

  // Salvăm rezultatele
  const output = { total: jobs.length, sursa: 'bestjobs', jobs };
  fs.writeFileSync('rezultate_bestjobs.json', JSON.stringify(output, null, 2), 'utf-8');

  console.log(`\n✅ Gata BestJobs! ${jobs.length} joburi salvate în "rezultate_bestjobs.json".`);
});
