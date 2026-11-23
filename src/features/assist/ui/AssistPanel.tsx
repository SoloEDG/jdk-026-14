import { Lightbulb, ScanLine, ArrowUpRight, Sparkles } from "lucide-react";
import type { Puzzle, Session, Zone } from "../../../shared/types";
import { HINT_LIMIT, hintTargets } from "../model/hints";
import { inspect, checkStatus } from "../lib/inspect";
import { RuleGuide } from "./RuleGuide";

export function AssistPanel({
  puzzle,
  session,
  zone,
  message,
  onHint,
  onCheck,
}: {
  puzzle: Puzzle;
  session: Session;
  zone: Zone | null;
  message: string;
  onHint: () => void;
  onCheck: () => void;
}) {
  const stats = inspect(puzzle, session);
  const check = checkStatus(session);
  // "Nothing to reveal" is about hintable cells, not unsettled ones: a wrong
  // mark in an otherwise settled region can still be the next hint target.
  const noTargets =
    !!zone && hintTargets(puzzle, session, zone).length === 0;
  const quotaLeft = HINT_LIMIT - session.hints;

  return (
    <aside className="assist">
      <section className="panel helper">
        <span className="eyebrow">A GENTLE NUDGE</span>
        <h2>换个思路看看</h2>
        <p className="muted">卡住也没关系，给灵感一点空间。</p>

        <div className="scope-chip">
          {zone ? (
            <>
              <span className="scope-dot" />
              求助范围：{zone.name}
            </>
          ) : (
            <>求助范围：全盘（先保存一个观察区域可局部求助）</>
          )}
        </div>

        <button
          className="hint-button"
          onClick={onHint}
          disabled={
            session.solved || quotaLeft <= 0 || noTargets
          }
        >
          <Lightbulb size={18} />
          <span>给我一点提示</span>
          <span className="hint-count">
            {quotaLeft} / {HINT_LIMIT}
          </span>
        </button>
        <p className="hint-note">
          {noTargets
            ? "当前区域内已没有可提示的格子，提示不会跳到其他区扣费。"
            : "每次只在当前区域内揭示一格，额度由全题共享。"}
        </p>

        <button
          className="check-button"
          onClick={onCheck}
          disabled={session.solved}
        >
          <ScanLine size={17} />
          {zone ? `检查「${zone.name}」` : "检查当前标记"}
          <ArrowUpRight size={16} />
        </button>
        <div className="assist-message" role="status">
          {message || "相信你的推理，也可以随时检查。"}
        </div>
        <p className={`check-status ${check}`}>
          {check === "fresh"
            ? "上次检查结果仍对应当前区域与视图。"
            : check === "stale"
              ? "区域或视图已移动，上次检查结果不再显示。"
              : "尚未检查。"}
        </p>

        <div className="assist-stats">
          <div>
            <strong>{stats.filled}</strong>
            <span>已填涂</span>
          </div>
          <div>
            <strong>{stats.crossed}</strong>
            <span>已标空</span>
          </div>
          <div>
            <strong>{session.hints}</strong>
            <span>已用提示</span>
          </div>
        </div>
        <RuleGuide />
      </section>
      <section className="quiet-card">
        <Sparkles size={21} />
        <span>小小的专注时刻</span>
        <p>
          世界很大，
          <br />
          先解开眼前这一格。
        </p>
        <div className="quiet-grid">
          {[0, 1, 0, 1, 1, 1, 0, 1, 0].map((v, i) => (
            <span className={v ? "ink" : ""} key={i} />
          ))}
        </div>
      </section>
    </aside>
  );
}
