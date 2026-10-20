"""Last step when a report is finished: canvas PNGs in screenshots/.

The Desktop Bridge snapshot is the report surface. It already leaves out the
ribbon, the visualizations pane, the data pane, and the page tabs. What it
still includes is the Filters pane, plus fit-to-page bars when the page does
not fill the view. This script drops both and writes one PNG per page.

Requires Pillow (``py -3.12 -m pip install pillow``).

    py -3.12 _shared/scripts/capture_showcase.py crop 03-sales-executive
    py -3.12 _shared/scripts/capture_showcase.py capture 03-sales-executive --pid 1234
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import statistics
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

PANE_MIN_PX = 48
PANE_MAX_FRAC = 0.42
SEAM_ROW_FRAC = 0.85
SEAM_LIGHTER_FRAC = 0.75
PANE_LIGHT_FRAC = 0.90
ASPECT_TOL = 0.015
MARGIN_STDEV = 22.0
LIGHT_CHANNEL = 232


@dataclass(frozen=True)
class PageInfo:
    display_name: str
    width: int
    height: int

    @property
    def slug(self) -> str:
        return slugify(self.display_name)


def slugify(name: str) -> str:
    text = name.lower().replace("&", " ")
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or "page"


def find_report_dir(project: Path) -> Path:
    project = project.resolve()
    if project.suffix == ".Report" and project.is_dir():
        return project
    reports = sorted(project.glob("*.Report"))
    if len(reports) == 1:
        return reports[0]
    if not reports:
        raise SystemExit(f"no .Report directory under {project}")
    raise SystemExit(f"more than one .Report under {project}: {reports}")


def read_pages(report_dir: Path) -> list[PageInfo]:
    pages_root = report_dir / "definition" / "pages"
    payload = json.loads((pages_root / "pages.json").read_text(encoding="utf-8"))
    order = payload.get("pageOrder") or []
    pages: list[PageInfo] = []
    for page_id in order:
        page = json.loads((pages_root / page_id / "page.json").read_text(encoding="utf-8"))
        pages.append(
            PageInfo(
                display_name=str(page.get("displayName") or page_id),
                width=int(page.get("width") or 1280),
                height=int(page.get("height") or 720),
            )
        )
    if not pages:
        raise SystemExit(f"no pages in {pages_root / 'pages.json'}")
    return pages


def page_for_file(path: Path, pages: list[PageInfo]) -> PageInfo:
    stem = slugify(path.stem)
    for page in pages:
        if page.slug == stem:
            return page
    # Every current report uses one canvas size. Fall back to that.
    sizes = {(page.width, page.height) for page in pages}
    if len(sizes) == 1:
        width, height = sizes.pop()
        return PageInfo(path.stem, width, height)
    raise SystemExit(f"cannot match {path.name} to a page in {[p.display_name for p in pages]}")


def _is_warning_banner_pixel(red: int, green: int, blue: int) -> bool:
    """Desktop refresh / info bar: warm off-white, not the cool page gray."""
    return red > 205 and green > 200 and blue > 190 and red + 6 >= blue and (red + green + blue) > 600


def _row_is_warning_banner(image: Image.Image, y: int, x0: int, x1: int) -> bool:
    pixels = image.load()
    seen = 0
    warm = 0
    for x in range(x0, x1, 8):
        red, green, blue = pixels[x, y][:3]
        seen += 1
        if _is_warning_banner_pixel(red, green, blue):
            warm += 1
    if seen == 0:
        return False
    edge = pixels[min(x0 + 4, x1 - 1), y][:3]
    return _is_warning_banner_pixel(*edge) and warm / seen > 0.6


def _luminance_stdev(image: Image.Image, box: tuple[int, int, int, int], step: int = 4) -> float:
    x0, y0, x1, y1 = box
    if x1 - x0 < 2 or y1 - y0 < 2:
        return 0.0
    pixels = image.load()
    values: list[float] = []
    for y in range(y0, y1, step):
        if _row_is_warning_banner(image, y, x0, x1):
            continue
        for x in range(x0, x1, step):
            red, green, blue = pixels[x, y][:3]
            values.append((red + green + blue) / 3)
    if len(values) < 8:
        return 0.0
    return statistics.pstdev(values)


def _region_is_light(image: Image.Image, x0: int, step: int = 6) -> float:
    width, height = image.size
    pixels = image.load()
    seen = 0
    light = 0
    for x in range(x0, width, step):
        for y in range(0, height, step):
            red, green, blue = pixels[x, y][:3]
            seen += 1
            if red > LIGHT_CHANNEL and green > LIGHT_CHANNEL and blue > LIGHT_CHANNEL:
                light += 1
    if seen == 0:
        return 0.0
    return light / seen


def find_pane_cut(image: Image.Image) -> int | None:
    """X where the Filters pane starts, or None when the frame is already the page."""
    width, height = image.size
    pixels = image.load()
    step_y = 4
    row_count = max(1, (height + step_y - 1) // step_y)
    left_limit = int(width * (1 - PANE_MAX_FRAC))
    x = width - 3
    while x > left_limit:
        hits = 0
        lighter = 0
        for y in range(0, height, step_y):
            left = pixels[x, y][:3]
            right = pixels[x + 2, y][:3]
            delta = abs(left[0] - right[0]) + abs(left[1] - right[1]) + abs(left[2] - right[2])
            if delta > 18:
                hits += 1
                if sum(right) > sum(left) + 6:
                    lighter += 1
        if hits / row_count >= SEAM_ROW_FRAC and lighter / row_count >= SEAM_LIGHTER_FRAC:
            pane_start = x + 2
            pane_width = width - pane_start
            if pane_width >= PANE_MIN_PX and _region_is_light(image, pane_start) >= PANE_LIGHT_FRAC:
                return pane_start
        x -= 2
    return None


def _margins_are_flat(
    image: Image.Image,
    box: tuple[int, int, int, int],
    view_width: int,
) -> bool:
    x0, y0, x1, y1 = box
    height = image.size[1]
    strips = []
    if y0 > 8:
        strips.append((0, 0, view_width, y0))
    if height - y1 > 8:
        strips.append((0, y1, view_width, height))
    if x0 > 8:
        strips.append((0, y0, x0, y1))
    if view_width - x1 > 8:
        strips.append((x1, y0, view_width, y1))
    return all(_luminance_stdev(image, strip) <= MARGIN_STDEV for strip in strips)


def canvas_box(image: Image.Image, page_width: int, page_height: int) -> tuple[int, int, int, int]:
    """Crop box for the report page. The right edge excludes the Filters pane."""
    width, height = image.size
    pane_x = find_pane_cut(image)
    view_width = pane_x if pane_x is not None else width

    aspect = page_width / page_height
    view_aspect = view_width / height
    if view_aspect > aspect * (1 + ASPECT_TOL):
        canvas_h = height
        canvas_w = round(height * aspect)
        origin_x = (view_width - canvas_w) // 2
        origin_y = 0
    elif view_aspect < aspect * (1 - ASPECT_TOL):
        canvas_w = view_width
        canvas_h = round(view_width / aspect)
        origin_x = 0
        origin_y = (height - canvas_h) // 2
    else:
        return (0, 0, view_width, height)

    box = (origin_x, origin_y, origin_x + canvas_w, origin_y + canvas_h)
    if not _margins_are_flat(image, box, view_width):
        return (0, 0, view_width, height)
    return box


def crop_to_canvas(image: Image.Image, page_width: int, page_height: int) -> Image.Image:
    working = image if image.mode == "RGB" else image.convert("RGB")
    box = canvas_box(working, page_width, page_height)
    if box == (0, 0, working.size[0], working.size[1]):
        return working
    return working.crop(box)


def crop_file(path: Path, page: PageInfo, dry_run: bool) -> tuple[tuple[int, int], tuple[int, int]]:
    image = Image.open(path)
    image.load()
    before = image.size
    cropped = crop_to_canvas(image, page.width, page.height)
    after = cropped.size
    if not dry_run and after != before:
        temporary = path.with_suffix(".crop.png")
        cropped.save(temporary, format="PNG")
        temporary.replace(path)
    image.close()
    return before, after


def crop_project(project: Path, dry_run: bool) -> int:
    report_dir = find_report_dir(project)
    pages = read_pages(report_dir)
    shot_dir = report_dir.parent / "screenshots"
    files = sorted(shot_dir.glob("*.png"))
    if not files:
        print(f"no screenshots in {shot_dir}")
        return 0
    changed = 0
    for path in files:
        page = page_for_file(path, pages)
        before, after = crop_file(path, page, dry_run)
        mark = "unchanged" if before == after else f"{before[0]}x{before[1]} -> {after[0]}x{after[1]}"
        print(f"{path.relative_to(report_dir.parent)}  {mark}")
        if before != after:
            changed += 1
    return changed


def _desktop_command() -> str:
    found = shutil.which("powerbi-desktop") or shutil.which("powerbi-desktop.cmd")
    if not found:
        raise SystemExit("powerbi-desktop is not on PATH")
    return found


def capture_project(project: Path, pid: str, scale: str) -> None:
    report_dir = find_report_dir(project)
    pages = read_pages(report_dir)
    shot_dir = report_dir.parent / "screenshots"
    shot_dir.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="pbi-shots-") as temporary:
        out = Path(temporary)
        command = [
            _desktop_command(),
            "screenshot-all",
            "--pid",
            pid,
            "--output-dir",
            str(out),
            "--scale",
            scale,
            "--wait-seconds",
            "120",
        ]
        completed = subprocess.run(command, check=False)
        if completed.returncode != 0:
            raise SystemExit(f"powerbi-desktop screenshot-all exited {completed.returncode}")
        written = list(out.glob("*.png"))
        if not written:
            raise SystemExit(f"screenshot-all wrote no PNGs in {out}")
        used: set[str] = set()
        for raw in written:
            page = page_for_file(raw, pages)
            destination = shot_dir / f"{page.slug}.png"
            image = Image.open(raw)
            image.load()
            crop_to_canvas(image, page.width, page.height).save(destination, format="PNG")
            image.close()
            used.add(page.slug)
            print(f"{destination.relative_to(report_dir.parent)}  {page.width}x{page.height} canvas")
        missing = [page.display_name for page in pages if page.slug not in used]
        if missing:
            raise SystemExit(f"no screenshot matched pages: {missing}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Write canvas-only showcase PNGs for a finished report.")
    commands = parser.add_subparsers(dest="command", required=True)

    crop = commands.add_parser("crop", help="Crop screenshots already in the report folder")
    crop.add_argument("project", type=Path, nargs="+")
    crop.add_argument("--dry-run", action="store_true")

    capture = commands.add_parser("capture", help="Snapshot the open report, then crop into screenshots/")
    capture.add_argument("project", type=Path)
    capture.add_argument("--pid", required=True)
    capture.add_argument("--scale", default="2")

    args = parser.parse_args(argv)
    if args.command == "crop":
        for project in args.project:
            crop_project(project, args.dry_run)
        return 0
    capture_project(args.project, args.pid, args.scale)
    return 0


if __name__ == "__main__":
    sys.exit(main())
