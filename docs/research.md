# Evaluation notes

This page records the workbench’s renderer evaluation, implementation decisions, verification evidence, and unresolved questions. It describes this repository rather than fictional product research.

## Evaluation criteria

The experiment requires a single local entry point for Markdown and HTML, automatic refresh across document and asset types, shared document styling, portable interactive examples, and readable source files. The implementation must avoid mandatory compilation and a documentation framework.

## Markserv assessment

The initial evaluation reviewed the upstream [README](https://github.com/markserv/markserv#readme), [package manifest](https://github.com/markserv/markserv/blob/master/package.json), and [server implementation](https://github.com/markserv/markserv/blob/master/lib/server.js). The manifest observed during evaluation reported version **1.21.1**. This was a source-level assessment, not an installed runtime compatibility test. The links point to upstream’s mutable default branch, so later revisions may differ.

| Area | Finding in the inspected source |
| --- | --- |
| Markdown | Markdown-it, highlighting, and Markdown hot reload were available |
| Standalone HTML | The response branch sent HTML without injecting a reload client |
| Change handling | Hot reload updated Markdown and directory clients, not standalone HTML pages |
| Linked CSS | Change events re-rendered Markdown content rather than refreshing linked stylesheets |
| SVG | SVG was absent from the watched extension list |
| Shared shell | The wrapper used a package-owned GitHub-themed template; no custom-shell option was documented |

Meeting the combined layout and reload requirements would have required adapting Markserv’s server and templates. The experiment instead uses a small local server with established rendering and watching libraries.

## Implementation decisions

| Decision | Rationale | Consequence |
| --- | --- | --- |
| Node HTTP server | A small route surface does not require a routing framework | Request handling stays in `server.js` |
| Markdown-it and Highlight.js | Reuse established parsing and code highlighting | Four direct runtime libraries including Chokidar and Diff |
| SSE on the HTTP listener | One-way change notifications need no separate socket server | One port serves content and reload events |
| Full-page reload | Initial and updated pages follow the same rendering path | Transient state is discarded; saved review drafts survive |
| Static SVG diagrams | Browser-native, editable, offline assets | Diagrams are maintained manually |
| Client-derived TOC | Avoid per-document contents markup and parser plugins | Heading anchors require JavaScript |
| Shared CSS | Ordinary Markdown needs no styling boilerplate | HTML examples opt in; Share embeds the CSS for portability |
| Nix distribution | Pin one executable and dependency closure across projects | No viewer node_modules in consuming projects |
| JSON site configuration | Project-owned title/navigation/styles/scripts | No executable server-plugin loader |
| Browser-local review | Collect feedback without a backend or source-file writes | Copied prompts are the explicit agent handoff |

## Verification evidence

The repository includes repeatable Node integration checks through `npm test` and a separate committed browser suite through `npm run test:browser` with `CHROMIUM` set. Browser checks cover annotations, prompt export, offline HTML/SVG/task snapshots, decision export, responsive page/tool layouts, reload, script-disabled Git previews, and independent HTML screens. Layouts are exercised at 375, 768, 1024, and 1440 pixels wide, including the 2:1 grid and stacked TOC. The integration suite tests separate consumer configuration and no-Git/new-file comparison behavior.

The [verification section](spec/index.md#verification) defines the repeatable suite’s coverage and browser checks to perform after changes. A successful server test does not establish visual or keyboard correctness.

## Current limitations

- Content is trusted. Inline HTML is not sanitized, and the server is not an authenticated publishing service.
- A source save refreshes every connected page, even if the edited asset is unrelated to that page.
- Changes while a reload client is disconnected are not replayed. Reconnection does not itself force a refresh.
- Server source changes need a restart; only content is watched.
- The TOC indexes levels one through three for anchors and includes only levels two and three as entries. Heading renames change fragment URLs.
- Global navigation is configured per project; there is still no automatic folder index or page discovery.
- HTML shell/navigation markup is repeated in standalone examples to preserve their independent operation.
- `file://` localStorage support and sharing are browser-dependent. The example scripts fall back to in-memory operation if persistence is unavailable.

## Open questions

1. Does a larger documentation tree require an authored document index beyond the landing page?
2. Should reconnecting clients compare a content revision to detect missed updates?
3. Should review drafts support an explicit project ID so moving a content folder preserves its draft identity?
4. Which additional CSS or JavaScript artifact patterns need explicit export adapters?

These are evaluation questions, not implemented features or requirements for adding a document.
