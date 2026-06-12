import { useState, useMemo, useCallback, useRef, useEffect } from "react";

interface FileTreeProps {
  files: { key: string; file: string; count: number }[];
  currentFile: string | null;
  onSelectFile: (key: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
  fileKey?: string;
  count?: number;
  totalCount: number;
}

function buildTree(files: { key: string; file: string; count: number }[]): TreeNode {
  const root: TreeNode = { name: "", path: "", children: [], totalCount: 0 };

  for (const f of files) {
    const parts = f.file.split("/");
    let current = root;
    let pathSoFar = "";

    for (let i = 0; i < parts.length; i++) {
      pathSoFar = pathSoFar ? `${pathSoFar}/${parts[i]}` : parts[i];
      const isLeaf = i === parts.length - 1;

      let child = current.children.find((c) => c.name === parts[i]);
      if (!child) {
        child = {
          name: parts[i],
          path: pathSoFar,
          children: [],
          totalCount: 0,
        };
        current.children.push(child);
      }

      if (isLeaf) {
        child.fileKey = f.key;
        child.count = f.count;
      }
      current = child;
    }
  }

  function computeTotals(node: TreeNode): number {
    let total = node.count || 0;
    for (const child of node.children) {
      total += computeTotals(child);
    }
    node.totalCount = total;
    return total;
  }
  computeTotals(root);

  function sortChildren(node: TreeNode) {
    node.children.sort((a, b) => {
      const aDir = a.children.length > 0 ? 0 : 1;
      const bDir = b.children.length > 0 ? 0 : 1;
      if (aDir !== bDir) return aDir - bDir;
      return a.name.localeCompare(b.name);
    });
    for (const c of node.children) sortChildren(c);
  }
  sortChildren(root);

  function collapse(node: TreeNode): TreeNode {
    if (node.children.length === 1 && !node.fileKey && node.children[0].children.length > 0) {
      const child = node.children[0];
      return collapse({
        ...child,
        name: node.name ? `${node.name}/${child.name}` : child.name,
      });
    }
    return { ...node, children: node.children.map(collapse) };
  }
  return collapse(root);
}

function collectAllDirs(node: TreeNode): Set<string> {
  const dirs = new Set<string>();
  if (node.children.length > 0) {
    dirs.add(node.path);
    for (const c of node.children) {
      for (const d of collectAllDirs(c)) dirs.add(d);
    }
  }
  return dirs;
}

/** Filter tree to only nodes matching query; returns null if nothing matches. */
function filterTree(node: TreeNode, query: string): TreeNode | null {
  const q = query.toLowerCase();

  if (node.children.length === 0) {
    return node.name.toLowerCase().includes(q) ? node : null;
  }

  const filteredChildren: TreeNode[] = [];
  for (const child of node.children) {
    const filtered = filterTree(child, query);
    if (filtered) filteredChildren.push(filtered);
  }

  if (filteredChildren.length === 0 && !node.name.toLowerCase().includes(q)) {
    return null;
  }

  return { ...node, children: filteredChildren };
}

function TreeItem({
  node,
  depth,
  currentFile,
  expanded,
  onToggle,
  onSelect,
  highlight,
}: {
  node: TreeNode;
  depth: number;
  currentFile: string | null;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (key: string) => void;
  highlight?: string;
}) {
  const isDir = node.children.length > 0;
  const isOpen = expanded.has(node.path);
  const isActive = node.fileKey && currentFile === node.path;

  const nameEl = highlight ? highlightMatch(node.name, highlight) : node.name;

  return (
    <>
      <div
        className={`vr-tree-item${isActive ? " vr-tree-item--active" : ""}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => {
          if (isDir) {
            onToggle(node.path);
          } else if (node.fileKey) {
            onSelect(node.fileKey);
          }
        }}
      >
        <span className="vr-tree-icon">
          {isDir ? (isOpen ? "▾" : "▸") : ""}
        </span>
        <span className={`vr-tree-name${isDir ? " vr-tree-dir" : ""}`}>
          {nameEl}
        </span>
        {(node.count ?? 0) > 0 && (
          <span className="vr-tree-count">{node.count}</span>
        )}
      </div>
      {isDir && isOpen &&
        node.children.map((child) => (
          <TreeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            currentFile={currentFile}
            expanded={expanded}
            onToggle={onToggle}
            onSelect={onSelect}
            highlight={highlight}
          />
        ))}
    </>
  );
}

function highlightMatch(text: string, query: string): JSX.Element {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="vr-tree-match">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

export function FileTree({ files, currentFile, onSelectFile }: FileTreeProps) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [filter, setFilter] = useState("");
  const filterRef = useRef<HTMLInputElement>(null);

  const allDirs = useMemo(() => collectAllDirs(tree), [tree]);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(allDirs));

  const displayTree = useMemo(() => {
    if (!filter.trim()) return tree;
    return filterTree(tree, filter.trim());
  }, [tree, filter]);

  // When filtering, auto-expand all dirs so matches are visible
  const displayExpanded = useMemo(() => {
    if (!filter.trim()) return expanded;
    if (!displayTree) return expanded;
    return collectAllDirs(displayTree);
  }, [filter, displayTree, expanded]);

  const onToggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setExpanded(new Set(allDirs)), [allDirs]);
  const collapseAll = useCallback(() => setExpanded(new Set<string>()), []);

  // Focus filter on Ctrl+Shift+E
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "E") {
        e.preventDefault();
        filterRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="vr-tree">
      <div className="vr-tree-header">
        <span className="vr-tree-header-label">Explorer</span>
        <div className="vr-tree-header-actions">
          <button
            className="vr-tree-btn"
            onClick={expandAll}
            title="Expand all"
          >⊞</button>
          <button
            className="vr-tree-btn"
            onClick={collapseAll}
            title="Collapse all"
          >⊟</button>
          <span className="vr-tree-header-count">{files.length}</span>
        </div>
      </div>
      <div className="vr-tree-filter">
        <input
          ref={filterRef}
          type="text"
          className="vr-tree-filter-input"
          placeholder="Filter files..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {filter && (
          <button
            className="vr-tree-filter-clear"
            onClick={() => setFilter("")}
          >×</button>
        )}
      </div>
      <div className="vr-tree-list">
        {displayTree ? (
          displayTree.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={0}
              currentFile={currentFile}
              expanded={displayExpanded}
              onToggle={onToggle}
              onSelect={onSelectFile}
              highlight={filter.trim() || undefined}
            />
          ))
        ) : (
          <div className="vr-tree-empty">No files match "{filter}"</div>
        )}
      </div>
    </div>
  );
}
