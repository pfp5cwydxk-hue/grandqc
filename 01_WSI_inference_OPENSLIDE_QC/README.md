# GrandQC (WSI inference)

This repository contains scripts for whole-slide image (WSI) quality control and tissue detection.

Quick start
-----------
1. Create a Python environment (recommended):

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

2. Prepare folders: put whole-slide images in `slides_in/` and set an `output/` folder.

3. Run tissue detection (example):

```bash
python wsi_tis_detect.py --slide_folder slides_in --output_dir output
```

4. Run QC inference (example):

```bash
python main.py --slide_folder slides_in --output_dir output --mpp_model 1.5
```

What I changed
--------------
- Added `.gitignore` entries for macOS, Python caches, `output/`, and `slides_in/`.
- Added `requirements.txt` with inferred dependencies.
- Main scripts now auto-detect the available device (CUDA, MPS, or CPU) to improve portability.
- Imported `pathology-app` into `external/pathology-app` (no history) and committed.

Next recommended improvements
---------------------------
- Add unit tests for the helpers in `wsi_process.py` and `wsi_maps.py`.
- Add a CLI wrapper or Makefile for common workflows.
- Consider converting long loops in `wsi_process.py` to a batched/pipelined inference to improve GPU utilization.
- Add GitHub Actions to run linting and basic smoke tests.

If you want, I can:
- Add a simple GitHub Action to run `flake8` and a smoke test.
- Implement multiprocessing/batching for slide-level parallelism.
- Create a small example dataset and a test script so you can validate the pipeline easily.
