#!/usr/bin/env bash
set -euo pipefail

# clone console port for reference
git clone --depth 1 https://github.com/seblindfors/ConsolePort .libraries/ConsolePort
cd .libraries/ConsolePort
# Remove .git directory
rm -rf .git
cd ../..

# better bags for reference
git clone --depth 1 https://github.com/Cidan/BetterBags .libraries/BetterBags
cd .libraries/BetterBags
# Remove .git directory
rm -rf .git
cd ../..
