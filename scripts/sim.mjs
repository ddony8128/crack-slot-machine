// Monte Carlo for the PROPOSED scoring system. Pure analysis, not app code.
const N = 3_000_000;

const SYMS = ["cherry","lemon","grape","diamond","ruby","sapphire","seven","zero","four"];
const FRUITS = new Set(["cherry","lemon","grape"]);
const GEMS = new Set(["diamond","ruby","sapphire"]);
const COLORED = ["cherry","lemon","grape","diamond","ruby","sapphire"];

function makeWeights(over = {}) {
  // EQUAL probability baseline: every symbol weight 1 -> 1/9 each (~11.11%).
  const base = { cherry:1, lemon:1, grape:1, diamond:1, ruby:1, sapphire:1, seven:1, zero:1, four:1 };
  return { ...base, ...over };
}

function roller(weights) {
  const entries = SYMS.map((s) => [s, weights[s]]);
  const total = entries.reduce((a, [,w]) => a + w, 0);
  return () => {
    let r = Math.random() * total;
    for (const [s, w] of entries) { r -= w; if (r < 0) return s; }
    return entries[entries.length - 1][0];
  };
}

const SEVEN_PTS = { 1:10, 2:77, 3:150, 4:500, 5:777 };
const FOUR_PENALTY = -20;
const HAND_PTS = { pair:10, twopair:90, triple:30, full:180, four:300, five:700 };

function score(cells) {
  const c = {};
  for (const s of cells) c[s] = (c[s] || 0) + 1;
  let pts = 0;
  const cats = [];
  const sevens = c.seven || 0, fours = c.four || 0, zeros = c.zero || 0;

  if (SEVEN_PTS[sevens]) { pts += SEVEN_PTS[sevens]; cats.push(`7x${sevens}`); }
  if (fours) pts += fours * FOUR_PENALTY;

  // colored n-of-a-kind
  const colCounts = COLORED.map((s) => c[s] || 0).filter((n) => n > 0).sort((a,b)=>b-a);
  const max = colCounts[0] || 0;
  const num2 = colCounts.filter((n) => n === 2).length;
  let handCat = null, handPts = 0;
  if (max === 5) { handCat = "five"; handPts = HAND_PTS.five; }
  else if (max === 4) { handCat = "four"; handPts = HAND_PTS.four; }
  else if (max === 3 && colCounts[1] === 2) { handCat = "full"; handPts = HAND_PTS.full; }
  else if (max === 3) { handCat = "triple"; handPts = HAND_PTS.triple; }
  else if (max === 2 && num2 >= 2) { handCat = "twopair"; handPts = HAND_PTS.twopair; }
  else if (max === 2) { handCat = "pair"; handPts = HAND_PTS.pair; }
  if (handCat) { pts += handPts; cats.push(handCat); }

  // color/type bonuses
  const fruitTypes = ["cherry","lemon","grape"].filter((s) => c[s]).length;
  const gemTypes = ["diamond","ruby","sapphire"].filter((s) => c[s]).length;
  if (fruitTypes === 3) { pts += 50; cats.push("allFruitTypes"); }
  if (gemTypes === 3) { pts += 80; cats.push("allGemTypes"); }
  const allFruit = cells.every((s) => FRUITS.has(s));
  const allGem = cells.every((s) => GEMS.has(s));
  const allBlue = cells.every((s) => s === "sapphire" || s === "grape");
  const allRed = cells.every((s) => s === "ruby" || s === "cherry");
  if (allFruit) { pts += 100; cats.push("onlyFruits"); }
  if (allGem) { pts += 150; cats.push("onlyGems"); }
  if (allBlue) { pts += 200; cats.push("allBlue"); }
  if (allRed) { pts += 250; cats.push("allRed"); }

  return { pts, cats, sevens, fours, zeros };
}

function run(label, weights) {
  const roll = roller(weights);
  const freq = {};
  const bump = (k) => freq[k] = (freq[k]||0)+1;
  let sum = 0, neg = 0, zero3 = 0, four4 = 0, four5 = 0;
  const cells = new Array(5);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < 5; j++) cells[j] = roll();
    const r = score(cells);
    sum += r.pts;
    if (r.pts < 0) neg++;
    if (r.zeros >= 3) zero3++;
    if (r.fours === 4) four4++;
    if (r.fours === 5) four5++;
    for (const cat of r.cats) bump(cat);
    if (r.cats.length === 0) bump("NOTHING");
  }
  const pct = (x) => (100 * x / N).toFixed(3) + "%";
  console.log(`\n===== ${label} =====`);
  console.log(`avg score/spin: ${(sum/N).toFixed(2)}   negative spins: ${pct(neg)}`);
  const order = ["pair","twopair","triple","full","four","five","7x1","7x2","7x3","7x4","7x5","allFruitTypes","allGemTypes","onlyFruits","onlyGems","allBlue","allRed","NOTHING"];
  for (const k of order) if (freq[k]!==undefined) console.log(`  ${k.padEnd(14)} ${pct(freq[k])}`);
  console.log(`  special: 0>=3 ${pct(zero3)} | 4x4 ${pct(four4)} | 4x5 ${pct(four5)}`);
}

// NOTE: sim covers BASE-ROLL odds + base scoring only (count-based hands, 7-track,
// color bonuses, -20/four). Post-roll rules (rerolls/transforms/locks/mirrors) and
// score rules (seven-double/bonus-77/clean-bonus) are NOT simulated.
run("BASE (uniform 1/9 each)", makeWeights());
run("SEVEN FEVER (7 x3)", makeWeights({ seven: 3 }));
run("FRUIT SURGE (fruit x2)", makeWeights({ cherry:2, lemon:2, grape:2 }));
run("GEM SURGE (gem x2)", makeWeights({ diamond:2, ruby:2, sapphire:2 }));
run("NO ZERO (zero x0)", makeWeights({ zero: 0 }));
run("FOUR SHIELD weight-part (zero x2)", makeWeights({ zero: 2 }));
