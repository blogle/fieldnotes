{ self, pkgs, system, sdlc }:
let
  viewer = self.packages.${system}.default;
  dependencies = viewer.overrideAttrs (_: {
    pname = "fieldnotes-test-dependencies";
    npmFlags = [ ];
    installPhase = ''
      mkdir -p $out
      cp -r node_modules $out/
    '';
  });
  prepare = ''
    export HOME=$TMPDIR/home
    mkdir -p "$HOME"
    cp -r ${viewer.src} source
    chmod -R u+w source
    cd source
    ln -s ${dependencies}/node_modules node_modules
  '';
  test = name: inputs: script: pkgs.runCommand name {
    nativeBuildInputs = [ pkgs.nodejs_22 pkgs.git pkgs.python3 ] ++ inputs;
  } (prepare + script + "\ntouch $out\n");
  publish = pkgs.writeShellApplication {
    name = "fieldnotes-publish";
    runtimeInputs = [ pkgs.python3 pkgs.git pkgs.gh ];
    text = ''exec python3 ${./scripts/publish.py}'';
  };
in {
  check = {
    syntax = test "fieldnotes-syntax" [ pkgs.actionlint ] ''
      for file in server.js lib/*.js docs/assets/*.js docs/spec/screens/*.js tests/*.mjs; do
        node --check "$file"
      done
      python3 -m py_compile scripts/publish.py tests/test_publish.py
      actionlint .github/workflows/*.yml
    '';
    contracts = test "fieldnotes-contracts" [ sdlc.packages.${system}.sdlc ] ''
      node --input-type=module -e 'import {readConfig} from "./lib/config.js"; await readConfig("docs/fieldnotes.json")'
      sdlc install --check
      sdlc changelog check
    '';
  };
  verify = {
    integration = test "fieldnotes-integration" [ ] ''npm test'';
    browser = test "fieldnotes-browser" [ pkgs.chromium ] ''
      export CHROMIUM=${pkgs.chromium}/bin/chromium
      export FONTCONFIG_FILE=${pkgs.makeFontsConf { fontDirectories = [ pkgs.dejavu_fonts ]; }}
      npm run test:browser
    '';
    publisher = test "fieldnotes-publisher" [ ] ''python3 -m unittest discover -s tests -p 'test_publish.py' -v'';
    package = pkgs.runCommand "fieldnotes-package" { nativeBuildInputs = [ pkgs.nodejs_22 ]; } ''
      export FIELDNOTES=${viewer}/bin/fieldnotes
      node ${./tests/package.mjs}
      touch $out
    '';
  };
  publish = { type = "app"; program = "${publish}/bin/fieldnotes-publish"; };
}
