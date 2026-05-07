// DSI Lite preview shell — vanilla JS, no deps.
//
// HTML previews live in ./.builder/output/. The manifest at ./manifest.json lists them as
// either a flat array (e.g. ["buttons.html", "colors.html"]) or:
//   { "items": [{ "file": "buttons.html", "title": "Buttons", "group": "Components" }, ...] }

const navEl = document.getElementById("nav");
const framesEl = document.getElementById("frames");
const emptyEl = document.getElementById("empty");
const titleEl = document.getElementById("current-title");
const pathEl = document.getElementById("current-path");
const openNew = document.getElementById("open-new");
const countEl = document.getElementById("count");
const searchEl = document.getElementById("search");
const refreshEl = document.getElementById("refresh");
const viewportBtns = document.querySelectorAll(".viewport-toggle button");
const themeToggle = document.getElementById("theme-toggle");

const THEME_KEY = "dsi-preview-theme";
const THEME_ORDER = ["auto", "light", "dark"];

function applyTheme(mode) {
  if (mode === "auto") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", mode);
  }
}

function currentTheme() {
  return localStorage.getItem(THEME_KEY) || "auto";
}

applyTheme(currentTheme());

let items = [];
let activeFile = null;
let viewport = "full";

function prettify(file) {
  const base = file.replace(/\.html?$/i, "").replace(/[-_/]+/g, " ");
  return base.replace(/\b\w/g, (c) => c.toUpperCase()).trim() || file;
}

async function loadManifest() {
  try {
    const res = await fetch(`./manifest.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const raw = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
    items = raw
      .map((it) => (typeof it === "string" ? { file: it } : it))
      .filter((it) => it && typeof it.file === "string")
      .map((it) => ({
        file: it.file,
        title: it.title || prettify(it.file),
        group: it.group || "Previews",
      }));
  } catch {
    items = [];
  }
  render();
}

function render() {
  countEl.textContent = items.length ? `${items.length} preview${items.length === 1 ? "" : "s"}` : "";

  const q = searchEl.value.trim().toLowerCase();
  const filtered = q
    ? items.filter(
        (it) => it.title.toLowerCase().includes(q) || it.file.toLowerCase().includes(q),
      )
    : items;

  const groups = new Map();
  for (const it of filtered) {
    if (!groups.has(it.group)) groups.set(it.group, []);
    groups.get(it.group).push(it);
  }

  navEl.innerHTML = "";
  for (const [group, list] of groups) {
    const header = document.createElement("div");
    header.className = "nav-group";
    header.textContent = group;
    navEl.appendChild(header);
    for (const it of list) {
      const el = document.createElement("div");
      el.className = "nav-item" + (it.file === activeFile ? " active" : "");
      el.dataset.file = it.file;
      el.innerHTML = `<span class="dot"></span><span>${escapeHtml(it.title)}</span>`;
      el.addEventListener("click", () => select(it.file));
      navEl.appendChild(el);
    }
  }

  if (items.length === 0) {
    emptyEl.hidden = false;
    framesEl.hidden = true;
    titleEl.textContent = "No previews";
    pathEl.textContent = "";
    return;
  }

  if (!activeFile || !items.find((it) => it.file === activeFile)) {
    select(items[0].file);
  } else {
    paintStage();
  }
}

function select(file) {
  activeFile = file;
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.toggle("active", n.dataset.file === file));
  paintStage();
  if (location.hash !== `#${file}`) {
    history.replaceState(null, "", `#${file}`);
  }
}

function paintStage() {
  const it = items.find((x) => x.file === activeFile);
  if (!it) return;
  emptyEl.hidden = true;
  framesEl.hidden = false;
  titleEl.textContent = it.title;
  pathEl.textContent = it.file;
  openNew.href = previewUrl(it.file);

  framesEl.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "frame-wrap";
  wrap.dataset.viewport = viewport;
  const iframe = document.createElement("iframe");
  iframe.src = previewUrl(it.file);
  iframe.title = it.title;
  iframe.loading = "lazy";
  wrap.appendChild(iframe);
  framesEl.appendChild(wrap);
}

function previewUrl(file) {
  return `./.builder/output/${file}`;
}

function escapeHtml(s) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

viewportBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    viewport = btn.dataset.viewport;
    viewportBtns.forEach((b) => b.classList.toggle("active", b === btn));
    const wrap = framesEl.querySelector(".frame-wrap");
    if (wrap) wrap.dataset.viewport = viewport;
  });
});

searchEl.addEventListener("input", render);
refreshEl.addEventListener("click", loadManifest);

themeToggle.addEventListener("click", () => {
  const next = THEME_ORDER[(THEME_ORDER.indexOf(currentTheme()) + 1) % THEME_ORDER.length];
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

window.addEventListener("hashchange", () => {
  const f = decodeURIComponent(location.hash.slice(1));
  if (f && items.find((it) => it.file === f)) select(f);
});

(async () => {
  await loadManifest();
  const hashFile = decodeURIComponent(location.hash.slice(1));
  if (hashFile && items.find((it) => it.file === hashFile)) select(hashFile);
})();
