# Maintaining this workbench

- Run `npm ci && npm start` (Node 22+). The entry is `http://127.0.0.1:3000/index.md`.
- `nix run . -- --root docs --project .` runs the packaged viewer without a local npm install. Consumer projects pin the flake rather than copying the server. Configure project title, navigation, styles, and classic scripts in `docs/workbench.json`.
- Prefer ordinary Markdown in `docs/`; link new pages from an existing page. Heading IDs and the contents navigation are derived automatically. Use relative links and portable SVG diagrams.
- Use standalone HTML only for interaction or layouts prose cannot express. Reference shared `docs/assets/fieldnotes.css` through relative assets; screen-specific styles live in `docs/spec/screens/styles.css`.
- Screens use plain scripts, native controls, and mock state. They must also work via `file://`. Do not add frameworks, bundling, external fonts, or service dependencies.
- Document the workbench itself: structure, rendering, reload, authoring, and verification. Keep documentation and implementation aligned. The task screens are standalone HTML examples, not the project's application domain. Distinguish proposed changes from implemented behavior and source-level evaluation from runtime testing.
- Write technical documentation and specifications: use descriptive headings, requirements, state transitions, and verification steps. Avoid marketing copy, slogans, and decorative bylines. Documents use a three-column grid with prose spanning two columns and the TOC occupying the third; stack them on narrow screens.
- Run `npm test` for server integration checks. Check screen interactions, narrow layouts, keyboard focus, and reload behavior when changing the viewer.
- Keep generated share downloads outside the source tree. Keep source files readable. The server renders trusted local author content including inline HTML. Share must omit viewer controls, Review must preserve browser-local drafts, and Compare must remain read-only with script-disabled previews.
- The companion authoring workflow is in `skills/documentation-workbench/SKILL.md`.
- This repository is `blogle/fieldnotes` and consumes pinned `blogle/sdlc/v2`. Keep generated adapters aligned using `sdlc install --check`; use `nix develop -c just ci-check` / `just ci-verify`. Consumer test/publish declarations belong in `ci.nix`. Releases use `.changes/*.json` and verified source-archive receipts; do not manually activate Apps or release credentials.
