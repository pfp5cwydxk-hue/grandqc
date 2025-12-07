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

Important: Repository history rewritten (purge)
------------------------------------------------
Note: I have removed large `.svs` files from the repository history to keep the repo small and fast.

Backups created:
- Full repo archive: `~/grandqc_backup_20251207-094704.tar.gz`
- Extracted slide files moved to: `~/Slides_Backup/grandqc_20251207-095002/`

What changed:
- The git history on the remote (`origin`) was rewritten and force-pushed to remove the large files.

What you (and any collaborators) must do locally:
- Recommended (safe): reclone the repository fresh:

```bash
git clone https://github.com/pfp5cwydxk-hue/grandqc.git
```

- Alternative (overwrite local work — make sure you have backups of any local changes):

```bash
git fetch origin
git reset --hard origin/main
git clean -fdx
```

Warnings:
- The `reset --hard` and `git clean -fdx` commands will remove uncommitted changes and untracked files. Only run them if you are sure you have saved any work you need.
- If other people have forks or branches based on the previous history, they will need to rebase or re-clone. Coordinate with your team when doing history-rewriting operations.

If you want, I can add a short note at the top-level `README.md` (root) as well, or send an email/Slack-ready message you can paste to your team describing the steps.

If you'd like me to also remove other large files (e.g., `Figures/merge2.gif`) from history, I can do that as a follow-up.
