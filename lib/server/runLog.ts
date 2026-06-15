import 'server-only';
import type { RunRow } from '@/lib/db/types';
import { replaySpireRun, type SpireAction } from '@/lib/spire/replay';
import { ARTIFACTS_BY_ID } from '@/lib/spire/artifacts';
import { RULES_BY_ID } from '@/data/rules';

/**
 * A decoded 첨탑(spire) run, for the admin balance-tuning log. Every field is
 * DERIVED from the stored seed + action stream via the canonical replayer (the
 * same engine the client/submission verifier use), never trusted from the run
 * row — except the !ok fallback, which uses the stored score/clearedStageCount.
 */
export type SpireRunSummary = {
  runId: string;
  nickname: string | null;
  submittedAt: string | null;
  status: string;
  /** True when the replay reproduced the run cleanly (no illegal action). */
  ok: boolean;
  stagesCleared: number;
  totalScore: number;
  money: number;
  failures: number;
  artifactNames: string[];
  rulePoolNames: string[];
  symbolBag: Record<string, number>;
  purchaseCount: number;
};

/** Decode one stored spire run row into a human-readable summary. */
export function decodeSpireRun(run: RunRow): SpireRunSummary {
  const actions = Array.isArray(run.actions) ? (run.actions as SpireAction[]) : [];
  const r = replaySpireRun(run.seed, actions);

  const artifactNames = r.finalState.artifacts.map(
    (id) => ARTIFACTS_BY_ID[id]?.name ?? id,
  );
  const rulePoolNames = r.finalState.rulePool.map(
    (id) => RULES_BY_ID[id]?.name ?? id,
  );

  // 구매 횟수: shop purchases (buy_*) and shop rerolls.
  const purchaseCount = actions.filter(
    (a) => a.type.startsWith('buy_') || a.type === 'reroll_shop',
  ).length;

  return {
    runId: run.id,
    nickname: run.nickname,
    submittedAt: run.submittedAt,
    status: run.status,
    ok: r.ok,
    // When the replay fails, the threaded state is partial — fall back to the
    // stored row values so the row still shows meaningful numbers.
    stagesCleared: r.ok ? r.stagesCleared : run.clearedStageCount ?? r.stagesCleared,
    totalScore: r.ok ? r.totalRunScore : run.score ?? r.totalRunScore,
    money: r.finalState.money,
    failures: r.finalState.failures,
    artifactNames,
    rulePoolNames,
    symbolBag: r.finalState.symbolBag,
    purchaseCount,
  };
}
