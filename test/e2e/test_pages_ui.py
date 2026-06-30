#!/usr/bin/env python3
"""Comprehensive Playwright test for the static GitHub Pages build.

Covers: layout, data integrity, all 5 tabs, file navigation, keyboard
shortcuts, file tree, card filter/sort, editor, status bar, and console errors.

Usage:
    python3 test/e2e/test_pages_ui.py                     # file:// protocol
    VIEWER_URL=http://... python3 test/e2e/test_pages_ui.py  # remote URL
"""
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

    if DEFAULT_URL.startswith("file://") and not os.path.isdir(PAGES):
        print("[pages-ui] pages/ missing — run: node scripts/build-github-pages.mjs")
        return 1

    errors: list[str] = []
    passes: list[str] = []

    def check(name: str, condition: bool, detail: str = "") -> None:
        if condition:
            passes.append(name)
            print(f"  PASS: {name}")
        else:
            msg = f"{name}: {detail}" if detail else name
            errors.append(msg)
            print(f"  FAIL: {msg}")

    print(f"[pages-ui] URL: {DEFAULT_URL}")
    print()

    with sync_playwright() as p:
        browser = p.firefox.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        page.set_default_timeout(15000)

        # 1. Basic Load
        print("--- 1. Basic Load ---")
        page.goto(DEFAULT_URL, wait_until="domcontentloaded")
        page.wait_for_timeout(4000)

        check("Layout rendered", page.locator(".vr-layout").count() > 0)
        check("Activity bar", page.locator(".vr-activity-bar").count() > 0)
        check("File tree panel", page.locator(".vr-file-panel").count() > 0)
        check("Sidebar", page.locator(".vr-sidebar").count() > 0)
        check("Status bar", page.locator(".vr-statusbar").count() > 0)

        # 2. Data
        print("\n--- 2. Data Verification ---")
        fc = page.evaluate("() => Object.keys(PREVIEW_DATA).length")
        check("PREVIEW_DATA loaded", fc > 0, f"count={fc}")
        check("CALL_GRAPH loaded", page.evaluate("() => CALL_GRAPH !== null"))
        check(
            "VR_BASE on globalThis",
            page.evaluate('() => typeof globalThis.VR_BASE === "string"'),
        )

        te = page.evaluate(
            "() => { let t=0; for(const k of Object.keys(PREVIEW_DATA)) t+=PREVIEW_DATA[k].entities.length; return t; }"
        )
        check("Total entities > 50", te > 50, f"count={te}")

        et = page.evaluate(
            "() => { const s=new Set(); for(const k of Object.keys(PREVIEW_DATA)) for(const e of PREVIEW_DATA[k].entities) s.add(e.type); return [...s].sort(); }"
        )
        for t in ["concept", "flow", "history", "jump"]:
            check(f"Has {t} entities", t in et, f"types={et}")

        # 3. Default File
        print("\n--- 3. Default File ---")
        cur = page.locator(".vr-file-path").inner_text()
        check("Default file selected", len(cur) > 0, f"file={cur}")
        check("Default is llm.py", "llm.py" in cur, f"file={cur}")

        # 4. Tab System
        print("\n--- 4. Tab System ---")
        check("5 tabs", page.locator(".vr-tab").count() == 5)
        for name in ["Concept", "Flow", "History", "Jump", "Outline"]:
            check(f"Tab {name}", page.locator(".vr-tab", has_text=name).count() > 0)

        # 5. Concept Tab
        print("\n--- 5. Concept Tab ---")
        page.locator(".vr-tab", has_text="Concept").click()
        page.wait_for_timeout(500)
        cc = page.locator(".vr-card").count()
        check("Concept cards", cc > 0, f"count={cc}")
        f1 = page.locator(".vr-card").first
        check("Card badge", f1.locator(".vr-card-badge").count() > 0)
        check("Card name", f1.locator(".vr-card-name").count() > 0)
        f1.click()
        page.wait_for_timeout(300)
        check("Card expand", f1.locator(".vr-card-detail").count() > 0)

        # 6. Flow Tab
        print("\n--- 6. Flow Tab ---")
        page.locator(".vr-tab", has_text="Flow").click()
        page.wait_for_timeout(500)
        check("Flow content", page.locator(".vr-card, .vr-no-cards, canvas").count() > 0)

        # 7. History Tab
        print("\n--- 7. History Tab ---")
        page.locator(".vr-tab", has_text="History").click()
        page.wait_for_timeout(500)
        hc = page.locator(".vr-card").count()
        check("History not empty", hc > 0 or page.locator(".vr-no-cards").count() > 0, f"cards={hc}")
        check("Git Blame hidden", page.locator("text=Show Git Blame").count() == 0)

        # 8. Jump Tab
        print("\n--- 8. Jump Tab ---")
        page.locator(".vr-tab", has_text="Jump").click()
        page.wait_for_timeout(500)
        check("Jump content", page.locator(".vr-card, .vr-no-cards").count() > 0)

        # 9. Outline Tab
        print("\n--- 9. Outline Tab ---")
        page.locator(".vr-tab", has_text="Outline").click()
        page.wait_for_timeout(500)
        oc = page.locator(".vr-content").inner_text()
        check("Outline content", len(oc.strip()) > 0, f"text_len={len(oc.strip())}")

        # 10. File Navigation ([/])
        print("\n--- 10. File Navigation ---")
        page.locator(".vr-tab", has_text="Concept").click()
        page.wait_for_timeout(300)
        before = page.locator(".vr-file-path").inner_text()
        page.locator(".vr-main").click()
        page.wait_for_timeout(200)
        page.keyboard.press("BracketRight")
        page.wait_for_timeout(1000)
        after = page.locator(".vr-file-path").inner_text()
        check("] changes file", before != after, f"{before} -> {after}")

        page.locator(".vr-main").click()
        page.wait_for_timeout(200)
        page.keyboard.press("BracketLeft")
        page.wait_for_timeout(1000)
        back = page.locator(".vr-file-path").inner_text()
        check("[ goes back", back == before, f"expected={before} got={back}")

        # 11. File Tree
        print("\n--- 11. File Tree ---")
        td = page.locator(".vr-tree-dir").count()
        tf = page.locator(".vr-tree-file").count()
        check("Tree dirs", td > 0, f"count={td}")
        check("Tree files", tf > 0, f"count={tf}")
        if tf > 1:
            tgt = page.locator(".vr-tree-file").nth(tf - 1)
            tn = tgt.locator(".vr-tree-file-name").inner_text()
            tgt.click()
            page.wait_for_timeout(1000)
            nf = page.locator(".vr-file-path").inner_text()
            check("Tree click navigates", tn in nf or nf != before, f"clicked={tn} now={nf}")

        # 12. Keyboard Shortcuts
        print("\n--- 12. Keyboard Shortcuts ---")
        page.keyboard.press("Control+p")
        page.wait_for_timeout(500)
        check("Ctrl+P picker", page.locator(".vr-picker").count() > 0)
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        check("Esc closes picker", page.locator(".vr-picker").count() == 0)

        page.keyboard.press("Control+g")
        page.wait_for_timeout(500)
        check("Ctrl+G goto line", page.locator(".vr-picker-input").count() > 0)
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)

        page.locator(".vr-main").click()
        page.wait_for_timeout(200)
        page.keyboard.press("?")
        page.wait_for_timeout(500)
        check("? opens help", page.locator(".vr-help-panel").count() > 0)
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)

        page.keyboard.press("Control+b")
        page.wait_for_timeout(500)
        check("Ctrl+B hides tree", page.locator(".vr-file-panel").count() == 0)
        page.keyboard.press("Control+b")
        page.wait_for_timeout(500)
        check("Ctrl+B restores tree", page.locator(".vr-file-panel").count() > 0)

        # 13. Alt+N Tab Switch
        print("\n--- 13. Tab Switching ---")
        page.keyboard.press("Alt+2")
        page.wait_for_timeout(500)
        check("Alt+2 -> Flow", page.locator(".vr-tab--active", has_text="Flow").count() > 0)
        page.keyboard.press("Alt+1")
        page.wait_for_timeout(500)
        check("Alt+1 -> Concept", page.locator(".vr-tab--active", has_text="Concept").count() > 0)

        # 14. Editor
        print("\n--- 14. Editor ---")
        ed = page.locator(".monaco-editor, .vr-editor-wrap pre").count()
        ld = page.locator("text=Loading editor").count()
        check("Editor loaded", ed > 0 or ld == 0, f"editors={ed} loading={ld}")

        # 15. Status Bar
        print("\n--- 15. Status Bar ---")
        st = page.locator(".vr-statusbar").inner_text()
        check("Status shows file", ".py" in st or "No file" in st)
        check("Status shows concepts", "concept" in st.lower())

        # 16. UI Details
        print("\n--- 16. UI Details ---")
        check("Complexity badge", page.locator(".vr-file-header span[title*='complexity']").count() > 0)
        check("LOC badge", page.locator(".vr-file-loc").count() > 0)
        check("Active tab styled", page.locator(".vr-tab-item--active").count() > 0)

        # 17. Source Files
        print("\n--- 17. Source Files ---")
        if DEFAULT_URL.startswith("file://"):
            sd = os.path.join(PAGES, "source")
            sc = len([f for f in os.listdir(sd) if f.endswith(".json")])
            check("Source JSONs >= 20", sc >= 20, f"count={sc}")
        else:
            check("Source JSONs (skip remote)", True)

        # 18. Card Filter
        print("\n--- 18. Card Filter ---")
        page.keyboard.press("Control+p")
        page.wait_for_timeout(300)
        page.locator(".vr-picker-search").fill("llm.py")
        page.wait_for_timeout(300)
        page.keyboard.press("Enter")
        page.wait_for_timeout(1000)
        page.locator(".vr-tab", has_text="Concept").click()
        page.wait_for_timeout(500)
        bc = page.locator(".vr-card").count()
        page.locator(".vr-card-filter-input").fill("LLM")
        page.wait_for_timeout(500)
        ac = page.locator(".vr-card").count()
        check("Filter works", ac <= bc and ac > 0, f"before={bc} after={ac}")
        page.locator(".vr-card-filter-input").fill("")
        page.wait_for_timeout(300)

        # 19. Sort
        print("\n--- 19. Card Sort ---")
        check("Sort buttons", page.locator(".vr-sort-btn").count() >= 3)
        page.locator(".vr-sort-btn", has_text="Az").click()
        page.wait_for_timeout(300)
        check("Az activates", page.locator(".vr-sort-btn--active", has_text="Az").count() > 0)

        # 19b. Entity Graph
        print("\n--- 19b. Entity Graph ---")
        page.locator(".vr-tab", has_text="Concept").click()
        page.wait_for_timeout(500)
        page.locator(".vr-tree-file").nth(3).click()
        page.wait_for_timeout(1000)
        graph_btns = page.locator("button", has_text="\u2726")
        check("Graph toggle button", graph_btns.count() > 0)
        if graph_btns.count() > 0:
            graph_btns.first.click()
            page.wait_for_timeout(500)
            check("Mini graph appears", page.locator(".vr-mini-graph").count() > 0)
            mini_svg = page.locator(".vr-mini-graph svg")
            check("Mini graph SVG", mini_svg.count() > 0)
            graph_btns.first.click()
            page.wait_for_timeout(300)
            check("Mini graph hides", page.locator(".vr-mini-graph").count() == 0)

        # 20. Navigation Buttons
        print("\n--- 20. Navigation ---")
        check("Back button", page.locator(".vr-nav-btn").first.count() > 0)
        check("Forward button", page.locator(".vr-nav-btn").nth(1).count() > 0)

        # 20b. File Heatmap
        print("\n--- 20b. File Heatmap ---")
        heatmap_btn = page.locator(".vr-activity-btn", has_text="\U0001F525")
        check("Heatmap button exists", heatmap_btn.count() > 0)
        heatmap_btn.click()
        page.wait_for_timeout(800)
        check("Heatmap panel opens", page.locator(".vr-heatmap-panel").count() > 0)
        check("Heatmap SVG renders", page.locator(".vr-heatmap-svg").count() > 0)
        file_rects = page.locator(".vr-heatmap-svg .vr-heatmap-rect")
        check("Heatmap has file rects", file_rects.count() >= 5, f"count={file_rects.count()}")
        check("Heatmap header", page.locator(".vr-heatmap-header").count() > 0)
        check("Heatmap legend", page.locator(".vr-heatmap-legend").count() > 0)
        mode_btns = page.locator(".vr-heatmap-mode-btn")
        check("Mode buttons (color+size)", mode_btns.count() == 6)
        mode_btns.nth(1).click()
        page.wait_for_timeout(300)
        check("Mode switch works", mode_btns.nth(1).evaluate("el => getComputedStyle(el).opacity") == "1")
        first_rect = file_rects.first
        first_rect.hover()
        page.wait_for_timeout(500)
        check("Tooltip on hover", page.locator(".vr-heatmap-tooltip").count() > 0)
        check("Tooltip has complexity", page.locator(".vr-heatmap-tooltip-row").count() >= 3)
        size_btn = mode_btns.nth(4)
        size_btn.click()
        page.wait_for_timeout(300)
        check("Size mode switch", size_btn.evaluate("el => getComputedStyle(el).opacity") == "1")
        first_rect = file_rects.first
        first_rect.click()
        page.wait_for_timeout(1000)
        check("Click navigates to file", page.locator(".vr-file-path").count() > 0)
        heatmap_btn.click()
        page.wait_for_timeout(300)
        check("Heatmap panel closes", page.locator(".vr-heatmap-panel").count() == 0)

        # 20c. Theme Toggle
        print("\n--- 20c. Theme Toggle ---")
        theme_btn = page.locator(".vr-theme-btn")
        check("Theme button exists", theme_btn.count() > 0)
        dark_bg = page.evaluate('() => getComputedStyle(document.querySelector(".vr-layout")).backgroundColor')
        theme_btn.click()
        page.wait_for_timeout(500)
        check("Light theme class applied", page.locator(".vr-layout--light").count() > 0)
        light_bg = page.evaluate('() => getComputedStyle(document.querySelector(".vr-layout")).backgroundColor')
        check("Background color changed", dark_bg != light_bg, f"dark={dark_bg} light={light_bg}")
        theme_btn.click()
        page.wait_for_timeout(500)
        check("Dark theme restored", page.locator(".vr-layout--light").count() == 0)

        # 20d. Light Theme Details
        print("\n--- 20d. Light Theme Details ---")
        theme_btn.click()
        page.wait_for_timeout(500)
        check("Light mode active", page.locator(".vr-layout--light").count() > 0)
        light_sidebar_bg = page.evaluate(
            '() => getComputedStyle(document.querySelector(".vr-sidebar")).backgroundColor'
        )
        check("Sidebar uses CSS var bg", light_sidebar_bg != dark_bg, f"sidebar={light_sidebar_bg}")
        card_el = page.locator(".vr-card").first
        if card_el.count() > 0:
            card_bg = card_el.evaluate("el => getComputedStyle(el).backgroundColor")
            check("Card bg light", card_bg != "rgb(45, 45, 45)", f"card_bg={card_bg}")
        tab_active = page.locator(".vr-tab--active")
        if tab_active.count() > 0:
            tab_color = tab_active.evaluate("el => getComputedStyle(el).color")
            check("Active tab color light", tab_color != "rgb(204, 204, 204)")
        cx_badge = page.locator(".vr-cx-badge")
        if cx_badge.count() > 0:
            badge_bg = cx_badge.first.evaluate("el => getComputedStyle(el).backgroundColor")
            check("CX badge uses light colors", badge_bg not in ["rgb(74, 32, 32)", "rgb(58, 58, 32)", "rgb(26, 42, 26)"], f"bg={badge_bg}")
        tree_file = page.locator(".vr-tree-file").first
        if tree_file.count() > 0:
            tree_color = tree_file.evaluate("el => getComputedStyle(el).color")
            check("Tree file color light", tree_color != "rgb(204, 204, 204)")
        theme_btn.click()
        page.wait_for_timeout(300)
        check("Restored to dark", page.locator(".vr-layout--light").count() == 0)

        # 20e. Entity Search
        print("\n--- 20e. Entity Search ---")
        page.keyboard.press("Control+Shift+F")
        page.wait_for_timeout(500)
        search_panel = page.locator(".vr-entity-search-panel")
        check("Ctrl+Shift+F opens search", search_panel.count() > 0)
        search_input = search_panel.locator(".vr-entity-search-input")
        if search_input.count() > 0:
            search_input.type("LLM")
            page.wait_for_timeout(300)
            search_items = search_panel.locator(".vr-entity-search-item")
            check("Search results appear", search_items.count() > 0)
            search_count = search_panel.locator(".vr-entity-search-count")
            check("Result count shown", search_count.count() > 0)
            search_input.press("ArrowDown")
            page.wait_for_timeout(200)
            active_item = search_panel.locator(".vr-entity-search-item--active")
            check("Arrow key navigates", active_item.count() > 0)
            search_input.press("Enter")
            page.wait_for_timeout(500)
            check("Enter selects result", search_panel.count() == 0)
        page.wait_for_timeout(500)
        page.keyboard.press("Control+Shift+F")
        page.wait_for_timeout(800)
        search_panel2 = page.locator(".vr-entity-search-panel")
        check("Search panel reopens", search_panel2.count() > 0)
        if search_panel2.count() > 0:
            ls_works = page.evaluate('() => { try { localStorage.setItem("_t", "1"); localStorage.removeItem("_t"); return true; } catch { return false; } }')
            if ls_works:
                has_history = page.evaluate('() => { try { const h = localStorage.getItem("vr-search-history"); return h && JSON.parse(h).length > 0; } catch { return false; } }')
                check("Search history in storage", has_history)
            else:
                check("Search history in storage", True, "localStorage unavailable (file://)")
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)

        # 21. Source Content
        print("\n--- 21. Source Content ---")
        src = page.evaluate(
            '() => document.querySelector(".monaco-editor, .vr-editor-wrap pre")?.textContent?.length || 0'
        )
        check("Source code loaded", src > 10, f"chars={src}")

        # 22. Console Errors
        print("\n--- 22. Console Errors ---")
        console_errors: list[str] = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.reload()
        page.wait_for_timeout(5000)
        check("No console errors", len(console_errors) == 0,
              f"errors={console_errors[:3]}" if console_errors else "")

        browser.close()

    print()
    print("=" * 60)
    total = len(passes) + len(errors)
    print(f"PASSED: {len(passes)}/{total}")
    if errors:
        print(f"FAILED: {len(errors)}")
        for e in errors:
            print(f"  - {e}")
        return 1

    print(f"[pages-ui] ALL {total} TESTS PASSED ({DEFAULT_URL})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
