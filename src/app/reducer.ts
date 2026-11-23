import type { GameAction, GameDocument, Puzzle, Session } from "../shared/types";
import { isSolved, newSession } from "../shared/document";
import { applyMark, undoMark } from "../features/board";
import { HINT_LIMIT } from "../features/assist";
import { inspectRegion } from "../features/assist/lib/inspect";
import { registerSolve } from "../features/journal";
import {
  activeZone,
  clampRect,
  clampViewport,
  containsCell,
  currentView,
  sanitizeZoneName,
  sameRect,
  ZONE_LIMIT,
} from "../features/zones";

/**
 * Reset clears marks, timer and quota but keeps observation regions: they
 * are navigation, not progress, and silently losing the solver's named
 * places would be a surprising side effect of "重新开始".
 */
function resetKeepingZones(puzzle: Puzzle, session: Session): Session {
  return {
    ...newSession(puzzle),
    zones: session.zones,
    activeZoneId: session.activeZoneId,
    view: session.view,
  };
}

/**
 * When marks change, the highlighted wrong cells must be recomputed too.
 * The region and viewport stamps stay as they are -- the result still belongs
 * to the same framing, only the board underneath it moved.
 */
function reconcileCheck(
  puzzle: Puzzle,
  before: Session,
  after: Session,
): Session {
  if (!after.check || after.marks === before.marks) return after;
  const report = inspectRegion(puzzle, after, after.check.rect);
  return {
    ...after,
    check: {
      ...after.check,
      errors: report.errors,
      indices: report.indices,
      lineIssues: report.lineIssues,
    },
  };
}

export function transition(
  document: GameDocument,
  action: GameAction,
  puzzles: Puzzle[],
): GameDocument {
  const puzzle = puzzles.find((p) => p.id === document.activeId)!;
  const current = document.sessions[puzzle.id];
  if (action.type === "open") {
    const target = puzzles.find((p) => p.id === action.id);
    if (!target) return document;
    const existing = document.sessions[target.id] ?? newSession(target);
    const zoneId =
      action.zoneId != null &&
      existing.zones.some((zone) => zone.id === action.zoneId)
        ? action.zoneId
        : undefined;
    return {
      ...document,
      activeId: target.id,
      sessions: {
        ...document.sessions,
        [target.id]:
          zoneId === undefined
            ? existing
            : { ...existing, activeZoneId: zoneId },
      },
    };
  }

  let next = current;

  if (action.type === "mark")
    next = applyMark(current, action.index, action.mark);

  if (action.type === "undo") next = undoMark(current);

  if (action.type === "hint" && current.hints < HINT_LIMIT && !current.solved) {
    const zone = action.zoneId
      ? (current.zones.find((z) => z.id === action.zoneId) ?? null)
      : null;
    // A reference to a deleted region, or to a cell outside the referenced
    // region, must never spend the shared quota -- in particular it must not
    // silently reveal a cell somewhere else on the board.
    if (action.zoneId != null) {
      if (!zone) return document;
      if (!containsCell(puzzle.size, zone, action.index)) return document;
    }
    const marked = applyMark(current, action.index, action.mark);
    if (marked !== current) next = { ...marked, hints: current.hints + 1 };
  }

  if (action.type === "check" && !current.solved) {
    const zone = action.zoneId
      ? (current.zones.find((z) => z.id === action.zoneId) ?? null)
      : null;
    if (action.zoneId != null && !zone) return document;
    // Judging always reads the full board; the rectangle only limits which
    // cells are *reported*. A region edge is never treated as a blank cell.
    const report = inspectRegion(puzzle, current, zone);
    next = {
      ...current,
      checks: current.checks + 1,
      check: {
        zoneId: zone?.id ?? null,
        rect: zone
          ? { row: zone.row, col: zone.col, rows: zone.rows, cols: zone.cols }
          : null,
        view: { ...currentView(current) },
        errors: report.errors,
        indices: report.indices,
        lineIssues: report.lineIssues,
        at: Date.now(),
      },
    };
  }

  if (action.type === "view") {
    const view = clampViewport(puzzle.size, action.view);
    const zone = activeZone(current);
    // Moving the view does not erase the last check, but it does make its
    // stored coordinates inapplicable; checkStatus() reports it as stale.
    next = zone
      ? {
          ...current,
          zones: current.zones.map((z) =>
            z.id === zone.id ? { ...z, view } : z,
          ),
        }
      : { ...current, view };
  }

  if (action.type === "zone-add" && !current.solved) {
    if (current.zones.length >= ZONE_LIMIT) return document;
    const rect = clampRect(puzzle.size, action.rect);
    const zone = {
      id: action.id,
      name: sanitizeZoneName(action.name, `观察区 ${current.zones.length + 1}`),
      ...rect,
      view: clampViewport(puzzle.size, action.view),
    };
    next = {
      ...current,
      activeZoneId: zone.id,
      zones: [...current.zones, zone],
    };
  }

  if (action.type === "zone-select") {
    if (
      action.id !== null &&
      !current.zones.some((zone) => zone.id === action.id)
    )
      return document;
    next = { ...current, activeZoneId: action.id };
  }

  if (action.type === "zone-rename") {
    const name = sanitizeZoneName(action.name, "");
    if (!name || !current.zones.some((zone) => zone.id === action.id))
      return document;
    next = {
      ...current,
      zones: current.zones.map((zone) =>
        zone.id === action.id ? { ...zone, name } : zone,
      ),
    };
  }

  if (action.type === "zone-reshape") {
    const zone = current.zones.find((z) => z.id === action.id);
    const rect = clampRect(puzzle.size, action.rect);
    if (!zone || sameRect(zone, rect)) return document;
    // Resizing only moves the region border. Marks, hint quota and counters
    // live on the session, not on the region, and are left untouched.
    next = {
      ...current,
      zones: current.zones.map((z) =>
        z.id === action.id ? { ...z, ...rect } : z,
      ),
    };
  }

  if (action.type === "zone-remove") {
    if (!current.zones.some((zone) => zone.id === action.id)) return document;
    // Deleting a region removes only the named view. Marks and the shared
    // hint quota are session state and are deliberately left alone.
    next = {
      ...current,
      zones: current.zones.filter((zone) => zone.id !== action.id),
      activeZoneId:
        current.activeZoneId === action.id ? null : current.activeZoneId,
    };
  }

  if (action.type === "tick" && !current.solved)
    next = { ...current, seconds: current.seconds + 1 };

  if (action.type === "reset") next = resetKeepingZones(puzzle, current);

  if (next === current) return document;

  next = reconcileCheck(puzzle, current, next);
  next = { ...next, solved: isSolved(puzzle, next) };
  const withRecord = registerSolve(document, puzzle, next);
  return {
    ...withRecord,
    sessions: { ...withRecord.sessions, [puzzle.id]: next },
  };
}
