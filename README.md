# Personal website

A small static site built from plain files, deployed to GitHub Pages.

## One-time setup

Run `sh setup/install.sh` once. It copies the `/add-paper` Claude Code skill into
`.claude/skills/` and the deploy workflow into `.github/workflows/`.

## Adding a paper

1. Drop the PDF (or a `.bib`) into `papers/inbox/`.
2. In this folder, run Claude Code and type `/add-paper`.

Claude pulls the metadata (via the DOI when there is one), files it under
`papers/published/` or `papers/working/`, moves a working paper to published
when it comes out, and rebuilds the site. Push to `main` and it goes live.

You can also add an entry by hand: write `papers/published/<slug>.bib` and
run `python3 build.py`.

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

Create a GitHub repo (e.g. `cjbarrie.github.io`), push this folder to `main`,
and in the repo's Settings → Pages choose **GitHub Actions** as the source.
The workflow in `.github/workflows/deploy.yml` builds and publishes on every push.
To keep a custom domain, add it under Settings → Pages.
