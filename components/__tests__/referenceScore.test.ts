import { describe, it, expect } from "vitest";
import { bonusRowLabel } from "@/components/ReferenceModal";
import { SYMBOL_SETS_BY_ID } from "@/lib/symbols/sets";

// The 점수표 labels are written to be SELF-EXPLANATORY for players (clearer than
// the concise in-game score breakdown), so they intentionally read more verbosely
// than lib/score.ts's setBonuses item labels. These pin the player-facing wording.
describe("bonusRowLabel", () => {
  it("all-types -> '{name} 3종 모두 등장' = +points", () => {
    const fruit = SYMBOL_SETS_BY_ID.fruit;
    expect(bonusRowLabel(fruit, { type: "all-types", points: 50 })).toEqual({
      label: "과일 3종 모두 등장",
      value: "+50",
      negative: false,
    });
  });

  it("all-symbols -> '다섯 칸 모두 {name}' = +points", () => {
    const gem = SYMBOL_SETS_BY_ID.gem;
    expect(bonusRowLabel(gem, { type: "all-symbols", points: 150 })).toEqual({
      label: "다섯 칸 모두 보석",
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

  it("adjacent-penalty -> spells out '서로 이웃(바로 옆 칸)한' so 이웃 is unambiguous", () => {
    const cat = SYMBOL_SETS_BY_ID.cat;
    expect(bonusRowLabel(cat, { type: "adjacent-penalty", points: -60 })).toEqual({
      label: "서로 이웃(바로 옆 칸)한 고양이 1개당",
      value: "-60",
      negative: true,
    });
  });

  it("per-event -> '{name} {이동|재굴림|복사} 1회당' = +points", () => {
    const vehicle = SYMBOL_SETS_BY_ID.vehicle;
    expect(
      bonusRowLabel(vehicle, { type: "per-event", event: "moved", points: 20 }),
    ).toEqual({ label: "교통수단 이동 1회당", value: "+20", negative: false });

    const monster = SYMBOL_SETS_BY_ID.monster;
    expect(
      bonusRowLabel(monster, { type: "per-event", event: "copied", points: 40 }),
    ).toEqual({ label: "괴물 복사 1회당", value: "+40", negative: false });
  });

  it("labels include the set name + bonus value so each row is self-explanatory", () => {
    const cat = SYMBOL_SETS_BY_ID.cat;
    expect(bonusRowLabel(cat, { type: "all-types", points: 200 }).label).toContain(cat.name);
    expect(
      bonusRowLabel(cat, { type: "adjacent-penalty", points: -60 }).label,
    ).toContain("이웃");
  });
});
