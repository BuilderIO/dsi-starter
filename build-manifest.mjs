#!/usr/bin/env node
// Scans .builder/output/ for *.html files and writes ./manifest.json at the project root.
//
// Each HTML file may declare its own metadata via sidecar comments near the top:
//   <!-- @group Tokens -->
//   <!-- @title Color Palette -->
// Sidecar values win. Any custom title/group set in an existing manifest.json is preserved
// as a fallback when no sidecar is present. Groups and items are emitted in alphabetical order.
//
// Usage: node build-manifest.mjs
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(here, ".builder", "output");
const manifestPath = resolve(here, "manifest.json");

const DEFAULT_GROUP = "Previews";
const SIDECAR_SCAN_BYTES = 2048;

function prettify(file) {
  return file
    .replace(/\.html?$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

async function readSidecar(file) {
  try {
    const raw = await readFile(join(outputDir, file), "utf8");
    const head = raw.slice(0, SIDECAR_SCAN_BYTES);
    const meta = {};
    const re = /<!--\s*@(group|title)\s+([\s\S]*?)\s*-->/gi;
    let m;
    while ((m = re.exec(head))) {
      const key = m[1].toLowerCase();
      const value = m[2].trim();
      if (value) meta[key] = value;
    }
    return meta;
  } catch {
    return {};
  }
}

async function readExistingManifest() {
  try {
    const raw = await readFile(manifestPath, "utf8");
    const data = JSON.parse(raw);
    const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    const byFile = new Map();
    for (const it of list) {
      if (typeof it === "string") {
        byFile.set(it, {});
      } else if (it && typeof it.file === "string") {
        byFile.set(it.file, { title: it.title, group: it.group });
      }
    }
    return { byFile };
  } catch {
    return { byFile: new Map() };
  }
}

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

await mkdir(outputDir, { recursive: true });

const [entries, existing] = await Promise.all([
  readdir(outputDir, { withFileTypes: true }),
  readExistingManifest(),
]);

const files = entries
  .filter((e) => e.isFile() && /\.html?$/i.test(e.name))
  .map((e) => e.name)
  .sort();

const sidecars = await Promise.all(files.map(readSidecar));

const items = files.map((file, i) => {
  const sidecar = sidecars[i];
  const prev = existing.byFile.get(file) || {};
  return {
    file,
    title: sidecar.title || prev.title || prettify(file),
    group: sidecar.group || prev.group || DEFAULT_GROUP,
  };
});

const groups = [...new Set(items.map((it) => it.group))].sort((a, b) => collator.compare(a, b));

items.sort((a, b) => {
  const g = collator.compare(a.group, b.group);
  if (g !== 0) return g;
  return collator.compare(a.title, b.title);
});

const output = { groups, items };

await writeFile(manifestPath, JSON.stringify(output, null, 2) + "\n");
console.log(
  `Wrote ${manifestPath} with ${items.length} entr${items.length === 1 ? "y" : "ies"}.`,
);
