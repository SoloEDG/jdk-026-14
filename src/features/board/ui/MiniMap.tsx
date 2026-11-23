import type { Puzzle, Session } from "../../../shared/types";

/**
 * Overview of the whole board with the visible window and saved regions
 * overlaid. Clicking jumps the viewport so users never lose their place
 * while zoomed in.
 */
export function MiniMap({
  puzzle,
  session,
  view,
  span,
  onJump,
}: {
  puzzle: Puzzle;
  session: Session;
  view: Session["view"];
  span: number;
  onJump: (row: number, col: number) => void;
}) {
  const size = puzzle.size;
  const cell = 8;
  const dim = size * cell;
  return (
    <div className="mini-map" aria-label="全盘定位">
      <svg
        width={dim}
        height={dim}
        viewBox={`0 0 ${dim} ${dim}`}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const row = Math.floor(((e.clientY - rect.top) / rect.height) * size);
          const col = Math.floor(((e.clientX - rect.left) / rect.width) * size);
          onJump(
            Math.max(0, Math.min(size - span, row - Math.floor(span / 2))),
            Math.max(0, Math.min(size - span, col - Math.floor(span / 2))),
          );
        }}
      >
        <rect width={dim} height={dim} fill="#f4f7fb" rx="4" />
        {session.marks.map((mark, i) =>
          mark === "filled" ? (
            <rect
              key={i}
              x={(i % size) * cell}
              y={Math.floor(i / size) * cell}
              width={cell}
              height={cell}
              fill="#9db1cb"
            />
          ) : null,
        )}
        {session.zones.map((zone) => {
          const active = zone.id === session.activeZoneId;
          const x = zone.col * cell;
          const y = zone.row * cell;
          const w = zone.cols * cell;
          const h = zone.rows * cell;
          const marks = [
            { x: x + 0.5, y: y + 0.5 },
            { x: x + 0.5, y: y + h - 0.5 },
            { x: x + w - 0.5, y: y + h - 0.5 },
            { x: x + w - 0.5, y: y + 0.5 },
          ];
          return (
            <g key={zone.id}>
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill={active ? "#6683ac22" : "none"}
                stroke={active ? "#6683ac" : "#a9c0b4"}
                strokeDasharray={active ? undefined : "2 2"}
                strokeWidth={active ? 1.2 : 0.8}
              />
              {marks.map((p, j) => (
                <circle
                  key={j}
                  cx={p.x}
                  cy={p.y}
                  r={active ? 1.6 : 1.1}
                  fill={active ? "#4f6f9f" : "#9bb5a9"}
                />
              ))}
            </g>
          );
        })}
        <rect
          x={view.col * cell}
          y={view.row * cell}
          width={span * cell}
          height={span * cell}
          fill="none"
          stroke="#40577f"
          strokeWidth="1.4"
          rx="1"
        />
      </svg>
      <div className="mini-map-legend">
        <span className="legend-window" /> 当前视图
        <span className="legend-zone" /> 观察区域
      </div>
    </div>
  );
}
