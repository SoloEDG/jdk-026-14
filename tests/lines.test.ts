import { test } from "node:test";
import assert from "node:assert/strict";
import { lineFeasible, regionLineConflicts } from "../src/features/assist/lib/lineCheck";
import { inspectRegion } from "../src/features/assist";
import { newSession } from "../src/shared/document";
import type { Mark, Puzzle } from "../src/shared/types";

/** A 5-wide single-row puzzle whose only run is 3 cells starting at column 1. */
const rowPuzzle: Puzzle = {
  id: "row-test",
  title: "横线",
  collection: "测试",
  level: "入门",
  size: 5,
  solution: [0, 1, 1, 1, 0],
  color: "#000",
};

const unknown = (): Mark[] => Array(5).fill("unknown");

test("line feasibility respects runs that touch unknown and crossed neighbours", () => {
  const clue = [3];
  assert.equal(lineFeasible(clue, unknown()), true);

  const crossAt0 = unknown();
  crossAt0[0] = "cross";
  assert.equal(lineFeasible(clue, crossAt0), true);

  const pinned = ["cross", "unknown", "unknown", "cross", "cross"] as Mark[];
  assert.equal(lineFeasible(clue, pinned), false);

  const split = ["filled", "unknown", "unknown", "unknown", "filled"] as Mark[];
  assert.equal(lineFeasible(clue, split), false);

  assert.equal(lineFeasible([0], ["cross", "cross", "cross", "cross", "cross"]), true);
  assert.equal(lineFeasible([0], ["cross", "cross", "filled", "cross", "cross"]), false);
  assert.equal(
    lineFeasible([2, 1], ["filled", "filled", "cross", "filled", "unknown"]),
    true,
  );
  assert.equal(
    lineFeasible([2, 1], ["filled", "filled", "filled", "filled", "unknown"]),
    false,
  );
});

test("a region check uses cells outside the region to judge a crossing run", () => {
  const session = newSession(rowPuzzle);
  // The region covers only columns 1-2, and both are still unknown. Crosses
  // at columns 0 and 3 leave no room for the required run of three; that
  // contradiction is only visible when the line is read end to end.
  const rect = { row: 0, col: 1, rows: 1, cols: 2 };
  session.marks = ["cross", "unknown", "unknown", "cross", "unknown"];
  const report = inspectRegion(rowPuzzle, session, rect);
  assert.equal(report.errors, 0);
  assert.equal(regionLineConflicts(rowPuzzle, session.marks, rect), 1);
  assert.equal(report.lineIssues, 1);

  // Reading the same clipped region as a standalone 2-cell row would have
  // produced a false "2" run; the full-line reader reports no issue here.
  const correct = newSession(rowPuzzle);
  correct.marks = ["unknown", "filled", "filled", "filled", "unknown"];
  assert.equal(regionLineConflicts(rowPuzzle, correct.marks, rect), 0);
  assert.equal(
    inspectRegion(rowPuzzle, correct, rect).lineIssues,
    0,
  );
});

test("region line conflicts also catch impossible columns", () => {
  const columnPuzzle: Puzzle = {
    id: "col-test",
    title: "竖线",
    collection: "测试",
    level: "入门",
    size: 5,
    // Column 0 is "1 1 0 0 0" (clue 3); row 1 is "1 1 0 0 0" too.
    solution: [1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    color: "#000",
  };
  const session = newSession(columnPuzzle);
  // Crosses at rows 0 and 3 of column 0; every other cell is still open.
  session.marks = session.marks.map((_, i) =>
    i % 5 === 0 && (i / 5 === 0 || i / 5 === 3) ? "cross" : "unknown",
  );
  // Column 0 needs three filled cells; the crosses at rows 0 and 3 leave only
  // rows 1-2, which is impossible -- even though the checked region only
  // covers row 4.
  assert.equal(
    inspectRegion(columnPuzzle, session, { row: 4, col: 0, rows: 1, cols: 1 })
      .lineIssues,
    1,
  );
});
