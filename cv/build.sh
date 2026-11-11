#!/bin/sh
# Rebuild the CV and copy it to the website (assets/cv.pdf).
# Needs XeLaTeX with the ebgaramond and fontawesome packages (MacTeX or TeX Live full).
# The class also uses Fontin-SmallCaps.otf for headings; it is not in the repo (licence),
# so copy it into cv/fonts/ first (it is in ~/Downloads/resume/fonts/).
set -e
cd "$(dirname "$0")"
xelatex -interaction=nonstopmode main.tex >/dev/null
xelatex -interaction=nonstopmode main.tex | grep -E '^!|Output written'
cp main.pdf ../assets/cv.pdf
echo "Updated assets/cv.pdf. Commit and push to publish."
