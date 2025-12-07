#!/usr/bin/env bash
set -e
PROJECT_ROOT=$(cd "$(dirname "$0")/.." && pwd)
PYTHON=${PYTHON:-python3}
VENV_DIR=${VENV_DIR:-$PROJECT_ROOT/.venv}

echo "Creating virtualenv at $VENV_DIR using $PYTHON"
$PYTHON -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"
python -m pip install --upgrade pip
pip install -r "$PROJECT_ROOT/01_WSI_inference_OPENSLIDE_QC/requirements.txt"

echo "Virtualenv ready. Activate with: source $VENV_DIR/bin/activate" 
