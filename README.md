# Personal website

A small static site built from plain files, deployed to GitHub Pages.

## Updating the site

Open Claude Code in this folder (or ask Claude in the website project) and say what you want.
Four skills in `.claude/skills/` do the work; each ends by checking the build and pushing once you say go.

| Skill | Say something like | What it does |
|---|---|---|
| **add-paper** | `New paper: ~/Downloads/paper.pdf` (or a DOI / arXiv link) | Files it as published or working, pulls the metadata, finds replication links, compresses big PDFs |
| **update-paper** | `"Information diets" is now published in Sociological Science, doi 10.15195/v13.a33` | Changes an existing paper: now published, new link, new PDF, research areas, typo, remove |
| **update-profile** | `Add my CV: ~/Downloads/cv.pdf` · `Change my title to Associate Professor` | Bio, title, affiliations, links, CV, photo, "Published in" list, software, research areas |
| **publish-site** | `Publish` · `Is the site ok?` | Builds, checks for missing fields, broken file links and oversized PDFs, then pushes and confirms the deploy |

Pushing to `main` deploys to https://cjbarrie.com in about a minute.

You can also edit by hand: write `papers/published/<slug>.bib` (with `<slug>.pdf` beside it),
run `python3 build.py`, and push. A `<slug>-replication.zip` next to the `.bib` is linked automatically.

## Editing the rest

- Bio, focus areas, affiliations, links: `content/profile.json`
- Photo: `assets/photo.jpg`
- Look and feel: `assets/style.css` (colours and fonts are tokens at the top)
- Page structure: `templates/index.html`

## Preview locally

    python3 build.py
    python3 -m http.server -d _site 8000

Then open http://localhost:8000.

## Deploying

The repo is `github.com/cjbarrie/website`. Every push to `main` runs
`.github/workflows/deploy.yml`, which builds `_site/` and publishes it with GitHub Pages
(Settings → Pages, source: GitHub Actions) at the custom domain `cjbarrie.com`.
DNS is at Squarespace: four A records on `@` (185.199.108.153, .109.153, .110.153, .111.153)
and a `www` CNAME to `cjbarrie.github.io`.
