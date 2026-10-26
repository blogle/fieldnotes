# Sharing and reviewing pages

Served Markdown and HTML pages receive three compact icon controls: **download**, **comments**, and **diff**. Each has an accessible label and tooltip. Download is independent of the annotation drawer and diff view. Exported pages omit all viewer controls and the live-reload connection.

## Share a self-contained page

Choose the **download icon** to download one HTML file through the browser's configured destination (typically Downloads). The viewer also attempts to open the artifact in a new tab. Browser pop-up/download settings may block that tab or ask where to save; the viewer cannot force a filesystem location or open the downloaded filesystem path. Its independent status message never opens the annotation drawer.

The exporter clones the current document, embeds loaded stylesheets and their imports, replaces local CSS/image/media assets with data URLs, and inlines classic scripts. The source files and repository remain unchanged. A download made while viewing a diff exports the original page, not comparison controls or iframes.

- The download opens offline with no viewer installation or copied stylesheet.
- Other-page links retain absolute destinations to the original viewer; they are not bundled. Fragment links stay within the exported page.
- Responsive image markup is flattened to the currently selected image.
- Form values and open disclosure state are included, except password/file input values.
- Review drafts and arbitrary localStorage are not included.

The exporter rejects external assets, ES modules, embedded documents (`iframe`, `object`, `embed`), and external SVG `use` references instead of silently producing a partial artifact. Runtime network calls made by authored scripts are not rewritten. Keep portable examples network-independent. Assets referenced only dynamically by script are not discovered automatically.

### Export application state

Serializing a DOM does not serialize JavaScript closures or event listeners. Classic scripts run again when the exported page opens. Applications can provide an explicit bootstrap through this synchronous hook:

```javascript
window.addEventListener('fieldnotes:export', event => {
  // event.detail.document is the cloned HTML element, not the live document.
  event.detail.bootstrap.push(
    `window.exampleSnapshot = ${JSON.stringify(currentState)};`
  );
});
```

The bootstrap runs before the page's scripts. Export only the state the artifact needs. The task examples use this hook to restore their current task snapshot in memory without reading or writing the recipient's browser storage. The architecture-options example uses native radio/textarea state, which the exporter captures directly.

## Annotate text or elements

1. Select text in the document, open the **comment icon**, and choose **Annotate selection** in the right-side drawer.
2. Alternatively, choose **Pick element**. The drawer temporarily collapses so the page remains reachable even on a phone; click the element to reopen the comment form. That click is intercepted rather than activating its ordinary control/link.
3. Write feedback and save the comment. Numbered markers locate comments in the page.
4. All annotations appear as list items in the drawer, with **Locate**, **Edit**, and **Delete** actions. The icon badge shows the comment count. Escape cancels picking first, then closes the drawer. On phones the drawer uses the full viewport width.
5. Choose **Copy prompt** when the review is ready. A selectable prompt is also shown if clipboard permission is unavailable.

Text annotations record exact quoted text, prefix/suffix context, and the preceding heading. Element annotations record a selector, a text excerpt, and heading context. Authors can supply stable IDs or `data-review-id` attributes for elements likely to be reviewed.

Anchors are checked against current rendered content. A missing or ambiguous text match, or an element whose excerpt changed, is reported as **Target changed or missing**. Feedback is retained so the agent can inspect it. DOM selectors are hints, not source-line mappings; agents must verify the source before editing.

## Draft storage and copied prompts

Saved draft comments are stored in `localStorage` by content-root identity and page path on the viewer's origin. They survive live reload without colliding with another project's drafts on the same port. They are not saved into the repository, synchronized to collaborators, or automatically cleared after source edits. Text in an unsaved comment form is transient; choose Save comment before editing source. If storage fails, saved comments remain usable in the current tab and the panel reports the limitation.

The copied prompt includes the content-root/page path, review timestamp, each target's quote and locator, current anchor status, and the comment. It asks the agent to verify targets and report ambiguity. This is an explicit browser-to-agent handoff; the viewer has no agent connection and does not write files.

## Compare the working tree with HEAD

The **diff icon** toggles the current page into a read-only side-by-side comparison with `HEAD`, without changing its URL. **Close diff** (or the diff icon again) restores the existing page, scroll position, and drafts. The source diff is expandable beneath the rendered previews. Original page controls are inert while the diff is active; annotation drafts remain available in the drawer, but new selections/picks require returning to the page.

Markdown uses the current configured shell/theme; local page-linked assets load from their respective versions where available. The current source is read from disk, not from transient browser edits. The standalone comparison endpoint is retained for direct use, but the toolbar does not navigate to it.

Git operations use argument arrays through `execFile`, confined page paths, and the fixed `HEAD` ref. They do not stage, commit, switch branches, run a user-selected shell command, or write Git configuration. New/untracked files are shown against an empty baseline. Without a Git repository or a `HEAD` commit, the view explains that no baseline is available.

Preview frames disable scripts and forms through iframe sandboxing. Consequently, an HTML page populated entirely by JavaScript may have little visible content in its preview; its source diff remains available. Markdown TOC entries are displayed without the normal enhancement script. The view does not reconstruct the historic viewer/theme, resolve renames, compare arbitrary refs, or open deleted working-tree pages.

## Architecture comparison example

The [distribution approaches example](spec/screens/approaches.html) presents three options with benefits and costs. Select an option, record constraints, and use **Copy decision** or **Copy as prompt**. Use the comment drawer to review a trade-off, or the download icon to hand someone the current choice as one offline artifact.
