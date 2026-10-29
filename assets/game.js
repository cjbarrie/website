// Easter egg: keep scrolling past the bottom of the page (or open #play) and the
// game opens full screen over the blurred page. The game itself (kart.js)
// listens for "gameopen" and "gameclose" on the section.
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
    sec.dispatchEvent(new CustomEvent("gameopen"));
    requestAnimationFrame(() => { if (closeBtn) closeBtn.focus({ preventScroll: true }); });
  }

  function close() {
    if (sec.hidden) return;
    sec.dispatchEvent(new CustomEvent("gameclose"));
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
  if (location.hash === "#play") reveal();
})();
