/**
 * Export call graph as DOT (Graphviz) format.
 * Usage: npx tsx export-dot.ts <project-root> > graph.dot
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
  const projectRoot = process.argv[2] || process.cwd();
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

  for (const f of cg.files) {
    const id = nodeId(f.file);
    const label = f.file.split("/").pop() || f.file;
    const exportCount = f.exports.length;
    lines.push(`  ${id} [label="${label}\\n(${exportCount} exports)"];`);
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
