#!/usr/bin/env bash
# Rebuild the bundled terminal-symbol subset in web/public/fonts/.
#
# NOT part of the build, for the same reason scripts/build-nerd-font.sh is not: a webfont is a
# release artifact, not a build step. This needs Python + fonttools + brotli, and the .woff2 file is
# committed. Run it only to move to a new JuliaMono release or to change RANGES, then update the
# filename in web/src/index.css and FONT_URLS in web/src/lib/sw-routes.ts. A new range needs a new
# filename too: public/ assets are unhashed and the SW caches them forever by URL.
#
# Agents draw their chrome from two blocks phones mostly lack: Claude Code's ⎿ tool results, ⏺
# bullets, ⏵⏵ mode line and ⏸ pause are Miscellaneous Technical (U+2300-23FF); its ⧉ selection and
# ⧖ marks are Miscellaneous Mathematical Symbols-B (U+2980-29FF). JuliaMono covers both blocks and
# is monospace, so each glyph fills one terminal cell, and a phone that would draw ⏺ as a colour
# emoji draws the terminal's glyph instead.
#
# RANGES leaves out the block's East Asian Wide codepoints — ⌚⌛ 〈〉 ⏩⏪⏫⏬ ⏰ ⏳, the emoji-default
# ones and the two angle brackets. A terminal gives each of those two cells, so a one-cell glyph
# would pull the rest of its row out of line, and the phone's own colour emoji is the right drawing.
#
# JuliaMono is OFL with the Reserved Font Name "JuliaMono", and a subset is a Modified Version, so
# the subset is renamed "Terminal Symbols" inside the file. Copyright and licence records are kept,
# and the licence ships beside it.
#
#   pip install 'fonttools[woff]'
#   scripts/build-tech-font.sh [version]
set -euo pipefail

VERSION="${1:-0.63.2}"
RANGES='U+2300-2319,U+231C-2328,U+232B-23E8,U+23ED-23EF,U+23F1-23F2,U+23F4-23FF,U+2980-29FF'
OUT="$(cd "$(dirname "$0")/.." && pwd)/web/public/fonts"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

command -v pyftsubset >/dev/null || { echo "pyftsubset not found — pip install 'fonttools[woff]'" >&2; exit 1; }

echo "→ fetching JuliaMono v$VERSION"
curl -fsSL -o "$WORK/jm.tar.gz" \
  "https://github.com/cormullion/juliamono/releases/download/v$VERSION/JuliaMono-ttf.tar.gz"
tar xzf "$WORK/jm.tar.gz" -C "$WORK"

pyftsubset "$WORK/JuliaMono-Regular.ttf" --unicodes="$RANGES" --layout-features='' --no-hinting \
  --desubroutinize --output-file="$WORK/subset.ttf"

mkdir -p "$OUT"
IN="$WORK/subset.ttf" DEST="$OUT/terminal-symbols-$VERSION.woff2" python3 - <<'PY'
import os
from fontTools.ttLib import TTFont

font = TTFont(os.environ["IN"])
for rec in font["name"].names:
    # 0 copyright, 7 trademark, 13-14 licence: the OFL requires these kept as they are.
    if rec.nameID in (0, 7, 13, 14):
        continue
    text = rec.toUnicode()
    if "JuliaMono" in text:
        rec.string = text.replace("JuliaMono", "TerminalSymbols" if rec.nameID == 6 else "Terminal Symbols")
font.flavor = "woff2"
font.save(os.environ["DEST"])
PY
cp "$WORK/LICENSE" "$OUT/LICENSE-juliamono.txt"

ls -lh "$OUT"
echo "→ update the filename in web/src/index.css and FONT_URLS in web/src/lib/sw-routes.ts"
