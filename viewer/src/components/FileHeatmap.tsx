import React, { useMemo, useState, useCallback, useRef } from "react";

interface FileEntry {
  key: string;
  file: string;
  count: number;
  commits: number;
  complexity: number;
}

interface FileHeatmapProps {
  files: FileEntry[];
  currentFile: string | null;
  onSelect: (key: string) => void;
}

interface TreemapRect {
  file: FileEntry;
  x: number;
  y: number;
  w: number;
  h: number;
}

type ColorMode = "complexity" | "entities" | "commits";

function squarify(
  items: { file: FileEntry; area: number }[],
  x: number,
  y: number,
  w: number,
  h: number
): TreemapRect[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [{ file: items[0].file, x, y, w, h }];
  }

  const total = items.reduce((s, i) => s + i.area, 0);
  if (total <= 0) return items.map((i) => ({ file: i.file, x, y, w: 0, h: 0 }));

  const sorted = [...items].sort((a, b) => b.area - a.area);
  const vertical = w >= h;
  const fullLen = vertical ? w : h;
  const crossLen = vertical ? h : w;

  const rects: TreemapRect[] = [];
  let idx = 0;
  let cx = x,
    cy = y;

  while (idx < sorted.length) {
    const remaining = sorted.slice(idx).reduce((s, i) => s + i.area, 0);
    const strip: typeof sorted = [];
    let stripArea = 0;
    let bestAspect = Infinity;

    for (let i = idx; i < sorted.length; i++) {
      strip.push(sorted[i]);
      stripArea += sorted[i].area;
      const stripLen = (stripArea / remaining) * fullLen;
      const worst = worstAspect(strip, stripArea, stripLen, crossLen, remaining, fullLen);
      if (worst > bestAspect && strip.length > 1) {
        strip.pop();
        stripArea -= sorted[i].area;
        break;
      }
      bestAspect = worst;
    }

    const stripLen =
      (stripArea / remaining) *
      (vertical ? w - (cx - x) : h - (cy - y));
    let offset = 0;

    for (const item of strip) {
      const frac = item.area / stripArea;
      const itemLen = frac * crossLen;
      if (vertical) {
        rects.push({ file: item.file, x: cx, y: cy + offset, w: stripLen, h: itemLen });
      } else {
        rects.push({ file: item.file, x: cx + offset, y: cy, w: itemLen, h: stripLen });
      }
      offset += itemLen;
    }

    if (vertical) cx += stripLen;
    else cy += stripLen;
    idx += strip.length;
  }

  return rects;
}

function worstAspect(
  strip: { area: number }[],
  stripArea: number,
  stripLen: number,
  _crossLen: number,
  _remaining: number,
  _fullLen: number
): number {
  if (stripLen <= 0) return Infinity;
  let worst = 0;
  for (const item of strip) {
    const itemCross = (item.area / stripArea) * _crossLen;
    const ratio = Math.max(stripLen / itemCross, itemCross / stripLen);
    worst = Math.max(worst, ratio);
  }
  return worst;
}

function complexityColor(value: number, max: number): string {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  if (ratio < 0.2) return "#1a5276";
  if (ratio < 0.4) return "#1e8449";
  if (ratio < 0.6) return "#b7950b";
  if (ratio < 0.8) return "#ca6f1e";
  return "#c0392b";
}

function shortName(file: string): string {
  const parts = file.split("/");
  return parts[parts.length - 1];
}

function dirName(file: string): string {
  const parts = file.split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
}

export function FileHeatmap({ files, currentFile, onSelect }: FileHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [colorMode, setColorMode] = useState<ColorMode>("complexity");
  const [hoveredFile, setHoveredFile] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; file: FileEntry } | null>(null);

  const maxes = useMemo(() => ({
    complexity: Math.max(...files.map((f) => f.complexity), 1),
    entities: Math.max(...files.map((f) => f.count), 1),
    commits: Math.max(...files.map((f) => f.commits), 1),
  }), [files]);

  const colorValue = useCallback(
    (f: FileEntry): number => {
      switch (colorMode) {
        case "complexity": return f.complexity;
        case "entities": return f.count;
        case "commits": return f.commits;
      }
    },
    [colorMode]
  );

  const getColor = useCallback(
    (f: FileEntry): string => complexityColor(colorValue(f), maxes[colorMode]),
    [colorValue, maxes, colorMode]
  );

  const rects = useMemo(() => {
    const W = 600, H = 420;
    const dirs = new Map<string, FileEntry[]>();
    for (const f of files) {
      const d = dirName(f.file);
      if (!dirs.has(d)) dirs.set(d, []);
      dirs.get(d)!.push(f);
    }

    const dirEntries = [...dirs.entries()].sort(
      (a, b) =>
        b[1].reduce((s, f) => s + f.count, 0) -
        a[1].reduce((s, f) => s + f.count, 0)
    );

    const totalArea = files.reduce((s, f) => s + Math.max(f.count, 1), 0);
    const dirAreas = dirEntries.map(([, fs]) => ({
      area: fs.reduce((s, f) => s + Math.max(f.count, 1), 0),
      files: fs,
    }));

    const dirRects = squarify(
      dirAreas.map((d, i) => ({ file: dirEntries[i][1][0], area: d.area })),
      0, 0, W, H
    );

    const result: TreemapRect[] = [];
    for (let i = 0; i < dirRects.length; i++) {
      const dr = dirRects[i];
      const fs = dirAreas[i].files;
      const padding = 2;
      const fileRects = squarify(
        fs.map((f) => ({ file: f, area: Math.max(f.count, 1) })),
        dr.x + padding,
        dr.y + padding,
        dr.w - padding * 2,
        dr.h - padding * 2
      );
      result.push(...fileRects);
    }

    return result;
  }, [files]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent, file: FileEntry) => {
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;
      setTooltip({
        x: e.clientX - containerRect.left + 12,
        y: e.clientY - containerRect.top - 8,
        file,
      });
      setHoveredFile(file.file);
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
    setHoveredFile(null);
  }, []);

  const legendSteps = [0, 0.2, 0.4, 0.6, 0.8, 1];

  return (
    <div className="vr-heatmap" ref={containerRef}>
      <div className="vr-heatmap-header">
        <span>FILE HEATMAP</span>
        <div style={{ display: "flex", gap: 4 }}>
          {(["complexity", "entities", "commits"] as ColorMode[]).map((m) => (
            <button
              key={m}
              className="vr-heatmap-mode-btn"
              style={{ opacity: colorMode === m ? 1 : 0.4 }}
              onClick={() => setColorMode(m)}
              title={`Color by ${m}`}
            >
              {m === "complexity" ? "Cx" : m === "entities" ? "#E" : "~C"}
            </button>
          ))}
        </div>
      </div>

      <div className="vr-heatmap-legend">
        <span style={{ fontSize: 9, color: "#888" }}>Low</span>
        {legendSteps.map((s) => (
          <span
            key={s}
            style={{
              width: 16,
              height: 8,
              borderRadius: 2,
              background: complexityColor(s * maxes[colorMode], maxes[colorMode]),
            }}
          />
        ))}
        <span style={{ fontSize: 9, color: "#888" }}>High</span>
        <span style={{ fontSize: 9, color: "#666", marginLeft: 8 }}>
          size = entity count
        </span>
      </div>

      <svg
        viewBox="0 0 600 420"
        className="vr-heatmap-svg"
        onMouseLeave={handleMouseLeave}
      >
        {rects.map((r) => {
          const isActive = currentFile === r.file.file;
          const isHovered = hoveredFile === r.file.file;
          const minDim = Math.min(r.w, r.h);
          const showLabel = minDim > 18;
          return (
            <g key={r.file.key}>
              <rect
                x={r.x + 1}
                y={r.y + 1}
                width={Math.max(r.w - 2, 0)}
                height={Math.max(r.h - 2, 0)}
                fill={getColor(r.file)}
                stroke={isActive ? "#007acc" : isHovered ? "#aaa" : "#2d2d2d"}
                strokeWidth={isActive ? 2 : 1}
                rx={2}
                opacity={isHovered ? 1 : 0.85}
                style={{ cursor: "pointer", transition: "opacity 0.15s" }}
                onClick={() => onSelect(r.file.key)}
                onMouseMove={(e) => handleMouseMove(e, r.file)}
                onMouseLeave={handleMouseLeave}
              />
              {showLabel && (
                <text
                  x={r.x + r.w / 2}
                  y={r.y + r.h / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#e0e0e0"
                  fontSize={Math.min(11, r.w / shortName(r.file.file).length * 1.6)}
                  fontWeight={isActive ? 600 : 400}
                  style={{ pointerEvents: "none" }}
                >
                  {shortName(r.file.file)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {tooltip && (
        <div
          className="vr-heatmap-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{tooltip.file.file}</div>
          <div>Complexity: {tooltip.file.complexity}</div>
          <div>Entities: {tooltip.file.count}</div>
          <div>Commits: {tooltip.file.commits}</div>
        </div>
      )}
    </div>
  );
}

export const fileHeatmapStyles = `
  .vr-heatmap {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    position: relative;
  }

  .vr-heatmap-header {
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: #888;
    border-bottom: 1px solid #3c3c3c;
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .vr-heatmap-mode-btn {
    background: none;
    border: 1px solid #555;
    color: #888;
    font-size: 9px;
    cursor: pointer;
    padding: 0 4px;
    border-radius: 3px;
    line-height: 14px;
  }
  .vr-heatmap-mode-btn:hover { color: #d4d4d4; border-color: #888; }

  .vr-heatmap-legend {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 4px 12px;
    border-bottom: 1px solid #3c3c3c;
    flex-shrink: 0;
  }

  .vr-heatmap-svg {
    flex: 1;
    width: 100%;
    padding: 4px;
    box-sizing: border-box;
  }

  .vr-heatmap-tooltip {
    position: absolute;
    background: #252526;
    border: 1px solid #555;
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 11px;
    color: #d4d4d4;
    pointer-events: none;
    z-index: 100;
    max-width: 280px;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  }
`;
