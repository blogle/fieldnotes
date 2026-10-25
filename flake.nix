{
  description = "Fieldnotes — Markdown/HTML documentation, review, and offline sharing";

  inputs.sdlc.url = "github:blogle/sdlc/v2";
  inputs.nixpkgs.follows = "sdlc/nixpkgs-latest";

  outputs = { self, nixpkgs, sdlc, ... }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
    in
    {
      packages = nixpkgs.lib.genAttrs systems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          viewer = pkgs.buildNpmPackage {
            pname = "fieldnotes";
            version = "0.1.0";
            src = pkgs.lib.cleanSourceWith {
              src = ./.;
              filter = path: type: pkgs.lib.cleanSourceFilter path type
                && !(builtins.elem (baseNameOf path) [ "node_modules" "result" "test-results" "__pycache__" ]);
            };
            nodejs = pkgs.nodejs_22;
            npmDepsHash = "sha256-eUJpG+mvYaeBKmcnwVKr7MY0yEL+C6mbJR8Slbk4ruY=";
            dontNpmBuild = true;
            npmFlags = [ "--omit=dev" ];
            nativeBuildInputs = [ pkgs.makeWrapper ];
            installPhase = ''
              runHook preInstall
              mkdir -p $out/lib/workbench/docs $out/bin $out/share/workbench
              cp server.js package.json $out/lib/workbench/
              cp -r lib node_modules $out/lib/workbench/
              cp -r docs/assets $out/lib/workbench/docs/
              cp -r skills $out/share/workbench/
              makeWrapper ${pkgs.nodejs_22}/bin/node $out/bin/workbench \
                --add-flags "$out/lib/workbench/server.js" \
                --prefix PATH : ${pkgs.lib.makeBinPath [ pkgs.git ]}
              ln -s workbench $out/bin/fieldnotes
              runHook postInstall
            '';
            meta.mainProgram = "workbench";
          };
        in { default = viewer; workbench = viewer; fieldnotes = viewer; }
          // nixpkgs.lib.optionalAttrs (sdlc.packages ? ${system}) { sdlc = sdlc.packages.${system}.sdlc; });

      ci = nixpkgs.lib.genAttrs [ "x86_64-linux" ] (system:
        sdlc.lib.mkConsumer (import ./ci.nix { inherit self system sdlc; pkgs = nixpkgs.legacyPackages.${system}; }));

      apps = nixpkgs.lib.genAttrs systems (system: {
        default = { type = "app"; program = "${self.packages.${system}.default}/bin/workbench"; };
      });

      devShells = nixpkgs.lib.genAttrs systems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.mkShell {
            packages = [ pkgs.nodejs_22 pkgs.git pkgs.just pkgs.gh pkgs.actionlint pkgs.python3 ]
              ++ nixpkgs.lib.optionals (sdlc.packages ? ${system}) [ sdlc.packages.${system}.sdlc ];
          };
        });
    };
}
