#!/usr/bin/env bash
# Downloads the models used for AI subtitles into $ECHO_WEB_DATA/models (default ~/.echo-web/models).
# Needs whisper-server and ffmpeg: `brew install whisper-cpp ffmpeg`.
set -euo pipefail

DATA_DIR="${ECHO_WEB_DATA:-$HOME/.echo-web}"
DATA_DIR="${DATA_DIR/#\~/$HOME}"
MODELS="$DATA_DIR/models"
mkdir -p "$MODELS"

download() {
  local url="$1" file="$2"
  if [[ -s "$MODELS/$file" ]]; then
    echo "✓ $file already present"
    return
  fi
  echo "↓ $file"
  curl -fL --retry 3 --progress-bar -o "$MODELS/$file.part" "$url"
  mv "$MODELS/$file.part" "$MODELS/$file"
}

# Speech-to-text (large-v3-turbo, 5-bit quantised, about 550 MB). Good Japanese, fast on Apple GPUs.
download "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin" "ggml-large-v3-turbo-q5_0.bin"
# Voice activity detection: skips silence and breathing, where Whisper tends to invent text.
download "https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin" "ggml-silero-v5.1.2.bin"

for bin in whisper-server ffmpeg; do
  command -v "$bin" >/dev/null || echo "! $bin not found. Install it with: brew install whisper-cpp ffmpeg"
done
echo "Models are in $MODELS"
