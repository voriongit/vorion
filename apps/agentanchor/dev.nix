{ pkgs, ... }: {
  # Nix channel to use.
  channel = "stable-24.05";

  # Packages to install.
  packages = [
    pkgs.nodejs_20
    pkgs.firebase-tools
    pkgs.zip
  ];

  # Workspace lifecycle hooks.
  idx = {
    # VS Code extensions to install.
    extensions = [
      "dbaeumer.vscode-eslint"
    ];
    workspace = {
      # Runs when a workspace is first created.
      onCreate = {
        npm-install = "npm install";
      };
      # Runs every time the workspace is (re)started.
      onStart = {
        dev-server = "npm run dev";
      };
    };
    # Configure a web preview for your application.
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["npm" "run" "dev" "--" "--port" "$PORT" "--hostname" "127.0.0.1"];
          manager = "web";
        };
      };
    };
  };
}
