#!/usr/bin/env python3
"""Playwright smoke test for the static GitHub Pages build."""
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PAGES = os.path.join(REPO, "pages")
DEFAULT_URL = os.environ.get(
    "VIEWER_URL",
    f"file://{os.path.join(PAGES, 'index.html')}",
)


def main() -> int:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("[pages-ui] Playwright not installed — skipping browser test")
        return 0

    if not os.path.isdir(PAGES):
        print("[pages-ui] pages/ missing — run: node scripts/build-github-pages.mjs")
        return 1

    errors = []
    with sync_playwright() as p:
        browser = p.firefox.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        page.set_default_timeout(20000)

        page.goto(DEFAULT_URL, wait_until="domcontentloaded")
        page.wait_for_timeout(5000)

        if page.locator(".vr-layout").count() == 0:
            errors.append("Layout not rendered")

        tabs = page.locator(".vr-tab").count()
        if tabs < 5:
            errors.append(f"Expected at least 5 tabs, got {tabs}")

        cards = page.locator(".vr-card").count()
        if cards < 1:
            errors.append("No concept cards rendered")

        page.locator(".vr-tab", has_text="Flow").click()
        page.wait_for_timeout(500)
        if page.locator(".vr-card, .vr-no-cards").count() == 0:
            errors.append("Flow tab empty")

        page.locator(".vr-tab", has_text="History").click()
        page.wait_for_timeout(500)
        if page.locator(".vr-card, .vr-no-cards").count() == 0:
            errors.append("History tab empty")

        if page.locator(".monaco-editor, .vr-editor-wrap pre").count() == 0:
            if page.locator("text=Loading editor").count() > 0:
                errors.append("Monaco still loading after timeout")

        before = page.locator(".vr-file-path").inner_text()
        page.locator(".vr-layout").click()
        page.keyboard.press("BracketRight")
        page.wait_for_timeout(800)
        after = page.locator(".vr-file-path").inner_text()
        if before == after:
            errors.append(f"] next-file shortcut did not change file (stuck on {before})")

        cx = page.locator(".vr-file-header span[title*='complexity']").count()
        if cx < 1:
            errors.append("Complexity badge missing in file header")

        browser.close()

    if errors:
        print("[pages-ui] FAILED:")
        for e in errors:
            print(f"  - {e}")
        return 1

    print(f"[pages-ui] Browser smoke test passed ({DEFAULT_URL})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
