// UI screenshot capture for RULE SLOT.
// Usage: node scripts/capture.mjs [outDir] [baseUrl]
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const outDir = process.argv[2] || "screenshots";
const baseUrl = process.argv[3] || "http://localhost:3000";

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const shot = async (name) => {
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
  console.log("captured", name);
};
const settle = () => page.waitForTimeout(450);

// seed a couple of ranking entries so the start screen isn't empty
await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const recs = [
    { id: "a", nickname: "CHERRYKIM", score: 1280, createdAt: "2026-01-01T00:00:00Z", bestSpinScore: 700, finalRules: ["SEVEN FEVER"] },
    { id: "b", nickname: "SEVENMAN", score: 1040, createdAt: "2026-01-02T00:00:00Z", bestSpinScore: 420, finalRules: ["GEM MODE"] },
    { id: "c", nickname: "RULEKING", score: 880, createdAt: "2026-01-03T00:00:00Z", bestSpinScore: 250, finalRules: ["FRUIT MODE"] },
  ];
  localStorage.setItem("rule-slot-rankings", JSON.stringify(recs));
});
await page.reload({ waitUntil: "networkidle" });
await settle();
await shot("01-start");

// start game
await page.fill('input[placeholder="닉네임을 입력하세요"]', "김도현");
await settle();
await page.getByRole("button", { name: "GAME START" }).click();
await page.getByText("이번 스핀에 장착할 규칙을 선택하세요").waitFor();
await settle();
await shot("02-choosing-rule");

// play 5 spins, capturing the first cycle's intermediate states
for (let spin = 0; spin < 5; spin++) {
  // choosing-rule -> pick first offered rule card
  await page.getByText("이번 스핀에 장착할 규칙을 선택하세요").waitFor();
  const ruleCard = page.locator("section", { hasText: "이번 스핀에 장착할 규칙을 선택하세요" }).getByRole("button").first();
  await ruleCard.click();
  // choosing-slot
  await page.getByText("어느 슬롯에 장착할까요?").waitFor();
  if (spin === 0) { await settle(); await shot("03-choosing-slot"); }
  // equip into slot A (cycle slots so they fill up)
  const slotName = `SLOT ${["A", "B", "C"][spin % 3]}`;
  await page.getByRole("button", { name: new RegExp(slotName) }).first().click();
  // ready-to-spin
  await page.getByRole("button", { name: "SPIN" }).waitFor();
  if (spin === 0) { await settle(); await shot("04-ready-to-spin"); }
  await page.getByRole("button", { name: "SPIN" }).click();
  // spin-result
  await page.locator("text=Spin Result").first().waitFor();
  await settle();
  if (spin === 0) await shot("05-spin-result");
  if (spin === 2) await shot("06-spin-result-midgame");
  // next
  const nextBtn = page.getByRole("button", { name: /다음 스핀|결과 보기|추가 규칙 선택/ });
  await nextBtn.first().click();
  await settle();
}

// finished
await page.getByText("GAME RESULT").waitFor();
await settle();
await shot("07-result");

// mobile start
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mpage = await mctx.newPage();
await mpage.goto(baseUrl, { waitUntil: "networkidle" });
await mpage.waitForTimeout(400);
await mpage.screenshot({ path: `${outDir}/08-start-mobile.png`, fullPage: true });
console.log("captured 08-start-mobile");

await browser.close();
console.log("DONE");
