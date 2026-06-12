import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

const ctx = await esbuild.context({
  entryPoints: ["src/index.tsx"],
  bundle: true,
  outfile: "out/viewer.js",
  format: "iife",
  target: "es2022",
  minify: !watch,
  sourcemap: watch,
  loader: { ".tsx": "tsx", ".ts": "ts", ".css": "css" },
});

if (watch) {
  await ctx.watch();
  console.log("Watching viewer...");
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
