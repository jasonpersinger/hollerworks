#!/usr/bin/env python3

import json
import re
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse

import pandas as pd
import requests


ROOT = Path("/home/jason/HOLLERWORKS")
OUTPUT = ROOT / "output" / "spreadsheet" / "getro-company-leads.csv"
SUMMARY = ROOT / "output" / "spreadsheet" / "getro-company-leads-summary.md"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
}

BOARD_URLS = [
    "https://jobs.knoxtech.org/jobs",
    "https://jobs.launchtn.org/jobs",
]

TECH_KEYWORDS = [
    "engineer",
    "developer",
    "software",
    "platform",
    "product",
    "data",
    "ai",
    "security",
    "technical",
    "designer",
    "ux",
    "ui",
    "analyst",
    "interoperability",
    "cloud",
    "devops",
]


def fetch_text(url: str) -> str:
    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    return response.text


def extract_next_data(html: str) -> dict:
    match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.S)
    if not match:
        raise ValueError("Missing __NEXT_DATA__")
    return json.loads(match.group(1))


def build_detail_url(board_url: str, org_slug: str, job_slug: str) -> str:
    parsed = urlparse(board_url)
    return f"{parsed.scheme}://{parsed.netloc}/companies/{org_slug}/jobs/{job_slug}#content"


def infer_ats(apply_url: str) -> str:
    host = urlparse(apply_url).netloc.lower()
    if "greenhouse.io" in host:
        return "greenhouse"
    if "lever.co" in host:
        return "lever"
    if "ashbyhq.com" in host:
        return "ashby"
    if "myworkdayjobs.com" in host or "workday" in host:
        return "workday"
    if "smartrecruiters.com" in host:
        return "smartrecruiters"
    if "linkedin.com" in host:
        return "linkedin"
    if "careerpuck.com" in host:
        return "careerpuck"
    if "csod.com" in host:
        return "cornerstone"
    if "jobvite.com" in host:
        return "jobvite"
    if host:
        return host
    return ""


def tech_score(titles):
    score = 0
    for title in titles:
        lower = title.lower()
        score += sum(1 for keyword in TECH_KEYWORDS if keyword in lower)
    return score


def recommended_action(ats_type: str, score: int, domain: str) -> str:
    if ats_type in {"greenhouse", "lever", "ashby"}:
        return "Wire directly into existing seeder"
    if score <= 0:
        return "Discovery only"
    if domain:
        return "Research direct career page / ATS"
    return "Manual review"


def main():
    grouped = defaultdict(lambda: {
        "boards": set(),
        "titles": [],
        "locations": set(),
        "detail_url": "",
        "apply_url": "",
        "company_domain": "",
        "company_website": "",
        "company_slug": "",
    })

    for board_url in BOARD_URLS:
        html = fetch_text(board_url)
        data = extract_next_data(html)
        jobs = data["props"]["pageProps"]["initialState"]["jobs"]["found"]
        for job in jobs:
            org = job.get("organization") or {}
            company_name = org.get("name", "").strip()
            if not company_name or not org.get("slug") or not job.get("slug"):
                continue

            key = (company_name, org.get("slug"))
            entry = grouped[key]
            entry["boards"].add(board_url)
            entry["titles"].append(job.get("title", "").strip())
            for location in job.get("locations") or []:
                if location:
                    entry["locations"].add(location)
            entry["company_slug"] = org.get("slug", "")
            if not entry["detail_url"]:
                entry["detail_url"] = build_detail_url(board_url, org["slug"], job["slug"])

    rows = []
    for (company_name, company_slug), entry in grouped.items():
        try:
            detail_html = fetch_text(entry["detail_url"])
            detail_data = extract_next_data(detail_html)
            current_job = detail_data["props"]["pageProps"]["initialState"]["jobs"]["currentJob"]
            org = current_job.get("organization") or {}
            apply_url = current_job.get("url", "")
            domain = (org.get("domain") or "").strip()
            company_website = f"https://{domain}" if domain else ""
            entry["apply_url"] = apply_url
            entry["company_domain"] = domain
            entry["company_website"] = company_website
        except Exception:
            pass

        score = tech_score(entry["titles"])
        rows.append({
            "company_name": company_name,
            "company_slug": company_slug,
            "board_sources": " | ".join(sorted(entry["boards"])),
            "visible_jobs_on_first_page": len(entry["titles"]),
            "sample_titles": " | ".join(entry["titles"][:4]),
            "sample_locations": " | ".join(sorted(entry["locations"])),
            "company_domain": entry["company_domain"],
            "company_website": entry["company_website"],
            "sample_apply_url": entry["apply_url"],
            "apply_host": urlparse(entry["apply_url"]).netloc.lower(),
            "likely_ats_type": infer_ats(entry["apply_url"]),
            "tech_signal_score": score,
            "recommended_action": recommended_action(infer_ats(entry["apply_url"]), score, entry["company_domain"]),
            "notes": "",
        })

    df = pd.DataFrame(rows)
    df = df.sort_values(
        by=["tech_signal_score", "visible_jobs_on_first_page", "company_name"],
        ascending=[False, False, True],
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT, index=False)

    lines = [
        "# Getro Company Leads",
        "",
        f"- rows: `{len(df)}`",
        f"- output: `{OUTPUT}`",
        "",
        "## Direct ATS-ready leads",
        "",
    ]

    direct = df[df["likely_ats_type"].isin(["greenhouse", "lever", "ashby"])]
    if direct.empty:
        lines.append("- none in this pass")
    else:
        for _, row in direct.iterrows():
            lines.append(f"- `{row['company_name']}` via `{row['likely_ats_type']}`")

    lines.extend([
        "",
        "## Discovery-only / research leads",
        "",
    ])

    for _, row in df[~df["likely_ats_type"].isin(["greenhouse", "lever", "ashby"])].head(10).iterrows():
        lines.append(f"- `{row['company_name']}`: {row['recommended_action']}")

    SUMMARY.write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
