import { useState, useMemo } from "react";
import type { DataEntity } from "../shared-types";

interface EntityHistory {
  id: string;
  file: string;
  name: string;
  line_range: [number, number];
  created?: { commit: string; author: string; date: string; message: string };
  last_modified?: { commit: string; author: string; date: string; message: string };
  modification_count: number;
  authors: string[];
  primary_author?: string;
  age_days: number;
  key_changes: { commit: string; date: string; message: string; author: string }[];
}

interface HistoryDataType {
  entities: EntityHistory[];
  file_stats: Record<string, { commits: number; authors: string[]; first_commit: string; last_commit: string }>;
}

interface Props {
  entities: DataEntity[];
  onCardClick: (entity: DataEntity) => void;
  hoveredEntity?: DataEntity | null;
  onCardHover?: (entity: DataEntity | null) => void;
  sourceLines?: string[];
  historyData?: HistoryDataType;
  currentFile?: string | null;
}

type SortKey = "name" | "age" | "modifications" | "authors";

export function HistoryTab({ entities, historyData, currentFile, onCardClick }: Props) {
  const [sortBy, setSortBy] = useState<SortKey>("modifications");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fileEntities = useMemo(() => {
    if (!historyData || !currentFile) return [];
    return historyData.entities
      .filter(e => e.file === currentFile)
      .sort((a, b) => {
        switch (sortBy) {
          case "age": return b.age_days - a.age_days;
          case "modifications": return b.modification_count - a.modification_count;
          case "authors": return b.authors.length - a.authors.length;
          default: return a.name.localeCompare(b.name);
        }
      });
  }, [historyData, currentFile, sortBy]);

  const fileStat = currentFile ? historyData?.file_stats[currentFile] : null;

  if (!historyData || fileEntities.length === 0) {
    return (
      <div className="vr-no-cards">
        <p>No history data available.</p>
        <p style={{ fontSize: "11px", opacity: 0.6 }}>
          Run: <code>npx tsx extract-history.ts &lt;project&gt;</code>
        </p>
      </div>
    );
  }

  return (
    <div className="vr-history-panel">
      <style>{historyStyles}</style>

      {/* File summary */}
      {fileStat && (
        <div className="vr-history-file-summary">
          <span className="vr-history-stat">
            <strong>{fileStat.commits}</strong> commits
          </span>
          <span className="vr-history-stat">
            <strong>{fileStat.authors.length}</strong> author{fileStat.authors.length !== 1 ? "s" : ""}
          </span>
          <span className="vr-history-stat">
            {fileStat.first_commit} → {fileStat.last_commit}
          </span>
        </div>
      )}

      {/* Sort controls */}
      <div className="vr-history-sort">
        {(["modifications", "age", "authors", "name"] as SortKey[]).map(key => (
          <button
            key={key}
            className={`vr-history-sort-btn ${sortBy === key ? "vr-history-sort-btn--active" : ""}`}
            onClick={() => setSortBy(key)}
          >
            {key === "modifications" ? "Changes" : key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      {/* Entity list */}
      <div className="vr-history-list">
        {fileEntities.map(ent => {
          const isExpanded = expandedId === ent.id;
          const matchingEntity = entities.find(e =>
            e.anchor.start_line === ent.line_range[0] && (e.detail?.name as string) === ent.name
          );

          return (
            <div
              key={ent.id}
              className={`vr-history-item ${isExpanded ? "vr-history-item--expanded" : ""}`}
            >
              <div
                className="vr-history-item-header"
                onClick={() => {
                  setExpandedId(isExpanded ? null : ent.id);
                  if (matchingEntity) onCardClick(matchingEntity);
                }}
              >
                <div className="vr-history-item-left">
                  <span className="vr-history-item-name">{ent.name}</span>
                  <span className="vr-history-item-line">L{ent.line_range[0]}</span>
                </div>
                <div className="vr-history-item-right">
                  <span className="vr-history-item-changes" title="Modification count">
                    {ent.modification_count}×
                  </span>
                  {ent.authors.length > 1 && (
                    <span className="vr-history-item-authors" title={ent.authors.join(", ")}>
                      👥{ent.authors.length}
                    </span>
                  )}
                  {ent.age_days > 0 && (
                    <span className="vr-history-item-age" title="Days since creation">
                      {ent.age_days}d
                    </span>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="vr-history-item-detail">
                  {ent.created && (
                    <div className="vr-history-meta-row">
                      <span className="vr-history-meta-label">Created</span>
                      <span className="vr-history-meta-value">
                        {ent.created.date} by <strong>{ent.created.author}</strong>
                      </span>
                    </div>
                  )}
                  {ent.last_modified && ent.last_modified.commit !== ent.created?.commit && (
                    <div className="vr-history-meta-row">
                      <span className="vr-history-meta-label">Modified</span>
                      <span className="vr-history-meta-value">
                        {ent.last_modified.date} by <strong>{ent.last_modified.author}</strong>
                      </span>
                    </div>
                  )}
                  {ent.primary_author && (
                    <div className="vr-history-meta-row">
                      <span className="vr-history-meta-label">Owner</span>
                      <span className="vr-history-meta-value">{ent.primary_author}</span>
                    </div>
                  )}

                  {/* Timeline */}
                  {ent.key_changes.length > 0 && (
                    <div className="vr-history-timeline">
                      {ent.key_changes.map((kc, i) => (
                        <div key={i} className="vr-history-timeline-item">
                          <span className="vr-history-tl-dot" />
                          <span className="vr-history-tl-date">{kc.date}</span>
                          <span className="vr-history-tl-commit">{kc.commit}</span>
                          <span className="vr-history-tl-msg">{kc.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const historyStyles = `
  .vr-history-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .vr-history-file-summary {
    display: flex;
    gap: 12px;
    padding: 8px 10px;
    border-bottom: 1px solid #333;
    flex-shrink: 0;
    font-size: 11px;
    color: #888;
  }

  .vr-history-stat strong {
    color: #ccc;
    margin-right: 3px;
  }

  .vr-history-sort {
    display: flex;
    gap: 4px;
    padding: 6px 8px;
    flex-shrink: 0;
  }

  .vr-history-sort-btn {
    padding: 2px 8px;
    background: none;
    border: 1px solid #3c3c3c;
    border-radius: 10px;
    color: #888;
    font-size: 10px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }

  .vr-history-sort-btn:hover { color: #ccc; border-color: #555; }

  .vr-history-sort-btn--active {
    color: #dcdcaa;
    border-color: #dcdcaa;
    background: rgba(220, 220, 170, 0.08);
  }

  .vr-history-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 8px;
  }

  .vr-history-item {
    border: 1px solid #333;
    border-radius: 6px;
    margin-bottom: 6px;
    overflow: hidden;
    transition: border-color 0.15s;
  }

  .vr-history-item:hover { border-color: #4a4a4a; }

  .vr-history-item--expanded {
    border-color: #dcdcaa55;
  }

  .vr-history-item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 10px;
    cursor: pointer;
    gap: 8px;
  }

  .vr-history-item-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .vr-history-item-name {
    font-family: 'Cascadia Code', Consolas, monospace;
    font-size: 12px;
    color: #ccc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .vr-history-item-line {
    font-size: 10px;
    color: #666;
    flex-shrink: 0;
  }

  .vr-history-item-right {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-shrink: 0;
  }

  .vr-history-item-changes {
    font-size: 10px;
    color: #dcdcaa;
    font-weight: 600;
  }

  .vr-history-item-authors {
    font-size: 10px;
    color: #9cdcfe;
  }

  .vr-history-item-age {
    font-size: 10px;
    color: #666;
  }

  .vr-history-item-detail {
    padding: 8px 10px;
    border-top: 1px solid #333;
    background: rgba(0, 0, 0, 0.1);
  }

  .vr-history-meta-row {
    display: flex;
    gap: 8px;
    align-items: baseline;
    font-size: 11px;
    margin-bottom: 4px;
  }

  .vr-history-meta-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: #666;
    min-width: 52px;
    flex-shrink: 0;
  }

  .vr-history-meta-value {
    color: #aaa;
  }

  .vr-history-meta-value strong {
    color: #ccc;
    font-weight: 600;
  }

  .vr-history-timeline {
    margin-top: 8px;
    padding-left: 8px;
    border-left: 2px solid #3c3c3c;
  }

  .vr-history-timeline-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 0;
    font-size: 10px;
    position: relative;
  }

  .vr-history-tl-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #dcdcaa;
    flex-shrink: 0;
    margin-left: -12px;
  }

  .vr-history-tl-date {
    color: #888;
    flex-shrink: 0;
    min-width: 70px;
  }

  .vr-history-tl-commit {
    font-family: monospace;
    color: #4ec9b066;
    flex-shrink: 0;
  }

  .vr-history-tl-msg {
    color: #aaa;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
