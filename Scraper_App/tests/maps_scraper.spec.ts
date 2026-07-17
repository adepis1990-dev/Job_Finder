import { test } from '@playwright/test';
import * as fs from 'fs';
import { Page } from '@playwright/test';
import { ScraperConfig } from './config';

interface FirmaData {
  sursa: 'google_maps';
  nume: string;
  site: string;
  telefon: string;
  emailuri: string[];
}

// Funcție helper: extrage toate email-urile unice dintr-un text
function extractEmails(text: string): string[] {
  const emailRegex = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
  const matches = text.match(emailRegex) || [];
  // Filtrăm email-uri false (imagini, fișiere, etc.)
  const filtered = matches.filter(email => {
    const lower = email.toLowerCase();
    // Excludem extensii de fișiere/imagini
    if (/\.(png|jpg|jpeg|gif|svg|webp|css|js|map|woff|ttf)$/i.test(lower)) return false;
    // Excludem placeholder-uri evidente
    if (lower.includes('example.com') || lower.includes('sentry')) return false;
    return true;
  });
  return [...new Set(filtered)]; // unique
}

// Funcție helper: scanează o pagină web pentru email-uri
async function scrapeEmailsFromPage(pageInstance: Page, url: string, timeout = 10000): Promise<string[]> {
  try {
    await pageInstance.goto(url, { timeout, waitUntil: 'domcontentloaded' });
    await pageInstance.waitForTimeout(1500);

    // Colectăm din href-uri mailto:
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

    // Colectăm din textul paginii
    const bodyText = await pageInstance.locator('body').innerText();
    const textEmails = extractEmails(bodyText);

    return [...new Set([...mailtoEmails, ...textEmails])];
  } catch {
    return [];
  }
}

test('Scrape stabil Google Maps Iasi', async ({ page, context }) => {
  // Block mailto links from opening Outlook
  await context.route('mailto:**', route => route.abort());
  await page.route('mailto:**', route => route.abort());

  console.log('Navigăm pe Google Maps...');
  await page.goto('https://www.google.com/maps');

  // 1. Trecem de cookie-uri dacă apar
  const acceptButton = page.locator('button:has-text("Acceptă tot"), button:has-text("Agree"), button:has-text("Accept all")');
  try {
    await acceptButton.first().waitFor({ state: 'visible', timeout: 5000 });
    await acceptButton.first().click();
    console.log('Am acceptat cookie-urile.');
  } catch {
    console.log('Nu au apărut cookie-uri, continuăm.');
  }

  // 2. Căutare
  const keywords = process.env.SCRAPER_KEYWORDS || process.env.SCRAPER_CATEGORY || 'IT';
  const location = process.env.SCRAPER_LOCATION || 'Iasi';
  const searchQuery = `Firme ${keywords} ${location}`;
  const searchBox = page.getByRole('combobox', { name: /Caută pe Google Maps|Search Google Maps/i });
  await searchBox.waitFor({ state: 'visible', timeout: 10000 });
  await searchBox.fill(searchQuery);
  await page.keyboard.press('Enter');
  console.log(`Cautam: "${searchQuery}"`);

  console.log('Așteptăm încărcarea rezultatelor...');
  await page.waitForSelector('div[role="feed"]', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // 3. Colectăm datele într-un array
  const firme: FirmaData[] = [];

  const feedContainer = page.locator('div[role="feed"]');
  const resultLinks = feedContainer.locator('a.hfpxzc');
  const totalFirme = await resultLinks.count();

  console.log(`\n--- Am detectat ${totalFirme} firme în listă. Limită: ${ScraperConfig.MAX_RESULTS}. ---\n`);

  const limit = Math.min(totalFirme, ScraperConfig.MAX_RESULTS);
  for (let i = 0; i < limit; i++) {
    try {
      const currentLink = page.locator('div[role="feed"] a.hfpxzc').nth(i);

      const name = ((await currentLink.getAttribute('aria-label')) || `Firma ${i + 1}`).replace(/,/g, '').trim();
      console.log(`[${i + 1}/${totalFirme}] Procesez: ${name}`);

      await currentLink.scrollIntoViewIfNeeded();
      await currentLink.click();

      // Așteptăm ca panoul de detalii să se actualizeze cu firma corectă
      try {
        const shortName = name.split(' ').slice(0, 2).join(' ');
        await page.locator('h1.DUwDvf').filter({ hasText: shortName }).waitFor({ state: 'visible', timeout: 8000 });
      } catch {
        try {
          await page.locator('h1.DUwDvf').first().waitFor({ state: 'visible', timeout: 4000 });
        } catch { /* ignorăm */ }
        await page.waitForTimeout(2000);
      }

      // --- EXTRAGERE SITE WEB ---
      const websiteElement = page.locator('a[data-item-id="authority"]');
      let website = '';
      try {
        await websiteElement.first().waitFor({ state: 'attached', timeout: 3000 });
        const rawUrl = await websiteElement.first().getAttribute('href');
        if (rawUrl) website = rawUrl;
      } catch {
        // Nu are site
      }

      // --- EXTRAGERE TELEFON ---
      const phoneElement = page.locator('[data-item-id^="phone:tel:"]');
      let phone = '';
      try {
        await phoneElement.first().waitFor({ state: 'attached', timeout: 3000 });
        const dataId = await phoneElement.first().getAttribute('data-item-id');
        if (dataId) {
          phone = dataId.replace('phone:tel:', '');
        }
      } catch {
        // Nu are telefon
      }

      // --- EXTRAGERE EMAIL-URI (toate sursele posibile) ---
      let allEmails: string[] = [];

      // Sursa 1: Google Maps - link-uri mailto: din panoul de detalii
      const mailtoLinks = page.locator('a[href^="mailto:"]');
      try {
        await mailtoLinks.first().waitFor({ state: 'attached', timeout: 2000 });
        const mailtoCount = await mailtoLinks.count();
        for (let m = 0; m < mailtoCount; m++) {
          const href = await mailtoLinks.nth(m).getAttribute('href');
          if (href) {
            const email = href.replace('mailto:', '').split('?')[0].trim();
            if (email.includes('@')) allEmails.push(email);
          }
        }
      } catch {
        // Nu sunt link-uri mailto
      }

      // Sursa 2: Google Maps - text din panoul de detalii
      try {
        const panelText = await page.locator('[role="main"]').first().innerText();
        allEmails.push(...extractEmails(panelText));
      } catch {
        // Nu am putut citi panoul
      }

      // Sursa 3: Vizităm site-ul firmei — scanăm TOATE paginile relevante
      if (website) {
        const newPage = await page.context().newPage();
        try {
          // 3a. Pagina principală
          console.log(`      🌐 Scanez site-ul: ${website}`);
          const homeEmails = await scrapeEmailsFromPage(newPage, website);
          allEmails.push(...homeEmails);

          // 3b. Căutăm link-uri spre pagini de contact/careers/jobs/about
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

          // Vizităm maxim 5 pagini relevante
          const maxPages = Math.min(linkCount, 5);
          for (let l = 0; l < maxPages; l++) {
            try {
              const href = await relevantLinks.nth(l).getAttribute('href');
              if (!href || href === '#' || href.startsWith('javascript:')) continue;

              const fullUrl = href.startsWith('http') ? href : new URL(href, website).href;
              if (visitedUrls.has(fullUrl)) continue;
              visitedUrls.add(fullUrl);

              console.log(`      📄 Scanez sub-pagina: ${fullUrl.slice(0, 80)}...`);
              const subEmails = await scrapeEmailsFromPage(newPage, fullUrl);
              allEmails.push(...subEmails);
            } catch {
              // Link invalid, trecem mai departe
            }
          }
        } catch {
          // Site-ul nu a răspuns
        }
        await newPage.close();
      }

      // Deduplicăm email-urile
      const uniqueEmails = [...new Set(allEmails.map(e => e.toLowerCase()))];

      const firma: FirmaData = {
        sursa: 'google_maps',
        nume: name,
        site: website || 'Nu are site',
        telefon: phone || 'Nu are telefon',
        emailuri: uniqueEmails.length > 0 ? uniqueEmails : ['Nu s-a găsit']
      };

      firme.push(firma);
      console.log(`   💾 Salvat: Site: ${firma.site} | Tel: ${firma.telefon} | Email-uri: ${firma.emailuri.join(', ')}`);

      // Navigăm înapoi la listă
      const backButton = page.locator('button[aria-label="Înapoi"], button[aria-label="Back"]');
      try {
        await backButton.first().waitFor({ state: 'visible', timeout: 3000 });
        await backButton.first().click();
      } catch {
        await page.keyboard.press('Escape');
      }

      await page.waitForSelector('div[role="feed"]', { timeout: 8000 });
      await page.waitForTimeout(1500);

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.log(`   ❌ Eroare la firma ${i + 1}: ${errMsg.slice(0, 120)}`);
      try {
        const backButton = page.locator('button[aria-label="Înapoi"], button[aria-label="Back"]');
        if (await backButton.count() > 0) {
          await backButton.first().click();
          await page.waitForSelector('div[role="feed"]', { timeout: 5000 });
          await page.waitForTimeout(1000);
        }
      } catch {
        // Ignorăm
      }
    }
  }

  // 4. Salvăm JSON
  const output = { total: firme.length, sursa: 'google_maps', firme };
  fs.writeFileSync('rezultate_maps.json', JSON.stringify(output, null, 2), 'utf-8');

  console.log('\n✅ Gata Google Maps! Verifică fișierul "rezultate_maps.json".');
});
