#!/usr/bin/env bash
# Builds whisper-server for one target and engine variant into resources/bin/<target>/.
#
#   usage: build-whisper.sh <target> <variant>
#   target:  mac-arm64 | mac-x64
#   variant: metal (mac-arm64) | cpu (mac-x64)
#
# Needs WHISPER_REF (a whisper.cpp tag such as v1.9.5), git and cmake. Also copies the sample
# clip to resources/bin/<target>/samples/jfk.wav (the speed test and the self-test use it).
set -euo pipefail

target="${1:?usage: build-whisper.sh <target> <variant>}"
variant="${2:?usage: build-whisper.sh <target> <variant>}"
: "${WHISPER_REF:?set WHISPER_REF to a whisper.cpp tag, for example v1.9.5}"

here="$(cd "$(dirname "$0")" && pwd)"
app="$(cd "$here/.." && pwd)"
out="$app/resources/bin/$target"
work="$app/.build/whisper-$target-$variant"

# Flags per target and variant (the table in PHASE-A-DESKTOP.md, M7.1).
extra=()
case "$target-$variant" in
  mac-arm64-metal) extra=(-DGGML_METAL=ON -DCMAKE_OSX_ARCHITECTURES=arm64 -DCMAKE_OSX_DEPLOYMENT_TARGET=11.0) ;;
  mac-x64-cpu) extra=(-DGGML_METAL=OFF -DCMAKE_OSX_ARCHITECTURES=x86_64 -DCMAKE_OSX_DEPLOYMENT_TARGET=10.15) ;;
  *) echo "build-whisper.sh: no build for $target $variant" >&2; exit 2 ;;
esac

rm -rf "$work"
mkdir -p "$work"
git clone --depth 1 --branch "$WHISPER_REF" https://github.com/ggml-org/whisper.cpp "$work/src"

# GGML_NATIVE=OFF: no CPU instructions only this build machine has. GGML_OPENMP=OFF and static
# libraries: the user needs no extra libraries.
cmake -S "$work/src" -B "$work/build" \
  -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_SHARED_LIBS=OFF \
  -DWHISPER_BUILD_EXAMPLES=ON \
  -DWHISPER_BUILD_SERVER=ON \
  -DWHISPER_BUILD_TESTS=OFF \
  -DGGML_NATIVE=OFF \
  -DGGML_OPENMP=OFF \
  ${extra[@]+"${extra[@]}"}
cmake --build "$work/build" --config Release --target whisper-server -j

bin="$(find "$work/build" -name "whisper-server" -type f | head -n 1)"
if [ -z "$bin" ]; then
  echo "build-whisper.sh: whisper-server was not produced" >&2
  exit 1
fi
mkdir -p "$out/whisper/$variant" "$out/samples"
cp "$bin" "$out/whisper/$variant/whisper-server"
cp "$work/src/samples/jfk.wav" "$out/samples/jfk.wav"
echo "built $out/whisper/$variant/whisper-server"
