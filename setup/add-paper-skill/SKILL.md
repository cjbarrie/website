---
name: add-paper
description: Add a new article to the website from a PDF path, DOI or BibTeX, ask about replication files, and rebuild. Use when the user says "new paper", gives a path to a paper PDF, runs /add-paper, or asks to update their publications.
---

# Add a paper to the website

The site is built by `build.py` from one `.bib` file per paper, with the PDF sitting next to it:

- `papers/published/<slug>.bib` + `<slug>.pdf`
- `papers/working/<slug>.bib` + `<slug>.pdf`

The user's routine is one message, for example:

> New paper: ~/Downloads/polarization.pdf

They may also give a DOI, an arXiv id, a URL, a `.bib`, or say they dropped files into `papers/inbox/`. Do everything below without further prompting, except the two questions in step 6.

## Steps

1. **Find the file.** Use the path the user gave (copy it into `papers/inbox/` first), or list `papers/inbox/` (ignore `README.md` and `.gitkeep`). If you have neither, ask for the PDF path or a DOI.

2. **Get metadata.**
   - Run `pdftotext -l 2 <file> -` and look for a DOI, arXiv id, title, authors, year and venue.
   - If you find a DOI or arXiv id, get authoritative BibTeX with
     `python3 .claude/skills/add-paper/scripts/doi2bib.py <doi-or-arXiv:id>` and prefer it over scraped text.
   - Never invent fields. Leave out anything you can't confirm.

3. **Find replication links in the PDF itself.** Search the full text for a data-availability statement or replication link:
   `pdftotext <file> - | tr '\n' ' ' | grep -oiE ".{0,120}(replication|data availability|dataverse|osf\.io|github\.com|zenodo).{0,80}"`
   Only use links the text describes as replication data, code or materials for *this* paper, not cited datasets or tools.

4. **Decide published vs working.**
   - **Published**: a journal, proceedings or book venue with a publisher DOI, or marked forthcoming or accepted.
   - **Working**: preprints (arXiv, SSRN, OSF, SocArXiv, `10.31235` or `10.48550` DOIs), manuscripts, under review, R&R.

5. **Check for duplicates.** `grep -ril "<distinctive title words>" papers/`.
   - If a **working paper has now been published**, delete the working entry so the paper appears once under Publications. Keep its `preprint`, `replication` and `code` links on the new entry.
   - If it's an exact duplicate, say so and stop.

6. **Ask the user, in one short message, only what you couldn't find:**
   - "Are there replication files or code? Send a link (Dataverse, OSF, GitHub) or a folder path, or say none." Skip this if step 3 found a replication link; just say which one you used.
   - "Which research areas?" only if the topics aren't obvious. Otherwise pick one or two from `content/topics.json` and say which.
   If the user gives a local folder of replication files rather than a link, zip it to `papers/<status>/<slug>-replication.zip`. `build.py` links and publishes it automatically, so leave `replication` out of the `.bib`. A Dataverse, OSF or GitHub link is better for anything over about 50 MB.

7. **Write the entry.** Slug: `<firstauthorlastname>-<year>-<firstsignificanttitleword>`, lowercase ASCII, e.g. `barrie-2024-prompt`. Write `papers/<status>/<slug>.bib` with one entry whose key is the slug. Fields, where known:
   `title, topics, author ("Last, First and Last, First"), year, journal | booktitle, volume, number, pages, doi, url, note, preprint, replication, code, data`.
   - `topics = {key, key}` with one or two areas from `content/topics.json`. Only add a new area if the user agrees.
   - `replication` is the paper's replication package (Dataverse, OSF or GitHub). `code` is a software package. Both show as links on the site.
   - For working papers, put the status in `note`, e.g. `Under review`.

8. **Place the PDF** at `papers/<status>/<slug>.pdf`. If it's over 6 MB, compress it first and keep the smaller file:
   `gs -q -dNOPAUSE -dBATCH -dSAFER -sDEVICE=pdfwrite -dCompatibilityLevel=1.6 -dPDFSETTINGS=/ebook -sOutputFile=<out> <in>`.
   If the paper is a paywalled published article and the user has an accepted-manuscript version, prefer that.

9. **Rebuild and check.** Run `python3 build.py`, confirm the counts it prints, and check `_site/index.html` shows the new title with its PDF and Replication links.

10. **Report.** In two or three lines: what was added, where it's listed, which links it has. If the folder is a git repo, offer to commit and push (`git add papers && git commit -m "Add <short title>" && git push`); GitHub Actions deploys on push. Don't push without the user's go-ahead.

## Notes

- `content/profile.json` holds the bio, affiliations, links and `top_venues`.
- Author names containing `self_name` from the profile are highlighted automatically.
- Software (R/Python packages) goes in `content/software.json`, not `papers/`.
