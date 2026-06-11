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
        <div className="vr-empty">Open a file to see knowledge cards.</div>
      )}

      {currentFile && !hasData && (
        <div className="vr-empty">
          No data for <code>{currentFile}</code>.
          <br />
          Run <code>/learn</code> to analyze this project.
        </div>
      )}

      {currentFile && hasData && (
        <>
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
    padding: 20px;
    text-align: center;
    color: var(--vscode-descriptionForeground);
    line-height: 1.6;
  }

  .vr-empty code {
    background: var(--vscode-textCodeBlock-background);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.9em;
  }

  .vr-tabs {
    display: flex;
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
  }

  .vr-tab {
    flex: 1;
    padding: 8px 4px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--vscode-foreground);
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    opacity: 0.7;
    transition: opacity 0.15s, border-color 0.15s;
  }

  .vr-tab:hover {
    opacity: 1;
  }

  .vr-tab--active {
    opacity: 1;
    border-bottom-color: var(--vscode-focusBorder);
  }

  .vr-tab-count {
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    padding: 0 5px;
    border-radius: 8px;
    font-size: 10px;
    min-width: 16px;
    text-align: center;
  }

  .vr-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .vr-card {
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    margin-bottom: 8px;
    overflow: hidden;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .vr-card:hover {
    border-color: var(--vscode-focusBorder);
  }

  .vr-card-header {
    padding: 10px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .vr-card-summary {
    font-size: 13px;
    line-height: 1.4;
  }

  .vr-card-loc {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
    margin-left: 8px;
  }

  .vr-card-detail {
    padding: 0 12px 10px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--vscode-descriptionForeground);
    border-top: 1px solid var(--vscode-panel-border);
  }

  .vr-no-cards {
    text-align: center;
    padding: 20px;
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
  }
`;

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};
