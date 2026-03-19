#!/usr/bin/env python3

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path("/home/jason/HOLLERWORKS")
ASSET_ROOT = ROOT / "assets" / "brand"
OUTPUT_ROOT = ROOT / "output" / "social"

BLACK = "#0b0b0b"
ORANGE = "#f79226"
GREEN = "#3f9142"
WHITE = "#e9e5dd"


def load_font(name: str, size: int):
    return ImageFont.truetype(name, size=size)


def fit_text(draw, text, font_name, max_size, min_size, max_width):
    for size in range(max_size, min_size - 1, -2):
        font = load_font(font_name, size)
        bbox = draw.textbbox((0, 0), text, font=font)
        if bbox[2] - bbox[0] <= max_width:
            return font
    return load_font(font_name, min_size)


def wrap_text(draw, text, font, max_width):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        test = word if not current else f"{current} {word}"
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def build_intro_card(width, height, out_path):
    canvas = Image.new("RGBA", (width, height), BLACK)
    draw = ImageDraw.Draw(canvas)

    wordmark = Image.open(ASSET_ROOT / "logo" / "hollerworks-wordmark-master.png").convert("RGBA")
    mascot = Image.open(ASSET_ROOT / "logo" / "hollerworks-mascot-master.png").convert("RGBA")

    margin_x = int(width * 0.085)
    top = int(height * 0.08)
    bottom = int(height * 0.06)
    content_width = width - (margin_x * 2)

    title = "// HOLLER.WORKS"
    title_font = fit_text(draw, title, "DejaVuSansMono-Bold.ttf", int(width * 0.06), int(width * 0.034), content_width)
    body_font = fit_text(draw, "human-moderated.", "DejaVuSansMono.ttf", int(width * 0.033), int(width * 0.022), content_width)
    tag_font = fit_text(draw, "Build.", "DejaVuSansMono-Bold.ttf", int(width * 0.055), int(width * 0.034), content_width)
    foot_font = fit_text(draw, "link in bio.", "DejaVuSansMono.ttf", int(width * 0.026), int(width * 0.018), content_width)

    y = top
    draw.text((margin_x, y), title, fill=ORANGE, font=title_font)
    title_bbox = draw.textbbox((margin_x, y), title, font=title_font)
    y = title_bbox[3] + int(height * 0.02)
    draw.line((margin_x, y, width - margin_x, y), fill=ORANGE, width=max(2, width // 320))

    y += int(height * 0.045)
    wordmark_target_w = int(content_width * 0.46)
    wordmark_scale = wordmark_target_w / wordmark.width
    wordmark_resized = wordmark.resize((int(wordmark.width * wordmark_scale), int(wordmark.height * wordmark_scale)), Image.Resampling.NEAREST)
    canvas.alpha_composite(wordmark_resized, (margin_x, y))
    y += wordmark_resized.height + int(height * 0.045)

    blocks = [
        ("tech and tech-adjacent jobs tied to appalachia.", WHITE, body_font, 0),
        ("real listings.", WHITE, body_font, int(height * 0.03)),
        ("comp required.", WHITE, body_font, int(height * 0.008)),
        ("human-moderated.", WHITE, body_font, int(height * 0.008)),
        ("Stay.", GREEN, tag_font, int(height * 0.04)),
        ("Build.", GREEN, tag_font, int(height * 0.002)),
        ("link in bio.", WHITE, foot_font, int(height * 0.04)),
        ("#appalachia", ORANGE, foot_font, int(height * 0.01)),
    ]

    for text, color, font, gap_before in blocks:
        y += gap_before
        lines = wrap_text(draw, text, font, content_width)
        for line in lines:
            draw.text((margin_x, y), line, fill=color, font=font)
            bbox = draw.textbbox((margin_x, y), line, font=font)
            y = bbox[3] + int(height * 0.004)

    mascot_target_w = int(width * 0.12)
    mascot_scale = mascot_target_w / mascot.width
    mascot_resized = mascot.resize((int(mascot.width * mascot_scale), int(mascot.height * mascot_scale)), Image.Resampling.NEAREST)
    mascot_x = width - margin_x - mascot_resized.width - int(width * 0.06)
    mascot_y = height - bottom - mascot_resized.height - int(height * 0.12)
    canvas.alpha_composite(mascot_resized, (mascot_x, mascot_y))

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out_path, quality=95)


def main():
    build_intro_card(1080, 1080, OUTPUT_ROOT / "hollerworks-instagram-intro-square.png")
    build_intro_card(1080, 1350, OUTPUT_ROOT / "hollerworks-instagram-intro-portrait.png")


if __name__ == "__main__":
    main()
