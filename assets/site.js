(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- Reveal on scroll ------------------------------------------------------
  const revealIO = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          revealIO.unobserve(en.target);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
  );
  document.querySelectorAll(".reveal").forEach((el) => revealIO.observe(el));

  // --- Sidebar scroll-spy with a sliding marker -----------------------------
  const nav = document.querySelector(".nav");
  const marker = nav && nav.querySelector(".nav-marker");
  const links = nav ? [...nav.querySelectorAll("a")] : [];
  const byId = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
  const setActive = (a) => {
    links.forEach((l) => l.classList.toggle("active", l === a));
    if (marker && a) {
      nav.style.setProperty("--y", a.offsetTop + "px");
      nav.style.setProperty("--h", a.offsetHeight + "px");
      nav.classList.add("ready");
    }
    if (a && getComputedStyle(nav).flexDirection === "row") {
      a.scrollIntoView({ block: "nearest", inline: "center", behavior: reduce ? "auto" : "smooth" });
    }
  };
  const sections = [...byId.keys()].map((id) => document.getElementById(id)).filter(Boolean);
  const spy = () => {
    const line = window.innerHeight * 0.35;
    let current = null;
    for (const s of sections) if (s.getBoundingClientRect().top <= line) current = s;
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = sections[sections.length - 1];
    const a = current ? byId.get(current.id) : null;
    if (!a) {
      links.forEach((l) => l.classList.remove("active"));
      nav && nav.classList.remove("ready");
    } else if (!a.classList.contains("active")) setActive(a);
  };
  window.addEventListener("scroll", spy, { passive: true });
  window.addEventListener("resize", () => {
    const a = nav && nav.querySelector("a.active");
    if (a) setActive(a);
  });
  spy();

  // --- Paper filter: research-area pills and text search ---
  // Several areas can be on at once; a paper shows if it is in any of them.
  const state = { topics: new Set(), q: "" };
  const input = document.querySelector("[data-filter]");
  const barButtons = [...document.querySelectorAll(".topic-bar .pill[data-topic]")];
  const viewButtons = [...document.querySelectorAll(".topic-bar [data-view]")];
  const lists = [...document.querySelectorAll(".papers")];
  const note = document.querySelector(".filter-note");
  const labelOf = (k) => { const b = barButtons.find((x) => x.dataset.topic === k); return b ? b.title : k; };

  function applyFilter() {
    for (const list of lists) {
      let shown = 0, lastYear = null;
      for (const li of list.querySelectorAll(".paper")) {
        const topics = (li.dataset.topics || "").split(" ");
        const hit = (!state.topics.size || topics.some((t) => state.topics.has(t))) && (!state.q || li.dataset.text.includes(state.q));
        const was = !li.hidden;
        li.hidden = !hit;
        if (hit) {
          shown++;
          // Year dividers: show each year once, on its first visible paper.
          const first = li.dataset.year !== lastYear;
          li.classList.toggle("year-start", first);
          li.classList.toggle("first-visible", shown === 1);
          lastYear = li.dataset.year;
          if (!was && !reduce) { li.classList.remove("enter"); void li.offsetWidth; li.classList.add("enter"); }
        }
      }
      const empty = list.nextElementSibling;
      if (empty && empty.classList.contains("empty")) empty.hidden = shown > 0;
    }
    for (const b of barButtons) b.setAttribute("aria-pressed", String(state.topics.has(b.dataset.topic)));
    for (const b of viewButtons) b.setAttribute("aria-pressed", String(!state.topics.size));
    // The filter sits under Publications but applies to working papers too, so say so there.
    if (note) {
      const bits = [];
      if (state.topics.size) bits.push([...state.topics].map(labelOf).join(" or "));
      if (state.q) bits.push(`matching “${input.value.trim()}”`);
      note.hidden = !bits.length;
      note.firstElementChild.textContent = "Showing " + bits.join(", ");
    }
    document.dispatchEvent(new CustomEvent("topicchange", { detail: [...state.topics] }));
  }
  function setTopic(key) {
    if (state.topics.has(key)) state.topics.delete(key);
    else state.topics.add(key);
    applyFilter();
  }

  for (const b of barButtons) b.addEventListener("click", () => setTopic(b.dataset.topic));
  for (const b of viewButtons) b.addEventListener("click", () => {
    state.topics.clear();
    applyFilter();
  });
  // Clicking anywhere on a paper row opens it, unless the click was on a link or selected text.
  for (const li of document.querySelectorAll(".paper")) {
    const a = li.querySelector(".ptitle a");
    if (!a) continue;
    li.addEventListener("click", (ev) => {
      if (ev.target.closest("a") || String(window.getSelection())) return;
      if (ev.metaKey || ev.ctrlKey) window.open(a.href, "_blank", "noopener"); else a.click();
    });
  }
  if (note) note.querySelector("button").addEventListener("click", () => {
    state.topics.clear(); state.q = ""; if (input) input.value = "";
    applyFilter();
  });
  if (input) {
    input.addEventListener("input", () => {
      state.q = input.value.trim().toLowerCase();
      applyFilter();
    });
  }
  document.documentElement.classList.add("filtering");
  applyFilter();

  // --- Hero: an artificial society with idea cascades -----------------------
  const canvas = document.querySelector(".society");
  if (!canvas || canvas.dataset.sim) return;   // another hero simulation owns this canvas
  const ctx = canvas.getContext("2d");
  // Colours come from the design tokens so the network follows light/dark mode:
  // neutral hairlines from --net-node, and one community per research area,
  // coloured exactly like that area's pill (--tc).
  let INK = [20, 20, 19], SAFFRON = [201, 130, 43], PALETTE = [];
  let focus = [];
  const KEYS = [...document.querySelectorAll(".topic-bar .pill[data-topic]")].map((b) => b.dataset.topic).filter(Boolean);
  const parseColor = (str) => {
    str = str.trim();
    if (str.startsWith("#")) return str.slice(1).match(/\w\w/g).map((h) => parseInt(h, 16));
    const m = str.match(/[\d.]+/g);
    return m ? m.slice(0, 3).map(Number) : null;
  };
  const readTokens = () => {
    const cs = getComputedStyle(document.documentElement);
    const triple = (v, d) => (cs.getPropertyValue(v).trim().split(/\s+/).map(Number).filter((x) => !isNaN(x)).length === 3
      ? cs.getPropertyValue(v).trim().split(/\s+/).map(Number) : d);
    INK = triple("--net-node", INK);
    SAFFRON = triple("--net-seed", SAFFRON);
    PALETTE = KEYS.map((k) => {
      const el = document.querySelector(`.topic-bar .t-${k}`);
      return (el && parseColor(getComputedStyle(el).getPropertyValue("--tc"))) || SAFFRON;
    });
    if (!PALETTE.length) PALETTE = [SAFFRON];
  };
  readTokens();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readTokens);
  const inFocus = (n) => !focus.length || focus.includes(KEYS[n.g]);
  document.addEventListener("topicchange", (ev) => { focus = ev.detail; if (reduce) draw(); });
  let W = 0, H = 0, DPR = 1, nodes = [], running = true, lastSeed = 0;
  const mouse = { x: -1e4, y: -1e4 };

  const rgb = (hex) => hex.match(/\w\w/g).map((h) => parseInt(h, 16));

  function resize() {
    const r = canvas.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const n = Math.round(Math.min(200, Math.max(90, (W * H) / 4200)));
    nodes = Array.from({ length: n }, (_, i) => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: 2 + Math.random() * 2,
      a: 0.5 + Math.random() * 0.3,
      g: i % PALETTE.length,   // research-area community
      heat: 0,          // 0..1, how "activated" this node is
      threshold: 0.15 + Math.random() * 0.35,
      cool: 0,          // refractory timer so cascades don't loop forever
    }));
  }

  const LINK = () => Math.min(150, Math.max(95, W / 8));

  function step(t) {
    const link = LINK();
    const link2 = link * link;

    // Occasionally seed a cascade near the right side (behind the caption, away from text).
    if (t - lastSeed > 3200) {
      lastSeed = t;
      const cands = nodes.filter((n) => n.cool <= 0 && n.x > W * 0.35 && inFocus(n));
      const seed = cands[(Math.random() * cands.length) | 0];
      if (seed) seed.heat = 1;
    }

    for (const n of nodes) {
      // Drift, gentle repulsion from the cursor, soft wrap at the edges.
      const dx = n.x - mouse.x, dy = n.y - mouse.y, d2 = dx * dx + dy * dy;
      if (d2 < 100 * 100) {
        // A very gentle push away from the cursor; it never ignites nodes.
        const f = (1 - Math.sqrt(d2) / 100) * 0.0006;
        n.vx += dx * f; n.vy += dy * f;
      }
      n.vx *= 0.985; n.vy *= 0.985;
      n.vx += (Math.random() - 0.5) * 0.01; n.vy += (Math.random() - 0.5) * 0.01;
      n.x += n.vx; n.y += n.vy;
      if (n.x < -20) n.x = W + 20; else if (n.x > W + 20) n.x = -20;
      if (n.y < -20) n.y = H + 20; else if (n.y > H + 20) n.y = -20;
    }

    // Threshold contagion: a node ignites when enough of its neighbours are hot.
    const incoming = new Float32Array(nodes.length);
    const degree = new Uint16Array(nodes.length);
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        if (dx * dx + dy * dy < link2) {
          degree[i]++; degree[j]++;
          if (b.heat > 0.6) incoming[i]++;
          if (a.heat > 0.6) incoming[j]++;
        }
      }
    }
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.cool > 0) n.cool -= 1;
      if (n.heat === 0 && n.cool <= 0 && degree[i] && incoming[i] / degree[i] >= n.threshold && Math.random() < 0.12) {
        n.heat = 1;
      }
      if (n.heat > 0) {
        n.heat -= 0.006;
        if (n.heat <= 0) { n.heat = 0; n.cool = 360; }
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const link = LINK();
    const link2 = link * link;
    const dim = (n) => (inFocus(n) ? 1 : 0.25);

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 > link2) continue;
        const k = (1 - Math.sqrt(d2) / link) * Math.min(dim(a), dim(b));
        const h = Math.min(a.heat, b.heat);
        if (h > 0.05) {
          const c = PALETTE[(a.heat >= b.heat ? a : b).g];
          ctx.strokeStyle = `rgba(${c},${(0.15 + 0.5 * h) * k})`;
          ctx.lineWidth = 1;
        } else {
          ctx.strokeStyle = `rgba(${INK},${0.1 * k})`;
          ctx.lineWidth = 0.7;
        }
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }

    for (const n of nodes) {
      const h = n.heat, c = PALETTE[n.g] || SAFFRON, d = dim(n);
      // Small squares, snapped to the pixel grid so their edges stay crisp.
      const size = Math.round(n.r + h);
      ctx.fillStyle = `rgba(${c},${(n.a + (1 - n.a) * h) * d})`;
      ctx.fillRect(Math.round(n.x - size / 2), Math.round(n.y - size / 2), size, size);
    }
  }

  function frame(t) {
    if (!running) return;
    step(t);
    draw();
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);
  canvas.parentElement.addEventListener("pointermove", (ev) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ev.clientX - r.left; mouse.y = ev.clientY - r.top;
  });
  canvas.parentElement.addEventListener("pointerleave", () => { mouse.x = mouse.y = -1e4; });

  if (reduce) {
    nodes.slice(0, 12).forEach((n) => (n.heat = 0.8));
    draw();
    return;
  }
  new IntersectionObserver(([en]) => {
    const was = running;
    running = en.isIntersecting && !document.hidden;
    if (running && !was) requestAnimationFrame(frame);
  }).observe(canvas);
  document.addEventListener("visibilitychange", () => {
    const was = running;
    running = !document.hidden;
    if (running && !was) requestAnimationFrame(frame);
  });
  // Kick off with a cascade straight away.
  lastSeed = -1e5;
  requestAnimationFrame(frame);
})();

// How far paper thumbnails may grow on hover: as large as 1.8x, limited by the margin to their right.
(() => {
  const set = () => {
    const t = document.querySelector(".pthumb");
    if (!t) return;
    const r = t.getBoundingClientRect();
    const room = document.documentElement.clientWidth - r.right - 16;
    const s = Math.min(1.8, (r.width + room) / r.width);
    document.documentElement.style.setProperty("--thumb-grow", s >= 1.2 ? s.toFixed(2) : "1");
  };
  let id;
  addEventListener("resize", () => { cancelAnimationFrame(id); id = requestAnimationFrame(set); });
  set();
})();
