{
  description = "Fieldnotes — Markdown/HTML documentation, review, and offline sharing";

  inputs.sdlc.url = "github:blogle/sdlc/v2";
  inputs.nixpkgs.follows = "sdlc/nixpkgs-latest";

  outputs = { self, nixpkgs, sdlc, ... }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      agentSkills = sdlc.lib.skills;
      skillsIntegration = system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          sources = {
            sdlc = { path = sdlc; subdir = "skills"; };
            fieldnotes = { path = self; subdir = "skills"; };
          };
          catalog = agentSkills.discoverCatalog sources;
          allowlist = agentSkills.allowlistFor {
            inherit catalog sources;
            enable = [ "sdlc" "fieldnotes" ];
          };
          selection = agentSkills.selectSkills {
            inherit catalog sources allowlist;
            skills = { };
          };
          bundle = agentSkills.mkBundle { inherit pkgs selection; };
          targets = {
            agents = agentSkills.defaultLocalTargets.agents // { enable = true; };
          };
          install = agentSkills.mkLocalInstallProgram { inherit pkgs bundle targets; };
        in {
          apps.skills-install-local = {
            type = "app";
            program = "${install}/bin/skills-install-local";
          };
          checks.skills-install = pkgs.runCommand "fieldnotes-skills-install" { nativeBuildInputs = [ install ]; } ''
            mkdir -p work
            cd work
            ${install}/bin/skills-install-local
            test -f .agents/skills/fieldnotes/SKILL.md
            test -f .agents/skills/sdlc/SKILL.md
            ${install}/bin/skills-install-local
            test -f .agents/skills/.agent-skills-managed.json
            touch $out
          '';
        };
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
            npmDepsHash = "sha256-xZJ/B173+ikBPLXTl2av314l8FzbavaPIC5PFCzOFT0=";
            dontNpmBuild = true;
            npmFlags = [ "--omit=dev" ];
            nativeBuildInputs = [ pkgs.makeWrapper ];
            installPhase = ''
              runHook preInstall
              mkdir -p $out/lib/fieldnotes/docs $out/bin $out/share/fieldnotes
              cp server.js package.json $out/lib/fieldnotes/
              cp -r lib node_modules $out/lib/fieldnotes/
              cp -r docs/assets $out/lib/fieldnotes/docs/
              cp -r skills $out/share/fieldnotes/
              makeWrapper ${pkgs.nodejs_22}/bin/node $out/bin/fieldnotes \
                --add-flags "$out/lib/fieldnotes/server.js" \
                --prefix PATH : ${pkgs.lib.makeBinPath [ pkgs.git ]}
              runHook postInstall
            '';
            meta.mainProgram = "fieldnotes";
          };
        in { default = viewer; fieldnotes = viewer; }
          // nixpkgs.lib.optionalAttrs (sdlc.packages ? ${system}) { sdlc = sdlc.packages.${system}.sdlc; });

      ci = nixpkgs.lib.genAttrs [ "x86_64-linux" ] (system:
        sdlc.lib.mkConsumer (import ./ci.nix { inherit self system sdlc; pkgs = nixpkgs.legacyPackages.${system}; }));

      apps = nixpkgs.lib.genAttrs systems (system:
        {
          default = { type = "app"; program = "${self.packages.${system}.default}/bin/fieldnotes"; };
        } // (skillsIntegration system).apps);

      checks = nixpkgs.lib.genAttrs [ "x86_64-linux" ] (system: (skillsIntegration system).checks);

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
