import { useState, useMemo } from "react";
import { AnimatePresence } from "motion/react";
import { Card } from "../components/Card";
import type { DataEntity } from "../shared-types";

interface CallGraphFile {
  file: string;
  imports: Array<{ source: string; names: string[] }>;
  exports: string[];
}

interface Props {
  entities: DataEntity[];
  onCardClick: (entity: DataEntity) => void;
  highlightEntity?: DataEntity | null;
  totalLines?: number;
  visibleRange?: { start: number; end: number } | null;
  callGraph?: { files: CallGraphFile[] } | null;
  currentFile?: string | null;
  onFileSelect?: (file: string) => void;
  bookmarks?: Set<string>;
  onBookmark?: (key: string) => void;
}

const KIND_ORDER = ["class", "function", "method", "variable", "type", "interface", "enum", "other"];

const KIND_COLORS: Record<string, string> = {
  function: "#4ec9b0",
  class: "#dcdcaa",
  method: "#4ec9b0",
  variable: "#ce9178",
  type: "#9cdcfe",
  interface: "#9cdcfe",
  enum: "#b5cea8",
};

function DensityBar({ entities, totalLines, onCardClick, visibleRange }: {
  entities: DataEntity[];
  totalLines: number;
  onCardClick: (e: DataEntity) => void;
  visibleRange?: { start: number; end: number } | null;
}) {
  if (totalLines <= 0) return null;
  const handleBarClick = (ev: React.MouseEvent<HTMLDivElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const pct = (ev.clientX - rect.left) / rect.width;
    const targetLine = Math.round(pct * totalLines);
    const nearest = entities.reduce((best, e) =>
      Math.abs(e.anchor.start_line - targetLine) < Math.abs(best.anchor.start_line - targetLine) ? e : best,
      entities[0]);
    if (nearest) onCardClick(nearest);
  };
  return (
    <div style={{ height: 18, background: "#181818", margin: "0 8px 6px", borderRadius: 3,
                  position: "relative", overflow: "hidden", cursor: "pointer" }}
         onClick={handleBarClick}
         title="Entity density — click to jump to nearest entity">
      {visibleRange && (
        <div style={{ position: "absolute", top: 0, bottom: 0,
                      left: `${(visibleRange.start / totalLines) * 100}%`,
                      width: `${((visibleRange.end - visibleRange.start) / totalLines) * 100}%`,
                      background: "rgba(255,255,255,0.06)", borderLeft: "1px solid #555", borderRight: "1px solid #555",
                      pointerEvents: "none" }} />
      )}
      {entities.map((e, i) => {
        const left = (e.anchor.start_line / totalLines) * 100;
        const width = Math.max(((e.anchor.end_line - e.anchor.start_line + 1) / totalLines) * 100, 0.5);
        const kind = (e.detail.node_type as string || "other").toLowerCase();
        const color = KIND_COLORS[kind] || "#b5cea8";
        return (
          <div key={i} onClick={() => onCardClick(e)}
               style={{ position: "absolute", left: `${left}%`, width: `${width}%`, top: 0, bottom: 0,
                        background: color, opacity: 0.5, borderRight: "1px solid #252525" }} />
        );
      })}
    </div>
  );
}

export function ConceptTab({ entities, onCardClick, highlightEntity, totalLines, visibleRange, callGraph, currentFile, onFileSelect, bookmarks, onBookmark }: Props) {
  if (entities.length === 0) {
    return <div className="vr-no-cards">No concept cards for this file.</div>;
  }

  const usagesMap = useMemo(() => {
    const m = new Map<string, Array<{ file: string; names: string[] }>>();
    if (!callGraph?.files || !currentFile) return m;
    const curEntry = callGraph.files.find(f => currentFile.includes(f.file));
    if (!curEntry) return m;
    const exported = new Set(curEntry.exports);
    for (const f of callGraph.files) {
      if (f.file === curEntry.file) continue;
      for (const imp of f.imports) {
        for (const name of imp.names) {
          if (exported.has(name)) {
            if (!m.has(name)) m.set(name, []);
            m.get(name)!.push({ file: f.file, names: imp.names });
          }
        }
      }
    }
    return m;
  }, [callGraph, currentFile]);

  const [kindFilter, setKindFilter] = useState<string | null>(null);

  const allGroups = useMemo(() => {
    const m = new Map<string, DataEntity[]>();
    for (const e of entities) {
      const kind = (e.detail.node_type as string || "other").toLowerCase();
      if (!m.has(kind)) m.set(kind, []);
      m.get(kind)!.push(e);
    }
    return [...m.entries()].sort((a, b) => {
      const ai = KIND_ORDER.indexOf(a[0]), bi = KIND_ORDER.indexOf(b[0]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [entities]);

  const groups = kindFilter
    ? allGroups.filter(([kind]) => kind === kindFilter)
    : allGroups;

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (kind: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(kind) ? next.delete(kind) : next.add(kind);
      return next;
    });
  };

  const densityBar = totalLines && totalLines > 0
    ? <DensityBar entities={entities} totalLines={totalLines} onCardClick={onCardClick} visibleRange={visibleRange} />
    : null;

  const fileSummary = useMemo(() => {
    const concepts = entities.filter(e => e.type === "concept");
    const enriched = concepts.filter(e => {
      const d = e.detail.description as string | undefined;
      return d && !/^(function|class|interface|type|enum|method|struct|impl|trait|module|decorated) ".+" spanning \d+ lines\.$/.test(d);
    });
    return { total: concepts.length, enriched: enriched.length, kinds: allGroups.length };
  }, [entities, allGroups]);

  const summaryLine = (
    <div style={{ fontSize: 10, color: "#666", padding: "4px 8px 2px" }}>
      <div style={{ textAlign: "center" }}>
        {fileSummary.total} concept{fileSummary.total !== 1 ? "s" : ""}
        {fileSummary.enriched > 0 && fileSummary.enriched < fileSummary.total && ` · ${fileSummary.enriched} enriched`}
        {fileSummary.enriched === fileSummary.total && fileSummary.total > 0 && " · all enriched"}
        {totalLines ? ` · ${totalLines} lines` : ""}
      </div>
      {allGroups.length > 1 && (
        <div style={{ display: "flex", gap: 3, justifyContent: "center", marginTop: 3, flexWrap: "wrap" }}>
          <span
            style={{ cursor: "pointer", padding: "0 4px", borderRadius: 2,
                     background: !kindFilter ? "#333" : "transparent", color: !kindFilter ? "#fff" : "#888" }}
            onClick={() => setKindFilter(null)}
          >all</span>
          {allGroups.map(([kind, items]) => (
            <span key={kind}
              style={{ cursor: "pointer", padding: "0 4px", borderRadius: 2,
                       background: kindFilter === kind ? "#333" : "transparent",
                       color: KIND_COLORS[kind] || "#b5cea8" }}
              onClick={() => setKindFilter(kindFilter === kind ? null : kind)}
            >{kind}({items.length})</span>
          ))}
        </div>
      )}
    </div>
  );

  if (groups.length <= 1) {
    return (
      <div>
        {summaryLine}
        {densityBar}
        <AnimatePresence mode="popLayout">
          {entities.map((e, i) => (
            <Card key={`${e.anchor.start_line}-${i}`} entity={e} onClick={onCardClick}
                  highlight={highlightEntity === e}
                  usages={usagesMap.get(e.detail.name as string)}
                  onFileSelect={onFileSelect}
                  bookmarked={bookmarks?.has(`${currentFile}:${e.detail.name}`)}
                  onBookmark={onBookmark ? () => onBookmark(`${currentFile}:${e.detail.name}`) : undefined} />
          ))}
        </AnimatePresence>
      </div>
    );
  }

  const allCollapsed = collapsed.size === groups.length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 8px" }}>
        {summaryLine}
        <button
          style={{ fontSize: 9, color: "#888", background: "none", border: "1px solid #444", borderRadius: 3,
                   cursor: "pointer", padding: "1px 4px" }}
          onClick={() => {
            if (allCollapsed) {
              setCollapsed(new Set());
            } else {
              setCollapsed(new Set(groups.map(([k]) => k)));
            }
          }}
          title={allCollapsed ? "Expand all" : "Collapse all"}
        >
          {allCollapsed ? "▼" : "▲"}
        </button>
      </div>
      {densityBar}
      {groups.map(([kind, items]) => (
        <div key={kind}>
          <div className="vr-concept-group-header" onClick={() => toggle(kind)}
               style={{ fontSize: 11, fontWeight: 600, padding: "6px 8px 2px", cursor: "pointer",
                        color: "#888", userSelect: "none", display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 9 }}>{collapsed.has(kind) ? "▶" : "▼"}</span>
            {kind} ({items.length})
          </div>
          {!collapsed.has(kind) && (
            <AnimatePresence mode="popLayout">
              {items.map((e, i) => (
                <Card key={`${e.anchor.start_line}-${i}`} entity={e} onClick={onCardClick}
                      highlight={highlightEntity === e}
                      usages={usagesMap.get(e.detail.name as string)}
                      onFileSelect={onFileSelect}
                      bookmarked={bookmarks?.has(`${currentFile}:${e.detail.name}`)}
                      onBookmark={onBookmark ? () => onBookmark(`${currentFile}:${e.detail.name}`) : undefined} />
              ))}
            </AnimatePresence>
          )}
        </div>
      ))}
    </div>
  );
}
