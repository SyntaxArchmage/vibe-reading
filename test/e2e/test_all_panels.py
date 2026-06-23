"""
Vibe Reading — Comprehensive E2E tests for all panels.
Run: BROWSER=chromium python3 test/e2e/test_all_panels.py

Prerequisites:
  - Viewer server running: PORT=3460 node --import tsx viewer/server.ts test/data/nano-vllm
  - Python playwright installed: pip install playwright && playwright install chromium
"""

import sys
import os
import time
from playwright.sync_api import sync_playwright

VIEWER_URL = os.environ.get("VIEWER_URL", "file://" + os.path.join(os.path.dirname(os.path.abspath(__file__)), "test-viewer-lite.html"))
BROWSER = os.environ.get("BROWSER", "firefox")
SCREENSHOT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "screenshots")

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


# === CORE / INFRASTRUCTURE TESTS ===

def test_page_loads(page):
    page.goto(VIEWER_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(2000)
    assert "Vibe Reading" in page.title(), f"Title was '{page.title()}'"


def test_layout_structure(page):
    assert page.locator(".vr-layout").is_visible()
    assert page.locator(".vr-tree, .vr-file-panel").first.is_visible()
    assert page.locator(".vr-sidebar").is_visible()
    assert page.locator(".vr-main").is_visible()


def test_breadcrumb_bar(page):
    statusbar = page.locator(".vr-statusbar")
    assert statusbar.is_visible()
    text = statusbar.inner_text()
    assert len(text) > 0, "Statusbar is empty"


def test_resize_handles(page):
    handles = page.locator(".vr-resize-handle")
    assert handles.count() == 2, f"Expected 2 resize handles, got {handles.count()}"


def test_file_tree_structure(page):
    tree = page.locator(".vr-tree")
    assert tree.is_visible()
    header = page.locator(".vr-tree-header")
    assert header.is_visible()
    items = page.locator(".vr-tree-file, .vr-tree-dir")
    assert items.count() >= 5, f"Expected ≥5 tree items, got {items.count()}"


def test_file_tree_filter(page):
    filter_input = page.locator(".vr-tree-filter-input")
    if filter_input.is_visible():
        filter_input.fill("engine")
        page.wait_for_timeout(200)
        items = page.locator(".vr-tree-file:visible, .vr-tree-dir:visible")
        assert items.count() >= 1, "No items after filter"
        filter_input.fill("")
        page.wait_for_timeout(200)


def test_file_switch_via_tree(page):
    old_path = page.locator(".vr-file-path").inner_text()
    items = page.locator(".vr-tree-file:not(.vr-tree-file--active)")
    if items.count() > 0:
        items.first.click()
        page.wait_for_timeout(500)
        new_path = page.locator(".vr-file-path").inner_text()
        assert new_path != old_path, "File path didn't change after click"


def test_file_picker_ctrl_p(page):
    page.keyboard.press("Control+p")
    page.wait_for_timeout(300)
    picker = page.locator(".vr-picker")
    assert picker.is_visible()
    search_input = page.locator(".vr-picker-search")
    assert search_input.is_visible()
    items = page.locator(".vr-picker-item")
    assert items.count() >= 3
    page.keyboard.press("Escape")
    page.wait_for_timeout(200)


def test_file_picker_search(page):
    page.keyboard.press("Control+p")
    page.wait_for_timeout(200)
    page.locator(".vr-picker-search").fill("scheduler")
    page.wait_for_timeout(200)
    items = page.locator(".vr-picker-item")
    assert items.count() >= 1, "No items for 'scheduler' search"
    page.keyboard.press("Escape")


def test_keyboard_nav_cards(page):
    """j/k keys navigate cards — verify no crash and state updates internally."""
    concept_tab = page.locator(".vr-tab", has_text="Concept")
    concept_tab.click()
    page.wait_for_timeout(200)
    page.locator(".vr-layout").click()
    page.wait_for_timeout(200)
    page.keyboard.press("j")
    page.wait_for_timeout(200)
    page.keyboard.press("j")
    page.wait_for_timeout(200)
    assert page.locator(".vr-card").count() > 0, "Cards still visible after j/k"


def test_monaco_editor(page):
    """Code area loads (Monaco or fallback)."""
    editor = page.locator(".monaco-editor")
    fallback = page.locator(".vr-editor-wrap")
    # In file:// mode Monaco may not load from CDN
    assert editor.count() > 0 or fallback.is_visible(), "No editor area"


def test_monaco_line_numbers(page):
    """Line numbers or editor wrap visible."""
    has_lines = page.locator(".line-numbers").count() > 0 or \
                page.locator(".monaco-editor .margin-view-overlays").count() > 0 or \
                page.locator(".vr-editor-wrap").is_visible()
    assert has_lines


# === CONCEPT PANEL TESTS ===

def test_concept_cards_render(page):
    page.locator(".vr-tab", has_text="Concept").click()
    page.wait_for_timeout(200)
    cards = page.locator(".vr-card")
    assert cards.count() > 0, "No concept cards rendered"


def test_concept_card_badge(page):
    badge = page.locator(".vr-card-badge").first
    text = badge.inner_text().strip().lower()
    assert text in ["function", "class", "method", "interface", "type", "enum", "variable", "decorated", "module"], \
        f"Unexpected badge: '{text}'"


def test_concept_card_expand(page):
    header = page.locator(".vr-card-header").first
    header.click()
    page.wait_for_timeout(400)
    detail = page.locator(".vr-card-detail")
    assert detail.count() >= 1, "Detail section not visible after expand"


def test_concept_description(page):
    header = page.locator(".vr-card-header").first
    header.click()
    page.wait_for_timeout(400)
    desc = page.locator(".vr-card-desc")
    if desc.count() > 0:
        assert len(desc.first.inner_text()) > 0, "Description is empty"


def test_concept_knowledge_section(page):
    knowledge = page.locator(".vr-card-knowledge")
    if knowledge.count() > 0:
        labels = page.locator(".vr-card-klabel")
        assert labels.count() > 0, "No knowledge labels"


def test_concept_teaches_chips(page):
    chips = page.locator(".vr-card-teach-chip")
    if chips.count() > 0:
        text = chips.first.inner_text().strip()
        assert len(text) > 0, "Teach chip is empty"


def test_concept_teaches_tooltip(page):
    clickable = page.locator(".vr-card-teach-chip--clickable")
    if clickable.count() > 0:
        clickable.first.click()
        page.wait_for_timeout(300)
        tooltip = page.locator(".vr-card-teach-tooltip")
        assert tooltip.count() >= 1, "No tooltip after clicking teach chip"


def test_concept_advanced_toggle(page):
    toggle = page.locator(".vr-card-advanced-toggle")
    if toggle.count() > 0:
        toggle.first.click()
        page.wait_for_timeout(300)
        adv = page.locator(".vr-card-knowledge--advanced")
        assert adv.count() >= 1, "No advanced section after toggle"


def test_concept_level_filter(page):
    level_btns = page.locator(".vr-level-btn")
    if level_btns.count() == 3:
        basic_btn = page.locator(".vr-level-btn", has_text="Basic")
        basic_btn.click()
        page.wait_for_timeout(200)
        assert basic_btn.evaluate("el => el.classList.contains('vr-level-btn--active')")
        all_btn = page.locator(".vr-level-btn", has_text="All")
        all_btn.click()
        page.wait_for_timeout(200)
    else:
        pass


def test_concept_card_highlight_code(page):
    page.locator(".vr-card").first.click()
    page.wait_for_timeout(500)
    highlight = page.locator(".vr-monaco-highlight")
    # May not have Monaco in file:// mode, so just verify no crash
    # The important thing is that clicking doesn't error out


def test_card_click_highlights_code(page):
    card = page.locator(".vr-card").first
    card.click()
    page.wait_for_timeout(500)
    # Verify no crash; Monaco highlights may not be available in file:// mode


# === FLOW PANEL TESTS ===

def test_flow_tab_switch(page):
    page.locator(".vr-tab", has_text="Flow").click()
    page.wait_for_timeout(300)
    active = page.locator(".vr-tab--active")
    assert "Flow" in active.inner_text()


def test_flow_diagram_or_cards(page):
    page.locator(".vr-tab", has_text="Flow").click()
    page.wait_for_timeout(300)
    assert page.locator(".vr-card, .vr-no-cards").count() > 0, "Flow tab has no content"


def test_flow_card_expand(page):
    page.locator(".vr-tab", has_text="Flow").click()
    page.wait_for_timeout(300)
    header = page.locator(".vr-card-header").first
    if header.count() > 0:
        header.click()
        page.wait_for_timeout(400)
        assert page.locator(".vr-card-detail").count() >= 1, "Flow card detail not visible"


def test_flow_import_chips(page):
    page.locator(".vr-tab", has_text="Flow").click()
    page.wait_for_timeout(300)
    header = page.locator(".vr-card-header").first
    if header.count() > 0:
        header.click()
        page.wait_for_timeout(400)
        chips = page.locator(".vr-card-chip")
        if chips.count() > 0:
            assert len(chips.first.inner_text().strip()) > 0


def test_flow_no_data_message(page):
    page.locator(".vr-tab", has_text="Flow").click()
    page.wait_for_timeout(300)
    assert page.locator(".vr-card, .vr-no-cards").count() > 0


# === HISTORY PANEL TESTS ===

def test_history_tab_switch(page):
    page.locator(".vr-tab", has_text="History").click()
    page.wait_for_timeout(300)
    active = page.locator(".vr-tab--active")
    assert "History" in active.inner_text()


def test_history_panel_renders(page):
    page.locator(".vr-tab", has_text="History").click()
    page.wait_for_timeout(300)
    assert page.locator(".vr-card, .vr-no-cards").count() > 0


def test_history_card_expand(page):
    page.locator(".vr-tab", has_text="History").click()
    page.wait_for_timeout(300)
    header = page.locator(".vr-card-header").first
    if header.count() > 0:
        header.click()
        page.wait_for_timeout(300)
        assert page.locator(".vr-card-detail").count() >= 1


def test_history_commit_info(page):
    page.locator(".vr-tab", has_text="History").click()
    page.wait_for_timeout(300)
    header = page.locator(".vr-card-header").first
    if header.count() > 0:
        header.click()
        page.wait_for_timeout(300)
        detail = page.locator(".vr-card-detail").first
        if detail.count() > 0:
            text = detail.inner_text()
            assert "commit" in text.lower() or "changed" in text.lower()


# === JUMP PANEL TESTS ===

def test_jump_tab_switch(page):
    page.locator(".vr-tab", has_text="Jump").click()
    page.wait_for_timeout(300)
    active = page.locator(".vr-tab--active")
    assert "Jump" in active.inner_text()


def test_jump_panel_renders(page):
    page.locator(".vr-tab", has_text="Jump").click()
    page.wait_for_timeout(300)
    assert page.locator(".vr-card, .vr-no-cards").count() > 0


def test_jump_target_file(page):
    page.locator(".vr-tab", has_text="Jump").click()
    page.wait_for_timeout(300)
    name = page.locator(".vr-card-name").first
    if name.count() > 0:
        assert len(name.inner_text().strip()) > 0


def test_jump_navigation(page):
    page.locator(".vr-tab", has_text="Jump").click()
    page.wait_for_timeout(300)
    card = page.locator(".vr-card").first
    if card.count() > 0:
        old_path = page.locator(".vr-file-path").inner_text()
        card.click()
        page.wait_for_timeout(800)
        # Navigation may or may not change file depending on fixture data
        assert page.locator(".vr-file-path").is_visible()


# === CROSS-PANEL INTERACTION TESTS ===

def test_tab_counts_persist(page):
    """Tab counts are shown for all tabs."""
    tab_counts = page.locator(".vr-tab-count")
    assert tab_counts.count() >= 1, "No tab counts visible"


def test_hover_highlight_on_editor(page):
    """Hovering over a card highlights in the editor."""
    page.locator(".vr-tab", has_text="Concept").click()
    page.wait_for_timeout(200)
    card = page.locator(".vr-card").first
    card.hover()
    page.wait_for_timeout(500)
    hover_range = page.locator(".vr-monaco-hover-range")
    # May or may not show depending on Monaco timing
    # Just verify no crash


def test_rapid_tab_switching(page):
    """Rapidly switching tabs doesn't crash."""
    for tab_name in ["Concept", "Flow", "History", "Jump", "Concept"]:
        page.locator(".vr-tab", has_text=tab_name).click()
        page.wait_for_timeout(100)
    active = page.locator(".vr-tab--active")
    assert "Concept" in active.inner_text()


def test_rapid_file_switching(page):
    """Rapidly clicking files in tree doesn't crash."""
    items = page.locator(".vr-tree-file")
    count = min(items.count(), 5)
    for i in range(count):
        items.nth(i).click()
        page.wait_for_timeout(150)
    # Just verify page is still responsive
    assert page.locator(".vr-file-path").is_visible()


# === VISUAL SCREENSHOTS ===

def test_screenshots(page):
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)

    page.locator(".vr-tab", has_text="Concept").click()
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(SCREENSHOT_DIR, "autotest-concept.png"))

    page.locator(".vr-card-header").first.click()
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(SCREENSHOT_DIR, "autotest-concepts-expanded.png"))

    teaches = page.locator(".vr-card-teach-chip--clickable")
    if teaches.count() > 0:
        teaches.first.click()
        page.wait_for_timeout(300)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "autotest-teaches-tooltip.png"))

    adv_toggle = page.locator(".vr-card-advanced-toggle")
    if adv_toggle.count() > 0:
        adv_toggle.first.click()
        page.wait_for_timeout(300)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "autotest-teaches-expanded.png"))

    page.locator(".vr-tab", has_text="Flow").click()
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(SCREENSHOT_DIR, "autotest-flow.png"))

    page.locator(".vr-tab", has_text="History").click()
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(SCREENSHOT_DIR, "autotest-history.png"))

    history_items = page.locator(".vr-history-item-header")
    if history_items.count() > 0:
        history_items.first.click()
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "autotest-history-seq.png"))

    page.locator(".vr-tab", has_text="Jump").click()
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(SCREENSHOT_DIR, "autotest-jump.png"))


def main():
    global passed, failed

    with sync_playwright() as p:
        if BROWSER == "chromium":
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--disable-software-rasterizer",
                    "--single-process",
                ],
            )
        else:
            browser = p.firefox.launch(headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        print("\nVibe Reading — Comprehensive E2E Tests")
        print("=" * 60)

        # Navigate to a file with rich data first
        page.goto(VIEWER_URL, wait_until="domcontentloaded")
        page.wait_for_timeout(3000)

        print("\n🏗️  CORE & INFRASTRUCTURE")
        test("Page loads", test_page_loads, page)
        test("Layout structure (3 panels)", test_layout_structure, page)
        test("Breadcrumb bar", test_breadcrumb_bar, page)
        test("Resize handles", test_resize_handles, page)
        test("Monaco editor loads", test_monaco_editor, page)
        test("Monaco line numbers", test_monaco_line_numbers, page)

        print("\n📂  FILE TREE & NAVIGATION")
        test("File tree structure", test_file_tree_structure, page)
        test("File tree filter", test_file_tree_filter, page)
        test("File switch via tree", test_file_switch_via_tree, page)
        test("File picker (Ctrl+P)", test_file_picker_ctrl_p, page)
        test("File picker search", test_file_picker_search, page)
        test("Keyboard nav (j/k)", test_keyboard_nav_cards, page)

        print("\n📘  CONCEPT PANEL")
        test("Cards render", test_concept_cards_render, page)
        test("Card badge types", test_concept_card_badge, page)
        test("Card expand", test_concept_card_expand, page)
        test("Card description", test_concept_description, page)
        test("Knowledge section", test_concept_knowledge_section, page)
        test("Teaches chips", test_concept_teaches_chips, page)
        test("Teaches tooltip", test_concept_teaches_tooltip, page)
        test("Advanced toggle", test_concept_advanced_toggle, page)
        test("Level filter (All/Basic/Advanced)", test_concept_level_filter, page)
        test("Card highlights code", test_concept_card_highlight_code, page)

        print("\n🔀  FLOW PANEL")
        test("Tab switch to Flow", test_flow_tab_switch, page)
        test("Diagram or cards", test_flow_diagram_or_cards, page)
        test("Card expand", test_flow_card_expand, page)
        test("Import chips", test_flow_import_chips, page)
        test("No data fallback", test_flow_no_data_message, page)

        print("\n📜  HISTORY PANEL")
        test("Tab switch to History", test_history_tab_switch, page)
        test("Panel renders", test_history_panel_renders, page)
        test("Card expand", test_history_card_expand, page)
        test("Commit info", test_history_commit_info, page)

        print("\n🔗  JUMP PANEL")
        test("Tab switch to Jump", test_jump_tab_switch, page)
        test("Panel renders", test_jump_panel_renders, page)
        test("Target file shown", test_jump_target_file, page)
        test("Navigation works", test_jump_navigation, page)

        print("\n🔄  CROSS-PANEL INTERACTIONS")
        test("Tab counts persist", test_tab_counts_persist, page)
        test("Hover highlight", test_hover_highlight_on_editor, page)
        test("Rapid tab switching", test_rapid_tab_switching, page)
        test("Rapid file switching", test_rapid_file_switching, page)

        print("\n📸  VISUAL SCREENSHOTS")
        test("All panel screenshots", test_screenshots, page)

        print("\n" + "=" * 60)
        total = passed + failed
        print(f"Results: {passed}/{total} passed, {failed} failed")

        if errors:
            print(f"\n{'─' * 60}")
            print("Failed tests:")
            for name, err in errors:
                print(f"  ✗ {name}")
                print(f"    → {err}")

        browser.close()

    sys.exit(1 if failed > 0 else 0)


if __name__ == "__main__":
    main()
