#!/usr/bin/env python3
"""Verify the static GitHub Pages build output on disk."""
import json
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PAGES = os.path.join(REPO, "pages")


def main() -> int:
    if not os.path.isdir(PAGES):
        print("[pages-test] pages/ missing — run: node scripts/build-github-pages.mjs")
        return 1

    errors = []
    index_path = os.path.join(PAGES, "index.html")
    viewer_path = os.path.join(PAGES, "viewer.js")

    if not os.path.isfile(index_path):
        errors.append("pages/index.html missing")
    if not os.path.isfile(viewer_path):
        errors.append("pages/viewer.js missing")
    elif os.path.getsize(viewer_path) < 1000:
        errors.append("pages/viewer.js too small")

    if os.path.isfile(index_path):
        html = open(index_path, encoding="utf-8").read()
        for needle in ("PREVIEW_DATA", "CALL_GRAPH", 'VR_BASE = "/vibe-reading/"', "viewer.js"):
            if needle not in html:
                errors.append(f"index.html missing '{needle}'")
        for needle in ('"type":"flow"', '"type":"history"'):
            if needle not in html:
                errors.append(f"index.html missing entity type {needle}")

    source_dir = os.path.join(PAGES, "source")
    if not os.path.isdir(source_dir):
        errors.append("pages/source/ missing")
    else:
        source_files = [f for f in os.listdir(source_dir) if f.endswith(".json")]
        if len(source_files) < 10:
            errors.append(f"expected ≥10 source JSON files, got {len(source_files)}")
        example = os.path.join(source_dir, "example.py.json")
        if os.path.isfile(example):
            data = json.load(open(example, encoding="utf-8"))
            if "content" not in data or "file" not in data:
                errors.append("source/example.py.json missing file/content keys")

    if not os.path.isfile(os.path.join(PAGES, ".nojekyll")):
        errors.append("pages/.nojekyll missing")

    if errors:
        print("[pages-test] FAILED:")
        for e in errors:
            print(f"  - {e}")
        return 1

    print("[pages-test] All filesystem checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
