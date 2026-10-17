/**
 * Promo del estreno: un recorrido calmo por las piezas del portfolio (nav, rueda, página de proyecto, visor, biblioteca),
 * armadas en DOM + canvas con la tipografía, el dither y los datos reales del sitio. Todo es función del tiempo:
 * `render(t)` deja el escenario en el segundo t (una llamada por cuadro). `AUDIO` es la lista de sonidos con su tiempo.
 *   ?f=v (1080×1920, default) | ?f=h (1920×1080) · ?render para grabar (sin interfaz).
 */
import { BAYER8, ditherField, ditherBar } from '/src/core/dither.js';
import { projects } from '/src/data/work.js';
import { library, kinds } from '/src/data/library.js';
import { accentOf } from '/src/data/accents.js';

const Q = new URLSearchParams(location.search);
const HZ = Q.get('f') === 'h';
const RENDER = Q.has('render');
const W = HZ ? 1920 : 1080;
const H = HZ ? 1080 : 1920;
export const DURATION = 20;
const FPS = 30;

document.documentElement.classList.toggle('h', HZ);
document.documentElement.classList.toggle('render', RENDER);
document.documentElement.style.setProperty('--W', `${W}px`);
document.documentElement.style.setProperty('--H', `${H}px`);

const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (k) => k * k * (3 - 2 * k);
const easeOut = (k) => 1 - (1 - k) ** 3;
const bayer = (x, y) => BAYER8[y & 7][x & 7];
const pad = (n) => String(n).padStart(2, '0');
const frac = (v) => v - Math.floor(v);

/* ───────────────────────── línea de tiempo ───────────────────────── */
const SCN = { idx: [0.7, 5.4], wheel: [6.45, 11.75], proj: [11.25, 15.8], lib: [15.35, 17.8], end: [17.45, 20] };
const op = (t, [a, b], fi = 0.45, fo = 0.45) => clamp((t - a) / fi) * clamp((b - t) / fo);
const CORT = { cover: [5.1, 5.55], hold: [5.55, 6.45], open: [6.45, 6.9] }; // cortina del sitio, con el caballo en el medio
const WHEEL = { t0: 7.1, dur: 0.95, steps: 5 };
const LIBW = { t0: 15.85, dur: 0.75, steps: 2 };
const SCROLL = [11.55, 14.7];
const T_CLICK = { cta: 5.0, ver: 11.2, img: 14.4 };
const T_LB = [14.5, 15.8];

/* ───────────────────────── datos ───────────────────────── */
const PW = projects.slice(0, 10);
const PROJ = projects.find((p) => p.slug === 'sin-datos');
const LIB = library.filter((e) => e.cover).slice(0, 8);
const TOTAL = projects.length;

const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(i); i.src = src; });

const gallery = (() => {
    const imgs = [PROJ.cover];
    for (const s of PROJ.sections) for (const im of s.images || []) if (im.h > im.w) imgs.push(im);
    return imgs.slice(0, 11);
})();
const allPieces = PROJ.sections.reduce((n, s) => n + (s.images?.length || 0), 0) + 1;

/* ───────────────────────── DOM ───────────────────────── */
const stage = document.getElementById('stage');
const wheelHTML = (cls, extra = '') => `
<section class="sc ${cls}">${extra}<div class="cards"></div>
    <div class="wt"><canvas></canvas><div class="no"></div><div class="nm"></div><div class="sb"></div></div>
    <div class="wn"></div><div class="wf"></div><div class="wf2"></div></section>`;

stage.innerHTML = `
<canvas class="field"></canvas>
<section class="sc a">
    <div class="ghost">MZ</div>
    <p class="p1">Soy Máximo, diseñador gráfico independiente de Argentina. Trabajo en identidad visual, dirección de arte y sistemas gráficos para marcas que tienen algo para decir y necesitan mostrarlo.</p>
    <canvas class="hero"></canvas>
    <div class="ht ht1">(MZZ.DSG)</div><div class="ht ht2">(2026)</div>
    <p class="p2">Acá están mis trabajos y, aparte, una biblioteca de lo que leo, escucho y miro: las referencias que me acompañan cuando diseño.</p>
    <ul class="menu"><li><sup>(15)</sup>Trabajos</li><li><sup>(18)</sup>Biblioteca</li><li><sup>(+)</sup>Sobre mí</li></ul>
    <div class="cta">Entrar a Trabajos ↗<i></i></div>
</section>
${wheelHTML('w')}
<section class="sc p"><div class="pi"><div class="no"></div><div class="nm"></div><p class="ds"></p><div class="rows"></div></div><div class="pg"></div></section>
${wheelHTML('l', '<div class="filters"><b>Todos<sup>18</sup></b><span>Libros</span><span>Álbumes</span><span>Videos</span><span>Galerías</span></div>')}
<section class="sc e"><canvas class="dt"></canvas><div class="title">(MZZ.DSG)</div><div class="online"><span></span><i></i></div></section>
<div class="lbx"><div class="im"></div><div class="im"></div><div class="ct"></div><div class="cl">Cerrar ✕</div></div>
<canvas class="wipe"></canvas>
<canvas class="horse" width="640" height="450"></canvas>
<header class="nav">
    <a class="logo">Máximo<br>Mazzuchin<sup>®</sup></a>
    <nav class="links"><a>Index</a><a>Trabajos<sup>15</sup></a><a>Biblioteca<sup>18</sup></a><a>Sobre mí</a></nav>
    <div class="tools"><span class="menu">Menú</span><svg class="spk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9h4l5-4v14l-5-4H3z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg><span>Oscuro</span></div>
</header>
<div class="cur"><canvas width="26" height="26"></canvas><span></span></div>`;

const $ = (s, r = stage) => r.querySelector(s);
const $$ = (s, r = stage) => [...r.querySelectorAll(s)];
const S = { a: $('.a'), w: $('.w'), p: $('.p'), l: $('.l'), e: $('.e') };

function widthAt100(text, cls = 'big', extra = '') {
    const s = document.createElement('span');
    s.className = cls;
    s.style.cssText = `position:absolute;visibility:hidden;font-size:100px;${extra}`;
    s.textContent = text;
    stage.append(s);
    const w = s.getBoundingClientRect().width;
    s.remove();
    return w;
}
const fitSize = (text, width) => (100 * width) / widthAt100(text);

/* ───────────────────────── canvas ───────────────────────── */
const field = $('.field');
const wipe = $('.wipe'); const WC = 8;
wipe.width = Math.ceil(W / WC); wipe.height = Math.ceil(H / WC);
const wipeCtx = wipe.getContext('2d'); const wipeImg = wipeCtx.createImageData(wipe.width, wipe.height);
function drawWipe(t) {
    const amt = t < CORT.cover[0] ? 0 : t < CORT.hold[0] ? (t - CORT.cover[0]) / (CORT.cover[1] - CORT.cover[0])
        : t < CORT.hold[1] ? 1 : t < CORT.open[1] ? 1 - (t - CORT.open[0]) / (CORT.open[1] - CORT.open[0]) : 0;
    const d = wipeImg.data;
    if (amt <= 0 || amt >= 1.0001) { const full = amt > 0; for (let i = 0; i < d.length; i += 4) { d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = full ? 255 : 0; } wipeCtx.putImageData(wipeImg, 0, 0); return; }
    for (let y = 0; y < wipe.height; y++) for (let x = 0; x < wipe.width; x++) {
        const i = (y * wipe.width + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = amt * 1.7 - (x / wipe.width) * 0.7 > bayer(x, y) ? 255 : 0;
    }
    wipeCtx.putImageData(wipeImg, 0, 0);
}
// Caballo de la cortina (sprite 5×2, alfa = brillo, en 1 bit con Bayer), centrado: 20 % del ancho en escritorio, 50 % en celular
const hCv = $('.horse'); const hCtx = hCv.getContext('2d'); const hImg = hCtx.createImageData(640, 450);
const hOff = document.createElement('canvas'); hOff.width = 640; hOff.height = 450;
const hOffCtx = hOff.getContext('2d', { willReadFrequently: true });
const HW = HZ ? 384 : 540;
Object.assign(hCv.style, { left: `${(W - HW) / 2}px`, top: `${(H - (HW * 450) / 640) / 2}px`, width: `${HW}px`, height: `${(HW * 450) / 640}px`, zIndex: 15 });
let HORSE_IMG;
function drawHorse(t) {
    const [a, b] = CORT.hold;
    if (t < a || t >= b) { hCv.style.display = 'none'; return; }
    hCv.style.display = 'block';
    const reveal = Math.min(clamp((t - a) / 0.22), clamp((b - 0.1 - t) / 0.2) + (t < b - 0.3 ? 1 : 0));
    const fi = Math.floor((t - a) * 16) % 10;
    hOffCtx.clearRect(0, 0, 640, 450);
    hOffCtx.drawImage(HORSE_IMG, (fi % 5) * 640, Math.floor(fi / 5) * 450, 640, 450, 0, 0, 640, 450);
    const src = hOffCtx.getImageData(0, 0, 640, 450).data; const o = hImg.data;
    for (let y = 0; y < 450; y++) for (let x = 0; x < 640; x++) {
        const i = (y * 640 + x) * 4;
        o[i] = o[i + 1] = o[i + 2] = 244; o[i + 3] = (src[i + 3] / 255) * Math.min(1, reveal) > bayer(x, y) ? 255 : 0;
    }
    hCtx.putImageData(hImg, 0, 0);
}

// Texto en dither: la máscara sale de elementos del DOM (misma fuente, tamaño y posición), se muestra según p (0..1)
const DC = 4;
function textMask(els, cw, ch) {
    const off = document.createElement('canvas'); off.width = cw; off.height = ch;
    const c = off.getContext('2d', { willReadFrequently: true });
    const sr = stage.getBoundingClientRect();
    c.fillStyle = '#fff'; c.textAlign = 'center';
    for (const el of els) {
        const cs = getComputedStyle(el); const fs = parseFloat(cs.fontSize);
        const r = el.getBoundingClientRect();
        const probe = document.createElement('span'); probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
        el.append(probe);
        const base = probe.getBoundingClientRect().top - sr.top; probe.remove();
        c.font = `800 ${fs / DC}px "Inter Tight"`;
        c.letterSpacing = `${(-0.045 * fs) / DC}px`;
        c.fillText(el.textContent, (r.left - sr.left + r.width / 2) / DC, base / DC);
    }
    const px = c.getImageData(0, 0, cw, ch).data;
    const m = new Uint8Array(cw * ch);
    for (let i = 0; i < m.length; i++) m[i] = px[i * 4 + 3] > 120 ? 1 : 0;
    return m;
}
function paintMask(cv, ctx, img, mask, p) {
    const d = img.data;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
        const i = (y * cv.width + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = 244; d[i + 3] = mask[y * cv.width + x] && p > bayer(x, y) ? 255 : 0;
    }
    ctx.putImageData(img, 0, 0);
}
const hero = $('.hero'); hero.width = Math.ceil(W / DC); hero.height = Math.ceil(H / DC);
const heroCtx = hero.getContext('2d'); const heroImg = heroCtx.createImageData(hero.width, hero.height);
const dt = $('.dt'); dt.width = Math.ceil(W / DC); dt.height = Math.ceil(H / DC);
const dtCtx = dt.getContext('2d'); const dtImg = dtCtx.createImageData(dt.width, dt.height);
let heroMask; let endMask;

// Cursor del sitio: disco de puntos en dither
const curEl = $('.cur'); const curLabel = $('span', curEl);
{
    const c = $('canvas', curEl).getContext('2d'); c.fillStyle = '#f4f4ef';
    for (let y = 0; y < 26; y++) for (let x = 0; x < 26; x++) {
        const r = Math.hypot(x - 12.5, y - 12.5) / 12.5;
        if (r < 1 && (1 - r) * 1.5 + 0.12 > bayer(x * 2, y * 2)) c.fillRect(x, y, 1, 1);
    }
}

/* ───────────────────────── rueda ───────────────────────── */
// Misma geometría que src/gl/wheel.js: las cartas siguen el arco de un círculo grande y se inclinan con su ángulo.
const geo = HZ
    ? { cw: 400, ch: 500, R: W * 0.9, step: 0.33, cy: H * 0.655 }
    : { cw: Math.min(W * 0.58, H * 0.36), ch: Math.min(W * 0.58, H * 0.36) * 1.25, R: W * 1.1, step: 0.4, cy: H * 0.55 };

function makeWheel(root, items, w, { square = false, count }) {
    const cards = $('.cards', root); const els = items.map((it) => {
        const e = document.createElement('div'); e.className = 'wc';
        e.style.backgroundImage = `url(${it.img})`;
        e.style.width = `${geo.cw}px`; e.style.height = `${square ? geo.cw : geo.ch}px`;
        cards.append(e); return e;
    });
    const ch = square ? geo.cw : geo.ch;
    const wt = $('.wt', root); const bar = $('canvas', wt); const no = $('.no', wt); const nm = $('.nm', wt); const sb = $('.sb', wt);
    const wn = $('.wn', root); const wf = $('.wf', root); const wf2 = $('.wf2', root);
    const cap = HZ ? 110 : 150;
    const sizes = items.map((it) => Math.min(cap, fitSize(it.name, W - 88 - (HZ ? 400 : 0))));
    wf2.innerHTML = `${w.cta || 'Ver proyecto ↗'}<i></i>`;
    let shown = -1;
    const pos = (t) => { const k = clamp((t - w.t0) / w.dur, 0, w.steps); const f = frac(k); return k >= w.steps ? [w.steps, 1, k] : [Math.floor(k) + ease(clamp(f / 0.6)), f, k]; };
    return {
        pos,
        update(t) {
            const [p, f, k] = pos(t);
            els.forEach((e, i) => {
                const d = i - p; const ad = Math.abs(d);
                if (ad > 3) { e.style.display = 'none'; return; }
                const phi = d * geo.step;
                const x = W / 2 + geo.R * Math.sin(phi); const y = geo.cy + geo.R * (1 - Math.cos(phi));
                e.style.display = 'block';
                e.style.opacity = 1 - clamp(ad - 2);
                e.style.transform = `translate(${x - geo.cw / 2}px, ${y - ch / 2}px) rotate(${phi}rad)`;
            });
            const idx = clamp(Math.round(p), 0, items.length - 1); const it = items[idx];
            if (idx !== shown) {
                shown = idx;
                no.textContent = pad(it.no); no.style.color = it.accent;
                nm.textContent = it.name; nm.style.fontSize = `${sizes[idx]}px`;
                sb.textContent = it.sub; wn.innerHTML = `${pad(it.no)} <b>/ ${pad(count)}</b>`;
                wf.textContent = it.sub;
            }
            const moving = k < w.steps && k > 0;
            const o = moving ? Math.abs(Math.cos(Math.PI * clamp(f / 0.6))) : 1;
            wt.style.opacity = o; wt.style.transform = `translateY(${(1 - o) * 16}px)`;
            ditherBar(bar, it.accent, 3, t);
        },
    };
}
const wheelP = makeWheel(S.w, PW.map((p) => ({ img: p.cover.src, name: p.title, sub: p.type, accent: accentOf(p.slug), no: Number(p.index) })), WHEEL, { count: TOTAL });
const libItems = LIB.map((e, i) => ({ img: e.cover, name: e.title.length > 22 ? e.author : e.title, sub: `${kinds[e.kind].singular}${e.year ? ` / ${e.year}` : ''}`, accent: kinds[e.kind].accent, no: i + 1 }));
const wheelL = makeWheel(S.l, libItems, { ...LIBW, cta: 'Ver ficha ↗' }, { square: true, count: 18 });

/* ───────────────────────── proyecto ───────────────────────── */
const pg = $('.pg'); const pi = $('.pi');
const mkDiv = (im, cls = '') => { const d = document.createElement('div'); d.className = cls; d.style.backgroundImage = `url(${im.src})`; d.style.aspectRatio = `${im.w}/${im.h}`; return d; };
let col1; let col2; let firstGrid;
{
    $('.no', pi).textContent = `${pad(Number(PROJ.index))} / ${pad(TOTAL)}`;
    $('.no', pi).style.color = accentOf(PROJ.slug);
    const nm = $('.nm', pi); nm.textContent = PROJ.title;
    nm.style.fontSize = `${Math.min(HZ ? 120 : 220, fitSize(PROJ.title, HZ ? 520 : W - 88))}px`;
    $('.ds', pi).textContent = PROJ.description;
    $('.rows', pi).innerHTML = [['Proyecto', PROJ.index], ['Tipo', PROJ.type], ['Piezas', String(allPieces)]].map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
    const cov = mkDiv(gallery[0], 'cov'); cov.style.height = ''; pg.append(cov);
    const grid = document.createElement('div'); grid.className = 'grid';
    col1 = document.createElement('div'); col1.className = 'col'; col2 = document.createElement('div'); col2.className = 'col';
    gallery.slice(1).forEach((im, i) => (i % 2 ? col2 : col1).append(mkDiv(im)));
    grid.append(col1, col2); pg.append(grid);
    firstGrid = col1.firstElementChild;
    if (!HZ) pg.style.top = '1150px'; else pg.style.top = '150px';
}

/* ───────────────────────── visor ───────────────────────── */
const lbx = $('.lbx'); const lbIm = $$('.im', lbx); const lbCt = $('.ct', lbx);
function lbBox(im) { const maxW = HZ ? 1500 : 1000; const maxH = HZ ? 880 : 1500; const s = Math.min(maxW / im.w, maxH / im.h); return [im.w * s, im.h * s]; }
function setLb(el, im) { const [w, h] = lbBox(im); el.style.width = `${w}px`; el.style.height = `${h}px`; el.style.backgroundImage = `url(${im.src})`; }
setLb(lbIm[0], gallery[1]); setLb(lbIm[1], gallery[2]);

/* ───────────────────────── sonido ───────────────────────── */
export const AUDIO = [];
const au = (name, t, p = 1, arg) => AUDIO.push({ name, t, p, arg });
au('hover', 4.55); au('click', T_CLICK.cta);
au('wipeIn', CORT.cover[0] + 0.05); au('gallop', CORT.hold[0] + 0.05); au('wipeOut', CORT.open[0] - 0.05);
{
    const stepTimes = (w, soft) => { for (let s = 0; s < w.steps; s++) { const t = w.t0 + s * w.dur + 0.05; au('tick', t, 1 + (s % 2 ? 0.06 : -0.04)); au('tick', t + 0.22, 0.9, soft); } };
    stepTimes(WHEEL); stepTimes(LIBW);
}
au('hover', 10.85); au('click', T_CLICK.ver); au('open', T_CLICK.ver + 0.08, 0.8);
au('hover', 13.9); au('click', T_CLICK.img); au('lbOpen', T_LB[0] + 0.05); au('tick', 15.0);
au('hover', 17.1);
au('open', 18.45, 0.7); au('kick', 18.5);
au('tick', 18.75, 1.2); for (let i = 1; i < 9; i++) au('hover', 18.75 + i * 0.07, 1 + i * 0.03);

/* ───────────────────────── cursor ───────────────────────── */
const C = {}; // posiciones medidas de los destinos
function cursorState(t) {
    const pt = (x, y) => ({ x, y });
    let s = null;
    if (t >= 3.0 && t < 5.4) {
        const u = ease(clamp((t - 3.0) / 1.6)); const a = pt(W * 0.8, H * (HZ ? 0.4 : 0.34));
        const cta = onCam(C.cta, cam(t, ...SCN.idx));
        s = { ...pt(lerp(a.x, cta.x, u), lerp(a.y, cta.y, u)), label: '', press: clamp(1 - Math.abs(t - T_CLICK.cta - 0.07) / 0.12), a: clamp((t - 3.0) / 0.3) * clamp((5.4 - t) / 0.15) };
    } else if (t >= 7.3 && t < 11.5) {
        const drift = Math.sin((t - 7.3) * 1.5) * W * 0.07;
        const hov = ease(clamp((t - 10.3) / 0.55));
        const base = pt(W / 2 + drift, geo.cy - geo.ch * 0.1);
        const ver = onCam(C.ver, cam(t, ...SCN.wheel));
        s = { x: lerp(base.x, ver.x, hov), y: lerp(base.y, ver.y - 8, hov), label: hov > 0.6 ? '' : 'Arrastrar', press: clamp(1 - Math.abs(t - T_CLICK.ver - 0.07) / 0.12), a: clamp((t - 7.3) / 0.3) * clamp((11.5 - t) / 0.15) };
    } else if (t >= 12.9 && t < 14.75) {
        const r = firstGrid.getBoundingClientRect(); const sr = stage.getBoundingClientRect();
        const tx = clamp(r.left - sr.left + r.width * 0.55, 80, W - 120); const ty = clamp(r.top - sr.top + r.height * 0.4, 260, H - 200);
        const u = ease(clamp((t - 12.9) / 0.9));
        s = { x: lerp(W * 0.7, tx, u), y: lerp(H * 0.62, ty, u), label: 'Ampliar', press: clamp(1 - Math.abs(t - T_CLICK.img - 0.07) / 0.12), a: clamp((t - 12.9) / 0.3) * clamp((14.75 - t) / 0.15) };
    } else if (t >= 15.9 && t < 17.4) {
        s = { x: W / 2 + Math.sin((t - 15.9) * 2) * W * 0.06, y: geo.cy, label: 'Arrastrar', press: 0, a: clamp((t - 15.9) / 0.3) * clamp((17.4 - t) / 0.2) };
    }
    return s;
}

/* ───────────────────────── render ───────────────────────── */
const cam = (t, a, b) => 1 + 0.045 * ease(clamp((t - a) / (b - a)));
const onCam = (pt, s) => ({ x: W / 2 + (pt.x - W / 2) * s, y: H / 2 + (pt.y - H / 2) * s });
let typed = 0;
function update(t) {
    // fondo: el campo de dither del home, suave
    ditherField(field, '#2a2a28', t, 8, 0.14 * clamp(t / 1.2));

    // escenas
    const vis = (el, o, disp = 'block') => { el.style.display = o > 0.001 ? disp : 'none'; el.style.opacity = o; };
    vis(S.a, op(t, SCN.idx, 0.5, 0.05)); vis(S.w, op(t, SCN.wheel, 0.05, 0.45)); vis(S.p, op(t, SCN.proj, 0.4, 0.45));
    vis(S.l, op(t, SCN.lib, 0.4, 0.4)); vis(S.e, op(t, SCN.end, 0.5, 0.01));
    // empuje de cámara muy lento sobre cada escena
    [[S.a, SCN.idx], [S.w, SCN.wheel], [S.p, SCN.proj], [S.l, SCN.lib]].forEach(([el, [a, b]]) => { el.style.transform = `scale(${cam(t, a, b)})`; });
    const navAlpha = clamp((t - 0.5) / 0.5);
    $('.nav').style.opacity = navAlpha;
    $$('.nav .links a').forEach((a, i) => {
        const on = i === 0 ? op(t, [0.8, 5.5], 0.3, 0.3) : i === 1 ? op(t, [6.6, 15.5], 0.3, 0.3) : i === 2 ? op(t, [15.4, 17.6], 0.3, 0.3) : 0;
        a.style.setProperty('--on', on);
    });

    // A · Index
    if (S.a.style.display !== 'none') {
        $('.ghost', S.a).style.transform = `translateX(${(HZ ? -300 : -420) - t * 14}px)`;
        const words = (el, t0, per) => { // el con palabras que aparecen una a una
            if (!el.dataset.w) { el.dataset.w = '1'; el.innerHTML = el.textContent.split(' ').map((w) => `<span style="opacity:0">${w}</span>`).join(' '); }
            [...el.children].forEach((s, i) => { s.style.opacity = clamp((t - t0 - i * per) / 0.18); });
        };
        words($('.p1', S.a), 1.4, 0.06); words($('.p2', S.a), 2.6, 0.06);
        $$('.menu li', S.a).forEach((li, i) => { li.style.opacity = clamp((t - 3.4 - i * 0.18) / 0.3); li.style.transform = `translateY(${(1 - clamp((t - 3.4 - i * 0.18) / 0.3)) * 12}px)`; });
        $('.cta', S.a).style.opacity = clamp((t - 3.9) / 0.4);
        $('.cta i', S.a).style.transform = `scaleX(${ease(clamp((t - 4.5) / 0.4))})`;
        const p = 0.9 * ease(clamp((t - 1.0) / 1.7));
        paintMask(hero, heroCtx, heroImg, heroMask, p);
    }
    // cortina con caballo
    drawWipe(t); drawHorse(t);

    // Trabajos
    if (S.w.style.display !== 'none') wheelP.update(t);
    // Proyecto: la columna izquierda queda fija en escritorio; en celular la info sube con el scroll
    if (S.p.style.display !== 'none') {
        const D = HZ ? 1350 : 1900;
        const y = -D * ease(clamp((t - SCROLL[0]) / (SCROLL[1] - SCROLL[0])));
        pg.style.transform = `translateY(${y}px)`;
        pi.style.transform = HZ ? 'none' : `translateY(${y}px)`;
        col2.style.transform = `translateY(${y * 0.1}px)`;
    }
    // Visor
    const lbo = clamp((t - T_LB[0]) / 0.3) * clamp((T_LB[1] - t) / 0.35);
    lbx.style.display = lbo > 0.001 ? 'block' : 'none'; lbx.style.opacity = lbo;
    if (lbo > 0) {
        const sw = ease(clamp((t - 15.0) / 0.3));
        lbIm[0].style.opacity = 1 - sw; lbIm[1].style.opacity = sw;
        const sc = lerp(0.95, 1, easeOut(clamp((t - T_LB[0]) / 0.4)));
        lbIm.forEach((e) => { e.style.transform = `translate(-50%,-50%) scale(${sc})`; });
        lbCt.textContent = `${pad(sw < 0.5 ? 2 : 3)} / ${pad(allPieces)}`;
    }
    // Biblioteca
    if (S.l.style.display !== 'none') wheelL.update(t);
    // Cierre
    if (S.e.style.display !== 'none') {
        const p = ease(clamp((t - 17.55) / 0.95));
        const crisp = t >= 18.5;
        $('.title', S.e).style.visibility = crisp ? 'visible' : 'hidden';
        dt.style.display = crisp ? 'none' : 'block';
        if (!crisp) paintMask(dt, dtCtx, dtImg, endMask, p);
        const n = Math.floor(clamp((t - 18.75) / 0.07, 0, 9));
        $('.online span', S.e).textContent = 'YA ONLINE'.slice(0, n);
        $('.online i', S.e).style.visibility = t >= 18.7 && (n < 9 || Math.floor((t - 18.75) / 0.5) % 2 === 0) ? 'visible' : 'hidden';
    }
    // cursor
    const cs = cursorState(t);
    if (cs) {
        curEl.style.opacity = cs.a;
        curEl.style.transform = `translate(${cs.x}px, ${cs.y}px) scale(${1 - 0.3 * cs.press})`;
        if (curLabel.textContent !== cs.label) curLabel.textContent = cs.label;
        curLabel.style.display = cs.label ? 'block' : 'none';
    } else curEl.style.opacity = 0;
    void typed;
}

export function render(t) { update(t); }
window.render = render;
window.AUDIO = AUDIO;
window.DURATION = DURATION;

/* ───────────────────────── arranque ───────────────────────── */
async function boot() {
    await Promise.all([
        ['800 100px "Inter Tight"', '700 40px "Inter Tight"', '300 30px "Roboto Mono"', '400 30px "Roboto Mono"', '500 30px "Roboto Mono"', '600 30px "Roboto Mono"', '700 40px "Space Mono"']
            .map((f) => document.fonts.load(f)),
    ].flat());
    await document.fonts.ready;
    HORSE_IMG = await loadImg('/images/transition/caballo.webp');
    const urls = [...PW.map((p) => p.cover.src), ...LIB.map((e) => e.cover), ...gallery.map((g) => g.src)];
    await Promise.all(urls.map(loadImg));

    // medidas: se muestran todas las escenas (invisibles) para leer posiciones reales
    const all = [S.a, S.w, S.p, S.l, S.e];
    all.forEach((s) => { s.style.display = 'block'; s.style.opacity = 0; });
    const size = Math.min(HZ ? 190 : 205, fitSize('(MZZ.DSG)', HZ ? 800 : W - 88));
    const ht1 = $('.ht1'); const ht2 = $('.ht2');
    ht1.style.fontSize = ht2.style.fontSize = `${size}px`;
    if (HZ) { ht1.style.top = '430px'; ht2.style.top = '430px'; ht2.style.left = 'auto'; ht2.style.right = '44px'; }
    else { ht1.style.top = '560px'; ht2.style.top = `${560 + size * 0.95}px`; }
    const et = $('.title', S.e); et.style.fontSize = `${fitSize('(MZZ.DSG)', W * (HZ ? 0.74 : 0.93))}px`;
    const center = (el) => { const r = el.getBoundingClientRect(); const sr = stage.getBoundingClientRect(); return { x: r.left - sr.left + r.width / 2, y: r.top - sr.top + r.height / 2 }; };
    C.cta = center($('.cta', S.a)); C.ver = center($('.wf2', S.w));
    heroMask = textMask([ht1, ht2], hero.width, hero.height);
    endMask = textMask([et], dt.width, dt.height);
    all.forEach((s) => { s.style.display = 'none'; s.style.opacity = 1; });
    $('.title', S.e).style.visibility = 'hidden';

    window.ready = true;
    render(0);
}
boot();

/* ───────────────────────── revisión en el navegador ───────────────────────── */
if (!RENDER) {
    const ui = document.getElementById('ui'); ui.hidden = false;
    const scrub = document.getElementById('scrub'); const clock = document.getElementById('clock'); const play = document.getElementById('play');
    const fit = () => { const k = Math.min(innerWidth / W, (innerHeight - 46) / H); stage.style.transform = `scale(${k})`; };
    addEventListener('resize', fit); fit();
    let playing = false; let t0 = 0;
    const set = (t) => { if (!window.ready) return; render(t); scrub.value = t; clock.textContent = t.toFixed(2); };
    scrub.addEventListener('input', () => set(Number(scrub.value)));
    play.addEventListener('click', () => { playing = !playing; play.textContent = playing ? '❚❚' : '▶'; t0 = performance.now() - Number(scrub.value) * 1000; });
    const loop = () => { if (playing) set(((performance.now() - t0) / 1000) % DURATION); requestAnimationFrame(loop); };
    loop();
}
