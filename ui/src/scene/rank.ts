export type Rank = "사원" | "대리" | "과장";

export function rankFor(completedCount: number): Rank {
  if (completedCount >= 6) return "과장";
  if (completedCount >= 3) return "대리";
  return "사원";
}
