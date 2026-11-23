import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { webcrypto } from "node:crypto";
import { App } from "../src/app/App";
import { BoardPanel } from "../src/features/board";
import { ZonePanel } from "../src/features/zones/ui/ZonePanel";
import { puzzles } from "../src/features/catalog/model/puzzles";
import { newSession } from "../src/shared/document";
import type { Session } from "../src/shared/types";

Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
});
Object.defineProperty(globalThis, "localStorage", {
  value: { getItem: () => null, setItem: () => {} },
  configurable: true,
});

const puzzle = puzzles[0];

function sessionWithZones(): Session {
  const session = newSession(puzzle);
  return {
    ...session,
    zones: [
      {
        id: "a",
        name: "边缘 & <测试>",
        row: 2,
        col: 1,
        rows: 3,
        cols: 3,
        view: { zoom: 2, row: 1, col: 1 },
      },
    ],
    activeZoneId: "a",
  };
}

test("app renders with the workspace shell and catalog", () => {
  const html = renderToStaticMarkup(createElement(App));
  assert.match(html, /观察区域/);
  assert.match(html, /保存当前视图/);
  assert.match(html, /全盘定位/);
  assert.match(html, /求助范围/);
});

test("board renders a zoomed window and escapes region names", () => {
  const session = sessionWithZones();
  const html = renderToStaticMarkup(
    createElement(BoardPanel, {
      puzzle,
      session,
      onMark: () => {},
      onUndo: () => {},
      onReset: () => {},
      onView: () => {},
      onFocusZone: () => {},
      onCreateZone: () => {},
      onRenameZone: () => {},
      onReshapeZone: () => {},
      onRemoveZone: () => {},
      onCheck: () => {},
    }),
  );
  // Zoom 2 shows half the 10x10 board, so rows/cols 2..6 appear and 9 does not.
  assert.match(html, /第 2–6 行/);
  assert.match(html, /边缘 &amp; &lt;测试&gt;/);
  assert.doesNotMatch(html, /第 7–11 行/);
});

test("zone panel exposes per-region unsettled counts and no quota controls", () => {
  const session = sessionWithZones();
  const html = renderToStaticMarkup(
    createElement(ZonePanel, {
      puzzle,
      session,
      zone: session.zones[0],
      onFocusZone: () => {},
      onCreateZone: () => {},
      onRenameZone: () => {},
      onReshapeZone: () => {},
      onRemoveZone: () => {},
      onView: () => {},
      onCheck: () => {},
    }),
  );
  assert.match(html, /未定格/);
  assert.match(html, /检查此区/);
  assert.match(html, /保留标记与提示额度/);
  assert.doesNotMatch(html, /提示 \+1/);
});
