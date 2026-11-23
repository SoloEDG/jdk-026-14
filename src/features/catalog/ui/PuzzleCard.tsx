import { Grid2X2, Check, MapPin } from "lucide-react";
import type { Puzzle, Session } from "../../../shared/types";
import { completion } from "../../../shared/document";
import { zoneSummaries } from "../../zones/model/zones";
import { difficultyDots } from "../lib/filter";

const LABELS: Record<string, string> = {
  bloom: "01",
  heart: "02",
  cup: "03",
  cat: "04",
  fern: "05",
  lighthouse: "06",
};

export function PuzzleCard({
  puzzle,
  session,
  selected,
  onOpen,
  onOpenZone,
}: {
  puzzle: Puzzle;
  session?: Session;
  selected: boolean;
  onOpen: () => void;
  onOpenZone?: (zoneId: string) => void;
}) {
  const progress = session ? completion(session) : 0;
  const zones = session ? zoneSummaries(puzzle, session) : [];
  return (
    <div className={`puzzle-card ${selected ? "selected" : ""}`}>
      <button className="puzzle-card-main" onClick={onOpen}>
        <span className="puzzle-icon" style={{ color: puzzle.color }}>
          {session?.solved ? <Check size={22} /> : <Grid2X2 size={22} />}
        </span>
        <span className="puzzle-info">
          <strong>
            {session?.solved ? puzzle.title : `图案 ${LABELS[puzzle.id] ?? "06"}`}
          </strong>
          <small>
            {puzzle.size} × {puzzle.size}
            <i /> {puzzle.collection}
          </small>
          <span className="mini-track">
            <span style={{ width: progress + "%" }} />
          </span>
        </span>
        <span className="puzzle-meta">
          <span className="difficulty">
            {"●".repeat(difficultyDots(puzzle.level))}
            {"○".repeat(3 - difficultyDots(puzzle.level))}
          </span>
          <small>
            {session?.solved ? "已完成" : progress ? progress + "%" : "未开始"}
          </small>
        </span>
      </button>
      {!session?.solved && zones.length > 0 && (
        <div className="zone-resume" aria-label="按观察区域续题">
          {zones.map((zone) => (
            <button
              key={zone.id}
              onClick={() => onOpenZone?.(zone.id)}
              title={`回到「${zone.name}」上次的位置`}
            >
              <MapPin size={11} />
              <span className="zone-resume-name">{zone.name}</span>
              <span className="zone-resume-count">
                未定格 {zone.unsettled}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
