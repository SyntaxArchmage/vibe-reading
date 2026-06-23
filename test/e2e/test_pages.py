#!/usr/bin/env python3
"""Verify the static GitHub Pages build works without a Node server."""
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DOCS = os.path.join(REPO, "pages")
BASE = "/vibe-reading"


def fetch(url: str) -> tuple[int, str]:
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        return 0, str(e)


def main() -> int:
    if not os.path.isdir(DOCS):
        print("[pages-test] pages/ missing — run: node scripts/build-github-pages.mjs")
        return 1

    with tempfile.TemporaryDirectory() as tmp:
        site_root = os.path.join(tmp, "site")
        dest = os.path.join(site_root, "vibe-reading")
        os.makedirs(dest)
        subprocess.run(["cp", "-r", f"{DOCS}/.", dest], check=True)

        proc = subprocess.Popen(
            [sys.executable, "-m", "http.server", "9876", "--directory", site_root],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        time.sleep(0.5)

        errors = []
        try:
            prefix = f"http://127.0.0.1:9876{BASE}"

            checks = [
                (f"{prefix}/", "PREVIEW_DATA"),
                (f"{prefix}/", "CALL_GRAPH"),
                (f"{prefix}/viewer.js", "function"),
                (f"{prefix}/source/bench.py.json", '"content"'),
                (f"{prefix}/source/nanovllm__config.py.json", "dataclass"),
            ]

            for url, needle in checks:
                status, body = fetch(url)
                if status != 200:
                    errors.append(f"HTTP {status} for {url}: {body[:120]}")
                elif needle not in body:
                    errors.append(f"Missing '{needle}' in {url}")

            # Validate source JSON structure
            status, body = fetch(f"{prefix}/source/example.py.json")
            if status == 200:
                data = json.loads(body)
                if "content" not in data or "file" not in data:
                    errors.append("source/example.py.json missing file/content keys")
            else:
                errors.append(f"source/example.py.json HTTP {status}")

        finally:
            proc.terminate()
            proc.wait(timeout=5)

    if errors:
        print("[pages-test] FAILED:")
        for e in errors:
            print(f"  - {e}")
        return 1

    print("[pages-test] All checks passed (static site at subpath /vibe-reading/)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
