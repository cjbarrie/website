---
name: add-paper
description: Add a new paper to the website from a PDF path, DOI, arXiv id, link or .bib, then publish it. Use when the user says "New paper: ...", gives a paper PDF, runs /add-paper, or asks to add a publication.
---

# Add a paper

The site is built by `build.py` from one `.bib` per paper, with its PDF beside it:
`papers/published/<slug>.bib` + `<slug>.pdf`, or `papers/working/<slug>.bib` + `<slug>.pdf`.
`build.py` renders the PDF's first page to `assets/thumbs/<slug>.jpg` (needs `pdftoppm`); commit that image with the paper.

The user usually sends one line, e.g. `New paper: ~/Downloads/polarization.pdf`. They may instead give a DOI, arXiv id, URL, `.bib`, or say they dropped files in `papers/inbox/`. Do everything below without further prompting, except the one question in step 6.

To change a paper that is already on the site (now published, new link, new PDF), use **update-paper** instead.

## Steps

1. **Find the file.** Use the path given (copy it into `papers/inbox/` first), or list `papers/inbox/` (ignore `README.md`, `.gitkeep`). With neither, ask for a PDF path or DOI.

2. **Get metadata.** Run `pdftotext -l 2 <file> -` and look for a DOI, arXiv id, title, authors, year and venue. If there's a DOI or arXiv id, get authoritative BibTeX with
   `python3 .claude/skills/add-paper/scripts/doi2bib.py <doi-or-arXiv:id>` and prefer it over scraped text. Never invent fields.

3. **Look for replication links in the PDF.**
   `pdftotext <file> - | tr '\n' ' ' | grep -oiE ".{0,120}(replication|data availability|dataverse|osf\.io|github\.com|zenodo).{0,80}"`
   Use only links the text describes as data, code or materials for *this* paper.

4. **Published or working?**
   - **Published**: journal, proceedings or book venue with a publisher DOI, or forthcoming/accepted.
   - **Working**: preprints (arXiv, SSRN, OSF, SocArXiv, `10.31235` or `10.48550` DOIs), manuscripts, under review, R&R.

5. **Check for duplicates.** `grep -ril "<distinctive title words>" papers/`. If a working paper has now been published, hand over to **update-paper** step "Now published". If it's an exact duplicate, say so and stop.

6. **Ask once, only for what you couldn't find**, in one short message:
   - Replication files or code? (a Dataverse, OSF or GitHub link, a folder path, or "none"). Skip if step 3 found one; say which you used.
   - Research areas, only if not obvious. Otherwise pick one or two keys from `content/topics.json` and say which.
   A local folder of replication files gets zipped to `papers/<status>/<slug>-replication.zip`; `build.py` links it automatically, so leave `replication` out of the `.bib`. Use a link instead for anything over ~50 MB.

7. **Write the entry.** Slug `<firstauthorlastname>-<year>-<firstsignificanttitleword>`, lowercase ASCII (e.g. `barrie-2024-prompt`). One entry whose key is the slug. Fields, where known:
   `title, topics, author ("Last, First and Last, First"), year, journal | booktitle, volume, number, pages, doi, url, note, preprint, replication, code, data`.
   - `topics = {key, key}` from `content/topics.json`; only add a new area if the user agrees.
   - The title links to `doi`, else `url`, else the PDF. For working papers set `url` to the preprint page and put the status in `note` (e.g. `Under review`).

8. **Place the PDF** at `papers/<status>/<slug>.pdf`. Over 6 MB, compress and keep the smaller file:
   `gs -q -dNOPAUSE -dBATCH -dSAFER -sDEVICE=pdfwrite -dCompatibilityLevel=1.6 -dPDFSETTINGS=/ebook -sOutputFile=<out> <in>`.
   Remove the copy from `papers/inbox/`.

9. **Publish** with the **publish-site** skill: it checks the build, and pushes once the user says go.

10. **Report** in two or three lines: what was added, under which heading, which links it has.
