/* Elo — interações da landing.
   Depende de gsap + ScrollTrigger + Lenis (globais via CDN) e de ./lightstream.js (WebGL). */

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
gsap.registerPlugin(ScrollTrigger);

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const desktop = matchMedia("(min-width: 1081px) and (pointer: fine)");
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fmt = (n) => Math.round(n).toLocaleString("pt-BR");

/* ---------- smooth scroll ---------- */
let lenis = null;
if (!reduce && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}

/* ---------- feixe de luz (WebGL) ---------- */
const canvas = $("#stream");
let stream = null;
const streamReady = import("./lightstream.js")
  .then((m) => {
    stream = m.initLightStream(canvas, { reducedMotion: reduce });
    if (!reduce) stream.setIntro(0);
  })
  .catch((err) => {
    console.warn("[elo] WebGL indisponível, usando fundo estático.", err);
    document.documentElement.classList.add("no-webgl");
    canvas.remove();
  });

// o feixe acompanha a página inteira: hero nítido, aurora suave no meio, faixa nítida nos preços.
// O progresso é remapeado por âncoras de seção para cada estado cair na seção certa.
let anchors = [];
const measureAnchors = () => {
  const top = (sel) => $(sel).getBoundingClientRect().top + scrollY;
  const max = document.documentElement.scrollHeight - innerHeight;
  anchors = [
    [0, 0],
    [$(".hero").offsetHeight * 0.75, 0.17],
    [top("#precos") - innerHeight * 0.6, 0.8],
    [top("#precos") + innerHeight * 0.15, 0.94],
    [max, 1],
  ];
};
const streamProgress = (y) => {
  for (let k = 1; k < anchors.length; k++) {
    const [y0, p0] = anchors[k - 1], [y1, p1] = anchors[k];
    if (y <= y1) return p0 + (p1 - p0) * Math.min(1, Math.max(0, (y - y0) / (y1 - y0 || 1)));
  }
  return 1;
};
ScrollTrigger.addEventListener("refresh", measureAnchors);
measureAnchors();
ScrollTrigger.create({
  start: 0,
  end: "max",
  onUpdate: () => stream?.setProgress(streamProgress(scrollY)),
});
addEventListener("pointermove", (e) => {
  stream?.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
}, { passive: true });

/* ---------- nav ---------- */
const nav = $("#nav");
const onScroll = () => nav.classList.toggle("is-scrolled", scrollY > 20);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

$("#burger").addEventListener("click", () => {
  const open = nav.classList.toggle("is-open");
  $("#burger").setAttribute("aria-expanded", open);
});

$$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
  const id = a.getAttribute("href");
  e.preventDefault();
  if (id === "#") return;
  const target = $(id);
  if (!target) return;
  nav.classList.remove("is-open");
  $("#burger").setAttribute("aria-expanded", "false");
  if (lenis) lenis.scrollTo(target, { offset: id === "#top" ? 0 : -60, duration: 1.4 });
  else target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
}));

/* ---------- preloader: anel conta e dobra pra dentro do logo ---------- */
async function intro() {
  const loader = $("#loader");
  const heroBits = $$("[data-intro]");
  const done = () => {
    loader.remove();
    document.body.classList.remove("is-loading");
    lenis?.start();
    ScrollTrigger.refresh();
  };

  // ?nointro pula o preloader (útil em testes e ao editar o site)
  if (reduce || new URLSearchParams(location.search).has("nointro")) {
    gsap.set(heroBits, { opacity: 1 });
    await streamReady;
    stream?.setIntro(1);
    done();
    return;
  }

  const arc = $(".loader__arc");
  const countEl = $("#loaderCount");
  const c = { v: 0 };
  const counting = gsap.to(c, {
    v: 100, duration: 1.7, ease: "power2.inOut",
    onUpdate() { countEl.textContent = Math.round(c.v); arc.style.strokeDashoffset = 100 - c.v; },
  });
  await Promise.all([
    counting.then(),
    document.fonts.ready,
    Promise.race([streamReady, new Promise((r) => setTimeout(r, 3500))]),
  ]);

  const mark = $("#loaderMark");
  const navMark = $("#navMark");
  const from = mark.getBoundingClientRect();
  const to = navMark.getBoundingClientRect();
  gsap.set(navMark, { opacity: 0 });

  const tl = gsap.timeline({ onComplete: done });
  tl.to(".loader__ring", { scale: 0.46, opacity: 0, duration: 0.55, ease: "power3.in" })
    .to(".loader__count", { opacity: 0, y: 8, duration: 0.3 }, 0)
    .to(mark, {
      x: to.left + to.width / 2 - (from.left + from.width / 2),
      y: to.top + to.height / 2 - (from.top + from.height / 2),
      scale: to.width / from.width,
      borderRadius: 28,
      boxShadow: "0 0 0px rgba(198,244,50,0)",
      duration: 1.05, ease: "expo.inOut",
    }, 0.35)
    .to(loader, { backgroundColor: "rgba(6,7,6,0)", duration: 0.7, ease: "power2.out" }, 0.75)
    .add(() => stream?.setIntro(1), 0.7)
    .fromTo(heroBits, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.08, ease: "expo.out" }, 0.95)
    .set(navMark, { opacity: 1 }, 1.4);
}

/* ---------- hero: janela de vidro inclinada + fluxo ao vivo ---------- */
function heroWindow() {
  const win = $("#heroWin");
  if (desktop.matches && !reduce) {
    gsap.set(win, { rotationY: -16, rotationX: 7 });
    const ry = gsap.quickTo(win, "rotationY", { duration: 1.2, ease: "power3.out" });
    const rx = gsap.quickTo(win, "rotationX", { duration: 1.2, ease: "power3.out" });
    $(".hero").addEventListener("pointermove", (e) => {
      const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
      ry(-16 + x * 10);
      rx(7 - y * 8);
    });
    gsap.to(win, {
      y: -70, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
    });
  }

  if (reduce) return;
  const pulses = Object.fromEntries($$(".edge-pulse").map((p) => { p.setAttribute("pathLength", "1"); return [p.dataset.edge, p]; }));
  const node = (id) => $(`[data-node="${id}"]`);
  const hot = (id, on) => () => node(id).classList.toggle("is-hot", on);
  const runs = $("#runs");
  let clock = 9 * 3600 + 41 * 60 + 12, order = 48213, sku = 2231, i = 0, active = false;

  function pushRun(yes) {
    clock += 20 + Math.floor(Math.random() * 90);
    const t = [clock / 3600, (clock / 60) % 60, clock % 60].map((n) => String(Math.floor(n)).padStart(2, "0")).join(":");
    const li = document.createElement("li");
    const label = yes ? `reposição sku ${sku++}` : `pedido #${++order}`;
    const ms = yes ? `${(1 + Math.random()).toFixed(1).replace(".", ",")} s` : `${160 + Math.floor(Math.random() * 120)} ms`;
    li.innerHTML = `<i class="dot"></i><span>${t}</span><span>${label}</span><span>${ms}</span>`;
    runs.prepend(li);
    gsap.from(li, { opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0, duration: 0.5, ease: "power3.out" });
    const extra = runs.children[3];
    if (extra) gsap.to(extra, { opacity: 0, duration: 0.3, onComplete: () => extra.remove() });
  }

  function pulse(id) {
    return gsap.fromTo(pulses[id], { strokeDashoffset: 0.18, opacity: 1 }, { strokeDashoffset: -1, duration: 0.75, ease: "power1.inOut", immediateRender: false });
  }

  function cycle() {
    if (!active) return;
    const yes = i++ % 2 === 1;
    const end = yes ? "n3" : "n4";
    gsap.timeline({ onComplete: () => gsap.delayedCall(0.7, cycle) })
      .call(hot("n1", true))
      .add(pulse("e1"), 0.35)
      .call(hot("n1", false), null, 0.75)
      .call(hot("n2", true), null, 0.95)
      .add(pulse(yes ? "e2" : "e3"), 1.45)
      .call(hot("n2", false), null, 1.9)
      .call(hot(end, true), null, 2.1)
      .call(() => pushRun(yes), null, 2.2)
      .call(hot(end, false), null, 3.1);
  }

  ScrollTrigger.create({
    trigger: ".hero", start: "top bottom", end: "bottom top",
    onToggle(self) { const was = active; active = self.isActive; if (active && !was) gsap.delayedCall(1.6, cycle); },
  });
}

/* ---------- reveal padrão ---------- */
function reveals() {
  if (reduce) { $$(".reveal").forEach((el) => el.classList.add("is-in")); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
  }), { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  $$(".reveal").forEach((el) => io.observe(el));
}

/* helper: roda enquanto a seção está na tela */
function whileVisible(trigger, onStart, onStop) {
  ScrollTrigger.create({ trigger, start: "top 85%", end: "bottom 10%", onToggle: (s) => (s.isActive ? onStart() : onStop?.()) });
}

/* ---------- 01: trace da execução ---------- */
function trace() {
  const rows = $$(".trace__row");
  const idEl = $("#traceId");
  let id = 52817;
  const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1.4, onRepeat: () => (idEl.textContent = ++id) });
  tl.call(() => rows.forEach((r) => r.classList.remove("is-done"))).set(".trace__row .bar i", { scaleX: 0 });
  rows.forEach((row, k) => {
    const bar = $(".bar i", row);
    const msEl = $(".ms", row);
    const ms = parseInt(msEl.textContent, 10);
    const o = { v: 0 };
    tl.to(bar, { scaleX: 1, duration: 0.25 + parseFloat(getComputedStyle(bar).getPropertyValue("--w")) * 1.6, ease: "power2.inOut" }, k === 0 ? 0.2 : ">-0.05")
      .fromTo(o, { v: 0 }, { v: ms, duration: 0.5, onUpdate: () => (msEl.textContent = `${Math.round(o.v)} ms`) }, "<")
      .call(() => row.classList.add("is-done"));
  });
  tl.to({}, { duration: 1.6 });
  if (reduce) { tl.progress(0.9).pause(); return; }
  whileVisible("#trace", () => tl.play(), () => tl.pause());
}

/* ---------- 02: aprovação no chat ---------- */
function chat() {
  const typing = $("#chatTyping"), msg = $("#chatMsg"), yes = $("#chatYes"), done = $("#chatDone"), cursor = $("#chatCursor"), card = $("#chat");
  if (reduce) { gsap.set(typing, { display: "none" }); gsap.set([msg, done], { opacity: 1 }); yes.classList.add("is-pressed"); return; }
  const target = () => {
    const c = card.getBoundingClientRect(), b = yes.getBoundingClientRect();
    return { left: b.left - c.left + b.width * 0.55, top: b.top - c.top + b.height * 0.6 };
  };
  const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.4 });
  tl.set(typing, { display: "inline-flex", opacity: 1 })
    .set([msg, done, cursor], { opacity: 0 })
    .set(cursor, { left: "82%", top: "92%" })
    .call(() => yes.classList.remove("is-pressed"))
    .to(typing, { opacity: 0, duration: 0.2 }, 1.4)
    .set(typing, { display: "none" })
    .fromTo(msg, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, ease: "expo.out" })
    .to(cursor, { opacity: 1, duration: 0.3 }, "+=0.5")
    .to(cursor, { left: () => target().left, top: () => target().top, duration: 0.9, ease: "power3.inOut" })
    .to(cursor, { scale: 0.85, duration: 0.1, yoyo: true, repeat: 1 })
    .call(() => yes.classList.add("is-pressed"))
    .to(done, { opacity: 1, duration: 0.4 }, "+=0.15")
    .to(cursor, { opacity: 0, duration: 0.4 }, "+=0.4")
    .to([msg], { opacity: 0, duration: 0.4 }, "+=1.8");
  tl.invalidate();
  whileVisible("#chat", () => tl.play(), () => tl.pause());
}

/* ---------- 03: barras isométricas ---------- */
function isoChart() {
  const svg = $("#isoChart");
  const NS = "http://www.w3.org/2000/svg";
  const days = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
  const vals = [0.62, 0.86, 0.48, 0.72, 0.94, 0.3, 0.16];
  const today = 4;
  const w = 24, d = 12, base = 176, max = 118;
  const bars = days.map((day, k) => {
    const cx = 52 + k * 76;
    const g = document.createElementNS(NS, "g");
    const faces = ["left", "right", "top"].map(() => g.appendChild(document.createElementNS(NS, "polygon")));
    const hot = k === today;
    faces[0].setAttribute("fill", hot ? "#6f8a17" : "#181a16");
    faces[1].setAttribute("fill", hot ? "#9cc21f" : "#262923");
    faces[2].setAttribute("fill", hot ? "#d8ff5a" : "#3a3e35");
    faces.forEach((f) => { f.setAttribute("stroke", hot ? "rgba(220,255,99,.5)" : "rgba(255,255,255,.06)"); f.setAttribute("stroke-width", ".8"); });
    const label = document.createElementNS(NS, "text");
    label.setAttribute("x", cx); label.setAttribute("y", base + 40); label.setAttribute("text-anchor", "middle");
    label.textContent = day;
    if (hot) label.classList.add("is-today");
    g.appendChild(label);
    svg.appendChild(g);
    const state = { h: 0 };
    const draw = () => {
      const h = Math.max(2, state.h), y = base - h;
      const pts = (a) => a.map((p) => p.join(",")).join(" ");
      faces[0].setAttribute("points", pts([[cx - w, y], [cx, y + d], [cx, base + d], [cx - w, base]]));
      faces[1].setAttribute("points", pts([[cx, y + d], [cx + w, y], [cx + w, base], [cx, base + d]]));
      faces[2].setAttribute("points", pts([[cx, y - d], [cx + w, y], [cx, y + d], [cx - w, y]]));
    };
    draw();
    return { state, draw, target: vals[k] * max };
  });
  const grow = () => bars.forEach((b, k) => gsap.to(b.state, { h: b.target, duration: 1.4, delay: k * 0.07, ease: "expo.out", onUpdate: b.draw }));
  if (reduce) { bars.forEach((b) => { b.state.h = b.target; b.draw(); }); return; }
  ScrollTrigger.create({ trigger: svg, start: "top 85%", once: true, onEnter: grow });
}

/* ---------- placa: abre a partir do logo, dobra de volta ---------- */
function plate() {
  const el = $("#plate");
  const text = $("#plateText");
  const words = text.textContent.trim().split(/\s+/);
  const serifFrom = words.indexOf("ninguém");
  text.innerHTML = words.map((w, k) => `<span class="w${k >= serifFrom ? " w--serif" : ""}">${w}</span>`).join(" ");
  const ws = $$(".w", text);
  const mark = $(".plate__mark", el);
  const eyebrow = $(".plate__eyebrow", el);

  const s = { open: 0 };
  const apply = () => {
    const W = el.offsetWidth, H = el.offsetHeight;
    const iy = ((H - 64) / 2) * (1 - s.open), ix = ((W - 64) / 2) * (1 - s.open);
    el.style.clipPath = `inset(${iy}px ${ix}px round ${18 + 16 * s.open}px)`;
  };
  apply();
  addEventListener("resize", apply);

  if (reduce) { s.open = 1; apply(); gsap.set(ws, { opacity: 1 }); gsap.set(mark, { y: el.offsetHeight * 0.3, backgroundColor: "#0b0d08", color: "#c6f432" }); return; }

  gsap.set(mark, { backgroundColor: "rgba(11,13,8,0)", color: "#0b0d08" });
  gsap.set([eyebrow, text], { opacity: 0 });
  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: { trigger: ".plate-track", start: "top top", end: "bottom bottom", scrub: 0.6 },
  });
  tl.to(s, { open: 1, duration: 3, ease: "power2.inOut", onUpdate: apply }, 0)
    .to(mark, { y: () => el.offsetHeight * 0.3, scale: 0.8, backgroundColor: "#0b0d08", color: "#c6f432", duration: 2.4, ease: "power2.inOut" }, 0.4)
    .to([eyebrow, text], { opacity: 1, duration: 0.8 }, 1.8)
    .to(ws, { opacity: 1, stagger: 0.18, duration: 0.5 }, 2.2)
    .to({}, { duration: 1.2 })
    .to([eyebrow, text], { opacity: 0, duration: 0.8 }, ">")
    .to(mark, { y: 0, scale: 1, backgroundColor: "rgba(11,13,8,0)", color: "#0b0d08", duration: 2.2, ease: "power2.inOut" }, "<0.2")
    .to(s, { open: 0, duration: 2.6, ease: "power2.inOut", onUpdate: apply }, "<0.2")
    .to(el, { opacity: 0, scale: 0.6, duration: 0.6 }, ">-0.1");
}

/* ---------- um só motor: rede com pacotes ---------- */
function network() {
  const svg = $("#net");
  const NS = "http://www.w3.org/2000/svg";
  const C = { x: 230, y: 92 };
  const apps = [
    { code: "SH", name: "shopify", x: 62, y: 44 },
    { code: "SL", name: "slack", x: 44, y: 150 },
    { code: "GS", name: "sheets", x: 160, y: 176 },
    { code: "PG", name: "postgres", x: 300, y: 176 },
    { code: "BL", name: "bling", x: 416, y: 150 },
    { code: "HS", name: "hubspot", x: 398, y: 44 },
  ];
  const mk = (tag, attrs, parent = svg) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
  apps.forEach((a) => mk("line", { x1: C.x, y1: C.y, x2: a.x, y2: a.y, class: "n-link" }));
  const pk = mk("g", {});
  apps.forEach((a) => {
    mk("circle", { cx: a.x, cy: a.y, r: 17, class: "n-circle" });
    const t = mk("text", { x: a.x, y: a.y + 3.5, "text-anchor": "middle", class: "n-code" }); t.textContent = a.code;
    const n = mk("text", { x: a.x, y: a.y + 32, "text-anchor": "middle" }); n.textContent = a.name;
  });
  const hub = mk("g", { transform: `translate(${C.x} ${C.y})` });
  const hubInner = mk("g", {}, hub);
  mk("rect", { x: -22, y: -22, width: 44, height: 44, rx: 12, fill: "#c6f432" }, hubInner);
  mk("use", { href: "#glyph", x: -14, y: -14, width: 28, height: 28, color: "#0b0d08" }, hubInner);

  if (reduce) return;
  let timer = null;
  const spawn = () => {
    const a = apps[Math.floor(Math.random() * apps.length)];
    const out = Math.random() < 0.5;
    const dot = mk("circle", { r: 3, class: "n-pkt", cx: out ? C.x : a.x, cy: out ? C.y : a.y }, pk);
    gsap.to(dot, {
      attr: { cx: out ? a.x : C.x, cy: out ? a.y : C.y }, duration: 1.1, ease: "power1.inOut",
      onComplete() {
        dot.remove();
        if (!out) gsap.fromTo(hubInner, { scale: 1.12, transformOrigin: "0 0" }, { scale: 1, duration: 0.5, ease: "expo.out" });
      },
    });
  };
  whileVisible(svg, () => { if (!timer) timer = setInterval(spawn, 380); }, () => { clearInterval(timer); timer = null; });
}

function regions() {
  const bars = $$("#regions .rbar i");
  const pcts = $$("#regions .pct");
  const go = () => {
    bars.forEach((b, k) => gsap.to(b, { width: `${b.dataset.v}%`, duration: 1.6, delay: k * 0.12, ease: "expo.out" }));
    pcts.forEach((p, k) => { const o = { v: 0 }; gsap.to(o, { v: +p.dataset.v, duration: 1.6, delay: k * 0.12, ease: "expo.out", onUpdate: () => (p.textContent = `${Math.round(o.v)}%`) }); });
  };
  if (reduce) { bars.forEach((b) => (b.style.width = `${b.dataset.v}%`)); pcts.forEach((p) => (p.textContent = `${p.dataset.v}%`)); return; }
  ScrollTrigger.create({ trigger: "#regions", start: "top 88%", once: true, onEnter: go });
}

/* ---------- painel do dia ---------- */
function dashboard() {
  // heatmap: últimos 7 dias, hoje (seg) por último; depois das 14h o que está na fila fica tracejado
  const heat = $("#heat");
  const days = ["ter", "qua", "qui", "sex", "sáb", "dom", "seg"];
  const hours = ["08", "10", "12", "14", "16", "18"];
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const cells = [];
  hours.forEach((h, r) => {
    heat.insertAdjacentHTML("beforeend", `<span>${h}</span>`);
    days.forEach((d, c) => {
      const weekend = c === 4 || c === 5;
      const v = weekend ? rnd() * 0.25 : 0.25 + rnd() * 0.75;
      const queued = c === 6 && r >= 3;
      const cell = document.createElement("span");
      cell.className = "cell";
      if (queued) cell.style.cssText = "background:transparent;border:1px dashed rgba(198,244,50,.45)";
      heat.appendChild(cell);
      if (!queued) cells.push({ cell, v });
    });
  });
  heat.insertAdjacentHTML("beforeend", `<span></span>${days.map((d, c) => `<span class="day${c === 6 ? " is-today" : ""}">${d}</span>`).join("")}`);
  const paint = (k) => cells.forEach(({ cell, v }) => (cell.style.background = `rgba(198,244,50,${(0.05 + v * 0.75 * k).toFixed(3)})`));

  const arc = $("#donutArc"), dv = $("#donutVal"), wn = $("#waitNum");
  const finish = () => { paint(1); arc.style.strokeDashoffset = 28; dv.textContent = 72; wn.textContent = 3; };
  if (reduce) { finish(); return; }

  paint(0);
  ScrollTrigger.create({
    trigger: "#dash", start: "top 70%", once: true,
    onEnter() {
      const o = { k: 0, d: 0, w: 0 };
      gsap.to(o, { k: 1, duration: 1.6, ease: "power2.out", onUpdate: () => paint(o.k) });
      gsap.to(o, { d: 72, duration: 1.8, delay: 0.2, ease: "expo.out", onUpdate: () => { arc.style.strokeDashoffset = 100 - o.d; dv.textContent = Math.round(o.d); } });
      gsap.to(o, { w: 3, duration: 1.2, delay: 0.4, ease: "steps(3)", onUpdate: () => (wn.textContent = Math.round(o.w)) });
    },
  });

  // "fora de foco" que assenta conforme o scroll
  $$("#dash .settle").forEach((el, k) => gsap.fromTo(el,
    { filter: "blur(14px)", opacity: 0.25, y: 40, scale: 0.97 },
    { filter: "blur(0px)", opacity: 1, y: 0, scale: 1, ease: "none",
      scrollTrigger: { trigger: el, start: `top ${96 - (k % 3) * 3}%`, end: "top 58%", scrub: 0.5 } }));

  // próxima execução, feed e dicas
  let next = 4;
  const nextEl = $("#nextRun");
  const feed = $("#feed");
  const events = ["NF-e 8842 emitida", "pedido #48231 conferido", "boleto 3310 compensado", "reposição 7732 enviada", "planilha de fechamento atualizada"];
  let ev = 0, tip = 0;
  const tips = $$("#tips p"), dots = $$("#tipsDots i");
  let timers = [];
  whileVisible("#dash", () => {
    if (timers.length) return;
    timers = [
      setInterval(() => { next = next <= 1 ? 4 : next - 1; nextEl.textContent = next; }, 2500),
      setInterval(() => {
        const li = document.createElement("li");
        li.innerHTML = `<i class="dot"></i>${events[ev++ % events.length]}`;
        feed.prepend(li);
        gsap.from(li, { opacity: 0, x: -10, duration: 0.5 });
        feed.children[3]?.remove();
      }, 3000),
      setInterval(() => {
        tips[tip].classList.remove("is-on"); dots[tip].classList.remove("is-on");
        tip = (tip + 1) % tips.length;
        tips[tip].classList.add("is-on"); dots[tip].classList.add("is-on");
      }, 4200),
    ];
  }, () => { timers.forEach(clearInterval); timers = []; });
}

/* ---------- números ---------- */
function proof() {
  const counts = $$(".count");
  const run = () => {
    counts.forEach((el) => { const o = { v: 0 }; gsap.to(o, { v: +el.dataset.to, duration: 2, ease: "expo.out", onUpdate: () => (el.textContent = fmt(o.v)) }); });
    gsap.to(".spark path", { strokeDashoffset: 0, duration: 2, ease: "power2.out" });
    const segs = $$(".segs i"), on = +$(".segs").dataset.on;
    segs.forEach((s, k) => k < on && gsap.delayedCall(0.3 + k * 0.08, () => s.classList.add("is-on")));
    gsap.to(".prog i", { width: "61%", duration: 1.8, delay: 0.2, ease: "expo.out" });
  };
  if (reduce) {
    counts.forEach((el) => (el.textContent = fmt(+el.dataset.to)));
    gsap.set(".spark path", { strokeDashoffset: 0 });
    $$(".segs i").forEach((s, k) => k < 11 && s.classList.add("is-on"));
    gsap.set(".prog i", { width: "61%" });
    return;
  }
  ScrollTrigger.create({ trigger: ".stats", start: "top 80%", once: true, onEnter: run });
}

/* ---------- medidor de preço arrastável ---------- */
function pricing() {
  const range = $("#runsRange"), fill = $("#rangeFill"), out = $("#runsOut");
  const nameEl = $("#planName"), priceEl = $("#planPrice"), inclEl = $("#planIncl");
  const cards = $$(".plan");
  const plans = [
    { name: "Essencial", price: 149, incl: 5000 },
    { name: "Equipe", price: 449, incl: 50000 },
    { name: "Escala", price: 1490, incl: 500000 },
  ];
  const MIN = 1000, MAX = 500000;
  const toRuns = (v) => {
    const r = MIN * Math.pow(MAX / MIN, v / 1000);
    const mag = Math.pow(10, Math.floor(Math.log10(r)) - 1);
    return Math.round(r / mag) * mag;
  };
  range.value = Math.round((1000 * Math.log(50000 / MIN)) / Math.log(MAX / MIN));
  let current = -1;
  const shown = { p: 449 };
  const update = () => {
    const v = +range.value, runs = toRuns(v);
    const pct = v / 10;
    fill.style.width = `${pct}%`;
    out.textContent = fmt(runs);
    out.style.left = `calc(${pct}% + ${(0.5 - pct / 100) * 22}px)`;
    range.setAttribute("aria-valuetext", `${fmt(runs)} execuções por mês`);
    const idx = runs <= 5000 ? 0 : runs <= 50000 ? 1 : 2;
    if (idx === current) return;
    current = idx;
    const p = plans[idx];
    nameEl.textContent = p.name;
    inclEl.textContent = `${fmt(p.incl)} execuções incluídas`;
    cards.forEach((c, k) => c.classList.toggle("is-active", k === idx));
    gsap.to(shown, { p: p.price, duration: reduce ? 0 : 0.6, ease: "power3.out", onUpdate: () => (priceEl.textContent = `R$ ${fmt(shown.p)}`) });
    if (!reduce) gsap.fromTo(priceEl, { filter: "blur(6px)", opacity: 0.4 }, { filter: "blur(0px)", opacity: 1, duration: 0.5 });
  };
  range.addEventListener("input", update);
  update();

  if (reduce) return;
  $$(".plan").forEach((el, k) => gsap.fromTo(el,
    { filter: "blur(12px)", opacity: 0.3, y: 50 },
    { filter: "blur(0px)", opacity: 1, y: 0, ease: "none",
      scrollTrigger: { trigger: ".plans", start: `top ${98 - k * 4}%`, end: "top 60%", scrub: 0.5 } }));
}

/* ---------- inscrição (sem backend) ---------- */
function signup() {
  const form = $("#signup"), input = $("#email"), msg = $("#signupMsg");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      msg.textContent = "Digite um e-mail válido, como nome@empresa.com.br.";
      input.focus();
      return;
    }
    // TODO: enviar para o backend / ferramenta de e-mail
    msg.textContent = `Pronto. O convite vai para ${v}.`;
    form.reset();
  });
}

/* ---------- boot ---------- */
heroWindow();
reveals();
trace();
chat();
isoChart();
plate();
network();
regions();
dashboard();
proof();
pricing();
signup();
intro();

// hooks de teste
window.__elo = { lenis, get stream() { return stream; }, ScrollTrigger, get anchors() { return anchors; }, streamProgress };
