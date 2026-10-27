// Game B: Granovetter's threshold model of collective action.
//
// Fifty people stand in a square. Each has a threshold: how many others must
// already be protesting before they join. Every round, everyone whose threshold
// is met joins at once; nobody leaves. The run ends when a round adds no one.
// Tapping a square persuades that person to join now, whatever their threshold.
(() => {
  const sec = document.getElementById("play");
  const pane = sec && sec.querySelector('[data-game="protest"]');
  if (!pane) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (q) => pane.querySelector(q);

  const N = 50, COLS = 10, ROWS = 5, ROUND_MS = 520, MAX_ROUNDS = 60;

  const PRESETS = {
    riot: { sliders: false,
      note: "Granovetter’s example: thresholds 0, 1, 2 … 49, one person each. The instigator starts, the next follows, and the whole square joins." },
    missing: { sliders: false,
      note: "The same crowd, except the person with threshold 1 now needs 2. Nearly the same people, opposite outcome. Try tapping one person." },
    bell: { sliders: true,
      note: "Thresholds drawn from a bell curve. Set the average and the spread: a slightly wider spread can turn a quiet square into a full protest." },
  };

  // --- The crowd -------------------------------------------------------------------
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const AGES = [19, 22, 24, 27, 29, 31, 34, 36, 38, 41, 44, 47, 52, 55, 58, 61, 64, 68, 72];
  const JOBS = ["nurse", "student", "bus driver", "teacher", "shop owner", "software developer", "retired miner",
    "barista", "civil servant", "electrician", "delivery rider", "accountant", "farmer", "journalist", "cleaner",
    "pharmacist", "factory worker", "lawyer", "hairdresser", "taxi driver", "graduate student", "chef",
    "security guard", "social worker", "builder"];
  const TRAITS = ["worried about their job", "has young children at home", "has been to protests before",
    "distrusts the police", "keeps out of politics", "angry about rising prices", "active in a union",
    "religious and cautious", "new to the city", "follows the news closely", "feels nothing ever changes",
    "runs a small business on the square", "here on a visa", "knows someone who was arrested"];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function gauss(r) {
    let u = 0, v = 0;
    while (!u) u = r();
    while (!v) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function makeCrowd() {
    const r = rng(seed * 7919 + presetKey.length);
    let ts;
    if (presetKey === "bell") ts = Array.from({ length: N }, () => clamp(Math.round(MEAN + SD * gauss(r)), 0, N));
    else {
      ts = Array.from({ length: N }, (_, i) => i);
      if (presetKey === "missing") ts[1] = 2;
    }
    for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ts[i], ts[j]] = [ts[j], ts[i]]; }
    return ts.map((t) => ({
      t,
      who: `${AGES[(r() * AGES.length) | 0]}-year-old ${JOBS[(r() * JOBS.length) | 0]}, ${TRAITS[(r() * TRAITS.length) | 0]}`,
    }));
  }

  // --- Elements --------------------------------------------------------------------
  const canvas = $(".game-board"), ctx = canvas.getContext("2d");
  const chart = $(".game-chart"), cctx = chart.getContext("2d");
  const cabinet = $(".arcade");
  const out = {
    round: $('[data-stat="round"]'), crowd: $('[data-stat="crowd"]'), next: $('[data-stat="next"]'),
    gap: $('[data-stat="gap"]'), note: $(".game-note"), result: $(".game-result"), inspect: $(".arc-inspect"),
    banner: $(".arc-banner"), bTitle: $(".arc-banner b"), bSub: $(".arc-banner span"),
    meanVal: $('[data-out="mean"]'), sdVal: $('[data-out="sd"]'),
  };
  const meanIn = $('[data-in="mean"]'), sdIn = $('[data-in="sd"]');
  const presetButtons = [...pane.querySelectorAll("[data-preset]")];
  const playBtn = $('[data-act="play"]'), stepBtn = $('[data-act="step"]');
  const resetBtn = $('[data-act="reset"]'), newBtn = $('[data-act="new"]');

  // --- State -----------------------------------------------------------------------
  let presetKey = "riot", seed = 1, MEAN = 15, SD = 6;
  let crowd = [], joined = [], joinedAt = [], pushed = [], counts = [0], round = 0;
  let playing = false, timer = null, status = "ready", sel = -1, hover = -1;
  let CELL = 40, SQ = 30, W = 400, H = 200, DPR = 1, raf = 0, lastChange = 0;
  let INK = [240, 239, 234], INK2 = [154, 152, 143], ACC = [224, 166, 90], PRO = [227, 145, 123];

  const parse = (s) => {
    s = (s || "").trim();
    let m = s.match(/^#([0-9a-f]{6})$/i);
    if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    m = s.match(/rgba?\(([^)]+)\)/);
    return m ? m[1].split(/[ ,/]+/).slice(0, 3).map(Number) : null;
  };
  function readTokens() {
    const cs = getComputedStyle(cabinet);
    INK = parse(cs.getPropertyValue("--arc-ink")) || INK;
    INK2 = parse(cs.getPropertyValue("--arc-ink-2")) || INK2;
    ACC = parse(cs.getPropertyValue("--arc-accent")) || ACC;
    const sw = document.createElement("i");
    sw.className = "t-protest"; sw.hidden = true; cabinet.appendChild(sw);
    PRO = parse(getComputedStyle(sw).getPropertyValue("--tc")) || PRO;
    sw.remove();
  }

  // --- Model -----------------------------------------------------------------------
  const k = () => joined.reduce((s, x) => s + x, 0);
  function nextNeed() {
    let m = Infinity;
    crowd.forEach((a, i) => { if (!joined[i]) m = Math.min(m, a.t); });
    return m;
  }
  function doRound() {
    const now = k(), add = [];
    crowd.forEach((a, i) => { if (!joined[i] && a.t <= now) add.push(i); });
    if (!add.length) return 0;
    round++;
    const t = performance.now();
    add.forEach((i) => { joined[i] = 1; joinedAt[i] = t; });
    counts.push(k());
    refresh();
    return add.length;
  }
  // Fixed point of the cumulative distribution, from the current crowd size.
  function cdf(x) { return crowd.reduce((s, a) => s + (a.t <= x), 0); }

  // --- Drawing ---------------------------------------------------------------------
  const availW = () => {
    const p = canvas.parentElement, cs = getComputedStyle(p);
    let w = p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (window.innerWidth >= 1100) {
      const top = p.getBoundingClientRect().top - sec.getBoundingClientRect().top + sec.scrollTop + parseFloat(cs.paddingTop);
      const h = window.innerHeight - top - parseFloat(cs.paddingBottom) - 90;
      if (h > 200) w = Math.min(w, Math.floor(h * COLS / ROWS));
    }
    return Math.min(w, 760);
  };
  function layout() {
    const w = availW();
    CELL = Math.floor(w / COLS);
    SQ = Math.round(CELL * 0.74);
    W = CELL * COLS; H = CELL * ROWS;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    let busy = false;
    const fontPx = Math.max(9, Math.round(SQ * 0.3));
    ctx.font = `700 ${fontPx}px Silkscreen, ui-monospace, monospace`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    crowd.forEach((a, i) => {
      const cx = (i % COLS) * CELL + CELL / 2, cy = Math.floor(i / COLS) * CELL + CELL / 2;
      const x = Math.round(cx - SQ / 2), y = Math.round(cy - SQ / 2);
      if (joined[i]) {
        const age = now - joinedAt[i], f = reduce ? 1 : Math.min(1, age / 420);
        if (f < 1) busy = true;
        const grow = reduce ? 0 : (1 - f) * 0.18 * SQ;
        ctx.shadowColor = `rgba(${PRO},0.7)`; ctx.shadowBlur = (1 - f) * 18;
        ctx.fillStyle = `rgba(${PRO},${0.35 + 0.65 * f})`;
        ctx.fillRect(x - grow / 2, y - grow / 2, SQ + grow, SQ + grow);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(14,14,13,0.75)";
        ctx.fillText(pushed[i] ? "!" : String(a.t), cx, cy + 1);
      } else {
        const ready = a.t <= k();
        ctx.strokeStyle = ready ? `rgba(${PRO},0.95)` : `rgba(${INK2},0.55)`;
        ctx.lineWidth = ready ? 2 : 1.25;
        ctx.strokeRect(x + 0.75, y + 0.75, SQ - 1.5, SQ - 1.5);
        ctx.fillStyle = ready ? `rgb(${PRO})` : `rgba(${INK2},0.9)`;
        ctx.fillText(String(a.t), cx, cy + 1);
      }
      if (i === sel || i === hover) {
        const pulse = i === sel && !reduce ? 0.55 + 0.45 * Math.sin(now / 180) : 0.8;
        ctx.strokeStyle = `rgba(${ACC},${pulse})`; ctx.lineWidth = 2;
        ctx.strokeRect(x - 4, y - 4, SQ + 8, SQ + 8);
        if (i === sel) busy = true;
      }
    });
    return busy;
  }
  function loop(now) {
    raf = 0;
    if (draw(now) || now < lastChange) raf = requestAnimationFrame(loop);
  }
  function kick(ms = 500) {
    lastChange = Math.max(lastChange, performance.now() + ms);
    if (!raf) raf = requestAnimationFrame(loop);
  }

  // The classic Granovetter picture: how many people have a threshold at or
  // below x, against the line y = x. The crowd stops where the steps meet the line.
  function drawChart() {
    const w = chart.clientWidth, h = chart.clientHeight;
    if (!w || !h) return;
    if (chart.width !== Math.round(w * DPR) || chart.height !== Math.round(h * DPR)) { chart.width = Math.round(w * DPR); chart.height = Math.round(h * DPR); }
    cctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cctx.clearRect(0, 0, w, h);
    const padL = 26, padR = 6, padT = 6, padB = 16;
    const X = (v) => padL + (v / N) * (w - padL - padR);
    const Y = (v) => padT + (1 - v / N) * (h - padT - padB);
    cctx.font = "8px Silkscreen, ui-monospace, monospace";
    cctx.fillStyle = `rgb(${INK2})`; cctx.strokeStyle = `rgba(${INK},0.07)`; cctx.lineWidth = 1;
    cctx.textBaseline = "middle"; cctx.textAlign = "right";
    [0, N / 2, N].forEach((v) => {
      cctx.beginPath(); cctx.moveTo(padL, Math.round(Y(v)) + 0.5); cctx.lineTo(w - padR, Math.round(Y(v)) + 0.5); cctx.stroke();
      cctx.fillText(String(v), padL - 5, Y(v));
    });
    cctx.textAlign = "left"; cctx.textBaseline = "alphabetic";
    cctx.fillText("ALREADY OUT →", padL, h - 3);
    // y = x
    cctx.setLineDash([4, 3]); cctx.strokeStyle = `rgba(${INK},0.4)`;
    cctx.beginPath(); cctx.moveTo(X(0), Y(0)); cctx.lineTo(X(N), Y(N)); cctx.stroke(); cctx.setLineDash([]);
    // cumulative thresholds, as steps
    cctx.strokeStyle = `rgb(${INK2})`; cctx.lineWidth = 1.25;
    cctx.beginPath();
    for (let x = 0; x <= N; x++) {
      const y = Y(cdf(x));
      if (x === 0) cctx.moveTo(X(0), y); else { cctx.lineTo(X(x), Y(cdf(x - 1))); cctx.lineTo(X(x), y); }
    }
    cctx.stroke();
    // the path the crowd has taken: each round, from the line up to the steps
    if (counts.length > 1) {
      cctx.strokeStyle = `rgb(${ACC})`; cctx.lineWidth = 2; cctx.shadowColor = `rgba(${ACC},0.8)`; cctx.shadowBlur = 8;
      cctx.beginPath(); cctx.moveTo(X(counts[0]), Y(counts[0]));
      for (let r = 1; r < counts.length; r++) { cctx.lineTo(X(counts[r - 1]), Y(counts[r])); cctx.lineTo(X(counts[r]), Y(counts[r])); }
      cctx.stroke(); cctx.shadowBlur = 0;
    }
    const c = counts[counts.length - 1];
    cctx.fillStyle = `rgb(${ACC})`;
    cctx.fillRect(Math.round(X(c)) - 2, Math.round(Y(c)) - 2, 4, 4);
  }

  // --- Readouts --------------------------------------------------------------------
  function banner(title, sub = "") {
    if (!title) { out.banner.hidden = true; return; }
    out.bTitle.textContent = title; out.bSub.textContent = sub;
    out.banner.hidden = false;
    out.banner.classList.remove("pop"); void out.banner.offsetWidth; out.banner.classList.add("pop");
  }
  function refresh() {
    const now = k(), need = nextNeed();
    out.round.textContent = String(round).padStart(3, "0");
    out.crowd.textContent = `${now}/${N}`;
    out.next.textContent = need === Infinity ? "–" : String(need);
    out.gap.textContent = need === Infinity ? "–" : String(Math.max(0, need - now));
    drawChart();
    showInspect();
    kick(500);
  }
  function showInspect() {
    if (sel < 0) { out.inspect.textContent = "Tap a square to see who it is. Tap again to persuade them to join."; return; }
    const a = crowd[sel];
    const state = joined[sel] ? (pushed[sel] ? "joined because you persuaded them" : "protesting") :
      a.t <= k() ? "about to join" : `waiting: needs ${a.t} out, ${a.t - k()} more`;
    out.inspect.textContent = `#${sel + 1} · ${a.who} · threshold ${a.t} · ${state}`;
  }
  function conclude() {
    const now = k(), need = nextNeed();
    status = "settled";
    let title, msg;
    if (now === N) { title = "Full protest"; msg = `Everyone joined, in ${round} rounds.`; }
    else if (now <= 2) { title = "Fizzled"; msg = `Only ${now} of ${N} came out. The next person needed ${need} already protesting.`; }
    else { title = "Stalled"; msg = `The crowd stopped at ${now} of ${N}. The next person needed ${need} already protesting, ${need - now} more than were out.`; }
    banner(title, `${now} of ${N} protesting`);
    out.result.textContent = msg + (presetKey === "missing" && now < N ? " Tap one waiting square to supply the missing link." : "");
    stopPlaying();
  }

  // --- Running ---------------------------------------------------------------------
  function play() {
    if (status === "settled") { if (k() === N) reset(); }
    playing = true; status = "running";
    banner(null); out.result.textContent = "";
    cabinet.classList.add("running");
    playBtn.textContent = "Pause"; playBtn.setAttribute("aria-pressed", "true");
    tick();
  }
  function stopPlaying() {
    playing = false; clearTimeout(timer);
    cabinet.classList.remove("running");
    playBtn.textContent = "Play"; playBtn.setAttribute("aria-pressed", "false");
  }
  function pause() {
    if (playing) banner("Paused", "press play to continue");
    stopPlaying();
  }
  function tick() {
    if (!playing) return;
    if (!doRound() || round >= MAX_ROUNDS) { conclude(); return; }
    timer = setTimeout(tick, reduce ? 120 : ROUND_MS);
  }
  function reset() {
    stopPlaying();
    joined = crowd.map(() => 0); joinedAt = crowd.map(() => 0); pushed = crowd.map(() => 0);
    counts = [0]; round = 0; status = "ready"; sel = -1;
    out.result.textContent = "";
    banner("Press play", "or tap a square to persuade someone");
    refresh();
  }
  function newCrowd() { crowd = makeCrowd(); reset(); }

  function setPreset(key) {
    presetKey = key;
    presetButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === key)));
    out.note.textContent = PRESETS[key].note;
    const on = PRESETS[key].sliders;
    [meanIn, sdIn].forEach((el) => { el.disabled = !on; el.closest(".gslider").classList.toggle("off", !on); });
    seed = 1;
    newCrowd();
  }
  const showSliders = () => { out.meanVal.textContent = String(MEAN); out.sdVal.textContent = String(SD); };

  // --- Input -----------------------------------------------------------------------
  function cellAt(ev) {
    const r = canvas.getBoundingClientRect();
    const c = Math.floor((ev.clientX - r.left) / CELL), rr = Math.floor((ev.clientY - r.top) / CELL);
    return c >= 0 && c < COLS && rr >= 0 && rr < ROWS ? rr * COLS + c : -1;
  }
  function persuade(i) {
    if (joined[i]) return;
    joined[i] = 1; pushed[i] = 1; joinedAt[i] = performance.now();
    counts.push(k());
    if (status === "settled") status = "ready";
    banner(null);
    refresh();
    if (!playing) out.result.textContent = "Press play to see whether the crowd follows.";
  }
  canvas.addEventListener("click", (ev) => {
    const i = cellAt(ev);
    if (i < 0) return;
    if (i === sel) persuade(i); else { sel = i; showInspect(); kick(400); }
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (ev.pointerType !== "mouse") return;
    const i = cellAt(ev);
    if (i !== hover) { hover = i; kick(30); }
  });
  canvas.addEventListener("pointerleave", () => { hover = -1; kick(30); });
  canvas.addEventListener("keydown", (ev) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS };
    if (moves[ev.key] != null) {
      ev.preventDefault();
      sel = clamp((sel < 0 ? 0 : sel + moves[ev.key]), 0, N - 1);
      showInspect(); kick(400);
    } else if ((ev.key === "Enter" || ev.key === " ") && sel >= 0) { ev.preventDefault(); persuade(sel); }
  });

  playBtn.addEventListener("click", () => (playing ? pause() : play()));
  stepBtn.addEventListener("click", () => {
    pause(); banner(null);
    if (!doRound()) conclude();
  });
  resetBtn.addEventListener("click", reset);
  newBtn.addEventListener("click", () => { seed++; newCrowd(); });
  presetButtons.forEach((b) => b.addEventListener("click", () => setPreset(b.dataset.preset)));
  meanIn.addEventListener("input", () => { MEAN = +meanIn.value; showSliders(); newCrowd(); });
  sdIn.addEventListener("input", () => { SD = +sdIn.value; showSliders(); newCrowd(); });

  // --- Start when this game is first shown --------------------------------------------
  let inited = false;
  function init() {
    if (inited) { layout(); drawChart(); kick(30); return; }
    inited = true;
    readTokens();
    MEAN = +meanIn.value; SD = +sdIn.value; showSliders();
    layout();
    setPreset("riot");
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readTokens(); drawChart(); kick(30); });
    let rt;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (!pane.hidden) { layout(); drawChart(); kick(30); } }, 200); });
  }
  sec.addEventListener("gameswitch", (ev) => {
    if (ev.detail === "protest") requestAnimationFrame(init);
    else if (inited) pause();
  });
  sec.addEventListener("gameclose", () => { if (inited) pause(); });
  // game.js may have opened #protest before this script loaded
  if (!sec.hidden && !pane.hidden) requestAnimationFrame(init);
})();
