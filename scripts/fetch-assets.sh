#!/usr/bin/env sh
# scripts/fetch-assets.sh
#
# Fetch Hogan.js / highlight.js browser runtimes into static/js/ so help
# pages never hit a CDN at runtime. Tries multiple mirrors in order until
# one succeeds.
#
# Usage:        sh scripts/fetch-assets.sh
# Force re-DL:  FORCE=1 sh scripts/fetch-assets.sh

set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JS_DIR="$ROOT/static/js"
CSS_DIR="$ROOT/static/css"

mkdir -p "$JS_DIR" "$CSS_DIR"

# Try each URL in $@ until one works. Writes to $dest.
# Non-2xx responses or curl errors cause the next URL to be tried.
try_fetch() {
    dest="$1"
    shift
    if [ -s "$dest" ] && [ "${FORCE:-0}" != "1" ]; then
        echo "skip (exists): ${dest#$ROOT/}"
        return 0
    fi
    for url in "$@"; do
        echo "fetch  $url"
        if curl -fsSL --retry 3 --connect-timeout 15 --max-time 60 -o "$dest.tmp" "$url"; then
            mv "$dest.tmp" "$dest"
            echo "       -> ${dest#$ROOT/} ($(wc -c < "$dest") bytes)"
            return 0
        fi
        rm -f "$dest.tmp"
        echo "       (failed, trying next source)"
    done
    echo "ERROR: all sources failed for ${dest#$ROOT/}" >&2
    return 1
}

# hogan.js 3.0.2 — full browser bundle (Hogan.compile + Hogan.Template)
try_fetch "$JS_DIR/hogan.min.js" \
    "https://cdnjs.cloudflare.com/ajax/libs/hogan.js/3.0.2/hogan.min.js" \
    "https://unpkg.com/hogan.js@3.0.2/web/1.0.5-3.0.2.min.js" \
    "https://cdn.jsdelivr.net/gh/twitter/hogan.js@v3.0.2/web/1.0.5-3.0.2.min.js"

# highlight.js 11.9.0 — common-language browser bundle
try_fetch "$JS_DIR/highlight.min.js" \
    "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js" \
    "https://unpkg.com/@highlightjs/cdn-assets@11.9.0/highlight.min.js" \
    "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js"

echo
echo "assets:"
ls -l "$JS_DIR/hogan.min.js" "$JS_DIR/highlight.min.js"
