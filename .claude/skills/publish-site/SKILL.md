---
name: publish-site
description: Check the website builds cleanly and push it live to cjbarrie.com. Use after any change to papers or content, or when the user says publish, deploy, push, or "is the site ok?".
---

# Check and publish the site

The site deploys from the `main` branch of `github.com/cjbarrie/website`: every push runs `.github/workflows/deploy.yml`, which builds `_site/` and publishes it to GitHub Pages at https://cjbarrie.com. `_site/` is not committed.

## Steps

1. **Check.** Run `python3 .claude/skills/publish-site/scripts/check_site.py`.
   - It builds the site, then reports errors (missing title/year/authors, unknown research areas, duplicate titles, links to files that don't exist) and warnings (no PDF, PDF over 15 MB, no research areas).
   - Fix every error before going on. Mention warnings to the user only if they're new.
   - Add `--links` for a periodic full check of every outside link (slow; LinkedIn, SSRN and similar block robots and are skipped).

2. **Look at it** if the change was visual: `python3 -m http.server -d _site 8000` and open http://localhost:8000.

3. **Show what will go out**: `git status --short` and a one-line summary per file.

4. **Push, once the user says go** (or already said "publish"/"push"):
   `git add -A && git commit -m "<short description>" && git push`
   Commit messages are short and plain, e.g. `Add Information diets paper`, `Update bio`.

5. **Confirm the deploy.** The Actions run takes about a minute: `gh run list -L 1` or https://github.com/cjbarrie/website/actions. If it fails, open the log, fix the cause and push again. Then tell the user it's live.

## If something's off after deploying

- Old version still showing: the browser cache; reload with Cmd-Shift-R or use a private window.
- Domain errors: check Settings → Pages shows "DNS check successful" for `cjbarrie.com`. DNS is at Squarespace: four A records on `@` (185.199.108–111.153) and `www` CNAME `cjbarrie.github.io`.
