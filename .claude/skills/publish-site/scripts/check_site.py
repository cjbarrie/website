#!/usr/bin/env python3
"""Build the site and check it before publishing.

Usage: python3 .claude/skills/publish-site/scripts/check_site.py [--links]

Checks every paper entry (title, year, authors, known research areas, no duplicates),
every local file the page links to (PDFs, replication zips, images), and PDF sizes.
With --links it also requests every outside link and lists the ones that fail.
Exits non-zero if anything must be fixed before pushing.
"""
import re
import sys
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT))
import build  # noqa: E402

BIG_PDF_MB = 15
# Sites that refuse automated requests; a failure here says nothing about the link.
UNCHECKABLE = ("linkedin.com", "openreview.net", "ssrn.com", "jstor.org")


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        for k, v in attrs:
            if k in ("href", "src") and v and not v.startswith(("#", "mailto:", "data:")):
                self.urls.append(v)


def norm(title):
    return re.sub(r"[^a-z0-9]", "", title.lower())


def main(check_links):
    errors, warnings = [], []
    build.build()
    build.load_topics()

    seen = {}
    for status in ("published", "working"):
        for p in build.load_papers(status):
            name = f"{status}/{p['key']}"
            for field in ("title", "year", "author"):
                if not p.get(field):
                    errors.append(f"{name}: missing {field}")
            unknown = [k.strip() for k in p.get("topics", "").split(",") if k.strip() and k.strip() not in build.TOPICS]
            if unknown:
                errors.append(f"{name}: unknown research areas {unknown}")
            if not p.get("topics"):
                warnings.append(f"{name}: no research areas, so it won't show under any filter")
            if not p.get("pdf"):
                warnings.append(f"{name}: no PDF")
            src = p.get("_pdf_src")
            if src and src.stat().st_size > BIG_PDF_MB * 1e6:
                warnings.append(f"{name}: PDF is {src.stat().st_size / 1e6:.0f} MB; compress it")
            t = norm(p.get("title", ""))
            if t in seen:
                errors.append(f"{name}: same title as {seen[t]}")
            seen[t] = name

    site = build.OUT
    parser = Links()
    parser.feed((site / "index.html").read_text(encoding="utf-8"))
    outside = []
    for u in dict.fromkeys(parser.urls):
        if u.startswith(("http://", "https://")):
            outside.append(u)
        elif not (site / u.split("#")[0].split("?")[0].lstrip("/")).exists():
            errors.append(f"page links to {u}, which isn't in the built site")

    if check_links:
        for u in outside:
            if any(d in u for d in UNCHECKABLE):
                continue
            try:
                req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 site-check"})
                with urllib.request.urlopen(req, timeout=20) as r:
                    if r.status >= 400:
                        warnings.append(f"link returns {r.status}: {u}")
            except Exception as ex:  # noqa: BLE001
                code = getattr(ex, "code", None)
                if code in (401, 403, 429):
                    continue  # the site blocks robots; not evidence of a dead link
                warnings.append(f"link failed ({code or type(ex).__name__}): {u}")

    for w in warnings:
        print("warning:", w)
    for e in errors:
        print("ERROR:", e)
    print(f"\n{len(errors)} errors, {len(warnings)} warnings, {len(outside)} outside links"
          + (" checked" if check_links else " (run with --links to check them)"))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main("--links" in sys.argv))
