/* =====================================================================
   adesso business consulting — Vibe Coding Challenge 2026
   1. Participant portal logic (team repositories, OS tabs, copy commands)
   2. Grid model + grid clock UI (simulated SAP Utilities demo data)
   3. "Grid Live" 3D scene (three.js r128, bundled locally in vendor/)
   ORGANIZER: Set data-repository-url on the three team links in index.html.
   Never place API keys, tokens, or sensitive data in public files.
   ===================================================================== */
"use strict";
(function () {
  const $ = (s) => document.querySelector(s);
  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const announce = (msg) => { const el = $("#live-announcement"); if (el) el.textContent = msg; };

  /* ================= 1. Participant portal ================= */
  // Only exact HTTPS github.com/owner/repository URLs are allowed.
  function validTeamRepo(input) {
    if (typeof input !== "string" || !input) return null;
    try {
      const url = new URL(input);
      if (url.origin !== "https://github.com" || url.username || url.password || url.search || url.hash) return null;
      if (!/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(url.pathname)) return null;
      return url.href;
    } catch (e) { return null; }
  }

  for (const link of document.querySelectorAll("[data-repo-link]")) {
    const team = link.dataset.repoLink;
    const status = document.querySelector('[data-team-status="' + team + '"]');
    const href = validTeamRepo(link.dataset.repositoryUrl);
    if (!status || !href) continue;
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.referrerPolicy = "no-referrer";
    link.removeAttribute("aria-disabled");
    link.removeAttribute("tabindex");
    link.classList.remove("is-disabled");
    link.querySelector("span").textContent = "Open repository";
    status.lastChild.textContent = " ACCESS REQUIRED";
    status.classList.add("is-ready");
  }

  const osTabs = Array.from(document.querySelectorAll("[data-tab]"));
  function switchOperatingSystem(os, focus) {
    for (const tab of osTabs) {
      const active = tab.dataset.tab === os;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    }
    for (const panel of document.querySelectorAll("[data-panel]")) panel.hidden = panel.dataset.panel !== os;
  }
  osTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => switchOperatingSystem(tab.dataset.tab, false));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? osTabs.length - 1 :
        (index + (event.key === "ArrowRight" ? 1 : -1) + osTabs.length) % osTabs.length;
      switchOperatingSystem(osTabs[next].dataset.tab, true);
    });
  });

  const commands = Object.freeze({
    windows: "winget install --id Git.Git -e\nwinget install OpenJS.NodeJS.LTS\n# CLOSE AND REOPEN POWERSHELL AFTER NODE.JS INSTALLATION\nnpm.cmd install --global opencode-ai\nopencode --version\n# If execution policy blocks opencode.ps1, use: opencode.cmd --version\nopencode",
    mac: "# Install Homebrew first if needed: https://brew.sh\nbrew install git node\nnpm install --global opencode-ai\nopencode --version\nopencode"
  });
  function selectCommands(os) {
    const pre = document.querySelector('[data-panel="' + os + '"] pre');
    if (!pre || !window.getSelection) return;
    const sel = window.getSelection(); sel.removeAllRanges();
    const range = document.createRange(); range.selectNodeContents(pre); sel.addRange(range);
  }
  for (const button of document.querySelectorAll("[data-copy]")) {
    button.addEventListener("click", () => {
      const os = button.dataset.copy;
      const data = commands[os];
      const fail = () => { selectCommands(os); announce("Copy unavailable. The commands are selected — press Ctrl+C or Cmd+C."); };
      if (!data || !navigator.clipboard || !navigator.clipboard.writeText) { fail(); return; }
      navigator.clipboard.writeText(data).then(() => {
        button.firstChild.textContent = "Copied ";
        announce("Setup commands copied.");
        setTimeout(() => { button.firstChild.textContent = "Copy commands "; }, 2400);
      }, fail);
    });
  }

  /* ================= 2. Grid model + clock ================= */
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const gauss = (x, m, s) => Math.exp(-((x - m) * (x - m)) / (2 * s * s));

  // Illustrative day profile in MW. store > 0 = battery charging, < 0 = discharging.
  function model(h) {
    const el = Math.sin((h - 6) / 12 * Math.PI);
    const pv = Math.pow(Math.max(0, el), 1.25) * 8.4;
    const wind = 2.2 + 0.9 * Math.sin(h * 0.5 + 1.2) + 0.35 * Math.sin(h * 1.6 + 0.4);
    const load = 3.4 + 1.3 * gauss(h, 7.5, 1.4) + 0.8 * gauss(h, 12.5, 2.5) + 2.8 * gauss(h, 19, 2.0) - 0.9 * gauss(h, 3.5, 2.2);
    const store = 2.0 * gauss(h, 12.8, 2.2) - 2.2 * gauss(h, 19.5, 1.8);
    return { el, pv, wind, load, store, net: pv + wind - load - store };
  }
  const mw = (v) => v.toFixed(1);
  const fmtT = (h) => { h = ((h % 24) + 24) % 24; const H = Math.floor(h), M = Math.floor((h - H) * 60); return String(H).padStart(2, "0") + ":" + String(M).padStart(2, "0"); };

  const CX = (h) => h / 24 * 480, CY = (v) => 110 - v / 9 * 98;
  (function drawChart() {
    let pv = "M0 110", wd = "", ld = "";
    for (let i = 0; i <= 96; i++) {
      const h = i / 4, m = model(h), x = CX(h).toFixed(1);
      pv += " L" + x + " " + CY(m.pv).toFixed(1);
      wd += (i ? " L" : "M") + x + " " + CY(m.wind).toFixed(1);
      ld += (i ? " L" : "M") + x + " " + CY(m.load).toFixed(1);
    }
    $("#c-pv").setAttribute("d", pv + " L480 110 Z");
    $("#c-wd").setAttribute("d", wd);
    $("#c-ld").setAttribute("d", ld);
  })();

  const now = new Date();
  let hour = now.getHours() + now.getMinutes() / 60;
  let playing = !reduce;
  const slider = $("#hour"), playBtn = $("#play");
  function syncPlay() {
    playBtn.setAttribute("aria-label", playing ? "Pause the grid clock" : "Play the grid clock");
    $("#ico-pause").hidden = !playing; $("#ico-play").hidden = playing;
  }
  syncPlay();
  playBtn.addEventListener("click", () => { playing = !playing; syncPlay(); });
  slider.addEventListener("input", () => { hour = parseFloat(slider.value); if (playing) { playing = false; syncPlay(); } });

  const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  const txt = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
  let lastMinute = -1, isNight = null;
  function updateUI(m) {
    const minute = Math.floor(hour * 60);
    if (minute === lastMinute) return;
    lastMinute = minute;
    txt("clock", fmtT(hour));
    if (document.activeElement !== slider) slider.value = hour.toFixed(2);
    slider.setAttribute("aria-valuetext", fmtT(hour));
    const x = CX(hour).toFixed(1), mk = $("#c-mk"), dot = $("#c-dot");
    mk.setAttribute("x1", x); mk.setAttribute("x2", x);
    dot.setAttribute("cx", x); dot.setAttribute("cy", CY(m.load).toFixed(1));
    const unit = "<small>MW</small>";
    set("r-pv", mw(m.pv) + unit);
    set("r-wind", mw(m.wind) + unit);
    set("r-load", mw(m.load) + unit);
    txt("r-store-l", Math.abs(m.store) < 0.1 ? "Storage" : m.store > 0 ? "Charging" : "Discharging");
    set("r-store", mw(Math.abs(m.store)) + unit);
    txt("r-ex-l", m.net >= 0 ? "Export" : "Import");
    set("r-ex", mw(Math.abs(m.net)) + unit);
    txt("t-pv", mw(m.pv) + " MW feed-in");
    txt("t-wind", mw(m.wind) + " MW feed-in");
    txt("t-store", Math.abs(m.store) < 0.1 ? "idle" : (m.store > 0 ? "charging " : "discharging ") + mw(Math.abs(m.store)) + " MW");
    txt("t-hub", (m.net >= 0 ? "Surplus +" : "Deficit −") + mw(Math.abs(m.net)) + " MW");
    txt("t-meter", mw(m.load) + " MW demand");
    txt("t-grid", (m.net >= 0 ? "Export " : "Import ") + mw(Math.abs(m.net)) + " MW");
    const night = m.el < 0.02;
    if (night !== isNight) { isNight = night; root.classList.toggle("night", night); root.classList.toggle("day", !night); }
  }

  let mx = 0, my = 0;
  window.addEventListener("pointermove", (e) => {
    mx = e.clientX / window.innerWidth * 2 - 1; my = e.clientY / window.innerHeight * 2 - 1;
    if (!reduce) { root.style.setProperty("--mx", mx.toFixed(3)); root.style.setProperty("--my", my.toFixed(3)); }
  }, { passive: true });

  let section = "hero", zone = null;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) section = e.target.dataset.cam;
  }, { rootMargin: "-45% 0px -45% 0px" });
  document.querySelectorAll("[data-cam]").forEach((s) => io.observe(s));
  document.querySelectorAll(".team-card").forEach((card) => {
    const on = () => { zone = card.dataset.zone; document.querySelectorAll(".team-card").forEach((o) => o.classList.toggle("is-focus", o === card)); };
    const off = () => { if (zone === card.dataset.zone) zone = null; card.classList.remove("is-focus"); };
    card.addEventListener("pointerenter", on); card.addEventListener("focusin", on);
    card.addEventListener("pointerleave", off); card.addEventListener("focusout", off);
  });

  /* ================= 3. Grid Live 3D scene ================= */
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  let tick = null;
  try {
    if (!window.THREE) throw new Error("three.js missing");
    tick = initScene();
  } catch (err) {
    root.classList.add("no-gl");
  }

  function initScene() {
    const T = window.THREE;
    const canvas = $("#scene");
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    const mobile = Math.min(window.innerWidth, window.innerHeight) < 600;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const scene = new T.Scene();
    scene.fog = new T.Fog(0xe6eaed, 200, 480);
    const camera = new T.PerspectiveCamera(30, 1, 0.5, 1500);
    const rand = mulberry32(20261012);
    const V = (x, y, z) => new T.Vector3(x, y, z);
    const std = (color, roughness, metalness) => new T.MeshStandardMaterial({ color, roughness, metalness: metalness || 0 });

    function tex(w, h, draw) {
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      draw(c.getContext("2d"), w, h);
      const t = new T.CanvasTexture(c); t.anisotropy = aniso; return t;
    }

    /* --- textures --- */
    const pvTex = tex(256, 160, (g, w, h) => {
      g.fillStyle = "#0e2241"; g.fillRect(0, 0, w, h);
      const sh = g.createLinearGradient(0, 0, w, h);
      sh.addColorStop(0, "rgba(140,180,235,.25)"); sh.addColorStop(.5, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(140,180,235,.14)");
      g.fillStyle = sh; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(160,195,240,.4)"; g.lineWidth = 1.5;
      for (let i = 1; i < 12; i++) { g.beginPath(); g.moveTo(i * w / 12, 0); g.lineTo(i * w / 12, h); g.stroke(); }
      for (let j = 1; j < 6; j++) { g.beginPath(); g.moveTo(0, j * h / 6); g.lineTo(w, j * h / 6); g.stroke(); }
      g.strokeStyle = "#cfd8df"; g.lineWidth = 10; g.strokeRect(0, 0, w, h);
    });
    const facadeDraw = (lit) => (g, w, h) => {
      g.fillStyle = lit ? "#000" : "#eef2f5"; g.fillRect(0, 0, w, h);
      const cols = 40, rows = 14, cw = w / cols, rh = h / rows;
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if (lit) {
          if (rand() < .4) continue;
          g.fillStyle = "rgba(255," + (165 + Math.floor(rand() * 70)) + "," + (80 + Math.floor(rand() * 80)) + "," + (.55 + rand() * .45).toFixed(2) + ")";
        } else g.fillStyle = "#7f91a2";
        g.fillRect(i * cw + 2, j * rh + 3, cw - 4, rh - 7);
      }
    };
    const facade = tex(512, 256, facadeDraw(false)), facadeLit = tex(512, 256, facadeDraw(true));
    facade.wrapS = facadeLit.wrapS = T.RepeatWrapping;
    const blockTex = facade.clone(), blockLit = facadeLit.clone();
    blockTex.needsUpdate = blockLit.needsUpdate = true;
    blockTex.repeat.set(.42, .3); blockLit.repeat.set(.42, .3);

    /* --- materials --- */
    const M = {
      white: std(0xf2f4f6, .86),
      white2: std(0xdde3e8, .9),
      plinth: std(0x13253a, .7),
      road: std(0xd0d7dd, .95),
      frame: std(0xc3ccd4, .45, .5),
      pv: new T.MeshStandardMaterial({ map: pvTex, roughness: .26, metalness: .35 }),
      dark: std(0x2a3846, .6),
      tower: new T.MeshStandardMaterial({ map: facade, emissiveMap: facadeLit, emissive: 0xffffff, emissiveIntensity: 0, roughness: .45, metalness: .05 }),
      block: new T.MeshStandardMaterial({ map: blockTex, emissiveMap: blockLit, emissive: 0xffffff, emissiveIntensity: 0, roughness: .5 }),
      water: new T.MeshStandardMaterial({ color: 0xa9bccb, roughness: .08, metalness: .3 }),
      tree: new T.MeshStandardMaterial({ color: 0xffffff, roughness: .92, flatShading: true }),
      accent: new T.MeshBasicMaterial({ color: 0xff5a1f }),
      pulse: new T.MeshBasicMaterial({ color: 0xff5a1f }),
      red: new T.MeshBasicMaterial({ color: 0xff2020 }),
      green: new T.MeshBasicMaterial({ color: 0x35d08a }),
      win: new T.MeshStandardMaterial({ color: 0x5b6977, emissive: 0xffb066, emissiveIntensity: 0, roughness: .35 }),
      win2: new T.MeshStandardMaterial({ color: 0x5b6977, emissive: 0xffdcae, emissiveIntensity: 0, roughness: .35 }),
      lamp: new T.MeshStandardMaterial({ color: 0xeef2f5, emissive: 0xffd7a0, emissiveIntensity: 0, roughness: .4 }),
      cable: new T.MeshBasicMaterial({ color: 0x0b1b2b }),
      line: new T.LineBasicMaterial({ color: 0x0b1b2b, transparent: true, opacity: .72 }),
      grid: new T.LineBasicMaterial({ color: 0x0b1b2b, transparent: true, opacity: .07 }),
      dash: new T.LineDashedMaterial({ color: 0x0b1b2b, dashSize: .45, gapSize: .32, transparent: true, opacity: .42 }),
      ghost: new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
    };
    function mesh(geo, mat, x, y, z, cast, recv, parent) {
      const m = new T.Mesh(geo, mat); m.position.set(x, y, z);
      m.castShadow = cast !== false; m.receiveShadow = recv !== false;
      (parent || scene).add(m); return m;
    }
    function segs(arr, mat, parent) {
      const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(arr, 3));
      const l = new T.LineSegments(g, mat); (parent || scene).add(l); return l;
    }
    function dashed(points, mat) {
      const l = new T.Line(new T.BufferGeometry().setFromPoints(points), mat || M.dash);
      l.computeLineDistances(); scene.add(l); return l;
    }

    /* --- sky dome --- */
    const skyU = { top: { value: new T.Color() }, horizon: { value: new T.Color() }, bottom: { value: new T.Color() } };
    const sky = new T.Mesh(new T.SphereGeometry(1000, 32, 16), new T.ShaderMaterial({
      uniforms: skyU, side: T.BackSide, depthWrite: false, fog: false,
      vertexShader: "varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vD; void main(){ float h = vD.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(clamp(h * 1.4, 0.0, 1.0), 0.65)) : mix(horizon, bottom, clamp(-h * 2.6, 0.0, 1.0)); gl_FragColor = vec4(c, 1.0); }"
    }));
    sky.renderOrder = -1; scene.add(sky);

    /* --- stars --- */
    const sp = [];
    for (let i = 0; i < 700; i++) { const th = rand() * Math.PI * 2, ph = rand() * Math.PI * .46; sp.push(Math.cos(th) * Math.sin(ph) * 600, Math.cos(ph) * 600, Math.sin(th) * Math.sin(ph) * 600); }
    const starGeo = new T.BufferGeometry(); starGeo.setAttribute("position", new T.Float32BufferAttribute(sp, 3));
    const starMat = new T.PointsMaterial({ color: 0xffffff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    const stars = new T.Points(starGeo, starMat); scene.add(stars);

    /* --- lights --- */
    const hemi = new T.HemisphereLight(0xffffff, 0x9aa6b2, .6); scene.add(hemi);
    const sun = new T.DirectionalLight(0xffffff, 1.1);
    sun.castShadow = true;
    const sm = mobile ? 1024 : 2048; sun.shadow.mapSize.set(sm, sm);
    Object.assign(sun.shadow.camera, { left: -54, right: 54, top: 54, bottom: -54, near: 1, far: 300 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
    scene.add(sun); scene.add(sun.target);
    const moon = new T.DirectionalLight(0x8199ff, 0); moon.position.set(-50, 70, -30); scene.add(moon);

    /* --- base: architectural model on a table --- */
    const SX = 64, SZ = 56;
    const base = mesh(new T.BoxGeometry(SX, 1.2, SZ), M.white, 0, -0.6, 0);
    mesh(new T.BoxGeometry(SX + 0.9, 1.8, SZ + 0.9), M.plinth, 0, -2.1, 0, true, false);
    const edges = new T.LineSegments(new T.EdgesGeometry(base.geometry), M.line); edges.position.copy(base.position); scene.add(edges);
    const gp = [];
    for (let x = -SX / 2 + 2; x < SX / 2; x += 2) gp.push(x, .02, -SZ / 2, x, .02, SZ / 2);
    for (let z = -SZ / 2 + 2; z < SZ / 2; z += 2) gp.push(-SX / 2, .02, z, SX / 2, .02, z);
    segs(gp, M.grid);
    const table = new T.Mesh(new T.PlaneGeometry(900, 900), new T.ShadowMaterial({ opacity: .14 }));
    table.rotation.x = -Math.PI / 2; table.position.y = -16; table.receiveShadow = true; scene.add(table);

    /* --- roads --- */
    mesh(new T.BoxGeometry(SX, .05, 2.4), M.road, 0, .03, 4.5, false, true);
    mesh(new T.BoxGeometry(2.4, .05, SZ), M.road, -6, .032, 0, false, true);
    dashed([V(-SX / 2, .07, 4.5), V(SX / 2, .07, 4.5)]);
    dashed([V(-6, .075, -SZ / 2), V(-6, .075, SZ / 2)]);

    /* --- SAP Utilities hub --- */
    mesh(new T.BoxGeometry(10, .5, 10), M.white2, 0, .25, 0);
    mesh(new T.BoxGeometry(7, 3.2, 7), M.block, 0, 2.1, 0);
    mesh(new T.CylinderGeometry(2.6, 2.8, 10, 64), M.tower, 0, 8.7, 0);
    [6.2, 9.7, 13.2].forEach((y) => { const r = new T.Mesh(new T.TorusGeometry(2.72, .07, 8, 72), M.accent); r.rotation.x = Math.PI / 2; r.position.y = y; scene.add(r); });
    mesh(new T.CylinderGeometry(3.1, 3.1, .45, 64), M.white2, 0, 13.9, 0);
    mesh(new T.CylinderGeometry(.06, .06, 3.2, 8), M.dark, 0, 15.7, 0);
    const hubTip = mesh(new T.SphereGeometry(.14, 10, 8), M.red, 0, 17.35, 0, false, false);
    const ring1 = new T.Mesh(new T.TorusGeometry(4.3, .085, 8, 120), M.accent); ring1.position.y = 15.4; ring1.rotation.x = Math.PI / 2; scene.add(ring1);
    const ring2 = new T.Mesh(new T.TorusGeometry(5.1, .04, 6, 120), M.accent); ring2.position.y = 15.4; ring2.rotation.x = Math.PI / 2 + .25; scene.add(ring2);
    const beamMat = new T.MeshBasicMaterial({ color: 0xff6b2c, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
    const beam = new T.Mesh(new T.CylinderGeometry(.12, .9, 70, 20, 1, true), beamMat); beam.position.y = 50; scene.add(beam);
    const hubLight = new T.PointLight(0xff7a3c, 0, 18, 2); hubLight.position.set(0, 15, 0); scene.add(hubLight);
    const domeMat = new T.MeshBasicMaterial({ color: 0xff5a1f, wireframe: true, transparent: true, opacity: 0, depthWrite: false });
    const domeGeo = new T.SphereGeometry(9, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const dome = new T.Mesh(domeGeo, domeMat); scene.add(dome);
    const domeFillMat = new T.MeshBasicMaterial({ color: 0xff5a1f, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide });
    scene.add(new T.Mesh(domeGeo, domeFillMat));

    /* --- battery storage --- */
    mesh(new T.BoxGeometry(17.2, .16, 3.2), M.white2, 16.4, .08, -4.6);
    const storeLeds = [];
    for (let i = 0; i < 5; i++) {
      const x = 10 + i * 3.2;
      mesh(new T.BoxGeometry(2.8, 1.35, 1.25), M.white, x, .84, -4.6);
      mesh(new T.BoxGeometry(2.82, .1, 1.27), M.accent, x, 1.32, -4.6, false, false);
      const vp = [];
      for (let k = -4; k <= 4; k++) vp.push(x + k * .28, .3, -3.97, x + k * .28, 1.15, -3.97);
      segs(vp, M.line);
      storeLeds.push(mesh(new T.SphereGeometry(.07, 8, 6), M.green, x + 1.15, 1.15, -3.95, false, false));
    }
    mesh(new T.BoxGeometry(1.3, 1.5, 1.3), M.dark, 7.6, .75, -4.6);

    /* --- solar park --- */
    const COLS = 9, ROWS = 6, tilt = .42;
    const tablesMesh = new T.InstancedMesh(new T.BoxGeometry(2.4, .07, 1.5), [M.frame, M.frame, M.pv, M.frame, M.frame, M.frame], COLS * ROWS);
    const legsMesh = new T.InstancedMesh(new T.BoxGeometry(.07, 1, .07), M.frame, COLS * ROWS * 2);
    const d = new T.Object3D();
    let k = 0;
    for (let i = 0; i < COLS; i++) for (let j = 0; j < ROWS; j++) {
      const x = 9.6 + i * 2.55, z = -25 + j * 3.1;
      d.position.set(x, 1.05, z); d.rotation.set(tilt, 0, 0); d.scale.set(1, 1, 1); d.updateMatrix(); tablesMesh.setMatrixAt(k, d.matrix);
      [[.5, .84], [-.5, 1.26]].forEach((L, q) => {
        d.position.set(x, L[1] / 2, z + L[0]); d.rotation.set(0, 0, 0); d.scale.set(1, L[1], 1); d.updateMatrix(); legsMesh.setMatrixAt(k * 2 + q, d.matrix);
      });
      k++;
    }
    tablesMesh.castShadow = tablesMesh.receiveShadow = true; legsMesh.castShadow = true;
    scene.add(tablesMesh, legsMesh);
    const fence = [V(8, .55, -27), V(31.6, .55, -27), V(31.6, .55, -8.2), V(8, .55, -8.2), V(8, .55, -27)];
    dashed(fence);
    const postsN = 50, posts = new T.InstancedMesh(new T.CylinderGeometry(.04, .04, 1.1, 5), M.frame, postsN);
    const fenceCurve = new T.CurvePath(); for (let i = 0; i < 4; i++) fenceCurve.add(new T.LineCurve3(fence[i], fence[i + 1]));
    for (let i = 0; i < postsN; i++) { const p = fenceCurve.getPointAt(i / postsN); d.position.set(p.x, .55, p.z); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); d.updateMatrix(); posts.setMatrixAt(i, d.matrix); }
    scene.add(posts);
    mesh(new T.BoxGeometry(1.8, 1.4, 1.4), M.white, 6.4, .7, -17);
    mesh(new T.BoxGeometry(.5, .9, 1.42), M.dark, 5.7, .55, -17, false, true);

    /* --- wind farm --- */
    const bladeShape = new T.Shape();
    bladeShape.moveTo(-.16, 0); bladeShape.lineTo(.2, .1);
    bladeShape.quadraticCurveTo(.46, 1.2, .3, 2.2); bladeShape.lineTo(.09, 7.6); bladeShape.lineTo(-.04, 7.7);
    bladeShape.lineTo(-.14, 2.2); bladeShape.quadraticCurveTo(-.24, 1.0, -.16, 0);
    const bladeGeo = new T.ExtrudeGeometry(bladeShape, { depth: .07, bevelEnabled: false }); bladeGeo.translate(0, .55, -.035);
    const towerGeo = new T.CylinderGeometry(.24, .52, 16, 24); towerGeo.translate(0, 8, 0);
    const nacGeo = new T.BoxGeometry(.85, .85, 2.6);
    const spinGeo = new T.ConeGeometry(.42, 1.1, 20); spinGeo.rotateX(Math.PI / 2);
    const TURB = [[-27, -23], [-16, -25.4], [-5, -24.6], [-28, -11.5], [-18.5, -14.5]];
    const rotors = [], aviation = [];
    TURB.forEach(([x, z], i) => {
      const g = new T.Group(); g.position.set(x, 0, z); g.scale.setScalar(i === 4 ? .9 : 1); scene.add(g);
      mesh(new T.CylinderGeometry(1.1, 1.2, .25, 24), M.white2, 0, .125, 0, false, true, g);
      mesh(towerGeo, M.white, 0, 0, 0, true, true, g);
      const yaw = new T.Group(); yaw.position.y = 16; yaw.rotation.y = Math.PI / 4 + (rand() - .5) * .2; g.add(yaw);
      mesh(nacGeo, M.white, 0, .1, -.55, true, true, yaw);
      aviation.push(mesh(new T.SphereGeometry(.12, 8, 6), M.red, 0, .62, -1.5, false, false, yaw));
      const rotor = new T.Group(); rotor.position.set(0, .1, .95); rotor.rotation.z = rand() * 6; yaw.add(rotor);
      mesh(spinGeo, M.white, 0, 0, .45, true, false, rotor);
      for (let b = 0; b < 3; b++) { const bl = new T.Mesh(bladeGeo, M.white); bl.castShadow = true; bl.rotation.z = b * 2 * Math.PI / 3; rotor.add(bl); }
      rotors.push({ rotor, k: .9 + rand() * .25 });
    });
    mesh(new T.BoxGeometry(2.4, 1.6, 1.8), M.white, -13, .8, -19);
    mesh(new T.BoxGeometry(.9, 1.2, .9), M.dark, -11.3, .6, -19);

    /* --- lattice pylons + two-conductor lines --- */
    function latticeGeo(h, b, t, nseg, armY, armL) {
      const p = [], L = (a, c) => p.push(a[0], a[1], a[2], c[0], c[1], c[2]);
      const H = h * .92;
      const ring = (y) => { const w = b + (t - b) * (y / H); return [[-w, y, -w], [w, y, -w], [w, y, w], [-w, y, w]]; };
      let prev = ring(0);
      for (let i = 1; i <= nseg; i++) {
        const r = ring(H * i / nseg);
        for (let q = 0; q < 4; q++) { const q2 = (q + 1) % 4; L(prev[q], r[q]); L(r[q], r[q2]); L(prev[q], r[q2]); L(prev[q2], r[q]); }
        prev = r;
      }
      for (let q = 0; q < 4; q++) L(prev[q], [0, h, 0]);
      [armY, armY - 1.5].forEach((ay, idx) => {
        const al = idx === 0 ? armL : armL * .75, w = b + (t - b) * (ay / H);
        L([-al, ay, 0], [al, ay, 0]);
        L([-al, ay, 0], [-w, ay - .8, 0]); L([al, ay, 0], [w, ay - .8, 0]);
        L([-al, ay, 0], [-al, ay - .5, 0]); L([al, ay, 0], [al, ay - .5, 0]);
      });
      const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(p, 3)); return g;
    }
    const yawOf = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]);
    const obstacles = [];
    function pylon(x, z, h, yaw, armL) {
      const armY = h * .88, b = h * .085, t = h * .03;
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; scene.add(g);
      g.add(new T.LineSegments(latticeGeo(h, b, t, Math.max(4, Math.round(h / 1.1)), armY, armL), M.line));
      const gg = new T.CylinderGeometry(t * 1.41, b * 1.41, h * .92, 4, 1, true); gg.rotateY(Math.PI / 4); gg.translate(0, h * .46, 0);
      const ghost = new T.Mesh(gg, M.ghost); ghost.castShadow = true; g.add(ghost);
      const arm = new T.Mesh(new T.BoxGeometry(armL * 2, .1, .1), M.ghost); arm.position.y = armY; arm.castShadow = true; g.add(arm);
      obstacles.push([x, z]);
      return { p: V(x, armY - .5, z), yaw, arm: armL };
    }
    const end = (x, y, z, yaw) => ({ p: V(x, y, z), yaw, arm: .35 });
    const attach = (a, side) => V(a.p.x + Math.cos(a.yaw) * a.arm * side, a.p.y, a.p.z - Math.sin(a.yaw) * a.arm * side);
    function catenary(pts, sagK) {
      const out = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], dd = a.distanceTo(b);
        for (let s = 0; s < 18; s++) { const t = s / 18, q = a.clone().lerp(b, t); q.y -= sagK * 4 * t * (1 - t) * dd / 10; out.push(q); }
      }
      out.push(pts[pts.length - 1].clone());
      return new T.CatmullRomCurve3(out);
    }
    function powerLine(anchors, sagK) {
      const curves = [-1, 1].map((side) => catenary(anchors.map((a) => attach(a, side)), sagK));
      curves.forEach((c) => scene.add(new T.Mesh(new T.TubeGeometry(c, anchors.length * 40, .03, 5, false), M.cable)));
      return curves[0];
    }

    // Solar park → hub (distribution line)
    const S0 = [6.4, -16.2], P1 = [4.2, -10.5], H0 = [1.0, -3.6];
    const lSolar = powerLine([end(S0[0], 1.5, S0[1], yawOf(S0, P1)), pylon(P1[0], P1[1], 7, yawOf(S0, H0), 1.2), end(H0[0], 3.5, H0[1], yawOf(P1, H0))], .7);
    // Wind farm collector → hub
    const W0 = [-13, -18.1], P2 = [-8.2, -11], H1 = [-3.6, -1.0];
    const lWind = powerLine([end(W0[0], 1.5, W0[1], yawOf(W0, P2)), pylon(P2[0], P2[1], 7, yawOf(W0, H1), 1.2), end(H1[0], 3.5, H1[1], yawOf(P2, H1))], .7);
    // Hub → smart meter → homes
    const H2 = [1.0, 3.6], P3 = [3.6, 7.6], MT = [6.5, 12.3];
    const lLoad = powerLine([end(H2[0], 3.5, H2[1], yawOf(H2, P3)), pylon(P3[0], P3[1], 6.2, yawOf(H2, MT), 1.0), end(MT[0], 1.5, MT[1], yawOf(P3, MT))], .55);
    // Hub → high-voltage line → transmission grid
    const H3 = [3.6, 1.0], P4 = [12, 1.2], P5 = [22.5, 1.2], EX = [36.5, 1.2];
    const lGrid = powerLine([end(H3[0], 3.5, H3[1], yawOf(H3, P4)), pylon(P4[0], P4[1], 9.5, yawOf(H3, P5), 1.7), pylon(P5[0], P5[1], 9.5, yawOf(P4, EX), 1.7), end(EX[0], 7.6, EX[1], yawOf(P5, EX))], .9);
    // Battery ↔ hub (underground cable)
    const lStore = new T.CatmullRomCurve3([V(3.6, .08, -2.6), V(5.8, .08, -4.6), V(7.0, .08, -4.6)]);
    dashed(lStore.getPoints(30));
    // Turbines → collector (underground cables)
    const feeders = TURB.map(([x, z]) => {
      const c = new T.CatmullRomCurve3([V(x, .08, z), V((x - 13) / 2 + (rand() - .5) * 2, .08, (z - 19) / 2), V(-13, .08, -19)]);
      dashed(c.getPoints(40)); return c;
    });

    /* --- smart meter + homes --- */
    mesh(new T.BoxGeometry(.95, 1.45, .6), M.white, MT[0], .725, MT[1]);
    mesh(new T.BoxGeometry(.6, .4, .04), M.dark, MT[0], 1.05, MT[1] + .31, false, false);
    const meterLed = mesh(new T.SphereGeometry(.08, 8, 6), M.accent, MT[0] + .3, 1.32, MT[1] + .32, false, false);
    obstacles.push(MT, [-13, -19], [6.4, -17]);

    function houseGeo(w, hw, r, dep) {
      const s = new T.Shape();
      s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, hw); s.lineTo(0, hw + r); s.lineTo(-w / 2, hw); s.lineTo(-w / 2, 0);
      const g = new T.ExtrudeGeometry(s, { depth: dep, bevelEnabled: false }); g.translate(0, 0, -dep / 2); return g;
    }
    const hgA = houseGeo(2.3, 1.55, .95, 2.8), hgB = houseGeo(2.6, 2.4, 1.0, 3.2);
    const winGeo = new T.BoxGeometry(.4, .45, .06), roofPv = new T.BoxGeometry(1.2, .05, 2.2), chim = new T.BoxGeometry(.3, .7, .3);
    const homes = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
      if ((i === 0 && j === 0) || (i === 2 && j === 2) || (i === 4 && j === 4)) continue;
      const x = 10.2 + i * 4.4 + (rand() - .5) * .7, z = 9.4 + j * 4.0 + (rand() - .5) * .6;
      const big = rand() > .78;
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rand() > .5 ? 0 : Math.PI / 2; scene.add(g);
      mesh(big ? hgB : hgA, M.white, 0, 0, 0, true, true, g);
      const hw = big ? 2.4 : 1.55, dep = big ? 3.2 : 2.8, w = big ? 2.6 : 2.3, r = big ? 1.0 : .95;
      const wm = rand() > .4 ? M.win : M.win2;
      const rowsY = big ? [.75, 1.75] : [.8];
      rowsY.forEach((wy) => [-.55, .55].forEach((wx) => [1, -1].forEach((sd) => mesh(winGeo, rand() > .2 ? wm : M.win2, wx, wy, sd * (dep / 2 + .01), false, false, g))));
      if (rand() > .4) { const a = Math.atan2(r, w / 2); const pv = mesh(roofPv, M.pv, w / 4, hw + r / 2 + .05, 0, true, false, g); pv.rotation.z = -a; }
      mesh(chim, M.white2, -w / 4, hw + r * .55, dep / 4, true, false, g);
      homes.push(V(x, .08, z));
    }
    const branches = homes.filter((_, q) => q % 4 === 1).map((hp) => {
      const c = new T.CatmullRomCurve3([V(MT[0], .08, MT[1]), V(8.4, .08, (MT[1] + hp.z) / 2), V(hp.x - 1.4, .08, hp.z), hp]);
      dashed(c.getPoints(40)); return c;
    });

    /* --- pond --- */
    const pond = new T.Shape(); pond.absellipse(0, 0, 5.2, 3.3, 0, Math.PI * 2, false, 0);
    const pondGeo = new T.ShapeGeometry(pond, 48); pondGeo.rotateX(-Math.PI / 2);
    mesh(pondGeo, M.water, -17, .04, 14, false, true);
    const rim = new T.Line(new T.BufferGeometry().setFromPoints(pond.getPoints(64).map((p) => V(p.x - 17, .06, -p.y + 14))), M.line); scene.add(rim);

    /* --- street lamps --- */
    const lampPos = [];
    for (let x = -29; x <= 30; x += 5) if (Math.abs(x + 6) > 2.5) lampPos.push([x, 3.05]);
    for (let z = -26; z <= 26; z += 5) if (Math.abs(z - 4.5) > 3) lampPos.push([-7.45, z]);
    const lampPole = new T.InstancedMesh(new T.CylinderGeometry(.045, .06, 2.1, 6), M.white2, lampPos.length);
    const lampHead = new T.InstancedMesh(new T.BoxGeometry(.42, .1, .2), M.lamp, lampPos.length);
    lampPos.forEach(([x, z], q) => {
      d.position.set(x, 1.05, z); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); d.updateMatrix(); lampPole.setMatrixAt(q, d.matrix);
      d.position.set(x, 2.12, z); d.updateMatrix(); lampHead.setMatrixAt(q, d.matrix);
      obstacles.push([x, z]);
    });
    lampPole.castShadow = true; scene.add(lampPole, lampHead);

    /* --- trees (instanced, low-poly) --- */
    function free(x, z) {
      if (Math.abs(x) > 30.6 || Math.abs(z) > 26.6) return false;
      if (x > 5 && z < -7.4) return false;
      if (x > 6 && x < 26 && z > -7.4 && z < -1.8) return false;
      if (Math.abs(x) < 6.2 && Math.abs(z) < 6.2) return false;
      if (x > 7.6 && z > 6.8) return false;
      if (Math.abs(z - 4.5) < 2.3 || Math.abs(x + 6) < 2.1) return false;
      if (x > 2 && Math.abs(z - 1.2) < 2.2) return false;
      if ((x + 17) * (x + 17) / 46 + (z - 14) * (z - 14) / 20 < 1) return false;
      for (const [tx, tz] of TURB) if (Math.hypot(x - tx, z - tz) < 2.8) return false;
      for (const [ox, oz] of obstacles) if (Math.hypot(x - ox, z - oz) < 1.8) return false;
      return true;
    }
    const groves = [[-22, 21], [-27, 8], [-11, 23], [2, 21], [-1, -18], [-23, -3], [-13, 9]];
    const trees = [];
    let guard = 0;
    while (trees.length < 170 && guard++ < 6000) {
      let x, z;
      if (rand() < .72) { const c = groves[Math.floor(rand() * groves.length)]; const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 4.6; x = c[0] + Math.cos(a) * r; z = c[1] + Math.sin(a) * r; }
      else { x = (rand() - .5) * 62; z = (rand() - .5) * 54; }
      if (!free(x, z)) continue;
      if (trees.some((t) => Math.hypot(t[0] - x, t[1] - z) < 1.15)) continue;
      trees.push([x, z, .7 + rand() * .6, rand() < .55]);
    }
    const cones = trees.filter((t) => t[3]), rounds = trees.filter((t) => !t[3]);
    const coneMesh = new T.InstancedMesh(new T.ConeGeometry(.75, 2.2, 7), M.tree, cones.length);
    const roundMesh = new T.InstancedMesh(new T.IcosahedronGeometry(.9, 0), M.tree, rounds.length);
    const trunkMesh = new T.InstancedMesh(new T.CylinderGeometry(.07, .09, .7, 5), M.white2, trees.length);
    const tones = [new T.Color(0xf1f4f1), new T.Color(0xe1e9e3), new T.Color(0xd3dfd7)];
    cones.forEach((t, q) => { d.position.set(t[0], .5 + 1.1 * t[2], t[1]); d.rotation.set(0, rand() * 6, 0); d.scale.setScalar(t[2]); d.updateMatrix(); coneMesh.setMatrixAt(q, d.matrix); coneMesh.setColorAt(q, tones[q % 3]); });
    rounds.forEach((t, q) => { d.position.set(t[0], .55 + .85 * t[2], t[1]); d.rotation.set(rand(), rand() * 6, 0); d.scale.set(t[2], t[2] * 1.1, t[2]); d.updateMatrix(); roundMesh.setMatrixAt(q, d.matrix); roundMesh.setColorAt(q, tones[(q + 1) % 3]); });
    trees.forEach((t, q) => { d.position.set(t[0], .35, t[1]); d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.updateMatrix(); trunkMesh.setMatrixAt(q, d.matrix); });
    [coneMesh, roundMesh, trunkMesh].forEach((m) => { m.castShadow = true; m.receiveShadow = true; scene.add(m); });

    /* --- energy pulses --- */
    const glowTex = tex(64, 64, (g) => {
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(.22, "rgba(255,170,120,.9)"); r.addColorStop(1, "rgba(255,90,31,0)");
      g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    });
    const glowMat = new T.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
    const coreGeo = new T.SphereGeometry(.15, 12, 8);
    function flow(curve, count, size) {
      const items = [];
      for (let i = 0; i < count; i++) {
        const g = new T.Group(); g.add(new T.Mesh(coreGeo, M.pulse));
        const s = new T.Sprite(glowMat); s.scale.set(1.7, 1.7, 1); g.add(s);
        scene.add(g); items.push(g);
      }
      let off = rand();
      return function (dt, kk, dir) {
        const on = kk > .04;
        off += dt * (.03 + .1 * kk) * dir;
        for (let i = 0; i < count; i++) {
          const g = items[i]; g.visible = on; if (!on) continue;
          let u = (off + i / count) % 1; if (u < 0) u += 1;
          g.position.copy(curve.getPointAt(u)); g.scale.setScalar((size || 1) * (.55 + .75 * Math.sqrt(kk)));
        }
      };
    }
    const fSolar = flow(lSolar, 10), fWind = flow(lWind, 10), fLoad = flow(lLoad, 8), fGrid = flow(lGrid, 16, 1.15), fStore = flow(lStore, 5, .85);
    const fFeed = feeders.map((c) => flow(c, 4, .75)), fBranch = branches.map((c) => flow(c, 4, .75));

    /* --- post-processing (bloom after sunset) --- */
    let composer = null, bloom = null;
    try {
      if (T.EffectComposer && T.UnrealBloomPass && T.RenderPass) {
        let rt;
        if (renderer.capabilities.isWebGL2 && T.WebGLMultisampleRenderTarget) { rt = new T.WebGLMultisampleRenderTarget(4, 4, { format: T.RGBAFormat }); rt.samples = 4; }
        composer = new T.EffectComposer(renderer, rt);
        composer.addPass(new T.RenderPass(scene, camera));
        bloom = new T.UnrealBloomPass(new T.Vector2(4, 4), .9, .55, .62);
        composer.addPass(bloom);
      }
    } catch (e) { composer = null; }

    /* --- labels --- */
    const tagPos = { pv: V(20, 2.8, -17), wind: V(-16, 25.4, -25.4), store: V(16.4, 2.6, -4.6), hub: V(0, 18.4, 0), meter: V(MT[0], 2.3, MT[1]), grid: V(35.5, 8.4, 1.2) };
    const tags = Array.from(document.querySelectorAll(".tag")).map((el) => ({ el, p: tagPos[el.dataset.k] }));
    const tagsBox = $("#tags");

    /* --- camera rig --- */
    const CAM = {
      hero: { pos: [64, 54, 70], look: [0, 6.5, -4], off: .16 },
      teams: { pos: [66, 56, 72], look: [0, 5, 0], off: .17 },
      gen: { pos: [30, 24, 14], look: [-4, 6, -19], off: .22 },
      hub: { pos: [27, 17, 26], look: [5, 5, -2], off: .22 },
      cons: { pos: [44, 20, 44], look: [18, 1, 17], off: .22 },
      setup: { pos: [0.01, 124, 30], look: [0, 0, 3], off: 0 },
      security: { pos: [23, 15, 25], look: [0, 7, 0], off: .21 },
      faq: { pos: [2, 6, -4], look: [-17, 12, -23], off: -.2 },
      final: { pos: [80, 64, 84], look: [0, 0, 0], off: 0 }
    };
    const cur = { pos: V(90, 80, 95), look: V(0, 0, 0), off: .21 };
    const tgtP = V(), tgtL = V(), tmp = V(), rel = V();
    let W = 1, H = 1;
    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      renderer.setSize(W, H, false);
      camera.aspect = W / H; camera.fov = W < 760 ? 44 : 30; camera.updateProjectionMatrix();
      if (composer) composer.setSize(W, H);
    }
    resize();
    window.addEventListener("resize", resize);

    /* --- colour states --- */
    const C = (h) => new T.Color(h);
    const SKY = {
      day: { top: C(0xbcd0e2), horizon: C(0xeef1f3), bottom: C(0xe6eaed) },
      dusk: { top: C(0x8ea5c6), horizon: C(0xf3bf98), bottom: C(0xe3d3c7) },
      night: { top: C(0x02060d), horizon: C(0x0d1a2c), bottom: C(0x050a12) }
    };
    const inkDay = C(0x0b1b2b), inkNight = C(0x7f94ab), ink = C(0);
    const waterDay = C(0xa9bccb), waterNight = C(0x0e1b2c);
    const pulseDay = C(0xff5a1f), pulseNight = C(0xffb48a);
    let t = 0;

    return function (dt, m) {
      t += dt;
      const el = m.el, n = smooth(.14, -.1, el), day = 1 - n;
      const dw = clamp(1 - Math.abs(el) / .22, 0, 1) * .55 * (1 - n * .5);

      /* sky + light */
      ["top", "horizon", "bottom"].forEach((key) => { skyU[key].value.copy(SKY.day[key]).lerp(SKY.night[key], n).lerp(SKY.dusk[key], dw); });
      scene.fog.color.copy(skyU.bottom.value);
      const az = (hour - 6) / 12 * Math.PI;
      sun.position.set(Math.cos(az) * 90, Math.max(el, -.05) * 80 + 6, 40);
      sun.intensity = clamp(el * 2.4, 0, 1) * 1.1;
      sun.color.setRGB(1, .78 + .22 * clamp(el * 2, 0, 1), .62 + .38 * clamp(el * 2, 0, 1));
      moon.intensity = n * .42;
      hemi.intensity = .26 + .44 * day;
      hemi.color.setRGB(.4 + .6 * day, .48 + .52 * day, .66 + .34 * day);
      hemi.groundColor.setRGB(.05 + .55 * day, .08 + .57 * day, .13 + .57 * day);
      starMat.opacity = n * .9;

      ink.copy(inkDay).lerp(inkNight, n);
      M.line.color.copy(ink); M.cable.color.copy(ink); M.dash.color.copy(ink); M.grid.color.copy(ink);
      M.grid.opacity = .07 + .05 * n;
      M.water.color.copy(waterDay).lerp(waterNight, n);
      M.pulse.color.copy(pulseDay).lerp(pulseNight, n);
      M.tower.emissiveIntensity = n * 1.25; M.block.emissiveIntensity = n * 1.1;
      M.win.emissiveIntensity = n * 1.8; M.win2.emissiveIntensity = n * 1.25;
      M.lamp.emissiveIntensity = n * 2.4;
      hubLight.intensity = .1 + n * .7;
      beamMat.opacity = n * .16;
      glowMat.opacity = .18 + n * .82;
      const blink = Math.sin(t * 3.1) > .2;
      aviation.forEach((a) => { a.visible = n > .3 && blink; });
      hubTip.visible = blink;
      meterLed.visible = Math.sin(t * 6) > -.3;
      storeLeds.forEach((led, i) => { led.visible = Math.abs(m.store) < .1 || Math.sin(t * 4 + i) > -.2; });

      /* motion */
      rotors.forEach((r) => { r.rotor.rotation.z -= dt * (.35 + m.wind * .42) * r.k; });
      ring1.rotation.z += dt * .35; ring2.rotation.z -= dt * .22; ring2.rotation.x = Math.PI / 2 + .25 * Math.sin(t * .4);

      /* flows */
      fSolar(dt, m.pv / 8.4, 1);
      fWind(dt, m.wind / 3.4, 1);
      fFeed.forEach((f) => f(dt, m.wind / 3.4, 1));
      fStore(dt, Math.min(1, Math.abs(m.store) / 2.2), m.store >= 0 ? 1 : -1);
      fLoad(dt, m.load / 7, 1);
      fBranch.forEach((f) => f(dt, m.load / 7, 1));
      fGrid(dt, Math.min(1, Math.abs(m.net) / 6), m.net >= 0 ? 1 : -1);

      /* security dome */
      const sec = section === "security" ? .5 : 0;
      domeMat.opacity += (sec - domeMat.opacity) * Math.min(1, dt * 3);
      domeFillMat.opacity = domeMat.opacity * .14;
      dome.rotation.y += dt * .1;

      /* camera */
      const key = section === "teams" && zone ? zone : section;
      const c = CAM[key] || CAM.hero;
      const narrow = W < 900;
      const kk = reduce ? 1 : 1 - Math.exp(-dt * 2.0);
      tgtL.set(c.look[0], c.look[1], c.look[2]);
      tgtP.set(c.pos[0], c.pos[1], c.pos[2]);
      if (narrow && key !== "setup") tgtP.sub(tgtL).multiplyScalar(1.22).add(tgtL);
      cur.pos.lerp(tgtP, kk); cur.look.lerp(tgtL, kk);
      cur.off += ((narrow ? 0 : c.off) - cur.off) * kk;
      const swayA = reduce ? 0 : Math.sin(t * .08) * (key === "final" ? .3 : .07);
      rel.copy(cur.pos).sub(cur.look).applyAxisAngle(V(0, 1, 0), swayA);
      camera.position.copy(cur.look).add(rel);
      camera.position.x += mx * 2.2; camera.position.y -= my * 1.6;
      camera.lookAt(cur.look);
      camera.setViewOffset(W, H, -W * cur.off, 0, W, H);
      sky.position.copy(camera.position); stars.position.copy(camera.position);

      /* labels */
      const showTags = (section === "hero" || section === "teams") && !narrow;
      tagsBox.classList.toggle("is-on", showTags);
      if (showTags) {
        for (const tg of tags) {
          tmp.copy(tg.p).project(camera);
          const x = (tmp.x * .5 + .5) * W, y = (-tmp.y * .5 + .5) * H;
          tg.el.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
          tg.el.style.opacity = tmp.z < 1 && x > W * .44 ? "1" : "0";
        }
      }

      /* render — bloom only once the sun is down */
      if (composer && n > .03) {
        bloom.strength = .15 + n * .8; bloom.threshold = .62 + (1 - n) * .5; bloom.radius = .55;
        composer.render(dt);
      } else renderer.render(scene, camera);
    };
  }

  /* ================= main loop ================= */
  let last = performance.now();
  function loop(nowT) {
    const dt = Math.min(.05, (nowT - last) / 1000); last = nowT;
    if (playing) hour = (hour + dt / 1.6) % 24;
    const m = model(hour);
    updateUI(m);
    if (tick) {
      try { tick(dt, m); } catch (e) { tick = null; root.classList.add("no-gl"); }
    }
    requestAnimationFrame(loop);
  }
  updateUI(model(hour));
  requestAnimationFrame(loop);
})();
