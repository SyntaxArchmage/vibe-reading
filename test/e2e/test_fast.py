"""
Vibe Reading — Fast E2E tests using Playwright route interception.
No server needed — all files served via Playwright's route API.

Run: python3 test/e2e/test_fast.py
"""
import sys
import os
import json
from playwright.sync_api import sync_playwright

TEST_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(os.path.dirname(TEST_DIR))
VIEWER_DIR = os.path.join(PROJECT_DIR, "viewer")
DATA_DIR = os.path.join(PROJECT_DIR, "test", "data", "nano-vllm")
VIBE_DIR = os.path.join(DATA_DIR, ".vibe-reading")
SCREENSHOT_DIR = os.path.join(PROJECT_DIR, "test", "screenshots")

passed = 0
failed = 0
errors = []


def test(name, fn, page):
    global passed, failed
    try:
        fn(page)
        print(f"  \u2713 {name}")
        passed += 1
    except Exception as e:
        msg = str(e)[:120]
        print(f"  \u2717 {name}: {msg}")
        failed += 1
        errors.append((name, msg))


def has(page, selector, timeout=2000):
    try:
        page.locator(selector).first.wait_for(state="visible", timeout=timeout)
        return True
    except:
        return False


def cnt(page, selector):
    return page.locator(selector).count()


def build_html():
    """Build the HTML page with embedded data."""
    files_dir = os.path.join(VIBE_DIR, "files")
    preview_data = {}
    for f in os.listdir(files_dir):
        if f.endswith(".json"):
            with open(os.path.join(files_dir, f)) as fh:
                preview_data[f] = json.load(fh)

    global_data = {}
    global_dir = os.path.join(VIBE_DIR, "global")
    for f in os.listdir(global_dir):
        if f.endswith(".json"):
            with open(os.path.join(global_dir, f)) as fh:
                key = f.replace(".json", "")
                global_data[key] = json.load(fh)

    # Only keep a subset for speed
    keep_files = list(preview_data.keys())[:5]
    preview_data = {k: preview_data[k] for k in keep_files}

    if "flow" in global_data:
        gd = global_data["flow"]
        gd["nodes"] = gd.get("nodes", [])[:20]
        gd["edges"] = gd.get("edges", [])[:15]
        gd["segments"] = gd.get("segments", [])[:3]

    if "history" in global_data:
        hd = global_data["history"]
        hd["entities"] = hd.get("entities", [])[:10]

    return preview_data, global_data


def setup_routes(page, preview_data, global_data):
    """Intercept requests to serve viewer locally."""
    viewer_js = open(os.path.join(VIEWER_DIR, "out", "viewer.js"), "rb").read()

    monaco_mock = """function noop(){}function disp(){return{dispose:noop}}
window.monaco={editor:{create:function(el){el.innerHTML='<div class="monaco-editor"><div class="margin-view-overlays"><div class="line-numbers">1</div></div><div class="view-lines">code</div></div>';return{dispose:noop,getModel:function(){return{setValue:noop,getValue:function(){return""}}},onDidChangeCursorPosition:disp,onMouseMove:disp,onMouseLeave:disp,deltaDecorations:function(){return[]},createDecorationsCollection:function(){return{set:noop,clear:noop}},revealLineInCenter:noop,layout:noop,getContainerDomNode:function(){return el}}},defineTheme:noop,setTheme:noop,setModelLanguage:noop},Range:function(a,b,c,d){this.startLineNumber=a;this.startColumn=b;this.endLineNumber=c;this.endColumn=d}};
window.monacoReady=true;window.dispatchEvent(new Event("monaco-ready"));"""

    safe_preview = json.dumps(preview_data, ensure_ascii=True)
    safe_global = json.dumps(global_data, ensure_ascii=True)

    index_html = f"""<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Vibe Reading</title>
<style>*{{margin:0;padding:0;box-sizing:border-box}}body{{overflow:hidden;height:100vh;width:100vw}}</style>
</head><body><div id="root"></div>
<script>
var PREVIEW_DATA={safe_preview};
var GLOBAL_DATA={safe_global};
window.acquireVsCodeApi=function(){{return{{postMessage:function(){{}},getState:function(){{return null}},setState:function(){{}}}}}};
window.fetch=function(u){{return Promise.resolve(new Response(JSON.stringify({{file:'nanovllm/config.py',content:'class ModelConfig:\\n    pass\\n'}}),{{status:200}}))}};
{monaco_mock}
</script>
<script src="/viewer.js"></script>
</body></html>""".encode()

    def handle_route(route):
        url = route.request.url
        if "/viewer.js" in url:
            route.fulfill(status=200, content_type="application/javascript", body=viewer_js)
        else:
            route.fulfill(status=200, content_type="text/html", body=index_html)

    page.route("**/*", handle_route)


# === TEST FUNCTIONS ===

def t_layout(page):
    assert has(page, ".vr-layout"), "No layout"
    assert has(page, ".vr-sidebar"), "No sidebar"
    assert has(page, ".vr-main"), "No main"

def t_tabs(page):
    assert cnt(page, ".vr-tab") == 4

def t_file_header(page):
    assert has(page, ".vr-file-header")

def t_file_tree(page):
    assert has(page, ".vr-tree-panel")
    assert cnt(page, ".vr-tree-item") >= 1

def t_breadcrumbs(page):
    assert has(page, ".vr-breadcrumb-bar")

def t_concept_cards(page):
    page.locator(".vr-tab", has_text="Concept").click()
    page.wait_for_timeout(300)
    assert cnt(page, ".vr-card") >= 1

def t_concept_badge(page):
    page.locator(".vr-tab", has_text="Concept").click()
    page.wait_for_timeout(300)
    if has(page, ".vr-card-badge"):
        assert len(page.locator(".vr-card-badge").first.inner_text()) > 0

def t_concept_expand(page):
    page.locator(".vr-tab", has_text="Concept").click()
    page.wait_for_timeout(500)
    headers = page.locator(".vr-card-header")
    if headers.count() > 0:
        headers.first.dispatch_event("click")
        page.wait_for_timeout(500)
        detail_count = page.locator(".vr-card-detail").count()
        assert detail_count >= 1, f"No detail section (count={detail_count})"
    else:
        pass

def t_concept_teaches(page):
    page.locator(".vr-tab", has_text="Concept").click()
    page.wait_for_timeout(500)
    headers = page.locator(".vr-card-header")
    if headers.count() > 0:
        headers.first.click()
        page.wait_for_timeout(500)
    # teaches are optional, just verify no crash

def t_concept_level_filter(page):
    page.locator(".vr-tab", has_text="Concept").click()
    page.wait_for_timeout(200)
    btns = page.locator(".vr-level-btn")
    if btns.count() == 3:
        btns.nth(1).click()
        page.wait_for_timeout(200)
        btns.nth(0).click()

def t_flow_tab(page):
    page.locator(".vr-tab", has_text="Flow").click()
    page.wait_for_timeout(400)
    assert has(page, ".vr-flow-panel") or has(page, ".vr-no-cards")

def t_flow_segments(page):
    page.locator(".vr-tab", has_text="Flow").click()
    page.wait_for_timeout(400)
    if has(page, ".vr-flow-seg-btn", timeout=1000):
        page.locator(".vr-flow-seg-btn").first.click()
        page.wait_for_timeout(200)

def t_flow_canvas(page):
    page.locator(".vr-tab", has_text="Flow").click()
    page.wait_for_timeout(400)
    if has(page, ".vr-flow-canvas"):
        assert page.locator(".vr-flow-canvas").is_visible()

def t_history_tab(page):
    page.locator(".vr-tab", has_text="History").click()
    page.wait_for_timeout(400)
    assert has(page, ".vr-history-panel") or has(page, ".vr-no-cards")

def t_history_sort(page):
    page.locator(".vr-tab", has_text="History").click()
    page.wait_for_timeout(400)
    if has(page, ".vr-history-sort-btn", timeout=1000):
        page.locator(".vr-history-sort-btn").nth(1).click()
        page.wait_for_timeout(200)

def t_history_activity(page):
    page.locator(".vr-tab", has_text="History").click()
    page.wait_for_timeout(400)
    if has(page, ".vr-history-item-activity", timeout=1000):
        t = page.locator(".vr-history-item-activity").first.inner_text().strip()
        assert t in ["\U0001f525", "\u26a1", "\U0001f4a4"], f"Got: {repr(t)}"

def t_history_expand(page):
    page.locator(".vr-tab", has_text="History").click()
    page.wait_for_timeout(400)
    if has(page, ".vr-history-item-header", timeout=1000):
        page.locator(".vr-history-item-header").first.click()
        page.wait_for_timeout(400)
        assert has(page, ".vr-history-item-detail")

def t_history_tl_click(page):
    page.locator(".vr-tab", has_text="History").click()
    page.wait_for_timeout(400)
    if has(page, ".vr-history-item-header", timeout=1000):
        page.locator(".vr-history-item-header").first.click()
        page.wait_for_timeout(400)
        if has(page, ".vr-history-tl-clickable", timeout=1000):
            page.locator(".vr-history-tl-clickable").first.click()
            page.wait_for_timeout(300)
            assert has(page, ".vr-history-tl-expanded")

def t_jump_tab(page):
    page.locator(".vr-tab", has_text="Jump").click()
    page.wait_for_timeout(400)
    assert has(page, ".vr-jump-panel") or has(page, ".vr-no-cards")

def t_jump_sections(page):
    page.locator(".vr-tab", has_text="Jump").click()
    page.wait_for_timeout(400)
    if has(page, ".vr-jump-section-header", timeout=1000):
        assert cnt(page, ".vr-jump-section-header") >= 2

def t_jump_click(page):
    page.locator(".vr-tab", has_text="Jump").click()
    page.wait_for_timeout(400)
    if has(page, ".vr-jump-section-header", timeout=1000):
        page.locator(".vr-jump-section-header").first.click()
        page.wait_for_timeout(300)

def t_rapid_tabs(page):
    for name in ["Flow", "History", "Jump", "Concept"]:
        page.locator(".vr-tab", has_text=name).click()
        page.wait_for_timeout(100)

def t_screenshots(page):
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    for name in ["Concept", "Flow", "History", "Jump"]:
        page.locator(".vr-tab", has_text=name).click()
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, f"autotest-{name.lower()}.png"))


def main():
    global passed, failed
    preview_data, global_data = build_html()

    with sync_playwright() as p:
        browser = p.firefox.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1400, "height": 900})
        page = ctx.new_page()
        page.set_default_timeout(8000)

        setup_routes(page, preview_data, global_data)
        page.goto("http://test.local/", wait_until="domcontentloaded", timeout=20000)
        page.wait_for_timeout(3000)

        print("\nVibe Reading \u2014 E2E Tests (route-intercepted)")
        print("=" * 55)

        print("\n\U0001f3d7\ufe0f  CORE")
        test("Layout", t_layout, page)
        test("Tabs", t_tabs, page)
        test("File header", t_file_header, page)
        test("File tree", t_file_tree, page)
        test("Breadcrumbs", t_breadcrumbs, page)

        print("\n\U0001f4d8  CONCEPT")
        test("Cards render", t_concept_cards, page)
        test("Badge", t_concept_badge, page)
        test("Expand", t_concept_expand, page)
        test("Teaches", t_concept_teaches, page)
        test("Level filter", t_concept_level_filter, page)

        print("\n\U0001f500  FLOW")
        test("Tab", t_flow_tab, page)
        test("Segments", t_flow_segments, page)
        test("Canvas", t_flow_canvas, page)

        print("\n\U0001f4dc  HISTORY")
        test("Tab", t_history_tab, page)
        test("Sort", t_history_sort, page)
        test("Activity", t_history_activity, page)
        test("Expand", t_history_expand, page)
        test("Timeline click", t_history_tl_click, page)

        print("\n\U0001f517  JUMP")
        test("Tab", t_jump_tab, page)
        test("Sections", t_jump_sections, page)
        test("Section click", t_jump_click, page)

        print("\n\U0001f504  INTEGRATION")
        test("Rapid tab switch", t_rapid_tabs, page)
        test("Screenshots", t_screenshots, page)

        print("\n" + "=" * 55)
        total = passed + failed
        print(f"Results: {passed}/{total} passed, {failed} failed")
        if errors:
            print("\nFailed:")
            for name, err in errors:
                print(f"  \u2717 {name}: {err}")

        browser.close()

    sys.exit(1 if failed > 0 else 0)


if __name__ == "__main__":
    main()
