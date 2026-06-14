import { useState, useEffect, useCallback, useRef } from "react";
import { ConceptTab } from "./tabs/ConceptTab";
import { FlowTab } from "./tabs/FlowTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { JumpTab } from "./tabs/JumpTab";
import { MonacoEditor, detectLanguage } from "./MonacoEditor";
import { FileTree, fileTreeStyles } from "./components/FileTree";
import type { DataEntity, TabId } from "./shared-types";

declare const PREVIEW_DATA: Record<
  string,
  { file: string; entities: DataEntity[] }
>;

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
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [treeOpen, setTreeOpen] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

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
      setOpenFiles((prev) =>
        prev.includes(data.file) ? prev : [...prev, data.file]
      );

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

  const closeTab = useCallback(
    (file: string) => {
      setOpenFiles((prev) => {
        const next = prev.filter((f) => f !== file);
        if (file === currentFile && next.length > 0) {
          const fileKey = allFiles.find((f) => f.file === next[next.length - 1])?.key;
          if (fileKey) selectFile(fileKey);
        } else if (next.length === 0) {
          setCurrentFile(null);
          setEntities([]);
          setSourceCode("");
        }
        return next;
      });
    },
    [currentFile, allFiles, selectFile]
  );

  const onCardClick = useCallback((entity: DataEntity) => {
    if (entity.type === "jump" && entity.detail.target_file) {
      const targetFile = entity.detail.target_file as string;
      const fk = allFiles.find((f) => f.file === targetFile)?.key;
      if (fk) {
        selectFile(fk);
        return;
      }
    }
    setHighlightRange({
      startLine: entity.anchor.start_line,
      endLine: entity.anchor.end_line || entity.anchor.start_line,
    });
  }, [allFiles, selectFile]);

  useEffect(() => {
    if (allFiles.length > 0 && !currentFile) {
      selectFile(allFiles[0].key);
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        setPickerOpen(true);
        setTimeout(() => searchRef.current?.focus(), 0);
      }
      if (e.key === "Escape") {
        setPickerOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

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
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (visibleFiles.length > 0) {
        const active = visibleFiles.find((f) => f.file === currentFile);
        selectFile((active ?? visibleFiles[0]).key);
        setPickerOpen(false);
      }
    } else if (e.key === "Escape") {
      setPickerOpen(false);
    }
  };

  const filtered = entities.filter((e) => e.type === activeTab);

  const tabContent = () => {
    switch (activeTab) {
      case "concept":
        return <ConceptTab entities={filtered} onCardClick={onCardClick} />;
      case "flow":
        return <FlowTab entities={filtered} onCardClick={onCardClick} />;
      case "history":
        return <HistoryTab entities={filtered} onCardClick={onCardClick} />;
      case "jump":
        return <JumpTab entities={filtered} onCardClick={onCardClick} />;
    }
  };

  return (
    <div className="vr-layout">
      <style>{layoutStyles}</style>
      <style>{sidebarStyles}</style>
      <style>{fileTreeStyles}</style>

      {/* Activity bar — icon strip */}
      <div className="vr-activity-bar">
        <button
          className={`vr-activity-btn ${treeOpen ? "vr-activity-btn--active" : ""}`}
          onClick={() => setTreeOpen(!treeOpen)}
          title="Explorer"
        >
          &#x1F4C1;
        </button>
        <button
          className="vr-activity-btn"
          onClick={() => { setPickerOpen(true); setTimeout(() => searchRef.current?.focus(), 0); }}
          title="Search Files (Ctrl+P)"
        >
          &#x1F50D;
        </button>
      </div>

      {/* File tree panel */}
      {treeOpen && (
        <div className="vr-file-panel">
          <FileTree files={allFiles} currentFile={currentFile} onSelect={selectFile} />
        </div>
      )}

      {/* Sidebar — knowledge cards */}
      <div className="vr-sidebar">
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
            <div className="vr-content">{tabContent()}</div>
          </>
        )}
      </div>

      {/* Main area — Monaco editor */}
      <div className="vr-main">
        {openFiles.length > 0 && (
          <div className="vr-tab-bar">
            {openFiles.map((file) => {
              const fk = allFiles.find((f) => f.file === file)?.key;
              return (
                <div
                  key={file}
                  className={`vr-tab-item ${file === currentFile ? "vr-tab-item--active" : ""}`}
                  onClick={() => fk && selectFile(fk)}
                >
                  <span className="vr-tab-item-label">{file.split("/").pop()}</span>
                  <span
                    className="vr-tab-item-close"
                    onClick={(e) => { e.stopPropagation(); closeTab(file); }}
                  >
                    &#x2715;
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <div className="vr-editor-wrap">
          {sourceCode ? (
            <MonacoEditor
              code={sourceCode}
              language={sourceLanguage}
              highlightRange={highlightRange}
            />
          ) : (
            <div className="vr-editor-placeholder">
              Select a file to view source code.
            </div>
          )}
        </div>
      </div>

      {/* File picker — command palette */}
      {pickerOpen && (
        <>
        <div className="vr-picker-overlay" onClick={() => setPickerOpen(false)} />
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
                  setPickerOpen(false);
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
        </>
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

  .vr-activity-bar {
    width: 40px;
    background: #333;
    border-right: 1px solid #3c3c3c;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 8px;
    gap: 4px;
    flex-shrink: 0;
  }

  .vr-activity-btn {
    width: 32px;
    height: 32px;
    background: none;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
    opacity: 0.5;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.15s;
  }

  .vr-activity-btn:hover { opacity: 0.9; }
  .vr-activity-btn--active { opacity: 1; border-left: 2px solid #007acc; }

  .vr-file-panel {
    width: 220px;
    min-width: 160px;
    background: #252526;
    border-right: 1px solid #3c3c3c;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex-shrink: 0;
  }

  .vr-sidebar {
    width: 340px;
    min-width: 280px;
    max-width: 420px;
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
    min-width: 0;
  }

  .vr-tab-bar {
    display: flex;
    background: #252526;
    border-bottom: 1px solid #3c3c3c;
    height: 35px;
    align-items: stretch;
    flex-shrink: 0;
    overflow-x: auto;
  }

  .vr-tab-bar::-webkit-scrollbar { height: 0; }

  .vr-tab-item {
    padding: 0 8px 0 12px;
    font-size: 12px;
    color: #888;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    border-right: 1px solid #3c3c3c;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .vr-tab-item--active {
    color: #fff;
    background: #1e1e1e;
    border-bottom: 1px solid #1e1e1e;
    margin-bottom: -1px;
  }

  .vr-tab-item-label { pointer-events: none; }

  .vr-tab-item-close {
    font-size: 10px;
    opacity: 0;
    padding: 2px 4px;
    border-radius: 3px;
    transition: opacity 0.1s;
  }

  .vr-tab-item:hover .vr-tab-item-close { opacity: 0.6; }
  .vr-tab-item-close:hover { opacity: 1 !important; background: rgba(255,255,255,0.1); }

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

  /* File picker — VS Code-style command palette */
  .vr-picker-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.3);
    z-index: 199;
  }

  .vr-picker {
    position: fixed;
    top: 15%;
    left: 50%;
    transform: translateX(-50%);
    width: 520px;
    max-height: 440px;
    background: #2d2d2d;
    border: 1px solid #555;
    border-radius: 8px;
    box-shadow: 0 12px 48px rgba(0,0,0,0.5);
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

  .vr-content {
    flex: 1;
    overflow-y: auto;
    padding: 6px 8px;
    scroll-behavior: smooth;
  }

  .vr-content::-webkit-scrollbar { width: 6px; }
  .vr-content::-webkit-scrollbar-thumb { background: #555; border-radius: 3px; }
  .vr-content::-webkit-scrollbar-track { background: transparent; }

  .vr-card {
    background: #1e1e1e;
    border: 1px solid #3c3c3c;
    border-radius: 6px;
    margin-bottom: 6px;
    overflow: hidden;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .vr-card:hover {
    border-color: #007acc;
    box-shadow: 0 0 0 1px rgba(0,122,204,0.15);
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
    padding: 8px 10px 10px;
    font-size: 12px;
    line-height: 1.6;
    color: #8b8b8b;
    border-top: 1px solid #3c3c3c;
    overflow: hidden;
  }

  .vr-card-desc { margin: 4px 0 8px; }

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
`;

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};
