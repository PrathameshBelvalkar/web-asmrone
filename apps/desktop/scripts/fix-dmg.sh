#!/usr/bin/env bash
# Hides the installer's background and volume-icon files, so they do not appear in the window
# people drag Echo from. Then updates latest-mac.yml with the new checksum and size.
#
#   usage: fix-dmg.sh <path to the .dmg>      (macOS only; run after electron-builder)
set -euo pipefail

dmg="${1:?usage: fix-dmg.sh <dmg>}"
dir="$(cd "$(dirname "$dmg")" && pwd)"
name="$(basename "$dmg")"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

hdiutil convert "$dmg" -format UDRW -o "$work/rw.dmg" >/dev/null
mkdir -p "$work/mnt"
hdiutil attach "$work/rw.dmg" -nobrowse -noverify -mountpoint "$work/mnt" >/dev/null
for f in .background.tiff .VolumeIcon.icns .DS_Store; do
  if [ -e "$work/mnt/$f" ]; then chflags hidden "$work/mnt/$f"; fi
done
hdiutil detach "$work/mnt" >/dev/null

rm -f "$dmg"
hdiutil convert "$work/rw.dmg" -format UDZO -imagekey zlib-level=9 -o "$dmg" >/dev/null

node "$(dirname "$0")/update-mac-manifest.mjs" "$dir" "$name"
echo "fix-dmg: hidden files set in $name, manifest updated"
