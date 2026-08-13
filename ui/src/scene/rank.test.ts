import { describe, expect, it } from "vitest";
import { rankFor } from "./rank";

describe("rankFor", () => {
  it("returns 사원 for 0 completed tasks", () => {
    expect(rankFor(0)).toBe("사원");
  });

  it("returns 사원 for 2 completed tasks (below 대리 threshold)", () => {
    expect(rankFor(2)).toBe("사원");
  });

  it("returns 대리 for 3 completed tasks (대리 threshold)", () => {
    expect(rankFor(3)).toBe("대리");
  });

  it("returns 대리 for 5 completed tasks (below 과장 threshold)", () => {
    expect(rankFor(5)).toBe("대리");
  });

  it("returns 과장 for 6 completed tasks (과장 threshold)", () => {
    expect(rankFor(6)).toBe("과장");
  });

  it("returns 과장 for large completed counts", () => {
    expect(rankFor(100)).toBe("과장");
  });
});
