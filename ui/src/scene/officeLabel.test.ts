import { describe, expect, it } from "vitest";
import { labelFor } from "./officeLabel";
import { HQ_ROOM } from "../officeReducer";

describe("labelFor", () => {
  it("always shows 부장 for HQ regardless of completedCount or isFixed", () => {
    expect(labelFor(HQ_ROOM, 0, false)).toBe("본부 · 부장");
    expect(labelFor(HQ_ROOM, 99, true)).toBe("본부 · 부장");
  });

  it("shows 팀장 for a fixed team-lead character regardless of completedCount", () => {
    expect(labelFor("dev-dept", 0, true)).toBe("개발팀 · 팀장");
    expect(labelFor("dev-dept", 99, true)).toBe("개발팀 · 팀장");
  });

  it("shows the earned rank for a non-fixed team character", () => {
    expect(labelFor("dev-dept", 0, false)).toBe("개발팀 · 사원");
    expect(labelFor("dev-dept", 3, false)).toBe("개발팀 · 대리");
    expect(labelFor("dev-dept", 6, false)).toBe("개발팀 · 과장");
  });

  it("uses the mapped team name for the new department", () => {
    expect(labelFor("design-publishing-dept", 0, false)).toBe("디자인퍼블리싱팀 · 사원");
  });
});
