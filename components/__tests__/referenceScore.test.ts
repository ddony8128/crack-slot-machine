import { describe, it, expect } from "vitest";
import { bonusRowLabel } from "@/components/ReferenceModal";
import { SYMBOL_SETS_BY_ID } from "@/lib/symbols/sets";

// The 점수표 must read the same as lib/score.ts's setBonuses wording. These
// assert the per-bonus-type label/value derivation against the live config so
// the table can't silently drift from the data.
describe("bonusRowLabel", () => {
  it("all-types -> '{name} 3종' = +points", () => {
    const fruit = SYMBOL_SETS_BY_ID.fruit;
    expect(bonusRowLabel(fruit, { type: "all-types", points: 50 })).toEqual({
      label: "과일 3종",
      value: "+50",
      negative: false,
    });
  });

  it("all-symbols -> '올 {name}' = +points", () => {
    const gem = SYMBOL_SETS_BY_ID.gem;
    expect(bonusRowLabel(gem, { type: "all-symbols", points: 150 })).toEqual({
      label: "올 보석",
      value: "+150",
      negative: false,
    });
  });

  it("per-symbol -> '{name} 1개당' = +points", () => {
    const cat = SYMBOL_SETS_BY_ID.cat;
    expect(bonusRowLabel(cat, { type: "per-symbol", points: 30 })).toEqual({
      label: "고양이 1개당",
      value: "+30",
      negative: false,
    });
  });

  it("adjacent-penalty -> '이웃 {name} 1개당' negative, raw (signed) value", () => {
    const cat = SYMBOL_SETS_BY_ID.cat;
    expect(bonusRowLabel(cat, { type: "adjacent-penalty", points: -60 })).toEqual({
      label: "이웃 고양이 1개당",
      value: "-60",
      negative: true,
    });
  });

  it("per-event -> '{name} {이동|재굴림|복사} 1개당' = +points", () => {
    const vehicle = SYMBOL_SETS_BY_ID.vehicle;
    expect(
      bonusRowLabel(vehicle, { type: "per-event", event: "moved", points: 20 }),
    ).toEqual({ label: "교통수단 이동 1개당", value: "+20", negative: false });

    const monster = SYMBOL_SETS_BY_ID.monster;
    expect(
      bonusRowLabel(monster, { type: "per-event", event: "copied", points: 40 }),
    ).toEqual({ label: "괴물 복사 1개당", value: "+40", negative: false });
  });

  it("label stems match lib/score.ts (per-type prefix shared with in-game breakdown)", () => {
    // setBonuses uses `${set.name} 3종`, `올 ${set.name}`, `이웃 ${set.name}`,
    // `${set.name} ${이동|재굴림|복사}` — the table reuses the same stems.
    const cat = SYMBOL_SETS_BY_ID.cat;
    expect(bonusRowLabel(cat, { type: "all-types", points: 200 }).label).toBe(
      `${cat.name} 3종`,
    );
    expect(
      bonusRowLabel(cat, { type: "adjacent-penalty", points: -60 }).label,
    ).toContain(`이웃 ${cat.name}`);
  });
});
