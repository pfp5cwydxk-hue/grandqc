#!/bin/bash
# Wrapper script to run Python with venv activated
set -e

# Detect repo root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Activate venv
source "$SCRIPT_DIR/.venv/bin/activate"

# Run the Python script with all arguments
python3 "$@"
