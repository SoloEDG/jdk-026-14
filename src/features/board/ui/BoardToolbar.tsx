import {
  Square,
  X,
  Eraser,
  Undo2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  ScanSearch,
} from "lucide-react";
import type { Tool } from "../../../shared/types";
export function BoardToolbar({
  tool,
  onTool,
  onUndo,
  onReset,
  canUndo,
  disabled,
  onZoomIn,
  onZoomOut,
  onFit,
  canZoomIn,
  canZoomOut,
}: {
  tool: Tool;
  onTool: (t: Tool) => void;
  onUndo: () => void;
  onReset: () => void;
  canUndo: boolean;
  disabled: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
}) {
  return (
    <div className="board-toolbar">
      <div className="tool-group">
        {(
          [
            { id: "filled", name: "填涂", icon: Square },
            { id: "cross", name: "标空", icon: X },
            { id: "unknown", name: "擦除", icon: Eraser },
          ] as const
        ).map(({ id, name, icon: Icon }) => (
          <button
            key={id}
            aria-pressed={tool === id}
            className={tool === id ? "active" : ""}
            onClick={() => onTool(id)}
            disabled={disabled}
          >
            <Icon size={16} />
            {name}
          </button>
        ))}
      </div>
      <div className="tool-group">
        <button
          aria-label="缩小视图"
          title="缩小视图"
          onClick={onZoomOut}
          disabled={!canZoomOut}
        >
          <ZoomOut size={17} />
        </button>
        <button aria-label="放大视图" title="放大视图" onClick={onZoomIn} disabled={!canZoomIn}>
          <ZoomIn size={17} />
        </button>
        <button aria-label="适应全盘" title="适应全盘" onClick={onFit}>
          <ScanSearch size={17} />
        </button>
        <button
          aria-label="撤销上一步"
          title="撤销上一步"
          onClick={onUndo}
          disabled={!canUndo || disabled}
        >
          <Undo2 size={17} />
        </button>
        <button aria-label="重新开始" title="重新开始" onClick={onReset}>
          <RotateCcw size={17} />
        </button>
      </div>
    </div>
  );
}
