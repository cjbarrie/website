% CV class matched to cjbarrie.com: Inter for text, Newsreader for the name,
% section titles and journal names, warm greys, hairlines, one saffron accent.
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{resume}[2026/11/11 CV class matching cjbarrie.com]
\LoadClass[10pt]{article}

\RequirePackage[a4paper,left=0.95in,right=0.95in,top=0.8in,bottom=0.8in,nohead]{geometry}
\RequirePackage{fontspec}
\RequirePackage{xcolor}
\RequirePackage{titlesec}
\RequirePackage{enumitem}
\RequirePackage{tikz}
\usetikzlibrary{svg.path}
\RequirePackage{calc}
\RequirePackage{fancyhdr}
\RequirePackage{needspace}
\AddToHook{cmd/section/before}{\needspace{6\baselineskip}}
\RequirePackage{microtype}
\RequirePackage[hidelinks]{hyperref}
\RequirePackage{url}

% Colours: the tokens at the top of assets/style.css
\definecolor{ink}{HTML}{141413}
\definecolor{ink2}{HTML}{5E5D59}
\definecolor{ink3}{HTML}{75736C}
\definecolor{line}{HTML}{DDDBD3}
\definecolor{accent}{HTML}{C9822B}
\definecolor{accentink}{HTML}{9A5F17}
\definecolor{markred}{HTML}{B4573F}
\definecolor{markblue}{HTML}{356A9A}

% Type: two weights only (400 and 500), as on the site
\setmainfont{Inter}[Path=fonts/, Extension=.otf, UprightFont=*-Regular, ItalicFont=*-Italic,
  BoldFont=*-Medium, BoldItalicFont=*-MediumItalic, Scale=0.9]
\newfontfamily\serif{Newsreader}[Path=fonts/, Extension=.ttf, UprightFont=*-Regular, ItalicFont=*-Italic,
  BoldFont=*-Bold, BoldItalicFont=*-BoldItalic]
\renewcommand{\texttt}[1]{\textbf{#1}}

\setlength{\parindent}{0pt}
\linespread{1.18}
\color{ink}
\raggedbottom
\raggedright
\hyphenpenalty=10000 \exhyphenpenalty=10000
\pagestyle{fancy}\fancyhf{}\renewcommand{\headrulewidth}{0pt}
\fancyfoot[L]{\textcolor{ink3}{\footnotesize Christopher Barrie \textperiodcentered{} Curriculum Vitae}}
\fancyfoot[R]{\textcolor{ink3}{\footnotesize\thepage}}

% Links: quiet, in metadata grey
\urlstyle{same}
\renewcommand{\UrlFont}{\color{ink3}\footnotesize}

% Sections: serif title over a hairline
\titleformat{\section}{\serif\fontsize{14}{17}\selectfont\color{ink}\raggedright}{}{0em}{}
  [{\color{line}\titlerule[0.5pt]}]
\titlespacing*{\section}{0pt}{2.3ex}{1.2ex}
\titleformat{\subsection}{\normalsize\raggedright}{}{0em}{}
\titlespacing*{\subsection}{0pt}{1.1ex}{0.2ex}

% Lists: small grey square, like the site's grid of squares
\newcommand{\sq}{\raisebox{0.32ex}{\textcolor{line}{\rule{0.42em}{0.42em}}}}
\setlist{noitemsep}
\setlist[itemize]{label=\sq, topsep=0.2em, itemsep=0.45ex, leftmargin=1.25em, labelsep=0.6em}

\newcommand{\when}[1]{\textcolor{ink3}{\small\addfontfeatures{Numbers=Tabular}#1}}
\newcommand{\datedsubsection}[2]{\subsection[#1]{#1 \hfill \when{#2}}}
% A line with an optional date in a right-hand column, so wrapped text never runs under the date
\newlength{\datecol}\setlength{\datecol}{6em}
\newcommand{\datedline}[2]{{\par\noindent
  \ifx\relax#2\relax
    \begin{minipage}[t]{\linewidth}\raggedright\strut #1\strut\end{minipage}%
  \else
    \begin{minipage}[t]{\linewidth-\datecol}\raggedright\strut #1\strut\end{minipage}%
    \hfill\mbox{\when{#2}}%
  \fi\par}}
\newcommand{\doi}[1]{\href{https://doi.org/#1}{{\color{ink3}\footnotesize doi.org/\nolinkurl{#1}}}}
\newcommand{\with}[1]{\textcolor{ink2}{#1}}
\newcommand{\skill}[2]{{\par\makebox[7em][l]{\textcolor{ink3}{#1}}#2\par}}
\newcommand{\role}[1]{{\par\textcolor{ink2}{#1}\par}\vspace{0.6ex}}
\newcommand{\venue}[1]{{\serif\bfseries\itshape\fontsize{10.5}{12}\selectfont #1}}
\newcommand{\status}[1]{\textcolor{ink3}{#1}}
\newcommand{\sep}{\hspace{1.1em}}

% Line icons, the same drawings the website uses beside Email, GitHub and LinkedIn
\newcommand{\icon}[1]{\raisebox{-0.2ex}{\begin{tikzpicture}[scale=0.42,yscale=-1,line width=0.55pt,line cap=round,line join=round,draw=ink2]#1\end{tikzpicture}}\hspace{0.35em}}
\newcommand{\iconmail}{\icon{\draw svg {M3 6h18v12H3z}; \draw svg {m3 7 9 6 9-6};}}
\newcommand{\iconweb}{\icon{\draw (12pt,12pt) circle[radius=9pt]; \draw (3pt,12pt) -- (21pt,12pt); \draw (12pt,12pt) ellipse[x radius=3.8pt, y radius=9pt];}}
\newcommand{\icongithub}{\icon{\draw svg {M9 19c-4 1.5-4-2-6-2.5m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21};}}
\newcommand{\iconlinkedin}{\icon{\draw[rounded corners=0.8pt] (3pt,3pt) rectangle (21pt,21pt); \draw svg {M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7};}}
\newcommand{\iconscholar}{\icon{\draw svg {M12 4 2 10l10 6 10-6z}; \draw svg {M6 12.5V17c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5};}}
\newcommand{\iconpin}{\icon{\draw svg {M12 21c-4-5-6-8-6-11a6 6 0 0 1 12 0c0 3-2 6-6 11z}; \draw (12pt,10pt) circle[radius=2pt];}}

% The site's brand mark
\newcommand{\sitemark}{%
  \begin{tikzpicture}[x=0.55pt,y=-0.55pt,baseline=(current bounding box.south)]
    \foreach \x/\y in {2/2,12/2,2/12} \fill[markred,rounded corners=0.4pt] (\x,\y) rectangle ++(8,8);
    \foreach \x/\y in {12/12,22/12,12/22,22/22} \fill[markblue,rounded corners=0.4pt] (\x,\y) rectangle ++(8,8);
    \draw[accent,line width=0.8pt,rounded corners=0.4pt] (2.8,22.8) rectangle ++(6.4,6.4);
  \end{tikzpicture}}

% Header: \cvheader{name}{role line}{address}{contact line}
\newcommand{\cvheader}[4]{%
  {\serif\fontsize{27}{30}\selectfont #1\hfill\sitemark\par}
  \vspace{1.2ex}
  {\textcolor{ink2}{#2}\par}
  \vspace{0.4ex}
  {\small\textcolor{ink3}{\iconpin #3}\par}
  \vspace{0.9ex}
  {\small #4\par}
  \vspace{1ex}}
