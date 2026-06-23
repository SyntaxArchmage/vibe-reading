#!/usr/bin/env python3
"""Playwright smoke test for the static GitHub Pages build."""
import os
import subprocess
import sys
import tempfile
import time

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DOCS = os.path.join(REPO, "pages")
BASE = "/vibe-reading"


def main() -> int:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("[pages-ui] Playwright not installed — skipping browser test")
        return 0

    if not os.path.isdir(DOCS):
        print("[pages-ui] pages/ missing")
        return 1

    with tempfile.TemporaryDirectory() as tmp:
        site_root = os.path.join(tmp, "site")
        dest = os.path.join(site_root, "vibe-reading")
        os.makedirs(dest)
        subprocess.run(["cp", "-r", f"{DOCS}/.", dest], check=True)

        proc = subprocess.Popen(
            [sys.executable, "-m", "http.server", "9877", "--directory", site_root],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        time.sleep(0.5)

        errors = []
        try:
            with sync_playwright() as p:
                browser = p.firefox.launch(headless=True)
                page = browser.new_page(viewport={"width": 1400, "height": 900})
                page.set_default_timeout(15000)

                url = f"http://127.0.0.1:9877{BASE}/"
                page.goto(url, wait_until="networkidle")

                if page.locator(".vr-layout").count() == 0:
                    errors.append("Layout not rendered")

                tabs = page.locator(".vr-tab").count()
                if tabs < 4:
                    errors.append(f"Expected at least 4 tabs, got {tabs}")

                cards = page.locator(".vr-card").count()
                if cards < 1:
                    errors.append("No concept cards rendered")

                # Click Flow tab
                page.evaluate("""() => {
                  const tabs = document.querySelectorAll('.vr-tab');
                  for (const t of tabs) if (t.textContent.includes('Flow')) t.click();
                }""")
                page.wait_for_timeout(500)
                if page.locator(".vr-flow-panel, canvas").count() == 0:
                    errors.append("Flow panel not rendered")

                browser.close()
        finally:
            proc.terminate()
            proc.wait(timeout=5)

    if errors:
        print("[pages-ui] FAILED:")
        for e in errors:
            print(f"  - {e}")
        return 1

    print("[pages-ui] Browser smoke test passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
