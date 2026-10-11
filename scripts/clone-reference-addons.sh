#!/usr/bin/env bash
set -euo pipefail

clone_reference() {
  local repository="$1"
  local destination="$2"

  if [[ -d "$destination" ]]; then
    echo "Skipping $destination: directory already exists"
    return
  fi

  git clone --depth 1 "$repository" "$destination"
  rm -rf "$destination/.git"
}

# Clone ConsolePort for reference.
clone_reference https://github.com/seblindfors/ConsolePort .libraries/ConsolePort

# Clone BetterBags for reference.
clone_reference https://github.com/Cidan/BetterBags .libraries/BetterBags

# Clone wow-ui-source for Blizzard UI source code.
if [[ -d .libraries/wow-ui-source ]]; then
  echo "Skipping .libraries/wow-ui-source: directory already exists"
else
  clone_reference https://github.com/Gethe/wow-ui-source .libraries/wow-ui-source
  # Keep only the Interface folder, delete everything else.
  find .libraries/wow-ui-source -mindepth 1 -maxdepth 1 ! -name 'Interface' -exec rm -rf {} +
fi
