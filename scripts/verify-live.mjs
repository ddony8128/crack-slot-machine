// Read-only live-DB sanity checks for 프리 시즌 1 deploy readiness.
//   node scripts/verify-live.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.trimStart().startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY.startsWith('PASTE_')) {
  console.error('ERROR: real key not set in .env.local'); process.exit(1);
}
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let ok = true;
const pass = (m) => console.log('  ✓ ' + m);
const fail = (m) => { ok = false; console.log('  ✗ ' + m); };

// 1) Active season
const { data: seasons, error: se } = await sb.from('seasons').select('*').eq('is_active', true);
if (se) fail('seasons read: ' + se.message);
else if (seasons.length !== 1) fail(`expected 1 active season, got ${seasons.length}`);
else {
  const s = seasons[0];
  console.log(`Season: ${s.title} (${s.slug})  ${s.starts_at} → ${s.ends_at}  client=${s.client_version} ruleset=${s.ruleset_version}`);
  s.title === '프리 시즌 1' ? pass('title 프리 시즌 1') : fail(`title=${s.title}`);
  s.starts_at.startsWith('2026-06-16') ? pass('starts 2026-06-16') : fail(`starts=${s.starts_at}`);
  s.ends_at.startsWith('2026-06-30') ? pass('ends 2026-06-30') : fail(`ends=${s.ends_at}`);
}
const seasonId = seasons?.[0]?.id;

// 2) Daily challenges = 14
if (seasonId) {
  const { count, error } = await sb.from('daily_challenges').select('*', { count: 'exact', head: true }).eq('season_id', seasonId);
  error ? fail('daily_challenges: ' + error.message) : count === 14 ? pass('14 daily_challenges') : fail(`daily_challenges count=${count}`);
}

// 3) Migration column presence — a select on a missing column errors, so a clean
//    select proves the migration landed. Covers the ones that were applied late.
{
  const c0910 = await sb.from('players').select('email,phone,supporter_note,supporter_badge').limit(1);
  c0910.error ? fail('0009/0010 players email/phone/supporter_note: ' + c0910.error.message)
              : pass('0009/0010 players.email,phone,supporter_note present');
  const c0011 = await sb.from('puzzle_user_records')
    .select('cleared,best_clear_spin,best_remaining_spins,best_puzzle_score,cleared_at').limit(1);
  c0011.error ? fail('0011 puzzle_user_records columns: ' + c0011.error.message)
              : pass('0011 puzzle clear-spin columns present');
}

// 4) score_events / season_scores readable (0008)
for (const t of ['score_events', 'season_scores', 'spire_user_records', 'best_scores', 'players', 'game_runs']) {
  const { error } = await sb.from(t).select('*', { head: true, count: 'exact' }).limit(0);
  error ? fail(`${t}: ${error.message}`) : pass(`${t} readable`);
}

console.log('\nNote: 0012 partial index (score_events_daily_reward_uniq) is not introspectable via the REST API; the atomic settle-claim is the primary guard and you confirmed 0012 applied.');
console.log(ok ? '\n✓ ALL LIVE CHECKS PASSED' : '\n✗ SOME CHECKS FAILED (see above)');
process.exit(ok ? 0 : 1);
