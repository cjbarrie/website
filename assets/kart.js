// The Grand Theory Prix: a kart race between sociologists.
//
// The road is drawn the way 1980s arcade racers did it: the track is a list of
// short segments, each with a curve and a height, projected onto the screen one
// by one from near to far. Sprites (trees, signs, karts) are drawn far to near
// on top. Everything is drawn at 480×270 and scaled up with crisp pixels.
(() => {
  const sec = document.getElementById("play");
  const cab = sec && sec.querySelector(".kart");
  if (!cab) return;
  const canvas = cab.querySelector(".kart-canvas");
  const ctx = canvas.getContext("2d");
  const menu = cab.querySelector(".kart-menu");
  const results = cab.querySelector(".kart-results");
  const W = 480, H = 270;
  const FONT = '"Silkscreen", ui-monospace, monospace';

  // --- World constants ---------------------------------------------------------
  const STEP = 1 / 60;
  const SEG = 200;                 // segment length
  const RUMBLE = 3;                // segments per rumble strip
  const ROAD_W = 1200;             // half the road's width
  const LANES = 3;
  const CAM_H = 900;
  const CAM_DEPTH = 1 / Math.tan((100 / 2) * Math.PI / 180);
  const PLAYER_Z = CAM_H * CAM_DEPTH;
  const DRAW_DIST = 180;
  const FOG = 4;
  const K = 9;                     // sprite pixels to world size
  const MAX = SEG / STEP;          // base top speed
  const ACCEL = MAX / 4.5, BRAKE = -MAX, DECEL = -MAX / 5;
  const OFF_DECEL = -MAX / 1.6, OFF_LIMIT = MAX / 3.5;
  const CENTRIFUGAL = 0.3;
  const LAPS = 3;
  const KART_W = 0.26;             // a kart's width, in half-road units

  // --- Drivers -----------------------------------------------------------------
  // Seven social scientists, in alphabetical order. Looks are pixel caricatures:
  // hair, beard, glasses. Stats run 1 to 5.
  const DRIVERS = [
    { key: "arendt", name: "Hannah Arendt", short: "Arendt", kart: "#4b8b3b", skin: "#ecbf9c", hair: "#2a221d",
      item: null, blurb: "Corners the way she thought: without a banister.", stats: [4, 2, 3] },
    { key: "beauvoir", name: "Simone de Beauvoir", short: "Beauvoir", kart: "#d9822b", skin: "#eec3a0", hair: "#2b211c", bun: true,
      item: null, blurb: "One is not born a racer, but becomes one.", stats: [3, 4, 2] },
    { key: "dubois", name: "W. E. B. Du Bois", short: "Du Bois", kart: "#7b45a8", skin: "#8b5a3c", hair: "#2a201a", bald: true, beard: "goatee", beardC: "#d9d4cc", mous: true, bow: true,
      item: null, blurb: "His 1900 Paris charts were works of art. So is his racing line.", stats: [3, 2, 4] },
    { key: "durkheim", name: "Émile Durkheim", short: "Durkheim", kart: "#3f74c4", skin: "#eab993", hair: "#3b2a1f", bald: true, beard: "full", beardC: "#3b2a1f", mous: true,
      item: "eff", blurb: "Well integrated, well regulated. Never anomic in a corner.", stats: [3, 3, 3] },
    { key: "marx", name: "Karl Marx", short: "Marx", kart: "#c8372d", skin: "#e9b892", hair: "#d8d3c8", big: true, beard: "huge", beardC: "#cdc7ba", mous: true,
      item: "rev", blurb: "Nothing to lose but his brakes.", stats: [5, 2, 2] },
    { key: "weber", name: "Max Weber", short: "Weber", kart: "#5d6066", skin: "#e8b48c", hair: "#2e231c", beard: "full", beardC: "#2e231c", mous: true,
      item: "cage", blurb: "Racing as a vocation: slow off the line, then ruthlessly rational.", stats: [4, 2, 3] },
    { key: "wells", name: "Ida B. Wells", short: "Wells", kart: "#2f9b96", skin: "#7d4b31", hair: "#1f1712", bun: true,
      item: null, blurb: "Fearless, fast, and already investigating your lap times.", stats: [4, 3, 2] },
  ];
  const ITEMS = {
    eff: { name: "Collective effervescence", by: "Durkheim" },
    cage: { name: "The iron cage", by: "Weber" },
    anom: { name: "Anomie", by: "Durkheim" },
    rev: { name: "Revolution", by: "Marx" },
    str: { name: "The stranger", by: "Simmel" },
  };

  // --- Little helpers ----------------------------------------------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const mod = (v, m) => ((v % m) + m) % m;
  const rand = (a, b) => a + Math.random() * (b - a);
  const easeIn = (a, b, p) => a + (b - a) * p * p;
  const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);
  const hex = (h) => h.match(/\w\w/g).map((x) => parseInt(x, 16));
  const shade = (h, f) => {
    const c = hex(h).map((v) => Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)));
    return `rgb(${c})`;
  };
  // Draw a small pixel image onto its own canvas.
  function sprite(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    const px = (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); };
    draw(g, px);
    return c;
  }

  // --- Driver art --------------------------------------------------------------
  function portrait(d) {
    return sprite(16, 16, (g, px) => {
      px(0, 0, 16, 16, shade(d.kart, -0.25));
      px(0, 12, 16, 4, "#24221f");                      // coat
      px(6, 12, 4, 2, "#f2efe8");                       // collar
      if (d.bow) px(7, 13, 2, 1, "#8a1f2a");
      px(4, 4, 8, 9, d.skin); px(5, 13, 6, 0, d.skin);  // face
      px(3, 7, 1, 2, d.skin); px(12, 7, 1, 2, d.skin);  // ears
      if (d.big) { px(2, 1, 12, 4, d.hair); px(1, 3, 3, 8, d.hair); px(12, 3, 3, 8, d.hair); }
      else if (d.bald) { px(3, 5, 2, 3, d.hair); px(11, 5, 2, 3, d.hair); }
      else if (d.bun) { px(4, 2, 8, 3, d.hair); px(6, 0, 4, 2, shade(d.hair, -0.2)); px(3, 3, 2, 7, d.hair); px(11, 3, 2, 7, d.hair); px(7, 2, 2, 1, shade(d.hair, -0.3)); }
      else { px(4, 2, 8, 3, d.hair); px(3, 3, 2, 3, d.hair); px(11, 3, 2, 3, d.hair); }
      px(6, 7, 1, 1, "#1a1410"); px(9, 7, 1, 1, "#1a1410");    // eyes
      if (d.brows) { px(5, 6, 2, 1, d.hair); px(9, 6, 2, 1, d.hair); }
      if (d.glasses) {
        g.strokeStyle = "#1a1410"; g.lineWidth = 1;
        g.strokeRect(4.5, 6.5, 3, 2); g.strokeRect(8.5, 6.5, 3, 2); px(7, 7, 1, 1, "#1a1410");
      }
      if (d.beard === "full") { px(4, 10, 8, 3, d.beardC); px(5, 13, 6, 1, d.beardC); }
      if (d.beard === "huge") { px(3, 9, 10, 4, d.beardC); px(3, 13, 10, 2, d.beardC); px(5, 15, 6, 1, d.beardC); }
      if (d.beard === "goatee") { px(7, 11, 2, 3, d.beardC); }
      if (d.mous) px(6, 10, 4, 1, d.beardC);
      if (!d.beard && !d.mous) px(7, 11, 2, 1, shade(d.skin, -0.3));
    });
  }
  // The kart from behind, with the back of the driver's head.
  function kartArt(d) {
    return sprite(40, 32, (g, px) => {
      const body = d.kart, dark = shade(d.kart, -0.35), light = shade(d.kart, 0.3);
      px(4, 29, 32, 3, "rgba(0,0,0,0.28)");             // shadow
      px(33, 1, 1, 15, "#d8d4c8");                        // antenna
      px(34, 1, 5, 4, light); px(34, 5, 5, 0, light);
      px(12, 12, 16, 5, "#2a2a2a");                       // shoulders
      px(11, 13, 18, 4, "#2a2a2a");
      // head
      if (d.big) { px(12, 0, 16, 12, d.hair); px(14, 2, 2, 7, shade(d.hair, -0.12)); px(19, 1, 2, 8, shade(d.hair, -0.12)); px(24, 2, 2, 7, shade(d.hair, -0.12)); }
      else {
        px(14, 1, 12, 11, d.bald ? d.skin : d.hair);
        if (d.bald) { px(14, 6, 12, 5, d.hair); px(15, 1, 10, 1, shade(d.skin, 0.2)); }
        px(13, 5, 1, 3, d.skin); px(26, 5, 1, 3, d.skin);
      }
      if (d.bun) px(17, -1, 6, 4, shade(d.hair, -0.2));
      if (d.glasses) { px(13, 5, 1, 1, "#111"); px(26, 5, 1, 1, "#111"); }
      if (d.beard === "full") { px(13, 8, 1, 4, d.beardC); px(26, 8, 1, 4, d.beardC); }
      if (d.beard === "huge") { px(10, 6, 3, 8, d.beardC); px(27, 6, 3, 8, d.beardC); px(12, 11, 16, 2, d.beardC); }
      // kart
      px(13, 15, 14, 3, "#222");                          // seat back
      px(8, 17, 24, 9, body);
      px(8, 17, 24, 1, light);
      px(8, 24, 24, 2, dark);
      px(2, 18, 8, 10, "#1b1b1b"); px(30, 18, 8, 10, "#1b1b1b");   // wheels
      px(4, 21, 4, 4, "#4a4a4a"); px(32, 21, 4, 4, "#4a4a4a");
      px(2, 18, 8, 1, "#333"); px(30, 18, 8, 1, "#333");
      px(10, 26, 20, 2, "#333");                           // bumper
      px(13, 25, 3, 3, "#9a9a9a"); px(24, 25, 3, 3, "#9a9a9a"); // exhausts
      px(17, 19, 6, 4, "#f2efe8");                         // number plate
      px(18, 20, 4, 2, dark);
    });
  }

  // --- Scenery art -------------------------------------------------------------
  const ART = {};
  function makeScenery() {
    ART.pine = sprite(24, 40, (g, px) => {
      px(10, 32, 4, 8, "#6b4426");
      const tiers = [[2, 14, "#2f7d3a"], [12, 24, "#358a40"], [22, 33, "#3f9b4a"]];
      for (const [y0, y1, c] of tiers) for (let y = y0; y < y1; y++) {
        const w = Math.round(((y - y0) / (y1 - y0)) * 11) + 1;
        px(12 - w, y, w * 2, 1, c);
      }
      px(11, 0, 2, 3, "#2f7d3a");
    });
    ART.oak = sprite(28, 34, (g, px) => {
      px(12, 22, 4, 12, "#6b4426");
      const blobs = [[14, 11, 11, "#4c9e3f"], [8, 14, 7, "#428f37"], [20, 14, 7, "#428f37"], [14, 8, 7, "#5bb04b"]];
      for (const [cx, cy, r, c] of blobs) for (let y = -r; y <= r; y++) {
        const w = Math.round(Math.sqrt(r * r - y * y));
        px(cx - w, cy + y, w * 2, 1, c);
      }
    });
    ART.bush = sprite(20, 10, (g, px) => { px(2, 3, 16, 7, "#3f8f3a"); px(5, 1, 10, 3, "#4fa547"); px(0, 6, 20, 4, "#3a8434"); });
    ART.tower = sprite(36, 110, (g, px) => {
      const iv = "#efe5c9", sh = "#d3c6a2", win = "#5b6b84";
      px(6, 24, 24, 86, iv); px(24, 24, 6, 86, sh);
      px(4, 18, 28, 8, iv); for (let x = 4; x < 32; x += 6) px(x, 14, 4, 4, iv);
      px(26, 18, 6, 8, sh);
      for (let y = 34; y < 100; y += 16) { px(11, y, 4, 7, win); px(20, y, 4, 7, win); }
      px(15, 96, 6, 14, "#7a5a3a");
      px(17, 0, 1, 14, "#555"); px(18, 1, 8, 5, "#c8372d");
    });
    ART.box = [0, 1, 2, 3].map((f) => sprite(18, 18, (g, px) => {
      const hues = ["#ff6b6b", "#ffd166", "#4fd1c5", "#7f9cf5"];
      px(0, 0, 18, 18, hues[f]); px(1, 1, 16, 16, hues[(f + 1) % 4]);
      px(2, 2, 14, 14, "rgba(255,255,255,0.55)");
      g.fillStyle = "#fff"; g.font = `700 16px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillStyle = "#3a2a5a"; g.fillText("?", 10, 10); g.fillStyle = "#fff"; g.fillText("?", 9, 9);
    }));
    ART.cage = sprite(20, 22, (g, px) => {
      px(0, 0, 20, 3, "#5a5a5a"); px(0, 19, 20, 3, "#5a5a5a");
      for (let x = 0; x < 20; x += 4) px(x, 2, 2, 18, "#8a8a8a");
      px(0, 0, 20, 1, "#b0b0b0");
    });
    ART.puddle = sprite(36, 12, (g, px) => {
      for (let y = 0; y < 12; y++) { const w = Math.round(Math.sqrt(1 - ((y - 6) / 6) ** 2) * 18); px(18 - w, y, w * 2, 1, "#3b2d4a"); }
      px(8, 3, 6, 1, "#6b5a80");
      g.font = `700 8px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#e7dcff"; g.fillText("R2", 18, 6.5);
    });
    ART.flag = sprite(16, 60, (g, px) => {
      px(2, 0, 2, 60, "#d8d4c8");
      for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) px(4 + x * 4, 2 + y * 4, 4, 4, (x + y) % 2 ? "#111" : "#fff");
    });
  }
  const SIGNS = [["SOCIAL FACTS", "NEXT 2 KM"], ["NO ANOMIE", "BEYOND HERE"], ["REVIEWER 2", "AHEAD!"], ["IVORY TOWER", "CIRCUIT"],
    ["PEER REVIEW", "PIT STOP"], ["ELECTIVE", "AFFINITIES"], ["HABITUS", "ZONE"], ["FRONT STAGE", "SMILE!"], ["CITE ME", ">>>"],
    ["GEMEINSCHAFT", "< LEFT"], ["GESELLSCHAFT", "RIGHT >"], ["THICK", "DESCRIPTION"], ["P < 0.05", "SPEED LIMIT"]];
  function signArt([a, b]) {
    return sprite(78, 40, (g, px) => {
      px(10, 26, 3, 14, "#6b4426"); px(65, 26, 3, 14, "#6b4426");
      px(0, 0, 78, 28, "#6b4426"); px(2, 2, 74, 24, "#f6ecd0");
      g.font = `400 8px ${FONT}`; g.textAlign = "center"; g.textBaseline = "top"; g.fillStyle = "#2a2018";
      g.fillText(a, 39, 5); g.fillText(b, 39, 15);
    });
  }

  // Item icons for the HUD.
  const ICON = {};
  function makeIcons() {
    ICON.eff = sprite(16, 16, (g, px) => {
      const c = ["#ffd166", "#ff9f43"];
      px(7, 0, 2, 16, c[0]); px(0, 7, 16, 2, c[0]); px(3, 3, 2, 2, c[1]); px(11, 3, 2, 2, c[1]); px(3, 11, 2, 2, c[1]); px(11, 11, 2, 2, c[1]);
      px(5, 5, 6, 6, "#fff3c4"); px(6, 6, 4, 4, "#ffd166");
    });
    ICON.cage = sprite(16, 16, (g, px) => { px(1, 1, 14, 2, "#9a9a9a"); px(1, 13, 14, 2, "#9a9a9a"); for (let x = 2; x < 15; x += 3) px(x, 2, 1, 12, "#cfcfcf"); });
    ICON.anom = sprite(16, 16, (g, px) => {
      g.strokeStyle = "#b388ff"; g.lineWidth = 2; g.beginPath();
      for (let t = 0; t < 14; t += 0.2) { const r = t * 0.5; g.lineTo(8 + Math.cos(t) * r, 8 + Math.sin(t) * r); }
      g.stroke();
    });
    ICON.rev = sprite(16, 16, (g, px) => {
      g.fillStyle = "#ff4d4d"; g.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 3 : 7.5, a = -Math.PI / 2 + (i * Math.PI) / 5; g.lineTo(8 + Math.cos(a) * r, 8.5 + Math.sin(a) * r); }
      g.fill();
    });
    ICON.str = sprite(16, 16, (g, px) => {
      px(4, 2, 8, 11, "#e8f1ff"); px(3, 4, 10, 9, "#e8f1ff"); px(3, 13, 2, 2, "#e8f1ff"); px(7, 13, 2, 2, "#e8f1ff"); px(11, 13, 2, 2, "#e8f1ff");
      px(5, 6, 2, 2, "#30364a"); px(9, 6, 2, 2, "#30364a");
    });
  }

  // --- Background layers (parallax) -------------------------------------------
  const BG = {};
  function makeBackground() {
    BG.sky = sprite(W, H, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, H * 0.55);
      gr.addColorStop(0, "#3f8fd6"); gr.addColorStop(1, "#cdeeff");
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    });
    BG.clouds = sprite(960, 90, (g, px) => {
      for (let i = 0; i < 14; i++) {
        const x = Math.random() * 920, y = 6 + Math.random() * 60, w = 30 + Math.random() * 50;
        px(x, y, w, 6, "rgba(255,255,255,0.9)"); px(x + 6, y - 5, w - 16, 6, "rgba(255,255,255,0.9)"); px(x + 12, y + 5, w - 18, 4, "rgba(230,242,255,0.9)");
      }
    });
    const ridge = (g, px, base, amp, f, col, seed) => {
      for (let x = 0; x < 960; x++) {
        const t = (x / 960) * Math.PI * 2;
        const h = base + amp * (Math.sin(t * f + seed) * 0.6 + Math.sin(t * f * 2.3 + seed * 2) * 0.3 + Math.sin(t * f * 5 + seed) * 0.1);
        px(x, 100 - h, 1, h, col);
      }
    };
    BG.hills = sprite(960, 100, (g, px) => { ridge(g, px, 34, 26, 3, "#93cfa0", 1.3); ridge(g, px, 18, 14, 5, "#7dbd8c", 0.4); });
    BG.campus = sprite(960, 70, (g, px) => {
      let x = 0;
      while (x < 960) {
        const w = 14 + Math.random() * 26, h = 18 + Math.random() * 40;
        if (Math.random() < 0.35) {           // a tower with battlements
          px(x, 70 - h - 10, w * 0.5, h + 10, "#e7dcbd");
          for (let k = 0; k < w * 0.5; k += 4) px(x + k, 70 - h - 13, 2, 3, "#e7dcbd");
        } else {
          px(x, 70 - h * 0.5, w, h * 0.5, "#dccfa9");
          for (let k = 2; k < w - 3; k += 5) px(x + k, 70 - h * 0.5 + 4, 2, 3, "#9aa4b5");
        }
        x += w + Math.random() * 30;
      }
      for (let i = 0; i < 40; i++) { const tx = Math.random() * 960; px(tx, 52, 10, 18, "#5ea65a"); px(tx + 2, 46, 6, 6, "#6db866"); }
    });
  }

  // --- The track ---------------------------------------------------------------
  let segments = [], trackLength = 0;
  const lastY = () => (segments.length ? segments[segments.length - 1].p2.world.y : 0);
  function addSegment(curve, y) {
    const n = segments.length;
    segments.push({
      index: n, curve, sprites: [], cars: [],
      p1: { world: { y: lastY(), z: n * SEG }, camera: {}, screen: {} },
      p2: { world: { y, z: (n + 1) * SEG }, camera: {}, screen: {} },
      dark: Math.floor(n / RUMBLE) % 2,
    });
  }
  function addRoad(enter, hold, leave, curve, hill) {
    enter = Math.round(enter * 0.6); hold = Math.round(hold * 0.6); leave = Math.round(leave * 0.6);
    const sy = lastY(), ey = sy + hill * 0.7 * SEG, total = enter + hold + leave;
    for (let n = 0; n < enter; n++) addSegment(easeIn(0, curve, n / enter), easeInOut(sy, ey, n / total));
    for (let n = 0; n < hold; n++) addSegment(curve, easeInOut(sy, ey, (enter + n) / total));
    for (let n = 0; n < leave; n++) addSegment(easeInOut(curve, 0, n / leave), easeInOut(sy, ey, (enter + hold + n) / total));
  }
  function buildTrack() {
    segments = [];
    addRoad(40, 40, 40, 0, 0);
    addRoad(40, 60, 40, 3, 10);
    addRoad(50, 50, 50, 0, 30);
    addRoad(40, 40, 40, -4, 0); addRoad(40, 40, 40, 4, -10); addRoad(30, 30, 30, -3, 0);
    addRoad(60, 100, 60, -3, -20);
    addRoad(50, 80, 50, 0, 0);
    addRoad(40, 80, 40, 6, 20);
    for (let i = 0; i < 4; i++) addRoad(12, 12, 12, 0, i % 2 ? -3 : 3);
    addRoad(50, 60, 50, -2, 30);
    addRoad(40, 40, 40, 3, -20); addRoad(40, 40, 40, -5, 0);
    addRoad(40, 60, 40, 0, 0);
    addRoad(60, 90, 60, 4, -30);
    addRoad(60, 60, 60, -2, -lastY() / SEG / 0.7);
    addRoad(30, 30, 30, 0, 0);
    trackLength = segments.length * SEG;
    const N = segments.length;
    for (let i = 0; i < 4; i++) segments[i].finish = true;

    // Scenery
    const put = (i, img, offset, solid = true) => segments[mod(i, N)].sprites.push({ img, offset, solid, kind: "deco" });
    put(6, ART.flag, -1.15); put(6, ART.flag, 1.15);
    for (let i = 20; i < N; i += 3 + Math.floor(Math.random() * 4)) {
      const side = Math.random() < 0.5 ? -1 : 1, r = Math.random();
      const img = r < 0.45 ? ART.pine : r < 0.8 ? ART.oak : ART.bush;
      put(i, img, side * rand(1.25, 3.8));
      if (Math.random() < 0.3) put(i, ART.bush, -side * rand(1.2, 2));
    }
    for (let i = 60; i < N; i += 90 + Math.floor(Math.random() * 60)) put(i, ART.tower, (Math.random() < 0.5 ? -1 : 1) * rand(2.4, 4));
    SIGNS.forEach((s, k) => put(Math.floor(((k + 0.5) / SIGNS.length) * N), signArt(s), k % 2 ? 1.3 : -1.3));
    // Item boxes, in rows across the road
    for (const at of [0.1, 0.36, 0.6, 0.83]) {
      const i = Math.floor(at * N);
      for (const x of [-0.6, -0.2, 0.2, 0.6]) segments[i].sprites.push({ kind: "box", offset: x, active: true, t: 0 });
    }
    // Reviewer 2 puddles
    for (const [at, x] of [[0.27, -0.35], [0.5, 0.4], [0.72, 0.0], [0.93, -0.5]]) segments[Math.floor(at * N)].sprites.push({ kind: "puddle", offset: x, img: ART.puddle });
  }
  const findSegment = (z) => segments[Math.floor(mod(z, trackLength) / SEG) % segments.length];

  // --- Racers ------------------------------------------------------------------
  let racers = [], player = null, hazards = [];
  function makeRacer(d, isPlayer) {
    return {
      d, isPlayer, img: d.img, x: 0, dist: 0, z: 0, speed: 0,
      top: 0.93 + 0.03 * d.stats[0], acc: 0.72 + 0.12 * d.stats[1], hand: 0.8 + 0.09 * d.stats[2],
      item: null, rolling: 0, itemT: 0, boost: 0, spin: 0, anomie: 0, ghost: 0,
      lane: 0, laneT: 0, base: 1, finished: false, time: 0, lastLap: 1,
    };
  }
  function setupRace(chosen) {
    hazards = [];
    for (const s of segments) for (const sp of s.sprites) if (sp.kind === "box") { sp.active = true; sp.t = 0; }
    const others = DRIVERS.filter((d) => d !== chosen).sort(() => Math.random() - 0.5);
    const order = [...others.slice(0, 5), chosen, others[5]];   // you start sixth
    racers = order.map((d, i) => {
      const r = makeRacer(d, d === chosen);
      const row = Math.floor(i / 2);
      r.dist = -SEG * (2 + row * 3.2) - (i % 2) * SEG * 1.2;
      r.x = i % 2 ? 0.42 : -0.42;
      r.lane = r.x;
      r.base = rand(0.9, 0.97);
      return r;
    });
    player = racers.find((r) => r.isPlayer);
    for (const r of racers) r.z = mod(r.dist, trackLength);
  }

  // --- Input -------------------------------------------------------------------
  const keys = { left: false, right: false, up: false, down: false };
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const KEYMAP = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down" };
  document.addEventListener("keydown", (ev) => {
    if (sec.hidden) return;
    if (state === "race" || state === "count") {
      if (KEYMAP[ev.key]) { keys[KEYMAP[ev.key]] = true; ev.preventDefault(); }
      if (ev.key === " " || ev.key === "x" || ev.key === "X") { ev.preventDefault(); if (state === "race" && !paused) useItem(player); }
      if (ev.key === "p" || ev.key === "P") togglePause();
    }
  });
  document.addEventListener("keyup", (ev) => { if (KEYMAP[ev.key]) keys[KEYMAP[ev.key]] = false; });
  for (const b of cab.querySelectorAll("[data-touch]")) {
    const k = b.dataset.touch;
    const on = (ev) => { ev.preventDefault(); if (k === "item") { if (state === "race" && !paused) useItem(player); } else keys[k] = true; };
    const off = () => { if (k !== "item") keys[k] = false; };
    b.addEventListener("pointerdown", on);
    b.addEventListener("pointerup", off); b.addEventListener("pointercancel", off); b.addEventListener("pointerleave", off);
    b.addEventListener("contextmenu", (ev) => ev.preventDefault());
  }
  canvas.addEventListener("pointerdown", () => { if (paused) togglePause(); });

  // --- Messages ----------------------------------------------------------------
  let msg = null;
  const say = (text, sub = "", t = 1.8) => { msg = { text, sub, t }; };

  // --- Items -------------------------------------------------------------------
  function rank(r) { return standings().indexOf(r) + 1; }
  function rollItem(r) {
    const p = rank(r);
    const w = { eff: 3, cage: 3, anom: 2, rev: 1, str: 2 };
    if (p >= 5) { w.eff += 3; w.rev += 2; w.anom += 2; }
    if (p <= 2) { w.rev = 0; w.cage += 2; w.str += 1; }
    if (r.d.item && w[r.d.item]) w[r.d.item] *= 2;
    let t = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
    for (const [k, v] of Object.entries(w)) { t -= v; if (t <= 0) return k; }
    return "eff";
  }
  function useItem(r) {
    if (!r.item || r.rolling > 0) return;
    const it = r.item; r.item = null;
    const me = r.isPlayer;
    if (it === "eff") { r.boost = 2.4; if (me) say("Collective effervescence!", "Durkheim would be proud"); }
    if (it === "str") { r.ghost = 4; if (me) say("The stranger", "near and far at once"); }
    if (it === "cage") { hazards.push({ kind: "cage", dist: r.dist - SEG * 1.5, x: r.x, life: 30, owner: r }); if (me) say("Iron cage dropped", "rationalise this"); }
    if (it === "anom") {
      let n = 0;
      for (const o of racers) if (o !== r && o.dist > r.dist && !o.ghost) { o.anomie = 2.8; n++; if (o.isPlayer) say("Anomie!", `${r.d.short} dissolved your norms`); }
      if (me) say("Anomie!", n ? `${n} rival${n > 1 ? "s" : ""} ahead lose their way` : "no one ahead of you");
    }
    if (it === "rev") {
      const top = standings().filter((o) => o !== r && !o.finished)[0];
      if (top && !top.ghost) {
        top.spin = 1.6;
        if (top.isPlayer) say("Revolution!", `${r.d.short} overthrew the leader`);
        else say("Revolution!", me ? `${top.d.short} is overthrown` : `${r.d.short} overthrows ${top.d.short}`);
      }
    }
  }

  // --- Race state ----------------------------------------------------------------
  let state = "menu", paused = false, countT = 0, raceT = 0, finishT = 0, chosen = DRIVERS[0];
  let skyOff = 0, hillOff = 0, campusOff = 0, clock = 0;
  function standings() {
    return [...racers].sort((a, b) => (a.finished && b.finished ? a.time - b.time : a.finished ? -1 : b.finished ? 1 : b.dist - a.dist));
  }
  function togglePause() {
    if (state !== "race" && state !== "count") return;
    paused = !paused;
    if (!paused) last = performance.now();
  }

  function startRace() {
    setupRace(chosen);
    menu.hidden = true; results.hidden = true;
    state = "count"; countT = 3.4; raceT = 0; paused = false; msg = null;
    cab.classList.add("racing");
    canvas.focus({ preventScroll: true });
  }
  function toMenu() {
    state = "menu"; results.hidden = true; menu.hidden = false;
    cab.classList.remove("racing");
    setupDemo();
  }
  function setupDemo() {
    setupRace(DRIVERS[0]);
    player.ghost = 1e9;            // the camera rides along invisibly
    for (const r of racers) { r.dist += SEG * 8; r.speed = MAX * 0.6; }
  }

  // --- Update ------------------------------------------------------------------
  function updateRacer(r, dt) {
    const seg = findSegment(r.z);
    const pct = r.speed / MAX;
    let max = MAX * r.top * (r.boost > 0 ? 1.4 : 1) * (r.anomie > 0 ? 0.62 : 1);
    if (r.isPlayer && state === "race") {
      const steer = dt * 2.2 * Math.min(1, pct * 1.4) * r.hand;
      if (r.spin <= 0) {
        if (keys.left) r.x -= steer;
        if (keys.right) r.x += steer;
      }
      if (r.anomie > 0) r.x += Math.sin(clock * 9) * dt * 0.9;
      r.x -= steer * pct * seg.curve * CENTRIFUGAL / r.hand;
      const gas = (keys.up || (coarse && !keys.down)) && r.spin <= 0;
      if (gas) r.speed += ACCEL * r.acc * dt;
      else if (keys.down) r.speed += BRAKE * dt;
      else r.speed += DECEL * dt;
      if (Math.abs(r.x) > 1 && r.speed > OFF_LIMIT) r.speed += OFF_DECEL * dt;
      // Hitting scenery off the road
      if (Math.abs(r.x) > 1) for (const sp of seg.sprites) {
        if (sp.kind !== "deco" || !sp.solid) continue;
        const w = (sp.img.width * K * 0.24) / 288;
        const cx = sp.offset + (sp.offset < 0 ? -w / 2 : w / 2);
        if (Math.abs(r.x - cx) < w / 2 + KART_W / 2) {
          r.speed = Math.min(r.speed, MAX / 6);
          r.x += r.x > cx ? 0.05 : -0.05;
          if (r.isPlayer) shake = 0.25;
        }
      }
      r.x = clamp(r.x, -2.6, 2.6);
    } else if (!r.isPlayer || state === "menu") {
      // Computer drivers: hold a lane, dodge what's ahead, rubber-band to the player.
      const gap = (r.dist - player.dist) / trackLength;
      const band = state === "menu" ? 0 : clamp(gap * 1.4, -0.16, 0.14);
      const target = Math.min(max, MAX * r.top * r.base * (1 - band) * (r.boost > 0 ? 1.4 : 1));
      if (r.spin <= 0) r.speed += clamp(target - r.speed, -MAX * dt, ACCEL * r.acc * dt);
      r.laneT -= dt;
      if (r.laneT <= 0) { r.lane = rand(-0.65, 0.65); r.laneT = rand(1.5, 4); }
      for (const o of racers) {
        if (o === r || (o.isPlayer && state === "menu")) continue;
        const dz = mod(o.z - r.z + trackLength / 2, trackLength) - trackLength / 2;
        if (dz > 0 && dz < SEG * 6 && Math.abs(o.x - r.lane) < KART_W * 1.2 && o.speed < r.speed) {
          r.lane = o.x > 0 ? o.x - KART_W * 1.6 : o.x + KART_W * 1.6;
          r.lane = clamp(r.lane, -0.75, 0.75);
        }
      }
      r.x += clamp(r.lane - r.x, -dt * 0.9, dt * 0.9);
      if (r.anomie > 0) r.x += Math.sin(clock * 7 + r.d.stats[0]) * dt * 0.6;
      if (r.item && r.rolling <= 0 && state === "race") { r.itemT -= dt; if (r.itemT <= 0) useItem(r); }
    }
    if (r.spin > 0) r.speed *= 1 - 2.4 * dt;
    r.speed = clamp(r.speed, 0, max);
    const before = r.dist;
    r.dist += r.speed * dt;
    r.z = mod(r.dist, trackLength);
    for (const k of ["boost", "spin", "anomie", "ghost", "rolling"]) if (r[k] > 0) r[k] -= dt;

    // Boxes and puddles in the segments just passed
    const s0 = Math.floor(before / SEG), s1 = Math.floor(r.dist / SEG);
    for (let s = s0; s <= s1; s++) {
      const sg = segments[mod(s, segments.length)];
      for (const sp of sg.sprites) {
        if (Math.abs(r.x - sp.offset) > KART_W * 0.8) continue;
        if (sp.kind === "box" && sp.active && state !== "menu") {
          sp.active = false; sp.t = 2.5;
          if (!r.item) {
            r.item = rollItem(r);
            r.rolling = r.isPlayer ? 0.9 : 0; r.itemT = rand(0.6, 4);
          }
        }
        if (sp.kind === "puddle" && r.ghost <= 0 && r.spin <= 0 && state !== "menu") {
          r.spin = 1.1;
          if (r.isPlayer) say("Reviewer 2!", "major revisions requested");
        }
      }
    }
    // Lap and finish
    if ((state === "race" || state === "finish" || state === "done") && !r.finished && r.dist >= LAPS * trackLength) {
      r.finished = true; r.time = raceT;
      if (r.isPlayer && state === "race") { state = "finish"; finishT = 2.4; const p = rank(r); say(p === 1 ? "You win!" : "Finish!", `${ordinal(p)} place`, 3); }
    }
    if (r.isPlayer && state === "race") {
      const lap = clamp(Math.floor(r.dist / trackLength) + 1, 1, LAPS);
      if (lap > r.lastLap) { r.lastLap = lap; say(lap === LAPS ? "Final lap!" : `Lap ${lap}`, ""); }
    }
  }

  function collide() {
    for (let i = 0; i < racers.length; i++) for (let j = i + 1; j < racers.length; j++) {
      const a = racers[i], b = racers[j];
      if (a.ghost > 0 || b.ghost > 0) continue;
      const dz = mod(b.z - a.z + trackLength / 2, trackLength) - trackLength / 2;
      if (Math.abs(dz) > SEG * 0.75 || Math.abs(a.x - b.x) > KART_W) continue;
      const [back, front] = dz > 0 ? [a, b] : [b, a];
      if (back.speed > front.speed) {
        back.speed = front.speed * 0.9;
        back.dist -= SEG * 0.75 - Math.abs(dz);
        back.z = mod(back.dist, trackLength);
      }
      const push = (KART_W - Math.abs(a.x - b.x)) * 0.5;
      const sgn = a.x < b.x ? -1 : 1;
      a.x += sgn * push; b.x -= sgn * push;
      if (a.isPlayer || b.isPlayer) shake = 0.15;
    }
    // Iron cages on the track
    for (const h of hazards) {
      h.life -= STEP;
      for (const r of racers) {
        if (r === h.owner && h.life > 29) continue;
        if (r.ghost > 0 || h.life <= 0) continue;
        const dz = mod(mod(h.dist, trackLength) - r.z + trackLength / 2, trackLength) - trackLength / 2;
        if (Math.abs(dz) < SEG * 0.6 && Math.abs(r.x - h.x) < KART_W * 0.75) {
          h.life = 0; r.spin = 1.2; r.speed *= 0.3;
          if (r.isPlayer) say("Caught in the iron cage!", "disenchanting");
        }
      }
    }
    hazards = hazards.filter((h) => h.life > 0);
    for (const s of segments) for (const sp of s.sprites) if (sp.kind === "box" && !sp.active) { sp.t -= STEP; if (sp.t <= 0) sp.active = true; }
  }

  let shake = 0;
  function update(dt) {
    clock += dt;
    if (shake > 0) shake -= dt;
    if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
    if (state === "count") {
      countT -= dt;
      if (countT <= 0) { state = "race"; say("Go!", "", 0.8); }
      return;
    }
    if (state === "race") raceT += dt;
    if (state === "finish") {
      finishT -= dt;
      player.speed *= 1 - dt * 0.8;
      if (finishT <= 0) showResults();
    }
    for (const r of racers) updateRacer(r, dt);
    if (state === "menu") {      // keep the demo camera between the pack
      player.speed = MAX * 0.62;
      player.x += (0 - player.x) * dt;
    }
    collide();
    const seg = findSegment(player.z);
    const pct = player.speed / MAX;
    skyOff = mod(skyOff + 0.0006 * seg.curve * pct, 1);
    hillOff = mod(hillOff + 0.0014 * seg.curve * pct, 1);
    campusOff = mod(campusOff + 0.0024 * seg.curve * pct, 1);
  }

  // --- Drawing -----------------------------------------------------------------
  function poly(x1, y1, x2, y2, x3, y3, x4, y4, c) {
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); ctx.fill();
  }
  function project(p, cx, cy, cz) {
    p.camera.x = -cx; p.camera.y = p.world.y - cy; p.camera.z = p.world.z - cz;
    p.screen.scale = CAM_DEPTH / p.camera.z;
    p.screen.x = Math.round(W / 2 + p.screen.scale * p.camera.x * W / 2);
    p.screen.y = Math.round(H / 2 - p.screen.scale * p.camera.y * H / 2);
    p.screen.w = Math.round(p.screen.scale * ROAD_W * W / 2);
  }
  const COL = {
    light: { road: "#76767a", grass: "#7ccb57", rumble: "#f2f2f2", lane: "#f7f7f7" },
    dark: { road: "#6e6e72", grass: "#6dbd49", rumble: "#d8433b", lane: null },
  };
  function drawSegment(seg, fog) {
    const a = seg.p1.screen, b = seg.p2.screen;
    const c = seg.dark ? COL.dark : COL.light;
    const r1 = a.w / 5, r2 = b.w / 5;
    ctx.fillStyle = c.grass; ctx.fillRect(0, b.y, W, a.y - b.y);
    poly(a.x - a.w - r1, a.y, a.x - a.w, a.y, b.x - b.w, b.y, b.x - b.w - r2, b.y, c.rumble);
    poly(a.x + a.w + r1, a.y, a.x + a.w, a.y, b.x + b.w, b.y, b.x + b.w + r2, b.y, c.rumble);
    if (seg.finish) {
      const n = 10;
      for (let i = 0; i < n; i++) {
        const xa = a.x - a.w + (2 * a.w * i) / n, xa2 = a.x - a.w + (2 * a.w * (i + 1)) / n;
        const xb = b.x - b.w + (2 * b.w * i) / n, xb2 = b.x - b.w + (2 * b.w * (i + 1)) / n;
        poly(xa, a.y, xa2, a.y, xb2, b.y, xb, b.y, (i + seg.index) % 2 ? "#111" : "#f4f4f4");
      }
    } else {
      poly(a.x - a.w, a.y, a.x + a.w, a.y, b.x + b.w, b.y, b.x - b.w, b.y, c.road);
      if (c.lane) {
        const l1 = a.w / 26, l2 = b.w / 26;
        const lw1 = (a.w * 2) / LANES, lw2 = (b.w * 2) / LANES;
        let x1 = a.x - a.w + lw1, x2 = b.x - b.w + lw2;
        for (let l = 1; l < LANES; l++, x1 += lw1, x2 += lw2) poly(x1 - l1 / 2, a.y, x1 + l1 / 2, a.y, x2 + l2 / 2, b.y, x2 - l2 / 2, b.y, c.lane);
      }
    }
    if (fog < 1) { ctx.globalAlpha = 1 - fog; ctx.fillStyle = "#cdeeff"; ctx.fillRect(0, b.y, W, a.y - b.y); ctx.globalAlpha = 1; }
  }
  function drawSprite(img, scale, x, y, offX, offY, clipY, alpha = 1, flip = false, rot = 0) {
    const w = img.width * scale * (W / 2) * K, h = img.height * scale * (W / 2) * K;
    const dx = x + w * offX, dy = y + h * offY;
    const clipH = clipY ? Math.max(0, dy + h - clipY) : 0;
    if (clipH >= h || w < 1) return null;
    ctx.globalAlpha = alpha;
    if (flip || rot) {
      ctx.save(); ctx.translate(dx + w / 2, dy + h); ctx.rotate(rot); if (flip) ctx.scale(-1, 1);
      ctx.drawImage(img, -w / 2, -h, w, h); ctx.restore();
    } else {
      ctx.drawImage(img, 0, 0, img.width, img.height - (img.height * clipH) / h, dx, dy, w, h - clipH);
    }
    ctx.globalAlpha = 1;
    return { x: dx, y: dy, w, h };
  }
  function text(str, x, y, size, color, align = "left", outline = "#14110e") {
    ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = "top";
    ctx.fillStyle = outline;
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) ctx.fillText(str, x + ox, y + oy);
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }
  function layer(img, off, y) {
    const sx = Math.floor(img.width * off);
    const w1 = Math.min(W, img.width - sx);
    ctx.drawImage(img, sx, 0, w1, img.height, 0, y, w1, img.height);
    if (w1 < W) ctx.drawImage(img, 0, 0, W - w1, img.height, w1, y, W - w1, img.height);
  }
  function racerSprite(r, scale, x, y, clip) {
    const flip = r.spin > 0 && Math.floor(clock * 14) % 2 === 1;
    const rot = r.spin > 0 ? Math.sin(clock * 30) * 0.25 : r.isPlayer ? (keys.left ? -0.06 : keys.right ? 0.06 : 0) : 0;
    const bounce = r.speed > MAX * 0.2 ? (Math.floor(clock * 12 + r.d.stats[1]) % 2) * scale * 900 : 0;
    const box = drawSprite(r.img, scale, x, y - bounce, -0.5, -1, clip, r.ghost > 0 && !(r.isPlayer && state === "menu") ? 0.45 : 1, flip, rot);
    if (!box) return null;
    if (r.boost > 0) {
      const f = Math.floor(clock * 20) % 2;
      ctx.fillStyle = f ? "#ffd166" : "#ff7b2e";
      ctx.fillRect(box.x + box.w * 0.32, box.y + box.h * 0.86, box.w * 0.09, box.h * (0.12 + f * 0.08));
      ctx.fillRect(box.x + box.w * 0.6, box.y + box.h * 0.86, box.w * 0.09, box.h * (0.12 + (1 - f) * 0.08));
    }
    if (r.anomie > 0) ctx.drawImage(ICON.anom, box.x + box.w / 2 - 6, box.y - 14, 12, 12);
    return box;
  }

  // While racing, hide the blurred page behind the overlay: blurring it again
  // every frame is costly on slower machines.
  let live = false;
  function setLive(on) { if (on !== live) { live = on; document.documentElement.classList.toggle("kart-live", on); } }
  function render() {
    setLive(state === "race" || state === "count" || state === "finish");
    ctx.imageSmoothingEnabled = false;
    const sx = shake > 0 ? Math.round(rand(-2, 2)) : 0;
    ctx.save(); ctx.translate(sx, 0);
    const camPos = mod(player.z - PLAYER_Z, trackLength);
    const base = findSegment(camPos), basePct = (camPos % SEG) / SEG;
    const pSeg = findSegment(player.z), pPct = (player.z % SEG) / SEG;
    const playerY = lerp(pSeg.p1.world.y, pSeg.p2.world.y, pPct);
    ctx.drawImage(BG.sky, 0, 0);
    layer(BG.clouds, skyOff, 10);
    ctx.fillStyle = "#a6d98c"; ctx.fillRect(0, 148 + Math.round(playerY * -0.006), W, H);
    layer(BG.hills, hillOff, 150 - 100 + Math.round(playerY * -0.004));
    layer(BG.campus, campusOff, 150 - 70 + Math.round(playerY * -0.006));

    for (const s of segments) s.cars.length = 0;
    for (const r of racers) {
      if (r.isPlayer && state === "menu") continue;
      findSegment(r.z).cars.push(r);
    }
    const hz = hazards.map((h) => ({ h, seg: findSegment(h.dist) }));

    let maxy = H, x = 0, dx = -(base.curve * basePct);
    const N = segments.length;
    for (let n = 0; n < DRAW_DIST; n++) {
      const seg = segments[(base.index + n) % N];
      const looped = seg.index < base.index;
      seg.clip = maxy;
      seg.fog = 1 / Math.exp(((n / DRAW_DIST) ** 2) * FOG);
      const cz = camPos - (looped ? trackLength : 0);
      project(seg.p1, player.x * ROAD_W - x, playerY + CAM_H, cz);
      project(seg.p2, player.x * ROAD_W - x - dx, playerY + CAM_H, cz);
      x += dx; dx += seg.curve;
      if (seg.p1.camera.z <= CAM_DEPTH || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy) continue;
      drawSegment(seg, seg.fog);
      maxy = seg.p1.screen.y;
    }

    for (let n = DRAW_DIST - 1; n > 0; n--) {
      const seg = segments[(base.index + n) % N];
      const a = seg.p1.screen;
      if (!(seg.p1.camera.z > CAM_DEPTH)) continue;
      for (const sp of seg.sprites) {
        const sxp = a.x + a.scale * sp.offset * ROAD_W * W / 2;
        if (sp.kind === "box") {
          if (!sp.active) continue;
          const img = ART.box[Math.floor(clock * 8 + sp.offset * 3) & 3];
          drawSprite(img, a.scale, sxp, a.y - Math.sin(clock * 4 + sp.offset) * a.scale * 1600 - a.scale * 2400, -0.5, -1, seg.clip);
        } else if (sp.kind === "puddle") drawSprite(sp.img, a.scale, sxp, a.y, -0.5, -1, seg.clip);
        else drawSprite(sp.img, a.scale, sxp, a.y, sp.offset < 0 ? -1 : 0, -1, seg.clip);
      }
      for (const { h, seg: hs } of hz) if (hs === seg) drawSprite(ART.cage, a.scale, a.x + a.scale * h.x * ROAD_W * W / 2, a.y, -0.5, -1, seg.clip);
      for (const r of seg.cars) {
        if (r.isPlayer) continue;
        const p = (r.z % SEG) / SEG;
        const sc = lerp(seg.p1.screen.scale, seg.p2.screen.scale, p);
        const cx = lerp(seg.p1.screen.x, seg.p2.screen.x, p) + sc * r.x * ROAD_W * W / 2;
        const cy = lerp(seg.p1.screen.y, seg.p2.screen.y, p);
        const box = racerSprite(r, sc, cx, cy, seg.clip);
        if (box && box.w > 34 && box.y > 8) text(r.d.short.toUpperCase(), box.x + box.w / 2, box.y - 11, 8, "#fff", "center");
      }
      if (seg === pSeg && !(state === "menu")) {
        const sc = CAM_DEPTH / PLAYER_Z;
        const py = H / 2 - sc * lerp(pSeg.p1.camera.y, pSeg.p2.camera.y, pPct) * H / 2;
        racerSprite(player, sc, W / 2, Math.min(H - 2, py), 0);
      }
    }
    ctx.restore();
    hud();
  }

  const ordinal = (n) => n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");
  const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
  function hud() {
    if (state === "menu") return;
    const lap = clamp(Math.floor(player.dist / trackLength) + 1, 1, LAPS);
    text(`LAP ${lap}/${LAPS}`, 10, 8, 8, "#fff");
    text(fmt(raceT), 10, 20, 8, "#ffd166");
    // Standings
    standings().forEach((r, i) => {
      const y = 38 + i * 15;
      ctx.fillStyle = r.isPlayer ? "rgba(255,209,102,0.9)" : "rgba(20,17,14,0.55)";
      ctx.fillRect(8, y, 78, 13);
      ctx.drawImage(r.d.face, 9, y + 1, 11, 11);
      ctx.font = `400 8px ${FONT}`; ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillStyle = r.isPlayer ? "#1a1206" : "#f0efea";
      ctx.fillText(`${i + 1} ${r.d.short.slice(0, 8).toUpperCase()}`, 23, y + 3);
    });
    // Item slot
    ctx.fillStyle = "rgba(20,17,14,0.7)"; ctx.fillRect(W - 40, 8, 32, 32);
    ctx.strokeStyle = "#f0efea"; ctx.lineWidth = 2; ctx.strokeRect(W - 39, 9, 30, 30);
    if (player.item) {
      const k = player.rolling > 0 ? Object.keys(ITEMS)[Math.floor(clock * 14) % 5] : player.item;
      ctx.drawImage(ICON[k], W - 35, 13, 22, 22);
      if (player.rolling <= 0) text(ITEMS[player.item].name.toUpperCase(), W - 44, 14, 8, "#fff", "right");
      if (player.rolling <= 0) text(coarse ? "TAP ITEM" : "SPACE", W - 44, 26, 8, "#ffd166", "right");
    }
    // Position
    const p = rank(player);
    ctx.font = `700 32px ${FONT}`;
    const nw = ctx.measureText(String(p)).width;
    const px0 = W - 14 - 22 - nw;
    text(String(p), px0, H - 42, 32, p === 1 ? "#ffd166" : "#fff");
    text(ordinal(p).slice(-2).toUpperCase(), px0 + nw + 4, H - 40, 8, "#fff");
    text(`OF ${racers.length}`, px0 + nw + 4, H - 26, 8, "#c9c4b8");
    // Countdown lights
    if (state === "count") {
      const n = Math.ceil(countT - 0.4);
      ctx.fillStyle = "rgba(20,17,14,0.8)"; ctx.fillRect(W / 2 - 46, 40, 92, 30);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = 3 - i > n ? (n <= 0 ? "#3ddc84" : "#ff4d4d") : "#3a3530";
        ctx.fillRect(W / 2 - 36 + i * 26, 46, 18, 18);
      }
      if (n > 0 && n <= 3) text(String(n), W / 2, 84, 32, "#fff", "center");
    }
    if (msg) {
      text(msg.text.toUpperCase(), W / 2, 78, 16, "#ffd166", "center");
      if (msg.sub) text(msg.sub.toUpperCase(), W / 2, 100, 8, "#fff", "center");
    }
    if (paused) {
      ctx.fillStyle = "rgba(20,17,14,0.6)"; ctx.fillRect(0, 0, W, H);
      text("PAUSED", W / 2, H / 2 - 16, 16, "#ffd166", "center");
      text(coarse ? "TAP TO RESUME" : "PRESS P TO RESUME", W / 2, H / 2 + 6, 8, "#fff", "center");
    }
  }

  // --- Menus -------------------------------------------------------------------
  const list = menu.querySelector(".kart-drivers");
  const pick = { name: menu.querySelector('[data-k="name"]'), blurb: menu.querySelector('[data-k="blurb"]'), stats: menu.querySelector('[data-k="stats"]') };
  function renderMenu() {
    for (const b of list.children) b.setAttribute("aria-checked", String(b.dataset.key === chosen.key));
    pick.name.textContent = chosen.name;
    pick.blurb.textContent = chosen.blurb + (chosen.item ? ` Signature move: ${ITEMS[chosen.item].name.toLowerCase()}.` : "");
    pick.stats.innerHTML = ["Speed", "Acceleration", "Handling"].map((l, i) =>
      `<div><dt>${l}</dt><dd aria-label="${chosen.stats[i]} of 5">${"<i></i>".repeat(chosen.stats[i])}${"<i class=off></i>".repeat(5 - chosen.stats[i])}</dd></div>`).join("");
  }
  function buildMenu() {
    for (const d of DRIVERS) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "kart-driver"; b.dataset.key = d.key;
      b.setAttribute("role", "radio"); b.setAttribute("aria-label", d.name);
      const c = portrait(d); c.className = "kart-face";
      const s = document.createElement("span"); s.textContent = d.short;
      b.append(c, s);
      b.addEventListener("click", () => { chosen = d; renderMenu(); });
      b.addEventListener("dblclick", startRace);
      list.append(b);
    }
    list.addEventListener("keydown", (ev) => {
      const i = DRIVERS.indexOf(chosen);
      const cols = getComputedStyle(list).gridTemplateColumns.split(" ").length;
      const step = { ArrowRight: 1, ArrowDown: cols, ArrowLeft: -1, ArrowUp: -cols }[ev.key];
      if (step) { ev.preventDefault(); chosen = DRIVERS[mod(i + step, DRIVERS.length)]; renderMenu(); list.children[DRIVERS.indexOf(chosen)].focus(); }
      if (ev.key === "Enter" && ev.target.classList.contains("kart-driver")) { ev.preventDefault(); startRace(); }
    });
    renderMenu();
  }
  cab.querySelector('[data-act="race"]').addEventListener("click", startRace);
  cab.querySelector('[data-act="again"]').addEventListener("click", startRace);
  cab.querySelector('[data-act="menu"]').addEventListener("click", toMenu);

  const TITLES = ["Grand theorist", "Middle-range theorist", "Tenured", "Associate professor", "Assistant professor", "Adjunct", "Reviewer 2"];
  function showResults() {
    state = "done";
    cab.classList.remove("racing");
    // Rivals still on track get their position as it stands.
    const order = standings();
    const p = order.indexOf(player) + 1;
    results.querySelector('[data-k="place"]').textContent = p === 1 ? `You win! ${player.d.short} takes the cup` : `You finished ${ordinal(p)}`;
    const ol = results.querySelector(".kart-table");
    ol.innerHTML = "";
    order.forEach((r, i) => {
      const li = document.createElement("li");
      if (r.isPlayer) li.className = "you";
      const c = portrait(r.d); c.className = "kart-face";
      li.innerHTML = `<b>${i + 1}</b>`;
      li.append(c);
      li.insertAdjacentHTML("beforeend", `<span>${r.d.name}</span><em>${r.finished ? fmt(r.time) : "still racing"}</em><small>${TITLES[i]}</small>`);
      ol.append(li);
    });
    results.hidden = false;
    results.querySelector('[data-act="again"]').focus({ preventScroll: true });
  }

  // --- Loop --------------------------------------------------------------------
  let running = false, last = 0, acc = 0, ready = false;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!paused) {
      acc += dt;
      while (acc >= STEP) { update(STEP); acc -= STEP; }
    }
    render();
    requestAnimationFrame(frame);
  }
  function start() {
    if (running) return;
    running = true; last = performance.now(); acc = 0;
    requestAnimationFrame(frame);
  }
  function stop() { running = false; setLive(false); if (state === "race" || state === "count") paused = true; }

  let loading = null;
  function init() {
    if (!loading) loading = (async () => {
      try { await Promise.all([document.fonts.load(`400 8px ${FONT}`), document.fonts.load(`700 8px ${FONT}`)]); } catch (e) {}
      makeScenery(); makeIcons(); makeBackground();
      for (const d of DRIVERS) { d.img = kartArt(d); d.face = portrait(d); }
      buildTrack();
      buildMenu();
      setupDemo();
      ready = true;
    })();
    return loading;
  }
  sec.addEventListener("gameopen", () => init().then(start));
  sec.addEventListener("gameclose", stop);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); else if (!sec.hidden && ready) start(); });
  if (!sec.hidden) init().then(start);
})();
