import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    monaco: typeof import("monaco-editor");
  }
}

interface EntityMarker {
  startLine: number;
  endLine: number;
  type: string;
}

interface HoverInfo {
  startLine: number;
  endLine: number;
  name: string;
  kind: string;
  summary: string;
  params?: string[];
  returnType?: string;
}

interface MonacoEditorProps {
  code: string;
  language: string;
  highlightRange?: { startLine: number; endLine: number } | null;
  entityMarkers?: EntityMarker[];
  onCursorLine?: (line: number) => void;
  onVisibleRange?: (startLine: number, endLine: number) => void;
  hoverInfos?: HoverInfo[];
  hoverRange?: { startLine: number; endLine: number } | null;
  onHoverLine?: (line: number | null) => void;
  editorTheme?: string;
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    rb: "ruby",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    scala: "scala",
    sh: "shell",
    bash: "shell",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    html: "html",
    css: "css",
    scss: "scss",
    less: "less",
    xml: "xml",
    sql: "sql",
    toml: "ini",
    cfg: "ini",
    ini: "ini",
  };
  return map[ext] || "plaintext";
}

export { detectLanguage };

export function MonacoEditor({ code, language, highlightRange, entityMarkers, onCursorLine, onVisibleRange, hoverInfos, hoverRange, onHoverLine, editorTheme = "vs-dark" }: MonacoEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ReturnType<typeof window.monaco.editor.create> | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const markerDecorationsRef = useRef<string[]>([]);
  const hoverDecorationsRef = useRef<string[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onReady = () => setReady(true);
    if (window.monaco) {
      setReady(true);
      return;
    }
    window.addEventListener("monaco-ready", onReady);
    const check = setInterval(() => {
      if (window.monaco) {
        clearInterval(check);
        setReady(true);
      }
    }, 100);
    const timeout = setTimeout(() => {
      clearInterval(check);
      if (!window.monaco) setFailed(true);
    }, 20000);
    return () => {
      window.removeEventListener("monaco-ready", onReady);
      clearInterval(check);
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current) return;

    if (!editorRef.current) {
      editorRef.current = window.monaco.editor.create(containerRef.current, {
        value: code,
        language,
        theme: editorTheme,
        readOnly: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        fontSize: 13,
        fontFamily: "'Cascadia Code', Consolas, 'Courier New', monospace",
        lineNumbers: "on",
        renderLineHighlight: "none",
        folding: true,
        wordWrap: "off",
        automaticLayout: true,
        contextmenu: false,
        domReadOnly: true,
      });
    } else {
      const model = editorRef.current.getModel();
      if (model) {
        window.monaco.editor.setModelLanguage(model, language);
        model.setValue(code);
      }
    }

    return () => {
      // Don't dispose on re-render, only on unmount
    };
  }, [ready, code, language]);

  useEffect(() => {
    if (ready && window.monaco) {
      window.monaco.editor.setTheme(editorTheme);
    }
  }, [ready, editorTheme]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !onCursorLine) return;
    const disposable = editor.onDidChangeCursorPosition((e: any) => {
      onCursorLine(e.position.lineNumber);
    });
    return () => disposable.dispose();
  }, [ready, onCursorLine]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !onVisibleRange) return;
    const report = () => {
      const ranges = editor.getVisibleRanges();
      if (ranges.length > 0) {
        onVisibleRange(ranges[0].startLineNumber, ranges[ranges.length - 1].endLineNumber);
      }
    };
    report();
    const disposable = editor.onDidScrollChange(report);
    return () => disposable.dispose();
  }, [ready, onVisibleRange]);

  useEffect(() => {
    if (!ready || !hoverInfos?.length) return;
    const model = editorRef.current?.getModel();
    if (!model) return;
    const provider = window.monaco.languages.registerHoverProvider(language, {
      provideHover(_model: any, position: any) {
        if (_model !== model) return null;
        const line = position.lineNumber;
        const matches = hoverInfos.filter(h => line >= h.startLine && line <= h.endLine);
        if (matches.length === 0) return null;
        const contents = matches.map(m => {
          let val = `**${m.kind}** \`${m.name}\`\n\n${m.summary}`;
          if (m.params?.length) val += `\n\n\`(${m.params.join(", ")})\``;
          if (m.returnType) val += ` → \`${m.returnType}\``;
          return { value: val };
        });
        return {
          range: new window.monaco.Range(line, 1, line, 1),
          contents,
        };
      },
    });
    return () => provider.dispose();
  }, [ready, hoverInfos, language]);

  useEffect(() => {
    return () => {
      editorRef.current?.dispose();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !ready) return;

    if (decorationsRef.current.length > 0) {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
    }

    if (highlightRange && highlightRange.startLine > 0) {
      const { startLine, endLine } = highlightRange;
      decorationsRef.current = editor.deltaDecorations([], [
        {
          range: new window.monaco.Range(startLine, 1, endLine, 1),
          options: {
            isWholeLine: true,
            className: "vr-monaco-highlight",
            glyphMarginClassName: "vr-monaco-glyph",
          },
        },
      ]);
      editor.revealLineInCenter(startLine);
    }
  }, [highlightRange, ready]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !ready || !entityMarkers?.length) {
      if (editor && markerDecorationsRef.current.length > 0) {
        markerDecorationsRef.current = editor.deltaDecorations(markerDecorationsRef.current, []);
      }
      return;
    }

    const TYPE_CLASSES: Record<string, string> = {
      concept: "vr-marker-concept",
      flow: "vr-marker-flow",
      history: "vr-marker-history",
      jump: "vr-marker-jump",
    };

    const decorations = entityMarkers.map(m => ({
      range: new window.monaco.Range(m.startLine, 1, m.startLine, 1),
      options: {
        isWholeLine: false,
        linesDecorationsClassName: TYPE_CLASSES[m.type] || "vr-marker-concept",
      },
    }));

    markerDecorationsRef.current = editor.deltaDecorations(
      markerDecorationsRef.current,
      decorations
    );
  }, [entityMarkers, ready]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !ready) return;
    if (!hoverRange) {
      if (hoverDecorationsRef.current.length > 0) {
        hoverDecorationsRef.current = editor.deltaDecorations(hoverDecorationsRef.current, []);
      }
      return;
    }
    hoverDecorationsRef.current = editor.deltaDecorations(hoverDecorationsRef.current, [
      {
        range: new window.monaco.Range(hoverRange.startLine, 1, hoverRange.endLine, 1),
        options: { isWholeLine: true, className: "vr-monaco-hover-range" },
      },
    ]);
  }, [hoverRange, ready]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !ready || !onHoverLine) return;
    const disposable = editor.onMouseMove((e: any) => {
      const line = e.target?.position?.lineNumber ?? null;
      onHoverLine(line);
    });
    const leaveDisposable = editor.onMouseLeave(() => onHoverLine(null));
    return () => { disposable.dispose(); leaveDisposable.dispose(); };
  }, [ready, onHoverLine]);

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
      {!ready && !failed && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          color: "#666", fontSize: 13, fontFamily: "monospace", background: "#1e1e1e",
        }}>
          Loading editor...
        </div>
      )}
      {failed && (
        <pre style={{
          position: "absolute", inset: 0, margin: 0, padding: 12,
          overflow: "auto", background: "#1e1e1e", color: "#ccc",
          fontSize: 13, fontFamily: "'Cascadia Code', Consolas, monospace", lineHeight: 1.5,
        }}>
          {code}
        </pre>
      )}
      <div ref={containerRef} style={{ width: "100%", height: "100%", visibility: ready ? "visible" : "hidden" }} />
    </div>
  );
}
