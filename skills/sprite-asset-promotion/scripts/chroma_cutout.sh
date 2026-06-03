#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: chroma_cutout.sh <source.png> <out.png>" >&2
  exit 2
fi

src="$1"
out="$2"

if [[ ! -f "$src" ]]; then
  echo "Source not found: $src" >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required for chroma-key cutout" >&2
  exit 1
fi

mkdir -p "$(dirname "$out")"

ffmpeg -y -v error \
  -i "$src" \
  -vf "chromakey=0x00ff00:0.08:0.03,format=rgba" \
  "$out"

if command -v sips >/dev/null 2>&1; then
  sips -g pixelWidth -g pixelHeight -g hasAlpha "$out"
fi
