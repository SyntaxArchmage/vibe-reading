import { useState, useMemo, useEffect } from "react";

interface FileTreeProps {
  files: { key: string; file: string; count: number; commits: number }[];
  currentFile: string | null;
  onSelect: (key: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  children: Map<string, TreeNode>;
  fileKey?: string;
  count: number;
  commits: number;
}

function buildTree(files: { key: string; file: string; count: number; commits: number }[]): TreeNode {
  const root: TreeNode = { name: "", path: "", children: new Map(), count: 0, commits: 0 };

  for (const f of files) {
    const parts = f.file.split("/");
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!node.children.has(part)) {
        node.children.set(part, {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          children: new Map(),
          count: 0,
          commits: 0,
        });
      }
      node = node.children.get(part)!;
    }
    node.fileKey = f.key;
    node.count = f.count;
    node.commits = f.commits;
  }

  return root;
}

function collapseRoot(root: TreeNode): TreeNode {
  if (root.children.size === 1 && !root.fileKey) {
    const [child] = root.children.values();
    if (child.children.size > 0 && !child.fileKey) {
      return collapseRoot(child);
    }
  }
  return root;
}

function heatColor(commits: number, maxCommits: number): string | null {
  if (commits <= 0 || maxCommits <= 0) return null;
  const ratio = commits / maxCommits;
  if (ratio < 0.25) return "#4ec9b0";
  if (ratio < 0.5) return "#dcdcaa";
  if (ratio < 0.75) return "#ce9178";
  return "#f44747";
}

function DirNode({
  node,
  currentFile,
  onSelect,
  depth,
  maxCommits,
}: {
  node: TreeNode;
  currentFile: string | null;
  onSelect: (key: string) => void;
  depth: number;
  maxCommits: number;
}) {
  const containsCurrent = currentFile ? currentFile.startsWith(node.path + "/") || currentFile === node.path : false;
  const [open, setOpen] = useState(depth < 2 || containsCurrent);

  useEffect(() => {
    if (containsCurrent && !open) setOpen(true);
  }, [currentFile]);

  const dirs: TreeNode[] = [];
  const fileNodes: TreeNode[] = [];
  for (const child of node.children.values()) {
    if (child.children.size > 0 && !child.fileKey) {
      dirs.push(child);
    } else {
      fileNodes.push(child);
    }
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name));
  fileNodes.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      {node.name && (
        <div
          className="vr-tree-dir"
          style={{ paddingLeft: depth * 12 + 4 }}
          onClick={() => setOpen(!open)}
        >
          <span className={`vr-tree-arrow ${open ? "vr-tree-arrow--open" : ""}`}>
            &#x25B8;
          </span>
          <span className="vr-tree-dir-name">{node.name}</span>
        </div>
      )}
      {(open || !node.name) && (
        <>
          {dirs.map((d) => (
            <DirNode
              key={d.path}
              node={d}
              currentFile={currentFile}
              onSelect={onSelect}
              depth={node.name ? depth + 1 : depth}
              maxCommits={maxCommits}
            />
          ))}
          {fileNodes.map((f) => {
            const heat = heatColor(f.commits, maxCommits);
            return (
              <div
                key={f.path}
                className={`vr-tree-file ${
                  currentFile === f.path ? "vr-tree-file--active" : ""
                }`}
                style={{ paddingLeft: (node.name ? depth + 1 : depth) * 12 + 4 }}
                onClick={() => f.fileKey && onSelect(f.fileKey)}
                title={f.commits > 0 ? `${f.commits} commits` : undefined}
              >
                {heat && <span className="vr-tree-heat" style={{ background: heat }} />}
                <span className="vr-tree-file-name">{f.name}</span>
                {f.count > 0 && (
                  <span className="vr-tree-file-count">{f.count}</span>
                )}
              </div>
            );
          })}
        </>
      )}
    </>
  );
}

export function FileTree({ files, currentFile, onSelect }: FileTreeProps) {
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    if (!filter.trim()) return files;
    const q = filter.toLowerCase();
    return files.filter(f => f.file.toLowerCase().includes(q));
  }, [files, filter]);
  const tree = useMemo(() => collapseRoot(buildTree(filtered)), [filtered]);
  const maxCommits = useMemo(() => Math.max(...files.map(f => f.commits), 1), [files]);

  return (
    <div className="vr-tree">
      <div className="vr-tree-header">
        EXPLORER
        <span className="vr-tree-header-count">{filtered.length} files</span>
      </div>
      <div className="vr-tree-filter">
        <input
          type="text"
          placeholder="Filter files..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="vr-tree-filter-input"
        />
      </div>
      <div className="vr-tree-list">
        <DirNode node={tree} currentFile={currentFile} onSelect={onSelect} depth={0} maxCommits={maxCommits} />
      </div>
    </div>
  );
}

export const fileTreeStyles = `
  .vr-tree {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .vr-tree-header {
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: #888;
    border-bottom: 1px solid #3c3c3c;
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .vr-tree-header-count {
    font-weight: 400;
    font-size: 10px;
    opacity: 0.7;
    letter-spacing: 0;
  }

  .vr-tree-filter {
    padding: 4px 8px;
    border-bottom: 1px solid #3c3c3c;
    flex-shrink: 0;
  }

  .vr-tree-filter-input {
    width: 100%;
    background: #3c3c3c;
    border: 1px solid #555;
    color: #d4d4d4;
    padding: 3px 6px;
    border-radius: 3px;
    font-size: 11px;
    outline: none;
    box-sizing: border-box;
  }

  .vr-tree-filter-input:focus { border-color: #007acc; }

  .vr-tree-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }

  .vr-tree-list::-webkit-scrollbar { width: 6px; }
  .vr-tree-list::-webkit-scrollbar-thumb { background: #555; border-radius: 3px; }

  .vr-tree-dir {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 4px;
    font-size: 12px;
    color: #ccc;
    cursor: pointer;
    user-select: none;
  }

  .vr-tree-dir:hover { background: rgba(255,255,255,0.04); }

  .vr-tree-arrow {
    font-size: 9px;
    color: #888;
    transition: transform 0.15s;
    width: 12px;
    text-align: center;
    flex-shrink: 0;
  }

  .vr-tree-arrow--open { transform: rotate(90deg); }

  .vr-tree-dir-name {
    font-weight: 500;
  }

  .vr-tree-file {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 4px 2px 20px;
    font-size: 12px;
    color: #bbb;
    cursor: pointer;
    user-select: none;
  }

  .vr-tree-file:hover { background: rgba(255,255,255,0.04); }

  .vr-tree-file--active {
    background: rgba(0,122,204,0.2);
    color: #fff;
  }

  .vr-tree-file-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .vr-tree-file-count {
    flex-shrink: 0;
    font-size: 10px;
    color: #666;
    margin-left: 4px;
  }

  .vr-tree-heat {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-right: 4px;
  }
`;
