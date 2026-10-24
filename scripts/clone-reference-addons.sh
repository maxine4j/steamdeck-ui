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

# Group finder, item collection, inventory, and navigation references.
clone_reference https://github.com/0xbs/premade-groups-filter .libraries/PremadeGroupsFilter
clone_reference https://github.com/klaufel/ItemEra .libraries/ItemEra
clone_reference https://github.com/ahakola/AlreadyKnown .libraries/AlreadyKnown
clone_reference https://github.com/Peterodox/Plumber .libraries/Plumber
clone_reference https://github.com/typicalzergling/vendor .libraries/Vendor
clone_reference https://github.com/Adaptvx/Waypoint-UI .libraries/WaypointUI

# Error capture and display references only; never bundled with the addon.
clone_reference https://github.com/funkydude/BugSack .libraries/BugSack

# CurseForge's official BugGrabber source repository is Subversion,
# with these source files available over HTTPS.
mkdir -p .libraries/BugGrabber-source
for file in BugGrabber.lua '!BugGrabber.toc' load.xml .pkgmeta .luacheckrc; do
  if [[ ! -s ".libraries/BugGrabber-source/$file" ]]; then
    curl --fail --location --silent --show-error \
      "https://repos.curseforge.com/wow/bug-grabber/trunk/$file" \
      --output ".libraries/BugGrabber-source/$file"
  fi
done

# Clone DialogueUI for refernece.
clone_reference https://github.com/Peterodox/YUI-Dialogue .libraries/DialogueUI

clone_reference https://github.com/kevinclement/SimpleArmory.git .libraries/SimpleArmory

# Clone wow-ui-source for Blizzard UI source code.
if [[ -d .libraries/wow-ui-source ]]; then
  echo "Skipping .libraries/wow-ui-source: directory already exists"
else
  clone_reference https://github.com/Gethe/wow-ui-source .libraries/wow-ui-source
  # Keep only the Interface folder, delete everything else.
  find .libraries/wow-ui-source -mindepth 1 -maxdepth 1 ! -name 'Interface' -exec rm -rf {} +
fi
