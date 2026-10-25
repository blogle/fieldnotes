# Fieldnotes

A build-free Markdown/HTML documentation workbench. Its documents describe the workbench itself: repository structure, rendering, live reload, authoring rules, and verification. Shared typography uses a three-column grid: content spans the left two columns and a heading-derived TOC occupies the right column. At 850px and below, the TOC stacks above the content. Two task screens and an architecture-options comparison serve as standalone HTML examples.

Repository: [blogle/fieldnotes](https://github.com/blogle/fieldnotes). The Nix package also exposes a `fieldnotes` command; `workbench` remains a compatible alias.

## Run

Requires **Node.js 22+**. From this directory:

```sh
npm ci && npm start
```

Open **http://127.0.0.1:3000/index.md**. After initial installation, `npm start` is enough. Stop with Ctrl+C. Override the address with `HOST` or `PORT` if needed. On Nix, run `nix develop` first to enter the included Node.js 22 development shell, or launch directly:

```sh
nix develop --command bash -c 'npm ci && npm start'
```

Or use the packaged app with **no local npm installation**:

```sh
nix run . -- --root docs --project .
```

To serve another repository, use `nix run /path/to/this/workbench -- --root /path/to/project/docs --project /path/to/project`. The package includes Node, Git, viewer assets, and npm dependencies in the Nix store. `nix build .` builds the same app. A consumer can pin this flake as an input and expose its package as `apps.<system>.docs`; see `docs/reuse.md` for the integration fragment.

## Configuration and page tools

`docs/workbench.json` controls site title, entry, ordered navigation, and optional project CSS/classic scripts. The CLI supports `--root`, `--project`, `--config`, `--host`, and `--port`. Content/config edits reload without restarting; source-code edits require restart.

Every served Markdown/HTML page has three compact icon controls:

- **Download icon:** download self-contained HTML through the browser's normal download destination and attempt a new-tab preview. Status/errors never open the review drawer. No viewer controls or arbitrary browser storage are exported. Other-page links still need their original viewer. Modules, external assets, and embedded documents are rejected; runtime fetch dependencies need a standalone adapter.
- **Comment icon:** open the right-side annotation drawer. Select text or pick an element, save browser-local comments, and copy a prompt containing source path, quotes, heading/context, locator, and feedback. Annotations appear as list items; stale targets remain available and are flagged.
- **Diff icon:** toggle the current page into a read-only side-by-side HEAD/working-tree view without changing its URL. Close restores the original page, scroll position, and drafts. The unified source diff is expandable, and preview scripts/forms are disabled. No Git writes; no-Git/untracked states are explicit.

`skills/documentation-workbench/SKILL.md` encodes the agent workflow. Register its containing directory with your agent's skill loader or copy it to a supported skill location. OpenCode registration changes require a restart. Server customization uses project styles/scripts and standalone HTML; arbitrary backend plugins are intentionally outside the configuration contract.

The server renders Markdown on request and serves other assets directly. Chokidar watches the whole `docs/` tree, including newly created directories. An injected Server-Sent Events client refreshes all connected pages after a save; a single HTTP port handles everything. No compilation, generated site, external assets, or CDN requests.

## Project documentation

- `docs/index.md`: entry point, setup, and operating boundaries.
- `docs/architecture.md`: repository structure and component responsibilities.
- `docs/pipeline.md`: request routing, rendering, browser enhancement, and reload propagation.
- `docs/spec/index.md`: authoring contract, layout behavior, and verification steps.
- `docs/research.md`: Markserv evaluation, decisions, limitations, and open questions.
- `docs/reuse.md`: Nix packaging, consumer configuration, customization, and skill integration.
- `docs/review.md`: offline export, annotations, prompt handoff, and Git comparison.
- `docs/spec/diagram.svg`: rendering and reload pipeline diagram.

The viewer serves `docs/` as its root. Repository-level files such as `server.js` and this README are maintained outside the served tree. Restart the process after changing server code; only edits under `docs/` trigger live reload.

## Authoring

- Create any `docs/**/*.md`, then link it from an existing page. No frontmatter or template required. Tables, highlighted fenced code, inline HTML, images, and SVG diagrams work automatically.
- Create standalone HTML with ordinary relative CSS/JS references. The server adds live reload; the source has no server dependency.
- Global publication styles: `docs/assets/fieldnotes.css`. Screen layout: `docs/spec/screens/styles.css`.
- Try the inbox: add, search, filter, select, complete, and move tasks. The campaign supports task completion, capture, pause/resume, close, and reopen. State persists in localStorage; Reset demo restores both views.
- Open either HTML file directly for an independent prototype. Same-origin serving shares state reliably; `file://` storage sharing depends on browser policy. If persistence is blocked, screens work in memory. Markdown links require the viewer.

## Markserv evaluation

Reviewed the upstream [README](https://github.com/markserv/markserv#readme), [package manifest](https://github.com/markserv/markserv/blob/master/package.json), and [server implementation](https://github.com/markserv/markserv/blob/master/lib/server.js) during this experiment (upstream manifest: 1.21.1). This was a source-level evaluation, not a claim of runtime compatibility testing.

Markserv already offers markdown-it, highlighting, Mermaid, and Markdown hot reload. However, its HTML response branch sends source without injecting a reload client. Its hot-reload handler updates Markdown and directory clients only; CSS events re-render Markdown content rather than refreshing a linked stylesheet, and SVG is absent from its watched extension list. The Markdown wrapper is a package-owned GitHub-themed template without a documented custom-shell option. Meeting this experiment’s HTML/CSS reload and automatic publication-shell requirements would require patching or wrapping its server and templates.

The practical alternative uses Node’s HTTP server, markdown-it, highlight.js, chokidar, and the small `diff` library for Git review. Diagrams use checked-in SVG instead of a Mermaid runtime. The TOC is derived client-side from rendered headings. Ordinary documents need no boilerplate.

## Checks and limitations

```sh
npm test
```

For the committed browser suite, install Chromium separately and set its executable path:

```sh
CHROMIUM=/absolute/path/to/chromium npm run test:browser
```

On Nix, an equivalent command is:

```sh
nix shell nixpkgs#nodejs_22 nixpkgs#chromium -c bash -c 'CHROMIUM=$(command -v chromium) npm run test:browser'
```

The browser suite uses temporary downloads and a disposable Git repository. `playwright-core` is a development dependency; no browser binary is downloaded by npm and development dependencies are omitted from the packaged viewer.

Integration checks cover rendered features, static assets, navigation targets, response errors, injected reload, and file-change events. This is a trusted-local-content development server, not a deployment service. Inline HTML is deliberately enabled. Reload is a full page refresh (unsaved form text and ephemeral selection are lost); saved mock state survives. The TOC needs JavaScript. Browser-native font stacks keep everything offline. Mock persistence is last-write-wins, not collaborative synchronization.

Also verified in headless Chromium: capture/search/bulk move, campaign completion and pause/resume, close/reopen, persistence after refresh, keyboard focus, live browser refresh, and independent `file://` screens. Checked all page types at 375, 768, 1024, and 1440 pixels wide with no horizontal page overflow.

## CI and releases

Fieldnotes consumes the pinned `blogle/sdlc/v2` contract. `ci.nix` owns named admission checks (`syntax`, `contracts`), verification (`integration`, `browser`, `publisher`, `package`), and the source-publication app. SDLC owns workflow execution, Hestia caching, policy validation, and release orchestration. Generated workflows are pinned to the exact locked revision; use `nix run .#sdlc -- update` to update them together.

Run `nix develop -c just ci-check` and `nix develop -c just ci-verify` for the Nix checks. Release-worthy changes add `.changes/<topic>.json`; release notes and manifests are generated by SDLC. The publication hook uploads a deterministic `fieldnotes-<version>-<merged-sha>.tar.gz` from committed bytes, verifies the downloaded digest, and records the SDLC identity-bound receipt. Retries never overwrite conflicting bytes. Consumers can pin `github:blogle/fieldnotes/<tag>`.

Publishing the repository does not activate unattended releases. Mergify and release-App installation, secrets, rulesets, and attestation must be provisioned by an authorized administrator according to [SDLC onboarding](https://github.com/blogle/sdlc). Keep `SDLC_RELEASE_ACTIVATE` false until that setup is verified. No credentials are stored in this repository.
