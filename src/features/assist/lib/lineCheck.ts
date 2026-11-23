import type { Mark, Puzzle } from "../../../shared/types";
import { clueSet } from "../../../shared/clues";
import { lineForRegion } from "../../zones/model/zones";

/**
 * Whether a complete line can still satisfy its clue given the current marks.
 * Unknown cells are free, filled cells must be filled, crosses must be empty.
 *
 * This is deliberately evaluated over the *whole* line: a filled run that
 * continues past a region border is part of the same segment, so clipping at
 * the border cannot make an impossible line look possible.
 */
export function lineFeasible(clue: number[], marks: readonly Mark[]): boolean {
  const n = marks.length;
  const canFill = marks.map((m) => m !== "cross");
  const canEmpty = marks.map((m) => m !== "filled");
  const emptyPrefix = [0];
  for (let i = 0; i < n; i++)
    emptyPrefix.push(emptyPrefix[i] + (canEmpty[i] ? 1 : 0));
  const allEmpty = (from: number, to: number) =>
    to <= from || emptyPrefix[to] - emptyPrefix[from] === to - from;
  const allFill = (from: number, to: number) => {
    for (let i = from; i < to; i++) if (!canFill[i]) return false;
    return true;
  };

  const memo = new Map<string, boolean>();
  const solve = (pos: number, segment: number): boolean => {
    if (segment === clue.length) {
      if (allEmpty(pos, n)) return true;
      return false;
    }
    const key = `${pos}:${segment}`;
    const known = memo.get(key);
    if (known !== undefined) return known;
    let result = false;
    const length = clue[segment];
    for (let start = pos; start + length <= n && !result; start++) {
      if (!allEmpty(pos, start)) break;
      if (!allFill(start, start + length)) continue;
      const after = start + length;
      if (after < n && !canEmpty[after]) continue;
      if (solve(after + 1, segment + 1)) result = true;
    }
    memo.set(key, result);
    return result;
  };
  // A zero clue means the line is empty everywhere.
  if (clue.length === 1 && clue[0] === 0) return allEmpty(0, n);
  return solve(0, 0);
}

/** Lines intersecting a region whose complete marks can no longer fit. */
export function regionLineConflicts(
  puzzle: Puzzle,
  marks: readonly Mark[],
  rect: { row: number; col: number; rows: number; cols: number },
): number {
  const clues = clueSet(puzzle.size, puzzle.solution);
  let conflicts = 0;
  for (let i = 0; i < rect.rows; i++) {
    const row = rect.row + i;
    const line = lineForRegion(puzzle.size, marks, "row", row);
    if (!lineFeasible(clues[row], line)) conflicts++;
  }
  for (let i = 0; i < rect.cols; i++) {
    const col = rect.col + i;
    const line = lineForRegion(puzzle.size, marks, "col", col);
    if (!lineFeasible(clues[puzzle.size + col], line)) conflicts++;
  }
  return conflicts;
}
