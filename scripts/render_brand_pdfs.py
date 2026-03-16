#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT / "docs"
OUTPUT_DIR = ROOT / "output" / "pdf"

PALETTE = {
    "black": colors.HexColor("#0E0E0E"),
    "rust": colors.HexColor("#F28927"),
    "green": colors.HexColor("#39803E"),
    "gray": colors.HexColor("#AAAAAA"),
    "light_gray": colors.HexColor("#CCCCCC"),
}


def build_styles(compact: bool = False):
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="BrandTitle",
            parent=styles["Title"],
            fontName="Courier-Bold",
            fontSize=20 if compact else 24,
            leading=24 if compact else 28,
            textColor=PALETTE["rust"],
            spaceAfter=12 if compact else 16,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BrandH1",
            parent=styles["Heading1"],
            fontName="Courier-Bold",
            fontSize=15 if compact else 17,
            leading=18 if compact else 21,
            textColor=PALETTE["light_gray"],
            spaceBefore=10 if compact else 14,
            spaceAfter=6 if compact else 8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BrandH2",
            parent=styles["Heading2"],
            fontName="Courier-Bold",
            fontSize=11.5 if compact else 13,
            leading=14 if compact else 17,
            textColor=PALETTE["green"],
            spaceBefore=8 if compact else 10,
            spaceAfter=4 if compact else 6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BrandBody",
            parent=styles["BodyText"],
            fontName="Courier",
            fontSize=8.6 if compact else 10.5,
            leading=11.5 if compact else 15,
            textColor=PALETTE["gray"],
            spaceAfter=3 if compact else 6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BrandBullet",
            parent=styles["BodyText"],
            fontName="Courier",
            fontSize=8.4 if compact else 10.5,
            leading=11 if compact else 14,
            textColor=PALETTE["gray"],
            leftIndent=16,
            firstLineIndent=-10,
            bulletIndent=0,
            spaceAfter=2 if compact else 4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BrandQuote",
            parent=styles["BodyText"],
            fontName="Courier-Bold",
            fontSize=9.4 if compact else 11,
            leading=12 if compact else 15,
            textColor=PALETTE["light_gray"],
            leftIndent=16,
            borderPadding=0,
            spaceAfter=3 if compact else 6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BrandSmall",
            parent=styles["BodyText"],
            fontName="Courier",
            fontSize=8 if compact else 9,
            leading=10 if compact else 12,
            textColor=PALETTE["gray"],
            spaceAfter=2 if compact else 4,
        )
    )
    return styles


def inline_markup(text: str) -> str:
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(r"`([^`]+)`", r"<font color='#CCCCCC'>\1</font>", text)
    return text


def parse_markdown(md_path: Path, styles, compact: bool = False):
    story = []
    lines = md_path.read_text(encoding="utf-8").splitlines()
    in_list = False

    for raw_line in lines:
      line = raw_line.rstrip()
      if not line:
          if not compact:
              story.append(Spacer(1, 0.08 * inch))
          in_list = False
          continue

      if line.startswith("# "):
          story.append(Paragraph(inline_markup(line[2:].strip()), styles["BrandTitle"]))
          in_list = False
          continue

      if line.startswith("## "):
          story.append(Spacer(1, 0.05 * inch))
          story.append(Paragraph(inline_markup(line[3:].strip()), styles["BrandH1"]))
          in_list = False
          continue

      if line.startswith("### "):
          story.append(Paragraph(inline_markup(line[4:].strip()), styles["BrandH2"]))
          in_list = False
          continue

      if line.startswith("- "):
          story.append(
              Paragraph(
                  inline_markup(line[2:].strip()),
                  styles["BrandBullet"],
                  bulletText="-",
              )
          )
          in_list = True
          continue

      if re.match(r"^\d+\.\s", line):
          story.append(
              Paragraph(
                  inline_markup(line),
                  styles["BrandBullet"],
              )
          )
          in_list = True
          continue

      if line.startswith("`") and line.endswith("`"):
          story.append(Paragraph(inline_markup(line.strip("`")), styles["BrandQuote"]))
          in_list = False
          continue

      style = styles["BrandSmall"] if compact else styles["BrandBody"]
      story.append(Paragraph(inline_markup(line), style))
      in_list = False

    return story


def draw_frame(canvas, doc, subtitle: str):
    canvas.saveState()
    width, height = doc.pagesize
    canvas.setFillColor(PALETTE["black"])
    canvas.rect(0, 0, width, height, stroke=0, fill=1)

    canvas.setStrokeColor(PALETTE["rust"])
    canvas.setLineWidth(1)
    canvas.rect(18, 18, width - 36, height - 36, stroke=1, fill=0)

    canvas.setFont("Courier-Bold", 18)
    canvas.setFillColor(PALETTE["rust"])
    canvas.drawString(doc.leftMargin, height - 42, "HOLLER.WORKS")

    canvas.setFont("Courier-Bold", 12)
    canvas.setFillColor(PALETTE["green"])
    canvas.drawString(doc.leftMargin + 150, height - 42, subtitle)

    canvas.setFont("Courier", 9)
    canvas.setFillColor(PALETTE["gray"])
    canvas.drawRightString(width - doc.rightMargin, 28, f"page {doc.page}")
    canvas.restoreState()


def build_pdf(source_md: Path, output_pdf: Path, subtitle: str, compact: bool = False, pagesize=letter):
    styles = build_styles(compact=compact)
    doc = SimpleDocTemplate(
        str(output_pdf),
        pagesize=pagesize,
        leftMargin=(0.55 if compact else 0.9) * inch,
        rightMargin=(0.55 if compact else 0.9) * inch,
        topMargin=(0.7 if compact else 0.95) * inch,
        bottomMargin=(0.55 if compact else 0.8) * inch,
        title=source_md.stem.replace("-", " ").title(),
        author="Codex for HOLLER.WORKS",
    )
    story = parse_markdown(source_md, styles, compact=compact)
    doc.build(
        story,
        onFirstPage=lambda canvas, d: draw_frame(canvas, d, subtitle),
        onLaterPages=lambda canvas, d: draw_frame(canvas, d, subtitle),
    )


def build_two_column_pdf(source_md: Path, output_pdf: Path, subtitle: str):
    styles = build_styles(compact=True)
    pagesize = landscape(letter)
    left_margin = 0.55 * inch
    right_margin = 0.55 * inch
    top_margin = 0.7 * inch
    bottom_margin = 0.55 * inch
    gutter = 0.28 * inch
    usable_width = pagesize[0] - left_margin - right_margin
    column_width = (usable_width - gutter) / 2
    usable_height = pagesize[1] - top_margin - bottom_margin

    doc = BaseDocTemplate(
        str(output_pdf),
        pagesize=pagesize,
        leftMargin=left_margin,
        rightMargin=right_margin,
        topMargin=top_margin,
        bottomMargin=bottom_margin,
        title=source_md.stem.replace("-", " ").title(),
        author="Codex for HOLLER.WORKS",
    )

    frame_left = Frame(
        left_margin,
        bottom_margin,
        column_width,
        usable_height,
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
    )
    frame_right = Frame(
        left_margin + column_width + gutter,
        bottom_margin,
        column_width,
        usable_height,
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
    )
    doc.addPageTemplates([
        PageTemplate(
            id="two-column",
            frames=[frame_left, frame_right],
            onPage=lambda canvas, d: draw_frame(canvas, d, subtitle),
        )
    ])
    story = parse_markdown(source_md, styles, compact=True)
    doc.build(story)


def build_one_pager_pdf(output_pdf: Path):
    pagesize = landscape(letter)
    c = pdfcanvas.Canvas(str(output_pdf), pagesize=pagesize)
    width, height = pagesize

    c.setTitle("Hollerworks Brand One Pager")
    c.setAuthor("Codex for HOLLER.WORKS")

    c.setFillColor(PALETTE["black"])
    c.rect(0, 0, width, height, stroke=0, fill=1)

    c.setStrokeColor(PALETTE["rust"])
    c.setLineWidth(1)
    c.rect(18, 18, width - 36, height - 36, stroke=1, fill=0)

    c.setFillColor(PALETTE["rust"])
    c.setFont("Courier-Bold", 18)
    c.drawString(36, height - 40, "HOLLER.WORKS")

    c.setFillColor(PALETTE["green"])
    c.setFont("Courier-Bold", 12)
    c.drawString(182, height - 40, "// one-pager")

    c.setFillColor(PALETTE["rust"])
    c.setFont("Courier-Bold", 22)
    c.drawCentredString(width / 2, height - 74, "HOLLER.WORKS One-Pager")

    left_sections = [
        ("Identity", [
            "Display: HOLLER.WORKS",
            "Editorial/body: holler.works",
            "Descriptor: moderated tech and tech-adjacent jobs in Appalachia",
        ]),
        ("Core Feel", [
            "utilitarian but stylish",
            "grounded, regional, internet-native",
            "useful first, stylish second",
        ]),
        ("Voice", [
            "direct",
            "human",
            "restrained",
            "lightly rough-edged",
            "Avoid: buzzwords, empty optimism, generic future-of-work language",
        ]),
        ("Casing", [
            "Lowercase in branding, launch, social, editorial.",
            "Sentence case in UI, forms, and system copy.",
            "Avoid Holler.Works.",
        ]),
    ]

    right_sections = [
        ("Slash Device", [
            "Use // as a branded header or opener.",
            "Use >> for a short supporting line when useful.",
            "Examples: // appalachia, // launching holler.works",
            "Example support: >> stay. build. connected.",
        ]),
        ("Palette", [
            "Black #0E0E0E",
            "Rust #F28927",
            "Green #39803E",
            "Gray #AAAAAA / Light Gray #CCCCCC",
            "Rule: rust leads, green supports, black is the canvas",
        ]),
        ("Logo + Visuals", [
            "Keep the pixel mascot crisp and pixelated.",
            "Prefer black backgrounds.",
            "Rust wordmark + green supporting line is primary.",
            "Monospace is core to the brand voice.",
            "Avoid smoothing, random recolors, glossy SaaS polish.",
        ]),
        ("UI + Litmus Test", [
            "Keep rails, borders, visible structure, obvious states.",
            "Avoid rounded soft UI language and oversized whitespace.",
            "Ask: does it look like HOLLER.WORKS at a glance?",
            "Ask: does it keep the black/rust/green system?",
            "Ask: does it feel human, intentional, and credible?",
        ]),
    ]

    def draw_section_block(x, y, title, lines):
        c.setFillColor(PALETTE["light_gray"])
        c.setFont("Courier-Bold", 12)
        c.drawString(x, y, title)
        y -= 14
        c.setFillColor(PALETTE["gray"])
        c.setFont("Courier", 8.2)
        for line in lines:
            wrapped = []
            words = line.split()
            current = ""
            for word in words:
                candidate = f"{current} {word}".strip()
                if c.stringWidth(candidate, "Courier", 8.2) <= 308:
                    current = candidate
                else:
                    wrapped.append(current)
                    current = word
            if current:
                wrapped.append(current)

            for idx, part in enumerate(wrapped):
                prefix = "- " if idx == 0 else "  "
                c.drawString(x, y, prefix + part)
                y -= 10
            y -= 2
        return y - 6

    left_x = 46
    right_x = 410
    start_y = height - 120

    y = start_y
    for title, lines in left_sections:
        y = draw_section_block(left_x, y, title, lines)

    y = start_y
    for title, lines in right_sections:
        y = draw_section_block(right_x, y, title, lines)

    c.setFillColor(PALETTE["gray"])
    c.setFont("Courier", 9)
    c.drawRightString(width - 36, 28, "page 1")
    c.save()


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    build_pdf(
        DOCS_DIR / "brand-guide.md",
        OUTPUT_DIR / "hollerworks-brand-guide.pdf",
        "// brand guide",
    )
    build_pdf(
        DOCS_DIR / "brand-quick-reference.md",
        OUTPUT_DIR / "hollerworks-brand-quick-reference.pdf",
        "// quick reference",
        compact=True,
        pagesize=landscape(letter),
    )
    build_one_pager_pdf(
        OUTPUT_DIR / "hollerworks-brand-one-pager.pdf",
    )


if __name__ == "__main__":
    main()
