import type {
  Mark,
  Puzzle,
  Session,
  Zone,
  ZoneRect,
} from "../../../shared/types";
import { cellsInRect, zoneUnsettled } from "../../zones/model/zones";

export const HINT_LIMIT = 3;

export type HintFailure = "quota" | "solved" | "no-target";

export type HintResult =
  | {
      ok: true;
      hint: { index: number; mark: Mark; zoneId: string | null };
    }
  | { ok: false; reason: HintFailure };

/**
 * Cells a hint could still reveal: wrong or open cells inside the region.
 * When no region is focused the whole board is used, which keeps the
 * original single-board behaviour available.
 */
export function hintTargets(
  puzzle: Puzzle,
  session: Session,
  rect: ZoneRect | null,
): number[] {
  const indices = rect
    ? cellsInRect(puzzle.size, rect)
    : [...Array(puzzle.size ** 2).keys()];
  return indices.filter((i) =>
    puzzle.solution[i]
      ? session.marks[i] !== "filled"
      : session.marks[i] === "filled" || session.marks[i] === "unknown",
  );
}

/**
 * Picks the next cell to reveal. Quota is shared across every region; a
 * region with nothing left to reveal fails with "no-target" instead of
 * falling through to another region, which would silently spend the
 * solver's quota somewhere they are not looking.
 */
export function resolveHint(
  puzzle: Puzzle,
  session: Session,
  zone: Zone | null,
): HintResult {
  if (session.solved) return { ok: false, reason: "solved" };
  if (session.hints >= HINT_LIMIT) return { ok: false, reason: "quota" };
  const targets = hintTargets(puzzle, session, zone ?? null);
  if (!targets.length) return { ok: false, reason: "no-target" };
  const index = targets[0];
  return {
    ok: true,
    hint: {
      index,
      mark: puzzle.solution[index] ? "filled" : "cross",
      zoneId: zone?.id ?? null,
    },
  };
}

/** Convenience wrapper for callers that only need coordinates. */
export function nextHint(
  puzzle: Puzzle,
  session: Session,
  zone: Zone | null = null,
): { index: number; mark: Mark; zoneId: string | null } | null {
  const result = resolveHint(puzzle, session, zone);
  return result.ok ? result.hint : null;
}

export function hintMessage(
  result: HintResult,
  puzzle: Puzzle,
  zone: Zone | null,
): string {
  if (result.ok) {
    const row = Math.floor(result.hint.index / puzzle.size) + 1;
    const col = (result.hint.index % puzzle.size) + 1;
    return zone
      ? `在「${zone.name}」中揭示了第 ${row} 行、第 ${col} 列的一格。`
      : `已揭示第 ${row} 行、第 ${col} 列的一格。`;
  }
  switch (result.reason) {
    case "quota":
      return `提示额度已用完（共 ${HINT_LIMIT} 次），不会从其他区域补扣。`;
    case "solved":
      return "本题已完成，不再需要提示。";
    case "no-target":
      return zone
        ? `「${zone.name}」内已没有可提示的格子，提示不会跳到其他区域扣费。可以切换区域，或先检查当前标记。`
        : "全盘已没有可提示的格子，提示额度不会被消耗。";
  }
}

/** Live context for the helper panel. */
export function hintScopeNote(
  puzzle: Puzzle,
  session: Session,
  zone: Zone | null,
): string {
  if (!zone) return "未选择区域，提示会从全盘中揭示一格。";
  const open = zoneUnsettled(session, puzzle.size, zone);
  return `只在「${zone.name}」内揭示一格，该区域还有 ${open} 格未定。`;
}
