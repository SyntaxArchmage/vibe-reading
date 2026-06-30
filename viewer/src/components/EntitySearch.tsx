import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { DataEntity, TabId } from "../shared-types";
import { highlightMatch } from "../utils/app-helpers";

export type SearchableEntity = DataEntity & { _file: string; _key: string };

interface EntitySearchProps {
  allEntities: SearchableEntity[];
  currentFile: string | null;
  onSelect: (fileKey: string, tab: TabId, anchor: { start: number; end: number }) => void;
  onClose: () => void;
}

export function EntitySearch({ allEntities, currentFile, onSelect, onClose }: EntitySearchProps) {
  const [query, setQuery] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const [history, setHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("vr-search-history");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const addHistory = useCallback((q: string) => {
    if (!q.trim()) return;
    setHistory(prev => {
      const next = [q, ...prev.filter(h => h !== q)].slice(0, 8);
      try { localStorage.setItem("vr-search-history", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    let q = query.toLowerCase().trim();
    let typeFilter: string | null = null;
    let fileFilter: string | null = null;
    const typeMatch = q.match(/^(?:type:|t:)(\w+)\s*/);
    if (typeMatch) { typeFilter = typeMatch[1]; q = q.slice(typeMatch[0].length); }
    const fileMatch = q.match(/^(?:file:|f:)(\S+)\s*/);
    if (fileMatch) { fileFilter = fileMatch[1]; q = q.slice(fileMatch[0].length); }
    if (!q && !typeFilter && !fileFilter) return [];

    const scored = allEntities
      .map(e => {
        if (typeFilter && !e.type.startsWith(typeFilter)) return null;
        if (fileFilter && !e.anchor.file.toLowerCase().includes(fileFilter)) return null;
        if (!q) return { e, score: 1 };

        const name = ((e.detail.name as string) || "").toLowerCase();
        const summary = e.summary.toLowerCase();
        const file = e.anchor.file.toLowerCase();

        if (name === q) return { e, score: 100 };
        if (name.startsWith(q)) return { e, score: 80 };
        if (name.includes(q)) return { e, score: 60 };
        if (summary.includes(q)) return { e, score: 40 };
        if (file.includes(q)) return { e, score: 20 };

        let qi = 0, consecutive = 0, maxConsec = 0;
        for (let ni = 0; ni < name.length && qi < q.length; ni++) {
          if (name[ni] === q[qi]) { qi++; consecutive++; maxConsec = Math.max(maxConsec, consecutive); }
          else { consecutive = 0; }
        }
        if (qi === q.length) return { e, score: 5 + maxConsec * 2 };
        return null;
      })
      .filter((x): x is { e: SearchableEntity; score: number } => x !== null)
      .sort((a, b) => b.score - a.score);

    return scored.map(s => s.e).slice(0, 50);
  }, [query, allEntities]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const selectResult = useCallback((e: SearchableEntity) => {
    addHistory(query.trim());
    onSelect(e._key, e.type as TabId, { start: e.anchor.start_line, end: e.anchor.end_line || e.anchor.start_line });
    onClose();
  }, [query, addHistory, onSelect, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx(i => {
        const next = Math.min(i + 1, results.length - 1);
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[idx]) {
      selectResult(results[idx]);
    }
  }, [results, idx, selectResult]);

  const displayQuery = query.toLowerCase().trim()
    .replace(/^(?:type:|t:)\w+\s*/, "")
    .replace(/^(?:file:|f:)\S+\s*/, "");

  return (
    <div className="vr-entity-search-panel">
      <div className="vr-entity-search-header">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search... (t:concept, f:filename, Esc to close)"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIdx(0); }}
          onKeyDown={handleKeyDown}
          className="vr-entity-search-input"
        />
        {query.trim() && (
          <div className="vr-entity-search-count">
            {results.length} result{results.length !== 1 ? "s" : ""}
            {results.length >= 50 && " (limit)"}
          </div>
        )}
      </div>
      <div className="vr-entity-search-results">
        {!query.trim() && history.length > 0 && (
          <div style={{ padding: "6px 8px" }}>
            <div className="vr-entity-search-recent-label">Recent</div>
            {history.map((h, i) => (
              <div
                key={`hist-${i}`}
                className="vr-entity-search-item"
                onClick={() => { setQuery(h); setIdx(0); }}
                style={{ cursor: "pointer" }}
              >
                <span className="vr-entity-search-history-item">&#x1F50D; {h}</span>
              </div>
            ))}
          </div>
        )}
        {query.trim() && results.length === 0 && (
          <div className="vr-entity-search-empty">No matches</div>
        )}
        {results.map((e, i) => {
          const nameStr = (e.detail.name as string) || e.summary;
          return (
            <div
              key={`es-${i}`}
              ref={i === idx ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
              className={`vr-entity-search-item ${i === idx ? "vr-entity-search-item--active" : ""}`}
              onClick={() => selectResult(e)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="vr-entity-search-type">{e.type}</span>
                {e.detail.kind ? <span className="vr-entity-search-kind">({String(e.detail.kind)})</span> : null}
                <span className="vr-entity-search-name">
                  {displayQuery ? highlightMatch(nameStr, displayQuery) : nameStr}
                </span>
              </div>
              <span className="vr-entity-search-file">{e._file}:{e.anchor.start_line}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
