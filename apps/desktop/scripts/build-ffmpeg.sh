#!/usr/bin/env bash
# Builds a small LGPL FFmpeg (ffmpeg only, no GPL or nonfree parts) into resources/bin/<target>/.
#
#   usage: build-ffmpeg.sh <target>
#   target: mac-arm64 | mac-x64 | win-x64 | linux-x64
#
# Needs FFMPEG_REF (an FFmpeg tag such as n9.0.2), git, make, nasm and pkg-config. Windows: run in
# an MSYS2 MINGW64 shell. The exact configure line is saved next to the binary (the LGPL asks for it).
set -euo pipefail

target="${1:?usage: build-ffmpeg.sh <target>}"
: "${FFMPEG_REF:?set FFMPEG_REF to an FFmpeg tag, for example n9.0.2}"

here="$(cd "$(dirname "$0")" && pwd)"
app="$(cd "$here/.." && pwd)"
out="$app/resources/bin/$target"
work="$app/.build/ffmpeg-$target"
exe=""
case "$target" in win-*) exe=".exe" ;; esac

case "$target" in
  mac-arm64) tls="--enable-securetransport --extra-cflags=-mmacosx-version-min=11.0 --extra-ldflags=-mmacosx-version-min=11.0" ;;
  mac-x64) tls="--enable-securetransport --extra-cflags=-mmacosx-version-min=10.15 --extra-ldflags=-mmacosx-version-min=10.15" ;;
  win-x64) tls="--enable-schannel --extra-ldflags=-static --target-os=mingw32 --arch=x86_64" ;;
  linux-x64) tls="--enable-openssl --enable-version3" ;;
  *) echo "build-ffmpeg.sh: unknown target $target" >&2; exit 2 ;;
esac

common="--disable-everything --disable-autodetect --disable-doc --disable-debug \
  --disable-ffplay --disable-ffprobe --disable-avdevice --disable-swscale \
  --enable-small --enable-static --disable-shared --enable-ffmpeg --enable-network \
  --enable-protocol=file,pipe,http,https,tcp,tls,crypto \
  --enable-demuxer=mov,mp3,aac,ogg,flac,wav,matroska,hls,mpegts \
  --enable-decoder=aac,aac_latm,mp3,mp3float,opus,vorbis,flac,alac,pcm_s16le \
  --enable-parser=aac,aac_latm,mpegaudio,opus,vorbis,flac \
  --enable-bsf=aac_adtstoasc \
  --enable-encoder=pcm_s16le --enable-muxer=pcm_s16le \
  --enable-filter=aresample,aformat,anull,atrim,abuffer,abuffersink"

rm -rf "$work"
mkdir -p "$work"
git clone --depth 1 --branch "$FFMPEG_REF" https://github.com/FFmpeg/FFmpeg "$work/src"
cd "$work/src"

# $common and $tls are word lists on purpose: they are split into options here.
# shellcheck disable=SC2086
configure_line="./configure $common $tls"
eval "$configure_line"
make -j
strip "ffmpeg$exe" || true

mkdir -p "$out"
cp "ffmpeg$exe" "$out/ffmpeg$exe"
printf '%s\n' "$configure_line" > "$out/FFMPEG_BUILD.txt"
echo "built $out/ffmpeg$exe"
