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


def load_font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(name, size=size)


def fit_text(draw: ImageDraw.ImageDraw, text: str, font_name: str, max_size: int, min_size: int, max_width: int):
    for size in range(max_size, min_size - 1, -2):
        font = load_font(font_name, size)
        bbox = draw.textbbox((0, 0), text, font=font)
        if bbox[2] - bbox[0] <= max_width:
            return font
    return load_font(font_name, min_size)


def build_card(width: int, height: int, out_path: Path):
    canvas = Image.new("RGBA", (width, height), BLACK)
    draw = ImageDraw.Draw(canvas)

    lockup = Image.open(ASSET_ROOT / "logo" / "hollerworks-lockup-master.png").convert("RGBA")
    mountain = Image.open(ASSET_ROOT / "support" / "hollerworks-mountain-strip.png").convert("RGBA")

    title = "// LAUNCHING HOLLER.WORKS"
    tagline_lines = ["STAY.", "BUILD."]

    horizontal_margin = int(width * 0.08)
    top_margin = int(height * 0.08)
    bottom_margin = int(height * 0.06)

    title_font = fit_text(draw, title, "DejaVuSansMono-Bold.ttf", int(width * 0.055), int(width * 0.03), width - (horizontal_margin * 2))
    tagline_font = fit_text(draw, "BUILD.", "DejaVuSansMono-Bold.ttf", int(width * 0.05), int(width * 0.026), width - (horizontal_margin * 2))
    footer_font = fit_text(draw, "moderated tech jobs for appalachia", "DejaVuSansMono.ttf", int(width * 0.022), int(width * 0.016), width - (horizontal_margin * 2))

    title_y = top_margin
    draw.text((horizontal_margin, title_y), title, fill=ORANGE, font=title_font)

    title_bbox = draw.textbbox((horizontal_margin, title_y), title, font=title_font)
    rule_y = title_bbox[3] + int(height * 0.025)
    draw.line((horizontal_margin, rule_y, width - horizontal_margin, rule_y), fill=ORANGE, width=max(2, width // 320))

    available_height = height - rule_y - bottom_margin - int(height * 0.18)
    target_lockup_width = int(width * 0.72)
    target_lockup_height = int(available_height * 0.72)
    scale = min(target_lockup_width / lockup.width, target_lockup_height / lockup.height)
    resized_lockup = lockup.resize((int(lockup.width * scale), int(lockup.height * scale)), Image.Resampling.NEAREST)

    lockup_x = (width - resized_lockup.width) // 2
    lockup_y = rule_y + int((available_height - resized_lockup.height) * 0.45)
    canvas.alpha_composite(resized_lockup, (lockup_x, lockup_y))

    mountain_width = int(width * 0.78)
    mountain_height = int(mountain.height * (mountain_width / mountain.width))
    resized_mountain = mountain.resize((mountain_width, mountain_height), Image.Resampling.NEAREST)
    mountain_x = (width - mountain_width) // 2
    mountain_y = height - bottom_margin - mountain_height - int(height * 0.07)
    canvas.alpha_composite(resized_mountain, (mountain_x, mountain_y))

    line_gap = int(height * 0.012)
    tagline_metrics = [draw.textbbox((0, 0), line, font=tagline_font) for line in tagline_lines]
    tagline_width = max(metric[2] - metric[0] for metric in tagline_metrics)
    tagline_height = sum((metric[3] - metric[1]) for metric in tagline_metrics) + line_gap
    tagline_x = (width - tagline_width) // 2
    tagline_y = mountain_y - tagline_height - int(height * 0.05)
    current_y = tagline_y
    for line, metric in zip(tagline_lines, tagline_metrics):
        line_width = metric[2] - metric[0]
        line_x = (width - line_width) // 2
        draw.text((line_x, current_y), line, fill=GREEN, font=tagline_font)
        current_y += (metric[3] - metric[1]) + line_gap

    footer = "moderated tech jobs for appalachia"
    footer_bbox = draw.textbbox((0, 0), footer, font=footer_font)
    footer_x = (width - (footer_bbox[2] - footer_bbox[0])) // 2
    footer_y = height - bottom_margin - (footer_bbox[3] - footer_bbox[1])
    draw.text((footer_x, footer_y), footer, fill=WHITE, font=footer_font)

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out_path, quality=95)


def main():
    build_card(1080, 1350, OUTPUT_ROOT / "hollerworks-instagram-launch-portrait.png")
    build_card(1080, 1080, OUTPUT_ROOT / "hollerworks-instagram-launch-square.png")


if __name__ == "__main__":
    main()
