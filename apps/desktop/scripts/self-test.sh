#!/usr/bin/env bash
# Checks the built tools for one target: they run, they decode audio, HTTPS works, and they link
# only system libraries. CPU builds also transcribe the sample with the tiny model.
#
#   usage: self-test.sh <target> [<variant>...]     (variant: cpu, metal)
# Needs WHISPER_REF (for the pinned sample URL). Run after build-ffmpeg.sh and build-whisper.sh.
set -euo pipefail

target="${1:?usage: self-test.sh <target> [variants]}"
shift
: "${WHISPER_REF:?set WHISPER_REF, for example v1.9.5}"
here="$(cd "$(dirname "$0")" && pwd)"
app="$(cd "$here/.." && pwd)"
bin="$app/resources/bin/$target"
ffmpeg="$bin/ffmpeg"
fail() { echo "SELF-TEST FAILED: $*" >&2; exit 1; }

[ -x "$ffmpeg" ] || fail "missing $ffmpeg"
"$ffmpeg" -version >/dev/null || fail "ffmpeg -version"

for v in "$@"; do
  server="$bin/whisper/$v/whisper-server"
  [ -x "$server" ] || fail "missing $server"
  "$server" --help >/dev/null 2>&1 || fail "$server --help"
done

pcm="$("$ffmpeg" -loglevel error -i "$bin/samples/jfk.wav" -vn -ac 1 -ar 16000 -f s16le -c:a pcm_s16le pipe:1 | wc -c | tr -d ' ')"
[ "$pcm" -gt 300000 ] || fail "local decode produced $pcm bytes"

url="https://github.com/ggml-org/whisper.cpp/raw/$WHISPER_REF/samples/jfk.mp3"
net="$("$ffmpeg" -loglevel error -i "$url" -f s16le -ac 1 -ar 16000 pipe:1 | wc -c | tr -d ' ')"
[ "$net" -gt 300000 ] || fail "HTTPS decode produced $net bytes"

bad="$(for f in "$ffmpeg" "$bin"/whisper/*/whisper-server; do otool -L "$f" | tail -n +2 | awk '{print $1}'; done \
  | grep -v -E '^(/usr/lib/|/System/)' || true)"
[ -z "$bad" ] || fail "non-system libraries: $bad"

# CPU builds keep the model in memory, so the transcription can be checked here. GPU builds are
# checked by the app's speed test instead (CI machines have no GPU).
for v in "$@"; do
  [ "$v" = "cpu" ] || continue
  work="$app/.build/self-test-$target"
  mkdir -p "$work"
  model="$work/ggml-tiny-q5_1.bin"
  [ -f "$model" ] || curl -sSfL -o "$model" \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q5_1.bin"
  port=8099
  "$bin/whisper/cpu/whisper-server" -m "$model" --host 127.0.0.1 --port "$port" >"$work/server.log" 2>&1 &
  pid=$!
  trap 'kill $pid 2>/dev/null || true' EXIT
  for _ in $(seq 1 60); do
    curl -s -o /dev/null "http://127.0.0.1:$port/" && break
    sleep 1
  done
  reply="$(curl -s -F "file=@$bin/samples/jfk.wav" -F response_format=text "http://127.0.0.1:$port/inference")"
  kill "$pid" 2>/dev/null || true
  trap - EXIT
  echo "$reply" | grep -qi "country" || fail "cpu transcription did not contain 'country': $reply"
done

echo "SELF-TEST OK for $target"
