#!/usr/bin/env python3
"""Create a bottom-zone comparison sheet for Mora tarot card markers."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def parse_item(value: str) -> tuple[Path, str]:
    if "|" not in value:
        raise argparse.ArgumentTypeError("item must be formatted as path|label")
    path, label = value.split("|", 1)
    return Path(path), label


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--item", action="append", required=True, type=parse_item)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--crop-start", type=float, default=0.78)
    parser.add_argument("--panel-width", type=int, default=360)
    parser.add_argument("--panel-height", type=int, default=360)
    parser.add_argument("--font", type=Path, default=Path("public/assets/fonts/raleway-400.ttf"))
    args = parser.parse_args()

    sheet = Image.new("RGB", (len(args.item) * args.panel_width, args.panel_height), "#090705")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype(str(args.font), 18)

    for index, (path, label) in enumerate(args.item):
        image = Image.open(path).convert("RGB")
        crop = image.crop((0, int(image.height * args.crop_start), image.width, image.height))
        crop.thumbnail((args.panel_width - 20, args.panel_height - 60))
        x = index * args.panel_width + 10
        sheet.paste(crop, (x, 48))
        draw.multiline_text((x, 8), label, fill="#f0e6d3", font=font, spacing=2)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.output, quality=92)


if __name__ == "__main__":
    main()
