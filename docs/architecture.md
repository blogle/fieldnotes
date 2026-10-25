# Workbench architecture

The workbench consists of a Node.js HTTP server, small rendering/watching/diff libraries, shared presentation assets, and editable documents. Rendering happens in memory for each request. The Nix package installs the server and its dependencies in the store; consuming projects keep only their source content and configuration.

## Repository structure

```text
AGENTS.md                 Maintenance and authoring conventions
README.md                 Setup and repository-level usage
flake.nix / flake.lock    Pinned Nix development environment
package.json              Start/test commands and dependency ranges
package-lock.json         Resolved npm dependency versions
server.js                 CLI, confined HTTP routes, watcher, SSE
lib/config.js             Optional project JSON configuration
lib/render.js             Markdown renderer and shared shell
lib/git.js                Read-only HEAD retrieval and source comparison
server.test.js            Node integration checks
skills/                   Companion agent authoring/review skill
docs/                     Served content and watched source tree
├── workbench.json        This project's navigation and title
├── index.md              Viewer entry point
├── architecture.md       This document
├── pipeline.md           Rendering and change propagation
├── research.md           Evaluation and limitations
├── assets/
│   ├── fieldnotes.css    Shared typography and responsive grid
│   ├── document.js       Heading IDs, TOC, active navigation
│   ├── reload.js         EventSource client and page refresh
│   ├── review.js/css     Annotation panel and page tools
│   ├── share.js          Self-contained HTML exporter
│   └── compare.js/css    Source diff and sandboxed previews
└── spec/
    ├── index.md          Workbench behavior specification
    ├── diagram.svg       Rendering/reload pipeline diagram
    └── screens/          Standalone interactive HTML examples
```

The server resolves `--root` relative to the current working directory, defaulting to `docs/`. Built-in viewer assets resolve relative to the installed server and are served under `/__workbench/assets/`, even when the content lives in another repository. The configured entry defaults to `/index.md`, not `/docs/index.md`.

## Runtime components

| Component | Responsibility |
| --- | --- |
| Node HTTP server | Resolve requests, read source files, construct responses, and maintain the reload endpoint |
| `markdown-it` | Render Markdown with tables, fenced code, images, and trusted inline HTML |
| `highlight.js` | Highlight fenced code when its language identifier is recognized |
| `chokidar` | Watch the content tree, including added files and directories |
| `diff` | Construct a unified patch from the HEAD and working-tree source |
| `document.js` | Derive heading anchors and contents navigation after the document loads |
| `reload.js` | Subscribe to server change events and reload the page |
| `fieldnotes.css` | Apply document typography, colors, grid, and viewport-specific rules |

The Markdown parser is configured once in `lib/render.js`:

```javascript
const md = new MarkdownIt({
  html: true,
  highlight(code, language) {
    return language && hljs.getLanguage(language)
      ? hljs.highlight(code, { language }).value : '';
  }
});
```

An unrecognized or omitted language falls back to Markdown-it’s escaped code output. Diagrams are source SVG files referenced as images; Mermaid execution is not configured.

## Presentation ownership

Markdown documents receive the shared HTML shell from `lib/render.js`. The shell includes configured header navigation, the prose region, TOC container, stylesheet, and browser scripts. Authors do not repeat this structure. `workbench.json` controls title, entry, ordered links, and optional local styles/scripts; it is read for each request.

The document grid has three equal tracks. Prose spans the first two and the TOC occupies the third. At 850 CSS pixels and below, the TOC moves above the prose. The desktop TOC is sticky and scrolls internally if its contents exceed the available viewport height.

Standalone HTML bypasses the Markdown shell. Each example provides its own navigation and controls and uses plain scripts. The server adds page metadata, review-tool styles/scripts, and reload support. The [share exporter](review.md#share-a-self-contained-page) removes viewer controls and packages the page's assets for offline use.

## State and storage

The server keeps connected SSE responses and a debounce timer in memory. Source files remain the persistent representation of the documentation. Browser-local review drafts record feedback by page path; they are never written into project files. See [draft storage](review.md#draft-storage-and-copied-prompts).

The task examples independently use `localStorage` under `understory-demo-v1`. `state.js` supplies seed data, snapshot validation, save operations, and cross-tab updates. Their search and selection state is transient. This example storage is unrelated to document rendering or live reload.

## Request boundary

Content requests are confined to the resolved content root, with a second real-path check to reject symlink escapes. The project root must contain the content root. Missing files return 404; rejected escapes return 403; other caught errors return 400. Viewer endpoints live under `/__workbench/`; no directory browser or source editor is exposed. Requests other than GET/HEAD are rejected.

All ordinary document and asset responses use `Cache-Control: no-store`. The server reads the requested file again on each request and does not cache rendered HTML.

## Process lifecycle

`npm start` runs `node server.js`; `nix run .` starts its packaged equivalent. The process starts the HTTP listener, content/config watcher, and a 20-second SSE heartbeat. `SIGINT` and `SIGTERM` clear timers, end connected event streams, close the watcher, and close the server. Git is invoked only on comparison requests.

`npm test` uses Node’s built-in test runner. Tests start a separate server with `PORT=0`, discover its allocated address from stdout, exercise it over HTTP, and shut it down. See the [verification specification](spec/index.md#verification) for coverage and browser checks.
