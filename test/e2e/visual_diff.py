"""
Visual regression diff — compare screenshots against baselines.

Usage:
  python3 test/e2e/visual_diff.py [--update]

Without --update: compares screenshots/ against baselines/ and reports diffs.
With --update: copies current screenshots to baselines/ (resets baselines).

Requires: Pillow (pip install Pillow)
Threshold: 0.5% pixel difference tolerance (accounts for font rendering variance).
"""

import os
import sys
from pathlib import Path

BASELINE_DIR = Path(__file__).parent / "baselines"
SCREENSHOT_DIR = Path(__file__).parent / "screenshots"
DIFF_DIR = Path(__file__).parent / "diffs"
THRESHOLD = 0.005  # 0.5% pixel difference tolerance

BASELINE_FILES = ["01-full-view.png", "02-card-highlight.png", "03-card-expanded.png"]


def update_baselines():
    """Copy current screenshots to baselines."""
    BASELINE_DIR.mkdir(exist_ok=True)
    copied = 0
    for name in BASELINE_FILES:
        src = SCREENSHOT_DIR / name
        if src.exists():
            import shutil
            shutil.copy2(src, BASELINE_DIR / name)
            copied += 1
            print(f"  ✓ Updated baseline: {name}")
        else:
            print(f"  ⚠ Missing screenshot: {name}")
    print(f"\n{copied}/{len(BASELINE_FILES)} baselines updated.")


def compare_images(baseline_path: Path, screenshot_path: Path, diff_path: Path) -> tuple[float, bool]:
    """Compare two images pixel-by-pixel. Returns (diff_ratio, passed)."""
    try:
        from PIL import Image, ImageChops
    except ImportError:
        print("ERROR: Pillow not installed. Run: pip install Pillow")
        sys.exit(1)

    baseline = Image.open(baseline_path).convert("RGB")
    screenshot = Image.open(screenshot_path).convert("RGB")

    if baseline.size != screenshot.size:
        return 1.0, False

    diff = ImageChops.difference(baseline, screenshot)

    get_pixels = getattr(diff, "get_flattened_data", None) or diff.getdata
    pixels = list(get_pixels())
    total = len(pixels)
    different = sum(1 for r, g, b in pixels if r > 10 or g > 10 or b > 10)
    ratio = different / total if total > 0 else 0.0

    if ratio > 0:
        DIFF_DIR.mkdir(exist_ok=True)
        from PIL import ImageEnhance
        enhanced = ImageEnhance.Brightness(diff).enhance(5.0)
        enhanced.save(diff_path)

    return ratio, ratio <= THRESHOLD


def run_comparison():
    """Compare all baselines against current screenshots."""
    passed = 0
    failed = 0
    missing = 0

    print("\nVisual Regression — Comparing screenshots to baselines")
    print("=" * 55)
    print(f"Threshold: {THRESHOLD * 100:.1f}% pixel difference\n")

    for name in BASELINE_FILES:
        baseline = BASELINE_DIR / name
        screenshot = SCREENSHOT_DIR / name
        diff_path = DIFF_DIR / f"diff-{name}"

        if not baseline.exists():
            print(f"  ⚠ No baseline: {name} (run with --update to create)")
            missing += 1
            continue

        if not screenshot.exists():
            print(f"  ✗ Missing screenshot: {name}")
            failed += 1
            continue

        ratio, ok = compare_images(baseline, screenshot, diff_path)

        if ok:
            print(f"  ✓ {name} ({ratio * 100:.2f}% diff)")
            passed += 1
        else:
            print(f"  ✗ {name} ({ratio * 100:.2f}% diff > {THRESHOLD * 100:.1f}% threshold)")
            if diff_path.exists():
                print(f"    → Diff saved: {diff_path}")
            failed += 1

    print(f"\n{'=' * 55}")
    print(f"Results: {passed} passed, {failed} failed, {missing} missing baselines")

    return failed == 0 and missing == 0


def main():
    if "--update" in sys.argv:
        print("Updating baselines from current screenshots...")
        update_baselines()
        sys.exit(0)

    success = run_comparison()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
