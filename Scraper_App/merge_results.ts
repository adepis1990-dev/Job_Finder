import * as fs from 'fs';
import * as path from 'path';

/**
 * Script care combină rezultatele din toate cele 3 scrapere
 * într-un singur JSON unificat cu câmpul "sursa" pe fiecare entry.
 */

interface UnifiedOutput {
  total: number;
  generat_la: string;
  rezultate: {
    google_maps: unknown[];
    linkedin: unknown[];
    bestjobs: unknown[];
  };
}

function loadJson(filePath: string): unknown[] {
  const fullPath = path.resolve(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Fișierul ${filePath} nu există. Skipăm.`);
    return [];
  }
  const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  // Fiecare scraper salvează cu structura { total, sursa, firme/jobs }
  return data.firme || data.jobs || [];
}

const mapsResults = loadJson('./rezultate_maps.json');
const linkedinResults = loadJson('./rezultate_linkedin.json');
const bestjobsResults = loadJson('./rezultate_bestjobs.json');

const output: UnifiedOutput = {
  total: mapsResults.length + linkedinResults.length + bestjobsResults.length,
  generat_la: new Date().toISOString(),
  rezultate: {
    google_maps: mapsResults,
    linkedin: linkedinResults,
    bestjobs: bestjobsResults,
  }
};

const outputPath = path.resolve(__dirname, 'rezultate_all.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

console.log('\n════════════════════════════════════════');
console.log('   REZULTATE COMBINATE');
console.log('════════════════════════════════════════');
console.log(`  Google Maps: ${mapsResults.length} firme`);
console.log(`  LinkedIn:    ${linkedinResults.length} joburi`);
console.log(`  BestJobs:    ${bestjobsResults.length} joburi`);
console.log(`  ─────────────────────────────`);
console.log(`  TOTAL:       ${output.total} rezultate`);
console.log('════════════════════════════════════════');
console.log(`\n✅ Salvat în: rezultate_all.json`);
