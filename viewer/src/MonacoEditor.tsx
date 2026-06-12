import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    monaco: typeof import("monaco-editor");
  }
}

interface MonacoEditorProps {
  code: string;
  language: string;
  highlightRange?: { startLine: number; endLine: number } | null;
  hoverRange?: { startLine: number; endLine: number } | null;
  onHoverLine?: (line: number | null) => void;
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

export function MonacoEditor({ code, language, highlightRange, hoverRange, onHoverLine }: MonacoEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ReturnType<typeof window.monaco.editor.create> | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const hoverDecorationsRef = useRef<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!window.monaco) {
      const check = setInterval(() => {
        if (window.monaco) {
          clearInterval(check);
          setReady(true);
        }
      }, 100);
      return () => clearInterval(check);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current) return;

    if (!editorRef.current) {
      editorRef.current = window.monaco.editor.create(containerRef.current, {
        value: code,
        language,
        theme: "vs-dark",
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
    const editor = editorRef.current;
    if (!editor || !ready || !onHoverLine) return;

    let lastLine: number | null = null;
    const disposable = editor.onMouseMove((e: any) => {
      const line = e.target?.position?.lineNumber ?? null;
      if (line !== lastLine) {
        lastLine = line;
        onHoverLine(line);
      }
    });

    const leaveDisposable = editor.onMouseLeave(() => {
      if (lastLine !== null) {
        lastLine = null;
        onHoverLine(null);
      }
    });

    return () => {
      disposable.dispose();
      leaveDisposable.dispose();
    };
  }, [ready, onHoverLine]);

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
    if (!editor || !ready) return;

    if (hoverDecorationsRef.current.length > 0) {
      hoverDecorationsRef.current = editor.deltaDecorations(hoverDecorationsRef.current, []);
    }

    if (hoverRange && hoverRange.startLine > 0) {
      hoverDecorationsRef.current = editor.deltaDecorations([], [
        {
          range: new window.monaco.Range(hoverRange.startLine, 1, hoverRange.endLine, 1),
          options: {
            isWholeLine: true,
            className: "vr-monaco-hover-range",
            overviewRuler: {
              color: "rgba(0,122,204,0.4)",
              position: window.monaco.editor.OverviewRulerLane.Right,
            },
          },
        },
      ]);
    }
  }, [hoverRange, ready]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", overflow: "hidden" }}
    />
  );
}
