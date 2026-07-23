"""Download Home Credit application_train + bureau from Hugging Face mirror."""
from __future__ import annotations

from pathlib import Path

from huggingface_hub import hf_hub_download, list_repo_files

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
REPO = "mohameddhameem/home-credit-default-risk"


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    files = list_repo_files(REPO, repo_type="dataset")
    wanted = [
        f
        for f in files
        if ("application_train" in f.lower() or f.lower().startswith("bureau/"))
        and "bureau_balance" not in f.lower()
        and "application_test" not in f.lower()
    ]
    print("candidates:")
    for f in wanted:
        print(" ", f)
    if not wanted:
        raise SystemExit("No matching files in HF repo")

    # Prefer parquet shards under application_train*
    app_files = [f for f in wanted if "application_train" in f.lower()]
    bur_files = [f for f in wanted if f.lower().startswith("bureau/") or f.lower() == "bureau.csv"]

    for remote in app_files + bur_files:
        local = hf_hub_download(
            repo_id=REPO,
            repo_type="dataset",
            filename=remote,
            local_dir=str(RAW / "_hf"),
        )
        print("downloaded", local)


if __name__ == "__main__":
    main()
