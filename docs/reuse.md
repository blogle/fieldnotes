# Reusing the viewer in a project

The viewer is packaged once; each consuming project owns its documentation and configuration. Node and the viewer's npm dependencies live in the Nix store. A consuming repository does not need a viewer `package.json`, copied server code, or a local `node_modules` directory.

## Run the package

From this repository:

```sh
nix run . -- --root docs --project .
```

To serve another project without modifying it:

```sh
nix run /path/to/this/workbench -- \
  --root /path/to/project/docs --project /path/to/project
```

The content root defaults to `docs` under the current working directory. The project root defaults to the content root's parent and must contain the content root. `--project` makes this boundary explicit, particularly for nested documentation folders. `--host`, `--port`, and `--config` override the listener and configuration file; `HOST` and `PORT` are also supported.

## Pin a flake input

Add Fieldnotes to the consuming project's existing flake. `flake.lock` pins the selected repository revision. After releases are published, use a version tag in the input URL when that better matches the project's update policy.

```nix
{
  inputs.workbench.url = "github:blogle/fieldnotes";

  outputs = { self, nixpkgs, workbench, ... }: {
    # Merge this into the project's existing per-system outputs.
    apps.x86_64-linux.docs = {
      type = "app";
      program = "${workbench.packages.x86_64-linux.default}/bin/workbench";
    };
  };
}
```

This is an integration fragment, not a replacement for the project's existing inputs/outputs. Use the project's system iteration if it supports several systems. The viewer exposes packages for x86_64/aarch64 Linux and macOS; only the host platform is exercised here.

Run from the project root with `nix run .#docs -- --root docs --project .`. Commit the project's updated `flake.lock` through its normal workflow to pin the viewer and dependencies. Updating that input is a deliberate viewer upgrade. The package also installs its companion skill under `share/workbench/skills/`.

## Project configuration

The optional file `<content-root>/workbench.json` controls the Markdown shell. It is read on requests and watched for changes. No configuration values execute server code.

```json
{
  "title": "Project engineering documentation",
  "entry": "index.md",
  "navigation": [
    { "label": "Overview", "href": "index.md" },
    { "label": "Architecture", "href": "architecture.md" },
    { "label": "Examples", "href": "examples/index.md" }
  ],
  "styles": ["assets/project.css"],
  "scripts": ["assets/project.js"]
}
```

| Field | Default | Contract |
| --- | --- | --- |
| `title` | `Documentation` | Site title and browser-title suffix |
| `entry` | `index.md` | Content-relative landing file; no fragment/query |
| `navigation` | Overview → `index.md` | Ordered `{label, href}` entries; local paths and optional fragments |
| `styles` | `[]` | Local stylesheets loaded after the default theme |
| `scripts` | `[]` | Local classic scripts loaded after document enhancement |

All paths are relative to the content root, not the current page. Absolute paths, parent traversal, remote schemes, and unknown fields are rejected. Global navigation is explicit; pages can still be added with an ordinary authored link without changing this config. Standalone HTML keeps its own markup/navigation; config styles and scripts apply to Markdown pages.

## Custom functionality

Project CSS can override theme variables or add content-specific layouts. A classic script can enhance a diagram, register a small editor, or listen for `workbench:export`. A standalone HTML page can carry richer interaction without changing the viewer.

There is intentionally no dynamic server-plugin loader. If a project needs a new data endpoint or different request behavior, contribute it as an explicit shared feature or pin a fork. This keeps the small configuration contract portable and the default server read-only.

## Agent integration

The repository includes `skills/documentation-workbench/SKILL.md`. It describes editing, configuration, running, feedback processing, and verification. Register the containing skill directory with your agent or copy the skill to its supported skill location. OpenCode supports a `skills.paths` setting; restart OpenCode after changing its skill registration.

The skill supplies workflow instructions. The Nix app supplies tested executable behavior. Neither requires agents to recreate the viewer in every project.
