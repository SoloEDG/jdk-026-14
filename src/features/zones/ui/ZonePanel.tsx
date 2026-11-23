import { useState } from "react";
import {
  Check,
  CheckCheck,
  Focus,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import type { Puzzle, Session, Zone, ZoneRect } from "../../../shared/types";
import { clampRect, viewForRect, zoneProgress } from "../model/zones";
import { checkStatus } from "../../assist/lib/inspect";

/**
 * Saved observation regions. The panel exposes identity and framing only --
 * marks and hint quota are shared puzzle state, never owned by a region, so
 * deleting one can remove neither.
 */
export function ZonePanel({
  puzzle,
  session,
  zone,
  onFocusZone,
  onCreateZone,
  onRenameZone,
  onReshapeZone,
  onRemoveZone,
  onView,
  onCheck,
}: {
  puzzle: Puzzle;
  session: Session;
  zone: Zone | null;
  onFocusZone: (id: string | null) => void;
  onCreateZone: () => void;
  onRenameZone: (id: string, name: string) => void;
  onReshapeZone: (id: string, rect: ZoneRect) => void;
  onRemoveZone: (id: string) => void;
  onView: (view: Session["view"]) => void;
  onCheck: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const size = puzzle.size;

  const startRename = (item: Zone) => {
    setEditing(item.id);
    setDraftName(item.name);
  };
  const commitRename = (id: string) => {
    onRenameZone(id, draftName);
    setEditing(null);
  };
  const resize = (item: Zone, rows: number, cols: number) =>
    onReshapeZone(item.id, clampRect(size, { ...item, rows, cols }));
  const nudge = (item: Zone, dRow: number, dCol: number) =>
    onReshapeZone(
      item.id,
      clampRect(size, { ...item, row: item.row + dRow, col: item.col + dCol }),
    );
  const focusView = () => {
    if (zone) onView(viewForRect(size, zone));
  };

  return (
    <div className="zone-panel">
      <div className="zone-panel-heading">
        <div>
          <span className="eyebrow">OBSERVATION DESK</span>
          <h3>观察区域</h3>
        </div>
        <button onClick={onCreateZone} disabled={session.solved}>
          保存当前视图
        </button>
      </div>
      {!session.zones.length && (
        <p className="zone-empty">
          缩放或平移到想专注的一片，再「保存当前视图」。区域可以重叠，标记与提示额度全题共用。
        </p>
      )}
      <ul className="zone-list">
        {session.zones.map((item) => {
          const progress = zoneProgress(puzzle, session, item);
          const isActive = zone?.id === item.id;
          return (
            <li key={item.id} className={isActive ? "active" : ""}>
              <div className="zone-row-top">
                {editing === item.id ? (
                  <form
                    className="zone-rename"
                    onSubmit={(e) => {
                      e.preventDefault();
                      commitRename(item.id);
                    }}
                  >
                    <input
                      aria-label={`重命名${item.name}`}
                      value={draftName}
                      maxLength={20}
                      autoFocus
                      onChange={(e) => setDraftName(e.target.value)}
                    />
                    <button type="submit" aria-label="确认名称">
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label="取消重命名"
                      onClick={() => setEditing(null)}
                    >
                      <X size={14} />
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      className="zone-name"
                      onClick={() => onFocusZone(isActive ? null : item.id)}
                      aria-pressed={isActive}
                    >
                      <Focus size={13} />
                      {item.name}
                    </button>
                    <span className="zone-count">
                      未定格 <strong>{progress.unsettled}</strong> /{" "}
                      {progress.total}
                    </span>
                  </>
                )}
              </div>
              <div className="zone-row-meta">
                <span>
                  行 {item.row + 1}–{item.row + item.rows} · 列 {item.col + 1}–
                  {item.col + item.cols}
                </span>
                <span className="zone-actions">
                  <button
                    aria-label={`重命名${item.name}`}
                    title="重命名"
                    onClick={() => startRename(item)}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    aria-label={`减少${item.name}的一行`}
                    title="减少一行"
                    onClick={() => resize(item, item.rows - 1, item.cols)}
                  >
                    −行
                  </button>
                  <button
                    aria-label={`增加${item.name}的一行`}
                    title="增加一行"
                    onClick={() => resize(item, item.rows + 1, item.cols)}
                  >
                    +行
                  </button>
                  <button
                    aria-label={`减少${item.name}的一列`}
                    title="减少一列"
                    onClick={() => resize(item, item.rows, item.cols - 1)}
                  >
                    −列
                  </button>
                  <button
                    aria-label={`增加${item.name}的一列`}
                    title="增加一列"
                    onClick={() => resize(item, item.rows, item.cols + 1)}
                  >
                    +列
                  </button>
                  <button
                    aria-label={`删除${item.name}`}
                    title="删除区域（保留标记与提示额度）"
                    onClick={() => onRemoveZone(item.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              </div>
              {isActive && (
                <div className="zone-row-actions">
                  <button onClick={focusView} title="把视图框回这个区域">
                    框住区域
                  </button>
                  <button onClick={() => nudge(item, -1, 0)} aria-label="上移区域">
                    ↑
                  </button>
                  <button onClick={() => nudge(item, 1, 0)} aria-label="下移区域">
                    ↓
                  </button>
                  <button onClick={() => nudge(item, 0, -1)} aria-label="左移区域">
                    ←
                  </button>
                  <button onClick={() => nudge(item, 0, 1)} aria-label="右移区域">
                    →
                  </button>
                  <button
                    onClick={onCheck}
                    title="只检查这个区域内的问题"
                    disabled={session.solved}
                  >
                    <CheckCheck size={13} /> 检查此区
                  </button>
                </div>
              )}
              <LastCheck session={session} zone={item} />
            </li>
          );
        })}
      </ul>
      <p className="zone-panel-note">
        区域只是取景框：相邻区的连续段仍按完整行读取，检查结果也只对当时的区域和视图有效。
      </p>
    </div>
  );
}

function LastCheck({ session, zone }: { session: Session; zone: Zone }) {
  const check = session.check;
  if (!check || check.zoneId !== zone.id) return null;
  const status = checkStatus(session);
  if (status === "none") return null;
  return (
    <p className={`zone-check ${status}`}>
      {status === "stale"
        ? "上次检查结果已失效（区域或视图已移动）"
        : check.errors || check.lineIssues
          ? `区域内 ${check.errors} 处标记不符，${check.lineIssues} 条完整行列未对上`
          : "区域内未发现错误"}
    </p>
  );
}
