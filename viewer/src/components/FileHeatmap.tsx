import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";

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

interface DirRect {
  dir: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

type ColorMode = "complexity" | "entities" | "commits";
type SizeMode = "entities" | "lines" | "equal";

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
      const stripLen = (stripArea / remaining) * (vertical ? w - (cx - x) : h - (cy - y));
      const worst = worstAspect(strip, stripArea, stripLen, crossLen);
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
  crossLen: number
): number {
  if (stripLen <= 0) return Infinity;
  let worst = 0;
  for (const item of strip) {
    const itemCross = (item.area / stripArea) * crossLen;
    const ratio = Math.max(stripLen / itemCross, itemCross / stripLen);
    worst = Math.max(worst, ratio);
  }
  return worst;
}

const COLOR_SCALES: Record<ColorMode, [number, string][]> = {
  complexity: [
    [0, "#1a3a4a"],
    [0.2, "#1a5276"],
    [0.4, "#1e8449"],
    [0.6, "#b7950b"],
    [0.8, "#ca6f1e"],
    [1, "#c0392b"],
  ],
  entities: [
    [0, "#1a2a3a"],
    [0.2, "#1b4f72"],
    [0.4, "#2874a6"],
    [0.6, "#2e86c1"],
    [0.8, "#5dade2"],
    [1, "#85c1e9"],
  ],
  commits: [
    [0, "#1a2a1a"],
    [0.2, "#196f3d"],
    [0.4, "#27ae60"],
    [0.6, "#f39c12"],
    [0.8, "#e74c3c"],
    [1, "#c0392b"],
  ],
};

function interpolateColor(ratio: number, scale: [number, string][]): string {
  const clamped = Math.max(0, Math.min(1, ratio));
  for (let i = 1; i < scale.length; i++) {
    if (clamped <= scale[i][0]) {
      const t = (clamped - scale[i - 1][0]) / (scale[i][0] - scale[i - 1][0]);
      return lerpHex(scale[i - 1][1], scale[i][1], t);
    }
  }
  return scale[scale.length - 1][1];
}

function lerpHex(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16),
    ag = parseInt(a.slice(3, 5), 16),
    ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16),
    bg = parseInt(b.slice(3, 5), 16),
    bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

function shortName(file: string): string {
  const parts = file.split("/");
  return parts[parts.length - 1];
}

function dirName(file: string): string {
  const parts = file.split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
}

function shortDir(dir: string): string {
  const parts = dir.split("/");
  return parts[parts.length - 1] || dir;
}

function getFileArea(f: FileEntry, mode: SizeMode): number {
  switch (mode) {
    case "entities": return Math.max(f.count, 1);
    case "lines": return Math.max(f.complexity, 1);
    case "equal": return 1;
  }
}

const W = 600, H = 420;
const DIR_LABEL_H = 14;
const DIR_PAD = 2;

export function FileHeatmap({ files, currentFile, onSelect }: FileHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [colorMode, setColorMode] = useState<ColorMode>("complexity");
  const [sizeMode, setSizeMode] = useState<SizeMode>("entities");
  const [hoveredFile, setHoveredFile] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; file: FileEntry } | null>(null);
  const [animKey, setAnimKey] = useState(0);

  const prevColorMode = useRef(colorMode);
  const prevSizeMode = useRef(sizeMode);
  useEffect(() => {
    if (prevColorMode.current !== colorMode || prevSizeMode.current !== sizeMode) {
      setAnimKey((k) => k + 1);
      prevColorMode.current = colorMode;
      prevSizeMode.current = sizeMode;
    }
  }, [colorMode, sizeMode]);

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
    (f: FileEntry): string =>
      interpolateColor(colorValue(f) / maxes[colorMode], COLOR_SCALES[colorMode]),
    [colorValue, maxes, colorMode]
  );

  const { fileRects, dirRects } = useMemo(() => {
    const dirs = new Map<string, FileEntry[]>();
    for (const f of files) {
      const d = dirName(f.file);
      if (!dirs.has(d)) dirs.set(d, []);
      dirs.get(d)!.push(f);
    }

    const dirEntries = [...dirs.entries()].sort(
      (a, b) =>
        b[1].reduce((s, f) => s + getFileArea(f, sizeMode), 0) -
        a[1].reduce((s, f) => s + getFileArea(f, sizeMode), 0)
    );

    const dirAreas = dirEntries.map(([dir, fs]) => ({
      dir,
      area: fs.reduce((s, f) => s + getFileArea(f, sizeMode), 0),
      files: fs,
    }));

    const outerRects = squarify(
      dirAreas.map((d, i) => ({ file: dirEntries[i][1][0], area: d.area })),
      0, 0, W, H
    );

    const resultDirs: DirRect[] = [];
    const resultFiles: TreemapRect[] = [];

    for (let i = 0; i < outerRects.length; i++) {
      const dr = outerRects[i];
      const da = dirAreas[i];
      resultDirs.push({ dir: da.dir, x: dr.x, y: dr.y, w: dr.w, h: dr.h });

      const innerY = dr.y + DIR_LABEL_H;
      const innerH = dr.h - DIR_LABEL_H;
      if (innerH < 4) continue;

      const inner = squarify(
        da.files.map((f) => ({ file: f, area: getFileArea(f, sizeMode) })),
        dr.x + DIR_PAD,
        innerY + DIR_PAD,
        dr.w - DIR_PAD * 2,
        innerH - DIR_PAD * 2
      );
      resultFiles.push(...inner);
    }

    return { fileRects: resultFiles, dirRects: resultDirs };
  }, [files, sizeMode]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent, file: FileEntry) => {
      const cr = containerRef.current?.getBoundingClientRect();
      if (!cr) return;
      setTooltip({
        x: Math.min(e.clientX - cr.left + 12, cr.width - 200),
        y: Math.min(e.clientY - cr.top - 8, cr.height - 80),
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

  const stats = useMemo(() => {
    const totalEntities = files.reduce((s, f) => s + f.count, 0);
    const totalComplexity = files.reduce((s, f) => s + f.complexity, 0);
    const avgComplexity = files.length > 0 ? Math.round(totalComplexity / files.length) : 0;
    const dirs = new Set(files.map((f) => dirName(f.file)));
    return { totalEntities, avgComplexity, dirCount: dirs.size, fileCount: files.length };
  }, [files]);

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
          <span style={{ width: 1, background: "#444", margin: "0 2px" }} />
          {(["entities", "lines", "equal"] as SizeMode[]).map((m) => (
            <button
              key={m}
              className="vr-heatmap-mode-btn"
              style={{ opacity: sizeMode === m ? 1 : 0.4 }}
              onClick={() => setSizeMode(m)}
              title={`Size by ${m}`}
            >
              {m === "entities" ? "Sz" : m === "lines" ? "Ln" : "Eq"}
            </button>
          ))}
        </div>
      </div>

      <div className="vr-heatmap-legend">
        <span style={{ fontSize: 9, color: "#888" }}>Low</span>
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((s) => (
          <span
            key={s}
            style={{
              width: 16, height: 8, borderRadius: 2,
              background: interpolateColor(s, COLOR_SCALES[colorMode]),
            }}
          />
        ))}
        <span style={{ fontSize: 9, color: "#888" }}>High</span>
        <span style={{ fontSize: 9, color: "#555", marginLeft: "auto" }}>
          {stats.fileCount} files &middot; {stats.dirCount} dirs &middot; avg Cx {stats.avgComplexity}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="vr-heatmap-svg"
        onMouseLeave={handleMouseLeave}
        key={animKey}
      >
        {dirRects.map((dr) => (
          <g key={`dir-${dr.dir}`} style={{ pointerEvents: "none" }}>
            <rect
              x={dr.x}
              y={dr.y}
              width={dr.w}
              height={dr.h}
              fill="none"
              stroke="#3c3c3c"
              strokeWidth={1}
              rx={3}
            />
            {dr.w > 40 && (
              <text
                x={dr.x + 4}
                y={dr.y + 10}
                fill="#888"
                fontSize={Math.min(9, dr.w / shortDir(dr.dir).length * 1.4)}
                style={{ pointerEvents: "none" }}
              >
                {shortDir(dr.dir)}
              </text>
            )}
          </g>
        ))}

        {fileRects.map((r) => {
          const isActive = currentFile === r.file.file;
          const isHovered = hoveredFile === r.file.file;
          const minDim = Math.min(r.w, r.h);
          const showLabel = minDim > 20 && r.w > 30;
          const fontSize = Math.min(11, r.w / shortName(r.file.file).length * 1.6);
          return (
            <g key={r.file.key} className="vr-heatmap-cell">
              <rect
                x={r.x + 0.5}
                y={r.y + 0.5}
                width={Math.max(r.w - 1, 0)}
                height={Math.max(r.h - 1, 0)}
                fill={getColor(r.file)}
                stroke={isActive ? "#007acc" : isHovered ? "#ccc" : "#1e1e1e"}
                strokeWidth={isActive ? 2 : 0.5}
                rx={2}
                className="vr-heatmap-rect"
                onClick={() => onSelect(r.file.key)}
                onMouseMove={(e) => handleMouseMove(e, r.file)}
                onMouseLeave={handleMouseLeave}
              />
              {showLabel && fontSize >= 5 && (
                <text
                  x={r.x + r.w / 2}
                  y={r.y + r.h / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={isActive ? "#fff" : "#ddd"}
                  fontSize={fontSize}
                  fontWeight={isActive ? 700 : 400}
                  style={{ pointerEvents: "none", textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
                >
                  {shortName(r.file.file)}
                </text>
              )}
              {isActive && (
                <rect
                  x={r.x + 0.5}
                  y={r.y + r.h - 3}
                  width={Math.max(r.w - 1, 0)}
                  height={2.5}
                  fill="#007acc"
                  rx={1}
                  style={{ pointerEvents: "none" }}
                />
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
          <div style={{ fontWeight: 600, marginBottom: 3, color: "#fff" }}>{tooltip.file.file}</div>
          <div className="vr-heatmap-tooltip-row">
            <span>Complexity</span><span style={{ color: interpolateColor(tooltip.file.complexity / maxes.complexity, COLOR_SCALES.complexity) }}>{tooltip.file.complexity}</span>
          </div>
          <div className="vr-heatmap-tooltip-row">
            <span>Entities</span><span>{tooltip.file.count}</span>
          </div>
          <div className="vr-heatmap-tooltip-row">
            <span>Commits</span><span>{tooltip.file.commits}</span>
          </div>
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

  .vr-heatmap-rect {
    cursor: pointer;
    transition: opacity 0.2s, stroke 0.15s;
  }
  .vr-heatmap-rect:hover {
    opacity: 1 !important;
    filter: brightness(1.15);
  }

  .vr-heatmap-cell {
    animation: vr-heatmap-fadein 0.3s ease-out;
  }

  @keyframes vr-heatmap-fadein {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }

  .vr-heatmap-tooltip {
    position: absolute;
    background: #1e1e1e;
    border: 1px solid #555;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 11px;
    color: #d4d4d4;
    pointer-events: none;
    z-index: 100;
    max-width: 280px;
    white-space: nowrap;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  }

  .vr-heatmap-tooltip-row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    line-height: 1.6;
  }
`;
