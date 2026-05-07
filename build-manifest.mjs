#!/usr/bin/env node
// Scans .builder/output/ for *.html files and writes ./manifest.json at the project root.
// Usage: node build-manifest.mjs
import { readdir, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(here, ".builder", "output");
const manifestPath = resolve(here, "manifest.json");

function prettify(file) {
  return file
    .replace(/\.html?$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

await mkdir(outputDir, { recursive: true });

const entries = await readdir(outputDir, { withFileTypes: true });
const files = entries
  .filter((e) => e.isFile() && /\.html?$/i.test(e.name))
  .map((e) => e.name)
  .sort();

const items = files.map((file) => ({
  file,
  title: prettify(file),
  group: "Previews",
}));

await writeFile(manifestPath, JSON.stringify({ items }, null, 2) + "\n");
console.log(
  `Wrote ${manifestPath} with ${items.length} entr${items.length === 1 ? "y" : "ies"}.`,
);
