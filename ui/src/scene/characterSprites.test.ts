import { describe, expect, it } from "vitest";
import { characterFileFor } from "./characterSprites";
import { HQ_ROOM } from "../officeReducer";

describe("characterFileFor", () => {
  it("maps research-dept to char_0.png", () => {
    expect(characterFileFor("research-dept")).toBe("char_0.png");
  });

  it("maps planning-dept to char_1.png", () => {
    expect(characterFileFor("planning-dept")).toBe("char_1.png");
  });

  it("maps dev-dept to char_2.png", () => {
    expect(characterFileFor("dev-dept")).toBe("char_2.png");
  });

  it("maps design-publishing-dept to char_3.png", () => {
    expect(characterFileFor("design-publishing-dept")).toBe("char_3.png");
  });

  it("maps HQ_ROOM to char_4.png", () => {
    expect(characterFileFor(HQ_ROOM)).toBe("char_4.png");
  });

  it("falls back to char_5.png for an unknown department", () => {
    expect(characterFileFor("unknown-dept")).toBe("char_5.png");
  });
});
