import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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

declare const CALL_GRAPH: {
  files: Array<{
    file: string;
    imports: Array<{ source: string; names: string[] }>;
    exports: string[];
    calls: Array<{ callee: string; inFunction: string | null }>;
  }>;
} | null;

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
  commits: number;
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    try { const t = localStorage.getItem("vr-active-tab"); if (t && TABS.some(tab => tab.id === t)) return t as TabId; } catch {}
    return "concept";
  });
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
  const [navHistory, setNavHistory] = useState<string[]>([]);
  const [navIndex, setNavIndex] = useState(-1);
  const [cardFilter, setCardFilter] = useState("");
  const [cardSort, setCardSort] = useState<"line" | "name" | "kind">("line");
  const [entitySearch, setEntitySearch] = useState("");
  const [entitySearchOpen, setEntitySearchOpen] = useState(false);
  const [entitySearchIdx, setEntitySearchIdx] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [cursorLine, setCursorLine] = useState(0);
  const [visibleRange, setVisibleRange] = useState<{ start: number; end: number } | null>(null);
  const [gotoLineOpen, setGotoLineOpen] = useState(false);
  const [gotoLineValue, setGotoLineValue] = useState("");
  const gotoLineRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const entitySearchRef = useRef<HTMLInputElement>(null);

  const allEntities = useMemo(() =>
    Object.entries(PREVIEW_DATA).flatMap(([key, data]) =>
      (data.entities as DataEntity[]).map(e => ({ ...e, _file: data.file as string, _key: key }))
    ), []);

  const entitySearchResults = entitySearch.trim()
    ? (() => {
        let q = entitySearch.toLowerCase().trim();
        let typeFilter: string | null = null;
        let fileFilter: string | null = null;
        const typeMatch = q.match(/^(?:type:|t:)(\w+)\s*/);
        if (typeMatch) {
          typeFilter = typeMatch[1];
          q = q.slice(typeMatch[0].length);
        }
        const fileMatch = q.match(/^(?:file:|f:)(\S+)\s*/);
        if (fileMatch) {
          fileFilter = fileMatch[1];
          q = q.slice(fileMatch[0].length);
        }
        return allEntities.filter(e => {
          if (typeFilter && !e.type.startsWith(typeFilter)) return false;
          if (fileFilter && !e.anchor.file.toLowerCase().includes(fileFilter)) return false;
          if (!q) return true;
          const name = ((e.detail.name as string) || "").toLowerCase();
          const summary = e.summary.toLowerCase();
          const file = e.anchor.file.toLowerCase();
          return name.includes(q) || summary.includes(q) || file.includes(q);
        }).slice(0, 50);
      })()
    : [];

  const breadcrumbEntity = useMemo(() => {
    if (!cursorLine) return null;
    const concepts = entities.filter(e => e.type === "concept");
    let best: DataEntity | null = null;
    let bestSize = Infinity;
    for (const e of concepts) {
      if (cursorLine >= e.anchor.start_line && cursorLine <= e.anchor.end_line) {
        const size = e.anchor.end_line - e.anchor.start_line;
        if (size < bestSize) { best = e; bestSize = size; }
      }
    }
    return best;
  }, [cursorLine, entities]);

  const allFiles: FileInfo[] = useMemo(() =>
    Object.entries(PREVIEW_DATA)
      .map(([key, data]) => {
        const hist = (data.entities as DataEntity[]).find(
          e => e.type === "history" && (e.detail.kind === "file_history")
        );
        return {
          key,
          file: data.file,
          count: data.entities.length,
          commits: (hist?.detail.total_commits as number) || 0,
        };
      })
      .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file)),
  []);

  const filteredFiles = searchQuery.trim()
    ? (() => {
        const q = searchQuery.toLowerCase().trim();
        const scored = allFiles
          .map(f => {
            const file = f.file.toLowerCase();
            if (file.includes(q)) return { f, score: 2 };
            let qi = 0;
            for (let fi = 0; fi < file.length && qi < q.length; fi++) {
              if (file[fi] === q[qi]) qi++;
            }
            return qi === q.length ? { f, score: 1 } : null;
          })
          .filter(Boolean) as { f: typeof allFiles[0]; score: number }[];
        scored.sort((a, b) => b.score - a.score);
        return scored.map(s => s.f);
      })()
    : allFiles;

  const visibleFiles = filteredFiles.slice(0, 100);
  const remaining = filteredFiles.length - visibleFiles.length;

  const selectFile = useCallback(
    async (key: string, skipHistory = false) => {
      const data = PREVIEW_DATA[key];
      if (!data) return;

      if (!skipHistory) {
        setNavHistory((prev) => {
          const trimmed = prev.slice(0, navIndex + 1);
          return [...trimmed, data.file];
        });
        setNavIndex((prev) => prev + 1);
      }

      setCurrentFile(data.file);
      setEntities(data.entities);
      setHighlightRange(null);
      setCardFilter("");
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
    [navIndex]
  );

  const navigateBack = useCallback(() => {
    if (navIndex <= 0) return;
    const newIdx = navIndex - 1;
    const file = navHistory[newIdx];
    const fk = allFiles.find((f) => f.file === file)?.key;
    if (fk) {
      setNavIndex(newIdx);
      selectFile(fk, true);
    }
  }, [navIndex, navHistory, allFiles, selectFile]);

  useEffect(() => {
    if (currentFile) {
      try { localStorage.setItem("vr-last-file", currentFile); } catch {}
    }
  }, [currentFile]);

  useEffect(() => {
    try { localStorage.setItem("vr-active-tab", activeTab); } catch {}
  }, [activeTab]);

  useEffect(() => {
    try {
      const last = localStorage.getItem("vr-last-file");
      if (last) {
        const fk = allFiles.find(f => f.file === last)?.key;
        if (fk) selectFile(fk);
      }
    } catch {}
  }, []);

  const navigateForward = useCallback(() => {
    if (navIndex >= navHistory.length - 1) return;
    const newIdx = navIndex + 1;
    const file = navHistory[newIdx];
    const fk = allFiles.find((f) => f.file === file)?.key;
    if (fk) {
      setNavIndex(newIdx);
      selectFile(fk, true);
    }
  }, [navIndex, navHistory, allFiles, selectFile]);

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
        setEntitySearchOpen(false);
        setHelpOpen(false);
        setGotoLineOpen(false);
      }
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement)) {
        setHelpOpen(v => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setTreeOpen((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "g") {
        e.preventDefault();
        setGotoLineOpen(true);
        setGotoLineValue("");
        setTimeout(() => gotoLineRef.current?.focus(), 0);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setEntitySearchOpen((v) => {
          if (!v) setTimeout(() => entitySearchRef.current?.focus(), 0);
          return !v;
        });
      }
      if (e.altKey && e.key >= "1" && e.key <= "4") {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (TABS[idx]) setActiveTab(TABS[idx].id);
      }
      if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        navigateBack();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "w") {
        e.preventDefault();
        if (currentFile) closeTab(currentFile);
      }
      if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        navigateForward();
      }
      if ((e.key === "[" || e.key === "]") && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement)) {
        const idx = allFiles.findIndex(f => f.key === currentFile);
        if (idx >= 0) {
          const next = e.key === "]" ? idx + 1 : idx - 1;
          if (next >= 0 && next < allFiles.length) selectFile(allFiles[next].key);
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [navigateBack, navigateForward, allFiles, currentFile]);

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

  const filtered = entities
    .filter((e) => {
      if (e.type !== activeTab) return false;
      if (!cardFilter.trim()) return true;
      const q = cardFilter.toLowerCase();
      return e.summary.toLowerCase().includes(q) ||
        (e.detail?.name && String(e.detail.name).toLowerCase().includes(q)) ||
        (e.detail?.kind && String(e.detail.kind).toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (cardSort === "name") {
        const na = String(a.detail?.name || a.summary).toLowerCase();
        const nb = String(b.detail?.name || b.summary).toLowerCase();
        return na.localeCompare(nb);
      }
      if (cardSort === "kind") {
        const ka = String(a.detail?.kind || "").toLowerCase();
        const kb = String(b.detail?.kind || "").toLowerCase();
        return ka.localeCompare(kb) || a.anchor.start_line - b.anchor.start_line;
      }
      return a.anchor.start_line - b.anchor.start_line;
    });

  const tabContent = () => {
    switch (activeTab) {
      case "concept":
        return <ConceptTab entities={filtered} onCardClick={onCardClick} highlightEntity={breadcrumbEntity}
                           totalLines={sourceCode ? sourceCode.split("\n").length : 0}
                           visibleRange={visibleRange} />;
      case "flow":
        return <FlowTab entities={filtered} onCardClick={onCardClick} currentFile={currentFile} callGraph={CALL_GRAPH} onFileSelect={(file) => {
          const fk = allFiles.find(f => f.file === file)?.key;
          if (fk) selectFile(fk);
        }} />;
      case "history":
        return <HistoryTab entities={filtered} onCardClick={onCardClick} currentFile={currentFile ?? undefined} />;
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
          className={`vr-activity-btn ${entitySearchOpen ? "vr-activity-btn--active" : ""}`}
          onClick={() => { setEntitySearchOpen(!entitySearchOpen); if (!entitySearchOpen) setTimeout(() => entitySearchRef.current?.focus(), 0); }}
          title="Search Entities"
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

      {/* Entity search panel */}
      {entitySearchOpen && (
        <div className="vr-entity-search-panel">
          <div className="vr-entity-search-header">
            <input
              ref={entitySearchRef}
              type="text"
              placeholder="Search... (t:concept, f:filename, Esc to close)"
              value={entitySearch}
              onChange={(e) => { setEntitySearch(e.target.value); setEntitySearchIdx(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setEntitySearchIdx(i => Math.min(i + 1, entitySearchResults.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setEntitySearchIdx(i => Math.max(i - 1, 0));
                } else if (e.key === "Enter" && entitySearchResults[entitySearchIdx]) {
                  const hit = entitySearchResults[entitySearchIdx];
                  selectFile((hit as any)._key);
                  setActiveTab(hit.type as TabId);
                  setEntitySearchOpen(false);
                  setTimeout(() => {
                    setHighlightRange({ startLine: hit.anchor.start_line, endLine: hit.anchor.end_line || hit.anchor.start_line });
                  }, 100);
                }
              }}
              className="vr-entity-search-input"
            />
          </div>
          <div className="vr-entity-search-results">
            {entitySearch.trim() && entitySearchResults.length === 0 && (
              <div style={{ color: "#888", fontSize: 12, padding: 8 }}>No matches</div>
            )}
            {entitySearchResults.map((e, i) => (
              <div
                key={`es-${i}`}
                ref={i === entitySearchIdx ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
                className={`vr-entity-search-item ${i === entitySearchIdx ? "vr-entity-search-item--active" : ""}`}
                onClick={() => {
                  selectFile((e as any)._key);
                  setActiveTab(e.type as TabId);
                  setEntitySearchOpen(false);
                  setTimeout(() => {
                    setHighlightRange({ startLine: e.anchor.start_line, endLine: e.anchor.end_line || e.anchor.start_line });
                  }, 100);
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="vr-entity-search-type">{e.type}</span>
                  {e.detail.kind ? <span style={{ fontSize: 10, color: "#888" }}>({String(e.detail.kind)})</span> : null}
                  <span className="vr-entity-search-name">{(e.detail.name as string) || e.summary}</span>
                </div>
                <span className="vr-entity-search-file">{(e as any)._file}:{e.anchor.start_line}</span>
              </div>
            ))}
          </div>
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
              <div style={{ marginTop: 8, fontSize: 11, color: "#777" }}>
                {allFiles.length} files · {allEntities.length} entities
              </div>
              <div style={{ marginTop: 4, fontSize: 10, color: "#555", display: "flex", gap: 8, justifyContent: "center" }}>
                <span style={{ color: "#4ec9b0" }}>{allEntities.filter(e => e.type === "concept").length} concepts</span>
                <span style={{ color: "#dcdcaa" }}>{allEntities.filter(e => e.type === "flow").length} flow</span>
                <span style={{ color: "#9cdcfe" }}>{allEntities.filter(e => e.type === "history").length} history</span>
                <span style={{ color: "#c586c0" }}>{allEntities.filter(e => e.type === "jump").length} jump</span>
              </div>
              {(() => {
                const concepts = allEntities.filter(e => e.type === "concept");
                const enriched = concepts.filter(e => {
                  const desc = e.detail.description as string | undefined;
                  return desc && !/^(function|class|interface|type|enum|method|struct|impl|trait|module|decorated) ".+" spanning \d+ lines\.$/.test(desc);
                });
                const pct = concepts.length > 0 ? Math.round((enriched.length / concepts.length) * 100) : 0;
                return concepts.length > 0 ? (
                  <div style={{ marginTop: 8, fontSize: 10, color: "#666" }}>
                    Enrichment: {enriched.length}/{concepts.length} concepts ({pct}%)
                    <div style={{ marginTop: 3, height: 3, background: "#333", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#4ec9b0" : "#dcdcaa", borderRadius: 2 }} />
                    </div>
                  </div>
                ) : null;
              })()}
              {allFiles.length > 0 && (
                <div style={{ marginTop: 12, textAlign: "left", width: "100%" }}>
                  <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", marginBottom: 4 }}>
                    Most complex files
                  </div>
                  {allFiles.slice(0, 5).map(f => (
                    <div
                      key={f.key}
                      style={{ fontSize: 11, color: "#9cdcfe", padding: "2px 0", cursor: "pointer" }}
                      onClick={() => selectFile(f.key)}
                    >
                      {f.file} <span style={{ color: "#666" }}>({f.count})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {currentFile && (
          <>
            <div className="vr-file-header">
              <span className="vr-file-icon">&#x1F4C4;</span>
              <span
                className="vr-file-path"
                title={`${currentFile} (click to copy)`}
                onClick={() => currentFile && navigator.clipboard?.writeText(currentFile)}
              >
                {currentFile}
              </span>
              <span className="vr-file-count" title="entities">{entities.length}</span>
              {sourceCode && <span className="vr-file-loc" title="lines of code">{sourceCode.split("\n").length}L</span>}
              {(() => {
                const hist = entities.find(e => e.type === "history" && e.detail.kind === "file_history");
                const commits = hist?.detail.total_commits as number | undefined;
                return commits ? <span className="vr-file-commits" title={`${commits} commits`}>{commits}c</span> : null;
              })()}
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
            <div className="vr-card-filter">
              <input
                type="text"
                className="vr-card-filter-input"
                placeholder="Filter cards..."
                value={cardFilter}
                onChange={(e) => setCardFilter(e.target.value)}
              />
              <div className="vr-sort-btns">
                {(["line", "name", "kind"] as const).map((s) => (
                  <button
                    key={s}
                    className={`vr-sort-btn ${cardSort === s ? "vr-sort-btn--active" : ""}`}
                    onClick={() => setCardSort(s)}
                    title={`Sort by ${s}`}
                  >{s === "line" ? "#" : s === "name" ? "Az" : "Kd"}</button>
                ))}
              </div>
              {cardFilter && (
                <span className="vr-card-filter-count">
                  {filtered.length}/{entities.filter((e) => e.type === activeTab).length}
                </span>
              )}
            </div>
            <div className="vr-content">{tabContent()}</div>
          </>
        )}
      </div>

      {/* Main area — Monaco editor */}
      <div className="vr-main">
        {openFiles.length > 0 && (
          <div className="vr-tab-bar">
            <button
              className="vr-nav-btn"
              disabled={navIndex <= 0}
              onClick={navigateBack}
              title="Go Back (Alt+←)"
            >&#x2190;</button>
            <button
              className="vr-nav-btn"
              disabled={navIndex >= navHistory.length - 1}
              onClick={navigateForward}
              title="Go Forward (Alt+→)"
            >&#x2192;</button>
            {openFiles.length > 1 && (
              <button
                className="vr-nav-btn"
                onClick={() => {
                  setOpenFiles(currentFile ? [currentFile] : []);
                }}
                title="Close other tabs"
                style={{ fontSize: 10 }}
              >&#x2716;</button>
            )}
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
              entityMarkers={entities.map(e => ({
                startLine: e.anchor.start_line,
                endLine: e.anchor.end_line,
                type: e.type,
              }))}
              onCursorLine={setCursorLine}
              onVisibleRange={useCallback((s: number, e: number) => setVisibleRange({ start: s, end: e }), [])}
            />
          ) : (
            <div className="vr-editor-placeholder">
              Select a file to view source code.
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="vr-statusbar">
        <span>
          {currentFile ?? "No file selected"}
          {breadcrumbEntity && (
            <span
              className="vr-breadcrumb"
              style={{ cursor: "pointer" }}
              onClick={() => {
                setActiveTab("concept");
                setHighlightRange({
                  startLine: breadcrumbEntity.anchor.start_line,
                  endLine: breadcrumbEntity.anchor.end_line,
                });
              }}
              title="Click to show in Concept tab"
            >
              {" > "}{(breadcrumbEntity.detail.kind as string) ?? ""}
              {" "}<strong>{breadcrumbEntity.detail.name as string}</strong>
            </span>
          )}
        </span>
        <span className="vr-statusbar-right">
          {currentFile && `${entities.length} entities`}
          {cursorLine > 0 && ` · Ln ${cursorLine}`}
          {" · "}?: help{" · "}Ctrl+P: files{" · "}Ctrl+Shift+F: search
        </span>
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

      {gotoLineOpen && (
        <>
        <div className="vr-picker-overlay" onClick={() => setGotoLineOpen(false)} />
        <div className="vr-picker" style={{ maxHeight: 60 }}>
          <input
            ref={gotoLineRef}
            type="text"
            className="vr-picker-input"
            placeholder="Go to line..."
            value={gotoLineValue}
            onChange={e => setGotoLineValue(e.target.value.replace(/[^0-9]/g, ""))}
            onKeyDown={e => {
              if (e.key === "Enter") {
                const line = parseInt(gotoLineValue);
                if (line > 0) {
                  setHighlightRange({ startLine: line, endLine: line });
                  setGotoLineOpen(false);
                }
              }
              if (e.key === "Escape") setGotoLineOpen(false);
            }}
          />
        </div>
        </>
      )}

      {helpOpen && (
        <>
        <div className="vr-picker-overlay" onClick={() => setHelpOpen(false)} />
        <div className="vr-help-panel">
          <div className="vr-help-title">Keyboard Shortcuts</div>
          <div className="vr-help-grid">
            <kbd>Ctrl+P</kbd><span>File picker</span>
            <kbd>Ctrl+Shift+F</kbd><span>Entity search</span>
            <kbd>Ctrl+B</kbd><span>Toggle explorer</span>
            <kbd>Ctrl+G</kbd><span>Go to line</span>
            <kbd>Ctrl+W</kbd><span>Close tab</span>
            <kbd>Alt+1-4</kbd><span>Switch tab</span>
            <kbd>Alt+←/→</kbd><span>Navigate back/forward</span>
            <kbd>[ / ]</kbd><span>Previous/next file</span>
            <kbd>?</kbd><span>Toggle this help</span>
            <kbd>Esc</kbd><span>Close overlays</span>
          </div>
          <div className="vr-help-footer">
            <code>t:concept</code> filter by type · <code>f:utils</code> filter by file
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
    height: calc(100vh - 22px);
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

  .vr-entity-search-panel {
    width: 260px;
    min-width: 200px;
    background: #252526;
    border-right: 1px solid #3c3c3c;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex-shrink: 0;
  }
  .vr-entity-search-header {
    padding: 8px;
    border-bottom: 1px solid #3c3c3c;
  }
  .vr-entity-search-input {
    width: 100%;
    background: #3c3c3c;
    border: 1px solid #555;
    color: #d4d4d4;
    padding: 5px 8px;
    border-radius: 3px;
    font-size: 12px;
    outline: none;
    box-sizing: border-box;
  }
  .vr-entity-search-input:focus { border-color: #007acc; }
  .vr-entity-search-results {
    overflow-y: auto;
    flex: 1;
  }
  .vr-entity-search-item {
    padding: 5px 8px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 1px;
    border-bottom: 1px solid #2d2d2d;
  }
  .vr-entity-search-item:hover { background: #2a2d2e; }
  .vr-entity-search-item--active { background: #094771; }
  .vr-entity-search-type {
    font-size: 9px;
    padding: 1px 4px;
    border-radius: 2px;
    background: #333;
    color: #888;
    text-transform: uppercase;
    flex-shrink: 0;
  }
  .vr-entity-search-name {
    font-family: monospace;
    font-size: 12px;
    color: #d4d4d4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .vr-entity-search-file {
    font-size: 10px;
    color: #666;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

  .vr-nav-btn {
    background: none;
    border: none;
    color: #888;
    font-size: 14px;
    padding: 0 6px;
    cursor: pointer;
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .vr-nav-btn:hover:not(:disabled) { color: #ccc; }
  .vr-nav-btn:disabled { opacity: 0.3; cursor: default; }

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

  .vr-marker-concept { background: #4ec9b0; width: 3px !important; margin-left: 1px; border-radius: 1px; }
  .vr-marker-flow { background: #dcdcaa; width: 3px !important; margin-left: 1px; border-radius: 1px; }
  .vr-marker-history { background: #9cdcfe; width: 3px !important; margin-left: 1px; border-radius: 1px; }
  .vr-marker-jump { background: #c586c0; width: 3px !important; margin-left: 1px; border-radius: 1px; }

  .vr-statusbar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 22px;
    background: #007acc;
    color: #fff;
    font-size: 11px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    z-index: 100;
    flex-shrink: 0;
  }

  .vr-statusbar-right {
    opacity: 0.85;
  }

  .vr-breadcrumb {
    color: #888;
    font-size: 11px;
  }
  .vr-breadcrumb strong {
    color: #dcdcaa;
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

  .vr-help-panel {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #252526;
    border: 1px solid #444;
    border-radius: 8px;
    padding: 20px 24px;
    z-index: 200;
    min-width: 300px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  }
  .vr-help-title {
    font-size: 14px;
    font-weight: 600;
    color: #d4d4d4;
    margin-bottom: 12px;
  }
  .vr-help-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 6px 16px;
    font-size: 12px;
    color: #bbb;
  }
  .vr-help-grid kbd {
    background: #3c3c3c;
    border: 1px solid #555;
    border-radius: 3px;
    padding: 1px 6px;
    font-family: monospace;
    font-size: 11px;
    color: #d4d4d4;
  }
  .vr-help-footer {
    margin-top: 12px;
    font-size: 11px;
    color: #666;
  }
  .vr-help-footer code {
    background: #3c3c3c;
    padding: 1px 4px;
    border-radius: 2px;
    font-size: 10px;
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
    cursor: pointer;
  }

  .vr-file-path:hover { color: #fff; }

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

  .vr-file-loc {
    flex-shrink: 0;
    font-size: 10px;
    opacity: 0.5;
    background: #2a3a2a;
    color: #b5cea8;
    padding: 0 5px;
    border-radius: 8px;
    line-height: 16px;
  }

  .vr-file-commits {
    flex-shrink: 0;
    font-size: 10px;
    opacity: 0.5;
    background: #3a3a2a;
    color: #dcdcaa;
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

  .vr-card-filter {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    flex-shrink: 0;
  }

  .vr-card-filter-input {
    flex: 1;
    padding: 4px 8px;
    background: #1e1e1e;
    color: #ccc;
    border: 1px solid #3c3c3c;
    border-radius: 4px;
    font-size: 11px;
    font-family: inherit;
    outline: none;
  }

  .vr-card-filter-input:focus {
    border-color: #007acc;
  }

  .vr-sort-btns {
    display: flex;
    gap: 1px;
    flex-shrink: 0;
  }

  .vr-sort-btn {
    background: #2d2d2d;
    border: 1px solid #3c3c3c;
    color: #888;
    font-size: 10px;
    padding: 2px 5px;
    cursor: pointer;
    font-family: inherit;
  }

  .vr-sort-btn:first-child { border-radius: 3px 0 0 3px; }
  .vr-sort-btn:last-child { border-radius: 0 3px 3px 0; }
  .vr-sort-btn--active { background: #007acc; color: #fff; border-color: #007acc; }
  .vr-sort-btn:hover:not(.vr-sort-btn--active) { background: #3c3c3c; }

  .vr-card-filter-count {
    font-size: 10px;
    color: #666;
    flex-shrink: 0;
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

  .vr-card-highlight {
    border-color: #007acc;
    background: #1a2a3a;
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
  .vr-card-chip--enriched {
    background: #1a3a2a;
    color: #4ec9b0;
  }

  .vr-no-cards {
    text-align: center;
    padding: 32px 20px;
    color: #8b8b8b;
    font-size: 12px;
  }
`;
