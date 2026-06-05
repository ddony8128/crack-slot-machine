import { chromium } from 'playwright';
const b = await chromium.launch();
for (const w of [390, 768]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await p.screenshot({ path: `C:/not_system/project/26-06/crack-slot-machine/lobby_${w}.png`, fullPage: true });
}
await b.close();
console.log('done');
