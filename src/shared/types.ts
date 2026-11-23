export type Mark = "unknown" | "filled" | "cross";
export type Tool = "filled" | "cross" | "unknown";

/**
 * A saved position on the board: the top-left cell shown in the viewport and
 * a zoom multiplier. Zoom 1 shows the whole board; higher zoom shows fewer
 * cells at a larger scale, with panning to reach the rest.
 */
export interface Viewport {
  zoom: number;
  row: number;
  col: number;
}

/** An inclusive-exclusive rectangle of board cells (0-based). */
export interface ZoneRect {
  row: number;
  col: number;
  rows: number;
  cols: number;
}

/**
 * A named observation region. It owns no marks and no quota: just a saved
 * rectangle plus a saved viewport. Regions may overlap and always share the
 * board's marks and the puzzle's hint budget.
 */
export interface Zone extends ZoneRect {
  id: string;
  name: string;
  /** Where the solver left this region, restored on reopen. */
  view: Viewport;
}

/** A check result stamped with the region rectangle and view it describes. */
export interface CheckResult {
  zoneId: string | null;
  rect: ZoneRect | null;
  view: Viewport;
  errors: number;
  /** Board indices of wrong marks inside the checked region. */
  indices: number[];
  /** Intersecting lines whose full-line runs contradict their clues. */
  lineIssues: number;
  at: number;
}

export interface Puzzle {
  id: string;
  title: string;
  collection: string;
  level: "入门" | "进阶" | "挑战";
  size: number;
  solution: number[];
  color: string;
}

export interface Move {
  index: number;
  before: Mark;
  after: Mark;
}

export interface Session {
  puzzleId: string;
  marks: Mark[];
  moves: Move[];
  hints: number;
  checks: number;
  seconds: number;
  solved: boolean;
  updatedAt: number;
  /** Named observation regions for this puzzle. */
  zones: Zone[];
  /** Focused region, or null when working on the whole board. */
  activeZoneId: string | null;
  /** Position of the whole-board view, used when no region is focused. */
  view: Viewport;
  /** Last check result; only valid for its own region and viewport. */
  check: CheckResult | null;
}

export interface SolveRecord {
  id: string;
  puzzleId: string;
  seconds: number;
  hints: number;
  checks: number;
  finishedAt: number;
}

export interface GameDocument {
  version: 1;
  activeId: string;
  sessions: Record<string, Session>;
  records: SolveRecord[];
}

export type GameAction =
  | { type: "open"; id: string; zoneId?: string | null }
  | { type: "mark"; index: number; mark: Mark }
  | { type: "undo" }
  | { type: "hint"; index: number; mark: Mark; zoneId?: string | null }
  | { type: "check"; zoneId?: string | null }
  | { type: "view"; view: Viewport }
  | {
      type: "zone-add";
      id: string;
      name: string;
      rect: ZoneRect;
      view: Viewport;
    }
  | { type: "zone-select"; id: string | null }
  | { type: "zone-rename"; id: string; name: string }
  | { type: "zone-reshape"; id: string; rect: ZoneRect }
  | { type: "zone-remove"; id: string }
  | { type: "tick" }
  | { type: "reset" };
