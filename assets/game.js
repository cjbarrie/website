// Easter egg: keep scrolling past the bottom of the page (or open #play) and a
// playable Schelling model opens full screen over the blurred page.
//
// The model runs in rounds. In each round every discontented square gets a
// chance to move (MOVE_P). One that does looks at a few random empty cells
// (SEARCH) and takes the nearest it would accept; if none suits, it stays put.
// Separately, a small share of all squares move to a random empty cell for
// reasons of their own (TURNOVER), so the board never freezes. All of a
// round's moves are drawn as one glide. The run stops when alike neighbours
// level off, or after MAX_ROUNDS.
(() => {
  const sec = document.getElementById("play");
  const hint = document.querySelector(".overscroll");
  if (!sec) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- Reveal: insist on scrolling past the end --------------------------------
  const NEED = 1400;
  const dots = hint ? [...hint.children] : [];
  let push = 0, idle;
  const atBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
  const showHint = () => {
    if (!hint) return;
    const k = push / NEED;
    hint.style.opacity = push > 0 ? Math.min(1, 0.35 + k) : 0;
    dots.forEach((d, i) => d.classList.toggle("on", k * dots.length > i + 0.2));
  };
  function nudge(d) {
    if (!sec.hidden || d <= 0) return;
    if (!atBottom()) { push = 0; showHint(); return; }
    push = Math.min(NEED, push + d);
    showHint();
    clearTimeout(idle);
    idle = setTimeout(() => { push = 0; showHint(); }, 900);
    if (push >= NEED) reveal();
  }
  window.addEventListener("wheel", (ev) => nudge(ev.deltaY * (ev.deltaMode ? 16 : 1)), { passive: true });
  let ty = null;
  window.addEventListener("touchstart", (ev) => { ty = ev.touches[0].clientY; }, { passive: true });
  window.addEventListener("touchmove", (ev) => {
    if (ty == null) return;
    const y = ev.touches[0].clientY;
    nudge((ty - y) * 2.5);
    ty = y;
  }, { passive: true });
  window.addEventListener("keydown", (ev) => {
    if (["ArrowDown", "PageDown", "End", " "].includes(ev.key) && !/input|textarea/i.test(ev.target.tagName)) nudge(180);
  });

  // The game opens as a full-screen overlay; the page behind it is blurred.
  // It lives directly under <body> so nothing on the page can clip or blur it.
  const root = document.documentElement;
  const closeBtn = sec.querySelector('[data-act="close"]');
  let opener = null;
  document.body.appendChild(sec);

  function reveal() {
    if (!sec.hidden) return;
    opener = document.activeElement;
    sec.hidden = false;
    sec.scrollTop = 0;
    // Hold the overlay still briefly so the scroll that opened it doesn't carry on inside it.
    settle(700);
    root.classList.add("game-open");
    sec.classList.remove("enter"); void sec.offsetWidth; sec.classList.add("enter");
    if (hint) { push = NEED; showHint(); setTimeout(() => { push = 0; showHint(); }, 500); }
    init();
    requestAnimationFrame(() => { drawChart(); if (closeBtn) closeBtn.focus({ preventScroll: true }); });
  }

  function close() {
    if (sec.hidden) return;
    pause();
    sec.hidden = true;
    root.classList.remove("game-open");
    if (location.hash === "#play") window.history.replaceState(null, "", location.pathname + location.search);
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }
  // The scroll gesture that opened the game keeps firing (trackpad momentum);
  // swallow it until it has stopped for a moment.
  let settleT;
  function settle(ms) {
    sec.classList.add("settling");
    clearTimeout(settleT);
    settleT = setTimeout(() => sec.classList.remove("settling"), ms);
  }
  sec.addEventListener("wheel", (ev) => {
    if (!sec.classList.contains("settling")) return;
    ev.preventDefault();
    settle(350);
  }, { passive: false });
  if (closeBtn) closeBtn.addEventListener("click", close);
  // Clicking the blurred page around the cabinet closes it too.
  sec.addEventListener("click", (ev) => { if (ev.target === sec) close(); });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !sec.hidden) { ev.preventDefault(); close(); }
  });
  window.addEventListener("hashchange", () => { if (location.hash === "#play") reveal(); });

  // --- Variants ----------------------------------------------------------------
  // groups: population shares. R: neighbourhood radius. cap: the largest alike
  // share a square will accept (1 = no upper limit).
  const MODES = {
    classic: { groups: [0.5, 0.5], R: 1, cap: 1,
      note: "Schelling’s original: two equal groups. Each square wants at least the share of alike neighbours you set." },
    six: { groups: [1, 1, 1, 1, 1, 1].map((x) => x / 6), R: 1, cap: 1,
      note: "Six equal groups, one colour per research area. Random mixing now gives only about 17% alike neighbours." },
    mixing: { groups: [0.5, 0.5], R: 1, cap: 0.75,
      note: "Squares also leave when more than 75% of their neighbours are alike. They want some company, but not too much." },
    minority: { groups: [0.75, 0.25], R: 1, cap: 1,
      note: "Three red squares for every blue one, with the same preferences for both. Compare how each group ends up." },
    wide: { groups: [0.5, 0.5], R: 2, cap: 1,
      note: "Each square judges the 24 cells within two steps of it, not just the 8 next to it." },
  };
  const MAX_ROUNDS = 150, MOVE_P = 0.3, SEARCH = 6, TURNOVER = 0.01;
  const PLATEAU = 20;                       // rounds with no real change before stopping

  // --- Elements ------------------------------------------------------------------
  const $ = (q) => sec.querySelector(q);
  const canvas = $(".game-board"), ctx = canvas.getContext("2d");
  const chart = $(".game-chart"), cctx = chart.getContext("2d");
  const out = {
    round: $('[data-stat="round"]'), content: $('[data-stat="content"]'),
    alike: $('[data-stat="alike"]'), base: $('[data-stat="base"]'),
    groups: $(".game-groups"), result: $(".game-result"), note: $(".game-note"),
    tolVal: $('[data-out="tol"]'), vacVal: $('[data-out="vac"]'),
    banner: $(".arc-banner"), bTitle: $(".arc-banner b"), bSub: $(".arc-banner span"),
  };
  const cabinet = $(".arcade");
  const tol = $('[data-in="tol"]'), vac = $('[data-in="vac"]');
  const modeButtons = [...sec.querySelectorAll("[data-mode]")];
  const playBtn = $('[data-act="play"]'), stepBtn = $('[data-act="step"]');
  const resetBtn = $('[data-act="reset"]'), newBtn = $('[data-act="new"]');

  // --- State ---------------------------------------------------------------------
  let modeKey = "classic", mode = MODES.classic;
  let T = 0.35, VAC = 0.12;
  let cols, rows, CELL, SQ, W, H, DPR = 1, NB = [];
  let grid, agents, start, content = [], history = [], round = 0;
  let playing = false, timer = null, status = "ready";
  let sel = -1, hover = -1, drag = false, cursor = 0;
  let PAL = [], TWO = [], INK = [20, 20, 19], INK3 = [117, 115, 108], ACC = [201, 130, 43];
  const colour = (g) => (mode.groups.length === 2 ? TWO[g] : PAL[g]);
  const GLIDE = reduce ? 0 : 360, FADE = reduce ? 0 : 300, ROUND_MS = reduce ? 160 : 320;

  const parseColor = (s) => {
    s = (s || "").trim();
    if (s.startsWith("#")) return s.slice(1).match(/\w\w/g).map((h) => parseInt(h, 16));
    const m = s.match(/[\d.]+/g);
    return m ? m.slice(0, 3).map(Number) : null;
  };
  // The cabinet is always a dark screen, so it reads the bright (dark-theme)
  // area colours: build.py scopes them to .arcade, and swatches sit inside it.
  function readTokens() {
    const cs = getComputedStyle(cabinet);
    INK = parseColor(cs.getPropertyValue("--arc-ink")) || [240, 239, 234];
    INK3 = parseColor(cs.getPropertyValue("--arc-ink-2")) || INK3;
    ACC = parseColor(cs.getPropertyValue("--arc-accent")) || ACC;
    const keys = [...document.querySelectorAll(".topic-bar .pill[data-topic]")].map((b) => b.dataset.topic);
    const of = (k) => {
      const sw = document.createElement("i");
      sw.className = "t-" + k; sw.hidden = true; cabinet.appendChild(sw);
      const c = parseColor(getComputedStyle(sw).getPropertyValue("--tc"));
      sw.remove();
      return c;
    };
    PAL = keys.map(of).filter(Boolean);
    const fallback = [[227, 145, 123], [212, 148, 182], [169, 154, 224], [127, 176, 224], [227, 174, 92], [130, 192, 157]];
    while (PAL.length < 6) PAL.push(fallback[PAL.length]);
    TWO = [keys.includes("protest") ? of("protest") : PAL[0], keys.includes("media") ? of("media") : PAL[3]];
  }

  // Marquee messages over the screen: PRESS PLAY, PAUSED, LEVELLED OFF...
  function banner(title, sub = "") {
    if (!title) { out.banner.hidden = true; return; }
    out.bTitle.textContent = title;
    out.bSub.textContent = sub;
    out.banner.hidden = false;
    out.banner.classList.remove("pop"); void out.banner.offsetWidth; out.banner.classList.add("pop");
  }

  // --- Model -----------------------------------------------------------------------
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function buildNbrs() {
    NB = [];
    const R = mode.R;
    for (let c = 0; c < cols * rows; c++) {
      const x = c % cols, y = (c / cols) | 0, r = [];
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) r.push(ny * cols + nx);
      }
      NB.push(r);
    }
  }
  // Alike share for a square of group g standing at cell c (ignoring square
  // `self`), or -1 if it would have no neighbours.
  function shareAt(g, c, self) {
    let same = 0, occ = 0;
    for (const n of NB[c]) {
      const j = grid[n];
      if (j < 0 || j === self) continue;
      occ++;
      if (agents[j].g === g) same++;
    }
    return occ ? same / occ : -1;
  }
  const accepts = (s) => s < 0 || (s >= T - 1e-9 && s <= mode.cap + 1e-9);
  const isContent = (i) => accepts(shareAt(agents[i].g, agents[i].c, i));

  const empties = () => { const e = []; for (let c = 0; c < grid.length; c++) if (grid[c] < 0) e.push(c); return e; };
  // A mover only sees a handful of vacancies, and takes the nearest it accepts.
  function destination(i, empty) {
    const a = agents[i], ax = a.c % cols, ay = (a.c / cols) | 0;
    let best = -1, bestD = Infinity;
    for (let k = 0; k < SEARCH && empty.length; k++) {
      const c = empty[(Math.random() * empty.length) | 0];
      if (grid[c] >= 0 || !accepts(shareAt(a.g, c, i))) continue;
      const d = (c % cols - ax) ** 2 + (((c / cols) | 0) - ay) ** 2;
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function place(i, to, t, stagger) {
    const a = agents[i];
    a.from = a.c; a.t0 = t + stagger;
    grid[a.c] = -1; grid[to] = i; a.c = to;
  }

  // Recompute who is content, and fade each square towards its new state.
  function refresh(t, delay = 0) {
    agents.forEach((a, i) => {
      const now = isContent(i);
      if (now !== content[i]) { a.h0 = hAt(a, t); a.h1 = now ? 1 : 0; a.ht = t + delay; }
      content[i] = now;
    });
  }
  const easeIO = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const hAt = (a, t) => a.h0 + (a.h1 - a.h0) * (FADE ? easeIO(clamp01((t - a.ht) / FADE)) : 1);

  function measure() {
    let ok = 0, sum = 0, n = 0;
    const gs = mode.groups.map(() => ({ sum: 0, n: 0 }));
    agents.forEach((a, i) => {
      if (content[i]) ok++;
      const s = shareAt(a.g, a.c, i);
      if (s >= 0) { sum += s; n++; gs[a.g].sum += s; gs[a.g].n++; }
    });
    return { content: ok / agents.length, alike: n ? sum / n : 0, byGroup: gs.map((g) => (g.n ? g.sum / g.n : 0)), unhappy: agents.length - ok };
  }
  // Expected alike share if colours were shuffled at random: sum n_g(n_g-1) / N(N-1).
  function baseline() {
    const N = agents.length, counts = mode.groups.map(() => 0);
    agents.forEach((a) => counts[a.g]++);
    return counts.reduce((s, n) => s + n * (n - 1), 0) / (N * (N - 1));
  }

  function doRound() {
    const t = performance.now();
    const order = shuffle(agents.map((_, i) => i).filter((i) => !content[i] && Math.random() < MOVE_P));
    let empty = empties(), moved = 0;
    const go = (i, to) => {
      empty[empty.indexOf(to)] = agents[i].c;
      place(i, to, t, reduce ? 0 : Math.random() * 120);
      moved++;
    };
    for (const i of order) {
      if (isContent(i)) continue;              // a neighbour's move may have settled it
      const to = destination(i, empty);
      if (to >= 0) go(i, to);
    }
    // Turnover: a few squares move anyway, wherever there is room.
    const n = Math.round(agents.length * TURNOVER) || (Math.random() < agents.length * TURNOVER ? 1 : 0);
    for (let k = 0; k < n && empty.length; k++) go((Math.random() * agents.length) | 0, empty[(Math.random() * empty.length) | 0]);
    round++;
    refresh(t, GLIDE * 0.7);
    record();
    kick(GLIDE + FADE + 200);
    return moved;
  }

  // --- Board setup -----------------------------------------------------------------
  const availW = () => {
    const p = canvas.parentElement, cs = getComputedStyle(p);
    let w = p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    // On wide screens the board sits beside the controls; size it to fit the window's height too.
    if (window.innerWidth >= 1100) {
      const top = p.getBoundingClientRect().top - sec.getBoundingClientRect().top + sec.scrollTop + parseFloat(cs.paddingTop);
      const h = window.innerHeight - top - parseFloat(cs.paddingBottom) - 40;
      if (h > 240) w = Math.min(w, Math.floor(h * 40 / 24));
    }
    return w;
  };
  function layout() {
    const w = availW();
    cols = w < 480 ? 24 : w < 640 ? 32 : 40;
    rows = w < 480 ? 24 : w < 640 ? 22 : 24;
    CELL = Math.floor(w / cols);
    SQ = Math.max(5, Math.round(CELL * 0.62));
    W = CELL * cols; H = CELL * rows;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildNbrs();
  }

  function newBoard() {
    pause();
    layout();
    const n = cols * rows, filled = Math.round(n * (1 - VAC));
    const cells = shuffle([...Array(n).keys()]).slice(0, filled);
    // Exact group sizes from the shares, then shuffled onto the cells.
    const gs = [];
    mode.groups.forEach((p, g) => { for (let k = 0; k < Math.round(p * filled); k++) gs.push(g); });
    while (gs.length < filled) gs.push(0);
    gs.length = filled;
    shuffle(gs);
    start = cells.map((c, k) => ({ c, g: gs[k] }));
    reset();
  }

  function reset() {
    pause();
    grid = new Array(cols * rows).fill(-1);
    agents = start.map((s, i) => { grid[s.c] = i; return { c: s.c, g: s.g, from: s.c, t0: 0, h0: 0, h1: 0, ht: 0 }; });
    content = agents.map(() => null);
    refresh(-1e9);
    agents.forEach((a, i) => { a.h0 = a.h1 = content[i] ? 1 : 0; });
    round = 0; history = []; sel = -1; status = "ready";
    out.result.textContent = "";
    banner("Press play", "or tap a square to move it");
    record();
    kick(50);
  }

  // --- Readouts ----------------------------------------------------------------------
  const pct = (x) => Math.round(x * 100) + "%";
  function record() {
    const m = measure();
    history.push({ alike: m.alike, content: m.content });
    out.round.textContent = String(round).padStart(3, "0");
    out.content.textContent = pct(m.content);
    out.alike.textContent = pct(m.alike);
    out.base.textContent = pct(baseline());
    out.groups.textContent = mode.groups.length === 2
      ? `Red ${pct(m.byGroup[0])} · Blue ${pct(m.byGroup[1])}`
      : "";
    drawChart();
    return m;
  }

  function conclude(m) {
    const asked = mode.cap < 1 ? `between ${pct(T)} and ${pct(mode.cap)}` : `at least ${pct(T)}`;
    if (status === "settled" && round === 0) banner("Nobody moves", "raise the threshold");
    else if (status === "settled") banner("Levelled off", `${pct(m.alike)} alike · asked ${pct(T)}`);
    else banner(m.content < 0.9 ? "Gridlock" : "Time up", `${pct(m.alike)} alike · asked ${pct(T)}`);
    if (status === "settled" && round === 0) {
      out.result.textContent = "Everyone is content where they are, so nobody moves. Raise the threshold.";
    } else if (status === "settled") {
      out.result.textContent = `Levelled off after ${round} rounds. Each square asked for ${asked} alike neighbours; the average square now has ${pct(m.alike)}, against ${pct(baseline())} under random mixing. About ${pct(m.content)} are content at any moment, because some squares keep moving for other reasons.`;
    } else {
      // Only worth naming who is left out when a real share is discontented.
      let who = "";
      if (mode.groups.length === 2 && m.content < 0.9) {
        const left = [0, 0];
        agents.forEach((a, i) => { if (!content[i]) left[a.g]++; });
        who = ` ${pct(left[1] / (left[0] + left[1]))} of the discontented squares are blue.`;
      }
      out.result.textContent = m.content < 0.9
        ? `After ${MAX_ROUNDS} rounds only ${pct(m.content)} of squares are content, with ${pct(m.alike)} alike neighbours against ${pct(baseline())} under random mixing.${who} With preferences this demanding, many squares never find a place that suits them.`
        : `After ${MAX_ROUNDS} rounds the board is still slowly sorting: ${pct(m.alike)} alike neighbours against ${pct(baseline())} under random mixing, though each square asked for ${asked}. As squares come and go, alike patches keep growing.`;
    }
  }

  // Alike neighbours and share content, by round, with reference lines.
  function drawChart() {
    const w = chart.clientWidth, h = chart.clientHeight;
    if (!w || !h) return;
    if (chart.width !== Math.round(w * DPR) || chart.height !== Math.round(h * DPR)) { chart.width = Math.round(w * DPR); chart.height = Math.round(h * DPR); }
    cctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cctx.clearRect(0, 0, w, h);
    const padL = 38, padR = 6, padT = 6, padB = 16;
    const X = (k) => padL + (k / Math.max(40, history.length - 1)) * (w - padL - padR);
    const Y = (v) => padT + (1 - v) * (h - padT - padB);
    cctx.font = "8px Silkscreen, ui-monospace, monospace";
    cctx.textBaseline = "middle";
    cctx.fillStyle = `rgb(${INK3})`;
    cctx.strokeStyle = `rgba(${INK},0.07)`;
    cctx.lineWidth = 1;
    [0, 0.5, 1].forEach((v) => {
      cctx.beginPath(); cctx.moveTo(padL, Math.round(Y(v)) + 0.5); cctx.lineTo(w - padR, Math.round(Y(v)) + 0.5); cctx.stroke();
      cctx.textAlign = "right"; cctx.fillText(pct(v), padL - 6, Y(v));
    });
    cctx.textAlign = "left"; cctx.textBaseline = "alphabetic";
    cctx.fillText("ROUNDS →", padL, h - 3);
    const ref = (v, dash) => {
      cctx.setLineDash(dash); cctx.strokeStyle = `rgba(${INK},0.4)`;
      cctx.beginPath(); cctx.moveTo(padL, Math.round(Y(v)) + 0.5); cctx.lineTo(w - padR, Math.round(Y(v)) + 0.5); cctx.stroke();
      cctx.setLineDash([]);
    };
    ref(T, [4, 3]);
    if (mode.cap < 1) ref(mode.cap, [4, 3]);
    ref(baseline(), [1, 3]);
    const line = (key, rgb, wdt, glow) => {
      if (history.length < 1) return;
      cctx.strokeStyle = `rgb(${rgb})`; cctx.lineWidth = wdt; cctx.lineJoin = "round";
      cctx.shadowColor = `rgba(${rgb},0.8)`; cctx.shadowBlur = glow;
      cctx.beginPath();
      history.forEach((p, k) => (k ? cctx.lineTo(X(k), Y(p[key])) : cctx.moveTo(X(k), Y(p[key]))));
      cctx.stroke();
      const last = history[history.length - 1];
      cctx.fillStyle = `rgb(${rgb})`;
      cctx.fillRect(Math.round(X(history.length - 1)) - 2, Math.round(Y(last[key])) - 2, 4, 4);
      cctx.shadowBlur = 0;
    };
    line("content", INK3, 1.25, 0);
    line("alike", ACC, 2, 8);
  }

  // --- Running -------------------------------------------------------------------------
  function play() {
    if (status === "settled" || status === "stuck") reset();
    playing = true; sel = -1;
    banner(null);
    cabinet.classList.add("running");
    playBtn.textContent = "Pause"; playBtn.setAttribute("aria-pressed", "true");
    tick();
  }
  function pause() {
    if (playing && status === "running") banner("Paused", "press play to continue");
    playing = false; clearTimeout(timer);
    cabinet.classList.remove("running");
    playBtn.textContent = "Play"; playBtn.setAttribute("aria-pressed", "false");
  }
  function step() {
    const m0 = measure();
    if (!m0.unhappy && round === 0) { status = "settled"; pause(); conclude(m0); return false; }
    doRound();
    const m = measure();
    status = "running";
    // Level: alike neighbours has moved less than a point over the last PLATEAU rounds.
    const h = history, k = h.length - 1;
    if (round >= 30 && k >= PLATEAU) {
      const w = h.slice(k - PLATEAU).map((p) => p.alike);
      if (Math.max(...w) - Math.min(...w) < 0.01) { status = "settled"; pause(); conclude(m); return false; }
    }
    if (round >= MAX_ROUNDS) { status = "stuck"; pause(); conclude(m); return false; }
    return true;
  }
  function tick() {
    if (!playing) return;
    if (step()) timer = setTimeout(tick, ROUND_MS);
  }

  // --- Drawing (only while something is changing) ------------------------------------------
  let animUntil = 0, rafOn = false;
  function kick(ms) {
    animUntil = Math.max(animUntil, performance.now() + ms);
    if (!rafOn) { rafOn = true; requestAnimationFrame(frame); }
  }
  function frame(t) {
    draw(t);
    if (t < animUntil || sel >= 0) requestAnimationFrame(frame); else rafOn = false;
  }
  const ctr = (c) => [(c % cols) * CELL + CELL / 2, ((c / cols) | 0) * CELL + CELL / 2];

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    const half = SQ / 2;
    const picked = sel >= 0 ? agents[sel] : null;
    for (let c = 0; c < grid.length; c++) {
      if (grid[c] >= 0) continue;
      const [x, y] = ctr(c);
      if (picked && accepts(shareAt(picked.g, c, sel))) {
        ctx.fillStyle = `rgba(${colour(picked.g)},0.7)`;
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = `rgba(${INK},0.13)`;
        ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
      }
    }
    if (hover >= 0 && !playing) {
      const [x, y] = ctr(hover);
      ctx.fillStyle = `rgba(${INK},0.06)`;
      ctx.fillRect(x - CELL / 2 + 1, y - CELL / 2 + 1, CELL - 2, CELL - 2);
    }
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      const k = GLIDE ? easeIO(clamp01((t - a.t0) / GLIDE)) : 1;
      const [fx, fy] = ctr(a.from), [tx, ty] = ctr(a.c);
      const x = fx + (tx - fx) * k, y = fy + (ty - fy) * k;
      const h = hAt(a, t), rgb = colour(a.g);
      const px = Math.round(x - half), py = Math.round(y - half);
      ctx.fillStyle = `rgba(${rgb},${0.1 + 0.78 * h})`;
      ctx.fillRect(px, py, SQ, SQ);
      if (h < 0.98) {
        ctx.strokeStyle = `rgba(${rgb},${0.8 * (1 - h)})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, SQ - 1, SQ - 1);
      }
      if (i === sel) {
        const pulse = reduce ? 1 : 0.55 + 0.45 * Math.sin(t / 140);
        ctx.strokeStyle = `rgba(${ACC},${pulse})`;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px - 2.5, py - 2.5, SQ + 5, SQ + 5);
      }
    }
  }

  // --- Moving squares by hand ---------------------------------------------------------------
  const cellAt = (ev) => {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((ev.clientX - r.left) / CELL), y = Math.floor((ev.clientY - r.top) / CELL);
    return x >= 0 && y >= 0 && x < cols && y < rows ? y * cols + x : -1;
  };
  function handMove(to) {
    if (sel < 0 || to < 0 || grid[to] >= 0) return;
    banner(null);
    const t = performance.now();
    place(sel, to, t, 0);
    sel = -1;
    status = "running";
    out.result.textContent = "";
    refresh(t);
    record();
    kick(GLIDE + FADE + 100);
  }
  function pick(c) {
    if (c < 0) return;
    if (grid[c] >= 0) sel = grid[c] === sel ? -1 : grid[c];
    else handMove(c);
    kick(60);
  }
  canvas.addEventListener("pointerdown", (ev) => {
    if (playing) pause();
    const c = cellAt(ev);
    const wasEmpty = c >= 0 && grid[c] < 0;
    pick(c);
    drag = ev.pointerType === "mouse" && !wasEmpty && sel >= 0;
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (ev.pointerType !== "mouse") return;
    const c = cellAt(ev);
    if (c !== hover) { hover = c; kick(30); }
  });
  canvas.addEventListener("pointerleave", () => { hover = -1; kick(30); });
  window.addEventListener("pointerup", (ev) => {
    if (!drag) return;
    drag = false;
    const c = cellAt(ev);
    if (c >= 0 && grid[c] < 0) handMove(c);
  });
  canvas.addEventListener("keydown", (ev) => {
    const k = ev.key;
    const dx = k === "ArrowRight" ? 1 : k === "ArrowLeft" ? -1 : 0;
    const dy = k === "ArrowDown" ? 1 : k === "ArrowUp" ? -1 : 0;
    if (dx || dy) {
      ev.preventDefault(); ev.stopPropagation();
      const x = Math.min(cols - 1, Math.max(0, cursor % cols + dx)), y = Math.min(rows - 1, Math.max(0, ((cursor / cols) | 0) + dy));
      cursor = hover = y * cols + x; kick(30);
    } else if (k === "Enter" || k === " ") {
      ev.preventDefault(); ev.stopPropagation();
      if (playing) pause();
      pick(cursor);
    } else if (k === "Escape") { sel = -1; kick(30); }
  });

  // --- Controls ---------------------------------------------------------------------------
  const showTol = () => (out.tolVal.textContent = pct(T));
  const showVac = () => (out.vacVal.textContent = pct(VAC));
  // Changing a preference replays the same starting board, so runs compare.
  tol.addEventListener("input", () => { T = Number(tol.value) / 100; showTol(); reset(); });
  vac.addEventListener("input", () => { VAC = Number(vac.value) / 100; showVac(); });
  vac.addEventListener("change", newBoard);
  modeButtons.forEach((b) => b.addEventListener("click", () => {
    modeKey = b.dataset.mode; mode = MODES[modeKey];
    modeButtons.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    out.note.textContent = mode.note;
    newBoard();
  }));
  playBtn.addEventListener("click", () => (playing ? pause() : play()));
  stepBtn.addEventListener("click", () => { pause(); if (status === "settled" || status === "stuck") reset(); banner(null); step(); });
  resetBtn.addEventListener("click", reset);
  newBtn.addEventListener("click", newBoard);

  let inited = false;
  function init() {
    if (inited) return;
    inited = true;
    readTokens();
    T = Number(tol.value) / 100; VAC = Number(vac.value) / 100;
    showTol(); showVac();
    out.note.textContent = mode.note;
    newBoard();
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readTokens(); drawChart(); kick(30); });
    let rt, lastW = availW();
    window.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        const w = availW();
        drawChart();
        if (Math.abs(w - lastW) > 40) { lastW = w; newBoard(); }
      }, 200);
    });
  }

  if (location.hash === "#play") reveal();
})();
