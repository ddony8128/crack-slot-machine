import { chromium } from 'playwright';

const URL = 'http://localhost:3000/e/blackhaven';
const NICK = 'test1';
const SELECT_RULES = ['직접 복제', '직접 교환', '직접 재굴림']; // avoid the cell-pick sub-flow
const log = (...a) => console.log('[e2e]', ...a);

const isVis = async (loc) => loc.first().isVisible().catch(() => false);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });
page.on('console', (m) => { if (m.type() === 'error') log('PAGE-ERR', m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
log('loaded start screen');

// Enter nickname + start
await page.getByPlaceholder('닉네임을 입력하세요').fill(NICK);
await page.getByRole('button', { name: 'GAME START' }).click();
log('clicked GAME START');

let spins = 0;
let finishedKind = null;

for (let i = 0; i < 250; i++) {
  // 1) terminal states
  if (await isVis(page.getByRole('heading', { name: 'GAME RESULT' }))) { finishedKind = 'result'; break; }
  if (await isVis(page.getByRole('heading', { name: '치팅이 감지되었습니다' }))) { finishedKind = 'rejected'; break; }
  if (await isVis(page.getByRole('heading', { name: '새 버전이 배포되었어요' }))) { finishedKind = 'stale'; break; }

  // 2) intro modal
  const intro = page.getByRole('button', { name: '시작하기' });
  if (await isVis(intro)) { await intro.click(); log('dismissed intro'); await page.waitForTimeout(150); continue; }

  // 3) placement confirm modal (clear it first)
  const confirm = page.getByRole('button', { name: /^(장착하기|교체하기|보관하기)$/ });
  if (await isVis(confirm)) { await confirm.click(); log('confirmed placement'); await page.waitForTimeout(200); continue; }

  // 4) rule picker
  const picker = page.locator('section:has(h2:has-text("장착할 규칙을 선택하세요"))');
  if (await isVis(picker)) {
    const buttons = picker.getByRole('button');
    const n = await buttons.count();
    let clicked = false;
    for (let b = 0; b < n; b++) {
      const txt = (await buttons.nth(b).innerText()).trim();
      if (!SELECT_RULES.some((s) => txt.startsWith(s))) { await buttons.nth(b).click(); log('picked rule:', txt.split('\n')[0]); clicked = true; break; }
    }
    if (!clicked) { await buttons.first().click(); log('picked (fallback select rule)'); }
    await page.waitForTimeout(200);
    continue;
  }

  // 5) placing → choose an empty slot, else the bag
  if (await isVis(page.getByText('배치할 규칙:'))) {
    const empty = page.getByText('비어 있음');
    if (await isVis(empty)) { await empty.first().click(); log('placed into empty slot'); }
    else { await page.getByText('비활성 — 적용되지 않음').first().click(); log('placed into bag (slots full)'); }
    await page.waitForTimeout(200);
    continue;
  }

  // 6) spin
  const spin = page.getByRole('button', { name: 'SPIN', exact: true });
  if (await isVis(spin)) { await spin.click(); spins++; log('SPIN', spins); await page.waitForTimeout(400); continue; }

  // 7) next / result
  const next = page.getByRole('button', { name: /^(다음 스핀|결과 보기)$/ });
  if (await isVis(next)) { const t = await next.first().innerText(); await next.first().click(); log('clicked', t.trim()); await page.waitForTimeout(300); continue; }

  // 8) selection fallback (should not happen — we avoid select rules)
  if (await isVis(page.getByText(/선택하세요/))) {
    log('!! unexpected selection prompt — clicking selectable cells');
    const cells = page.locator('[role="dialog"][aria-label="칸 선택"] button');
    const cn = await cells.count();
    if (cn) await cells.first().click();
    await page.waitForTimeout(300);
    continue;
  }

  await page.waitForTimeout(500); // animation in progress
}

log('loop ended; spins=', spins, 'finishedKind=', finishedKind);

// Wait for the submit result to render and capture it
await page.waitForTimeout(1500);
const grab = async (re) => (await page.getByText(re).first().innerText().catch(() => null));
const submittedMsg = await grab(/랭킹에 등록되었습니다|기록 등록에 실패|기록 등록 중/);
const creditMsg = await grab(/받을 크레딧|새로 받을 크레딧은 없습니다/);
const bestMsg = await grab(/개인 최고 점수/);
const scoreText = await page.locator('p.font-mono.text-5xl').first().innerText().catch(() => null);

log('RESULT heading kind:', finishedKind);
log('score on screen:', scoreText);
log('submit status   :', submittedMsg);
log('credit line     :', creditMsg);
log('best line       :', bestMsg);

await page.screenshot({ path: 'screenshots/e2e-result.png', fullPage: true });
log('screenshot -> screenshots/e2e-result.png');

await browser.close();
