#!/usr/bin/env python3
"""Add a deterministic Mora footer marker to an approved tarot card image."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps


def parse_color(value: str) -> tuple[int, int, int, int]:
    raw = value.strip().lstrip("#")
    if len(raw) != 6:
        raise argparse.ArgumentTypeError("color must be a 6-digit hex value")
    return tuple(int(raw[i : i + 2], 16) for i in (0, 2, 4)) + (255,)


def text_width(draw: ImageDraw.ImageDraw, font: ImageFont.FreeTypeFont, text: str, tracking: int) -> int:
    widths = [draw.textbbox((0, 0), char, font=font)[2] for char in text]
    return sum(widths) + max(len(text) - 1, 0) * tracking


def draw_tracked_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[float, float],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int],
    tracking: int,
) -> None:
    x, y = xy
    for char in text:
        draw.text((x, y), char, font=font, fill=fill)
        x += draw.textbbox((0, 0), char, font=font)[2] + tracking


def make_marker_layer(
    size: tuple[int, int],
    xy: tuple[float, float],
    marker: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int],
    tracking: int,
) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw_tracked_text(draw, xy, marker, font, fill, tracking)
    return layer


def integrate_marker_with_scene(base: Image.Image, marker_layer: Image.Image, opacity: int) -> Image.Image:
    alpha = marker_layer.getchannel("A")
    if opacity < 255:
        alpha = alpha.point(lambda value: int(value * opacity / 255))

    footer_y = int(base.height * 0.78)
    footer = base.crop((0, footer_y, base.width, base.height)).convert("L")
    texture = ImageOps.autocontrast(footer.filter(ImageFilter.FIND_EDGES)).filter(ImageFilter.GaussianBlur(0.45))
    texture_full = Image.new("L", base.size, 0)
    texture_full.paste(texture, (0, footer_y))

    distressed_alpha = ImageChops.subtract(alpha, texture_full.point(lambda value: int(value * 0.18)))
    marker_layer.putalpha(distressed_alpha)
    marker_layer = marker_layer.filter(ImageFilter.GaussianBlur(0.15))

    return Image.alpha_composite(base, marker_layer)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--marker", required=True)
    parser.add_argument("--font", type=Path, default=Path("public/assets/fonts/cormorant-garamond-400.ttf"))
    parser.add_argument("--font-size", type=int, default=104)
    parser.add_argument("--tracking", type=int, default=10)
    parser.add_argument("--center-y", type=float, default=0.915)
    parser.add_argument("--color", type=parse_color, default=parse_color("#c9a96e"))
    parser.add_argument("--opacity", type=int, default=245)
    parser.add_argument("--integrate-scene", action="store_true")
    args = parser.parse_args()

    image = Image.open(args.input).convert("RGBA")
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(str(args.font), args.font_size)
    marker = args.marker.strip()

    bbox = draw.textbbox((0, 0), marker, font=font)
    width = text_width(draw, font, marker, args.tracking)
    height = bbox[3] - bbox[1]
    x = (image.width - width) / 2
    y = image.height * args.center_y - height / 2 - bbox[1]

    shadow_layer = make_marker_layer(image.size, (x + 2, y + 2), marker, font, (0, 0, 0, 130), args.tracking)
    marker_layer = make_marker_layer(image.size, (x, y), marker, font, args.color, args.tracking)
    image = Image.alpha_composite(image, shadow_layer)
    if args.integrate_scene:
        image = integrate_marker_with_scene(image, marker_layer, args.opacity)
    else:
        if args.opacity < 255:
            marker_layer.putalpha(marker_layer.getchannel("A").point(lambda value: int(value * args.opacity / 255)))
        image = Image.alpha_composite(image, marker_layer)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(args.output)


if __name__ == "__main__":
    main()
