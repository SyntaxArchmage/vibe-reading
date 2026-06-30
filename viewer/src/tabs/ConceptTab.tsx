import { useState, useMemo } from "react";
import { AnimatePresence } from "motion/react";
import { Card } from "../components/Card";
import { EntityMiniGraph } from "../components/EntityMiniGraph";
import type { DataEntity, CallGraph } from "../shared-types";
import { KIND_COLORS } from "../utils/kind-colors";

interface Props {
  entities: DataEntity[];
  onCardClick: (entity: DataEntity) => void;
  highlightEntity?: DataEntity | null;
  totalLines?: number;
  visibleRange?: { start: number; end: number } | null;
  callGraph?: CallGraph | null;
  currentFile?: string | null;
  onFileSelect?: (file: string) => void;
  bookmarks?: Set<string>;
  onBookmark?: (key: string) => void;
  showGraph?: boolean;
  sourceLines?: string[];
}

const KIND_ORDER = ["class", "function", "method", "variable", "type", "interface", "enum", "other"];

function DensityBar({ entities, totalLines, onCardClick, visibleRange, highlightEntity }: {
  entities: DataEntity[];
  totalLines: number;
  onCardClick: (e: DataEntity) => void;
  visibleRange?: { start: number; end: number } | null;
  highlightEntity?: DataEntity | null;
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
    <div className="vr-density-bar" onClick={handleBarClick}
         title="Entity density — click to jump to nearest entity">
      {visibleRange && (
        <div className="vr-density-viewport" style={{
          left: `${(visibleRange.start / totalLines) * 100}%`,
          width: `${((visibleRange.end - visibleRange.start) / totalLines) * 100}%`,
        }} />
      )}
      {entities.map((e, i) => {
        const left = (e.anchor.start_line / totalLines) * 100;
        const width = Math.max(((e.anchor.end_line - e.anchor.start_line + 1) / totalLines) * 100, 0.5);
        const kind = (e.detail.node_type as string || "other").toLowerCase();
        const color = KIND_COLORS[kind] || "#b5cea8";
        const isHighlight = highlightEntity === e;
        return (
          <div key={i} className={`vr-density-entity ${isHighlight ? "vr-density-entity--active" : ""}`}
               onClick={(ev) => { ev.stopPropagation(); onCardClick(e); }}
               title={`${(e.detail.name as string) || e.summary} (L${e.anchor.start_line})`}
               style={{ left: `${left}%`, width: `${width}%`, background: color }} />
        );
      })}
    </div>
  );
}

export function ConceptTab({ entities, onCardClick, highlightEntity, totalLines, visibleRange, callGraph, currentFile, onFileSelect, bookmarks, onBookmark, showGraph, sourceLines }: Props) {
  if (entities.length === 0) {
    return <div className="vr-no-cards">No concept cards for this file.</div>;
  }

  const usagesMap = useMemo(() => {
    const m = new Map<string, Array<{ file: string; names: string[] }>>();
    if (!callGraph?.files || !currentFile) return m;
    const curEntry = callGraph.files.find(f => f.file === currentFile);
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
  const [cardSearch, setCardSearch] = useState("");

  const filteredEntities = useMemo(() => {
    if (!cardSearch.trim()) return entities;
    const q = cardSearch.toLowerCase();
    return entities.filter(e => {
      const name = ((e.detail.name as string) || "").toLowerCase();
      const summary = (e.summary || "").toLowerCase();
      return name.includes(q) || summary.includes(q);
    });
  }, [entities, cardSearch]);

  const allGroups = useMemo(() => {
    const m = new Map<string, DataEntity[]>();
    for (const e of filteredEntities) {
      const kind = (e.detail.node_type as string || "other").toLowerCase();
      if (!m.has(kind)) m.set(kind, []);
      m.get(kind)!.push(e);
    }
    return [...m.entries()].sort((a, b) => {
      const ai = KIND_ORDER.indexOf(a[0]), bi = KIND_ORDER.indexOf(b[0]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [filteredEntities]);

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

  const searchBox = entities.length > 3 ? (
    <div style={{ padding: "2px 8px" }}>
      <input
        type="text" value={cardSearch} onChange={e => setCardSearch(e.target.value)}
        placeholder={`Filter ${entities.length} entities...`}
        className="vr-outline-filter"
      />
    </div>
  ) : null;

  const densityBar = totalLines && totalLines > 0
    ? <DensityBar entities={filteredEntities} totalLines={totalLines} onCardClick={onCardClick} visibleRange={visibleRange} highlightEntity={highlightEntity} />
    : null;

  const miniGraph = showGraph ? (
    <EntityMiniGraph entities={entities} onCardClick={onCardClick}
                     highlightEntity={highlightEntity} currentFile={currentFile} />
  ) : null;

  const fileSummary = useMemo(() => {
    const concepts = entities.filter(e => e.type === "concept");
    const enriched = concepts.filter(e => {
      const d = e.detail.description as string | undefined;
      return d && !/^(function|class|interface|type|enum|method|struct|impl|trait|module|decorated) ".+" spanning \d+ lines\.$/.test(d);
    });
    return { total: concepts.length, enriched: enriched.length, kinds: allGroups.length };
  }, [entities, allGroups]);

  const summaryLine = (
    <div className="vr-concept-summary">
      <div style={{ textAlign: "center" }}>
        {fileSummary.total} concept{fileSummary.total !== 1 ? "s" : ""}
        {fileSummary.enriched > 0 && fileSummary.enriched < fileSummary.total && ` · ${fileSummary.enriched} enriched`}
        {fileSummary.enriched === fileSummary.total && fileSummary.total > 0 && " · all enriched"}
        {totalLines ? ` · ${totalLines} lines` : ""}
      </div>
      {allGroups.length > 1 && (
        <div className="vr-concept-kind-filters">
          <span
            className={`vr-concept-kind-chip ${!kindFilter ? "vr-concept-kind-chip--active" : ""}`}
            onClick={() => setKindFilter(null)}
          >all</span>
          {allGroups.map(([kind, items]) => (
            <span key={kind}
              className={`vr-concept-kind-chip ${kindFilter === kind ? "vr-concept-kind-chip--active" : ""}`}
              style={{ color: KIND_COLORS[kind] || "#b5cea8" }}
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
        {searchBox}
        {densityBar}
        {miniGraph}
        <AnimatePresence mode="popLayout">
          {filteredEntities.map((e, i) => (
            <Card key={`${e.anchor.start_line}-${i}`} entity={e} onClick={onCardClick}
                  highlight={highlightEntity === e}
                  usages={usagesMap.get(e.detail.name as string)}
                  onFileSelect={onFileSelect}
                  bookmarked={bookmarks?.has(`${currentFile}:${e.detail.name}`)}
                  onBookmark={onBookmark ? () => onBookmark(`${currentFile}:${e.detail.name}`) : undefined}
                  sourceLines={sourceLines?.slice(e.anchor.start_line - 1, e.anchor.end_line)} />
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
          className="vr-concept-collapse-btn"
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
      {searchBox}
      {densityBar}
      {miniGraph}
      {groups.map(([kind, items]) => (
        <div key={kind}>
          <div className="vr-concept-group-header" onClick={() => toggle(kind)}>
            <span className="vr-concept-group-arrow">{collapsed.has(kind) ? "▶" : "▼"}</span>
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
                      onBookmark={onBookmark ? () => onBookmark(`${currentFile}:${e.detail.name}`) : undefined}
                      sourceLines={sourceLines?.slice(e.anchor.start_line - 1, e.anchor.end_line)} />
              ))}
            </AnimatePresence>
          )}
        </div>
      ))}
    </div>
  );
}
