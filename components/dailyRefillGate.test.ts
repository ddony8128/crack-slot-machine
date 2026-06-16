import { describe, expect, it } from "vitest";
import { dailyRefillGate } from "@/components/dailyRefillGate";
import type { DailyCurrent } from "@/lib/client/dailyApi";

function loggedIn(over: Partial<Extract<DailyCurrent, { loggedIn: true }>>) {
  return {
    dateKey: "2026-06-16",
    endsAt: "2026-06-17T03:00:00.000Z",
    loggedIn: true,
    attemptsUsed: 0,
    attemptsLeft: 5,
    allowed: 5,
    adRefillUsed: false,
    canRefill: true,
    ...over,
  } satisfies Extract<DailyCurrent, { loggedIn: true }>;
}

describe("dailyRefillGate (§8)", () => {
  it("holds the refill CTA while base attempts remain", () => {
    const gate = dailyRefillGate(loggedIn({ attemptsLeft: 5 }));
    expect(gate.showRefillCta).toBe(false);
    expect(gate.refillAvailableButHeld).toBe(true);
  });

  it("holds the CTA with even one base attempt left", () => {
    const gate = dailyRefillGate(loggedIn({ attemptsLeft: 1 }));
    expect(gate.showRefillCta).toBe(false);
    expect(gate.refillAvailableButHeld).toBe(true);
  });

  it("surfaces the CTA once base attempts are exhausted", () => {
    const gate = dailyRefillGate(loggedIn({ attemptsLeft: 0 }));
    expect(gate.showRefillCta).toBe(true);
    expect(gate.refillAvailableButHeld).toBe(false);
  });

  it("shows nothing when the refill is unavailable (already used)", () => {
    const gate = dailyRefillGate(
      loggedIn({ attemptsLeft: 0, canRefill: false, adRefillUsed: true }),
    );
    expect(gate.showRefillCta).toBe(false);
    expect(gate.refillAvailableButHeld).toBe(false);
  });

  it("shows nothing for guests / no data", () => {
    expect(dailyRefillGate(null).showRefillCta).toBe(false);
    expect(
      dailyRefillGate({
        dateKey: "2026-06-16",
        endsAt: "2026-06-17T03:00:00.000Z",
        loggedIn: false,
      }).refillAvailableButHeld,
    ).toBe(false);
  });
});
