import { useState, useMemo } from "react";
import type { DataEntity, FlowDataType, FlowNode } from "../shared-types";

interface Props {
  entities: DataEntity[];
  onCardClick: (entity: DataEntity) => void;
  hoveredEntity?: DataEntity | null;
  onCardHover?: (entity: DataEntity | null) => void;
  sourceLines?: string[];
  flowData?: FlowDataType;
  currentFile?: string | null;
  onJumpToFile?: (file: string, line?: number) => void;
}

interface DepInfo {
  file: string;
  name: string;
  kind: string;
  line: number;
  direction: "imports" | "imported_by";
}

export function JumpTab({ entities, flowData, currentFile, onJumpToFile, onCardClick }: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>("imports");

  const { imports, importedBy, entityDeps } = useMemo(() => {
    if (!flowData || !currentFile) return { imports: [], importedBy: [], entityDeps: new Map() };

    const currentNodes = new Set(flowData.nodes.filter(n => n.file === currentFile).map(n => n.id));

    const importsSet = new Map<string, DepInfo>();
    const importedBySet = new Map<string, DepInfo>();
    const entityDepsMap = new Map<string, { uses: FlowNode[]; usedBy: FlowNode[] }>();

    for (const edge of flowData.edges) {
      const fromNode = flowData.nodes.find(n => n.id === edge.from);
      const toNode = flowData.nodes.find(n => n.id === edge.to);
      if (!fromNode || !toNode) continue;

      if (currentNodes.has(edge.from) && !currentNodes.has(edge.to)) {
        const key = toNode.file;
        if (!importsSet.has(key)) {
          importsSet.set(key, { file: toNode.file, name: toNode.name, kind: toNode.kind, line: toNode.line, direction: "imports" });
        }

        if (!entityDepsMap.has(fromNode.id)) entityDepsMap.set(fromNode.id, { uses: [], usedBy: [] });
        entityDepsMap.get(fromNode.id)!.uses.push(toNode);
      }

      if (currentNodes.has(edge.to) && !currentNodes.has(edge.from)) {
        const key = fromNode.file;
        if (!importedBySet.has(key)) {
          importedBySet.set(key, { file: fromNode.file, name: fromNode.name, kind: fromNode.kind, line: fromNode.line, direction: "imported_by" });
        }

        if (!entityDepsMap.has(toNode.id)) entityDepsMap.set(toNode.id, { uses: [], usedBy: [] });
        entityDepsMap.get(toNode.id)!.usedBy.push(fromNode);
      }
    }

    return {
      imports: Array.from(importsSet.values()),
      importedBy: Array.from(importedBySet.values()),
      entityDeps: entityDepsMap,
    };
  }, [flowData, currentFile]);

  const currentEntities = useMemo(() => {
    if (!flowData || !currentFile) return [];
    return flowData.nodes.filter(n => n.file === currentFile);
  }, [flowData, currentFile]);

  if (!flowData || !currentFile) {
    return (
      <div className="vr-no-cards">
        <p>No dependency data available.</p>
        <p style={{ fontSize: "11px", opacity: 0.6 }}>
          Requires flow data. Run: <code>npx tsx extract-flow.ts &lt;project&gt;</code>
        </p>
      </div>
    );
  }

  if (imports.length === 0 && importedBy.length === 0) {
    return (
      <div className="vr-no-cards">
        <p>No cross-file dependencies for this file.</p>
      </div>
    );
  }

  return (
    <div className="vr-jump-panel">
      <style>{jumpStyles}</style>

      {/* File Dependencies section */}
      <div className="vr-jump-section">
        <div
          className={`vr-jump-section-header ${expandedSection === "imports" ? "vr-jump-section-header--active" : ""}`}
          onClick={() => setExpandedSection(expandedSection === "imports" ? null : "imports")}
        >
          <span className="vr-jump-section-icon">→</span>
          <span className="vr-jump-section-title">This file uses</span>
          <span className="vr-jump-section-count">{imports.length}</span>
        </div>
        {expandedSection === "imports" && (
          <div className="vr-jump-section-body">
            {imports.map((dep, i) => (
              <div
                key={i}
                className="vr-jump-dep-item"
                onClick={() => onJumpToFile?.(dep.file, dep.line)}
              >
                <span className="vr-jump-dep-icon">📄</span>
                <span className="vr-jump-dep-file">{dep.file.split("/").pop()}</span>
                <span className="vr-jump-dep-name">{dep.name}</span>
                <span className="vr-jump-dep-arrow">→</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Imported By section */}
      <div className="vr-jump-section">
        <div
          className={`vr-jump-section-header ${expandedSection === "imported_by" ? "vr-jump-section-header--active" : ""}`}
          onClick={() => setExpandedSection(expandedSection === "imported_by" ? null : "imported_by")}
        >
          <span className="vr-jump-section-icon">←</span>
          <span className="vr-jump-section-title">Used by</span>
          <span className="vr-jump-section-count">{importedBy.length}</span>
        </div>
        {expandedSection === "imported_by" && (
          <div className="vr-jump-section-body">
            {importedBy.map((dep, i) => (
              <div
                key={i}
                className="vr-jump-dep-item"
                onClick={() => onJumpToFile?.(dep.file, dep.line)}
              >
                <span className="vr-jump-dep-icon">📄</span>
                <span className="vr-jump-dep-file">{dep.file.split("/").pop()}</span>
                <span className="vr-jump-dep-name">{dep.name}</span>
                <span className="vr-jump-dep-arrow">→</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-entity deps */}
      <div className="vr-jump-section">
        <div
          className={`vr-jump-section-header ${expandedSection === "entities" ? "vr-jump-section-header--active" : ""}`}
          onClick={() => setExpandedSection(expandedSection === "entities" ? null : "entities")}
        >
          <span className="vr-jump-section-icon">⊙</span>
          <span className="vr-jump-section-title">Entity connections</span>
          <span className="vr-jump-section-count">{currentEntities.length}</span>
        </div>
        {expandedSection === "entities" && (
          <div className="vr-jump-section-body">
            {currentEntities.map(node => {
              const deps = entityDeps.get(node.id);
              if (!deps || (deps.uses.length === 0 && deps.usedBy.length === 0)) return null;
              return (
                <div key={node.id} className="vr-jump-entity-group">
                  <div className="vr-jump-entity-name">
                    {node.class ? `${node.class}.${node.name}` : node.name}
                  </div>
                  {deps.uses.length > 0 && (
                    <div className="vr-jump-entity-deps">
                      <span className="vr-jump-entity-label">calls →</span>
                      {deps.uses.map((u: FlowNode, i: number) => (
                        <span
                          key={i}
                          className="vr-jump-chip"
                          onClick={() => onJumpToFile?.(u.file, u.line)}
                        >
                          {u.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {deps.usedBy.length > 0 && (
                    <div className="vr-jump-entity-deps">
                      <span className="vr-jump-entity-label">← called by</span>
                      {deps.usedBy.map((u: FlowNode, i: number) => (
                        <span
                          key={i}
                          className="vr-jump-chip"
                          onClick={() => onJumpToFile?.(u.file, u.line)}
                        >
                          {u.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Jump card entities (if any) */}
      {entities.length > 0 && (
        <div className="vr-jump-section">
          <div
            className={`vr-jump-section-header ${expandedSection === "suggestions" ? "vr-jump-section-header--active" : ""}`}
            onClick={() => setExpandedSection(expandedSection === "suggestions" ? null : "suggestions")}
          >
            <span className="vr-jump-section-icon">💡</span>
            <span className="vr-jump-section-title">Reading suggestions</span>
            <span className="vr-jump-section-count">{entities.length}</span>
          </div>
          {expandedSection === "suggestions" && (
            <div className="vr-jump-section-body">
              {entities.map((e, i) => (
                <div
                  key={i}
                  className="vr-jump-suggestion"
                  onClick={() => onCardClick(e)}
                >
                  <span className="vr-jump-suggestion-name">{(e.detail?.name as string) || e.summary}</span>
                  <span className="vr-jump-suggestion-summary">{e.summary}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const jumpStyles = `
  .vr-jump-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    padding: 4px 0;
  }

  .vr-jump-section {
    margin-bottom: 2px;
  }

  .vr-jump-section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    cursor: pointer;
    transition: background 0.15s;
    border-bottom: 1px solid transparent;
  }

  .vr-jump-section-header:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .vr-jump-section-header--active {
    background: rgba(0, 122, 204, 0.06);
    border-bottom-color: #333;
  }

  .vr-jump-section-icon {
    font-size: 12px;
    width: 18px;
    text-align: center;
    flex-shrink: 0;
  }

  .vr-jump-section-title {
    font-size: 11px;
    font-weight: 600;
    color: #bbb;
    flex: 1;
  }

  .vr-jump-section-count {
    font-size: 10px;
    background: #4d4d4d;
    color: #ccc;
    padding: 0 5px;
    border-radius: 8px;
    line-height: 16px;
  }

  .vr-jump-section-body {
    padding: 4px 8px;
  }

  .vr-jump-dep-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    transition: background 0.15s;
  }

  .vr-jump-dep-item:hover {
    background: rgba(0, 122, 204, 0.1);
  }

  .vr-jump-dep-icon {
    font-size: 10px;
    flex-shrink: 0;
  }

  .vr-jump-dep-file {
    color: #ccc;
    font-family: 'Cascadia Code', Consolas, monospace;
    font-size: 11px;
  }

  .vr-jump-dep-name {
    color: #888;
    font-size: 10px;
    margin-left: auto;
  }

  .vr-jump-dep-arrow {
    color: #007acc;
    font-size: 12px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .vr-jump-dep-item:hover .vr-jump-dep-arrow {
    opacity: 1;
  }

  .vr-jump-entity-group {
    padding: 6px 8px;
    border-bottom: 1px solid #333;
  }

  .vr-jump-entity-group:last-child {
    border-bottom: none;
  }

  .vr-jump-entity-name {
    font-family: 'Cascadia Code', Consolas, monospace;
    font-size: 11px;
    color: #ccc;
    margin-bottom: 4px;
  }

  .vr-jump-entity-deps {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    margin-top: 3px;
  }

  .vr-jump-entity-label {
    font-size: 9px;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-right: 4px;
  }

  .vr-jump-chip {
    font-size: 10px;
    padding: 1px 7px;
    border-radius: 10px;
    background: rgba(0, 122, 204, 0.08);
    border: 1px solid rgba(0, 122, 204, 0.2);
    color: #9cdcfe;
    cursor: pointer;
    font-family: 'Cascadia Code', Consolas, monospace;
    transition: all 0.15s;
  }

  .vr-jump-chip:hover {
    background: rgba(0, 122, 204, 0.2);
    border-color: #007acc;
    color: #fff;
  }

  .vr-jump-suggestion {
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s;
    margin-bottom: 2px;
  }

  .vr-jump-suggestion:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .vr-jump-suggestion-name {
    font-family: 'Cascadia Code', Consolas, monospace;
    font-size: 11px;
    color: #ccc;
    display: block;
  }

  .vr-jump-suggestion-summary {
    font-size: 10px;
    color: #888;
    display: block;
    margin-top: 2px;
  }
`;
