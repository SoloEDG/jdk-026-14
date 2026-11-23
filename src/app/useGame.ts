import { useEffect, useReducer, useState, useRef, useMemo } from "react";
import { findPuzzle, puzzles } from "../features/catalog";
import {
  checkMessage,
  checkScopeLabel,
  checkStatus,
  hintMessage,
  hintScopeNote,
  inspectRegion,
  resolveHint,
  HINT_LIMIT,
} from "../features/assist";
import { loadDocument, saveDocument } from "../features/journal";
import {
  activeZone,
  currentView,
  nextZoneName,
  windowSpan,
  ZONE_LIMIT,
} from "../features/zones";
import type { ZoneRect } from "../shared/types";
import { transition } from "./reducer";

export function useGame() {
  const [initial] = useState(() => loadDocument(puzzles));
  const [document, dispatch] = useReducer(
    (d: typeof initial.document, a: Parameters<typeof transition>[1]) =>
      transition(d, a, puzzles),
    initial.document,
  );
  const [message, setMessage] = useState(initial.warning);
  const [saveState, setSaveState] = useState(
    initial.warning ? "手动保存" : "进度已保存",
  );
  const allowSave = useRef(!initial.warning);
  const puzzle = findPuzzle(document.activeId);
  const session = document.sessions[puzzle.id];
  const zone = useMemo(() => activeZone(session), [session]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (globalThis.document.visibilityState === "visible")
        dispatch({ type: "tick" });
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!allowSave.current) return;
    const timer = setTimeout(
      () =>
        setSaveState(
          saveDocument(document) ? "进度已保存" : "保存失败 · 点击重试",
        ),
      300,
    );
    return () => clearTimeout(timer);
  }, [document]);

  const save = () => {
    allowSave.current = true;
    setSaveState(saveDocument(document) ? "进度已保存" : "保存失败 · 点击重试");
  };

  /** Hints resolve against the focused region only; never elsewhere. */
  const hint = () => {
    const result = resolveHint(puzzle, session, zone);
    if (result.ok) dispatch({ type: "hint", ...result.hint });
    setMessage(hintMessage(result, puzzle, zone));
  };

  /**
   * The check compares the whole board and only narrows what it reports to
   * the focused region. Its stored result is stamped with the region and
   * viewport, so later moves cannot re-apply it to new coordinates.
   */
  const check = () => {
    const report = inspectRegion(puzzle, session, zone ?? null);
    dispatch({ type: "check", zoneId: zone?.id ?? null });
    setMessage(checkMessage(report, checkScopeLabel(zone), false));
  };

  const open = (id: string, zoneId?: string | null) => {
    dispatch({ type: "open", id, zoneId });
    setMessage("");
  };

  const status = checkStatus(session);
  const span = windowSpan(puzzle.size, currentView(session).zoom);
  const hintNote = hintScopeNote(puzzle, session, zone);

  /**
   * Saves the visible window as a named region. The region remembers exactly
   * the viewport it was created from, so resuming it later lands where the
   * solver was looking.
   */
  const createZone = () => {
    if (session.zones.length >= ZONE_LIMIT) {
      setMessage(`最多保存 ${ZONE_LIMIT} 个观察区域，可以先删除不再需要的区域。`);
      return;
    }
    const view = currentView(session);
    const rect = {
      row: view.row,
      col: view.col,
      rows: span,
      cols: span,
    };
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `zone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    dispatch({
      type: "zone-add",
      id,
      name: nextZoneName(session),
      rect,
      view,
    });
    setMessage(
      "已保存当前视图。可以重命名、用 −/+ 调整范围，或继续平移到想要的位置。",
    );
  };

  return {
    document,
    puzzle,
    session,
    zone,
    message,
    saveState,
    status,
    hintNote,
    span,
    dispatch,
    save,
    hint,
    check,
    open,
    createZone,
    clearMessage: () => setMessage(""),
    focusZone: (id: string | null) => dispatch({ type: "zone-select", id }),
    view: (view: typeof session.view) => dispatch({ type: "view", view }),
    renameZone: (id: string, name: string) =>
      dispatch({ type: "zone-rename", id, name }),
    reshapeZone: (id: string, rect: ZoneRect) =>
      dispatch({ type: "zone-reshape", id, rect }),
    removeZone: (id: string) => dispatch({ type: "zone-remove", id }),
    hintLimit: HINT_LIMIT,
  };
}
