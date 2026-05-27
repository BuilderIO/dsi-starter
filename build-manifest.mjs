#!/usr/bin/env node
// Scans .builder/output/ for *.html files and writes ./manifest.json at the project root.
//
// Each HTML file may declare its own metadata via sidecar comments near the top:
//   <!-- @group Tokens -->
//   <!-- @title Color Palette -->
//   <!-- @order 10 -->
// Sidecar values win. Any custom title/group set in an existing manifest.json is preserved
// as a fallback when no sidecar is present.
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
    const re = /<!--\s*@(group|title|order)\s+([\s\S]*?)\s*-->/gi;
    let m;
    while ((m = re.exec(head))) {
      const key = m[1].toLowerCase();
      const value = m[2].trim();
      if (!value) continue;
      if (key === "order") {
        const n = Number(value);
        if (Number.isFinite(n)) meta.order = n;
      } else {
        meta[key] = value;
      }
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
    return {
      byFile,
      groups: Array.isArray(data?.groups) ? data.groups.filter((g) => typeof g === "string") : null,
    };
  } catch {
    return { byFile: new Map(), groups: null };
  }
}

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
  const item = {
    file,
    title: sidecar.title || prev.title || prettify(file),
    group: sidecar.group || prev.group || DEFAULT_GROUP,
  };
  if (typeof sidecar.order === "number") item.order = sidecar.order;
  return item;
});

const discoveredGroups = [];
const seen = new Set();
for (const it of items) {
  if (!seen.has(it.group)) {
    seen.add(it.group);
    discoveredGroups.push(it.group);
  }
}

const manualGroups = existing.groups && existing.groups.length ? existing.groups : [];
const mergedGroups = [...manualGroups];
for (const g of discoveredGroups) {
  if (!mergedGroups.includes(g)) mergedGroups.push(g);
}

const groupIndex = new Map(mergedGroups.map((g, i) => [g, i]));
items.sort((a, b) => {
  const ga = groupIndex.get(a.group) ?? Number.MAX_SAFE_INTEGER;
  const gb = groupIndex.get(b.group) ?? Number.MAX_SAFE_INTEGER;
  if (ga !== gb) return ga - gb;
  const oa = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
  const ob = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
  if (oa !== ob) return oa - ob;
  return a.file.localeCompare(b.file);
});

const output = mergedGroups.length ? { groups: mergedGroups, items } : { items };

await writeFile(manifestPath, JSON.stringify(output, null, 2) + "\n");
console.log(
  `Wrote ${manifestPath} with ${items.length} entr${items.length === 1 ? "y" : "ies"}.`,
);
