#!/usr/bin/env bash
set -e
# Usage: ./scripts/run_pipeline_local.sh /path/to/slide.svs
if [ -z "$1" ]; then
  echo "Usage: $0 /path/to/slide.svs"
  exit 1
fi
SLIDE="$1"
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT_DIR="$ROOT/01_WSI_inference_OPENSLIDE_QC/output/local_run_$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT_DIR/slides_in"
cp "$SLIDE" "$OUT_DIR/slides_in/"
source "$ROOT/.venv/bin/activate" || true
python "$ROOT/01_WSI_inference_OPENSLIDE_QC/wsi_tis_detect.py" --slide_folder "$OUT_DIR/slides_in" --output_dir "$OUT_DIR"
python "$ROOT/01_WSI_inference_OPENSLIDE_QC/main.py" --slide_folder "$OUT_DIR/slides_in" --output_dir "$OUT_DIR" --mpp_model 1.5 --create_geojson Y

echo "Pipeline finished. Output: $OUT_DIR"