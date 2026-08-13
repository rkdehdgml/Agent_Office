import { describe, expect, it } from "vitest";
import { teamNameFor } from "./teamLabels";
import { HQ_ROOM } from "../officeReducer";

describe("teamNameFor", () => {
  it("maps research-dept to 리서치팀", () => {
    expect(teamNameFor("research-dept")).toBe("리서치팀");
  });

  it("maps planning-dept to 기획팀", () => {
    expect(teamNameFor("planning-dept")).toBe("기획팀");
  });

  it("maps dev-dept to 개발팀", () => {
    expect(teamNameFor("dev-dept")).toBe("개발팀");
  });

  it("maps design-publishing-dept to 디자인퍼블리싱팀", () => {
    expect(teamNameFor("design-publishing-dept")).toBe("디자인퍼블리싱팀");
  });

  it("maps HQ_ROOM to 본부", () => {
    expect(teamNameFor(HQ_ROOM)).toBe("본부");
  });

  it("falls back to the raw slug for an unknown department", () => {
    expect(teamNameFor("unknown-dept")).toBe("unknown-dept");
  });
});
