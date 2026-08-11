# Agent Notes — DyslexiaAway

Browser extension (Manifest V3) that applies dyslexic-friendly fonts to web pages. Intentionally small and dependency-free: no bundler, no external runtime calls, no tracking.

## Project Layout

```
app/                 Extension source (shipped in both zips)
  background.js            Background entry and logic (shared by Chrome & Firefox)
  content.js               Content script injected into pages (run_at document_start, all_frames)
  popup.{js,html,css}      Popup UI
  style.css / fonts.css    Styles injected into pages / @font-face declarations
  build.js                 Build script (Node); not shipped
  manifest-chrome.json     Chrome manifest (minimum Chrome 99; service worker = background.js)
  manifest-firefox.json    Firefox manifest (background.scripts = [background.js])
  _locales/  fonts/  icons/   i18n / bundled fonts / icons
  extras/                  Dev helpers (font-comparison.html, generate-disabled-icons.py); NOT included in builds
docs/                Static website (GitHub Pages)
test/                Node test suite (extension.test.js)
dist/                Disposable build output (gitignored; local zips may exist)
```

## Architecture Notes

- Firefox and Chrome 148+ expose the native Promise-based `browser` namespace. Chrome 99–147 aliases native `chrome` APIs to that namespace with a one-line runtime guard; no compatibility polyfill is shipped.
- Chrome 99 is the floor because `runtime.sendMessage()` and `tabs.sendMessage()` are the newest Promise APIs used. While supporting Chrome 99–147, keep `runtime.onMessage` listeners on `sendResponse`/`return true`; Promise-returning listeners require Chrome 148.
- `background.js` is the direct background entry in both builds: a Chrome service worker and a Firefox background script.
- Build output is two zips at `dist/dyslexia-away-chrome.zip` and `dist/dyslexia-away-firefox.zip`. The per-browser staging dir (`dist/chrome`, `dist/firefox`) is created then deleted after zipping, so it does not persist.
- `build.js` fails closed when required runtime files/directories are missing (`srcFiles`, selected manifest, `fonts/`, `icons/`, `_locales/`). Project-root docs such as `README.md` are optional.
- Static JSON (manifests, `_locales/*/messages.json`) is still copied without syntax/schema validation by `build.js`; the test suite parses it, so keep tests green before release.

## Build & Test

Requires Node.js >= 20 and the system `zip` binary (`build.js` shells out to `zip`; tests shell out to `zipinfo`).

```bash
npm test                                # node --test (auto-discovers test/)
node --test test/extension.test.js      # run a single test file
npm run build                           # build:chrome && build:firefox
npm run build:chrome                    # node app/build.js chrome
npm run build:firefox                   # node app/build.js firefox
npm run clean                           # rm -rf dist/
```

No `lint` script exists. `eslint.config.mjs` is present but imports `@eslint/js` and `globals`, which are not in the (empty) `devDependencies` — so linting needs a manual install: `npm i -D eslint @eslint/js globals && npx eslint app/`.

## Syntax Checks (fast, no `zip` needed)

```bash
node --check app/content.js
node --check app/popup.js
node --check app/background.js
node --check app/build.js
```

## Release

Pushing a `v*` tag (or `workflow_dispatch`) runs `.github/workflows/release.yml`: `npm test` → `npm run build` → publishes both zips as a GitHub Release. Tests run before build in CI, so keep them green locally before tagging.

## Indexed Codebase Memory

This repo can be indexed by **codebase-memory-mcp** for structural code discovery. The index is local to each machine and the project ID is derived from the filesystem path — on a fresh clone, find yours with `list_projects` and substitute it in the examples below.

- Binary: `$HOME/.local/bin/codebase-memory-mcp`
- Project ID: derived from the repo path (check with `codebase-memory-mcp cli list_projects`)

Preferred discovery order:

- `search_graph` for functions, classes, variables, routes, and entry points.
- `trace_path` for caller/callee relationships.
- `get_code_snippet` for exact source once `search_graph` returns a `qualified_name`.
- `query_graph` for complex Cypher patterns.
- `get_architecture` for high-level orientation.
- Fall back to `search_code`/`rg` for string literals, comments, config values, docs, and other non-code files.

CLI quirks that bite:

- Wrap the JSON payload in **single quotes** so the shell doesn't expand the inner double quotes.
- `search_code` takes `pattern` (not `query`); literal by default, pass `"regex": true` for alternation/regex.
- `get_code_snippet` needs the `qualified_name` returned by `search_graph`.
- Always pass `"project": "<project-id>"` when the tool accepts a `project` parameter.

```bash
# Find your project ID first, then substitute it in the commands below
$HOME/.local/bin/codebase-memory-mcp cli list_projects '{}'

# Architecture overview / find a symbol / trace callers / refresh after edits
$HOME/.local/bin/codebase-memory-mcp cli get_architecture '{"project": "<project-id>", "aspects": ["all"]}'
$HOME/.local/bin/codebase-memory-mcp cli search_graph '{"project": "<project-id>", "name_pattern": "updateState", "label": "Function"}'
$HOME/.local/bin/codebase-memory-mcp cli trace_path '{"project": "<project-id>", "function_name": "updateState", "direction": "both"}'
$HOME/.local/bin/codebase-memory-mcp cli detect_changes '{"project": "<project-id>"}'
```

MCP-capable agents usually expose the same operations as `codebase-memory_*` tools; use the CLI examples above when a specific MCP tool is unavailable. Full tool and Cypher reference: <https://github.com/DeusData/codebase-memory-mcp>

## Coding Conventions

- Keep changes minimal; do not rewrite whole files.
- No shared modules, bundlers, frameworks, or external dependencies unless explicitly asked.
- Preserve the existing architecture and formatting.
- Dependency-free and privacy-first: no tracking, no external network calls.
