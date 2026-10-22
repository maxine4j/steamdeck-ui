#!/usr/bin/env bash
set -euo pipefail

./scripts/clone-reference-addons.sh

WOW_RETAIL_VERSION="12.1.0"
OUTPUT_FILE='../../src/wow.d.ts' # relative to .libraries/wow-ts-decl

# checkout repo locally and/or ensure its up to date
REPO_URL="https://github.com/maxine4j/wow-ts-decl"
REPO_DIR=".libraries/wow-ts-decl"
if [ ! -d "$REPO_DIR" ]; then
    echo "✅ '$REPO_DIR' does not exist. cloning repository..."
    git clone "$REPO_URL" "$REPO_DIR"
    rm -rf "$REPO_DIR/.git"
    rm -rf "$REPO_DIR/biome.json"
else
    echo "✅ '$REPO_DIR' already exists"
fi

# enter repo dir and activate tooling
cd "$REPO_DIR"
yarn

# ensure playwright is installed
npx playwright install
mkdir -p .cache/wiki .tmp dist

# generate declarations
echo "scraping wow ui source...." >&2
NODE_OPTIONS="--max-old-space-size=8192" ./scripts/scrape-wow-ui-source.ts "$WOW_RETAIL_VERSION"
# echo "scraping warcraft wiki...." >&2
# NODE_OPTIONS="--max-old-space-size=8192" ./scripts/scrape-warcraft-wiki.ts
echo "✅ all sources scraped" >&2
NODE_OPTIONS="--max-old-space-size=8192" ./scripts/merge-sources.ts "$WOW_RETAIL_VERSION"
NODE_OPTIONS="--max-old-space-size=8192" ./scripts/emit-declarations.ts "$WOW_RETAIL_VERSION" > "$OUTPUT_FILE"
echo "✅ type declarations emited" >&2
