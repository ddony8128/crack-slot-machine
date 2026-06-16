// Seed 프리 시즌 1's 14-day daily_challenges into the LIVE Supabase, idempotently.
//
// Uses the service-role key from .env.local (never committed). Reuses the exact
// rows that lib/daily (resolveDailySetup/dailyWindow/dailySeed) produces — also
// mirrored in supabase/seed/daily_challenges_preseason1.sql. Upsert preserves
// settled_at (it is not in the payload, so ON CONFLICT DO UPDATE never touches it).
//
//   node scripts/seed-daily-preseason1.mjs
//
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l && !l.trimStart().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || key.startsWith('PASTE_')) {
  console.error(
    'ERROR: set a real SUPABASE_SERVICE_ROLE_KEY in .env.local first (it is still the placeholder).',
  );
  process.exit(1);
}

const SEASON_SLUG = '2026-06-season-1';
// Deterministic 14-day schedule (identical to /admin/daily generate + the SQL seed).
const ROWS = [
  ['2026-06-16', 'fruit', 'gem', 'daily_basic_2'],
  ['2026-06-17', 'cat', 'vehicle', 'daily_basic_1'],
  ['2026-06-18', 'monster', 'fruit', 'daily_basic_2'],
  ['2026-06-19', 'gem', 'cat', 'daily_basic_1'],
  ['2026-06-20', 'vehicle', 'monster', 'daily_basic_1'],
  ['2026-06-21', 'fruit', 'cat', 'daily_basic_2'],
  ['2026-06-22', 'gem', 'vehicle', 'daily_basic_1'],
  ['2026-06-23', 'monster', 'cat', 'daily_basic_2'],
  ['2026-06-24', 'fruit', 'vehicle', 'daily_basic_1'],
  ['2026-06-25', 'gem', 'monster', 'daily_basic_2'],
  ['2026-06-26', 'cat', 'fruit', 'daily_basic_1'],
  ['2026-06-27', 'vehicle', 'gem', 'daily_basic_2'],
  ['2026-06-28', 'monster', 'vehicle', 'daily_basic_1'],
  ['2026-06-29', 'fruit', 'gem', 'daily_basic_2'],
];

const sb = createClient(url, key, { auth: { persistSession: false } });

const { data: season, error: sErr } = await sb
  .from('seasons')
  .select('id, slug, title')
  .eq('slug', SEASON_SLUG)
  .single();
if (sErr || !season) {
  console.error('season lookup failed:', sErr?.message ?? 'not found for slug ' + SEASON_SLUG);
  process.exit(1);
}
console.log(`season: ${season.title} (${season.id})`);

const payload = ROWS.map(([dateKey, a, b, basic]) => {
  const starts = `${dateKey}T03:00:00.000Z`;
  const ends = new Date(Date.parse(starts) + 24 * 3600_000).toISOString();
  return {
    season_id: season.id,
    date_key: dateKey,
    starts_at: starts,
    ends_at: ends,
    seed: `daily-seed-${dateKey}`,
    group_a_set_id: a,
    group_b_set_id: b,
    config: { basicRuleSetId: basic },
  };
});

const { error: upErr } = await sb
  .from('daily_challenges')
  .upsert(payload, { onConflict: 'season_id,date_key' });
if (upErr) {
  console.error('upsert failed:', upErr.message);
  process.exit(1);
}

const { data: check, error: cErr } = await sb
  .from('daily_challenges')
  .select('date_key, group_a_set_id, group_b_set_id, config, settled_at')
  .eq('season_id', season.id)
  .order('date_key');
if (cErr) {
  console.error('verify select failed:', cErr.message);
  process.exit(1);
}

console.log(`\nOK — ${check.length} rows for ${SEASON_SLUG}:`);
for (const r of check) {
  console.log(
    `  ${r.date_key}  ${r.group_a_set_id.padEnd(7)} ${r.group_b_set_id.padEnd(7)} ${
      r.config?.basicRuleSetId ?? '?'
    }  settled=${r.settled_at ?? '-'}`,
  );
}
if (check.length !== 14) {
  console.error(`\nWARNING: expected 14 rows, got ${check.length}.`);
  process.exit(1);
}
console.log('\n✓ 14-day daily config present and verified.');
