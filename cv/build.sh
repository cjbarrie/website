#!/bin/sh
# Rebuild the CV and copy it to the website (assets/cv.pdf).
# Needs XeLaTeX (MacTeX or TeX Live). The fonts are in cv/fonts/.
set -e
cd "$(dirname "$0")"
xelatex -interaction=nonstopmode main.tex >/dev/null
xelatex -interaction=nonstopmode main.tex | grep -E '^!|Output written'
cp main.pdf ../assets/cv.pdf
echo "Updated assets/cv.pdf. Commit and push to publish."
