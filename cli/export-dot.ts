/**
 * Export call graph as DOT (Graphviz) format.
 * Usage: npx tsx export-dot.ts <project-root> [--focus <file>] > graph.dot
 *        dot -Tpng graph.dot -o graph.png
 */
import * as fs from "fs";
import * as path from "path";

interface CallGraphFile {
  file: string;
  imports: Array<{ source: string; names: string[] }>;
  exports: string[];
}

function main() {
  const args = process.argv.slice(2);
  const focusIdx = args.indexOf("--focus");
  const focusFile = focusIdx >= 0 ? args[focusIdx + 1] : null;
  const useClusters = args.includes("--clusters");
  const positional = args.filter((a, i) =>
    !a.startsWith("--") && (focusIdx < 0 || (i !== focusIdx + 1))
  );
  const projectRoot = positional[0] || process.cwd();
  const cgPath = path.join(projectRoot, ".vibe-reading", "global", "call-graph.json");

  if (!fs.existsSync(cgPath)) {
    console.error("No call-graph.json found. Run analyze first.");
    process.exit(1);
  }

  const cg: { files: CallGraphFile[] } = JSON.parse(fs.readFileSync(cgPath, "utf-8"));

  const lines: string[] = [
    'digraph CallGraph {',
    '  rankdir=LR;',
    '  node [shape=box, style=filled, fillcolor="#2d2d2e", fontcolor="#d4d4d4", fontname="monospace", fontsize=10];',
    '  edge [color="#555"];',
  ];

  const nodeId = (file: string) => file.replace(/[^a-zA-Z0-9]/g, "_");

  const isFocused = (file: string) => focusFile && file.includes(focusFile);
  const isRelevant = (file: string) => {
    if (!focusFile) return true;
    if (isFocused(file)) return true;
    const focusEntry = cg.files.find(f => isFocused(f.file));
    if (!focusEntry) return false;
    for (const imp of focusEntry.imports) {
      const resolved = cg.files.find(t => t.file.endsWith(imp.source.replace(/^\.\//, "")));
      if (resolved && resolved.file === file) return true;
    }
    return cg.files.some(f => f.file === file && f.imports.some(imp => {
      const resolved = cg.files.find(t => isFocused(t.file));
      return resolved && (imp.source.replace(/^\.\//, "") === resolved.file || resolved.file.endsWith(imp.source.replace(/^\.\//, "")));
    }));
  };

  if (useClusters) {
    const dirs = new Map<string, CallGraphFile[]>();
    for (const f of cg.files) {
      if (!isRelevant(f.file)) continue;
      const dir = path.dirname(f.file) || ".";
      if (!dirs.has(dir)) dirs.set(dir, []);
      dirs.get(dir)!.push(f);
    }
    let ci = 0;
    for (const [dir, dirFiles] of dirs) {
      lines.push(`  subgraph cluster_${ci++} {`);
      lines.push(`    label="${dir}";`);
      lines.push(`    style=dashed; color="#555";`);
      for (const f of dirFiles) {
        const id = nodeId(f.file);
        const label = f.file.split("/").pop() || f.file;
        const exportCount = f.exports.length;
        const highlight = isFocused(f.file) ? ', fillcolor="#1a3a5a", color="#007acc"' : "";
        lines.push(`    ${id} [label="${label}\\n(${exportCount} exports)"${highlight}];`);
      }
      lines.push(`  }`);
    }
  } else {
    for (const f of cg.files) {
      if (!isRelevant(f.file)) continue;
      const id = nodeId(f.file);
      const label = f.file.split("/").pop() || f.file;
      const exportCount = f.exports.length;
      const highlight = isFocused(f.file) ? ', fillcolor="#1a3a5a", color="#007acc"' : "";
      lines.push(`  ${id} [label="${label}\\n(${exportCount} exports)"${highlight}];`);
    }
  }

  for (const f of cg.files) {
    for (const imp of f.imports) {
      if (!imp.source.startsWith(".")) continue;
      const target = cg.files.find(t => {
        const src = imp.source.replace(/^\.\//, "");
        return t.file.endsWith(src) || t.file.endsWith(src + ".ts") || t.file.endsWith(src + ".js") || t.file.endsWith(src + ".tsx");
      });
      if (target) {
        const label = imp.names.length > 3
          ? `${imp.names.slice(0, 3).join(", ")}...`
          : imp.names.join(", ");
        lines.push(`  ${nodeId(f.file)} -> ${nodeId(target.file)} [label="${label}"];`);
      }
    }
  }

  lines.push('}');
  console.log(lines.join("\n"));
}

main();
