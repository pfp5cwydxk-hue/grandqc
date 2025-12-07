#!/bin/bash
# Complete GrandQC pipeline wrapper
# Runs tissue detection, QC analysis, report generation, and overlay creation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

usage() {
    cat << EOF
Usage: $0 --slide_path <path_to_slide> [OPTIONS]

Required:
  --slide_path PATH          Path to WSI slide file (.svs, .ndpi, .tiff)

Optional:
  --output_dir DIR           Output directory (default: ./output/pipeline_<timestamp>)
  --mpp_model MPP            Model magnification: 1.0, 1.5 (default), or 2.0
  --create_geojson Y/N       Create GeoJSON annotations (default: Y)
  --no_report                Skip HTML report generation
  --no_overlays              Skip overlay image generation
  --verbose                  Show detailed output

Example:
  $0 --slide_path ./slide.svs --mpp_model 1.5 --output_dir ./results

EOF
    exit 1
}

# Parse arguments
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SLIDE_PATH=""
OUTPUT_DIR=""
MPP_MODEL="1.5"
CREATE_GEOJSON="Y"
SKIP_REPORT=0
SKIP_OVERLAYS=0
VERBOSE=0

while [[ $# -gt 0 ]]; do
    case $1 in
        --slide_path)
            SLIDE_PATH="$2"
            shift 2
            ;;
        --output_dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --mpp_model)
            MPP_MODEL="$2"
            shift 2
            ;;
        --create_geojson)
            CREATE_GEOJSON="$2"
            shift 2
            ;;
        --no_report)
            SKIP_REPORT=1
            shift
            ;;
        --no_overlays)
            SKIP_OVERLAYS=1
            shift
            ;;
        --verbose)
            VERBOSE=1
            shift
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate required arguments
if [ -z "$SLIDE_PATH" ]; then
    echo -e "${RED}Error: --slide_path is required${NC}"
    usage
fi

# Check if slide file exists
if [ ! -f "$SLIDE_PATH" ]; then
    echo -e "${RED}Error: Slide file not found: $SLIDE_PATH${NC}"
    exit 1
fi

# Create output directory
if [ -z "$OUTPUT_DIR" ]; then
    OUTPUT_DIR="$SCRIPT_DIR/output/pipeline_$(date +%Y%m%d-%H%M%S)"
fi
mkdir -p "$OUTPUT_DIR/slides_in"

# Copy slide to output directory
SLIDE_FILENAME=$(basename "$SLIDE_PATH")
cp "$SLIDE_PATH" "$OUTPUT_DIR/slides_in/"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          GrandQC Pipeline Execution Started            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  Input slide: $SLIDE_FILENAME"
echo "  Output dir: $OUTPUT_DIR"
echo "  MPP model: $MPP_MODEL"
echo "  Create GeoJSON: $CREATE_GEOJSON"
echo ""

# Step 1: Tissue Detection
echo -e "${BLUE}Step 1/4: Tissue Detection${NC}"
python "$SCRIPT_DIR/wsi_tis_detect.py" \
    --slide_folder "$OUTPUT_DIR/slides_in" \
    --output_dir "$OUTPUT_DIR"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Tissue detection completed${NC}"
else
    echo -e "${RED}✗ Tissue detection failed${NC}"
    exit 1
fi
echo ""

# Step 2: QC Analysis
echo -e "${BLUE}Step 2/4: Quality Control Analysis${NC}"
python "$SCRIPT_DIR/main.py" \
    --slide_folder "$OUTPUT_DIR/slides_in" \
    --output_dir "$OUTPUT_DIR" \
    --mpp_model "$MPP_MODEL" \
    --create_geojson "$CREATE_GEOJSON"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ QC analysis completed${NC}"
else
    echo -e "${RED}✗ QC analysis failed${NC}"
    exit 1
fi
echo ""

# Step 3: Report Generation
if [ $SKIP_REPORT -eq 0 ]; then
    echo -e "${BLUE}Step 3/4: HTML Report Generation${NC}"
    python "$SCRIPT_DIR/generate_report.py" --output_dir "$OUTPUT_DIR"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Report generated${NC}"
    else
        echo -e "${YELLOW}⚠ Report generation encountered issues${NC}"
    fi
    echo ""
else
    echo -e "${YELLOW}Step 3/4: Skipped (--no_report)${NC}"
    echo ""
fi

# Step 4: Overlay Generation
if [ $SKIP_OVERLAYS -eq 0 ]; then
    echo -e "${BLUE}Step 4/4: Visual Overlay Generation${NC}"
    python "$SCRIPT_DIR/generate_overlays.py" --output_dir "$OUTPUT_DIR"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Overlays generated${NC}"
    else
        echo -e "${YELLOW}⚠ Overlay generation encountered issues${NC}"
    fi
    echo ""
else
    echo -e "${YELLOW}Step 4/4: Skipped (--no_overlays)${NC}"
    echo ""
fi

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Pipeline Execution Complete                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Output files available in:${NC}"
echo "  $OUTPUT_DIR"
echo ""
echo -e "${YELLOW}Generated files:${NC}"
echo "  • Tissue masks: tis_det_mask/"
echo "  • QC masks: mask_qc/"
echo "  • Overlays: overlays_qc/"
echo "  • Visualizations: visualization_overlays/"
if [ $SKIP_REPORT -eq 0 ]; then
    echo "  • HTML report: report.html"
fi
if [ -d "$OUTPUT_DIR/geojson_qc" ] && [ "$(ls -A $OUTPUT_DIR/geojson_qc)" ]; then
    echo "  • GeoJSON annotations: geojson_qc/"
fi
echo ""
echo -e "${GREEN}Open the report: open $OUTPUT_DIR/report.html${NC}"
echo ""
