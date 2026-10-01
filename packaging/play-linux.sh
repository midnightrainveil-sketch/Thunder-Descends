#!/usr/bin/env sh
# Thunder Descends - opens the game in your default browser (Chrome, Chromium or Firefox with WebGL2).
DIR="$(cd "$(dirname "$0")" && pwd)"
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$DIR/index.html" >/dev/null 2>&1 &
else
  for b in google-chrome chromium chromium-browser firefox; do
    if command -v "$b" >/dev/null 2>&1; then "$b" "$DIR/index.html" >/dev/null 2>&1 & exit 0; fi
  done
  echo "Open $DIR/index.html in a web browser."
fi
