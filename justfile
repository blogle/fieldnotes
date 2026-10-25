set shell := ["bash", "-euo", "pipefail", "-c"]

check:
    npm test
    sdlc install --check
    sdlc changelog check

ci-check:
    nix build --no-link .#ci.x86_64-linux.check.syntax .#ci.x86_64-linux.check.contracts

ci-verify:
    nix build --no-link .#ci.x86_64-linux.verify.integration .#ci.x86_64-linux.verify.browser .#ci.x86_64-linux.verify.publisher .#ci.x86_64-linux.verify.package

serve:
    nix run . -- --root docs --project .

changelog action="check":
    sdlc changelog {{action}}
