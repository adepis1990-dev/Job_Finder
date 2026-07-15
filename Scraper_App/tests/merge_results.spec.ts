import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Merge: combină rezultatele din toate cele 3 scrapere
 * într-un singur JSON unificat cu câmpul "sursa" pe fiecare entry.
 */

test('Merge all scraper results', async () => {
  function loadJson(fileName: string): unknown[] {
    const fullPath = path.resolve(process.cwd(), fileName);
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  Fișierul ${fileName} nu există. Skipăm.`);
      return [];
    }
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    return data.firme || data.jobs || [];
  }

  const mapsResults = loadJson('rezultate_maps.json');
  const linkedinResults = loadJson('rezultate_linkedin.json');
  const bestjobsResults = loadJson('rezultate_bestjobs.json');
  const ejobsResults = loadJson('rezultate_ejobs.json');
  const hipoResults = loadJson('rezultate_hipo.json');

  const output = {
    total: mapsResults.length + linkedinResults.length + bestjobsResults.length + ejobsResults.length + hipoResults.length,
    generat_la: new Date().toISOString(),
    rezultate: {
      google_maps: mapsResults,
      linkedin: linkedinResults,
      bestjobs: bestjobsResults,
      ejobs: ejobsResults,
      hipo: hipoResults,
    }
  };

  const outputPath = path.resolve(process.cwd(), 'rezultate_all.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

  console.log('\n════════════════════════════════════════');
  console.log('   REZULTATE COMBINATE');
  console.log('════════════════════════════════════════');
  console.log(`  Google Maps: ${mapsResults.length} firme`);
  console.log(`  LinkedIn:    ${linkedinResults.length} joburi`);
  console.log(`  BestJobs:    ${bestjobsResults.length} joburi`);
  console.log(`  eJobs:       ${ejobsResults.length} joburi`);
  console.log(`  Hipo.ro:     ${hipoResults.length} joburi`);
  console.log(`  ─────────────────────────────`);
  console.log(`  TOTAL:       ${output.total} rezultate`);
  console.log('════════════════════════════════════════');
  console.log(`\n✅ Salvat în: rezultate_all.json`);
});
