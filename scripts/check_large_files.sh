#!/usr/bin/env bash
# Simple helper to list large files in repo
set -e
echo "Large files (>10M):"
find . -type f -size +10M -exec du -h {} + | sort -hr | sed -n '1,200p'
