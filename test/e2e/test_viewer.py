"""
Vibe Reading — E2E tests for the web viewer.
Run: python3 test/e2e/test_viewer.py

Prerequisites:
  - Viewer server running: PORT=3461 npx tsx viewer/server.ts test/fixture
  - Python playwright installed: pip install playwright
  - Chromium browser: playwright install chromium
"""

import sys
import os
from playwright.sync_api import sync_playwright, expect

VIEWER_URL = os.environ.get("VIEWER_URL", "http://localhost:3461")
SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), "screenshots")

passed = 0
failed = 0
errors = []


def test(name, fn, page):
    global passed, failed
    try:
        fn(page)
        print(f"  ✓ {name}")
        passed += 1
    except Exception as e:
        print(f"  ✗ {name}: {e}")
        failed += 1
        errors.append((name, str(e)))


def test_page_loads(page):
    """Page loads without errors."""
    page.goto(VIEWER_URL, wait_until="networkidle")
    assert page.title() == "Vibe Reading", f"Title was '{page.title()}'"


def test_sidebar_renders(page):
    """Sidebar has file header with entity count."""
    header = page.locator(".vr-file-header")
    assert header.is_visible(), "File header not visible"


def test_file_path_shown(page):
    """Current file path is displayed."""
    path_el = page.locator(".vr-file-path")
    text = path_el.inner_text()
    assert len(text) > 0, "File path is empty"


def test_entity_count_badge(page):
    """Entity count badge is visible."""
    badge = page.locator(".vr-file-count")
    text = badge.inner_text()
    count = int(text)
    assert count > 0, f"Entity count is {count}"


def test_tabs_visible(page):
    """All 4 tabs render."""
    tabs = page.locator(".vr-tab")
    assert tabs.count() == 4, f"Expected 4 tabs, got {tabs.count()}"


def test_concept_tab_active(page):
    """Concept tab is active by default."""
    active = page.locator(".vr-tab--active")
    assert "Concept" in active.inner_text(), "Concept tab not active"


def test_cards_render(page):
    """Knowledge cards render in sidebar."""
    cards = page.locator(".vr-card")
    assert cards.count() > 0, "No cards rendered"


def test_card_has_badge(page):
    """Cards have kind badges."""
    badge = page.locator(".vr-card-badge").first
    text = badge.inner_text()
    assert len(text) > 0, "Badge text is empty"


def test_card_has_name(page):
    """Cards have entity names."""
    name = page.locator(".vr-card-name").first
    text = name.inner_text()
    assert len(text) > 0, "Card name is empty"


def test_card_click_highlights_code(page):
    """Clicking a card highlights code in Monaco."""
    card = page.locator(".vr-card").first
    card.click()
    page.wait_for_timeout(500)
    highlight = page.locator(".vr-monaco-highlight")
    assert highlight.count() > 0, "No code highlight after card click"


def test_card_expand(page):
    """Clicking card header expands detail section."""
    already_open = page.locator(".vr-card-detail").count() > 0
    if already_open:
        page.locator(".vr-card-header").first.click()
        page.wait_for_timeout(400)
    card_header = page.locator(".vr-card-header").first
    card_header.click()
    page.wait_for_timeout(400)
    detail = page.locator(".vr-card-detail")
    assert detail.count() > 0, "No detail section after expand"


def test_monaco_loads(page):
    """Monaco editor loads with code content."""
    editor = page.locator(".monaco-editor")
    editor.wait_for(state="visible", timeout=10000)
    assert editor.is_visible(), "Monaco editor not visible"


def test_monaco_has_line_numbers(page):
    """Monaco shows line numbers."""
    line_nums = page.locator(".line-numbers")
    assert line_nums.count() > 0 or page.locator(".monaco-editor .margin-view-overlays").count() > 0, \
        "No line numbers visible"


def test_file_tree_visible(page):
    """File tree panel is visible."""
    tree = page.locator(".vr-tree-panel")
    assert tree.is_visible(), "File tree panel not visible"


def test_file_tree_has_items(page):
    """File tree has clickable items."""
    items = page.locator(".vr-tree-item")
    assert items.count() >= 3, f"Expected ≥3 tree items, got {items.count()}"


def test_file_tree_click_switches_file(page):
    """Clicking a file in the tree switches the view."""
    old_path = page.locator(".vr-file-path").inner_text()
    items = page.locator(".vr-tree-item:not(.vr-tree-item--active)")
    for i in range(items.count()):
        item = items.nth(i)
        if not item.locator(".vr-tree-dir").count():
            item.click()
            page.wait_for_timeout(500)
            break
    new_path = page.locator(".vr-file-path").inner_text()
    assert new_path != old_path or items.count() == 0, "File didn't switch after tree click"


def test_file_tree_has_counts(page):
    """File tree items show entity counts."""
    counts = page.locator(".vr-tree-count")
    assert counts.count() > 0, "No entity counts in file tree"


def test_file_picker_opens_with_ctrl_p(page):
    """File picker opens with Ctrl+P and shows items."""
    page.keyboard.press("Control+p")
    page.wait_for_timeout(300)
    picker = page.locator(".vr-picker")
    assert picker.is_visible(), "File picker not visible after Ctrl+P"
    items = page.locator(".vr-picker-item")
    assert items.count() >= 3, f"Expected ≥3 picker items, got {items.count()}"
    page.keyboard.press("Escape")
    page.wait_for_timeout(200)


def test_tab_switch(page):
    """Switching to Flow tab updates content."""
    flow_tab = page.locator(".vr-tab", has_text="Flow")
    flow_tab.click()
    page.wait_for_timeout(200)
    active = page.locator(".vr-tab--active")
    assert "Flow" in active.inner_text(), "Flow tab not active after click"


def test_screenshot(page):
    """Take screenshots for visual baseline."""
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)

    concept_tab = page.locator(".vr-tab", has_text="Concept")
    concept_tab.click()
    page.wait_for_timeout(300)

    page.screenshot(path=os.path.join(SCREENSHOT_DIR, "01-full-view.png"))

    card = page.locator(".vr-card").first
    card.click()
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(SCREENSHOT_DIR, "02-card-highlight.png"))

    card_header = page.locator(".vr-card-header").first
    card_header.click()
    page.wait_for_timeout(300)
    page.screenshot(path=os.path.join(SCREENSHOT_DIR, "03-card-expanded.png"))


def main():
    global passed, failed

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        print("\nVibe Reading — E2E Tests")
        print("=" * 50)

        print("\nTest 1: Page Load")
        test("Page loads", test_page_loads, page)

        print("\nTest 2: Monaco Editor")
        test("Monaco editor loads", test_monaco_loads, page)
        test("Line numbers visible", test_monaco_has_line_numbers, page)

        print("\nTest 3: Sidebar Structure")
        test("Sidebar renders", test_sidebar_renders, page)
        test("File path shown", test_file_path_shown, page)
        test("Entity count badge", test_entity_count_badge, page)
        test("All 4 tabs visible", test_tabs_visible, page)
        test("Concept tab active", test_concept_tab_active, page)

        print("\nTest 4: Knowledge Cards")
        test("Cards render", test_cards_render, page)
        test("Card has badge", test_card_has_badge, page)
        test("Card has name", test_card_has_name, page)
        test("Card click highlights code", test_card_click_highlights_code, page)
        test("Card expand shows detail", test_card_expand, page)

        print("\nTest 5: File Tree & Picker")
        test("File tree visible", test_file_tree_visible, page)
        test("File tree has items", test_file_tree_has_items, page)
        test("File tree click switches file", test_file_tree_click_switches_file, page)
        test("File tree has entity counts", test_file_tree_has_counts, page)
        test("Ctrl+P opens file picker", test_file_picker_opens_with_ctrl_p, page)

        print("\nTest 6: Tab Navigation")
        test("Tab switch works", test_tab_switch, page)

        print("\nTest 7: Visual Baseline")
        test("Screenshots captured", test_screenshot, page)

        print("\n" + "=" * 50)
        print(f"Results: {passed} passed, {failed} failed")

        if errors:
            print("\nFailed tests:")
            for name, err in errors:
                print(f"  ✗ {name}: {err}")

        browser.close()

    sys.exit(1 if failed > 0 else 0)


if __name__ == "__main__":
    main()
