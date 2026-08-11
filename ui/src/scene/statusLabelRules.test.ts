import { describe, expect, it } from "vitest";
import { isSpeechBubbleStatus } from "./statusLabelRules";
import type { CharacterStatus } from "../officeReducer";

const ALL_STATUSES: CharacterStatus[] = [
  "출근",
  "자료 찾는 중 🔍",
  "작성 중 ✍️",
  "명령 실행 중 ⚙️",
  "검색 중 🌐",
  "업무 지시 중 📋",
  "작업 중",
  "완료 ✅",
  "문제 발생 ⚠️",
  "퇴근",
  "지시 접수 📨",
  "업무 종료",
];

describe("isSpeechBubbleStatus", () => {
  it("is true only for the failure status", () => {
    expect(isSpeechBubbleStatus("문제 발생 ⚠️")).toBe(true);
    for (const status of ALL_STATUSES.filter((s) => s !== "문제 발생 ⚠️")) {
      expect(isSpeechBubbleStatus(status)).toBe(false);
    }
  });
});
