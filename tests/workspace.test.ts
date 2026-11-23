import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { puzzles } from "../src/features/catalog/model/puzzles";
import { newDocument } from "../src/shared/document";
import { transition } from "../src/app/reducer";
import {
  resolveHint,
  hintMessage,
  inspectRegion,
  checkStatus,
} from "../src/features/assist";
import { loadDocument, saveDocument } from "../src/features/journal/lib/storage";
import {
  clampRect,
  clampViewport,
  currentView,
  cellsInRect,
  paneViewport,
  viewForRect,
  windowSpan,
  zoomViewport,
} from "../src/features/zones";
import type { GameDocument, Mark, ZoneRect } from "../src/shared/types";

Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
});
let stored: string | null = null;
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: () => stored,
    setItem: (_: string, value: string) => {
      stored = value;
    },
  },
  configurable: true,
});

const puzzle = puzzles.find((p) => p.id === "bloom")!;
const size = puzzle.size;

function addZone(
  doc: GameDocument,
  id: string,
  rect: ZoneRect,
  name = id,
  view = { zoom: 1, row: 0, col: 0 },
) {
  return transition(doc, { type: "zone-add", id, name, rect, view }, puzzles);
}

function markAllFilled(doc: GameDocument) {
  puzzle.solution.forEach((v, index) => {
    if (v)
      doc = transition(doc, { type: "mark", index, mark: "filled" }, puzzles);
  });
  return doc;
}

test("zoom and pan are clamped inside the board and keep the window in bounds", () => {
  const zoomed = zoomViewport(size, { zoom: 1, row: 0, col: 0 }, 2);
  assert.equal(zoomed.zoom, 2);
  const span = windowSpan(size, zoomed.zoom);
  assert.ok(span >= 1 && span < size);
  assert.ok(zoomed.row >= 0 && zoomed.row + span <= size);
  const panned = paneViewport(size, zoomed, 999, -999);
  assert.equal(panned.row, size - span);
  assert.equal(panned.col, 0);
  assert.deepEqual(clampViewport(size, { zoom: 99, row: -5, col: -5 }), {
    zoom: 3,
    row: 0,
    col: 0,
  });
});

test("regions keep identity, overlap freely and store their own view", () => {
  let doc = newDocument(puzzle);
  doc = addZone(doc, "a", { row: 0, col: 0, rows: 4, cols: 4 }, "左上角");
  doc = addZone(doc, "b", { row: 2, col: 2, rows: 5, cols: 5 }, "中心");
  const session = doc.sessions[puzzle.id];
  assert.equal(session.zones.length, 2);
  assert.equal(session.activeZoneId, "b");
  // Overlap is allowed; both regions observe the same shared marks.
  assert.ok(
    cellsInRect(size, { row: 2, col: 2, rows: 2, cols: 2 }).every(
      (i) =>
        cellsInRect(size, { row: 0, col: 0, rows: 4, cols: 4 }).includes(i) &&
        cellsInRect(size, { row: 2, col: 2, rows: 5, cols: 5 }).includes(i),
    ),
  );
  doc = transition(doc, { type: "mark", index: 2 * size + 2, mark: "filled" }, puzzles);
  assert.equal(doc.sessions[puzzle.id].marks[2 * size + 2], "filled");
  doc = transition(doc, { type: "zone-select", id: "a" }, puzzles);
  assert.deepEqual(currentView(doc.sessions[puzzle.id]), { zoom: 1, row: 0, col: 0 });
});

test("resume entry lists unsettled cells per region and returns to its view", () => {
  let doc = newDocument(puzzle);
  doc = addZone(doc, "a", { row: 0, col: 0, rows: 2, cols: 2 }, "角");
  doc = transition(doc, { type: "mark", index: 0, mark: "filled" }, puzzles);
  const session = doc.sessions[puzzle.id];
  const zone = session.zones[0];
  // 2x2 region, one mark => three unsettled cells.
  const unsettled = cellsInRect(size, zone).filter(
    (i) => session.marks[i] === "unknown",
  ).length;
  assert.equal(unsettled, 3);
  // Saving and reloading keeps the region's identity and its stored view.
  doc = transition(
    doc,
    { type: "view", view: { zoom: 2, row: 1, col: 1 } },
    puzzles,
  );
  const view = currentView(doc.sessions[puzzle.id]);
  stored = null;
  assert.ok(saveDocument(doc));
  const reopened = loadDocument(puzzles).document;
  const restored = reopened.sessions[puzzle.id];
  assert.equal(restored.zones[0].id, "a");
  assert.equal(restored.activeZoneId, "a");
  assert.deepEqual(restored.zones[0].view, clampViewport(size, view));
  assert.deepEqual(restored.marks, doc.sessions[puzzle.id].marks);
});

test("hint only reveals a cell inside the focused region and never elsewhere", () => {
  let doc = newDocument(puzzle);
  const rect = { row: 5, col: 0, rows: 2, cols: 2 };
  doc = addZone(doc, "z", rect, "下方");
  const session = doc.sessions[puzzle.id];
  const zone = session.zones[0];
  const before = session.marks.slice();
  const result = resolveHint(puzzle, session, zone);
  assert.ok(result.ok);
  const index = result.hint.index;
  assert.ok(cellsInRect(size, rect).includes(index));
  doc = transition(doc, { type: "hint", ...result.hint }, puzzles);
  const after = doc.sessions[puzzle.id];
  assert.equal(
    after.marks.filter((m, i) => m !== before[i]).length,
    1,
  );
  assert.equal(after.hints, 1);
  // Now fill the entire region so only outside cells remain hintable.
  for (const i of cellsInRect(size, rect)) {
    if (after.marks[i] === "unknown")
      doc = transition(doc, { type: "mark", index: i, mark: "cross" }, puzzles);
  }
  const exhausted = doc.sessions[puzzle.id];
  const zoneNow = exhausted.zones[0];
  const failure = resolveHint(puzzle, exhausted, zoneNow);
  // Marks outside the region are still open, but the hint must not reach them.
  assert.equal(failure.ok, false);
  assert.equal(failure.ok === false && failure.reason, "no-target");
  assert.match(hintMessage(failure, puzzle, zoneNow), /不会跳到其他区域扣费/);
  const hintsBefore = exhausted.hints;
  const afterFailure = transition(
    doc,
    { type: "hint", index: 0, mark: "filled", zoneId: zoneNow.id },
    puzzles,
  );
  assert.equal(afterFailure.sessions[puzzle.id].hints, hintsBefore);
});

test("hint quota is shared across regions and out-of-region targets are rejected", () => {
  let doc = newDocument(puzzle);
  doc = addZone(doc, "a", { row: 0, col: 0, rows: 3, cols: 3 }, "A");
  doc = addZone(doc, "b", { row: 3, col: 3, rows: 3, cols: 3 }, "B");
  let session = doc.sessions[puzzle.id];
  for (const zone of [session.zones[0], session.zones[1]]) {
    const result = resolveHint(puzzle, session, zone);
    assert.ok(result.ok);
    doc = transition(doc, { type: "hint", ...result.hint }, puzzles);
    session = doc.sessions[puzzle.id];
  }
  assert.equal(session.hints, 2);
  // A stale region reference / out-of-region cell must not spend quota.
  const rejected = transition(
    doc,
    { type: "hint", index: 9 * size + 9, mark: "filled", zoneId: "a" },
    puzzles,
  );
  assert.equal(rejected.sessions[puzzle.id].hints, 2);
  const missingRegion = transition(
    doc,
    { type: "hint", index: 0, mark: "filled", zoneId: "nope" },
    puzzles,
  );
  assert.equal(missingRegion.sessions[puzzle.id].hints, 2);
});

test("deleting a region keeps marks and does not refund hints", () => {
  let doc = newDocument(puzzle);
  doc = addZone(doc, "a", { row: 0, col: 0, rows: 3, cols: 3 }, "A");
  let session = doc.sessions[puzzle.id];
  const hint = resolveHint(puzzle, session, session.zones[0]);
  assert.ok(hint.ok);
  doc = transition(doc, { type: "hint", ...hint.hint }, puzzles);
  const marks = doc.sessions[puzzle.id].marks.slice();
  doc = transition(doc, { type: "zone-remove", id: "a" }, puzzles);
  session = doc.sessions[puzzle.id];
  assert.equal(session.zones.length, 0);
  assert.equal(session.activeZoneId, null);
  assert.equal(session.hints, 1);
  assert.deepEqual(session.marks, marks);
});

test("region check reports only inside the rectangle but reads cross-border runs whole", () => {
  let doc = newDocument(puzzle);
  // A run that crosses the region's right edge: fill the whole row 2 answer.
  const rect = { row: 2, col: 0, rows: 1, cols: 2 };
  doc = addZone(doc, "z", rect, "边缘");
  for (let col = 0; col < size; col++) {
    if (puzzle.solution[2 * size + col])
      doc = transition(
        doc,
        { type: "mark", index: 2 * size + col, mark: "filled" },
        puzzles,
      );
  }
  const session = doc.sessions[puzzle.id];
  const report = inspectRegion(puzzle, session, session.zones[0]);
  // The correctly filled row is complete, so the cross-border run is not
  // treated as a truncated run and no line issue is reported.
  assert.equal(report.lineIssues, 0);
  assert.equal(report.errors, 0);
  // A wrong mark outside the region is invisible to a region check...
  doc = transition(doc, { type: "mark", index: 9 * size + 0, mark: "filled" }, puzzles);
  const scoped = inspectRegion(puzzle, doc.sessions[puzzle.id], doc.sessions[puzzle.id].zones[0]);
  const global = inspectRegion(puzzle, doc.sessions[puzzle.id], null);
  assert.equal(scoped.errors, 0);
  assert.ok(global.errors > 0);
});

test("check result goes stale when the region or view it describes moves", () => {
  let doc = newDocument(puzzle);
  doc = addZone(doc, "z", { row: 0, col: 0, rows: 3, cols: 3 }, "Z");
  doc = transition(doc, { type: "check", zoneId: "z" }, puzzles);
  assert.equal(checkStatus(doc.sessions[puzzle.id]), "fresh");
  const before = doc.sessions[puzzle.id].check;
  assert.ok(before);
  // Moving the view invalidates the stored result.
  doc = transition(
    doc,
    { type: "view", view: { zoom: 2, row: 2, col: 2 } },
    puzzles,
  );
  assert.equal(checkStatus(doc.sessions[puzzle.id]), "stale");
  // Resizing the region also invalidates it.
  doc = transition(
    doc,
    { type: "zone-reshape", id: "z", rect: { row: 0, col: 0, rows: 4, cols: 4 } },
    puzzles,
  );
  assert.equal(checkStatus(doc.sessions[puzzle.id]), "stale");
});

test("new marks refresh the highlighted check errors inside the same framing", () => {
  let doc = newDocument(puzzle);
  doc = addZone(doc, "z", { row: 0, col: 0, rows: 3, cols: 3 }, "Z");
  doc = transition(doc, { type: "check", zoneId: "z" }, puzzles);
  assert.equal(doc.sessions[puzzle.id].check?.errors, 0);
  // A wrong fill inside the region must show up without re-running the check.
  const wrongIndex = cellsInRect(size, { row: 0, col: 0, rows: 3, cols: 3 }).find(
    (i) => !puzzle.solution[i],
  )!;
  doc = transition(
    doc,
    { type: "mark", index: wrongIndex, mark: "filled" },
    puzzles,
  );
  assert.equal(checkStatus(doc.sessions[puzzle.id]), "fresh");
  assert.deepEqual(doc.sessions[puzzle.id].check?.indices, [wrongIndex]);
  // Moving the view still goes stale, and the highlight disappears.
  doc = transition(
    doc,
    { type: "view", view: { zoom: 2, row: 1, col: 1 } },
    puzzles,
  );
  assert.equal(checkStatus(doc.sessions[puzzle.id]), "stale");
  assert.equal(doc.sessions[puzzle.id].check?.indices.length, 1);
});

test("completion still requires the whole board, even with regions present", () => {
  let doc = newDocument(puzzle);
  doc = addZone(doc, "almost", { row: 0, col: 0, rows: 2, cols: 2 }, "几乎完成");
  for (const i of cellsInRect(size, doc.sessions[puzzle.id].zones[0])) {
    if (puzzle.solution[i])
      doc = transition(doc, { type: "mark", index: i, mark: "filled" }, puzzles);
  }
  assert.equal(doc.sessions[puzzle.id].solved, false);
  assert.equal(doc.records.length, 0);
  doc = markAllFilled(doc);
  assert.equal(doc.sessions[puzzle.id].solved, true);
  assert.equal(doc.records.length, 1);
  // Regions are navigation, so they survive the solve.
  assert.equal(doc.sessions[puzzle.id].zones.length, 1);
});

test("resuming a specific region selects it without touching the marks", () => {
  let doc = newDocument(puzzle);
  doc = addZone(doc, "a", { row: 0, col: 0, rows: 2, cols: 2 }, "A");
  doc = addZone(doc, "b", { row: 4, col: 4, rows: 2, cols: 2 }, "B");
  const marks = doc.sessions[puzzle.id].marks.slice();
  doc = transition(
    doc,
    { type: "open", id: puzzles[1].id },
    puzzles,
  );
  doc = transition(
    doc,
    { type: "open", id: puzzle.id, zoneId: "a" },
    puzzles,
  );
  assert.equal(doc.activeId, puzzle.id);
  assert.equal(doc.sessions[puzzle.id].activeZoneId, "a");
  assert.deepEqual(doc.sessions[puzzle.id].marks, marks);
  // Opening with an unknown region id keeps the previous focus.
  doc = transition(doc, { type: "open", id: puzzle.id, zoneId: "missing" }, puzzles);
  assert.equal(doc.sessions[puzzle.id].activeZoneId, "a");
});

test("reload keeps region identity but never restores stale check results", () => {
  stored = null;
  let doc = newDocument(puzzle);
  doc = addZone(doc, "keep", { row: 1, col: 1, rows: 3, cols: 3 }, "保留区");
  doc = transition(doc, { type: "check", zoneId: "keep" }, puzzles);
  assert.ok(doc.sessions[puzzle.id].check);
  assert.ok(saveDocument(doc));
  const restored = loadDocument(puzzles).document.sessions[puzzle.id];
  assert.deepEqual(
    restored.zones.map((z) => ({ id: z.id, name: z.name })),
    [{ id: "keep", name: "保留区" }],
  );
  assert.equal(restored.activeZoneId, "keep");
  assert.equal(restored.check, null);
});

test("regions are clamped to the board and malformed saved zones are dropped", () => {
  assert.deepEqual(clampRect(size, { row: -3, col: 8, rows: 99, cols: 0 }), {
    row: 0,
    col: 8,
    rows: size,
    cols: 1,
  });
  stored = JSON.stringify({
    version: 1,
    activeId: puzzle.id,
    records: [],
    sessions: {
      [puzzle.id]: {
        marks: Array(size * size).fill("unknown") as Mark[],
        hints: 1,
        checks: 0,
        seconds: 5,
        zones: [
          { id: "ok", name: "<b>区域</b>  ", row: 2, col: 2, rows: 2, cols: 2, view: { zoom: 2.5, row: 1, col: 1 } },
          { id: "ok", name: "duplicate id" },
          { id: "", name: "no id" },
          "junk",
        ],
        activeZoneId: "ok",
      },
    },
  });
  const restored = loadDocument(puzzles).document.sessions[puzzle.id];
  assert.equal(restored.zones.length, 1);
  const zone = restored.zones[0];
  assert.equal(zone.id, "ok");
  assert.equal(zone.name, "<b>区域</b>");
  assert.equal(zone.view.zoom, 2.5);
  assert.deepEqual(viewForRect(size, zone).zoom >= 1, true);
});
