import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ConceptTab } from "./tabs/ConceptTab";
import { FlowTab } from "./tabs/FlowTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { JumpTab } from "./tabs/JumpTab";
import { MonacoEditor, detectLanguage } from "./MonacoEditor";
import { FileTree } from "./components/FileTree";
import type { DataEntity, TabId, FlowDataType } from "./shared-types";

declare const PREVIEW_DATA: Record<
  string,
  { file: string; entities: DataEntity[] }
>;

declare const GLOBAL_DATA: Record<string, unknown> | undefined;

const TABS: { id: TabId; label: string }[] = [
  { id: "concept", label: "Concept" },
  { id: "flow", label: "Flow" },
  { id: "history", label: "History" },
  { id: "jump", label: "Jump" },
];

interface FileInfo {
  key: string;
  file: string;
  count: number;
}

function useResizable(initialWidth: number, min: number, max: number) {
  const [width, setWidth] = useState(initialWidth);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = ev.clientX - startX.current;
      setWidth(Math.max(min, Math.min(max, startW.current + delta)));
    };

    const onUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [width, min, max]);

  return { width, onMouseDown };
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>("concept");
  const [entities, setEntities] = useState<DataEntity[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [sourceCode, setSourceCode] = useState<string>("");
  const [sourceLanguage, setSourceLanguage] = useState<string>("plaintext");
  const [highlightRange, setHighlightRange] = useState<{
    startLine: number;
    endLine: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [knowledgeLevel, setKnowledgeLevel] = useState<"all" | "basic" | "advanced">("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hoveredEntityIdx, setHoveredEntityIdx] = useState<number | null>(null);
  const [cardHoveredEntity, setCardHoveredEntity] = useState<DataEntity | null>(null);
  const [focusedCardIdx, setFocusedCardIdx] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const treeResize = useResizable(220, 120, 400);
  const sidebarResize = useResizable(340, 240, 600);

  const allFiles: FileInfo[] = Object.entries(PREVIEW_DATA)
    .map(([key, data]) => ({
      key,
      file: data.file,
      count: data.entities.length,
    }))
    .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file));

  const filteredFiles = searchQuery.trim()
    ? allFiles.filter((f) =>
        f.file.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : allFiles;

  const visibleFiles = filteredFiles.slice(0, 100);
  const remaining = filteredFiles.length - visibleFiles.length;

  const selectFile = useCallback(
    async (key: string) => {
      const data = PREVIEW_DATA[key];
      if (!data) return;

      setCurrentFile(data.file);
      setEntities(data.entities);
      setHighlightRange(null);
      setSourceLanguage(detectLanguage(data.file));

      try {
        const resp = await fetch(
          `/api/source?file=${encodeURIComponent(data.file)}`
        );
        if (resp.ok) {
          const json = await resp.json();
          setSourceCode(json.content);
        } else {
          setSourceCode(`// Source file not found: ${data.file}`);
        }
      } catch {
        setSourceCode(`// Failed to load source: ${data.file}`);
      }
    },
    []
  );

  const onCardClick = useCallback((entity: DataEntity) => {
    setHighlightRange({
      startLine: entity.anchor.start_line,
      endLine: entity.anchor.end_line || entity.anchor.start_line,
    });
  }, []);

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onHoverLine = useCallback(
    (line: number | null) => {
      if (clearTimerRef.current) { clearTimeout(clearTimerRef.current); clearTimerRef.current = null; }

      if (line == null) {
        clearTimerRef.current = setTimeout(() => setHoveredEntityIdx(null), 150);
        return;
      }

      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => {
        let bestIdx = -1;
        let bestSpan = Infinity;
        for (let i = 0; i < entities.length; i++) {
          const e = entities[i];
          const end = e.anchor.end_line || e.anchor.start_line;
          if (e.anchor.start_line <= line && line <= end) {
            const span = end - e.anchor.start_line;
            if (span < bestSpan) {
              bestSpan = span;
              bestIdx = i;
            }
          }
        }
        setHoveredEntityIdx(bestIdx >= 0 ? bestIdx : null);
      }, 80);
    },
    [entities]
  );

  const hoveredEntity = useMemo(
    () => (hoveredEntityIdx != null ? entities[hoveredEntityIdx] : null),
    [entities, hoveredEntityIdx]
  );

  const onCardHover = useCallback((entity: DataEntity | null) => {
    setCardHoveredEntity(entity);
  }, []);

  const hoverSource = cardHoveredEntity ?? hoveredEntity;
  const hoverRange = useMemo(
    () =>
      hoverSource
        ? {
            startLine: hoverSource.anchor.start_line,
            endLine: hoverSource.anchor.end_line || hoverSource.anchor.start_line,
          }
        : null,
    [hoverSource]
  );

  useEffect(() => {
    if (allFiles.length > 0 && !currentFile) {
      selectFile(allFiles[0].key);
    }
  }, []);

  const filtered = entities.filter((e) => {
    if (e.type !== activeTab) return false;
    if (knowledgeLevel === "all") return true;
    const level = (e.detail as { level?: string }).level || "basic";
    return level === knowledgeLevel;
  });

  // Reset focused card when file or tab changes
  useEffect(() => { setFocusedCardIdx(null); }, [currentFile, activeTab]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        setPickerOpen(true);
        setTimeout(() => searchRef.current?.focus(), 0);
        return;
      }
      if (e.key === "Escape") {
        if (pickerOpen) setPickerOpen(false);
        else setFocusedCardIdx(null);
        return;
      }

      // Skip if user is typing in an input or the picker is open
      const tag = (e.target as HTMLElement)?.tagName;
      if (pickerOpen || tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedCardIdx((prev) => {
          const max = filtered.length - 1;
          if (max < 0) return null;
          return prev == null ? 0 : Math.min(prev + 1, max);
        });
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedCardIdx((prev) => {
          if (filtered.length === 0) return null;
          return prev == null ? 0 : Math.max(prev - 1, 0);
        });
      } else if (e.key === "Enter" && focusedCardIdx != null && filtered[focusedCardIdx]) {
        e.preventDefault();
        onCardClick(filtered[focusedCardIdx]);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pickerOpen, filtered, focusedCardIdx, onCardClick]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const idx = visibleFiles.findIndex(
        (f) => f.file === currentFile
      );
      const next =
        e.key === "ArrowDown"
          ? Math.min(idx + 1, visibleFiles.length - 1)
          : Math.max(idx - 1, 0);
      if (visibleFiles[next]) selectFile(visibleFiles[next].key);
    } else if (e.key === "Escape") {
      setPickerOpen(false);
    }
  };

  const sourceLines = useMemo(() => sourceCode ? sourceCode.split("\n") : [], [sourceCode]);
  const focusedEntity = focusedCardIdx != null ? filtered[focusedCardIdx] ?? null : null;
  const effectiveHighlight = focusedEntity ?? hoveredEntity;

  const flowData = typeof GLOBAL_DATA !== "undefined" ? (GLOBAL_DATA as Record<string, unknown>).flow as FlowDataType | undefined : undefined;

  const tabContent = () => {
    const props = { entities: filtered, onCardClick, hoveredEntity: effectiveHighlight, onCardHover, sourceLines };
    switch (activeTab) {
      case "concept": return <ConceptTab {...props} />;
      case "flow": return <FlowTab {...props} flowData={flowData} currentFile={currentFile} />;
      case "history": return <HistoryTab {...props} />;
      case "jump": return <JumpTab {...props} />;
    }
  };

  return (
    <div className="vr-layout">
      <style>{layoutStyles}</style>
      <style>{sidebarStyles}</style>
      <style>{treeStyles}</style>

      {/* File tree panel */}
      <div className="vr-tree-panel" style={{ width: treeResize.width }}>
        <FileTree files={allFiles} currentFile={currentFile} onSelectFile={selectFile} />
      </div>
      <div className="vr-resize-handle" onMouseDown={treeResize.onMouseDown} />

      {/* Sidebar — knowledge cards */}
      <div className="vr-sidebar" style={{ width: sidebarResize.width }}>
        {!currentFile && (
          <div className="vr-empty">
            <div className="vr-empty-icon">&#x1F4D6;</div>
            <div className="vr-empty-title">Vibe Reading</div>
            <div className="vr-empty-hint">
              Select a file to see knowledge cards.
            </div>
          </div>
        )}

        {currentFile && (
          <>
            <div className="vr-file-header">
              <span className="vr-file-icon">&#x1F4C4;</span>
              <span className="vr-file-path" title={currentFile}>
                {currentFile}
              </span>
              <span className="vr-file-count">{entities.length}</span>
            </div>
            <nav className="vr-tabs">
              {TABS.map((tab) => {
                const count = entities.filter(
                  (e) => e.type === tab.id
                ).length;
                return (
                  <button
                    key={tab.id}
                    className={`vr-tab ${
                      activeTab === tab.id ? "vr-tab--active" : ""
                    }`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                    {count > 0 && (
                      <span className="vr-tab-count">{count}</span>
                    )}
                  </button>
                );
              })}
            </nav>
            {activeTab === "concept" && (
              <div className="vr-level-toggle">
                <button
                  className={`vr-level-btn ${knowledgeLevel === "all" ? "vr-level-btn--active" : ""}`}
                  onClick={() => setKnowledgeLevel("all")}
                >
                  All
                </button>
                <button
                  className={`vr-level-btn ${knowledgeLevel === "basic" ? "vr-level-btn--active" : ""}`}
                  onClick={() => setKnowledgeLevel("basic")}
                >
                  Basic
                </button>
                <button
                  className={`vr-level-btn ${knowledgeLevel === "advanced" ? "vr-level-btn--active" : ""}`}
                  onClick={() => setKnowledgeLevel("advanced")}
                >
                  Advanced
                </button>
              </div>
            )}
            <div className="vr-content">{tabContent()}</div>
          </>
        )}
      </div>
      <div className="vr-resize-handle" onMouseDown={sidebarResize.onMouseDown} />

      {/* Main area — Monaco editor */}
      <div className="vr-main">
        {currentFile && (
          <div className="vr-breadcrumb-bar">
            {currentFile.split("/").map((segment, i, arr) => (
              <span key={i} className="vr-breadcrumb-segment">
                {i > 0 && <span className="vr-breadcrumb-sep">&#x276F;</span>}
                <span className={`vr-breadcrumb-label${i === arr.length - 1 ? " vr-breadcrumb-label--active" : ""}`}>
                  {segment}
                </span>
              </span>
            ))}
          </div>
        )}
        <div className="vr-editor-wrap">
          {sourceCode ? (
            <MonacoEditor
              code={sourceCode}
              language={sourceLanguage}
              highlightRange={highlightRange}
              hoverRange={hoverRange}
              onHoverLine={onHoverLine}
            />
          ) : (
            <div className="vr-editor-placeholder">
              Select a file to view source code.
            </div>
          )}
        </div>
      </div>

      {/* File picker — floating panel */}
      {pickerOpen && (
        <div className="vr-picker">
          <div className="vr-picker-header">
            <input
              ref={searchRef}
              type="text"
              className="vr-picker-search"
              placeholder="Search files... (Ctrl+P)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              autoFocus
            />
            <button
              className="vr-picker-close"
              onClick={() => setPickerOpen(false)}
            >
              &#x2715;
            </button>
          </div>
          <div className="vr-picker-list">
            {visibleFiles.map((f) => (
              <div
                key={f.key}
                className={`vr-picker-item ${
                  f.file === currentFile ? "vr-picker-item--active" : ""
                }`}
                onClick={() => {
                  selectFile(f.key);
                }}
              >
                <span className="vr-picker-path">{f.file}</span>
                {f.count > 0 && (
                  <span className="vr-picker-count">{f.count}</span>
                )}
              </div>
            ))}
            {remaining > 0 && (
              <div className="vr-picker-item vr-picker-more">
                ... {remaining} more (type to filter)
              </div>
            )}
          </div>
          <div className="vr-picker-footer">
            {allFiles.length} files &middot; {filteredFiles.length} matches
          </div>
        </div>
      )}
    </div>
  );
}

const layoutStyles = `
  .vr-layout {
    display: flex;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background: #1e1e1e;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    color: #ccc;
  }

  .vr-resize-handle {
    width: 4px;
    cursor: col-resize;
    background: transparent;
    flex-shrink: 0;
    position: relative;
    z-index: 5;
    transition: background 0.15s;
  }

  .vr-resize-handle:hover,
  .vr-resize-handle:active {
    background: #007acc;
  }

  .vr-sidebar {
    flex-shrink: 0;
    border-right: 1px solid #3c3c3c;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #252526;
  }

  .vr-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .vr-breadcrumb-bar {
    display: flex;
    align-items: center;
    background: #252526;
    border-bottom: 1px solid #3c3c3c;
    height: 28px;
    padding: 0 12px;
    flex-shrink: 0;
    overflow: hidden;
  }

  .vr-breadcrumb-segment {
    display: flex;
    align-items: center;
    white-space: nowrap;
  }

  .vr-breadcrumb-sep {
    color: #555;
    font-size: 9px;
    margin: 0 6px;
  }

  .vr-breadcrumb-label {
    font-size: 12px;
    color: #888;
    cursor: default;
  }

  .vr-breadcrumb-label--active {
    color: #ccc;
    font-weight: 500;
  }

  .vr-editor-wrap {
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  .vr-editor-placeholder {
    padding: 48px 20px;
    text-align: center;
    color: #555;
    font-size: 14px;
  }

  .vr-monaco-highlight {
    background: rgba(0, 122, 204, 0.15) !important;
  }

  .vr-monaco-glyph {
    background: #007acc;
    width: 3px !important;
    margin-left: 3px;
    border-radius: 1px;
  }

  .vr-monaco-hover-range {
    background: rgba(0, 122, 204, 0.06) !important;
    border-left: 2px solid rgba(0, 122, 204, 0.3);
  }

  /* File picker */
  .vr-picker {
    position: fixed;
    bottom: 16px;
    right: 16px;
    width: 380px;
    max-height: 400px;
    background: #2d2d2d;
    border: 1px solid #555;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    z-index: 200;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .vr-picker-header {
    display: flex;
    padding: 8px;
    gap: 6px;
    border-bottom: 1px solid #444;
  }

  .vr-picker-search {
    flex: 1;
    padding: 6px 10px;
    background: #1e1e1e;
    color: #ccc;
    border: 1px solid #555;
    border-radius: 4px;
    font-size: 12px;
    font-family: inherit;
    outline: none;
  }

  .vr-picker-search:focus {
    border-color: #007acc;
  }

  .vr-picker-close {
    background: none;
    border: none;
    color: #888;
    cursor: pointer;
    font-size: 14px;
    padding: 4px 8px;
  }

  .vr-picker-close:hover {
    color: #ccc;
  }

  .vr-picker-list {
    flex: 1;
    overflow-y: auto;
    max-height: 280px;
  }

  .vr-picker-list::-webkit-scrollbar {
    width: 6px;
  }

  .vr-picker-list::-webkit-scrollbar-thumb {
    background: #555;
    border-radius: 3px;
  }

  .vr-picker-item {
    padding: 5px 12px;
    cursor: pointer;
    font-size: 11px;
    color: #bbb;
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .vr-picker-item:hover {
    background: #333;
  }

  .vr-picker-item--active {
    background: rgba(0,122,204,0.2);
    color: #fff;
  }

  .vr-picker-path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .vr-picker-count {
    flex-shrink: 0;
    color: #666;
    font-size: 10px;
  }

  .vr-picker-more {
    color: #666;
    font-style: italic;
    cursor: default;
  }

  .vr-picker-footer {
    padding: 4px 12px;
    font-size: 10px;
    color: #666;
    border-top: 1px solid #444;
    text-align: right;
  }
`;

const sidebarStyles = `
  :root {
    --vscode-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --vscode-font-size: 13px;
    --vscode-foreground: #cccccc;
    --vscode-descriptionForeground: #8b8b8b;
    --vscode-panel-border: #3c3c3c;
    --vscode-editor-background: #1e1e1e;
    --vscode-focusBorder: #007acc;
    --vscode-badge-background: #4d4d4d;
    --vscode-badge-foreground: #cccccc;
    --vscode-textCodeBlock-background: #2d2d2d;
  }

  .vr-empty {
    padding: 48px 20px 32px;
    text-align: center;
    color: #8b8b8b;
    line-height: 1.6;
  }

  .vr-empty-icon { font-size: 32px; margin-bottom: 12px; opacity: 0.6; }
  .vr-empty-title { font-size: 14px; font-weight: 500; color: #ccc; margin-bottom: 6px; }
  .vr-empty-hint { font-size: 12px; opacity: 0.7; }
  .vr-empty code { background: #2d2d2d; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }

  .vr-file-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    font-size: 12px;
    color: #8b8b8b;
    border-bottom: 1px solid #3c3c3c;
    flex-shrink: 0;
  }

  .vr-file-icon { font-size: 12px; opacity: 0.7; }

  .vr-file-path {
    color: #ccc;
    font-weight: 500;
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    direction: rtl;
    text-align: left;
    min-width: 0;
    flex: 1;
  }

  .vr-file-count {
    flex-shrink: 0;
    font-size: 10px;
    opacity: 0.5;
    background: #4d4d4d;
    color: #ccc;
    padding: 0 5px;
    border-radius: 8px;
    line-height: 16px;
  }

  .vr-tabs {
    display: flex;
    gap: 2px;
    padding: 6px 8px;
    flex-shrink: 0;
  }

  .vr-tab {
    flex: 1;
    padding: 5px 4px;
    background: none;
    border: none;
    border-radius: 4px;
    color: #ccc;
    cursor: pointer;
    font-size: 11px;
    font-family: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    opacity: 0.6;
    transition: opacity 0.15s, background 0.15s;
  }

  .vr-tab:hover { opacity: 1; background: rgba(255,255,255,0.04); }
  .vr-tab--active { opacity: 1; background: rgba(255,255,255,0.08); }

  .vr-tab-count {
    background: #4d4d4d;
    color: #ccc;
    padding: 0 5px;
    border-radius: 8px;
    font-size: 10px;
    min-width: 14px;
    text-align: center;
    line-height: 16px;
  }

  .vr-level-toggle {
    display: flex;
    gap: 2px;
    padding: 0 8px 6px;
    flex-shrink: 0;
  }

  .vr-level-btn {
    flex: 1;
    padding: 3px 4px;
    background: none;
    border: 1px solid #3c3c3c;
    border-radius: 4px;
    color: #888;
    cursor: pointer;
    font-size: 10px;
    font-family: inherit;
    text-align: center;
    transition: all 0.15s;
  }

  .vr-level-btn:hover { color: #ccc; border-color: #555; }

  .vr-level-btn--active {
    color: #ccc;
    background: rgba(0, 122, 204, 0.15);
    border-color: #007acc;
  }

  .vr-content {
    flex: 1;
    overflow-y: auto;
    padding: 6px 8px;
  }

  .vr-card {
    background: #1e1e1e;
    border: 1px solid #333;
    border-radius: 8px;
    margin-bottom: 8px;
    overflow: hidden;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.25s ease, background 0.25s ease, transform 0.15s ease;
  }

  .vr-card:hover {
    border-color: #4a4a4a;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    transform: translateY(-1px);
  }

  .vr-card--highlighted {
    border-color: #007acc;
    box-shadow: 0 0 16px rgba(0,122,204,0.25), 0 4px 12px rgba(0, 0, 0, 0.3);
    background: #1a2332;
    transform: translateY(-1px);
  }

  .vr-card-header {
    padding: 8px 10px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .vr-card-left {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }

  .vr-card-badge {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border: 1px solid;
    border-radius: 3px;
    padding: 1px 5px;
    white-space: nowrap;
    flex-shrink: 0;
    line-height: 16px;
    margin-top: 1px;
  }

  .vr-card-title-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .vr-card-name {
    font-size: 13px;
    font-weight: 600;
    font-family: 'Cascadia Code', Consolas, monospace;
    color: #ccc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .vr-card-summary { font-size: 12px; line-height: 1.4; color: #8b8b8b; }

  .vr-card-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .vr-card-loc {
    font-size: 10px;
    color: #8b8b8b;
    white-space: nowrap;
    font-family: monospace;
  }

  .vr-card-lines { font-size: 10px; color: #8b8b8b; opacity: 0.6; }

  .vr-card-chevron {
    font-size: 10px;
    color: #8b8b8b;
    transition: transform 0.2s;
    opacity: 0.5;
  }

  .vr-card-chevron--open { transform: rotate(90deg); }

  .vr-card-detail {
    padding: 10px 12px 12px;
    font-size: 12px;
    line-height: 1.6;
    color: #8b8b8b;
    border-top: 1px solid #333;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.1);
  }

  .vr-card-desc {
    margin: 2px 0 10px;
    color: #999;
    line-height: 1.55;
  }

  .vr-card-raw {
    margin: 4px 0 8px;
    font-size: 11px;
    font-family: monospace;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .vr-card-chips { display: flex; gap: 4px; flex-wrap: wrap; }

  .vr-card-chip {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 3px;
    background: #2d2d2d;
    color: #8b8b8b;
    white-space: nowrap;
  }

  .vr-no-cards {
    text-align: center;
    padding: 32px 20px;
    color: #8b8b8b;
    font-size: 12px;
  }

  /* Knowledge sections */
  .vr-card-knowledge {
    margin: 10px 0 4px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .vr-card-knowledge--basic {
    border-left: 2px solid #4ec9b055;
    padding-left: 10px;
    background: rgba(78, 201, 176, 0.02);
    border-radius: 0 4px 4px 0;
    padding: 8px 10px 8px 10px;
  }

  .vr-card-knowledge--advanced {
    border-left: 2px solid #c586c055;
    padding-left: 10px;
    margin-top: 8px;
    background: rgba(197, 134, 192, 0.02);
    border-radius: 0 4px 4px 0;
    padding: 8px 10px 8px 10px;
  }

  .vr-card-krow {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 11.5px;
    line-height: 1.55;
  }

  .vr-card-klabel {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: #4ec9b0;
    min-width: 54px;
    opacity: 0.9;
  }

  .vr-card-klabel--adv {
    color: #c586c0;
  }

  .vr-card-ktext {
    color: #b8b8b8;
  }

  .vr-card-ktext--analogy {
    font-style: italic;
    color: #9cdcfe;
    opacity: 0.9;
  }

  .vr-card-kteaches {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .vr-card-teach-chip {
    font-size: 10.5px;
    padding: 2px 8px;
    border-radius: 10px;
    background: rgba(78, 201, 176, 0.08);
    color: #6db5a6;
    border: 1px solid rgba(78, 201, 176, 0.15);
    font-family: 'Cascadia Code', Consolas, monospace;
    line-height: 1.4;
  }

  .vr-card-teach-chip--clickable {
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    color: #4ec9b0;
    border-color: rgba(78, 201, 176, 0.3);
    background: rgba(78, 201, 176, 0.1);
  }

  .vr-card-teach-chip--clickable::after {
    content: '↗';
    font-size: 8px;
    margin-left: 3px;
    opacity: 0.5;
    transition: opacity 0.15s;
  }

  .vr-card-teach-chip--clickable:hover {
    background: rgba(78, 201, 176, 0.22);
    border-color: #4ec9b0;
    box-shadow: 0 0 8px rgba(78, 201, 176, 0.15);
    transform: translateY(-1px);
  }

  .vr-card-teach-chip--clickable:hover::after {
    opacity: 1;
  }

  .vr-card-teach-chip--active {
    background: rgba(78, 201, 176, 0.28);
    border-color: #4ec9b0;
    color: #7eecd8;
    box-shadow: 0 0 12px rgba(78, 201, 176, 0.2);
  }

  .vr-card-teach-chip--active::after {
    content: '▾';
    opacity: 1;
  }

  .vr-card-krow--teaches {
    flex-direction: column;
    align-items: flex-start;
  }

  .vr-card-kteaches-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .vr-card-teach-tooltip {
    background: #1a2a2a;
    border: 1px solid rgba(78, 201, 176, 0.25);
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 11.5px;
    line-height: 1.6;
    color: #c8e0d8;
    margin-top: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: tooltipFadeIn 0.15s ease-out;
  }

  @keyframes tooltipFadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .vr-teach-explain {
    margin: 0 0 8px;
    color: #d4e8e0;
    font-size: 12px;
    line-height: 1.6;
  }

  .vr-teach-rationale {
    margin: 0 0 6px;
    padding: 5px 8px;
    background: rgba(78, 201, 176, 0.06);
    border-radius: 4px;
    color: #9cc;
    font-size: 11px;
  }

  .vr-teach-rationale strong {
    color: #4ec9b0;
    font-weight: 600;
    margin-right: 4px;
  }

  .vr-teach-crosslang {
    margin: 0 0 6px;
    padding: 5px 8px;
    background: rgba(156, 220, 254, 0.06);
    border-radius: 4px;
    color: #9cc8e8;
    font-size: 11px;
    font-family: 'Cascadia Code', Consolas, monospace;
  }

  .vr-teach-crosslang strong {
    color: #9cdcfe;
    font-weight: 600;
    margin-right: 4px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .vr-teach-gotcha {
    margin: 0;
    padding: 5px 8px;
    background: rgba(206, 145, 120, 0.08);
    border-left: 2px solid rgba(206, 145, 120, 0.4);
    border-radius: 0 4px 4px 0;
    color: #e8c0a8;
    font-size: 11px;
  }

  .vr-teach-filter-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    background: rgba(78, 201, 176, 0.08);
    border-bottom: 1px solid rgba(78, 201, 176, 0.2);
    flex-shrink: 0;
    font-size: 11px;
  }

  .vr-teach-filter-label {
    color: #888;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .vr-teach-filter-tag {
    color: #4ec9b0;
    font-family: 'Cascadia Code', Consolas, monospace;
    font-weight: 600;
  }

  .vr-teach-filter-clear {
    background: none;
    border: none;
    color: #888;
    font-size: 12px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
  }

  .vr-teach-filter-clear:hover { color: #e88; }

  .vr-teach-filter-count {
    margin-left: auto;
    color: #666;
    font-size: 10px;
  }

  .vr-card-advanced-toggle {
    background: rgba(197, 134, 192, 0.06);
    border: 1px solid rgba(197, 134, 192, 0.2);
    border-radius: 4px;
    color: #c586c0;
    font-size: 10px;
    cursor: pointer;
    padding: 4px 10px;
    text-align: left;
    opacity: 0.8;
    transition: all 0.15s;
    margin-top: 6px;
  }

  .vr-card-advanced-toggle:hover {
    opacity: 1;
    background: rgba(197, 134, 192, 0.12);
    border-color: rgba(197, 134, 192, 0.4);
  }

  .vr-card-advanced-toggle--collapse {
    margin-bottom: 6px;
    margin-top: 0;
  }

  .vr-card-krow--analogy {
    margin-top: 2px;
    padding-top: 4px;
    border-top: 1px solid #3c3c3c;
  }
`;

const treeStyles = `
  .vr-tree-panel {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #252526;
  }

  .vr-tree {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .vr-tree-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #8b8b8b;
    border-bottom: 1px solid #3c3c3c;
    flex-shrink: 0;
  }

  .vr-tree-header-label { font-weight: 600; }

  .vr-tree-header-count {
    font-size: 10px;
    background: #4d4d4d;
    color: #ccc;
    padding: 0 5px;
    border-radius: 8px;
    line-height: 16px;
  }

  .vr-tree-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }

  .vr-tree-list::-webkit-scrollbar { width: 6px; }
  .vr-tree-list::-webkit-scrollbar-thumb { background: #555; border-radius: 3px; }

  .vr-tree-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    cursor: pointer;
    font-size: 12px;
    color: #bbb;
    white-space: nowrap;
    overflow: hidden;
    line-height: 22px;
  }

  .vr-tree-item:hover { background: rgba(255,255,255,0.04); }
  .vr-tree-item--active { background: rgba(0,122,204,0.15); color: #fff; }

  .vr-tree-icon {
    width: 12px;
    font-size: 10px;
    text-align: center;
    color: #888;
    flex-shrink: 0;
  }

  .vr-tree-name {
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .vr-tree-dir { color: #ccc; font-weight: 500; }

  .vr-tree-count {
    font-size: 10px;
    color: #666;
    flex-shrink: 0;
  }

  .vr-tree-header-actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .vr-tree-btn {
    background: none;
    border: none;
    color: #888;
    font-size: 12px;
    cursor: pointer;
    padding: 0 3px;
    line-height: 16px;
  }

  .vr-tree-btn:hover { color: #ccc; }

  .vr-tree-filter {
    position: relative;
    padding: 4px 8px;
    flex-shrink: 0;
  }

  .vr-tree-filter-input {
    width: 100%;
    padding: 3px 22px 3px 8px;
    background: #3c3c3c;
    border: 1px solid #555;
    border-radius: 3px;
    color: #ccc;
    font-size: 11px;
    outline: none;
    box-sizing: border-box;
  }

  .vr-tree-filter-input:focus { border-color: #007acc; }
  .vr-tree-filter-input::placeholder { color: #666; }

  .vr-tree-filter-clear {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: #888;
    font-size: 14px;
    cursor: pointer;
    padding: 0 2px;
    line-height: 1;
  }

  .vr-tree-filter-clear:hover { color: #ccc; }

  .vr-tree-match {
    color: #e8a838;
    font-weight: 600;
  }

  .vr-tree-empty {
    padding: 12px;
    color: #666;
    font-size: 11px;
    font-style: italic;
    text-align: center;
  }
`;

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};
