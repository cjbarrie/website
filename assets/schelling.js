// Hero: a Schelling segregation model on a grid of small squares.
// One colour per research area, in proportion to how many papers carry it.
// The model runs in visible steps. A solid square is content with its
// neighbours; an outlined one is restless. Each step a few restless squares
// look around their neighbourhood and glide a short way to a spot that suits
// them, which in turn settles or unsettles the squares around it. Tolerance
// rises step by step until the board sorts itself into patches, holds for a
// moment, and the colours mix again.
(() => {
  const canvas = document.querySelector('.society[data-sim="schelling"]');
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- Areas, colours and weights come straight from the filter pills -------
  const pills = [...document.querySelectorAll(".topic-bar .pill[data-topic]")];
  const AREAS = pills.map((b) => ({
    key: b.dataset.topic,
    weight: Math.max(1, parseInt((b.querySelector(".n") || {}).textContent, 10) || 1),
    rgb: [0, 0, 0],
  }));
  if (!AREAS.length) return;
  let INK = [20, 20, 19];
  const parseColor = (s) => {
    s = s.trim();
    if (s.startsWith("#")) return s.slice(1).match(/\w\w/g).map((h) => parseInt(h, 16));
    const m = s.match(/[\d.]+/g);
    return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
  };
  const readTokens = () => {
    const cs = getComputedStyle(document.documentElement);
    const ink = cs.getPropertyValue("--net-node").trim().split(/\s+/).map(Number);
    if (ink.length === 3 && ink.every((x) => !isNaN(x))) INK = ink;
    pills.forEach((b, i) => (AREAS[i].rgb = parseColor(getComputedStyle(b).getPropertyValue("--tc"))));
  };
  readTokens();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readTokens(); draw(performance.now()); });

  let focus = [];
  document.addEventListener("topicchange", (ev) => { focus = ev.detail || []; if (reduce) draw(0); });

  const heroText = canvas.parentElement.querySelector(".hero-text");

  // --- Model ------------------------------------------------------------------
  const DENSITY = 0.7;
  const T_MIN = 0.2, T_MAX = 0.55, RAMP_STEPS = 18, MAX_STEPS = 34;
  const STEP = 1150, GLIDE = 900, HOLD = 6500, MIX = 1800, RADIUS = 4;
  const MOVE_SHARE = 0.05;                  // at most this share of squares moves per step
  let W = 0, H = 0, DPR = 1, CELL = 14, SQ = 6, cols = 0, rows = 0;
  let grid, fade, agents = [], phase = "sort", phaseAt = 0, lastStep = 0, step = 0, T = T_MIN;
  let similarity = 0, restless = 0;

  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const cx = (c) => (c % cols) * CELL + CELL / 2;
  const cy = (c) => Math.floor(c / cols) * CELL + CELL / 2;
  const clamp01 = (x) => Math.min(1, Math.max(0, x));

  // The area of the canvas kept clear behind the name block.
  function clearRects() {
    if (!heroText) return [];
    const a = canvas.getBoundingClientRect(), r = heroText.getBoundingClientRect();
    const range = document.createRange();
    const right = Math.max(...[...heroText.children].map((k) => { range.selectNodeContents(k); return range.getBoundingClientRect().right; }));
    return [{ x0: r.left - a.left - 16, y0: r.top - a.top - 14, x1: right - a.left + 24, y1: r.bottom - a.top + 10 }];
  }

  function build() {
    const r = canvas.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    CELL = W < 600 ? 12 : 14; SQ = W < 600 ? 5 : 6;
    cols = Math.floor(W / CELL); rows = Math.floor(H / CELL);
    grid = new Int32Array(cols * rows).fill(-1);

    // Keep the cells behind the text empty, and fade the board softly towards
    // them, so the text sits in clear space without a hard edge.
    const rects = clearRects();
    fade = new Float32Array(cols * rows).fill(1);
    for (let c = 0; c < grid.length; c++) {
      const x = cx(c), y = cy(c);
      let d = 1e9;
      for (const q of rects) d = Math.min(d, Math.hypot(Math.max(q.x0 - x, 0, x - q.x1), Math.max(q.y0 - y, 0, y - q.y1)));
      if (d === 0) grid[c] = -2;
      else if (d < 56) { const k = d / 56; fade[c] = k * k * (3 - 2 * k); }
    }
    const usable = [];
    for (let c = 0; c < grid.length; c++) if (grid[c] === -1) usable.push(c);
    shuffle(usable);
    const n = Math.floor(usable.length * DENSITY);
    const total = AREAS.reduce((s, a) => s + a.weight, 0);
    const colours = [];
    let g = 0, acc = AREAS[0].weight / total;
    for (let i = 0; i < n; i++) {
      while ((i + 0.5) / n > acc && g < AREAS.length - 1) { g++; acc += AREAS[g].weight / total; }
      colours.push(g);
    }
    shuffle(colours);
    agents = colours.map((g, i) => {
      const c = usable[i];
      grid[c] = i;
      return { g, pg: g, c, from: c, t0: -1e9, ct: -1e9, h: 1, happy: true, a: 0.74 + Math.random() * 0.18 };
    });
    startPhase("sort", performance.now());
    // Open on a board that is already part-sorted, rather than a field of restless squares.
    for (let k = 0; k < 7; k++) doStep(-1e9);
    measure();
    agents.forEach((a) => { a.from = a.c; a.t0 = -1e9; a.h = a.happy ? 1 : 0; });
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }

  // Share of the neighbours around cell c that have colour g, ignoring cell skip.
  function shareAt(c, g, skip) {
    const x = c % cols, y = (c / cols) | 0;
    let occ = 0, same = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const r = ny * cols + nx, j = grid[r];
      if (j >= 0 && r !== skip) { occ++; if (agents[j].g === g) same++; }
    }
    return occ ? same / occ : 1;
  }

  function measure() {
    let sum = 0, bad = 0;
    for (const a of agents) {
      const s = shareAt(a.c, a.g, -1);
      a.happy = s >= T;
      sum += s; if (!a.happy) bad++;
    }
    similarity = agents.length ? sum / agents.length : 0;
    restless = agents.length ? bad / agents.length : 0;
  }

  // A restless square looks at the empty cells within a few steps of it and
  // moves to the nearest one where it would be content. If none would do, it
  // takes the best improvement, or now and then just wanders a little.
  function chooseCell(i) {
    const a = agents[i], x0 = a.c % cols, y0 = (a.c / cols) | 0;
    const here = shareAt(a.c, a.g, -1);
    let best = -1, bestD = 1e9, alt = -1, altS = here, wander = [];
    for (let dy = -RADIUS; dy <= RADIUS; dy++) for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      const x = x0 + dx, y = y0 + dy;
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      const c = y * cols + x;
      if (grid[c] !== -1) continue;
      const s = shareAt(c, a.g, a.c), d = dx * dx + dy * dy;
      if (s >= T && d < bestD) { best = c; bestD = d; }
      if (s > altS) { alt = c; altS = s; }
      if (d <= 4) wander.push(c);
    }
    if (best >= 0) return best;
    if (alt >= 0) return alt;
    return wander.length && Math.random() < 0.35 ? wander[(Math.random() * wander.length) | 0] : -1;
  }

  function doStep(t) {
    step++;
    T = T_MIN + (T_MAX - T_MIN) * Math.min(1, step / RAMP_STEPS);
    measure();
    const movers = shuffle(agents.map((a, i) => i).filter((i) => !agents[i].happy));
    const budget = Math.max(3, Math.round(agents.length * MOVE_SHARE));
    let moved = 0;
    for (const i of movers) {
      if (moved >= budget) break;
      const c = chooseCell(i);
      if (c < 0) continue;
      const a = agents[i];
      a.from = a.c; a.t0 = t + 120 + Math.random() * 160;
      grid[a.c] = -1; grid[c] = i; a.c = c;
      moved++;
    }
  }

  function startPhase(p, t) {
    phase = p; phaseAt = t; lastStep = t;
    if (p === "sort") { step = 0; T = T_MIN; measure(); }
    if (p === "hold") measure();
    if (p === "mix") {
      // Colours cross-fade in place to a fresh random mix; nobody moves.
      const colours = shuffle(agents.map((a) => a.g));
      agents.forEach((a, i) => { a.pg = a.g; a.g = colours[i]; a.ct = t + Math.random() * (MIX - 600); });
    }
  }

  // --- Render -----------------------------------------------------------------
  const mixRGB = (a, b, k) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * k));

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    const on = (g) => !focus.length || focus.includes(AREAS[g].key);

    // Empty cells: a faint dot, so the board reads as a grid.
    ctx.fillStyle = `rgba(${INK},0.07)`;
    for (let c = 0; c < grid.length; c++) if (grid[c] === -1 && fade[c] > 0.5) ctx.fillRect(Math.round(cx(c)) - 0.5, Math.round(cy(c)) - 0.5, 1, 1);

    const half = SQ / 2;
    for (const a of agents) {
      // Position: a slow eased glide from the old cell to the new one.
      const k = ease(clamp01((t - a.t0) / GLIDE));
      const x = cx(a.from) + (cx(a.c) - cx(a.from)) * k, y = cy(a.from) + (cy(a.c) - cy(a.from)) * k;
      // Colour: cross-fades during the mix.
      const ck = clamp01((t - a.ct) / 600);
      const rgb = ck >= 1 ? AREAS[a.g].rgb : mixRGB(AREAS[a.pg].rgb, AREAS[a.g].rgb, ease(ck));
      // Content vs restless eases in and out, so changes ripple across neighbours.
      a.h += ((a.happy ? 1 : 0) - a.h) * 0.06;
      const vis = (on(a.g) ? 1 : 0.18) * fade[k < 1 ? a.from : a.c];
      const px = Math.round(x - half), py = Math.round(y - half);
      ctx.fillStyle = `rgba(${rgb},${a.a * (0.18 + 0.82 * a.h) * vis})`;
      ctx.fillRect(px, py, SQ, SQ);
      if (a.h < 0.97) {
        ctx.strokeStyle = `rgba(${rgb},${a.a * 0.6 * (1 - a.h) * vis})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, SQ - 1, SQ - 1);
      }
    }

  }

  function frame(t) {
    if (!running) return;
    const age = t - phaseAt;
    if (phase === "sort") {
      if (t - lastStep > STEP) {
        lastStep = t;
        if (step >= MAX_STEPS || (step >= RAMP_STEPS && restless < 0.02)) startPhase("hold", t);
        else doStep(t);
      }
    } else if (phase === "hold" && age > HOLD) startPhase("mix", t);
    else if (phase === "mix" && age > MIX + 300) startPhase("sort", t);
    draw(t);
    requestAnimationFrame(frame);
  }

  let running = false;
  build();
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { build(); if (reduce) settle(); }, 150); });

  // Reduced motion: run the model to rest off-screen and show one still frame.
  function settle() {
    while (step < MAX_STEPS) doStep(-1e9);
    measure();
    agents.forEach((a) => { a.from = a.c; a.h = a.happy ? 1 : 0; });
    phase = "hold";
    draw(0);
  }
  if (reduce) { settle(); return; }

  const go = () => { if (!running) { running = true; requestAnimationFrame(frame); } };
  new IntersectionObserver(([en]) => { if (en.isIntersecting && !document.hidden) go(); else running = false; }).observe(canvas);
  document.addEventListener("visibilitychange", () => { if (document.hidden) running = false; else go(); });
  document.fonts && document.fonts.ready.then(() => { if (phase === "sort" && step < 2) build(); });
})();
