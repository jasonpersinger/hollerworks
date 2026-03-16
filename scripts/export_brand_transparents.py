#!/usr/bin/env python3
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parent.parent
LOGO_DIR = ROOT / "assets" / "brand" / "logo"
BACKGROUND = (14, 14, 14)
ASSETS_DIR = ROOT / "assets"


def color_to_alpha(img: Image.Image, bg: tuple[int, int, int]) -> Image.Image:
    src = img.convert("RGBA")
    out = Image.new("RGBA", src.size)

    for y in range(src.height):
        for x in range(src.width):
            r, g, b, a = src.getpixel((x, y))

            if a == 0:
                out.putpixel((x, y), (0, 0, 0, 0))
                continue

            alpha = 0.0
            for channel, bg_channel in zip((r, g, b), bg):
                if channel > bg_channel:
                    denom = 255 - bg_channel
                    candidate = 0.0 if denom == 0 else (channel - bg_channel) / denom
                elif channel < bg_channel:
                    denom = bg_channel
                    candidate = 0.0 if denom == 0 else (bg_channel - channel) / denom
                else:
                    candidate = 0.0
                alpha = max(alpha, candidate)

            if alpha <= 0:
                out.putpixel((x, y), (0, 0, 0, 0))
                continue

            new_channels = []
            for channel, bg_channel in zip((r, g, b), bg):
                value = bg_channel + (channel - bg_channel) / alpha
                new_channels.append(max(0, min(255, int(round(value)))))

            out.putpixel((x, y), (*new_channels, max(0, min(255, int(round(alpha * 255))))))

    return out


def is_background(pixel: tuple[int, int, int, int], bg: tuple[int, int, int], tolerance: int = 18) -> bool:
    if pixel[3] == 0:
        return True
    return all(abs(channel - bg_channel) <= tolerance for channel, bg_channel in zip(pixel[:3], bg))


def sprite_to_transparent(img: Image.Image, bg: tuple[int, int, int]) -> Image.Image:
    src = img.convert("RGBA")
    width, height = src.size

    bg_mask = [[False for _ in range(width)] for _ in range(height)]
    for y in range(height):
        for x in range(width):
            bg_mask[y][x] = is_background(src.getpixel((x, y)), bg)

    external = [[False for _ in range(width)] for _ in range(height)]
    queue: deque[tuple[int, int]] = deque()

    for x in range(width):
        if bg_mask[0][x]:
            queue.append((x, 0))
        if bg_mask[height - 1][x]:
            queue.append((x, height - 1))
    for y in range(height):
        if bg_mask[y][0]:
            queue.append((0, y))
        if bg_mask[y][width - 1]:
            queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()
        if external[y][x] or not bg_mask[y][x]:
            continue
        external[y][x] = True
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height and not external[ny][nx] and bg_mask[ny][nx]:
                queue.append((nx, ny))

    subject_mask = Image.new("L", src.size, 0)
    for y in range(height):
        for x in range(width):
            if not external[y][x]:
                subject_mask.putpixel((x, y), 255)

    outline_mask = subject_mask.filter(ImageFilter.MaxFilter(3))
    outline = Image.new("L", src.size, 0)
    for y in range(height):
        for x in range(width):
            if outline_mask.getpixel((x, y)) and not subject_mask.getpixel((x, y)):
                outline.putpixel((x, y), 255)

    out = Image.new("RGBA", src.size, (0, 0, 0, 0))
    for y in range(height):
        for x in range(width):
            if outline.getpixel((x, y)):
                out.putpixel((x, y), (*bg, 255))

    for y in range(height):
        for x in range(width):
            if subject_mask.getpixel((x, y)):
                px = src.getpixel((x, y))
                if bg_mask[y][x]:
                    out.putpixel((x, y), (*bg, 255))
                else:
                    out.putpixel((x, y), px)

    return out


def main() -> None:
    lockup_primary = Image.open(LOGO_DIR / "hollerworks-lockup-primary.png").convert("RGBA")
    wordmark_primary = Image.open(LOGO_DIR / "hollerworks-wordmark-primary.png").convert("RGBA")
    mascot_source = Image.open(ASSETS_DIR / "logo.png").convert("RGBA")

    mascot_source.save(LOGO_DIR / "hollerworks-mascot-on-black.png")

    wordmark_master = color_to_alpha(wordmark_primary, BACKGROUND)
    wordmark_master.save(LOGO_DIR / "hollerworks-wordmark-master.png")

    mascot_master = sprite_to_transparent(mascot_source, BACKGROUND)
    mascot_master.save(LOGO_DIR / "hollerworks-mascot-master.png")

    lockup_master = color_to_alpha(lockup_primary, BACKGROUND)
    mascot_crop = sprite_to_transparent(lockup_primary.crop((0, 0, lockup_primary.width, 520)), BACKGROUND)
    lockup_master.alpha_composite(mascot_crop, (0, 0))
    lockup_master.save(LOGO_DIR / "hollerworks-lockup-master.png")

    transparent_old = LOGO_DIR / "hollerworks-mascot-transparent.png"
    if transparent_old.exists():
        transparent_old.unlink()
    for redundant in ("hollerworks-lockup-on-black.png", "hollerworks-wordmark-on-black.png"):
        path = LOGO_DIR / redundant
        if path.exists():
            path.unlink()


if __name__ == "__main__":
    main()
