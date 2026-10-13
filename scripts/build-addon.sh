#!/usr/bin/env bash
set -euo pipefail

mkdir -p dist
yarn build:lua
toc_name="SteamDeckUI"
if [[ "${1:-}" == "dev" ]]; then
	toc_name="SteamDeckUI-dev"
fi
node "$(dirname "${BASH_SOURCE[0]}")/configure-addon-assets.mjs" dist/main.lua "$toc_name"
rm -f dist/SteamDeckUI.toc dist/SteamDeckUI-dev.toc
if [[ "${1:-}" == "dev" ]]; then
	sed 's/^## Title:.*$/## Title: SteamDeckUI-dev/' SteamDeckUI.toc > "dist/${toc_name}.toc"
else
	cp SteamDeckUI.toc "dist/${toc_name}.toc"
fi
cp LICENSE dist/
cp README.md dist/
cp -R assets dist/
