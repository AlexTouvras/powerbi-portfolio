"""Canvas crop for showcase PNGs. Synthetic frames, not a live Desktop session."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

from capture_showcase import canvas_box, crop_to_canvas, find_pane_cut, slugify


def test_slug_matches_readme_names():
    assert slugify("Customer & Market") == "customer-market"
    assert slugify("Scorecard & Validation") == "scorecard-validation"
    assert slugify("P&L Pulse") == "p-l-pulse"


def test_strips_filter_pane_and_letterbox():
    image = Image.new("RGB", (390, 210), (247, 250, 252))
    image.paste(Image.new("RGB", (240, 130), (20, 90, 110)), (40, 40))
    image.paste(Image.new("RGB", (4, 210), (190, 198, 206)), (316, 0))
    image.paste(Image.new("RGB", (70, 210), (255, 255, 255)), (320, 0))

    cropped = crop_to_canvas(image, 1920, 1080)

    assert cropped.size[0] < 340
    assert abs(cropped.size[0] / cropped.size[1] - 16 / 9) < 0.02
    assert find_pane_cut(cropped) is None
    again = crop_to_canvas(cropped, 1920, 1080)
    assert again.size == cropped.size


def test_leaves_a_white_card_on_the_page():
    image = Image.new("RGB", (320, 180), (247, 250, 252))
    image.paste(Image.new("RGB", (110, 120), (255, 255, 255)), (200, 30))
    assert find_pane_cut(image) is None
    assert canvas_box(image, 1920, 1080) == (0, 0, 320, 180)


def test_warning_banner_does_not_block_the_page_crop():
    width, height = 320, 280
    image = Image.new("RGB", (width, height), (234, 238, 242))
    image.paste(Image.new("RGB", (width, 28), (251, 246, 243)), (0, 0))
    image.paste(Image.new("RGB", (40, 8), (40, 40, 40)), (16, 10))
    page_h = round(width * 9 / 16)
    origin = (height - page_h) // 2
    image.paste(Image.new("RGB", (180, 40), (20, 90, 110)), (40, origin + 20))
    cropped = crop_to_canvas(image, 1920, 1080)
    assert cropped.size == (width, page_h)
    assert cropped.getpixel((40, 20)) == (20, 90, 110)


def test_collapsed_pane_does_not_eat_the_page():
    image = Image.new("RGB", (400, 180), (20, 90, 110))
    for x in range(0, 350, 8):
        color = (20, 30, 40) if (x // 8) % 2 == 0 else (230, 180, 20)
        image.paste(Image.new("RGB", (8, 180), color), (x, 0))
    image.paste(Image.new("RGB", (50, 180), (240, 244, 247)), (350, 0))
    cropped = crop_to_canvas(image, 1920, 1080)
    assert cropped.size[1] == 180
    assert 340 <= cropped.size[0] <= 352
    assert find_pane_cut(cropped) is None
