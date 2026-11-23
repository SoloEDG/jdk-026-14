import type {
  Puzzle,
  Session,
  Viewport,
  Zone,
  ZoneRect,
} from "../../../shared/types";

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;
export const ZOOM_STEPS = [1, 1.25, 1.5, 2, 2.5, 3] as const;
export const ZONE_LIMIT = 12;
export const ZONE_NAME_LIMIT = 20;

export function clampInt(value: number, min: number, max: number): number {
  const number = Number.isFinite(value) ? Math.round(value) : min;
  return Math.min(max, Math.max(min, number));
}

export function clampZoom(value: number): number {
  const zoom = Number.isFinite(value) ? value : ZOOM_MIN;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

/** How many rows/columns are visible at a given zoom. */
export function windowSpan(size: number, zoom: number): number {
  return Math.max(
    1,
    Math.min(size, Math.ceil(size / clampZoom(zoom) - 1e-9)),
  );
}

export function clampRect(size: number, rect: ZoneRect): ZoneRect {
  const row = clampInt(rect.row, 0, size - 1);
  const col = clampInt(rect.col, 0, size - 1);
  return {
    row,
    col,
    rows: clampInt(rect.rows, 1, size - row),
    cols: clampInt(rect.cols, 1, size - col),
  };
}

/** Clamps a region and, if it is degenerate, falls back to a 2×2 default. */
export function clampRectOrFull(size: number, rect: ZoneRect): ZoneRect {
  return clampRect(size, {
    row: Number.isFinite(rect.row) ? rect.row : 0,
    col: Number.isFinite(rect.col) ? rect.col : 0,
    rows: Number.isFinite(rect.rows) && rect.rows > 0 ? rect.rows : 2,
    cols: Number.isFinite(rect.cols) && rect.cols > 0 ? rect.cols : 2,
  });
}

/** View row/col are the top-left cell offsets of the visible window. */
export function clampViewport(size: number, view: Viewport): Viewport {
  const zoom = clampZoom(view.zoom);
  const span = windowSpan(size, zoom);
  return {
    zoom,
    row: clampInt(view.row, 0, size - span),
    col: clampInt(view.col, 0, size - span),
  };
}

/** Zooms while keeping the middle of the visible window anchored. */
export function zoomViewport(
  size: number,
  view: Viewport,
  nextZoom: number,
): Viewport {
  const current = clampViewport(size, view);
  const zoom = clampZoom(nextZoom);
  const before = windowSpan(size, current.zoom);
  const after = windowSpan(size, zoom);
  return clampViewport(size, {
    zoom,
    row: current.row + Math.round((before - after) / 2),
    col: current.col + Math.round((before - after) / 2),
  });
}

export function paneViewport(
  size: number,
  view: Viewport,
  rowDelta: number,
  colDelta: number,
): Viewport {
  const current = clampViewport(size, view);
  return clampViewport(size, {
    ...current,
    row: current.row + rowDelta,
    col: current.col + colDelta,
  });
}

export function nextZoomStep(zoom: number, direction: -1 | 1): number {
  if (direction > 0)
    return ZOOM_STEPS.find((step) => step > zoom + 1e-6) ?? ZOOM_STEPS.at(-1)!;
  return [...ZOOM_STEPS].reverse().find((step) => step < zoom - 1e-6) ?? ZOOM_MIN;
}

/** A zoom that shows the whole region plus a little surrounding context. */
export function viewForRect(size: number, rect: ZoneRect): Viewport {
  const safe = clampRect(size, rect);
  const zoom = clampZoom(
    Math.min(
      size / (safe.rows + 1),
      size / (safe.cols + 1),
    ),
  );
  const span = windowSpan(size, zoom);
  return clampViewport(size, {
    zoom,
    row: safe.row - Math.floor((span - safe.rows) / 2),
    col: safe.col - Math.floor((span - safe.cols) / 2),
  });
}

export function sameRect(a: ZoneRect | null, b: ZoneRect | null): boolean {
  if (!a || !b) return a === b;
  return (
    a.row === b.row && a.col === b.col && a.rows === b.rows && a.cols === b.cols
  );
}

export function sameView(a: Viewport | null, b: Viewport | null): boolean {
  if (!a || !b) return a === b;
  return a.zoom === b.zoom && a.row === b.row && a.col === b.col;
}

export function containsCell(
  size: number,
  rect: ZoneRect,
  index: number,
): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= size * size) return false;
  const row = Math.floor(index / size);
  const col = index % size;
  return (
    row >= rect.row &&
    row < rect.row + rect.rows &&
    col >= rect.col &&
    col < rect.col + rect.cols
  );
}

export function cellsInRect(size: number, rect: ZoneRect): number[] {
  const cells: number[] = [];
  for (let row = rect.row; row < rect.row + rect.rows; row++)
    for (let col = rect.col; col < rect.col + rect.cols; col++)
      cells.push(row * size + col);
  return cells;
}

export function zoneById(session: Session, id: string | null): Zone | null {
  return id ? (session.zones.find((zone) => zone.id === id) ?? null) : null;
}

export function activeZone(session: Session): Zone | null {
  return zoneById(session, session.activeZoneId);
}

export function currentView(session: Session): Viewport {
  return activeZone(session)?.view ?? session.view;
}

export function zoneUnsettled(
  session: Session,
  size: number,
  zone: ZoneRect,
): number {
  return cellsInRect(size, zone).filter(
    (index) => session.marks[index] === "unknown",
  ).length;
}

export function zoneSettled(
  session: Session,
  size: number,
  zone: ZoneRect,
): number {
  return zone.rows * zone.cols - zoneUnsettled(session, size, zone);
}

export function zoneProgress(
  puzzle: Puzzle,
  session: Session,
  zone: ZoneRect,
) {
  const total = zone.rows * zone.cols;
  const unsettled = zoneUnsettled(session, puzzle.size, zone);
  return { unsettled, total, settled: total - unsettled };
}

/**
 * Clues for the rows and columns that intersect a region. These are always
 * the complete line clues from the full puzzle -- never recomputed from the
 * clipped region, which would turn a run crossing the border into a shorter
 * run.
 */
export function zoneClues(
  clues: number[][],
  size: number,
  rect: ZoneRect,
): { rows: number[][]; columns: number[][] } {
  return {
    rows: clues.slice(rect.row, rect.row + rect.rows),
    columns: clues.slice(size + rect.col, size + rect.col + rect.cols),
  };
}

/** Reads one complete board line, regardless of any region it intersects. */
export function lineForRegion<T>(
  size: number,
  values: readonly T[],
  kind: "row" | "col",
  index: number,
): T[] {
  return Array.from({ length: size }, (_, i) =>
    values[kind === "row" ? index * size + i : i * size + index],
  );
}

/** True when a region does not cover the whole board. */
export function isPartialRect(size: number, rect: ZoneRect): boolean {
  return rect.row > 0 || rect.col > 0 || rect.rows < size || rect.cols < size;
}

export function sanitizeZoneName(value: unknown, fallback: string): string {
  const name =
    typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return (name || fallback).slice(0, ZONE_NAME_LIMIT);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeView(value: unknown, size: number): Viewport {
  if (!isRecord(value)) return { zoom: 1, row: 0, col: 0 };
  return clampViewport(size, {
    zoom: Number(value.zoom) || 1,
    row: Number(value.row) || 0,
    col: Number(value.col) || 0,
  });
}

/**
 * Restores saved regions defensively. Identity (id + name) is preserved so a
 * reopen lands in the same named region; geometry and view are clamped to the
 * current puzzle size rather than trusted.
 */
export function sanitizeZones(value: unknown, size: number): Zone[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const zones: Zone[] = [];
  for (const raw of value) {
    if (zones.length >= ZONE_LIMIT || !isRecord(raw)) continue;
    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    if (!id || seen.has(id) || id.length > 64) continue;
    const rect = clampRect(size, {
      row: Number(raw.row) || 0,
      col: Number(raw.col) || 0,
      rows: Number(raw.rows) || 1,
      cols: Number(raw.cols) || 1,
    });
    seen.add(id);
    zones.push({
      id,
      name: sanitizeZoneName(raw.name, `观察区 ${zones.length + 1}`),
      ...rect,
      view: sanitizeView(raw.view, size),
    });
  }
  return zones;
}

export function nextZoneName(session: Session): string {
  for (let n = 1; n <= ZONE_LIMIT + 1; n++) {
    const name = `观察区 ${n}`;
    if (!session.zones.some((zone) => zone.name === name)) return name;
  }
  return `观察区 ${session.zones.length + 1}`;
}

export interface ZoneSummary {
  id: string;
  name: string;
  row: number;
  col: number;
  rows: number;
  cols: number;
  unsettled: number;
  total: number;
}

/**
 * Catalog summary: the open-cell count for every saved region. Regions keep
 * their identity across reloads, so these numbers can be shown on the puzzle's
 * resume entry before it is opened.
 */
export function zoneSummaries(puzzle: Puzzle, session: Session): ZoneSummary[] {
  return session.zones.map((zone) => {
    const progress = zoneProgress(puzzle, session, zone);
    return {
      id: zone.id,
      name: zone.name,
      row: zone.row,
      col: zone.col,
      rows: zone.rows,
      cols: zone.cols,
      unsettled: progress.unsettled,
      total: progress.total,
    };
  });
}
