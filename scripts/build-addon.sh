#!/usr/bin/env bash
set -euo pipefail

mkdir -p dist
yarn build:lua
cp SteamDeckUI.toc dist/
cp LICENSE dist/
cp README.md dist/
