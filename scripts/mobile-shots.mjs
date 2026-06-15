import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:3137';
const OUT = 'scripts/shots';
mkdirSync(OUT, { recursive: true });

const profiles = [
  { tag: 'iphone12', device: devices['iPhone 12'] },
  { tag: 'iphonese', device: devices['iPhone SE'] },
];

const log = (...a) => console.log(...a);

for (const { tag, device } of profiles) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...device });
  const page = await context.newPage();

  // Home
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/${tag}-home.png`, fullPage: true });
  log(tag, 'home ok');

  // Quick landing — ModeIntro overlay should be visible on first visit
  await page.goto(`${BASE}/quick`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${tag}-quick-intro.png`, fullPage: true });
  log(tag, 'quick-intro ok');

  // Dismiss intro, start game, capture the board
  const confirm = page.getByRole('button', { name: '확인' });
  if (await confirm.count()) await confirm.first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${tag}-quick-landing.png`, fullPage: true });

  const start = page.getByRole('button', { name: /게임 시작/ });
  if (await start.count()) {
    await start.first().click();
    await page.waitForTimeout(2500); // let the run start + board render
    await page.screenshot({ path: `${OUT}/${tag}-game-board.png`, fullPage: true });
    log(tag, 'game-board ok');
  } else {
    log(tag, 'start button not found');
  }

  await browser.close();
}
log('done');
