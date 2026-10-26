#!/usr/bin/env python3
"""Fetch a BibTeX entry for a DOI (or arXiv id) and print it.

Usage: python3 doi2bib.py 10.1177/00031224231234567
       python3 doi2bib.py arXiv:2401.12345
"""
import re
import sys
import urllib.request


def fetch(url, accept):
    req = urllib.request.Request(url, headers={"Accept": accept, "User-Agent": "add-paper-skill/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8")


def main(ident):
    ident = ident.strip()
    m = re.match(r"(?i)arxiv:(\S+)", ident)
    if m:
        ident = f"10.48550/arXiv.{m.group(1)}"
    ident = re.sub(r"^https?://(dx\.)?doi\.org/", "", ident)
    print(fetch(f"https://doi.org/{ident}", "application/x-bibtex; charset=utf-8"))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
