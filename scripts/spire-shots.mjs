import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:3141';
const OUT = 'scripts/shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 12'] });
const page = await context.newPage();

// Sign up (sets the auth cookie on the context).
const res = await context.request.post(`${BASE}/api/auth/signup`, {
  data: {
    nickname: `spire${Date.now() % 100000}`,
    contactType: 'email',
    contactValue: `s${Date.now() % 100000}@t.com`,
    password: 'password123',
    agree: true,
  },
});
console.log('signup', res.status());

await page.goto(`${BASE}/season/spire`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
// dismiss the ModeIntro overlay if present
const ok = page.getByRole('button', { name: '확인' });
if (await ok.count()) await ok.first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/spire-choosing.png`, fullPage: true });
console.log('choosing ok');

// Choose the first set.
const setBtn = page.getByRole('button', { name: /이 세트 선택/ });
if (await setBtn.count()) {
  await setBtn.first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/spire-stage.png`, fullPage: true });
  console.log('stage ok');
} else {
  console.log('no set button found');
}

await browser.close();
console.log('done');
