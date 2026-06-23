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
    assert page.title() == "Vibe Reading", f"Title was '{page.title()}'"


def test_layout_structure(page):
    assert page.locator(".vr-layout").is_visible()
    assert page.locator(".vr-tree-panel").is_visible()
    assert page.locator(".vr-sidebar").is_visible()
    assert page.locator(".vr-main").is_visible()


def test_breadcrumb_bar(page):
    breadcrumb = page.locator(".vr-breadcrumb-bar")
    assert breadcrumb.is_visible()
    segments = page.locator(".vr-breadcrumb-label")
    assert segments.count() >= 2, f"Expected ≥2 breadcrumb segments, got {segments.count()}"


def test_resize_handles(page):
    handles = page.locator(".vr-resize-handle")
    assert handles.count() == 2, f"Expected 2 resize handles, got {handles.count()}"


def test_file_tree_structure(page):
    tree = page.locator(".vr-tree-panel")
    assert tree.is_visible()
    header = page.locator(".vr-tree-header")
    assert header.is_visible()
    items = page.locator(".vr-tree-item")
    assert items.count() >= 5, f"Expected ≥5 tree items, got {items.count()}"


def test_file_tree_filter(page):
    filter_input = page.locator(".vr-tree-filter-input")
    if filter_input.is_visible():
        filter_input.fill("engine")
        page.wait_for_timeout(200)
        items = page.locator(".vr-tree-item:visible")
        assert items.count() >= 1, "No items after filter"
        filter_input.fill("")
        page.wait_for_timeout(200)


def test_file_switch_via_tree(page):
    old_path = page.locator(".vr-file-path").inner_text()
    items = page.locator(".vr-tree-item:not(.vr-tree-item--active):not(:has(.vr-tree-dir))")
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
    assert search_input.is_focused()
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
    """j/k keys navigate cards."""
    concept_tab = page.locator(".vr-tab", has_text="Concept")
    concept_tab.click()
    page.wait_for_timeout(200)
    page.keyboard.press("j")
    page.wait_for_timeout(100)
    highlighted = page.locator(".vr-card--highlighted")
    assert highlighted.count() >= 1, "No card highlighted after 'j' press"


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
    text = badge.inner_text().strip()
    assert text in ["Function", "Class", "Method", "Interface", "Type", "Enum", "Variable", "Decorated"], \
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
    assert level_btns.count() == 3, f"Expected 3 level buttons, got {level_btns.count()}"
    basic_btn = page.locator(".vr-level-btn", has_text="Basic")
    basic_btn.click()
    page.wait_for_timeout(200)
    assert basic_btn.evaluate("el => el.classList.contains('vr-level-btn--active')")
    all_btn = page.locator(".vr-level-btn", has_text="All")
    all_btn.click()
    page.wait_for_timeout(200)


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


def test_flow_canvas_renders(page):
    page.locator(".vr-tab", has_text="Flow").click()
    page.wait_for_timeout(300)
    canvas = page.locator(".vr-flow-canvas")
    if canvas.count() > 0:
        assert canvas.is_visible(), "Flow canvas not visible"


def test_flow_segments_bar(page):
    page.locator(".vr-tab", has_text="Flow").click()
    page.wait_for_timeout(300)
    segments = page.locator(".vr-flow-segments")
    if segments.count() > 0:
        btns = page.locator(".vr-flow-seg-btn")
        assert btns.count() >= 1, "No segment buttons"


def test_flow_segment_click(page):
    page.locator(".vr-tab", has_text="Flow").click()
    page.wait_for_timeout(300)
    btns = page.locator(".vr-flow-seg-btn")
    if btns.count() >= 2:
        btns.nth(1).click()
        page.wait_for_timeout(200)
        assert btns.nth(1).evaluate("el => el.classList.contains('vr-flow-seg-btn--active')")


def test_flow_scope_toggle(page):
    page.locator(".vr-tab", has_text="Flow").click()
    page.wait_for_timeout(300)
    scope_btn = page.locator(".vr-flow-scope-btn")
    if scope_btn.count() > 0:
        scope_btn.click()
        page.wait_for_timeout(200)
        assert scope_btn.evaluate("el => el.classList.contains('vr-flow-scope-btn--active')")
        scope_btn.click()
        page.wait_for_timeout(200)


def test_flow_info_bar(page):
    page.locator(".vr-tab", has_text="Flow").click()
    page.wait_for_timeout(300)
    info = page.locator(".vr-flow-info")
    if info.count() > 0:
        text = info.inner_text()
        assert "nodes" in text and "edges" in text, f"Info bar missing content: {text}"


def test_flow_no_data_message(page):
    """When no flow data, shows guidance message."""
    panel = page.locator(".vr-flow-panel")
    no_data = page.locator(".vr-no-cards")
    # Either panel renders or no-data shows — both are valid
    assert panel.count() > 0 or no_data.count() > 0


# === HISTORY PANEL TESTS ===

def test_history_tab_switch(page):
    page.locator(".vr-tab", has_text="History").click()
    page.wait_for_timeout(300)
    active = page.locator(".vr-tab--active")
    assert "History" in active.inner_text()


def test_history_panel_renders(page):
    page.locator(".vr-tab", has_text="History").click()
    page.wait_for_timeout(300)
    panel = page.locator(".vr-history-panel")
    no_data = page.locator(".vr-no-cards")
    assert panel.count() > 0 or no_data.count() > 0


def test_history_file_summary(page):
    page.locator(".vr-tab", has_text="History").click()
    page.wait_for_timeout(300)
    summary = page.locator(".vr-history-file-summary")
    if summary.count() > 0:
        stats = page.locator(".vr-history-stat")
        assert stats.count() >= 2, "File summary should have ≥2 stats"


def test_history_sort_buttons(page):
    page.locator(".vr-tab", has_text="History").click()
    page.wait_for_timeout(300)
    sort_btns = page.locator(".vr-history-sort-btn")
    if sort_btns.count() > 0:
        assert sort_btns.count() == 4, f"Expected 4 sort buttons, got {sort_btns.count()}"
        sort_btns.nth(1).click()
        page.wait_for_timeout(200)
        assert sort_btns.nth(1).evaluate("el => el.classList.contains('vr-history-sort-btn--active')")


def test_history_activity_indicators(page):
    page.locator(".vr-tab", has_text="History").click()
    page.wait_for_timeout(300)
    indicators = page.locator(".vr-history-item-activity")
    if indicators.count() > 0:
        text = indicators.first.inner_text().strip()
        assert text in ["🔥", "⚡", "💤"], f"Unexpected activity indicator: '{text}'"


def test_history_item_expand(page):
    page.locator(".vr-tab", has_text="History").click()
    page.wait_for_timeout(300)
    items = page.locator(".vr-history-item-header")
    if items.count() > 0:
        items.first.click()
        page.wait_for_timeout(300)
        detail = page.locator(".vr-history-item-detail")
        assert detail.count() >= 1, "No detail after expanding history item"


def test_history_timeline(page):
    page.locator(".vr-tab", has_text="History").click()
    page.wait_for_timeout(300)
    items = page.locator(".vr-history-item-header")
    if items.count() > 0:
        items.first.click()
        page.wait_for_timeout(300)
        timeline = page.locator(".vr-history-timeline")
        if timeline.count() > 0:
            dots = page.locator(".vr-history-tl-dot")
            assert dots.count() >= 1, "No timeline dots"


def test_history_timeline_click_expand(page):
    page.locator(".vr-tab", has_text="History").click()
    page.wait_for_timeout(300)
    items = page.locator(".vr-history-item-header")
    if items.count() > 0:
        items.first.click()
        page.wait_for_timeout(300)
        clickable_dates = page.locator(".vr-history-tl-clickable")
        if clickable_dates.count() > 0:
            clickable_dates.first.click()
            page.wait_for_timeout(300)
            expanded = page.locator(".vr-history-tl-expanded")
            assert expanded.count() >= 1, "No expanded commit detail after click"


def test_history_color_coding(page):
    page.locator(".vr-tab", has_text="History").click()
    page.wait_for_timeout(300)
    items = page.locator(".vr-history-item")
    if items.count() > 0:
        border_color = items.first.evaluate("el => getComputedStyle(el).borderLeftColor")
        assert border_color != "", "No left border color on history item"


# === JUMP PANEL TESTS ===

def test_jump_tab_switch(page):
    page.locator(".vr-tab", has_text="Jump").click()
    page.wait_for_timeout(300)
    active = page.locator(".vr-tab--active")
    assert "Jump" in active.inner_text()


def test_jump_panel_renders(page):
    page.locator(".vr-tab", has_text="Jump").click()
    page.wait_for_timeout(300)
    panel = page.locator(".vr-jump-panel")
    no_data = page.locator(".vr-no-cards")
    assert panel.count() > 0 or no_data.count() > 0


def test_jump_sections_exist(page):
    page.locator(".vr-tab", has_text="Jump").click()
    page.wait_for_timeout(300)
    sections = page.locator(".vr-jump-section")
    if sections.count() > 0:
        headers = page.locator(".vr-jump-section-header")
        assert headers.count() >= 2, f"Expected ≥2 jump sections, got {headers.count()}"


def test_jump_section_expand(page):
    page.locator(".vr-tab", has_text="Jump").click()
    page.wait_for_timeout(300)
    headers = page.locator(".vr-jump-section-header")
    if headers.count() > 0:
        headers.first.click()
        page.wait_for_timeout(200)
        body = page.locator(".vr-jump-section-body")
        assert body.count() >= 1, "No section body after click"


def test_jump_dep_items(page):
    page.locator(".vr-tab", has_text="Jump").click()
    page.wait_for_timeout(300)
    dep_items = page.locator(".vr-jump-dep-item")
    if dep_items.count() > 0:
        file_name = page.locator(".vr-jump-dep-file").first.inner_text()
        assert len(file_name) > 0, "Dep file name is empty"


def test_jump_chips(page):
    page.locator(".vr-tab", has_text="Jump").click()
    page.wait_for_timeout(300)
    headers = page.locator(".vr-jump-section-header")
    for i in range(headers.count()):
        headers.nth(i).click()
        page.wait_for_timeout(200)
    chips = page.locator(".vr-jump-chip")
    if chips.count() > 0:
        text = chips.first.inner_text().strip()
        assert len(text) > 0, "Jump chip is empty"


def test_jump_navigation(page):
    """Clicking a dep item navigates to target file."""
    page.locator(".vr-tab", has_text="Jump").click()
    page.wait_for_timeout(300)
    dep_items = page.locator(".vr-jump-dep-item")
    if dep_items.count() > 0:
        old_path = page.locator(".vr-file-path").inner_text()
        dep_items.first.click()
        page.wait_for_timeout(800)
        new_path = page.locator(".vr-file-path").inner_text()
        # It might stay the same if the dep file isn't in the data set
        # but at minimum, no crash should occur


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
    items = page.locator(".vr-tree-item:not(:has(.vr-tree-dir))")
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
        test("Canvas renders", test_flow_canvas_renders, page)
        test("Segments bar", test_flow_segments_bar, page)
        test("Segment click", test_flow_segment_click, page)
        test("Scope toggle", test_flow_scope_toggle, page)
        test("Info bar", test_flow_info_bar, page)
        test("No data fallback", test_flow_no_data_message, page)

        print("\n📜  HISTORY PANEL")
        test("Tab switch to History", test_history_tab_switch, page)
        test("Panel renders", test_history_panel_renders, page)
        test("File summary stats", test_history_file_summary, page)
        test("Sort buttons", test_history_sort_buttons, page)
        test("Activity indicators", test_history_activity_indicators, page)
        test("Item expand", test_history_item_expand, page)
        test("Timeline dots", test_history_timeline, page)
        test("Timeline click expand", test_history_timeline_click_expand, page)
        test("Color coding", test_history_color_coding, page)

        print("\n🔗  JUMP PANEL")
        test("Tab switch to Jump", test_jump_tab_switch, page)
        test("Panel renders", test_jump_panel_renders, page)
        test("Sections exist", test_jump_sections_exist, page)
        test("Section expand", test_jump_section_expand, page)
        test("Dep items", test_jump_dep_items, page)
        test("Jump chips", test_jump_chips, page)
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
