#!/usr/bin/env python3
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parent.parent
SOURCE_MD = ROOT / "docs" / "specs" / "2026-03-17-stack-security-growth.md"
OUTPUT_PDF = ROOT / "output" / "pdf" / "hollerworks-stack-security-growth.pdf"

PALETTE = {
    "black": colors.HexColor("#0E0E0E"),
    "rust": colors.HexColor("#F28927"),
    "green": colors.HexColor("#39803E"),
    "gray": colors.HexColor("#AAAAAA"),
    "light_gray": colors.HexColor("#CCCCCC"),
}


def build_styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="SpecTitle",
            parent=styles["Title"],
            fontName="Courier-Bold",
            fontSize=22,
            leading=26,
            textColor=PALETTE["rust"],
            spaceAfter=12,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SpecH1",
            parent=styles["Heading1"],
            fontName="Courier-Bold",
            fontSize=15,
            leading=19,
            textColor=PALETTE["light_gray"],
            spaceBefore=10,
            spaceAfter=7,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SpecH2",
            parent=styles["Heading2"],
            fontName="Courier-Bold",
            fontSize=11,
            leading=14,
            textColor=PALETTE["green"],
            spaceBefore=7,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SpecBody",
            parent=styles["BodyText"],
            fontName="Courier",
            fontSize=10,
            leading=14,
            textColor=PALETTE["gray"],
            spaceAfter=5,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SpecBullet",
            parent=styles["BodyText"],
            fontName="Courier",
            fontSize=9.8,
            leading=13.5,
            textColor=PALETTE["gray"],
            leftIndent=16,
            firstLineIndent=-10,
            bulletIndent=0,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SpecCode",
            parent=styles["BodyText"],
            fontName="Courier-Bold",
            fontSize=9.4,
            leading=12.5,
            textColor=PALETTE["light_gray"],
            backColor=colors.HexColor("#151515"),
            borderPadding=7,
            leftIndent=10,
            rightIndent=10,
            spaceAfter=7,
        )
    )
    return styles


def esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def parse_markdown(md_text: str, styles):
    story = []
    in_code = False
    code_lines = []

    for raw_line in md_text.splitlines():
        line = raw_line.rstrip()

        if line.startswith("```"):
            if in_code:
                story.append(Paragraph(esc("<br/>".join(code_lines)), styles["SpecCode"]))
                code_lines = []
                in_code = False
            else:
                in_code = True
            continue

        if in_code:
            code_lines.append(line)
            continue

        if not line:
            story.append(Spacer(1, 0.05 * inch))
            continue

        if line.startswith("# "):
            story.append(Paragraph(esc(line[2:].strip()), styles["SpecTitle"]))
            continue

        if line.startswith("## "):
            story.append(Spacer(1, 0.02 * inch))
            story.append(Paragraph(esc(line[3:].strip()), styles["SpecH1"]))
            continue

        if line.startswith("### "):
            story.append(Paragraph(esc(line[4:].strip()), styles["SpecH2"]))
            continue

        if line.startswith("- "):
            story.append(Paragraph(esc(line[2:].strip()), styles["SpecBullet"], bulletText="-"))
            continue

        if line[:2].isdigit() and line[1:3] == ". ":
            story.append(Paragraph(esc(line), styles["SpecBullet"]))
            continue

        if line.startswith("`") and line.endswith("`") and len(line) > 2:
            story.append(Paragraph(esc(line[1:-1]), styles["SpecCode"]))
            continue

        story.append(Paragraph(esc(line), styles["SpecBody"]))

    return story


def draw_frame(canvas, doc):
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
    canvas.setFont("Courier-Bold", 11)
    canvas.setFillColor(PALETTE["green"])
    canvas.drawString(doc.leftMargin + 150, height - 42, "// stack + security + growth")
    canvas.setFont("Courier", 9)
    canvas.setFillColor(PALETTE["gray"])
    canvas.drawRightString(width - doc.rightMargin, 28, f"page {doc.page}")
    canvas.restoreState()


def main():
    OUTPUT_PDF.parent.mkdir(parents=True, exist_ok=True)
    styles = build_styles()
    doc = SimpleDocTemplate(
        str(OUTPUT_PDF),
        pagesize=letter,
        leftMargin=0.9 * inch,
        rightMargin=0.9 * inch,
        topMargin=0.95 * inch,
        bottomMargin=0.8 * inch,
        title="HOLLER.WORKS Stack, Security, and Early Growth Pulse",
        author="Codex for HOLLER.WORKS",
    )
    story = parse_markdown(SOURCE_MD.read_text(encoding="utf-8"), styles)
    doc.build(story, onFirstPage=draw_frame, onLaterPages=draw_frame)
    print(OUTPUT_PDF)


if __name__ == "__main__":
    main()
