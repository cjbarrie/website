---
name: update-profile
description: Change the website's non-paper content - bio, job title, affiliations, contact links, CV, photo, the "Published in" list, research areas, or software packages. Use when the user asks to edit anything on the site other than a paper.
---

# Update the profile

Everything except papers is plain files:

| What | Where |
|---|---|
| Name, title, bio, affiliations, tagline | `content/profile.json` (`title`, `affiliation_short`, `bio` paragraphs, `affiliations`, `tagline`) |
| Email, Scholar, GitHub, LinkedIn, CV | `content/profile.json` → `links` (an empty value hides the link) |
| "Published in" journals | `content/profile.json` → `top_venues` (keep about 7 so it fits two lines) |
| Photo | `assets/photo.jpg` (square-ish, at least 400px; JPEG under 200 KB) |
| Research areas (filter pills, colours) | `content/topics.json` |
| Software packages | `content/software.json` (`name`, `language`, `description`, `links`) |
| Site address for link previews | `content/profile.json` → `site_url` |

## Notes

- **CV**: save the PDF as `assets/cv.pdf` and set `links.cv` to `assets/cv.pdf`. Compress if over 2 MB.
- **Photo**: resize with `sips -Z 800 photo.jpg` (Mac) or Python Pillow before saving; keep the old one until the new one is checked.
- **New research area**: add `key`, `label`, `short`, `color` and `color_dark` to `content/topics.json`, picking muted colours that match the others. Then tag the relevant papers (see **update-paper**).
- Keep the bio in the user's own words; only edit wording they asked to change.
- Layout and colours live in `templates/index.html` and `assets/style.css`; the rules are in `DESIGN.md`. Don't change them unless asked.

## Finish

Publish with the **publish-site** skill, then tell the user in one line what changed.
