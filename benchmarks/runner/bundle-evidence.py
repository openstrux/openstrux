#!/usr/bin/env python3
"""
bundle-evidence.py — Bundle (or re-bundle) result-dir files into evidence.zip.

Merges any existing evidence.zip entries with loose files in the result directory,
excluding files listed in the keep set (benchmark.json, generation-meta.json, and
evidence.zip itself are kept as top-level files, not bundled).

Usage:
  python3 bundle-evidence.py <result-dir> [--keep <file> ...]

Default keep set: benchmark.json, generation-meta.json, evidence.zip
"""
import argparse
import os
import zipfile


def main() -> None:
    parser = argparse.ArgumentParser(description="Bundle evidence.zip")
    parser.add_argument("result_dir", help="Path to the result directory")
    parser.add_argument(
        "--keep",
        nargs="*",
        default=["benchmark.json", "generation-meta.json", "evidence.zip"],
        help="Files to exclude from the zip (kept as top-level files)",
    )
    args = parser.parse_args()

    result_dir: str = args.result_dir
    out_path = os.path.join(result_dir, "evidence.zip")
    keep_set = set(args.keep)

    # Read existing zip entries (for re-bundle: preserves prior entries)
    existing: dict[str, bytes] = {}
    if os.path.exists(out_path):
        with zipfile.ZipFile(out_path, "r") as zf:
            for name in zf.namelist():
                existing[name] = zf.read(name)

    # Add/overwrite with any loose files not in keep_set
    for name in sorted(os.listdir(result_dir)):
        if name in keep_set:
            continue
        fp = os.path.join(result_dir, name)
        if os.path.isfile(fp):
            with open(fp, "rb") as f:
                existing[name] = f.read()

    # Write merged zip
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in sorted(existing.items()):
            zf.writestr(name, data)

    print(f"Bundled evidence → {out_path}")


if __name__ == "__main__":
    main()
