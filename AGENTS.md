# DSI Lite Preview

Static, dependency-free shell that previews the design-system HTML files in
`.builder/output/` inside iframes.

## Layout

```
index.html           # preview shell
theme.css            # unified theme
app.js               # vanilla JS loader (no deps)
manifest.json        # list of previews shown in the sidebar
build-manifest.mjs   # scans .builder/output/ and rewrites manifest.json
.builder/output/     # source: *.html (and supporting *.css) to preview
```

## Workflow

- Add or update files in `.builder/output/`.
- Include sidecar metadata comments at the top of each HTML file so the manifest
  builder can group and label them. Example:

  ```html
  <!-- @group Tokens -->
  <!-- @title Color Palette -->
  <!-- @order 10 -->
  ```

  `@group` and `@title` are strings; `@order` is a number controlling sort
  position within a group (lower first). All three are optional.
- Run `npm run manifest` to regenerate `manifest.json`.
- Serve the root with any static server (`npm run dev` uses `serve` on :8080).

## Manifest format

`manifest.json` accepts either a flat array of filenames or a richer form:

```json
{
  "items": [
    { "file": "buttons.html", "title": "Buttons", "group": "Components" }
  ]
}
```

`title` and `group` are optional; `title` defaults to a prettified filename and
`group` defaults to `"Previews"`. Values from `@title` / `@group` sidecar
comments inside the HTML take precedence over these.

An optional top-level `"groups": ["Tokens", "Components"]` array controls the
sidebar ordering of groups; any group discovered in sidecars or items that
isn't listed there is appended after.

## Constraints

- No frameworks, no build step. Plain HTML/CSS/JS only.
- Iframes load from `./.builder/output/<file>`; keep all assets relative.
