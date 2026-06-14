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

interface MonacoEditorProps {
  code: string;
  language: string;
  highlightRange?: { startLine: number; endLine: number } | null;
  entityMarkers?: EntityMarker[];
  onCursorLine?: (line: number) => void;
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

export function MonacoEditor({ code, language, highlightRange, entityMarkers, onCursorLine }: MonacoEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ReturnType<typeof window.monaco.editor.create> | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const markerDecorationsRef = useRef<string[]>([]);
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
    if (!editor || !onCursorLine) return;
    const disposable = editor.onDidChangeCursorPosition((e: any) => {
      onCursorLine(e.position.lineNumber);
    });
    return () => disposable.dispose();
  }, [ready, onCursorLine]);

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

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
      {!ready && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          color: "#666", fontSize: 13, fontFamily: "monospace", background: "#1e1e1e",
        }}>
          Loading editor...
        </div>
      )}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
