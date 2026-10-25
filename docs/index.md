# Fieldnotes documentation

Fieldnotes serves Markdown documents and standalone HTML examples from a single directory. Markdown is rendered when requested; HTML, CSS, JavaScript, and diagrams remain ordinary source files. A file watcher triggers browser refreshes during editing. There is no compilation step or generated site.

These documents describe the viewer that is displaying them. Edit a page under `docs/`, save it, and the connected browser reloads the updated document.

## Run the workbench

Requires Node.js 22 or later. From the repository root:

```sh
npm ci && npm start
```

Open **http://127.0.0.1:3000/index.md**. Subsequent launches need only `npm start`. Stop the server with Ctrl+C.

The included Nix development shell supplies Node.js and npm:

```sh
nix develop --command bash -c 'npm ci && npm start'
```

`HOST` and `PORT` override the default bind address and port. For example, `PORT=3100 npm start` starts the same viewer on port 3100. The default host is `127.0.0.1`.

To run the packaged viewer without installing npm dependencies in the project, use `nix run . -- --root docs --project .`. See [reusing the viewer](reuse.md) for consuming-project flake integration and navigation/style configuration.

## Documentation map

| Document | Contents |
| --- | --- |
| [Architecture](architecture.md) | Repository structure, runtime components, dependencies, and boundaries |
| [Rendering and reload pipeline](pipeline.md) | Request handling, Markdown rendering, browser enhancement, and change propagation |
| [Workbench specification](spec/index.md) | Authoring contract, layout requirements, supported behavior, and verification |
| [Evaluation notes](research.md) | Markserv findings, implementation decisions, and current limitations |
| [Reuse and configuration](reuse.md) | Nix packaging, project integration, navigation, styles, scripts, and agent skill |
| [Sharing and review](review.md) | Offline HTML export, anchored feedback prompts, and Git comparison |
| [CI and releases](ci.md) | Pinned SDLC contract, named Nix checks, source-archive publication, and activation prerequisites |
| [Pipeline diagram](spec/diagram.svg) | Rendering and live-reload paths |

## HTML examples

The [distribution approaches](spec/screens/approaches.html) example compares packaging options and exports a decision or prompt. The [task inbox](spec/screens/inbox.html) and [campaign detail](spec/screens/campaign.html) exercise richer layouts, native controls, browser-local state, and cross-page navigation. Their task-management behavior is example content, not functionality supplied by the documentation server.

The screens use shared styles and relative assets. They also run when opened directly through `file://`, without the viewer. When served together, their mock state shares one origin; direct-file storage behavior depends on the browser.

## Make a change

1. Add a `.md` file under `docs/` and link it from an existing document.
2. Use ordinary headings, links, tables, fenced code, and images. No frontmatter or page template is required.
3. Save the file. Connected pages refresh automatically, including pages showing HTML examples.
4. Run `npm test` after changing the server. Check the browser after changing layout or client scripts.

The viewer supplies navigation, typography, heading IDs, and the table of contents for Markdown pages. Standalone HTML authors supply their own document structure and relative stylesheet/script links. See the [authoring contract](spec/index.md#authoring-contract) for details.

## Operating boundaries

- The served content root is `docs/`; repository files outside that directory are not exposed as document routes.
- Reload watches `docs/`. Changes to `server.js` require a process restart.
- Inline HTML is enabled for trusted local author content. The viewer is a development tool, not a publishing or access-control service.
- Reload replaces the whole page. Unsaved form input and ephemeral selection are lost; explicitly persisted example state survives.
- The viewer does not write documents. Humans and coding agents edit the source files using their existing tools.
- The download icon exports a self-contained artifact; the comment icon opens the annotation drawer; the diff icon switches this page to its HEAD/working-tree comparison. See [sharing and review](review.md).
