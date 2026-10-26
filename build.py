#!/usr/bin/env python3
"""Build the static site into _site/ from content/profile.json and papers/*.

Standard library only. Run:  python3 build.py
Preview:                    python3 -m http.server -d _site 8000
"""
import html
import json
import re
import shutil
from datetime import date
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "_site"
PAPERS = ROOT / "papers"


# --- BibTeX -----------------------------------------------------------------

def parse_bib(text):
    """Minimal BibTeX parser: returns a list of dicts with 'type', 'key' and fields."""
    entries = []
    i = 0
    while True:
        m = re.compile(r"@(\w+)\s*\{\s*([^,\s]+)\s*,", re.S).search(text, i)
        if not m:
            break
        entry = {"type": m.group(1).lower(), "key": m.group(2)}
        i = m.end()
        while i < len(text):
            fm = re.compile(r"\s*,?\s*(\w[\w-]*)\s*=\s*", re.S).match(text, i)
            if not fm:
                end = text.find("}", i)
                i = len(text) if end == -1 else end + 1
                break
            name = fm.group(1).lower()
            i = fm.end()
            value, i = _read_value(text, i)
            entry[name] = _clean(value)
        entries.append(entry)
    return entries


def _read_value(text, i):
    if text[i] == "{":
        depth, j = 0, i
        while j < len(text):
            if text[j] == "{":
                depth += 1
            elif text[j] == "}":
                depth -= 1
                if depth == 0:
                    return text[i + 1:j], j + 1
            j += 1
        return text[i + 1:], len(text)
    if text[i] == '"':
        j = text.find('"', i + 1)
        return text[i + 1:j], j + 1
    m = re.compile(r"[^,}\s]+").match(text, i)
    return m.group(0), m.end()


LATEX = {r"\&": "&", r"\%": "%", r"\_": "_", "--": "–", "~": " ", r"\'e": "é", r"\'a": "á",
         r"\"o": "ö", r"\"u": "ü", r"\"a": "ä"}


def _clean(value):
    value = re.sub(r"\s+", " ", value).strip()
    for k, v in LATEX.items():
        value = value.replace(k, v)
    return value.replace("{", "").replace("}", "")


def format_authors(raw, self_name):
    names = []
    for a in re.split(r"\s+and\s+", raw):
        a = a.strip()
        if "," in a:
            last, first = [p.strip() for p in a.split(",", 1)]
            a = f"{first} {last}"
        esc = html.escape(a)
        if self_name and self_name.lower() in a.lower():
            esc = f'<span class="self">{esc}</span>'
        names.append(esc)
    if len(names) > 8:
        # First three authors, then a count, naming self if they're further down.
        selfs = [n for n in names[3:] if 'class="self"' in n]
        tail = f", including {selfs[0]}" if selfs else ""
        return ", ".join(names[:3]) + f", and {len(names) - 3} others{tail}"
    if len(names) <= 2:
        return " and ".join(names)
    return ", ".join(names[:-1]) + ", and " + names[-1]


def load_papers(status):
    folder = PAPERS / status
    papers = []
    for bib in sorted(folder.glob("*.bib")):
        for e in parse_bib(bib.read_text(encoding="utf-8")):
            e["status"] = status
            pdf = bib.with_suffix(".pdf")
            if pdf.exists() and not e.get("pdf"):
                e["pdf"] = f"papers/{pdf.name}"
                e["_pdf_src"] = pdf
            # A local replication package sits next to the .bib as <slug>-replication.zip
            rep = bib.with_name(bib.stem + "-replication.zip")
            if rep.exists() and not e.get("replication"):
                e["replication"] = f"papers/{rep.name}"
                e["_rep_src"] = rep
            papers.append(e)
    papers.sort(key=lambda p: (-int(re.sub(r"\D", "", p.get("year", "0")) or 0), p.get("title", "")))
    return papers


TOPICS = {}


def load_topics():
    f = ROOT / "content/topics.json"
    data = json.loads(f.read_text(encoding="utf-8")) if f.exists() else []
    TOPICS.clear()
    TOPICS.update({t["key"]: t for t in data})
    return data


def paper_topics(p):
    keys = [k.strip() for k in p.get("topics", "").split(",") if k.strip()]
    unknown = [k for k in keys if k not in TOPICS]
    if unknown:
        print(f"warning: {p['key']} has unknown topics {unknown} (add them to content/topics.json)")
    return [k for k in keys if k in TOPICS]


def pill(key, tag="span", extra=""):
    t = TOPICS[key]
    # Pills show the short name; the full name is the tooltip.
    return (f'<{tag} class="pill t-{e(key)}" data-topic="{e(key)}" title="{e(t["label"])}"{extra}>'
            f'<i aria-hidden="true"></i>{e(t.get("short", t["label"]))}</{tag}>')


def topic_css():
    light = "".join(f".t-{k}{{--tc:{t['color']}}}" for k, t in TOPICS.items())
    dark = lambda sel: "".join(f"{sel} .t-{k}{{--tc:{t.get('color_dark', t['color'])}}}" for k, t in TOPICS.items())
    return (f"<style>{light}"
            f"@media (prefers-color-scheme: dark){{{dark(':root:not([data-theme=light])')}}}"
            f"{dark(':root[data-theme=dark]')}{dark('.arcade')}</style>")


def venue_of(p):
    return p.get("journal") or p.get("booktitle") or p.get("publisher") or ""


# --- Rendering --------------------------------------------------------------

def e(s):
    return html.escape(s or "", quote=True)


LINK_PILLS = [
    ("pdf", "PDF", '<path d="M4 1.5h5.5L12.5 4.5V14.5h-8.5z"/><path d="M9.5 1.5v3h3"/><path d="M8.5 7v4.5M6.5 9.5l2 2 2-2"/>'),
    ("replication", "Replication", '<rect x="2" y="2.5" width="12" height="3.5" rx="1"/><rect x="2" y="7" width="12" height="3.5" rx="1"/><path d="M4.5 4.25h1M4.5 8.75h1M2 12h12"/>'),
    ("code", "Code", '<path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5"/>'),
    ("data", "Data", '<ellipse cx="8" cy="4" rx="5.5" ry="2"/><path d="M2.5 4v8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V4M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2"/>'),
    ("preprint", "Preprint", '<path d="M4 1.5h8v13H4z"/><path d="M6 5h4M6 7.5h4M6 10h2.5"/>'),
]


def render_paper(p, self_name):
    title = e(p.get("title", "Untitled"))
    # The title goes to the journal's page via the DOI when there is one.
    link = (f"https://doi.org/{p['doi']}" if p.get("doi") else p.get("url")) or p.get("pdf")
    title_html = f'<a href="{e(link)}">{title}<span class="arrow" aria-hidden="true">↗</span></a>' if link else title

    venue = venue_of(p)
    bits = []
    if venue:
        bits.append(f"<em>{e(venue)}</em>")
    if p.get("note"):
        bits.append(e(p["note"]))
    meta = ", ".join(bits)

    # Resource pills under each paper. The title already links to the journal page.
    links = []
    for key, label, icon in LINK_PILLS:
        if p.get(key):
            links.append(f'<a class="lpill" href="{e(p[key])}"><svg viewBox="0 0 16 16" aria-hidden="true">{icon}</svg>{label}</a>')
    links_html = f'<p class="plinks">{"".join(links)}</p>' if links else ""

    topics = paper_topics(p)
    marks = "".join(
        f'<i class="sq t-{e(k)}" title="{e(TOPICS[k]["label"])}"></i>' for k in topics
    )
    labels = ", ".join(TOPICS[k]["label"] for k in topics)
    marks_html = f'<span class="marks" role="img" aria-label="{e(labels)}">{marks}</span>' if topics else ""
    search = " ".join([p.get("title", ""), p.get("author", ""), venue, p.get("year", ""), p.get("note", "")]).lower()
    return f"""
      <li class="paper" data-text="{e(search)}" data-topics="{e(" ".join(topics))}" data-year="{e(p.get("year", ""))}">
        <span class="pyear"><span class="y">{e(p.get("year", ""))}</span>{marks_html}</span>
        <div class="pbody">
          <p class="ptitle">{title_html}</p>
          <p class="pauthors">{format_authors(p.get("author", ""), self_name)}</p>
          <p class="pmeta">{meta}</p>
          {links_html}
        </div>
      </li>"""


ICONS = {
    "email": '<path d="M3 6h18v12H3z" fill="none"/><path d="m3 7 9 6 9-6" fill="none"/>',
    "github": '<path d="M9 19c-4 1.5-4-2-6-2.5m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" fill="none"/>',
    "scholar": '<path d="M12 4 2 10l10 6 10-6z" fill="none"/><path d="M6 12.5V17c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" fill="none"/>',
    "linkedin": '<rect x="3" y="3" width="18" height="18" rx="2" fill="none"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7" fill="none"/>',
    "cv": '<path d="M6 3h9l3 3v15H6z" fill="none"/><path d="M9 12h6M9 16h6" fill="none"/>',
}
LABELS = {"email": "Email", "github": "GitHub", "scholar": "Google Scholar", "linkedin": "LinkedIn", "cv": "CV"}


def render_links(links):
    out = []
    for key in ["email", "scholar", "github", "linkedin", "cv"]:
        val = links.get(key)
        if not val:
            continue
        href = f"mailto:{val}" if key == "email" else val
        out.append(
            f'<a class="ilink" href="{e(href)}"><svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[key]}</svg>{LABELS[key]}</a>'
        )
    return "\n".join(out)


def render_software(items):
    out = []
    for i, sw in enumerate(items):
        links = " · ".join(f'<a href="{e(u)}">{e(k)}</a>' for k, u in sw.get("links", {}).items())
        lang = f'<span class="slang">{e(sw["language"])}</span>' if sw.get("language") else ""
        out.append(f"""
      <li class="sw">
        <p class="sname">{e(sw["name"])}{lang}</p>
        <p class="sdesc">{e(sw.get("description", ""))}</p>
        <p class="slinks">{links}</p>
      </li>""")
    return "".join(out)


MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()


def render_talk(t, upcoming=False, year=""):
    parts = t.get("date", "").split("-")
    when = ""
    if len(parts) >= 2:
        when = MONTHS[int(parts[1]) - 1]
        if len(parts) == 3:
            when = f"{int(parts[2])} {when}"
    title = e(t.get("title", ""))
    if t.get("url"):
        title = f'<a href="{e(t["url"])}">{title}</a>'
    meta = " · ".join(e(x) for x in (t.get("event"), t.get("place")) if x)
    tags = ('<span class="tsoon">Upcoming</span>' if upcoming else "") + (
        f'<span class="trole">{e(t["role"])}</span>' if t.get("role") else "")
    cls = "talk year-start" if year else "talk"
    return f"""
      <li class="{cls}">
        <p class="tdate"><span class="y">{e(year)}</span>{when}</p>
        <div><p class="ttitle">{title}{tags}</p><p class="tmeta">{meta}</p></div>
      </li>"""


def render_talks(talks, keep=8):
    """Upcoming talks first (soonest at top), then past talks newest first, grouped by year.
    Dates may be YYYY, YYYY-MM or YYYY-MM-DD; a year-only date counts as past once that year starts."""
    if not talks:
        return ""
    today = date.today().isoformat()
    key = lambda t: t.get("date", "")
    up = sorted((t for t in talks if key(t) >= today), key=key)
    past = sorted((t for t in talks if key(t) < today), key=key, reverse=True)

    def rows(items, upcoming=False, last=None):
        html = []
        for t in items:
            y = key(t)[:4]
            html.append(render_talk(t, upcoming, y if y != last else ""))
            last = y
        return "".join(html), last

    head, last = rows(up, True)
    shown, last = rows(past[:keep], last=last)
    out = ['<section class="block" id="talks">\n        <h2>Talks</h2>', f'<ol class="talks">{head}{shown}</ol>']
    if len(past) > keep:
        rest, _ = rows(past[keep:], last=last)
        out.append(f'<details class="more-talks"><summary>All past talks ({len(past)})</summary><ol class="talks">{rest}</ol></details>')
    out.append("</section>")
    return "\n".join(out)


def top_venues(profile, published):
    if profile.get("top_venues"):
        return profile["top_venues"]
    counts = Counter(venue_of(p) for p in published if venue_of(p))
    return [v for v, _ in counts.most_common(profile.get("top_venues_count", 6))]


def build():
    profile = json.loads((ROOT / "content/profile.json").read_text(encoding="utf-8"))
    topics = load_topics()
    published = load_papers("published")
    working = load_papers("working")
    self_name = profile.get("self_name", "")
    venues = top_venues(profile, published)
    sw_file = ROOT / "content/software.json"
    software = json.loads(sw_file.read_text(encoding="utf-8")) if sw_file.exists() else []
    talks_file = ROOT / "content/talks.json"
    talks = json.loads(talks_file.read_text(encoding="utf-8")) if talks_file.exists() else []

    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "papers").mkdir(parents=True)
    shutil.copytree(ROOT / "assets", OUT / "assets")
    for p in published + working:
        for src in (p.get("_pdf_src"), p.get("_rep_src")):
            if src:
                shutil.copy2(src, OUT / "papers" / src.name)

    photo = profile.get("photo", "")
    if photo and (ROOT / photo).exists():
        photo_html = f'<img class="portrait" src="{e(photo)}" alt="Portrait of {e(profile["name"])}">'
    else:
        initials = "".join(w[0] for w in profile["name"].split()[:2])
        photo_html = f'<div class="portrait placeholder" aria-hidden="true">{e(initials)}</div>'

    ctx = {
        "name": e(profile["name"]),
        "title": e(profile.get("title", "")),
        "tagline": e(profile.get("tagline", "")),
        "photo": photo_html,
        "bio": "\n".join(f"<p>{e(p)}</p>" for p in profile.get("bio", [])),
        "focus": "\n".join(
            f'<li>{e(f)}</li>'
            for i, f in enumerate(profile.get("focus", []))
        ),
        "affiliations": "\n".join(
            f'<div><dt>{e(a.get("role"))}</dt><dd>'
            + (f'<a href="{e(a["url"])}">{e(a.get("org"))}</a>' if a.get("url") else e(a.get("org")))
            + "</dd></div>"
            for a in profile.get("affiliations", [])
        ),
        "links": render_links(profile.get("links", {})),
        "venues": "\n".join(
            f'<li>{e(v)}</li>'
            for i, v in enumerate(venues)
        ),
        "n_venues": str(len({venue_of(p) for p in published if venue_of(p)})),
        "brand_line": e(profile.get("brand_line", "")),
        "affiliation_short": e(profile.get("affiliation_short") or (profile.get("affiliations") or [{}])[0].get("org", "")),
        "published": "".join(render_paper(p, self_name) for p in published),
        "working": "".join(render_paper(p, self_name) for p in working),
        "software": render_software(software),
        "talks": render_talks(talks),
        "talks_nav": '<a href="#talks">Talks</a>' if talks else "",
        "topic_css": topic_css(),
        "venue_line": " <i>·</i> ".join("<em>%s</em>" % e(v) for v in venues),
        "topic_filters": "".join(
            pill(t["key"], "button", f' type="button" aria-pressed="false"')
            .replace("</button>", f'<span class="n">{sum(t["key"] in paper_topics(p) for p in published)}</span></button>')
            for t in topics
        ),
        "topic_links": "".join("<li>" + pill(t["key"], "button", ' type="button" data-jump') + "</li>" for t in topics),
        "n_published": str(len(published)),
        "n_working": str(len(working)),
        "site_url": e(profile.get("site_url", "").rstrip("/")),
        "description": e(profile.get("tagline", "")),
        "updated": date.today().strftime("%B %Y"),
    }
    page = (ROOT / "templates/index.html").read_text(encoding="utf-8")
    for k, v in ctx.items():
        page = page.replace("{{ " + k + " }}", v)
    (OUT / "index.html").write_text(page, encoding="utf-8")
    nf = ROOT / "templates/404.html"
    if nf.exists():
        page = nf.read_text(encoding="utf-8")
        for k, v in ctx.items():
            page = page.replace("{{ " + k + " }}", v)
        (OUT / "404.html").write_text(page, encoding="utf-8")
    (OUT / ".nojekyll").write_text("")
    print(f"Built _site/ with {len(published)} published and {len(working)} working papers.")


if __name__ == "__main__":
    build()
