import { useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  MousePointer2,
  Plus,
  ScanSearch,
} from "lucide-react";
import { clueSet } from "../../../shared/clues";
import type { Puzzle, Session, Tool, ZoneRect } from "../../../shared/types";
import { completion } from "../../../shared/document";
import { lineStatuses } from "../lib/lineStatus";
import { BoardToolbar } from "./BoardToolbar";
import { Clue } from "./Clue";
import { MiniMap } from "./MiniMap";
import { ZonePanel } from "../../zones/ui/ZonePanel";
import { freshCheck } from "../../assist";
import {
  activeZone,
  clampViewport,
  containsCell,
  nextZoomStep,
  paneViewport,
  viewForRect,
  windowSpan,
  zoneProgress,
  zoomViewport,
  ZOOM_MAX,
  ZOOM_MIN,
} from "../../zones";

export function BoardPanel({
  puzzle,
  session,
  onMark,
  onUndo,
  onReset,
  onView,
  onFocusZone,
  onCreateZone,
  onRenameZone,
  onReshapeZone,
  onRemoveZone,
  onCheck,
}: {
  puzzle: Puzzle;
  session: Session;
  onMark: (i: number, tool: Tool) => void;
  onUndo: () => void;
  onReset: () => void;
  onView: (view: Session["view"]) => void;
  onFocusZone: (id: string | null) => void;
  onCreateZone: () => void;
  onRenameZone: (id: string, name: string) => void;
  onReshapeZone: (id: string, rect: ZoneRect) => void;
  onRemoveZone: (id: string) => void;
  onCheck: () => void;
}) {
  const [tool, setTool] = useState<Tool>("filled");
  const clues = clueSet(puzzle.size, puzzle.solution);
  const statuses = lineStatuses(puzzle, session.marks);
  const zone = activeZone(session);
  const view = zone ? zone.view : session.view;
  const span = windowSpan(puzzle.size, view.zoom);
  // Zooming shows fewer cells at a larger scale. The cell is capped so the
  // grid still fits the panel width instead of spilling past it.
  const cell = Math.max(
    16,
    Math.min(Math.round(30 * view.zoom), Math.floor(360 / span)),
  );
  // A check is only highlighted when it still matches this region and view.
  const check = freshCheck(session);
  const wrong = new Set(check?.indices ?? []);
  const progress = zone ? zoneProgress(puzzle, session, zone) : null;
  const rows = Array.from({ length: span }, (_, i) => view.row + i);
  const cols = Array.from({ length: span }, (_, i) => view.col + i);
  const drag = useRef<{
    x: number;
    y: number;
    row: number;
    col: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const [panning, setPanning] = useState(false);

  const setView = (next: Session["view"]) =>
    onView(clampViewport(puzzle.size, next));
  const pan = (dRow: number, dCol: number) =>
    setView(paneViewport(puzzle.size, view, dRow, dCol));
  const zoom = (direction: -1 | 1) =>
    setView(zoomViewport(puzzle.size, view, nextZoomStep(view.zoom, direction)));
  const fit = () =>
    setView(zone ? viewForRect(puzzle.size, zone) : { zoom: 1, row: 0, col: 0 });

  return (
    <section className="board-panel panel">
      <div className="board-heading">
        <div>
          <span className="eyebrow">
            A LITTLE DISCOVERY · {puzzle.collection}
          </span>
          <h1>
            {session.solved ? puzzle.title : "一格一格，拼出惊喜"}
            <span className="level-tag">{puzzle.level}</span>
          </h1>
        </div>
        <div className="timer">
          <Clock3 size={15} />
          {Math.floor(session.seconds / 60)
            .toString()
            .padStart(2, "0")}
          :{(session.seconds % 60).toString().padStart(2, "0")}
        </div>
      </div>

      <BoardToolbar
        tool={tool}
        onTool={setTool}
        onUndo={onUndo}
        onReset={onReset}
        canUndo={session.moves.length > 0}
        disabled={session.solved}
        onZoomIn={() => zoom(1)}
        onZoomOut={() => zoom(-1)}
        onFit={fit}
        canZoomIn={view.zoom < ZOOM_MAX}
        canZoomOut={view.zoom > ZOOM_MIN}
      />

      <div className="zone-strip">
        <div className="zone-strip-tabs" role="tablist" aria-label="观察区域">
          <button
            role="tab"
            aria-selected={!zone}
            className={!zone ? "active" : ""}
            onClick={() => onFocusZone(null)}
          >
            全盘
          </button>
          {session.zones.map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={zone?.id === item.id}
              className={zone?.id === item.id ? "active" : ""}
              onClick={() => onFocusZone(item.id)}
              title={`第 ${item.row + 1}–${item.row + item.rows} 行，第 ${item.col + 1}–${item.col + item.cols} 列`}
            >
              {item.name}
              <span className="zone-strip-count">
                {zoneProgress(puzzle, session, item).unsettled}
              </span>
            </button>
          ))}
        </div>
        <button
          className="zone-create"
          onClick={onCreateZone}
          disabled={session.solved}
        >
          <Plus size={13} /> 保存当前视图
        </button>
      </div>
      {zone && (
        <p className="zone-focus-note">
          正在观察「{zone.name}」· 区域只是取景框，线索与判断始终读取完整行列
        </p>
      )}

      <div
        className={`board-stage ${panning ? "panning" : ""}`}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          if ((e.target as HTMLElement).closest("button")) return;
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            row: view.row,
            col: view.col,
            moved: false,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const start = drag.current;
          if (!start) return;
          if (
            !start.moved &&
            (Math.abs(e.clientX - start.x) > 4 ||
              Math.abs(e.clientY - start.y) > 4)
          ) {
            start.moved = true;
            suppressClick.current = true;
            setPanning(true);
          }
          if (!start.moved) return;
          const dCol = Math.round((start.x - e.clientX) / cell);
          const dRow = Math.round((start.y - e.clientY) / cell);
          setView({
            zoom: view.zoom,
            row: start.row + dRow,
            col: start.col + dCol,
          });
        }}
        onPointerUp={() => {
          drag.current = null;
          setPanning(false);
          window.setTimeout(() => (suppressClick.current = false), 0);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setPanning(false);
          window.setTimeout(() => (suppressClick.current = false), 0);
        }}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            zoom(e.deltaY < 0 ? 1 : -1);
          }
        }}
      >
        <div className="board-window">
          <div className="window-caption">
            <span>
              第 {view.row + 1}–{view.row + span} 行 · 第 {view.col + 1}–
              {view.col + span} 列
            </span>
            <span>{Math.round(view.zoom * 100)}%</span>
          </div>
          <div
            className="puzzle-grid"
            style={{
              gridTemplateColumns: `64px repeat(${span}, ${cell}px)`,
              gridTemplateRows: `64px repeat(${span}, ${cell}px)`,
            }}
          >
            <div className="grid-corner">
              <span>
                {puzzle.size}×{puzzle.size}
              </span>
              <small>NONOGRAM</small>
            </div>
            {cols.map((col) => (
              <Clue
                key={"c" + col}
                values={clues[puzzle.size + col]}
                done={statuses[puzzle.size + col]}
                vertical
                compact={span > 10}
              />
            ))}
            {rows.map((row) => (
              <div className="grid-row" key={row}>
                <Clue
                  values={clues[row]}
                  done={statuses[row]}
                  compact={span > 10}
                />
                {cols.map((col) => {
                  const i = row * puzzle.size + col;
                  const mark = session.marks[i];
                  const activeHere = zone
                    ? containsCell(puzzle.size, zone, i)
                    : false;
                  const inSomeZone = session.zones.some((z) =>
                    containsCell(puzzle.size, z, i),
                  );
                  const edges = zone
                    ? [
                        row === zone.row ? "zone-top" : "",
                        row === zone.row + zone.rows - 1 ? "zone-bottom" : "",
                        col === zone.col ? "zone-left" : "",
                        col === zone.col + zone.cols - 1 ? "zone-right" : "",
                      ].filter(Boolean)
                    : [];
                  return (
                    <button
                      key={col}
                      aria-label={`第${row + 1}行第${col + 1}列 ${mark === "filled" ? "已填" : mark === "cross" ? "标空" : "未知"}`}
                      className={[
                        "cell",
                        mark,
                        (col + 1) % 5 === 0 ? "major-right" : "",
                        (row + 1) % 5 === 0 ? "major-bottom" : "",
                        inSomeZone ? "zoned" : "",
                        activeHere ? "in-zone" : "",
                        zone && !activeHere ? "outside-zone" : "",
                        ...edges,
                        wrong.has(i) ? "wrong" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      disabled={session.solved}
                      onClick={() => {
                        if (suppressClick.current) return;
                        onMark(i, session.marks[i] === tool ? "unknown" : tool);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (suppressClick.current) return;
                        onMark(i, mark === "cross" ? "unknown" : "cross");
                      }}
                    >
                      {mark === "cross" ? "×" : ""}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="pan-pad" aria-label="平移视图">
            <button aria-label="向上平移" onClick={() => pan(-1, 0)}>
              <ChevronUp size={14} />
            </button>
            <div>
              <button aria-label="向左平移" onClick={() => pan(0, -1)}>
                <ChevronLeft size={14} />
              </button>
              <button
                aria-label="回到区域或全盘"
                title="回到区域或全盘"
                onClick={fit}
              >
                <ScanSearch size={13} />
              </button>
              <button aria-label="向右平移" onClick={() => pan(0, 1)}>
                <ChevronRight size={14} />
              </button>
            </div>
            <button aria-label="向下平移" onClick={() => pan(1, 0)}>
              <ChevronDown size={14} />
            </button>
          </div>
        </div>
        <MiniMap
          puzzle={puzzle}
          session={session}
          view={view}
          span={span}
          onJump={(row, col) => setView({ ...view, row, col })}
        />
      </div>

      <div className="board-footer">
        <span>
          <MousePointer2 size={14} /> 左键填涂 · 右键标空 · 拖动空白处平移
        </span>
        <span>
          <span className="status-dot" /> {statuses.filter(Boolean).length} /{" "}
          {puzzle.size * 2} 条线已满足
        </span>
      </div>

      <ZonePanel
        puzzle={puzzle}
        session={session}
        zone={zone}
        onFocusZone={onFocusZone}
        onCreateZone={onCreateZone}
        onRenameZone={onRenameZone}
        onReshapeZone={onReshapeZone}
        onRemoveZone={onRemoveZone}
        onView={onView}
        onCheck={onCheck}
      />

      <div className="progress-caption">
        <span>
          {session.solved ? (
            <>
              <CheckCircle2 size={15} /> 图案已揭晓
            </>
          ) : progress && zone ? (
            <>
              「{zone.name}」还有 {progress.unsettled} / {progress.total}{" "}
              格未定格
            </>
          ) : (
            "每一小步，都离答案更近"
          )}
        </span>
        <strong>{completion(session)}% 已标记</strong>
      </div>
      <div className="progress-track">
        <span style={{ width: completion(session) + "%" }} />
      </div>
    </section>
  );
}
