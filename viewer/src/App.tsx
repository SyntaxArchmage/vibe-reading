import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ConceptTab } from "./tabs/ConceptTab";
import { FlowTab } from "./tabs/FlowTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { JumpTab } from "./tabs/JumpTab";
import { OutlineTab } from "./tabs/OutlineTab";
import { MonacoEditor, detectLanguage } from "./MonacoEditor";
import { FileTree, fileTreeStyles } from "./components/FileTree";
import type { DataEntity, TabId, CallGraph } from "./shared-types";

declare const PREVIEW_DATA: Record<
  string,
  { file: string; entities: DataEntity[] }
>;

declare const CALL_GRAPH: CallGraph | null;

declare const VR_BASE: string | undefined;

function appBase(): string {
  if (typeof location !== "undefined" && location.protocol === "file:") {
    return "./";
  }
  const base = typeof VR_BASE === "string" ? VR_BASE : "";
  if (!base) return "";
  return base.endsWith("/") ? base : `${base}/`;
}

function sourceStaticPath(file: string): string {
  return `${appBase()}source/${file.replace(/\//g, "__")}.json`;
}

async function loadSourceContent(file: string): Promise<string> {
  try {
    const resp = await fetch(sourceStaticPath(file));
    if (resp.ok) {
      const json = await resp.json();
      if (typeof json.content === "string") return json.content;
    }
  } catch {
    /* static source unavailable — try dev server */
  }

  try {
    const resp = await fetch(`/api/source?file=${encodeURIComponent(file)}`);
    if (resp.ok) {
      const json = await resp.json();
      if (typeof json.content === "string") return json.content;
    }
  } catch {
    /* dev server unavailable */
  }

  return `// Source file not found: ${file}`;
}

function moduleImportKeys(file: string): Set<string> {
  const withoutExt = file.replace(/\.[^./]+$/, "");
  const parts = withoutExt.split("/");
  const keys = new Set<string>();
  for (let i = 1; i <= parts.length; i++) {
    keys.add(parts.slice(0, i).join("."));
  }
  if (parts[parts.length - 1] === "__init__") {
    keys.add(parts.slice(0, -1).join("."));
  }
  return keys;
}

function countProjectFanIn(file: string): number {
  if (!CALL_GRAPH?.files) return 0;
  const keys = moduleImportKeys(file);
  let fanIn = 0;
  for (const entry of CALL_GRAPH.files) {
    if (entry.file === file) continue;
    const importsProject = entry.imports.some((imp) => {
      const source = imp.source;
      return keys.has(source) || [...keys].some((k) => k.endsWith(`.${source}`) || k === source);
    });
    if (importsProject) fanIn++;
  }
  return fanIn;
}

function scoreDefaultEntry(key: string, data: { file: string; entities: DataEntity[] }): number {
  const file = data.file;
  const base = file.split("/").pop() || file;
  const depth = file.split("/").length;
  let score = countProjectFanIn(file) * 25;

  if (/^(llm|app|server|main|index|api|cli)\./i.test(base)) score += 45;
  if (/(?:^|\/)llm_engine\.py$/.test(file) || /(?:^|\/)engine\.py$/.test(file)) score += 35;
  if (/(?:^|\/)llm\.py$/.test(file)) score += 40;

  for (const entity of data.entities) {
    if (entity.type !== "concept") continue;
    const name = String(entity.detail.name || "");
    const kind = String(entity.detail.kind || "");
    if (kind === "class" && /^(LLM|LLMEngine|Application|App|Server)$/i.test(name)) score += 55;
    if (kind === "function" && name === "main") score += 5;
  }

  if (/^(example|demo|bench|test|tests|conftest|mock|run_)/i.test(base)) score -= 90;
  if (base === "__init__.py") score += 5;
  if (depth >= 5) score -= 15;
  score += Math.min(data.entities.length, 40) * 0.25;

  return score;
}

function pickDefaultFileKey(): string | null {
  const entries = Object.entries(PREVIEW_DATA);
  if (entries.length === 0) return null;

  try {
    const last = localStorage.getItem("vr-last-file");
    if (last) {
      const hit = entries.find(([, data]) => data.file === last);
      if (hit) return hit[0];
    }
  } catch {}

  const ranked = entries
    .map(([key, data]) => ({ key, score: scoreDefaultEntry(key, data) }))
    .sort((a, b) => b.score - a.score || PREVIEW_DATA[b.key].entities.length - PREVIEW_DATA[a.key].entities.length);

  return ranked[0]?.key ?? null;
}

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
  const [entitySearch, setEntitySearch] = useState("");
  const [entitySearchOpen, setEntitySearchOpen] = useState(false);
  const [entitySearchIdx, setEntitySearchIdx] = useState(0);
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

  const sourceLines = useMemo(() => sourceCode ? sourceCode.split("\n") : [], [sourceCode]);

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
      .filter(e => e.type === "concept" && e.detail.name)
      .map(e => ({
        startLine: e.anchor.start_line,
        endLine: e.anchor.end_line,
        name: String(e.detail.name),
        kind: String(e.detail.node_type || e.detail.kind || ""),
        summary: e.summary,
        params: e.detail.params as string[] | undefined,
        returnType: e.detail.return_type as string | undefined,
      })),
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
      } else if (e.key === "Enter" && focusedCardIdx != null && filtered[focusedCardIdx]) {
        e.preventDefault();
        onCardClick(filtered[focusedCardIdx]);
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
                           onBookmark={toggleBookmark} />;
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
            {openFiles.map((file) => {
              const fk = fileKeyMap.get(file);
              const fi = fileInfoMap.get(file);
              return (
                <div
                  key={file}
                  className={`vr-tab-item ${file === currentFile ? "vr-tab-item--active" : ""}`}
                  onClick={() => fk && selectFile(fk)}
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
          {currentFile && `${entities.filter(e => e.type === "concept").length} concepts`}
          {cursorLine > 0 && ` · Ln ${cursorLine}`}
          {currentFile && (() => {
            const fi = fileInfoMap.get(currentFile);
            return fi && fi.complexity > 0 ? ` · ${fi.complexity}cx` : "";
          })()}
          {sourceLines.length > 0 && ` · ${sourceLines.length} lines`}
          {currentFile && ` · ${sourceLanguage}`}
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
            <kbd>Ctrl+Shift+F</kbd><span>Entity search</span>
            <kbd>Ctrl+Shift+O</kbd><span>Go to symbol</span>
            <kbd>Ctrl+B</kbd><span>Toggle explorer</span>
            <kbd>Ctrl+D</kbd><span>Bookmark entity</span>
            <kbd>Ctrl+G</kbd><span>Go to line</span>
            <kbd>Ctrl+W</kbd><span>Close tab</span>
            <kbd>Ctrl+Shift+T</kbd><span>Reopen closed tab</span>
            <kbd>Alt+1-5</kbd><span>Switch tab</span>
            <kbd>Alt+←/→</kbd><span>Navigate back/forward</span>
            <kbd>[ / ]</kbd><span>Previous/next file</span>
            <kbd>?</kbd><span>Toggle this help</span>
            <kbd>Esc</kbd><span>Close overlays</span>
          </div>
          <div className="vr-help-footer">
            <code>t:concept</code> filter by type · <code>f:utils</code> filter by file
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

  .vr-resize-handle {
    width: 4px;
    cursor: col-resize;
    background: transparent;
    flex-shrink: 0;
    position: relative;
    z-index: 5;
    transition: background 0.15s;
  }

  .vr-resize-handle:hover,
  .vr-resize-handle:active {
    background: #007acc;
  }

  .vr-sidebar {
    flex-shrink: 1;
    min-width: 200px;
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

  .vr-breadcrumb-sep {
    color: #555;
    font-size: 9px;
    margin: 0 6px;
  }

  .vr-breadcrumb-label {
    font-size: 12px;
    color: #888;
    cursor: default;
  }

  .vr-breadcrumb-label--active {
    color: #ccc;
    font-weight: 500;
  }

  .vr-tab-item--active {
    background: #1e1e1e;
    color: #fff;
    border-bottom: 2px solid #007acc;
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

  .vr-monaco-hover-range {
    background: rgba(0, 122, 204, 0.06) !important;
    border-left: 2px solid rgba(0, 122, 204, 0.3);
  }

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

  .vr-picker-search,
  .vr-picker-input {
    flex: 1;
    padding: 6px 10px;
    background: #1e1e1e;
    color: #ccc;
    border: 1px solid #555;
    border-radius: 4px;
    font-size: 12px;
    font-family: inherit;
    outline: none;
    box-sizing: border-box;
    width: 100%;
  }

  .vr-picker-search:focus,
  .vr-picker-input:focus {
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
    transition: border-color 0.25s ease, box-shadow 0.3s ease, background 0.3s ease;
  }

  .vr-card:hover {
    border-color: #007acc;
    box-shadow: 0 0 0 1px rgba(0,122,204,0.15);
  }

  .vr-card--focused {
    border-color: #007acc;
    box-shadow: 0 0 0 1px rgba(0,122,204,0.3);
    background: #1a2233;
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

  .vr-card-code-preview {
    margin: 6px 0;
    border-radius: 4px;
    overflow: hidden;
    background: #1a1a1a;
    border: 1px solid #333;
  }

  .vr-card-code {
    margin: 0;
    padding: 6px 0;
    font-family: "Cascadia Code", "Fira Code", "Consolas", monospace;
    font-size: 11px;
    line-height: 1.5;
    overflow-x: auto;
  }

  .vr-card-code::-webkit-scrollbar { height: 4px; }
  .vr-card-code::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }

  .vr-card-code-line {
    display: flex;
    padding: 0 8px 0 0;
    white-space: pre;
  }

  .vr-card-code-num {
    color: #555;
    text-align: right;
    width: 32px;
    padding-right: 8px;
    flex-shrink: 0;
    user-select: none;
  }

  .vr-card-code-text {
    color: #ccc;
  }

  .vr-card-code-more {
    color: #666;
    font-style: italic;
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

  .vr-card-knowledge {
    margin: 10px 0 4px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .vr-card-knowledge--basic {
    border-left: 2px solid #4ec9b055;
    background: rgba(78, 201, 176, 0.02);
    border-radius: 0 4px 4px 0;
    padding: 8px 10px;
  }

  .vr-card-knowledge--advanced {
    border-left: 2px solid #c586c055;
    margin-top: 8px;
    background: rgba(197, 134, 192, 0.02);
    border-radius: 0 4px 4px 0;
    padding: 8px 10px;
  }

  .vr-card-krow {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 11.5px;
    line-height: 1.55;
  }

  .vr-card-klabel {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: #4ec9b0;
    min-width: 54px;
    opacity: 0.9;
  }

  .vr-card-klabel--adv { color: #c586c0; }

  .vr-card-ktext { color: #b8b8b8; }

  .vr-card-ktext--analogy {
    font-style: italic;
    color: #9cdcfe;
    opacity: 0.9;
  }

  .vr-card-ktakeaway {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .vr-card-teach-chip {
    font-size: 10.5px;
    padding: 2px 8px;
    border-radius: 10px;
    background: rgba(78, 201, 176, 0.08);
    color: #6db5a6;
    border: 1px solid rgba(78, 201, 176, 0.15);
    font-family: 'Cascadia Code', Consolas, monospace;
    line-height: 1.4;
  }

  .vr-card-teach-chip--clickable {
    cursor: pointer;
    transition: all 0.2s ease;
    color: #4ec9b0;
    border-color: rgba(78, 201, 176, 0.3);
    background: rgba(78, 201, 176, 0.1);
  }

  .vr-card-teach-chip--clickable:hover {
    background: rgba(78, 201, 176, 0.22);
    border-color: #4ec9b0;
  }

  .vr-card-teach-chip--active {
    background: rgba(78, 201, 176, 0.28);
    border-color: #4ec9b0;
    color: #7eecd8;
  }

  .vr-card-krow--takeaway {
    flex-direction: column;
    align-items: flex-start;
  }

  .vr-card-ktakeaway-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .vr-card-teach-tooltip {
    background: #1a2a2a;
    border: 1px solid rgba(78, 201, 176, 0.25);
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 11.5px;
    line-height: 1.6;
    color: #c8e0d8;
    margin-top: 6px;
  }

  .vr-teach-explain {
    margin: 0 0 8px;
    color: #d4e8e0;
    font-size: 12px;
    line-height: 1.6;
  }

  .vr-teach-rationale {
    margin: 0 0 6px;
    padding: 5px 8px;
    background: rgba(78, 201, 176, 0.06);
    border-radius: 4px;
    color: #9cc;
    font-size: 11px;
  }

  .vr-teach-rationale strong {
    color: #4ec9b0;
    font-weight: 600;
    margin-right: 4px;
  }

  .vr-teach-crosslang {
    margin: 0 0 6px;
    padding: 5px 8px;
    background: rgba(156, 220, 254, 0.06);
    border-radius: 4px;
    color: #9cc8e8;
    font-size: 11px;
    font-family: 'Cascadia Code', Consolas, monospace;
  }

  .vr-teach-crosslang strong {
    color: #9cdcfe;
    font-weight: 600;
    margin-right: 4px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .vr-teach-gotcha {
    margin: 0;
    padding: 5px 8px;
    background: rgba(206, 145, 120, 0.08);
    border-left: 2px solid rgba(206, 145, 120, 0.4);
    border-radius: 0 4px 4px 0;
    color: #e8c0a8;
    font-size: 11px;
  }

  .vr-card-advanced-toggle {
    background: rgba(197, 134, 192, 0.06);
    border: 1px solid rgba(197, 134, 192, 0.2);
    border-radius: 4px;
    color: #c586c0;
    font-size: 10px;
    cursor: pointer;
    padding: 4px 10px;
    text-align: left;
    opacity: 0.8;
    transition: all 0.15s;
    margin-top: 6px;
  }

  .vr-card-advanced-toggle:hover {
    opacity: 1;
    background: rgba(197, 134, 192, 0.12);
    border-color: rgba(197, 134, 192, 0.4);
  }

  .vr-card-advanced-toggle--collapse {
    margin-bottom: 6px;
    margin-top: 0;
  }

  .vr-card-krow--analogy {
    margin-top: 2px;
    padding-top: 4px;
    border-top: 1px solid #3c3c3c;
  }

  .vr-concept-group-header:hover {
    background: rgba(255,255,255,0.04);
  }

  .vr-no-cards {
    text-align: center;
    padding: 32px 20px;
    color: #8b8b8b;
    font-size: 12px;
  }
`;

