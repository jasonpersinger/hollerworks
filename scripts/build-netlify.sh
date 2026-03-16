#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

cp "$ROOT_DIR/index.html" "$DIST_DIR/index.html"
cp "$ROOT_DIR/robots.txt" "$DIST_DIR/robots.txt"

if [ -d "$ROOT_DIR/assets" ]; then
  rsync -a "$ROOT_DIR/assets/" "$DIST_DIR/assets/"
fi
