---
name: update-paper
description: Change a paper that is already on the website - it's now published, add or fix a replication/code/preprint link, swap the PDF, change research areas, fix a title or authors, or remove it. Use when the user names an existing paper and asks to change it.
---

# Update a paper

Papers live in `papers/published/` and `papers/working/` as `<slug>.bib` with `<slug>.pdf` (and optionally `<slug>-replication.zip`) beside it. New papers go through **add-paper** instead.

## Find the entry

`grep -ril "<distinctive title words>" papers/ --include=*.bib`. If several match, list their titles and ask which one. Show the user nothing else until the change is made.

## Common changes

- **Now published** (a working paper came out):
  1. Get the published BibTeX: `python3 .claude/skills/add-paper/scripts/doi2bib.py <doi>`.
  2. Write `papers/published/<new-slug>.bib` with the new year and venue. Carry over `topics`, `replication`, `code`, `data`, and set `preprint` to the old preprint link (the old `url`).
  3. Move the PDF (prefer the published or accepted version if the user sends one) and any replication zip to the new slug, then delete the old working `.bib`.
- **Add or fix a link**: set `replication` (data and code package), `code` (a software repo), `data`, or `preprint`. The site orders them PDF › Replication › Code › Data › Preprint.
- **Swap the PDF**: replace `<slug>.pdf`; compress if over 6 MB (see add-paper step 8).
- **Research areas**: edit `topics = {key, key}` using keys from `content/topics.json`.
- **Title, authors, year, venue**: edit the field. Authors are `Last, First and Last, First`; the site bolds the user's name automatically.
- **Remove**: delete the `.bib`, its PDF and any replication zip. Confirm with the user first, naming the paper.

## Finish

Publish with the **publish-site** skill, then tell the user in one line what changed.
