import { useState, useEffect } from "react";
import { ConceptTab } from "./tabs/ConceptTab";
import { FlowTab } from "./tabs/FlowTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { JumpTab } from "./tabs/JumpTab";
import type { DataEntity, TabId } from "./shared-types";

const vscode = acquireVsCodeApi();

const TABS: { id: TabId; label: string }[] = [
  { id: "concept", label: "Concept" },
  { id: "flow", label: "Flow" },
  { id: "history", label: "History" },
  { id: "jump", label: "Jump" },
];

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>("concept");
  const [entities, setEntities] = useState<DataEntity[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "fileChanged") {
        setCurrentFile(msg.file);
        setEntities(msg.entities);
        setHasData(msg.hasData);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const filtered = entities.filter((e) => e.type === activeTab);

  const onCardClick = (entity: DataEntity) => {
    vscode.postMessage({
      type: "navigateTo",
      file: entity.anchor.file,
      startLine: entity.anchor.start_line,
      endLine: entity.anchor.end_line,
      startCol: entity.anchor.start_col,
    });
  };

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
    <div className="vr-root">
      <style>{styles}</style>

      {!currentFile && (
        <div className="vr-empty">
          <div className="vr-empty-icon">&#x1F4D6;</div>
          <div className="vr-empty-title">Vibe Reading</div>
          <div className="vr-empty-hint">Open a source file to see knowledge cards.</div>
        </div>
      )}

      {currentFile && !hasData && (
        <div className="vr-empty">
          <div className="vr-empty-icon">&#x26A1;</div>
          <div className="vr-empty-title">No data for <code>{currentFile.split("/").pop()}</code></div>
          <div className="vr-empty-hint">
            Run <code>/learn</code> in Cursor to analyze this project.
          </div>
        </div>
      )}

      {currentFile && hasData && (
        <>
          <div className="vr-file-header">
            <span className="vr-file-icon">&#x1F4C4;</span>
            <span className="vr-file-path" title={currentFile}>{currentFile}</span>
            <span className="vr-file-count">{entities.length}</span>
          </div>
          <nav className="vr-tabs">
            {TABS.map((tab) => {
              const count = entities.filter((e) => e.type === tab.id).length;
              return (
                <button
                  key={tab.id}
                  className={`vr-tab ${activeTab === tab.id ? "vr-tab--active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                  {count > 0 && <span className="vr-tab-count">{count}</span>}
                </button>
              );
            })}
          </nav>
          <div className="vr-content">{tabContent()}</div>
        </>
      )}
    </div>
  );
}

const styles = `
  .vr-root {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    padding: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .vr-empty {
    padding: 48px 20px 32px;
    text-align: center;
    color: var(--vscode-descriptionForeground);
    line-height: 1.6;
  }

  .vr-empty-icon {
    font-size: 32px;
    margin-bottom: 12px;
    opacity: 0.6;
  }

  .vr-empty-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--vscode-foreground);
    margin-bottom: 6px;
  }

  .vr-empty-hint {
    font-size: 12px;
    opacity: 0.7;
  }

  .vr-empty code {
    background: var(--vscode-textCodeBlock-background);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.9em;
  }

  .vr-file-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
  }

  .vr-file-icon {
    font-size: 12px;
    opacity: 0.7;
  }

  .vr-file-path {
    color: var(--vscode-foreground);
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
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
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
    color: var(--vscode-foreground);
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

  .vr-tab:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.04);
  }

  .vr-tab--active {
    opacity: 1;
    background: rgba(255, 255, 255, 0.08);
  }

  .vr-tab-count {
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
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
  }

  .vr-card {
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    margin-bottom: 6px;
    overflow: hidden;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .vr-card:hover {
    border-color: var(--vscode-focusBorder);
    box-shadow: 0 0 0 1px rgba(0, 122, 204, 0.15);
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
    font-family: var(--vscode-editor-font-family, 'Cascadia Code', Consolas, monospace);
    color: var(--vscode-foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .vr-card-summary {
    font-size: 12px;
    line-height: 1.4;
    color: var(--vscode-descriptionForeground);
  }

  .vr-card-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .vr-card-loc {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
    font-family: var(--vscode-editor-font-family, monospace);
  }

  .vr-card-lines {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    opacity: 0.6;
  }

  .vr-card-chevron {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    transition: transform 0.2s;
    opacity: 0.5;
  }

  .vr-card-chevron--open {
    transform: rotate(90deg);
  }

  .vr-card-detail {
    padding: 8px 10px 10px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--vscode-descriptionForeground);
    border-top: 1px solid var(--vscode-panel-border);
    overflow: hidden;
  }

  .vr-card-desc {
    margin: 4px 0 8px;
  }

  .vr-card-raw {
    margin: 4px 0 8px;
    font-size: 11px;
    font-family: var(--vscode-editor-font-family, monospace);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .vr-card-chips {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .vr-card-chip {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 3px;
    background: var(--vscode-textCodeBlock-background);
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
  }

  .vr-no-cards {
    text-align: center;
    padding: 32px 20px;
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
  }
`;

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};
