import type { Puzzle, Session, ZoneRect } from "../../../shared/types";
import { cellsInRect, currentView, sameRect, sameView } from "../../zones/model/zones";
import { regionLineConflicts } from "./lineCheck";

export interface CheckReport {
  /** Wrong marks whose board indices fall inside the checked region. */
  errors: number;
  indices: number[];
  checked: number;
  /**
   * Intersecting lines whose complete marks can no longer fit their clue.
   * Computed over full board lines -- the region only decides which lines are
   * examined, never how long the runs along them are.
   */
  lineIssues: number;
}

/**
 * The rectangle only limits which cells are *reported*. Every mark is still
 * compared against the full board (the puzzle's real answer), and every
 * intersecting line is judged end to end, so a region edge is never mistaken
 * for an empty cell and a run crossing the border is never judged short.
 */
export function inspectRegion(
  puzzle: Puzzle,
  session: Session,
  rect: ZoneRect | null,
): CheckReport {
  const indices = rect
    ? cellsInRect(puzzle.size, rect)
    : [...Array(puzzle.size ** 2).keys()];
  const wrong: number[] = [];
  let checked = 0;
  for (const i of indices) {
    if (session.marks[i] !== "unknown") checked++;
    if (
      (session.marks[i] === "filled" && !puzzle.solution[i]) ||
      (session.marks[i] === "cross" && !!puzzle.solution[i])
    )
      wrong.push(i);
  }
  return {
    errors: wrong.length,
    indices: wrong,
    checked,
    lineIssues: rect ? regionLineConflicts(puzzle, session.marks, rect) : 0,
  };
}

export function inspect(
  puzzle: Puzzle,
  session: Session,
): { filled: number; crossed: number; errors: number } {
  return {
    filled: session.marks.filter((m) => m === "filled").length,
    crossed: session.marks.filter((m) => m === "cross").length,
    errors: inspectRegion(puzzle, session, null).errors,
  };
}

export type CheckStatus = "none" | "fresh" | "stale";

/**
 * A stored check result belongs to one exact region and viewport. Switching
 * regions, resizing one, or moving the view makes it stale rather than
 * letting old coordinates be applied to a new layout.
 */
export function checkStatus(session: Session): CheckStatus {
  const check = session.check;
  if (!check) return "none";
  const zone = check.zoneId
    ? (session.zones.find((z) => z.id === check.zoneId) ?? null)
    : null;
  if (check.zoneId !== null && !zone) return "stale";
  if ((zone?.id ?? null) !== session.activeZoneId) return "stale";
  if (!sameRect(zone ?? null, check.rect)) return "stale";
  return sameView(currentView(session), check.view) ? "fresh" : "stale";
}

/** A check result shown only when it still describes the current geometry. */
export function freshCheck(session: Session) {
  return checkStatus(session) === "fresh" ? session.check : null;
}

export function checkScopeLabel(zone: { name: string } | null): string {
  return zone ? `「${zone.name}」` : "全盘";
}

export function checkMessage(
  report: Pick<CheckReport, "errors" | "lineIssues">,
  scope: string,
  stale: boolean,
): string {
  const note = stale ? " 区域或视图已变化，旧结果不再按新坐标显示。" : "";
  if (!report.errors && !report.lineIssues)
    return `${scope}内没有发现错误标记，横跨边界的长段也按完整行列读取。${note}`.trim();
  const parts: string[] = [];
  if (report.errors) parts.push(`${report.errors} 处标记与答案不符`);
  if (report.lineIssues)
    parts.push(`${report.lineIssues} 条完整行列已无法凑出线索`);
  return `${scope}内${parts.join("，")}。检查只定位，不会直接揭示位置。${note}`.trim();
}
