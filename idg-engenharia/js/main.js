/* IDG Engenharia — interações da landing.
   Depende de gsap + ScrollTrigger + Lenis (globais via CDN), ./lightstream.js (feixe WebGL)
   e ./pointcloud.js (nuvem de pontos LS3D, carregada sob demanda). */

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
gsap.registerPlugin(ScrollTrigger);

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const desktop = matchMedia("(min-width: 1081px) and (pointer: fine)");
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fmt = (n) => Math.round(n).toLocaleString("pt-BR");
const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent?.appendChild(e);
  return e;
};

/* ---------- dados ---------- */
const PHASES = ["estudo", "projeto", "implantação", "operação"];
const SERVICES = [
  {
    code: "ENG", short: "Engenharia", tag: "projeto e campo", art: "eng", phases: [0, 1, 2],
    title: "Engenharia",
    desc: "Projetos multidisciplinares (civil, estrutural, mecânica, elétrica e de processos), do estudo conceitual ao detalhamento executivo, com acompanhamento técnico em campo durante a obra.",
    list: ["Estudos conceituais e de viabilidade", "Projeto básico e executivo", "Acompanhamento Técnico de Obras (ATO)", "As-built e documentação técnica"],
  },
  {
    code: "AER", short: "Aerofotogrametria", tag: "drones e mapeamento", art: "aer", phases: [0, 1, 2, 3],
    title: "Levantamentos aerofotogramétricos",
    desc: "Mapeamento com drones para gerar ortomosaicos, modelos digitais de terreno e de superfície e cálculos de volume com rapidez e segurança, inclusive em áreas de difícil acesso.",
    list: ["Ortomosaicos georreferenciados", "Modelos digitais de terreno e superfície", "Cálculo de volumes e cubagem", "Monitoramento do avanço de obra"],
  },
  {
    code: "TOP", short: "Topografia", tag: "precisão em campo", art: "top", phases: [0, 1, 2],
    title: "Levantamentos topográficos",
    desc: "Topografia de precisão para projeto, implantação e controle: da base cartográfica à locação e ao acompanhamento geométrico das estruturas.",
    list: ["Levantamento planialtimétrico e cadastral", "Locação de obras e gabaritos", "Controle geométrico e de recalques", "Georreferenciamento"],
  },
  {
    code: "GER", short: "Gerenciamento", tag: "prazo, custo e segurança", art: "ger", phases: [1, 2],
    title: "Gerenciamento de empreendimentos",
    desc: "Planejamento, controle e fiscalização de empreendimentos greenfield, brownfield e projetos correntes, com gestão de prazo, custo, qualidade, contratos e segurança no mesmo time.",
    list: ["Planejamento e controle de prazo e custo", "Fiscalização de obras e medições", "Gestão de contratos e interfaces", "Gestão de SSMA e qualidade"],
  },
  {
    code: "EPC", short: "EPC e EPCM", tag: "responsabilidade única", art: "epc", phases: [1, 2],
    title: "Fornecimento em regime EPC e EPCM",
    desc: "Engenharia, suprimentos e construção, ou a gestão da construção, sob responsabilidade única. Menos interfaces e mais previsibilidade para o investimento.",
    list: ["Engenharia de detalhamento", "Suprimentos e diligenciamento", "Construção ou gestão da construção", "Comissionamento e entrega"],
  },
  {
    code: "LS3D", short: "Escaneamento LS3D", tag: "laser scanning 3D", art: "ls3d", phases: [1, 3],
    title: "Escaneamento com tecnologia LS3D",
    desc: "Escaneamento a laser 3D que captura instalações existentes em nuvens de pontos de alta precisão: base confiável para as-built, retrofit e verificação de interferências.",
    list: ["Nuvem de pontos registrada", "Modelagem as-built", "Verificação de interferências", "Apoio a retrofit e ampliações"],
  },
  {
    code: "BIM", short: "BIM", tag: "engenharia digital", art: "bim", phases: [1, 2, 3],
    title: "Implementação da tecnologia BIM",
    desc: "Modelagem, compatibilização e implantação de processos BIM que integram disciplinas, antecipam conflitos e conectam o modelo ao planejamento da obra.",
    list: ["Modelagem BIM multidisciplinar", "Compatibilização e clash detection", "Planejamento 4D e quantitativos 5D", "Implantação de processos e capacitação"],
  },
  {
    code: "GEO", short: "Geologia e geotecnia", tag: "subsolo e taludes", art: "geo", phases: [0, 1, 2],
    title: "Serviços de geologia e geotecnia",
    desc: "Investigação e análise do subsolo para projetos seguros: sondagens, caracterização geológico-geotécnica, estabilidade de taludes e acompanhamento geotécnico em obra.",
    list: ["Programação e acompanhamento de sondagens", "Caracterização geológico-geotécnica", "Análises de estabilidade", "Instrumentação e monitoramento"],
  },
];

/* ---------- smooth scroll ---------- */
let lenis = null;
if (!reduce && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
const scrollToEl = (target, offset = -60) => {
  if (lenis) lenis.scrollTo(target, { offset, duration: 1.4 });
  else target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
};

/* ---------- feixe de luz (WebGL) ---------- */
const canvas = $("#stream");
let stream = null;
const streamReady = import("./lightstream.js")
  .then((m) => {
    stream = m.initLightStream(canvas, { reducedMotion: reduce });
    if (!reduce) stream.setIntro(0);
  })
  .catch((err) => {
    console.warn("[idg] WebGL indisponível, usando fundo estático.", err);
    document.documentElement.classList.add("no-webgl");
    canvas.remove();
  });

// hero nítido, aurora suave no meio, faixa nítida na cotação e no rodapé
let anchors = [];
const measureAnchors = () => {
  const top = (sel) => $(sel).getBoundingClientRect().top + scrollY;
  const max = document.documentElement.scrollHeight - innerHeight;
  anchors = [
    [0, 0],
    [$(".hero").offsetHeight * 0.75, 0.17],
    [top("#cotacao") - innerHeight * 0.6, 0.8],
    [top("#cotacao") + innerHeight * 0.15, 0.94],
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
ScrollTrigger.create({ start: 0, end: "max", onUpdate: () => stream?.setProgress(streamProgress(scrollY)) });
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
  const target = id.length > 1 && $(id);
  if (!target) return;
  nav.classList.remove("is-open");
  $("#burger").setAttribute("aria-expanded", "false");
  if (a.dataset.goSvc) selectService(+a.dataset.goSvc);
  scrollToEl(target, id === "#inicio" ? 0 : -60);
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
  await Promise.all([counting.then(), document.fonts.ready, Promise.race([streamReady, new Promise((r) => setTimeout(r, 3500))])]);

  const mark = $("#loaderMark"), navMark = $("#navMark");
  const from = mark.getBoundingClientRect(), to = navMark.getBoundingClientRect();
  gsap.set(navMark, { opacity: 0 });
  gsap.timeline({ onComplete: done })
    .to(".loader__ring", { scale: 0.46, opacity: 0, duration: 0.55, ease: "power3.in" })
    .to(".loader__count", { opacity: 0, y: 8, duration: 0.3 }, 0)
    .to(mark, {
      x: to.left + to.width / 2 - (from.left + from.width / 2),
      y: to.top + to.height / 2 - (from.top + from.height / 2),
      scale: to.width / from.width, borderRadius: 28, boxShadow: "0 0 0px rgba(245,157,0,0)",
      duration: 1.05, ease: "expo.inOut",
    }, 0.35)
    .to(loader, { backgroundColor: "rgba(5,9,19,0)", duration: 0.7, ease: "power2.out" }, 0.75)
    .add(() => stream?.setIntro(1), 0.7)
    .fromTo(heroBits, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.08, ease: "expo.out" }, 0.95)
    .set(navMark, { opacity: 1 }, 1.4);
}

/* ---------- hero: janela de vidro com o painel do empreendimento ---------- */
function heroWindow() {
  const win = $("#heroWin");
  if (desktop.matches && !reduce) {
    gsap.set(win, { rotationY: -16, rotationX: 7 });
    const ry = gsap.quickTo(win, "rotationY", { duration: 1.2, ease: "power3.out" });
    const rx = gsap.quickTo(win, "rotationX", { duration: 1.2, ease: "power3.out" });
    $(".hero").addEventListener("pointermove", (e) => {
      ry(-16 + (e.clientX / innerWidth - 0.5) * 10);
      rx(7 - (e.clientY / innerHeight - 0.5) * 8);
    });
    gsap.to(win, { y: -70, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
  }
  if (reduce) return;

  const pulses = Object.fromEntries($$(".edge-pulse").map((p) => { p.setAttribute("pathLength", "1"); return [p.dataset.edge, p]; }));
  const hot = (id, on) => () => $(`[data-node="${id}"]`).classList.toggle("is-hot", on);
  const runs = $("#runs");
  const frentes = ["frente 1", "frente 2", "frente 3", "frente 4"];
  const clashes = ["tubulação × viga", "eletrocalha × duto", "suporte × escada", "bandeja × estrutura"];
  let clock = 7 * 3600 + 42 * 60 + 10, i = 0, active = false;

  function pushRun(conflict) {
    clock += 60 + Math.floor(Math.random() * 400);
    const t = [clock / 3600, (clock / 60) % 60, clock % 60].map((n) => String(Math.floor(n)).padStart(2, "0")).join(":");
    const label = conflict ? `clash ${clashes[i % clashes.length]}` : `${frentes[i % frentes.length]} liberada`;
    const val = conflict ? "revisar" : "ok";
    const li = document.createElement("li");
    li.innerHTML = `<i class="dot"></i><span>${t}</span><span>${label}</span><span>${val}</span>`;
    runs.prepend(li);
    gsap.from(li, { opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0, duration: 0.5, ease: "power3.out" });
    const extra = runs.children[3];
    if (extra) gsap.to(extra, { opacity: 0, duration: 0.3, onComplete: () => extra.remove() });
  }
  const pulse = (id) => gsap.fromTo(pulses[id], { strokeDashoffset: 0.18, opacity: 1 }, { strokeDashoffset: -1, duration: 0.75, ease: "power1.inOut", immediateRender: false });

  function cycle() {
    if (!active) return;
    const conflict = i++ % 3 === 2;
    const end = conflict ? "n3" : "n4";
    gsap.timeline({ onComplete: () => gsap.delayedCall(0.7, cycle) })
      .call(hot("n1", true))
      .add(pulse("e1"), 0.35)
      .call(hot("n1", false), null, 0.75)
      .call(hot("n2", true), null, 0.95)
      .add(pulse(conflict ? "e2" : "e3"), 1.45)
      .call(hot("n2", false), null, 1.9)
      .call(hot(end, true), null, 2.1)
      .call(() => pushRun(conflict), null, 2.2)
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
function whileVisible(trigger, onStart, onStop) {
  ScrollTrigger.create({ trigger, start: "top 85%", end: "bottom 10%", onToggle: (s) => (s.isActive ? onStart() : onStop?.()) });
}

/* ---------- contadores ---------- */
function counters() {
  $$(".count").forEach((el) => {
    const to = +el.dataset.to;
    if (reduce) { el.textContent = fmt(to); return; }
    ScrollTrigger.create({
      trigger: el, start: "top 90%", once: true,
      onEnter() { const o = { v: 0 }; gsap.to(o, { v: to, duration: 2, ease: "expo.out", onUpdate: () => (el.textContent = fmt(o.v)) }); },
    });
  });
}

/* ---------- soluções: abas com desenho técnico ---------- */
const ART = {
  eng(g) {
    for (let k = 0; k < 6; k++) svgEl("path", { class: "a-line", d: `M${120 + k * 72} 190 V${70 + (k % 2) * 20}`, pathLength: 1 }, g);
    [70, 110, 150].forEach((y) => svgEl("path", { class: "a-line", d: `M110 ${y} H490`, pathLength: 1 }, g));
    svgEl("path", { class: "a-line", d: "M120 90 L192 150 M264 90 L336 150", pathLength: 1 }, g);
    svgEl("path", { class: "a-hot", d: "M110 205 H490 M110 199 V211 M490 199 V211", pathLength: 1 }, g);
    const t = svgEl("text", { class: "a-txt", x: 300, y: 222, "text-anchor": "middle" }, g); t.textContent = "36.000 mm";
  },
  aer(g) {
    let d = "M90 60";
    for (let k = 0; k < 6; k++) d += ` H510 v22 H90 v22`;
    svgEl("path", { class: "a-line", d: "M60 200 C160 150 240 210 330 170 S480 140 560 180", pathLength: 1 }, g);
    svgEl("path", { class: "a-hot", d: d.replace(/ v22 H90 v22$/, ""), pathLength: 1 }, g);
    for (let k = 0; k < 7; k++) svgEl("rect", { class: "a-fill", x: 120 + k * 52, y: 118, width: 40, height: 28 }, g);
    svgEl("circle", { class: "a-dot", cx: 510, cy: 60, r: 5 }, g);
  },
  top(g) {
    for (let k = 0; k < 7; k++) {
      const r = 26 + k * 20;
      svgEl("path", { class: k === 3 ? "a-hot" : "a-line", d: `M${300 - r * 1.6} 120 C ${300 - r * 1.6} ${120 - r * 0.9}, ${300 + r * 1.2} ${120 - r * 1.1}, ${300 + r * 1.7} ${120 - r * 0.2} S ${300 - r * 0.6} ${120 + r * 1.1}, ${300 - r * 1.6} 120`, pathLength: 1 }, g);
    }
    [[180, 96], [352, 70], [420, 150], [236, 168]].forEach(([x, y]) => { svgEl("circle", { class: "a-dot", cx: x, cy: y, r: 3.5 }, g); });
  },
  ger(g) {
    const rows = [[80, 140], [150, 170], [260, 150], [330, 190], [420, 110]];
    rows.forEach(([x, w], k) => {
      svgEl("path", { class: "a-line", d: `M70 ${50 + k * 32} H530`, pathLength: 1 }, g);
      svgEl("rect", { class: k === 3 ? "a-fill" : "a-fill", x, y: 42 + k * 32, width: w * 0.6, height: 14, rx: 4 }, g);
    });
    svgEl("path", { class: "a-hot", d: "M300 30 V200", pathLength: 1 }, g);
    const t = svgEl("text", { class: "a-txt", x: 306, y: 26 }, g); t.textContent = "hoje";
  },
  epc(g) {
    ["E", "P", "C"].forEach((l, k) => {
      svgEl("rect", { class: "a-fill", x: 110 + k * 150, y: 80, width: 90, height: 70, rx: 10 }, g);
      const t = svgEl("text", { class: "a-txt", x: 155 + k * 150, y: 121, "text-anchor": "middle", style: "font-size:18px;fill:#eef2fb" }, g); t.textContent = l;
      if (k < 2) svgEl("path", { class: "a-hot", d: `M${200 + k * 150} 115 H${260 + k * 150}`, pathLength: 1 }, g);
    });
    svgEl("path", { class: "a-line", d: "M90 60 H510 V170 H90 Z", pathLength: 1 }, g);
    const t = svgEl("text", { class: "a-txt", x: 96, y: 52 }, g); t.textContent = "responsabilidade única";
  },
  ls3d(g) {
    const ox = 110, oy = 180;
    for (let k = 0; k < 14; k++) {
      const a = -1.35 + k * 0.1, len = 330 + (k % 3) * 40;
      svgEl("path", { class: k === 7 ? "a-hot" : "a-line", d: `M${ox} ${oy} L${ox + Math.cos(a) * len} ${oy + Math.sin(a) * len * 0.55}`, pathLength: 1 }, g);
    }
    for (let k = 0; k < 90; k++) svgEl("circle", { class: "a-dot", cx: 300 + Math.random() * 220, cy: 50 + Math.random() * 130, r: 1.2, opacity: 0.4 + Math.random() * 0.6 }, g);
    svgEl("circle", { class: "a-dot", cx: ox, cy: oy, r: 6 }, g);
  },
  bim(g) {
    const box = (x, y, s) => `M${x} ${y} l${s} ${-s / 2} l${s} ${s / 2} l${-s} ${s / 2} Z M${x} ${y} v${s} l${s} ${s / 2} v${-s} M${x + 2 * s} ${y} v${s} l${-s} ${s / 2}`;
    [[200, 110, 50], [300, 60, 50], [300, 160, 50], [400, 110, 50]].forEach(([x, y, s], k) => svgEl("path", { class: k === 1 ? "a-hot" : "a-line", d: box(x - s, y - s / 2, s), pathLength: 1 }, g));
    const t = svgEl("text", { class: "a-txt", x: 300, y: 222, "text-anchor": "middle" }, g); t.textContent = "clash detection · 0 conflitos";
  },
  geo(g) {
    [70, 110, 150, 190].forEach((y, k) => svgEl("path", { class: "a-line", d: `M60 ${y} C 200 ${y - 14 + k * 3}, 380 ${y + 14}, 540 ${y - 6}`, pathLength: 1 }, g));
    svgEl("path", { class: "a-hot", d: "M300 30 V205", pathLength: 1 }, g);
    [70, 110, 150, 190].forEach((y, k) => { const t = svgEl("text", { class: "a-txt", x: 312, y: y - 4 }, g); t.textContent = `SPT ${8 + k * 9}`; });
    svgEl("rect", { class: "a-fill", x: 292, y: 20, width: 16, height: 10 }, g);
  },
};

let currentSvc = 0;
let selectService = () => {};
function services() {
  const tabs = $$("#svc [role=tab]");
  const panel = $("#p-svc"), art = $("#svcArt");
  const code = $("#svcCode"), title = $("#svcTitle"), desc = $("#svcDesc"), list = $("#svcList"), phases = $("#svcPhases");
  const content = $("#svcContent");

  const render = (k, animate) => {
    const s = SERVICES[k];
    code.textContent = `${s.code} · ${s.tag}`;
    title.textContent = s.title;
    desc.textContent = s.desc;
    list.innerHTML = s.list.map((li) => `<li><svg><use href="#i-check" /></svg>${li}</li>`).join("");
    phases.innerHTML = PHASES.map((p, j) => `<span class="${s.phases.includes(j) ? "is-on" : ""}">${p}</span>`).join("");
    art.innerHTML = "";
    const svg = svgEl("svg", { viewBox: "0 0 600 230", preserveAspectRatio: "xMidYMid meet" }, art);
    const g = svgEl("g", {}, svg);
    ART[s.art](g);
    if (animate && !reduce) {
      gsap.fromTo($$("[pathLength]", g), { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.2, stagger: 0.04, ease: "power2.inOut" });
      gsap.fromTo($$("rect, circle, text", g), { opacity: 0 }, { opacity: 1, duration: 0.6, stagger: 0.01, delay: 0.3 });
      gsap.fromTo(content, { opacity: 0, y: 14, filter: "blur(6px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.6, ease: "expo.out" });
    }
  };

  selectService = (k, focus = false) => {
    currentSvc = k;
    tabs.forEach((t, j) => {
      t.setAttribute("aria-selected", j === k);
      t.tabIndex = j === k ? 0 : -1;
    });
    panel.setAttribute("aria-labelledby", tabs[k].id);
    if (focus) tabs[k].focus();
    render(k, true);
  };
  tabs.forEach((t, k) => {
    t.addEventListener("click", () => selectService(k));
    t.addEventListener("keydown", (e) => {
      const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (d) { e.preventDefault(); selectService((currentSvc + d + tabs.length) % tabs.length, true); }
      if (e.key === "Home") { e.preventDefault(); selectService(0, true); }
      if (e.key === "End") { e.preventDefault(); selectService(tabs.length - 1, true); }
    });
  });
  $("#svcCta").addEventListener("click", () => setTimeout(() => togglePick(currentSvc, true), 300));
  render(0, false);
  ScrollTrigger.create({ trigger: "#svc", start: "top 75%", once: true, onEnter: () => render(currentSvc, true) });
}

/* ---------- método: cronograma ---------- */
function trace() {
  const rows = $$(".trace__row");
  const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1.6 });
  tl.call(() => rows.forEach((r) => r.classList.remove("is-done"))).set(".trace__row .bar i", { scaleX: 0 });
  rows.forEach((row, k) => {
    const bar = $(".bar i", row), pct = $(".ms", row);
    const to = parseInt(pct.textContent, 10);
    const o = { v: 0 };
    tl.to(bar, { scaleX: 1, duration: 0.5, ease: "power2.inOut" }, k === 0 ? 0.2 : ">-0.15")
      .fromTo(o, { v: 0 }, { v: to, duration: 0.5, onUpdate: () => (pct.textContent = `${Math.round(o.v)}%`) }, "<")
      .call(() => row.classList.add("is-done"));
  });
  tl.to({}, { duration: 2 });
  if (reduce) { tl.progress(0.95).pause(); return; }
  whileVisible("#trace", () => tl.play(), () => tl.pause());
}

/* ---------- tecnologia: aprovação de medição + nuvem de pontos ---------- */
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
    .to(msg, { opacity: 0, duration: 0.4 }, "+=1.8");
  whileVisible("#chat", () => tl.play(), () => tl.pause());
}

function pointCloud() {
  const card = $("#pcCard"), cv = $("#pcCanvas"), stage = $("#pcStage");
  let pc = null, loading = null, visible = false;
  const load = () => loading ??= import("./pointcloud.js")
    .then((m) => { pc = m.initPointCloud(cv, { reducedMotion: reduce }); pc.setActive(visible); })
    .catch((err) => { console.warn("[idg] nuvem de pontos indisponível.", err); card.classList.add("is-fallback"); });

  ScrollTrigger.create({ trigger: card, start: "top bottom+=400", once: true, onEnter: load });
  ScrollTrigger.create({
    trigger: card, start: "top bottom", end: "bottom top",
    onToggle: (s) => { visible = s.isActive; pc?.setActive(visible); },
    onUpdate: (s) => {
      pc?.setProgress(s.progress);
      stage.textContent = s.progress < 0.3 ? "nuvem de pontos" : s.progress < 0.68 ? "varredura LS3D" : "scan → modelo BIM";
    },
  });
  card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect();
    pc?.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
  });
}

/* ---------- placa: propósito abre a partir do logo ---------- */
function plate() {
  const el = $("#plate"), text = $("#plateText"), sign = $("#plateSign");
  const words = text.textContent.trim().split(/\s+/);
  const serifFrom = words.indexOf("conectando");
  text.innerHTML = words.map((w, k) => `<span class="w${k >= serifFrom ? " w--serif" : ""}">${w}</span>`).join(" ");
  const ws = $$(".w", text);
  const mark = $(".plate__mark", el), eyebrow = $(".plate__eyebrow", el);
  const s = { open: 0 };
  const apply = () => {
    const W = el.offsetWidth, H = el.offsetHeight;
    el.style.clipPath = `inset(${((H - 64) / 2) * (1 - s.open)}px ${((W - 64) / 2) * (1 - s.open)}px round ${18 + 16 * s.open}px)`;
  };
  apply();
  addEventListener("resize", apply);
  if (reduce) {
    s.open = 1; apply();
    gsap.set([ws, sign, eyebrow, text], { opacity: 1 });
    gsap.set(mark, { y: el.offsetHeight * 0.32, backgroundColor: "#0a1230", color: "#f59d00" });
    return;
  }
  gsap.set(mark, { backgroundColor: "rgba(10,18,48,0)", color: "#0a1230" });
  gsap.set([eyebrow, text], { opacity: 0 });
  gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: ".plate-track", start: "top top", end: "bottom bottom", scrub: 0.6 } })
    .to(s, { open: 1, duration: 3, ease: "power2.inOut", onUpdate: apply }, 0)
    .to(mark, { y: () => el.offsetHeight * 0.32, scale: 0.8, backgroundColor: "#0a1230", color: "#f59d00", duration: 2.4, ease: "power2.inOut" }, 0.4)
    .to([eyebrow, text], { opacity: 1, duration: 0.8 }, 1.8)
    .to(ws, { opacity: 1, stagger: 0.18, duration: 0.5 }, 2.2)
    .to(sign, { opacity: 1, duration: 0.6 }, ">")
    .to({}, { duration: 1.2 })
    .to([eyebrow, text, sign], { opacity: 0, duration: 0.8 }, ">")
    .to(mark, { y: 0, scale: 1, backgroundColor: "rgba(10,18,48,0)", color: "#0a1230", duration: 2.2, ease: "power2.inOut" }, "<0.2")
    .to(s, { open: 0, duration: 2.6, ease: "power2.inOut", onUpdate: apply }, "<0.2")
    .to(el, { opacity: 0, scale: 0.6, duration: 0.6 }, ">-0.1");
}

/* ---------- visão 2030 ---------- */
function vision() {
  const now = new Date();
  const k = Math.min(1, Math.max(0.03, (now.getFullYear() + now.getMonth() / 12 - 2026) / 4));
  const fill = $("#visionFill");
  if (reduce) { fill.style.width = `${k * 100}%`; return; }
  ScrollTrigger.create({ trigger: fill, start: "top 90%", once: true, onEnter: () => gsap.to(fill, { width: `${k * 100}%`, duration: 1.8, ease: "expo.out" }) });
}

/* ---------- onde estamos: mapa em pontos + rotas saindo da sede ---------- */
function map() {
  const svg = $("#map");
  // contorno aproximado do Brasil (lon, lat) — só para a malha de pontos
  const BR = [[-73.9,-7.3],[-70,-4.2],[-69.4,-1.2],[-69.8,1.7],[-67,2],[-64.8,2.5],[-63.4,3.9],[-61,4.5],[-60.7,5.2],[-59.9,4],[-59.6,1.8],[-58,1.5],[-56.5,1.9],[-55,2.5],[-54,2.2],[-52.9,2.2],[-51.6,4.2],[-50,1.8],[-50.2,0.2],[-49,-0.2],[-48.5,-1.4],[-47,-0.7],[-44.5,-2.5],[-42,-2.8],[-39,-3.3],[-37,-4.9],[-35.2,-5.2],[-34.8,-7.1],[-35,-8.1],[-35.7,-9.7],[-37,-11],[-38.5,-13],[-39,-15],[-39.2,-17.7],[-40,-19.5],[-40.3,-20.3],[-41,-21.9],[-42,-23],[-43.2,-23],[-44.7,-23.4],[-46.3,-24],[-48,-25.5],[-48.6,-27.5],[-49,-28.6],[-50.2,-30.5],[-51.2,-31.8],[-52.3,-32.9],[-53.4,-33.7],[-53.5,-32.5],[-55.8,-31],[-57.6,-30.2],[-56,-28],[-54.6,-25.6],[-54.3,-24],[-55.7,-22.5],[-57.8,-22.1],[-57.7,-19],[-58.2,-17.4],[-60.2,-16.3],[-60,-13.7],[-61.5,-13.5],[-63,-12.6],[-65,-11.8],[-65.3,-10],[-66.6,-9.9],[-68.6,-11],[-70.5,-11],[-70.6,-9.5],[-72.5,-9.5]];
  const P = ([lon, lat]) => [(lon + 75) * 9.6 + 8, (6 - lat) * 9.6 + 10];
  const poly = BR.map(P);
  const inside = (x, y) => {
    let c = false;
    for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
      const [xi, yi] = poly[a], [xj, yj] = poly[b];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const dots = svgEl("g", {}, svg);
  for (let y = 12; y < 396; y += 8) for (let x = 12; x < 396; x += 8) if (inside(x, y)) svgEl("circle", { class: "m-dot", cx: x, cy: y, r: 1.5 }, dots);

  const HQ = P([-43.94, -19.92]);
  const pins = [[-62.5, -4.5], [-52, -5.5], [-45.5, -4.8], [-39.5, -5.2], [-48, -10.5], [-56, -13], [-40.4, -20.3], [-47, -21.8], [-49.3, -25.2]].map(P);
  const links = svgEl("g", {}, svg), pk = svgEl("g", {}, svg);
  const paths = pins.map(([x, y]) => {
    const mx = (HQ[0] + x) / 2, my = Math.min(HQ[1], y) - 40;
    return svgEl("path", { class: "m-link", d: `M${HQ[0]} ${HQ[1]} Q${mx} ${my} ${x} ${y}` }, links);
  });
  // saída internacional
  const intl = svgEl("path", { class: "m-link", d: `M${HQ[0]} ${HQ[1]} Q 120 60 14 22` }, links);
  const lbl = svgEl("text", { class: "m-lbl", x: 16, y: 14 }, svg); lbl.textContent = "← clientes internacionais";
  paths.push(intl);
  pins.forEach(([x, y], k) => {
    const ring = svgEl("circle", { class: "m-ring", cx: x, cy: y, r: 4 }, svg);
    svgEl("circle", { class: "m-pin", cx: x, cy: y, r: 3.5 }, svg);
    if (!reduce) gsap.fromTo(ring, { attr: { r: 3.5 }, opacity: 0.9 }, { attr: { r: 12 }, opacity: 0, duration: 2.2, repeat: -1, delay: k * 0.25, ease: "power1.out" });
  });
  const hqRing = svgEl("circle", { class: "m-hq-ring", cx: HQ[0], cy: HQ[1], r: 9 }, svg);
  svgEl("circle", { class: "m-hq", cx: HQ[0], cy: HQ[1], r: 6 }, svg);
  const t = svgEl("text", { class: "m-lbl", x: HQ[0] - 14, y: HQ[1] + 18, "text-anchor": "end" }, svg); t.textContent = "sede · BH";
  if (reduce) return;
  gsap.fromTo(hqRing, { attr: { r: 7 }, opacity: 1 }, { attr: { r: 20 }, opacity: 0, duration: 2, repeat: -1, ease: "power1.out" });

  let timer = null;
  const spawn = () => {
    const path = paths[Math.floor(Math.random() * paths.length)];
    const len = path.getTotalLength();
    const out = Math.random() < 0.6;
    const dot = svgEl("circle", { class: "m-pkt", r: 2.6 }, pk);
    const o = { t: 0 };
    gsap.to(o, {
      t: 1, duration: 1.4, ease: "power1.inOut",
      onUpdate() { const p = path.getPointAtLength((out ? o.t : 1 - o.t) * len); dot.setAttribute("cx", p.x); dot.setAttribute("cy", p.y); },
      onComplete: () => dot.remove(),
    });
  };
  whileVisible(svg, () => { if (!timer) timer = setInterval(spawn, 320); }, () => { clearInterval(timer); timer = null; });
}

/* ---------- indicadores ---------- */
function dashboard() {
  // barras isométricas: avanço físico por frente
  const svg = $("#isoChart");
  const labels = ["F1", "F2", "F3", "F4", "F5", "F6"];
  const vals = [0.92, 0.74, 0.86, 0.41, 0.63, 0.22];
  const hotIdx = 2;
  const w = 26, d = 13, base = 172, max = 122;
  const bars = labels.map((lab, k) => {
    const cx = 62 + k * 88;
    const g = svgEl("g", {}, svg);
    const faces = [0, 1, 2].map(() => svgEl("polygon", {}, g));
    const hot = k === hotIdx;
    faces[0].setAttribute("fill", hot ? "#9a6200" : "#101830");
    faces[1].setAttribute("fill", hot ? "#c98000" : "#1a2544");
    faces[2].setAttribute("fill", hot ? "#ffb938" : "#2a3a66");
    faces.forEach((f) => { f.setAttribute("stroke", hot ? "rgba(255,185,56,.5)" : "rgba(255,255,255,.07)"); f.setAttribute("stroke-width", ".8"); });
    const tl = svgEl("text", { x: cx, y: base + 40, "text-anchor": "middle", class: hot ? "is-today" : "" }, g); tl.textContent = lab;
    const pct = svgEl("text", { x: cx, y: base - vals[k] * max - 22, "text-anchor": "middle", opacity: 0 }, g); pct.textContent = `${Math.round(vals[k] * 100)}%`;
    const state = { h: 0 };
    const draw = () => {
      const h = Math.max(2, state.h), y = base - h;
      const pts = (a) => a.map((p) => p.join(",")).join(" ");
      faces[0].setAttribute("points", pts([[cx - w, y], [cx, y + d], [cx, base + d], [cx - w, base]]));
      faces[1].setAttribute("points", pts([[cx, y + d], [cx + w, y], [cx + w, base], [cx, base + d]]));
      faces[2].setAttribute("points", pts([[cx, y - d], [cx + w, y], [cx, y + d], [cx - w, y]]));
    };
    draw();
    return { state, draw, pct, target: vals[k] * max };
  });

  const arc = $("#donutArc"), dv = $("#donutVal"), wn = $("#waitNum");
  const finish = () => { bars.forEach((b) => { b.state.h = b.target; b.draw(); b.pct.setAttribute("opacity", 1); }); arc.style.strokeDashoffset = 36; dv.textContent = 64; wn.textContent = 4; };
  if (reduce) { finish(); return; }
  ScrollTrigger.create({
    trigger: "#dash", start: "top 70%", once: true,
    onEnter() {
      bars.forEach((b, k) => gsap.to(b.state, { h: b.target, duration: 1.4, delay: k * 0.07, ease: "expo.out", onUpdate: b.draw, onComplete: () => gsap.to(b.pct, { attr: { opacity: 1 }, duration: 0.4 }) }));
      const o = { d: 0, w: 0 };
      gsap.to(o, { d: 64, duration: 1.8, delay: 0.2, ease: "expo.out", onUpdate: () => { arc.style.strokeDashoffset = 100 - o.d; dv.textContent = Math.round(o.d); } });
      gsap.to(o, { w: 4, duration: 1.2, delay: 0.4, ease: "steps(4)", onUpdate: () => (wn.textContent = Math.round(o.w)) });
    },
  });
  // chega fora de foco e assenta conforme o scroll
  $$("#dash .settle").forEach((el, k) => gsap.fromTo(el,
    { filter: "blur(14px)", opacity: 0.25, y: 40, scale: 0.97 },
    { filter: "blur(0px)", opacity: 1, y: 0, scale: 1, ease: "none", scrollTrigger: { trigger: el, start: `top ${96 - (k % 3) * 3}%`, end: "top 58%", scrub: 0.5 } }));

  let next = 40;
  const nextEl = $("#nextRun"), feed = $("#feed");
  const events = ["RDO frente 4 assinado", "ortomosaico da semana publicado", "clash elétrica × estrutura resolvido", "inspeção de andaimes registrada", "medição 12 enviada ao cliente"];
  let ev = 0, tip = 0, timers = [];
  const tips = $$("#tips p"), dots = $$("#tipsDots i");
  whileVisible("#dash", () => {
    if (timers.length) return;
    timers = [
      setInterval(() => { next = next <= 5 ? 40 : next - 5; nextEl.textContent = next; }, 2500),
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

/* ---------- certificações: assentam ao entrar ---------- */
function certs() {
  if (reduce) return;
  $$(".certs .cert").forEach((el, k) => gsap.fromTo(el,
    { filter: "blur(12px)", opacity: 0.2, y: 36 },
    { filter: "blur(0px)", opacity: 1, y: 0, ease: "none", scrollTrigger: { trigger: ".certs", start: `top ${98 - (k % 5) * 3}%`, end: "top 55%", scrub: 0.5 } }));
}

/* ---------- radar: carrossel ---------- */
function radar() {
  const track = $("#radarTrack");
  const step = () => (track.firstElementChild?.getBoundingClientRect().width || 300) + 18;
  $("#radarPrev").addEventListener("click", () => track.scrollBy({ left: -step(), behavior: reduce ? "auto" : "smooth" }));
  $("#radarNext").addEventListener("click", () => track.scrollBy({ left: step(), behavior: reduce ? "auto" : "smooth" }));
}

/* ---------- cotação: fase arrastável + soluções ---------- */
const SUGGEST = [[0, 2, 1, 7], [0, 6, 5, 2], [3, 4, 2, 1], [5, 6, 1, 0]];
const HINTS = [
  "Estudos, levantamentos e investigação de campo para decidir com segurança.",
  "Projeto multidisciplinar, BIM e as-built da instalação existente.",
  "Gerenciamento, EPC ou EPCM e controle de campo durante a obra.",
  "As-built, retrofit e monitoramento para a operação.",
];
const picked = new Set();
let togglePick = () => {};
function quote() {
  const range = $("#phaseRange"), fill = $("#rangeFill"), out = $("#phaseOut"), hint = $("#phaseHint"), count = $("#pickCount");
  const box = $("#picks");
  box.innerHTML = SERVICES.map((s, k) => `<button type="button" class="pick" aria-pressed="false" data-k="${k}">${s.short}</button>`).join("");
  const pills = $$(".pick", box);
  let phase = -1;
  const updateCount = () => { count.textContent = picked.size; };
  togglePick = (k, force) => {
    const on = force ?? !picked.has(k);
    on ? picked.add(k) : picked.delete(k);
    pills[k].setAttribute("aria-pressed", on);
    updateCount();
  };
  pills.forEach((p, k) => p.addEventListener("click", () => togglePick(k)));

  const update = () => {
    const v = +range.value;
    fill.style.width = `${v / 3}%`;
    const idx = Math.min(3, Math.round(v / 100));
    range.setAttribute("aria-valuetext", PHASES[idx]);
    if (idx === phase) return;
    phase = idx;
    out.textContent = PHASES[idx][0].toUpperCase() + PHASES[idx].slice(1);
    hint.textContent = HINTS[idx];
    pills.forEach((p, k) => p.classList.toggle("is-suggested", SUGGEST[idx].includes(k)));
    if (!reduce) gsap.fromTo(out, { filter: "blur(6px)", opacity: 0.4 }, { filter: "blur(0px)", opacity: 1, duration: 0.5 });
  };
  range.addEventListener("input", update);
  // solta no marco mais próximo
  range.addEventListener("change", () => {
    const snap = Math.round(+range.value / 100) * 100;
    if (reduce) { range.value = snap; update(); return; }
    const o = { v: +range.value };
    gsap.to(o, { v: snap, duration: 0.35, ease: "power2.out", onUpdate: () => { range.value = o.v; update(); } });
  });
  update();
  // começa com as sugestões da fase marcadas
  SUGGEST[phase].slice(0, 2).forEach((k) => togglePick(k, true));

  $("#quoteGo").addEventListener("click", () => {
    const names = [...picked].sort().map((k) => SERVICES[k].short);
    const msg = $("#msg");
    msg.value = `Fase do empreendimento: ${PHASES[phase]}.\nSoluções de interesse: ${names.length ? names.join(", ") : "a definir"}.\n\n`;
    setTimeout(() => msg.focus({ preventScroll: true }), 900);
  });
}

/* ---------- formulário de contato (sem backend) ---------- */
function contactForm() {
  const form = $("#contactForm"), msg = $("#formMsg");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = form.nome, email = form.email;
    const bad = [];
    nome.setAttribute("aria-invalid", !nome.value.trim());
    if (!nome.value.trim()) bad.push(nome);
    const okMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
    email.setAttribute("aria-invalid", !okMail);
    if (!okMail) bad.push(email);
    if (bad.length) {
      msg.classList.add("is-error");
      msg.textContent = !nome.value.trim() ? "Informe seu nome." : "Digite um e-mail válido, como nome@empresa.com.br.";
      bad[0].focus();
      return;
    }
    // TODO: enviar para o backend / CRM da IDG. Enquanto não houver integração,
    // o formulário não envia nada e avisa isso com clareza.
    msg.classList.remove("is-error");
    msg.textContent = "Versão de demonstração: a mensagem não foi enviada. Fale com a IDG pelo (31) 3285-1661 ou pelo WhatsApp.";
  });
}

/* ---------- boot ---------- */
heroWindow();
reveals();
counters();
services();
trace();
chat();
pointCloud();
plate();
vision();
map();
dashboard();
certs();
radar();
quote();
contactForm();
intro();

// hooks de teste
window.__idg = { lenis, get stream() { return stream; }, ScrollTrigger, get anchors() { return anchors; }, streamProgress, selectService: (k) => selectService(k) };
