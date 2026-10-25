# Workbench specification

This document defines the authoring contract and implemented behavior of the Markdown/HTML workbench. The [architecture](../architecture.md) identifies the components; the [pipeline](../pipeline.md) describes their execution order.

## Authoring contract

### Markdown documents

- Documents live under `docs/` and use the `.md` extension.
- A page needs no frontmatter, imports, or framework-specific syntax.
- Use one descriptive level-one heading; use level-two and level-three headings for TOC entries.
- Use relative file links for documents and assets. Link new pages from an existing page; discovery is not automatic.
- Fenced code should identify its language when highlighting is wanted.
- Reference diagrams as portable SVG images. Diagram source is edited directly; no diagram compilation runs in the viewer.
- Inline HTML is permitted for content ordinary Markdown cannot express. Shared `.callout` styling is available.

For example, a new `docs/guide.md` can contain:

```markdown
# Editing documents

## Local preview

Run the viewer and save this file to refresh the browser.

[Architecture](architecture.md)
```

Link it from `docs/index.md` with `[Editing documents](guide.md)`. The page receives the same shell, CSS, anchors, and TOC as this document.

### Standalone HTML

- Include a document title, viewport metadata, semantic structure, and labelled native controls.
- Supply navigation and relative CSS/JS references in the source file.
- Reuse the shared theme through a local relative stylesheet or the served `/__workbench/assets/fieldnotes.css`; put example-specific layout rules beside the example. Share can embed either into an offline artifact.
- Use plain scripts that work through both HTTP and `file://`.
- Do not add reload/review clients to the source. The server injects them into served HTML.

The [inbox](screens/inbox.html) and [campaign](screens/campaign.html) demonstrate this contract. Their `styles.css` imports `../../assets/fieldnotes.css`; each screen loads `state.js` and its own interaction script.

## Rendering requirements

| Source feature | Implemented output |
| --- | --- |
| Headings and paragraphs | Shared document typography |
| Markdown tables | Styled tables with local overflow scrolling |
| Recognized fenced language | Highlight.js token markup |
| Unrecognized fenced language | Escaped, unhighlighted code |
| Inline HTML | Trusted markup in the rendered document |
| SVG image reference | Browser-rendered image served from source |
| Level-two/three heading | Client-derived TOC entry and fragment link |

The Markdown shell renders ordered links from `workbench.json`. New pages become reachable through authored links without registration; add a global link in the config when appropriate. Site title, entry page, and project CSS/classic scripts are also configured there. See [reuse and configuration](../reuse.md).

## Layout and navigation

- Above 850 CSS pixels, the document uses three equal grid tracks. Prose spans the left two tracks; the TOC uses the right track.
- At 850 pixels and below, the TOC stacks above the prose and is no longer sticky.
- At desktop widths the header and TOC are sticky; at 1100 pixels and below the header returns to normal flow.
- Long code and tables scroll within their own regions rather than expanding the page.
- A skip link targets the main content. Keyboard focus must remain visible.
- TOC entries reflect rendered heading text, including headings introduced by inline HTML.

## Reload requirements

Changes under `docs/` must refresh connected Markdown pages and served HTML examples without restarting the server. This includes Markdown, HTML, CSS, JavaScript, and SVG sources, plus newly added files and directories.

Reload replaces the document. It does not preserve transient UI state or replay missed events. No file-watch support is promised for repository files outside the content root.

## Example behavior

The HTML examples are interaction fixtures, not a backend application. The task screens use a shared, versioned mock snapshot when served on the same origin. The [architecture-options example](screens/approaches.html) demonstrates explicit decision/prompt export.

| Example | Behavior used to exercise the workbench |
| --- | --- |
| Task inbox | Capture, filter, select, complete/reopen, and assign tasks |
| Campaign detail | Display progress, add/complete tasks, pause/resume, and close/reopen |
| Shared state | Save to localStorage, restore after reload, and reset sample data |
| Direct-file use | Load relative assets and operate without the viewer |
| Architecture options | Compare trade-offs, select an approach, and copy a decision or prompt |

Task titles must be non-empty after trimming and are limited to 160 characters. Campaign closure requires at least one task and all tasks completed. Closed campaigns must be reopened before their tasks can be changed or assigned. These rules make reload persistence and cross-page behavior observable.

## Verification

Run the integration checks from the repository root:

```sh
npm test
```

`server.test.js` verifies document responses, shared assets and scripts, local links, highlighted code, tables, HTML tool injection, SVG content type, confinement, and reload events. A separate temporary consumer fixture tests config updates, packaged-asset routing, no-Git behavior, HEAD source/preview retrieval, and new-file comparison. It removes temporary fixtures afterward. Fixture Git history is isolated from the user's repository.

`npm test` does not run a browser. The committed browser suite is available separately using an installed Chromium executable:

```sh
CHROMIUM=/absolute/path/to/chromium npm run test:browser
```

It covers review anchors/draft persistence, copied prompts, offline Markdown/SVG/interactive exports, architecture choices, responsive pages and controls, reload, sandboxed Git comparisons, and standalone screens. It uses temporary downloads and a temporary Git fixture, not the project's own history. Check these behaviors when changing viewer scripts or layout:

1. Load a document with headings. Follow a TOC link, then reload its fragment URL.
2. Verify the 2:1 prose/TOC split at desktop width and a stacked layout at phone/tablet widths.
3. Save Markdown, HTML, CSS, JavaScript, and SVG sources; confirm the browser refreshes with the updated result.
4. Add a task in the inbox, reload, assign it to the campaign, and inspect it on that screen.
5. Use keyboard navigation and check visible focus, form labels, and action feedback.
6. Open both HTML examples through `file://`; verify relative assets and interactions without a running server.
7. Export Markdown and interactive HTML with Share; open downloads with networking disabled and verify styling, images, and interaction.
8. Save text and element comments, reload, copy the prompt, and verify quotes and locators. Edit a target and confirm stale feedback is retained.
9. In a disposable Git fixture, compare edited Markdown/HTML with HEAD. Inspect source diffs and script-disabled previews. Verify graceful no-Git behavior.

## Review tools

Every served page receives compact download, comment, and diff icon controls with accessible names/tooltips. Download and its best-effort new-tab preview use independent status UI; neither opens the comment drawer. The drawer owns annotation controls and saved-comment list items. Diff toggles side-by-side contents in the current page without changing its URL and restores page scroll/state on close. These controls must not appear in the downloaded artifact. Detailed behavior is defined in [sharing and reviewing pages](../review.md).

## Exclusions

The workbench has no document editor, search index, authentication, deployment build, Markdown includes, component system, or automatic source-code restart. Current trade-offs and evaluation evidence are recorded in [evaluation notes](../research.md).
