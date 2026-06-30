import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ConceptTab } from "./tabs/ConceptTab";
import { FlowTab } from "./tabs/FlowTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { JumpTab } from "./tabs/JumpTab";
import { OutlineTab } from "./tabs/OutlineTab";
import { MonacoEditor, detectLanguage } from "./MonacoEditor";
import { FileTree, fileTreeStyles } from "./components/FileTree";
import { FileHeatmap, fileHeatmapStyles } from "./components/FileHeatmap";
import { entityMiniGraphStyles } from "./components/EntityMiniGraph";
import type { DataEntity, TabId, CallGraph } from "./shared-types";
import { layoutStyles, sidebarStyles } from "./styles";
import { highlightMatch, loadSourceContent, pickDefaultFileKey } from "./utils/app-helpers";

declare const PREVIEW_DATA: Record<
  string,
  { file: string; entities: DataEntity[] }
>;

declare const CALL_GRAPH: CallGraph | null;

const DEFAULT_FILE_KEY = pickDefaultFileKey();

const TABS: { id: TabId; label: string }[] = [
  { id: "concept", label: "Concept" },
  { id: "flow", label: "Flow" },
  { id: "history", label: "History" },
  { id: "jump", label: "Jump" },
  { id: "outline", label: "Outline" },
];

interface FileInfo {
  key: string;
  file: string;
  count: number;
  commits: number;
  complexity: number;
}

function useResizable(initialWidth: number, min: number, max: number) {
  const [width, setWidth] = useState(initialWidth);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);
  const widthRef = useRef(width);
  widthRef.current = width;

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = widthRef.current;

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
  }, [min, max]);

  return { width, onMouseDown };
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    try { const t = localStorage.getItem("vr-active-tab"); if (t && TABS.some(tab => tab.id === t)) return t as TabId; } catch {}
    return "concept";
  });
  const [entities, setEntities] = useState<DataEntity[]>(() =>
    DEFAULT_FILE_KEY ? PREVIEW_DATA[DEFAULT_FILE_KEY].entities : []
  );
  const [currentFile, setCurrentFile] = useState<string | null>(() =>
    DEFAULT_FILE_KEY ? PREVIEW_DATA[DEFAULT_FILE_KEY].file : null
  );
  const [sourceCode, setSourceCode] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState<string>(() =>
    DEFAULT_FILE_KEY ? detectLanguage(PREVIEW_DATA[DEFAULT_FILE_KEY].file) : "plaintext"
  );
  const [highlightRange, setHighlightRange] = useState<{
    startLine: number;
    endLine: number;
  } | null>(null);
  const [openFiles, setOpenFiles] = useState<string[]>(() =>
    DEFAULT_FILE_KEY ? [PREVIEW_DATA[DEFAULT_FILE_KEY].file] : []
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [treeOpen, setTreeOpen] = useState(true);
  const [navHistory, setNavHistory] = useState<string[]>([]);
  const [navIndex, setNavIndex] = useState(-1);
  const [cardFilter, setCardFilter] = useState("");
  const [cardSort, setCardSort] = useState<"line" | "name" | "kind">("line");
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  const [entitySearch, setEntitySearch] = useState("");
  const [entitySearchOpen, setEntitySearchOpen] = useState(false);
  const [entitySearchIdx, setEntitySearchIdx] = useState(0);
  const [heatmapOpen, setHeatmapOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try { return (localStorage.getItem("vr-theme") as "dark" | "light") || "dark"; } catch { return "dark"; }
  });
  const toggleTheme = useCallback(() => {
    setTheme(t => {
      const next = t === "dark" ? "light" : "dark";
      try { localStorage.setItem("vr-theme", next); } catch {}
      return next;
    });
  }, []);
  const [showEntityGraph, setShowEntityGraph] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [cursorLine, setCursorLine] = useState(0);
  const [visibleRange, setVisibleRange] = useState<{ start: number; end: number } | null>(null);
  const [gotoLineOpen, setGotoLineOpen] = useState(false);
  const [gotoLineValue, setGotoLineValue] = useState("");
  const gotoLineRef = useRef<HTMLInputElement>(null);
  const [symbolOpen, setSymbolOpen] = useState(false);
  const [symbolQuery, setSymbolQuery] = useState("");
  const [symbolIdx, setSymbolIdx] = useState(0);
  const symbolRef = useRef<HTMLInputElement>(null);
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("vr-bookmarks");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const toggleBookmark = useCallback((key: string) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      try { localStorage.setItem("vr-bookmarks", JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);
  const [hoveredEntityIdx, setHoveredEntityIdx] = useState<number | null>(null);
  const [cardHoveredEntity, setCardHoveredEntity] = useState<DataEntity | null>(null);
  const [focusedCardIdx, setFocusedCardIdx] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const entitySearchRef = useRef<HTMLInputElement>(null);

  const treeResize = useResizable(220, 120, 400);
  const sidebarResize = useResizable(340, 240, 600);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setTreeOpen(false);
    };
    handler(mq);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  type SearchableEntity = DataEntity & { _file: string; _key: string };
  const allEntities: SearchableEntity[] = useMemo(() =>
    Object.entries(PREVIEW_DATA).flatMap(([key, data]) =>
      (data.entities as DataEntity[]).map(e => ({ ...e, _file: data.file, _key: key }))
    ), []);

  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("vr-search-history");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const addSearchHistory = useCallback((q: string) => {
    if (!q.trim()) return;
    setSearchHistory(prev => {
      const next = [q, ...prev.filter(h => h !== q)].slice(0, 8);
      try { localStorage.setItem("vr-search-history", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const entitySearchResults = useMemo(() => {
    if (!entitySearch.trim()) return [];
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

        // Fuzzy match on name
        let qi = 0;
        let consecutive = 0;
        let maxConsec = 0;
        for (let ni = 0; ni < name.length && qi < q.length; ni++) {
          if (name[ni] === q[qi]) {
            qi++;
            consecutive++;
            maxConsec = Math.max(maxConsec, consecutive);
          } else {
            consecutive = 0;
          }
        }
        if (qi === q.length) return { e, score: 5 + maxConsec * 2 };

        return null;
      })
      .filter((x): x is { e: typeof allEntities[0]; score: number } => x !== null)
      .sort((a, b) => b.score - a.score);

    return scored.map(s => s.e).slice(0, 50);
  }, [entitySearch, allEntities]);

  const breadcrumbPath = useMemo(() => {
    if (!cursorLine) return [];
    const concepts = entities.filter(e => e.type === "concept");
    const chain: DataEntity[] = [];
    for (const e of concepts) {
      if (cursorLine >= e.anchor.start_line && cursorLine <= e.anchor.end_line) {
        chain.push(e);
      }
    }
    chain.sort((a, b) => (a.anchor.end_line - a.anchor.start_line) - (b.anchor.end_line - b.anchor.start_line));
    const result: DataEntity[] = [];
    for (const e of chain.reverse()) {
      if (result.length === 0 || (result[result.length - 1].anchor.start_line <= e.anchor.start_line && result[result.length - 1].anchor.end_line >= e.anchor.end_line)) {
        result.push(e);
      }
    }
    return result;
  }, [cursorLine, entities]);

  const breadcrumbEntity = breadcrumbPath.length > 0 ? breadcrumbPath[breadcrumbPath.length - 1] : null;

  const allFiles: FileInfo[] = useMemo(() =>
    Object.entries(PREVIEW_DATA)
      .map(([key, data]) => {
        const hist = (data.entities as DataEntity[]).find(
          e => e.type === "history" && (e.detail.kind === "file_history")
        );
        const ents = data.entities as DataEntity[];
        const flows = ents.filter(e => e.type === "flow");
        const imports = flows.filter(e => e.detail.kind === "imports");
        const importCount = imports.reduce((sum, e) =>
          sum + ((e.detail.names as string[])?.length || 0), 0);
        const concepts = ents.filter(e => e.type === "concept");
        const maxDepth = concepts.reduce((max, e) => {
          const lines = e.anchor.end_line - e.anchor.start_line;
          return Math.max(max, lines);
        }, 0);
        const complexity = Math.round(
          concepts.length * 2 + importCount * 1.5 + Math.sqrt(maxDepth) * 3
        );
        return {
          key,
          file: data.file,
          count: data.entities.length,
          commits: (hist?.detail.total_commits as number) || 0,
          complexity,
        };
      })
      .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file)),
  []);

  const fileKeyMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of allFiles) m.set(f.file, f.key);
    return m;
  }, [allFiles]);

  const fileInfoMap = useMemo(() => {
    const m = new Map<string, FileInfo>();
    for (const f of allFiles) m.set(f.file, f);
    return m;
  }, [allFiles]);

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
    : (() => {
        const recentSet = new Set(openFiles);
        const recent = allFiles.filter(f => recentSet.has(f.file));
        const rest = allFiles.filter(f => !recentSet.has(f.file));
        return [...recent, ...rest];
      })();

  const visibleFiles = filteredFiles.slice(0, 100);
  const remaining = filteredFiles.length - visibleFiles.length;

  const navIndexRef = useRef(navIndex);
  navIndexRef.current = navIndex;

  const selectFile = useCallback(
    async (key: string, skipHistory = false) => {
      const data = PREVIEW_DATA[key];
      if (!data) return;

      if (!skipHistory) {
        setNavHistory((prev) => {
          const trimmed = prev.slice(0, navIndexRef.current + 1);
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
        const content = await loadSourceContent(data.file);
        setSourceCode(content);
      } catch {
        setSourceCode(`// Failed to load source: ${data.file}`);
      }
    },
    []
  );

  const navHistoryRef = useRef(navHistory);
  navHistoryRef.current = navHistory;

  const navigateBack = useCallback(() => {
    setNavIndex((prev) => {
      if (prev <= 0) return prev;
      const newIdx = prev - 1;
      const file = navHistoryRef.current[newIdx];
      const fk = fileKeyMap.get(file);
      if (fk) {
        selectFile(fk, true);
        return newIdx;
      }
      return prev;
    });
  }, [fileKeyMap, selectFile]);

  useEffect(() => {
    if (currentFile) {
      try { localStorage.setItem("vr-last-file", currentFile); } catch {}
    }
  }, [currentFile]);

  useEffect(() => {
    try { localStorage.setItem("vr-active-tab", activeTab); } catch {}
  }, [activeTab]);

  useEffect(() => {
    if (DEFAULT_FILE_KEY) selectFile(DEFAULT_FILE_KEY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigateForward = useCallback(() => {
    setNavIndex((prev) => {
      if (prev >= navHistoryRef.current.length - 1) return prev;
      const newIdx = prev + 1;
      const file = navHistoryRef.current[newIdx];
      const fk = fileKeyMap.get(file);
      if (fk) {
        selectFile(fk, true);
        return newIdx;
      }
      return prev;
    });
  }, [fileKeyMap, selectFile]);

  const [closedTabs, setClosedTabs] = useState<string[]>([]);

  const closeTab = useCallback(
    (file: string) => {
      setClosedTabs(prev => [file, ...prev.filter(f => f !== file)].slice(0, 10));
      setOpenFiles((prev) => {
        const next = prev.filter((f) => f !== file);
        if (file === currentFile && next.length > 0) {
          const fileKey = fileKeyMap.get(next[next.length - 1]);
          if (fileKey) selectFile(fileKey);
        } else if (next.length === 0) {
          setCurrentFile(null);
          setEntities([]);
          setSourceCode("");
        }
        return next;
      });
    },
    [currentFile, fileKeyMap, selectFile]
  );

  const reopenTab = useCallback(() => {
    if (closedTabs.length === 0) return;
    const file = closedTabs[0];
    setClosedTabs(prev => prev.slice(1));
    const fk = fileKeyMap.get(file);
    if (fk) selectFile(fk);
  }, [closedTabs, fileKeyMap, selectFile]);

  const selectByFile = useCallback((file: string) => {
    const fk = fileKeyMap.get(file);
    if (fk) selectFile(fk);
  }, [fileKeyMap, selectFile]);

  const onCardClick = useCallback((entity: DataEntity) => {
    if (entity.type === "jump" && entity.detail.target_file) {
      const targetFile = entity.detail.target_file as string;
      const fk = fileKeyMap.get(targetFile);
      if (fk) {
        selectFile(fk);
        return;
      }
    }
    setHighlightRange({
      startLine: entity.anchor.start_line,
      endLine: entity.anchor.end_line || entity.anchor.start_line,
    });
  }, [fileKeyMap, selectFile]);

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

  const filtered = useMemo(() => {
    const q = cardFilter.toLowerCase().trim();
    return entities
      .filter((e) => {
        if (e.type !== activeTab) return false;
        if (showBookmarksOnly && activeTab === "concept") {
          const key = `${currentFile}:${e.detail?.name || ""}`;
          if (!bookmarks.has(key)) return false;
        }
        if (!q) return true;
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
  }, [entities, activeTab, cardFilter, cardSort, showBookmarksOnly, bookmarks, currentFile]);

  const sourceLines = useMemo(() => sourceCode ? sourceCode.split("\n") : [], [sourceCode]);

  const exportMarkdown = useCallback(() => {
    const file = currentFile || "unknown";
    const concepts = filtered.filter(e => e.type === "concept");
    if (concepts.length === 0) return;
    const lines: string[] = [`# ${file}\n`];
    for (const e of concepts) {
      const d = e.detail;
      const name = (d.name as string) || e.summary;
      const kind = (d.kind as string) || "";
      lines.push(`## ${name}${kind ? ` (${kind})` : ""}\n`);
      lines.push(`**Lines:** ${e.anchor.start_line}–${e.anchor.end_line}\n`);
      if (d.description) lines.push(`${d.description}\n`);
      if (d.why) lines.push(`**Why:** ${d.why}\n`);
      if (d.pattern) lines.push(`**Pattern:** ${d.pattern}\n`);
      if (d.analogy) lines.push(`**Analogy:** ${d.analogy}\n`);
      if (d.design) lines.push(`**Design:** ${d.design}\n`);
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.replace(/[/\\]/g, "_").replace(/\.\w+$/, "") + "_notes.md";
    link.click();
    URL.revokeObjectURL(url);
  }, [filtered, currentFile]);

  const onVisibleRange = useCallback((start: number, end: number) => {
    setVisibleRange({ start, end });
  }, []);

  const entityMarkers = useMemo(
    () => entities.map(e => ({
      startLine: e.anchor.start_line,
      endLine: e.anchor.end_line,
      type: e.type,
    })),
    [entities]
  );

  const hoverInfos = useMemo(
    () => entities
      .filter(e => (e.type === "concept" && e.detail.name) || (e.type === "flow" && e.detail.kind === "imports"))
      .map(e => {
        const d = e.detail;
        if (e.type === "flow" && d.kind === "imports") {
          const names = (d.names as string[]) || [];
          const source = String(d.source || "");
          return {
            startLine: e.anchor.start_line,
            endLine: e.anchor.end_line,
            name: source,
            kind: "import",
            summary: names.length > 0
              ? `Imports: \`${names.join("`, `")}\` from \`${source}\``
              : `Imports module \`${source}\``,
          };
        }
        let summary = e.summary;
        if (d.description && d.description !== e.summary) {
          summary += `\n\n${d.description}`;
        }
        if (d.why) summary += `\n\n**Why:** ${d.why}`;
        if (d.analogy) summary += `\n\n**Analogy:** ${d.analogy}`;
        if (d.pattern) summary += `\n\n**Pattern:** ${d.pattern}`;
        return {
          startLine: e.anchor.start_line,
          endLine: e.anchor.end_line,
          name: String(d.name),
          kind: String(d.node_type || d.kind || ""),
          summary,
          params: d.params as string[] | undefined,
          returnType: d.return_type as string | undefined,
        };
      }),
    [entities]
  );
  const focusedEntity = focusedCardIdx != null ? filtered[focusedCardIdx] ?? null : null;
  const effectiveHighlight = focusedEntity ?? hoveredEntity;

  const symbolResults = useMemo(() => {
    if (!symbolOpen) return [];
    const q = symbolQuery.toLowerCase().trim();
    return entities
      .filter(e => e.type === "concept" && e.detail.name)
      .filter(e => !q || String(e.detail.name).toLowerCase().includes(q))
      .sort((a, b) => a.anchor.start_line - b.anchor.start_line)
      .slice(0, 20);
  }, [symbolOpen, symbolQuery, entities]);

  useEffect(() => { setFocusedCardIdx(null); }, [currentFile, activeTab]);

  useEffect(() => {
    const container = document.querySelector(".vr-content");
    if (!container) return;
    const cards = container.querySelectorAll(".vr-card");
    cards.forEach((c, i) => {
      c.classList.toggle("vr-card--focused", i === focusedCardIdx);
    });
    if (focusedCardIdx != null && cards[focusedCardIdx]) {
      cards[focusedCardIdx].scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [focusedCardIdx]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        setGotoLineOpen(false);
        setSymbolOpen(false);
        setSearchQuery("");
        setPickerOpen(true);
        setTimeout(() => searchRef.current?.focus(), 0);
        return;
      }
      if (e.key === "Escape") {
        setPickerOpen(false);
        setEntitySearchOpen(false);
        setHelpOpen(false);
        setGotoLineOpen(false);
        setSymbolOpen(false);
        setFocusedCardIdx(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "O") {
        e.preventDefault();
        setPickerOpen(false);
        setGotoLineOpen(false);
        setSymbolOpen(true);
        setSymbolQuery("");
        setSymbolIdx(0);
        setTimeout(() => symbolRef.current?.focus(), 0);
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
        setPickerOpen(false);
        setSymbolOpen(false);
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
      if (e.altKey && e.key >= "1" && e.key <= "5") {
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
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "T") {
        e.preventDefault();
        reopenTab();
      }
      if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        navigateForward();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        if (breadcrumbEntity && currentFile) {
          toggleBookmark(`${currentFile}:${breadcrumbEntity.detail.name}`);
        }
      }
      if ((e.key === "[" || e.key === "]" || e.code === "BracketLeft" || e.code === "BracketRight") && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement)) {
        const idx = allFiles.findIndex(f => f.file === currentFile);
        if (idx >= 0 && allFiles.length > 1) {
          const forward = e.key === "]" || e.code === "BracketRight";
          const next = forward
            ? (idx + 1) % allFiles.length
            : (idx - 1 + allFiles.length) % allFiles.length;
          selectFile(allFiles[next].key);
        }
      }

      const tag = (e.target as HTMLElement)?.tagName;
      const inEditor = !!(e.target as HTMLElement)?.closest(".vr-editor-wrap");
      if (pickerOpen || entitySearchOpen || symbolOpen || gotoLineOpen || helpOpen || tag === "INPUT" || (tag === "TEXTAREA" && !inEditor)) return;

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
      } else if (e.key === "Enter" && focusedCardIdx != null) {
        e.preventDefault();
        const container = document.querySelector(".vr-content");
        const cards = container?.querySelectorAll(".vr-card");
        const card = cards?.[focusedCardIdx];
        if (card) {
          const header = card.querySelector(".vr-card-header") as HTMLElement;
          header?.click();
        }
      } else if (e.key === " " && focusedCardIdx != null && filtered[focusedCardIdx]) {
        e.preventDefault();
        const ent = filtered[focusedCardIdx];
        const key = `${currentFile}:${ent.anchor.start_line}:${ent.detail?.name || ""}`;
        toggleBookmark(key);
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [navigateBack, navigateForward, allFiles, currentFile, pickerOpen, filtered, focusedCardIdx, onCardClick, breadcrumbEntity, toggleBookmark, closeTab, reopenTab, selectFile]);

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


  const tabContent = () => {
    switch (activeTab) {
      case "concept":
        return <ConceptTab entities={filtered} onCardClick={onCardClick} highlightEntity={breadcrumbEntity}
                           totalLines={sourceLines.length}
                           visibleRange={visibleRange}
                           callGraph={CALL_GRAPH} currentFile={currentFile}
                           onFileSelect={selectByFile}
                           bookmarks={bookmarks}
                           onBookmark={toggleBookmark}
                           showGraph={showEntityGraph}
                           sourceLines={sourceLines} />;
      case "flow":
        return <FlowTab entities={filtered} onCardClick={onCardClick} currentFile={currentFile} callGraph={CALL_GRAPH} onFileSelect={selectByFile} />;
      case "history":
        return <HistoryTab entities={filtered} onCardClick={onCardClick} currentFile={currentFile ?? undefined} />;
      case "jump":
        return <JumpTab entities={filtered} onCardClick={onCardClick}
                        callGraph={CALL_GRAPH} currentFile={currentFile}
                        onFileSelect={selectByFile} />;
      case "outline":
        return <OutlineTab entities={entities} onCardClick={onCardClick} cursorLine={cursorLine} />;
    }
  };

  return (
    <div className={`vr-layout ${theme === "light" ? "vr-layout--light" : ""}`}>
      <style>{layoutStyles}</style>
      <style>{sidebarStyles}</style>
      <style>{fileTreeStyles}</style>
      <style>{fileHeatmapStyles}</style>
      <style>{entityMiniGraphStyles}</style>

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
        <button
          className={`vr-activity-btn ${heatmapOpen ? "vr-activity-btn--active" : ""}`}
          onClick={() => setHeatmapOpen(!heatmapOpen)}
          title="File Heatmap"
        >
          &#x1F525;
        </button>
        <div style={{ flex: 1 }} />
        <button
          className="vr-activity-btn vr-theme-btn"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
          style={{ opacity: 0.6, fontSize: 14, marginBottom: 8 }}
        >
          {theme === "dark" ? "\u2600\uFE0F" : "\uD83C\uDF19"}
        </button>
      </div>

      {/* File tree panel */}
      {treeOpen && (
        <div className="vr-file-panel" style={{ width: treeResize.width }}>
          <FileTree files={allFiles} currentFile={currentFile} onSelect={selectFile} />
        </div>
      )}
      {treeOpen && <div className="vr-resize-handle" onMouseDown={treeResize.onMouseDown} />}

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
                  setEntitySearchIdx(i => {
                    const next = Math.min(i + 1, entitySearchResults.length - 1);
                    const hit = entitySearchResults[next];
                    if (hit && (hit as SearchableEntity)._file === currentFile) {
                      setHighlightRange({ startLine: hit.anchor.start_line, endLine: hit.anchor.end_line || hit.anchor.start_line });
                    }
                    return next;
                  });
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setEntitySearchIdx(i => {
                    const next = Math.max(i - 1, 0);
                    const hit = entitySearchResults[next];
                    if (hit && (hit as SearchableEntity)._file === currentFile) {
                      setHighlightRange({ startLine: hit.anchor.start_line, endLine: hit.anchor.end_line || hit.anchor.start_line });
                    }
                    return next;
                  });
                } else if (e.key === "Enter" && entitySearchResults[entitySearchIdx]) {
                  const hit = entitySearchResults[entitySearchIdx];
                  addSearchHistory(entitySearch.trim());
                  selectFile((hit as SearchableEntity)._key);
                  setActiveTab(hit.type as TabId);
                  setEntitySearchOpen(false);
                  setTimeout(() => {
                    setHighlightRange({ startLine: hit.anchor.start_line, endLine: hit.anchor.end_line || hit.anchor.start_line });
                  }, 100);
                }
              }}
              className="vr-entity-search-input"
            />
            {entitySearch.trim() && (
              <div style={{ fontSize: 10, color: "#666", padding: "2px 0 0" }}>
                {entitySearchResults.length} result{entitySearchResults.length !== 1 ? "s" : ""}
                {entitySearchResults.length >= 50 && " (limit)"}
              </div>
            )}
          </div>
          <div className="vr-entity-search-results">
            {!entitySearch.trim() && searchHistory.length > 0 && (
              <div style={{ padding: "6px 8px" }}>
                <div style={{ fontSize: 9, color: "#666", textTransform: "uppercase", marginBottom: 4 }}>Recent</div>
                {searchHistory.map((h, i) => (
                  <div
                    key={`hist-${i}`}
                    className="vr-entity-search-item"
                    onClick={() => { setEntitySearch(h); setEntitySearchIdx(0); }}
                    style={{ cursor: "pointer" }}
                  >
                    <span style={{ fontSize: 11, color: "#888" }}>&#x1F50D; {h}</span>
                  </div>
                ))}
              </div>
            )}
            {entitySearch.trim() && entitySearchResults.length === 0 && (
              <div style={{ color: "#888", fontSize: 12, padding: 8 }}>No matches</div>
            )}
            {entitySearchResults.map((e, i) => {
              const q = entitySearch.toLowerCase().trim()
                .replace(/^(?:type:|t:)\w+\s*/, "")
                .replace(/^(?:file:|f:)\S+\s*/, "");
              const nameStr = (e.detail.name as string) || e.summary;
              return (
                <div
                  key={`es-${i}`}
                  ref={i === entitySearchIdx ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
                  className={`vr-entity-search-item ${i === entitySearchIdx ? "vr-entity-search-item--active" : ""}`}
                  onClick={() => {
                    addSearchHistory(entitySearch.trim());
                    selectFile((e as SearchableEntity)._key);
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
                    <span className="vr-entity-search-name">
                      {q ? highlightMatch(nameStr, q) : nameStr}
                    </span>
                  </div>
                  <span className="vr-entity-search-file">{(e as SearchableEntity)._file}:{e.anchor.start_line}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* File heatmap panel */}
      {heatmapOpen && (
        <div className="vr-heatmap-panel">
          <FileHeatmap files={allFiles} currentFile={currentFile} onSelect={selectFile} />
        </div>
      )}

      {/* Sidebar — knowledge cards */}
      <div className="vr-sidebar" style={{ width: sidebarResize.width }}>
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
              {sourceLines.length > 0 && <span className="vr-file-loc" title="lines of code">{sourceLines.length}L</span>}
              {(() => {
                const hist = entities.find(e => e.type === "history" && e.detail.kind === "file_history");
                const commits = hist?.detail.total_commits as number | undefined;
                return commits ? <span className="vr-file-commits" title={`${commits} commits`}>{commits}c</span> : null;
              })()}
              {(() => {
                const fi = currentFile ? fileInfoMap.get(currentFile) : undefined;
                return fi && fi.complexity > 0 ? (
                  <span title={`complexity score: ${fi.complexity}`} style={{
                    fontSize: 10, padding: "0 4px", borderRadius: 3, marginLeft: 2,
                    background: fi.complexity > 50 ? "#4a2020" : fi.complexity > 25 ? "#3a3a20" : "#1a2a1a",
                    color: fi.complexity > 50 ? "#f44747" : fi.complexity > 25 ? "#dcdcaa" : "#4ec9b0",
                  }}>{fi.complexity}cx</span>
                ) : null;
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
              {activeTab === "concept" && (
                <>
                  <button
                    className={`vr-sort-btn ${showBookmarksOnly ? "vr-sort-btn--active" : ""}`}
                    onClick={() => setShowBookmarksOnly(v => !v)}
                    title={showBookmarksOnly ? "Show all cards" : "Show bookmarked only"}
                    style={{ marginLeft: 4, fontSize: 11 }}
                  >{showBookmarksOnly ? "★" : "☆"}</button>
                  <button
                    className={`vr-sort-btn ${showEntityGraph ? "vr-sort-btn--active" : ""}`}
                    onClick={() => setShowEntityGraph(v => !v)}
                    title="Toggle entity graph"
                    style={{ fontSize: 11 }}
                  >&#x2726;</button>
                  <button
                    className="vr-sort-btn"
                    onClick={exportMarkdown}
                    title="Export as Markdown"
                    style={{ fontSize: 11 }}
                  >&#x2913;</button>
                </>
              )}
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
      <div className="vr-resize-handle" onMouseDown={sidebarResize.onMouseDown} />

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
            {openFiles.map((file, tabIdx) => {
              const fk = fileKeyMap.get(file);
              const fi = fileInfoMap.get(file);
              return (
                <div
                  key={file}
                  className={`vr-tab-item ${file === currentFile ? "vr-tab-item--active" : ""}`}
                  draggable
                  onClick={() => fk && selectFile(fk)}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", String(tabIdx));
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
                    if (isNaN(fromIdx) || fromIdx === tabIdx) return;
                    setOpenFiles(prev => {
                      const next = [...prev];
                      const [moved] = next.splice(fromIdx, 1);
                      next.splice(tabIdx, 0, moved);
                      return next;
                    });
                  }}
                  title={fi ? `${fi.count} entities · ${fi.complexity}cx` : file}
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
              entityMarkers={entityMarkers}
              onCursorLine={setCursorLine}
              onVisibleRange={onVisibleRange}
              hoverInfos={hoverInfos}
              hoverRange={hoverRange}
              onHoverLine={onHoverLine}
              editorTheme={theme === "light" ? "vs" : "vs-dark"}
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
          {breadcrumbPath.map((be, i) => (
            <span
              key={i}
              className="vr-breadcrumb"
              style={{ cursor: "pointer" }}
              onClick={() => {
                setActiveTab("concept");
                setHighlightRange({
                  startLine: be.anchor.start_line,
                  endLine: be.anchor.end_line,
                });
                const idx = filtered.findIndex(e =>
                  e.anchor.start_line === be.anchor.start_line && e.detail.name === be.detail.name
                );
                if (idx >= 0) setFocusedCardIdx(idx);
              }}
              title={`${be.detail.kind}: ${be.detail.name} (L${be.anchor.start_line}–${be.anchor.end_line})`}
            >
              {" > "}{i === breadcrumbPath.length - 1
                ? <strong>{be.detail.name as string}</strong>
                : <span style={{ color: "#666" }}>{be.detail.name as string}</span>}
            </span>
          ))}
        </span>
        <span className="vr-statusbar-right">
          {currentFile && (() => {
            const concepts = entities.filter(e => e.type === "concept");
            const enriched = concepts.filter(e => {
              const d = e.detail.description as string | undefined;
              return d && !/^(function|class|interface|type|enum|method|struct|impl|trait|module|decorated) ".+" spanning \d+ lines\.$/.test(d);
            });
            const pct = concepts.length > 0 ? Math.round(enriched.length / concepts.length * 100) : 0;
            return `${concepts.length} concepts (${pct}%)`;
          })()}
          {cursorLine > 0 && ` · Ln ${cursorLine}`}
          {currentFile && (() => {
            const fi = fileInfoMap.get(currentFile);
            return fi && fi.complexity > 0 ? ` · ${fi.complexity}cx` : "";
          })()}
          {sourceLines.length > 0 && ` · ${sourceLines.length} lines`}
          {currentFile && ` · ${sourceLanguage}`}
          <button className="vr-statusbar-help" onClick={() => setHelpOpen(h => !h)} title="Keyboard shortcuts (?)">?</button>
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
                <span style={{ marginLeft: "auto", display: "flex", gap: 6, fontSize: 10, color: "#666", flexShrink: 0 }}>
                  {f.count > 0 && <span>{f.count}e</span>}
                  {f.complexity > 0 && <span style={{ color: f.complexity > 10 ? "#f44747" : f.complexity > 5 ? "#dcdcaa" : "#4ec9b0" }}>{f.complexity}cx</span>}
                </span>
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

      {symbolOpen && (
        <>
        <div className="vr-picker-overlay" onClick={() => setSymbolOpen(false)} />
        <div className="vr-picker">
          <input
            ref={symbolRef}
            type="text"
            className="vr-picker-input"
            placeholder="Go to symbol... (Ctrl+Shift+O)"
            value={symbolQuery}
            onChange={e => { setSymbolQuery(e.target.value); setSymbolIdx(0); }}
            onKeyDown={e => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSymbolIdx(i => Math.min(i + 1, symbolResults.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setSymbolIdx(i => Math.max(i - 1, 0)); }
              if (e.key === "Enter" && symbolResults[symbolIdx]) {
                onCardClick(symbolResults[symbolIdx]);
                setSymbolOpen(false);
              }
              if (e.key === "Escape") setSymbolOpen(false);
            }}
          />
          <div className="vr-picker-list" style={{ maxHeight: 300, overflowY: "auto" }}>
            {symbolResults.map((e, i) => {
              const kind = (e.detail.node_type as string || "").toLowerCase();
              return (
                <div key={i}
                     className={`vr-picker-item ${i === symbolIdx ? "vr-picker-item--active" : ""}`}
                     onClick={() => { onCardClick(e); setSymbolOpen(false); }}
                >
                  <span style={{ fontSize: 10, color: "#888", marginRight: 4 }}>{kind}</span>
                  <span>{String(e.detail.name)}</span>
                  <span style={{ marginLeft: "auto", fontSize: 10, color: "#666" }}>L{e.anchor.start_line}</span>
                </div>
              );
            })}
          </div>
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
            <kbd>Ctrl+Shift+F</kbd><span>Entity search (fuzzy)</span>
            <kbd>Ctrl+Shift+O</kbd><span>Go to symbol</span>
            <kbd>Ctrl+Shift+E</kbd><span>Focus file filter</span>
            <kbd>Ctrl+B</kbd><span>Toggle explorer</span>
            <kbd>Ctrl+D</kbd><span>Bookmark entity</span>
            <kbd>Ctrl+G</kbd><span>Go to line</span>
            <kbd>Ctrl+W</kbd><span>Close tab</span>
            <kbd>Ctrl+Shift+T</kbd><span>Reopen closed tab</span>
            <kbd>Alt+1-5</kbd><span>Switch panel tab</span>
            <kbd>Alt+←/→</kbd><span>Navigate back/forward</span>
            <kbd>[ / ]</kbd><span>Previous/next file</span>
            <kbd>j / k</kbd><span>Focus prev/next card</span>
            <kbd>Enter</kbd><span>Expand/collapse focused card</span>
            <kbd>Space</kbd><span>Bookmark focused card</span>
            <kbd>?</kbd><span>Toggle this help</span>
            <kbd>Esc</kbd><span>Close overlays</span>
          </div>
          <div className="vr-help-footer">
            <div style={{ marginBottom: 4 }}>
              <strong style={{ color: "#ccc" }}>Search syntax:</strong>{" "}
              <code>t:concept</code> filter by type · <code>f:utils</code> filter by file
            </div>
            <div>
              <strong style={{ color: "#ccc" }}>Activity bar:</strong>{" "}
              &#x1F4C1; Explorer · &#x1F50D; Search · &#x1F525; Heatmap · &#x2600;&#xFE0F;/&#x1F319; Theme
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: "#888" }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Entity Types</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[["function","#4ec9b0"],["class","#dcdcaa"],["interface","#9cdcfe"],["type","#9cdcfe"],
                ["variable","#ce9178"],["enum","#b5cea8"],["method","#4ec9b0"],["decorated","#c586c0"]].map(([k,c]) => (
                <span key={k} style={{ color: c as string }}>{k}</span>
              ))}
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}


