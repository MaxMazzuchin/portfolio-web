/**
 * Promo del estreno del portfolio: motion graphics en DOM + canvas, una sola timeline GSAP pausada.
 * `render(t)` deja todo en el segundo t (determinista: se llama una vez por cuadro). `AUDIO` es la lista de sonidos
 * con su tiempo, salida de las mismas constantes que la imagen, así audio y video no se desfasan.
 *   ?f=v (1080×1920, default) | ?f=h (1920×1080) · ?render para grabar (sin interfaz).
 */
import gsap from 'gsap';
import { BAYER8 } from '/src/core/dither.js';
import { nParts } from '/src/brand/nyro-logo.js';
import { logoSVG } from '/src/brand/cb-logo.js';
import { blueSVG } from '/src/brand/blue-logo.js';
import { WAVE_A, WAVE_B } from '/src/brand/blue-paths.js';
import { accentOf } from '/src/data/accents.js';

const Q = new URLSearchParams(location.search);
const HZ = Q.get('f') === 'h';
const RENDER = Q.has('render');
const W = HZ ? 1920 : 1080;
const H = HZ ? 1080 : 1920;
export const DURATION = 20;
const FPS = 30;
const B = 0.625; // un pulso a 96 BPM = una zancada del galope
const E = B / 2;

document.documentElement.classList.toggle('h', HZ);
document.documentElement.classList.toggle('render', RENDER);
document.documentElement.style.setProperty('--W', `${W}px`);
document.documentElement.style.setProperty('--H', `${H}px`);

const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (k) => k * k * (3 - 2 * k);
const pulse = (t, dt = B, k = 7) => Math.exp(-(((t % dt) + dt) % dt) * k); // 1 en cada golpe, cae rápido
const hash = (a, b = 0, c = 0) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s); };
const bayer = (x, y) => BAYER8[y & 7][x & 7];

/* ───────────────────────── datos ───────────────────────── */
const COVERS = [
    ['album-artwork', 'ALBUM ARTWORK', '01'], ['curu', 'CURU', '02'], ['sin-datos', 'SIN DATOS', '04'], ['i-life', 'I-LIFE', '05'],
    ['nyro', 'NYRO', '06'], ['outframe', 'OUTFRAME', '09'], ['d2x', 'D2X', '10'], ['100-posters', '100 POSTERS', '12'],
];
const WORDS = ['IDENTIDAD', 'EDITORIAL', 'MOTION', 'MARCA'];
const TAPE = 'IDENTIDAD VISUAL — DIRECCIÓN DE ARTE — SISTEMAS GRÁFICOS — EDITORIAL — MOTION — ';

// Tiempos de las escenas (8 compases de 2,5 s)
const T = { s1: [0, 2.5], s2: [2.5, 5], s3: [5, 7.5], s4: [7.5, 10], s5: [10, 12.5], s6: [12.5, 15], s7: [15, 17.45], s8: [17.45, 20] };

/* ───────────────────────── carga ───────────────────────── */
const loadImg = (src, fallback) => new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => { if (fallback) { const j = new Image(); j.onload = () => res(j); j.src = fallback; } else res(i); };
    i.src = src;
});

const stage = document.getElementById('stage');
stage.innerHTML = `
<div class="bg"></div>
<canvas class="snow"></canvas>
<section class="sc s1">${[...'MZZ'].map((c) => `<span class="big">${c}</span>`).join('')}</section>
<section class="sc s2">
    <div class="lines"></div>
    <div class="mono year2">( 2026 ) &nbsp; DISEÑADOR GRÁFICO &nbsp; ( ARG )</div>
    <div class="tape"><div></div></div>
</section>
<section class="sc s3"><div class="year big">2026</div><canvas class="horse" width="640" height="450"></canvas><div class="cap">Diseño en movimiento</div></section>
<section class="sc s4">${COVERS.map(([s, n, no]) => `
    <div class="cv" data-s="${s}"><div class="z"><img alt=""><canvas></canvas></div>
        <div class="no" style="color:${accentOf(s)}">${no} / 15</div>
        <div class="nm big">${n.replace(' ', '<br>')}</div><div class="bar" style="background:${accentOf(s)}"></div></div>`).join('')}
</section>
<section class="sc s5">
    <div class="pn pn-n"><span class="lb">06 — Nyro</span><svg viewBox="0 0 300 300">${nParts().map((d) => `<path class="np" d="${d}"/>`).join('')}</svg><span class="lc">Identidad de marca</span></div>
    <div class="pn pn-c"><span class="lb">07 — Contigiani Briñón</span>${logoSVG({ layout: 'icon' })}<span class="lc">Bienes raíces</span></div>
    <div class="pn pn-b"><span class="lb">08 — Blue Marketing</span>
        <svg class="waves" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMax slice"><path class="wa" d="${WAVE_A}" fill="#2b46ff"/><path class="wb" d="${WAVE_B}" fill="#4f6bff"/></svg>
        ${blueSVG({ layout: 'icon' })}<span class="lc">Marketing digital</span></div>
</section>
<section class="sc s6"><div class="ring">${COVERS.map(() => '<div class="card"></div>').join('')}</div>${WORDS.map((w) => `<div class="word big">${w}</div>`).join('')}</section>
<section class="sc s7"><div class="ya">YA CASI</div><div class="count">000</div><canvas class="bar"></canvas></section>
<section class="sc s8"><canvas class="dt"></canvas><div class="title">(MZZ.DSG)</div><div class="online"><span></span><i></i></div></section>
<canvas class="wipe"></canvas>
<div class="hud"><span class="tl">MZZ.DSG®</span><span class="tr">00:00</span><span class="bl">Portfolio — 2026</span><span class="br">Córdoba, Argentina</span></div>
<div class="flash"></div>`;

const $ = (s, r = stage) => r.querySelector(s);
const $$ = (s, r = stage) => [...r.querySelectorAll(s)];
const sc = { s1: $('.s1'), s2: $('.s2'), s3: $('.s3'), s4: $('.s4'), s5: $('.s5'), s6: $('.s6'), s7: $('.s7'), s8: $('.s8') };

/** Ancho de un texto a 100 px con la clase `cls` (para ajustar el cuerpo a un ancho dado). */
function widthAt100(text, cls, extra = '') {
    const s = document.createElement('span');
    s.className = cls;
    s.style.cssText = `position:absolute;visibility:hidden;font-size:100px;${extra}`;
    s.textContent = text;
    stage.append(s);
    const w = s.getBoundingClientRect().width;
    s.remove();
    return w;
}
const fitSize = (text, width, cls = 'big') => (100 * width) / widthAt100(text, cls);

function letters(el, text) {
    el.innerHTML = [...text].map((c) => `<span class="ch">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
    return $$('.ch', el);
}

/* ───────────────────────── canvas ───────────────────────── */
const CELL = 8;
const snow = $('.snow');
snow.width = Math.ceil(W / CELL); snow.height = Math.ceil(H / CELL);
const snowCtx = snow.getContext('2d');
const snowImg = snowCtx.createImageData(snow.width, snow.height);

function drawSnow(t, dens, rgb) {
    const d = snowImg.data;
    const sh = Math.floor(t * 15);
    for (let y = 0; y < snow.height; y++) {
        for (let x = 0; x < snow.width; x++) {
            const local = dens * (0.65 + 0.35 * Math.sin(x * 0.13 + y * 0.09 + t * 2.2));
            const on = local > bayer(x + sh, y + sh * 2);
            const i = (y * snow.width + x) * 4;
            d[i] = rgb; d[i + 1] = rgb; d[i + 2] = rgb; d[i + 3] = on ? 255 : 0;
        }
    }
    snowCtx.putImageData(snowImg, 0, 0);
}

const wipe = $('.wipe');
wipe.width = Math.ceil(W / CELL); wipe.height = Math.ceil(H / CELL);
const wipeCtx = wipe.getContext('2d');
const wipeImg = wipeCtx.createImageData(wipe.width, wipe.height);
// Barridos Bayer: [t0, t1, de, a, color]
const WIPES = [
    [2.34, 2.5, 0, 1, 255], [2.5, 2.8, 1, 0, 255],
    [4.55, 5.0, 0, 1, 0], [5.0, 5.35, 1, 0, 0],
    [17.3, 17.45, 0, 1, 0], [17.45, 17.6, 1, 0, 0],
];
function drawWipe(t) {
    const w = WIPES.find(([a, b]) => t >= a && t < b);
    const d = wipeImg.data;
    if (!w) { if (wipe.dataset.on) { d.fill(0); wipeCtx.putImageData(wipeImg, 0, 0); delete wipe.dataset.on; } return; }
    wipe.dataset.on = '1';
    const amt = lerp(w[2], w[3], (t - w[0]) / (w[1] - w[0]));
    for (let y = 0; y < wipe.height; y++) {
        for (let x = 0; x < wipe.width; x++) {
            const v = amt * 1.7 - (x / wipe.width) * 0.7;
            const i = (y * wipe.width + x) * 4;
            const on = v > bayer(x, y);
            d[i] = w[4]; d[i + 1] = w[4]; d[i + 2] = w[4]; d[i + 3] = on ? 255 : 0;
        }
    }
    wipeCtx.putImageData(wipeImg, 0, 0);
}

/* ───────────────────────── escenas ───────────────────────── */
const master = gsap.timeline({ paused: true });

// 1 · M Z Z
const s1l = $$('.big', sc.s1);
s1l.forEach((l, k) => {
    gsap.set(l, { opacity: 0 });
    master.fromTo(l, { scale: 1.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.14, ease: 'power4.out' }, k * B);
});
// 2 · NUEVO PORTFOLIO
// Vertical: NUEVO / PORT / FOLIO, cada línea a todo el ancho. Horizontal: NUEVO / PORTFOLIO.
const LINES = HZ ? [['NUEVO', 0.62], ['PORTFOLIO', 0.9]] : [['NUEVO', 0.94], ['PORT', 0.94], ['FOLIO', 0.94]];
const linesEl = $('.lines');
const lineChars = LINES.map(([txt, k], i) => {
    const el = document.createElement('div');
    el.className = 'big ln';
    el.style.fontSize = `${fitSize(txt, W * k)}px`;
    linesEl.append(el);
    return letters(el, txt);
});
lineChars.forEach((cs, li) => {
    const t0 = 2.5 + li * B / (HZ ? 1 : 1);
    cs.forEach((c, i) => {
        if (li % 2 === 0) master.fromTo(c, { yPercent: 115, fontWeight: 500 }, { yPercent: 0, fontWeight: 800, duration: 0.2, ease: 'power4.out' }, t0 + i * 0.06);
        else master.fromTo(c, { xPercent: 130, opacity: 0, fontWeight: 500 }, { xPercent: 0, opacity: 1, fontWeight: 800, duration: 0.16, ease: 'power3.out' }, t0 + i * 0.045);
    });
});
const outlined = lineChars[1];
outlined.forEach((c) => { c.style.webkitTextStroke = '6px #000'; c.style.color = 'transparent'; });
master.to(outlined, { color: '#000', duration: 0.04 }, 4.0);
lineChars.forEach((cs, li) => {
    master.to(cs, { fontWeight: 540, duration: 0.1, yoyo: true, repeat: 1, stagger: 0.025 }, 4.0 + (li % 2) * 0.06);
    master.to(cs, { fontWeight: 540, duration: 0.1, yoyo: true, repeat: 1, stagger: 0.025 }, 4.4 + (li % 2) * 0.06);
});
const tapeEl = $('.tape div');
tapeEl.textContent = TAPE.repeat(4);
// 3 · caballo (sprite 5×2, alfa = brillo; se pinta en 1 bit con Bayer)
const yearEl = $('.year', sc.s3); yearEl.style.fontSize = ''; // el tamaño lo da el css
const hCv = $('.horse'); const hCtx = hCv.getContext('2d');
const hOff = document.createElement('canvas'); hOff.width = 640; hOff.height = 450;
const hOffCtx = hOff.getContext('2d', { willReadFrequently: true });
const hImg = hCtx.createImageData(640, 450);
const SP = Array.from({ length: 18 }, (_, i) => ({ y: 0.08 + hash(i, 1) * 0.84, w: 220 + hash(i, 2) * 560, v: 2200 + hash(i, 3) * 2400, o: hash(i, 4) * (W + 800), h: 6 + Math.floor(hash(i, 5) * 3) * 4 }));
SP.forEach((s) => { s.el = document.createElement('div'); s.el.className = 'sp'; s.el.style.top = `${s.y * H}px`; s.el.style.width = `${s.w}px`; s.el.style.height = `${s.h}px`; sc.s3.append(s.el); });
// 4 · portadas
const cvEls = $$('.cv', sc.s4);
COVERS.forEach(([slug, name], i) => {
    const longest = name.split(' ').reduce((a, b) => (b.length > a.length ? b : a), '');
    const size = Math.min(HZ ? 250 : 220, fitSize(longest, W - 88));
    $('.nm', cvEls[i]).style.fontSize = `${size}px`;
});
const LW = Math.ceil(W / 6); const LH = Math.ceil(H / 6);
// 5 · logos
const panels = $$('.pn', sc.s5);
panels.forEach((p, i) => {
    if (HZ) Object.assign(p.style, { left: `${(i * W) / 3}px`, top: '0', width: `${W / 3 + 1}px`, height: `${H}px` });
    else Object.assign(p.style, { left: '0', top: `${(i * H) / 3}px`, width: `${W}px`, height: `${H / 3 + 1}px` });
    gsap.set(p, { clipPath: 'inset(0 100% 0 0)' });
    master.to(p, { clipPath: 'inset(0 0% 0 0)', duration: 0.18, ease: 'power4.out' }, 10 + i * (B / 2));
});
master.fromTo($$('.np'), { scale: 0, transformBox: 'fill-box', transformOrigin: '50% 50%' }, { scale: 1, duration: 0.22, ease: 'back.out(2.2)', stagger: 0.09 }, 10.2);
master.to($$('.cb-p'), { strokeDashoffset: 0, duration: 0.5, ease: 'power2.inOut', stagger: 0.05 }, 10.5);
master.to($$('.cb-p'), { fillOpacity: 1, duration: 0.25 }, 11.15);
master.fromTo($('.pn-b svg.bm-logo'), { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: 0.45, ease: 'power3.out' }, 10.8);
// 6 · rueda
const CW = HZ ? 560 : 640; const CH = HZ ? 740 : 850;
const R = Math.round(CW / 2 / Math.tan(Math.PI / 8)) + 40;
const cards = $$('.card', sc.s6);
cards.forEach((c) => { Object.assign(c.style, { width: `${CW}px`, height: `${CH}px`, left: `${-CW / 2}px`, top: `${-CH / 2}px` }); });
const ring = $('.ring');
const wordEls = $$('.word', sc.s6);
wordEls.forEach((w, i) => { w.style.fontSize = `${fitSize(WORDS[i], W * (HZ ? 0.8 : 0.96))}px`; });
// 7 · subida
const countEl = $('.count'); const yaEl = $('.ya');
const barCv = $('.s7 .bar'); const BW = Math.ceil(W / 6); const BH = 22;
barCv.width = BW; barCv.height = BH;
const barCtx = barCv.getContext('2d');
// 8 · cierre
const titleEl = $('.title'); const online = $('.online span'); const cursor = $('.online i');
const titleSize = fitSize('(MZZ.DSG)', W * (HZ ? 0.74 : 0.93));
titleEl.style.fontSize = `${titleSize}px`;
const dt = $('.dt'); const DC = 4;
dt.width = Math.ceil(W / DC); dt.height = Math.ceil(H / DC);
const dtCtx = dt.getContext('2d');
const dtImg = dtCtx.createImageData(dt.width, dt.height);
let dtMask = null;

/* ───────────────────────── destellos / sonido ───────────────────────── */
const f2 = 2 / FPS;
const strobe1 = []; for (let t = 1.875; t < 2.5; t += 0.0625) strobe1.push(t);
const strobe7 = []; { let t = 15; let step = B / 2; while (t < 17.4) { strobe7.push(t); step = Math.max(0.045, step * 0.84); t += step; } }
const FLASH = [
    [0, f2], [B, B + f2], [2 * B, 2 * B + f2],
    ...strobe1.filter((_, i) => i % 2 === 0).map((a) => [a, a + 0.0312]),
    [3.125, 3.125 + f2], [3.75, 3.75 + f2], [4.375, 4.375 + f2],
    [12.3, 12.3 + f2], [12.4, 12.4 + f2],
    ...strobe7.filter((_, i) => i % 2 === 0).map((a, k) => [a, strobe7[2 * k + 1] ?? a + 0.04]),
    [18.5, 18.5 + 3 / FPS], [19.375, 19.375 + 3 / FPS],
];

// Lista de sonidos: name, t, p (tono), arg (solo gallopRun)
export const AUDIO = [];
const au = (name, t, p = 1, arg) => AUDIO.push({ name, t, p, arg });
for (let b = 0; b * B < 17.4; b++) { const t = b * B; if (t >= 5.0 && t < 7.5) continue; if (t >= 15) continue; au('kick', t); au('tick', t + E, 0.75); }
for (let k = 0; k < 3; k++) au('click', k * B, 1 + k * 0.1);
for (let i = 0; i < 5; i++) au('tick', 2.5 + i * 0.06, 0.8 + i * 0.12);
au('open', 3.125, 0.9); au('open', 3.75, 1.1); au('open', 4.375, 1.3);
au('wipeIn', 4.55); au('wipeOut', 5.0);
au('gallopRun', 5.0, 1, 2.5);
au('open', 7.5, 0.7);
for (let i = 0; i < 8; i++) { au('tick', 7.5 + i * E, 1 + i * 0.07); au('click', 7.5 + i * E, 0.9 + i * 0.05); }
[0, 1, 2].forEach((i) => au('open', 10 + i * E, 0.9 + i * 0.25));
for (let i = 0; i < 4; i++) au('click', 12.5 + i * B, 1 + i * 0.12);
{ // la rueda gira cada vez más rápido
    let t = 12.5; let step = 0.3;
    while (t < 15) { au('tick', t, 0.9 + (t - 12.5) * 0.25); t += step; step = Math.max(0.05, step * 0.9); }
}
for (let i = 0; i < strobe7.length; i += 1) au(i % 2 ? 'hover' : 'kick', strobe7[i], 1 + i * 0.02);
au('wipeIn', 17.2);
au('wipeOut', 17.45);
au('open', 18.5, 0.8);
au('kick', 19.375); au('open', 19.375, 0.6);

/* ───────────────────────── render ───────────────────────── */
const COVER_IMG = {};
const covLum = {};

function drawCoverOverlay(cv, slug, local) {
    const ov = $('canvas', cv);
    const p = clamp(local / 0.2); // 0..1 en los primeros 6 cuadros
    if (p >= 1) { if (ov.dataset.clear !== '1') { ov.getContext('2d').clearRect(0, 0, ov.width, ov.height); ov.dataset.clear = '1'; } return; }
    ov.dataset.clear = '0';
    const lum = covLum[slug];
    const ctx = ov.getContext('2d');
    const img = ctx.createImageData(LW, LH);
    for (let y = 0; y < LH; y++) {
        for (let x = 0; x < LW; x++) {
            const b = bayer(x, y);
            const i = (y * LW + x) * 4;
            if (b < p) { img.data[i + 3] = 0; continue; } // ya se ve en color
            const on = lum[y * LW + x] > b;
            const v = on ? 255 : 0;
            img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
}

function update(t) {
    const show = (el, [a, b]) => { el.style.display = t >= a && t < b ? 'block' : 'none'; };
    sc.s1.style.display = t >= T.s1[0] && t < T.s1[1] ? 'flex' : 'none';
    show(sc.s3, T.s3); show(sc.s4, T.s4);
    show(sc.s6, T.s6); show(sc.s7, T.s7);
    sc.s2.style.display = t >= T.s2[0] && t < T.s2[1] ? 'flex' : 'none';
    sc.s5.style.display = t >= T.s5[0] && t < T.s5[1] ? 'block' : 'none';
    sc.s8.style.display = t >= T.s8[0] ? 'flex' : 'none';

    // fondo + nieve según la escena
    let bg = '#000'; let col = 255; let dens = 0.05;
    if (t < 2.5) dens = 0.05 + 0.4 * pulse(t) + 0.12 * (t / 2.5);
    else if (t < 4.55) { bg = '#fff'; col = 0; dens = 0.06 + 0.3 * pulse(t); }
    else if (t < 5.0) { bg = '#fff'; col = 0; dens = 0.3; }
    else if (t < 7.5) dens = 0.07 + 0.18 * pulse(t);
    else if (t < 15) dens = 0.05 + 0.08 * pulse(t);
    else if (t < 17.4) dens = 0.08 + 0.12 * pulse(t, B / 2);
    else dens = lerp(0.35, 0.03, ease(clamp((t - 17.45) / 1.4)));
    stage.style.backgroundColor = bg;
    $('.bg').style.backgroundColor = bg;
    drawSnow(t, dens, col);

    // HUD
    const fr = Math.floor(t * FPS);
    $('.hud .tr').textContent = `${String(Math.floor(fr / FPS)).padStart(2, '0')}:${String(fr % FPS).padStart(2, '0')}`;

    // 2 · cinta
    tapeEl.style.transform = `translateX(${-((t - 2.5) * 560) % 1400}px)`;
    // 3 · caballo + líneas de velocidad
    if (t >= T.s3[0] && t < T.s3[1]) {
        const u = (t - 5) / 2.5;
        const hw = HZ ? 1260 : 1500;
        const x = lerp(-hw * 0.95, W - hw * 0.05, lerp(u, ease(u), 0.45));
        hCv.style.left = `${x}px`;
        const fi = Math.floor((t - 5) * 16) % 10;
        hOffCtx.clearRect(0, 0, 640, 450);
        hOffCtx.drawImage(HORSE_IMG, (fi % 5) * 640, Math.floor(fi / 5) * 450, 640, 450, 0, 0, 640, 450);
        const src = hOffCtx.getImageData(0, 0, 640, 450).data;
        const o = hImg.data;
        for (let y = 0; y < 450; y++) for (let xx = 0; xx < 640; xx++) {
            const i = (y * 640 + xx) * 4;
            const on = src[i + 3] / 255 > bayer(xx, y);
            o[i] = 255; o[i + 1] = 255; o[i + 2] = 255; o[i + 3] = on ? 255 : 0;
        }
        hCtx.putImageData(hImg, 0, 0);
        yearEl.style.transform = `translateX(${lerp(60, -60, u)}px)`;
        SP.forEach((s) => { s.el.style.transform = `translateX(${((s.o - (t - 5) * s.v) % (W + s.w + 600) + (W + s.w + 600)) % (W + s.w + 600) - s.w}px)`; });
    }
    // 4 · portadas (una por corchea)
    if (t >= T.s4[0] && t < T.s4[1]) {
        const k = clamp(Math.floor((t - 7.5) / E), 0, 7);
        const local = t - 7.5 - k * E;
        cvEls.forEach((cv, i) => {
            cv.style.display = i === k ? 'block' : 'none';
            if (i !== k) return;
            $('.z', cv).style.transform = `scale(${lerp(1.14, 1, ease(clamp(local / E)))})`;
            const nm = $('.nm', cv);
            nm.style.transform = `translateY(${lerp(60, 0, ease(clamp(local / 0.12)))}px)`;
            nm.style.opacity = clamp(local / 0.06);
            drawCoverOverlay(cv, cv.dataset.s, local);
        });
    }
    // 5 · olas y rótulos
    if (t >= T.s5[0] && t < T.s5[1]) {
        $('.wa').style.transform = `translateX(${Math.sin(t * 3) * 40}px)`;
        $('.wb').style.transform = `translateX(${Math.cos(t * 2.4) * 60}px)`;
    }
    // 6 · rueda 3D
    if (t >= T.s6[0] && t < T.s6[1]) {
        const u = (t - 12.5) / 2.5;
        const ang = 20 + 480 * Math.pow(u, 1.7);
        const sc2 = 1 + 0.07 * pulse(t);
        ring.style.transform = `translateZ(${-R - 120}px) rotateX(-7deg) rotateY(${ang}deg) scale(${sc2})`;
        cards.forEach((c, i) => { c.style.transform = `rotateY(${i * 45}deg) translateZ(${R}px)`; });
        const wi = clamp(Math.floor((t - 12.5) / B), 0, 3);
        wordEls.forEach((w, i) => { w.style.display = i === wi ? 'block' : 'none'; });
        const pp = pulse(t);
        wordEls[wi].style.transform = `translateY(-50%) scale(${1 + 0.06 * pp})`;
    }
    // 7 · subida
    if (t >= T.s7[0] && t < T.s7[1]) {
        const u = clamp((t - 15) / 2.3);
        const v = Math.round(100 * Math.pow(u, 2.2));
        countEl.textContent = String(v).padStart(3, '0');
        const j = Math.floor(t * 30);
        const amp = 3 + 14 * u;
        const dx = Math.round((hash(j, 1) - 0.5) * amp * 2); const dy = Math.round((hash(j, 2) - 0.5) * amp);
        yaEl.style.textShadow = `${dx}px ${dy}px 0 #f0f, ${-dx}px ${-dy}px 0 #0ff`;
        countEl.style.textShadow = `${dx * 2}px ${dy}px 0 #f0f, ${-dx * 2}px ${-dy}px 0 #0ff`;
        const fillX = (v / 100) * BW;
        const img = barCtx.createImageData(BW, BH);
        for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
            const i = (y * BW + x) * 4;
            const on = x < fillX - 14 * bayer(x, y);
            img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = on ? 255 : 0;
        }
        barCtx.putImageData(img, 0, 0);
    }
    // 8 · cierre
    if (t >= T.s8[0]) {
        const p = ease(clamp((t - 17.55) / 0.95));
        const crisp = t >= 18.5;
        titleEl.style.visibility = crisp ? 'visible' : 'hidden';
        dt.style.display = crisp ? 'none' : 'block';
        if (!crisp && dtMask) {
            const d = dtImg.data;
            for (let y = 0; y < dt.height; y++) for (let x = 0; x < dt.width; x++) {
                const i = (y * dt.width + x) * 4;
                const on = dtMask[y * dt.width + x] && p > bayer(x, y);
                d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = on ? 255 : 0;
            }
            dtCtx.putImageData(dtImg, 0, 0);
        }
        const hit = pulse(t - 19.375 + 100 * B, 100, 14) * (t >= 19.375 ? 1 : 0);
        titleEl.style.transform = `scale(${1 + 0.035 * hit})`;
        const n = Math.floor(clamp((t - 18.75) / 0.07, 0, 9));
        online.textContent = 'YA ONLINE'.slice(0, n);
        cursor.style.visibility = t >= 18.7 && (n < 9 || Math.floor((t - 18.75) / E) % 2 === 0) ? 'visible' : 'hidden';
    }
    // destello (invierte lo que hay debajo)
    stage.querySelector('.flash').style.opacity = FLASH.some(([a, b]) => t >= a && t < b) ? 1 : 0;
    drawWipe(t);
    // apagón antes del cierre
    if (t >= 17.4 && t < 17.45) { stage.querySelectorAll('.sc').forEach((s) => { s.style.display = 'none'; }); }
}

let HORSE_IMG;
export function render(t) {
    master.time(t, false);
    update(t);
}
window.render = render;
window.AUDIO = AUDIO;
window.DURATION = DURATION;

/* ───────────────────────── arranque ───────────────────────── */
async function boot() {
    await Promise.all([
        document.fonts.load('800 100px "Inter Tight"'), document.fonts.load('500 100px "Inter Tight"'),
        document.fonts.load('500 20px "Roboto Mono"'), document.fonts.load('600 20px "Roboto Mono"'), document.fonts.load('700 20px "Roboto Mono"'),
        document.fonts.load('700 100px "Space Mono"'), document.fonts.load('400 20px "Space Mono"'),
    ]);
    await document.fonts.ready;
    HORSE_IMG = await loadImg('/images/transition/caballo.webp');
    await Promise.all(COVERS.map(async ([slug]) => {
        const img = await loadImg(`/images/projects/${slug}/cover-1200.webp`, `/images/projects/${slug}/cover.webp`);
        COVER_IMG[slug] = img;
        const cv = $(`.cv[data-s="${slug}"]`);
        $('img', cv).src = img.src;
        const ov = $('canvas', cv); ov.width = LW; ov.height = LH;
        // luminancia a baja resolución, con el mismo recorte (cover) que la imagen
        const off = document.createElement('canvas'); off.width = LW; off.height = LH;
        const c = off.getContext('2d', { willReadFrequently: true });
        const s = Math.max(LW / img.naturalWidth, LH / img.naturalHeight);
        c.drawImage(img, (LW - img.naturalWidth * s) / 2, (LH - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
        const px = c.getImageData(0, 0, LW, LH).data;
        const lum = new Float32Array(LW * LH);
        for (let i = 0; i < lum.length; i++) lum[i] = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255;
        covLum[slug] = lum;
    }));
    cards.forEach((c, i) => { c.style.backgroundImage = `url(${COVER_IMG[COVERS[i][0]].src})`; });

    // fuentes ya listas: tipografías de los rótulos y máscara de dither del título final
    const tape = $('.tape div'); void tape;
    sc.s8.style.display = 'flex';
    const r = titleEl.getBoundingClientRect(); const sr = stage.getBoundingClientRect();
    const off = document.createElement('canvas'); off.width = dt.width; off.height = dt.height;
    const c = off.getContext('2d', { willReadFrequently: true });
    c.fillStyle = '#fff'; c.textBaseline = 'alphabetic'; c.textAlign = 'center';
    c.font = `800 ${titleSize / DC}px "Inter Tight"`;
    c.letterSpacing = `${(-0.045 * titleSize) / DC}px`;
    // Alineado con el título del DOM: centro horizontal y línea base medida con un span vacío
    const probe = document.createElement('span'); probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    titleEl.append(probe);
    const base = probe.getBoundingClientRect().top - sr.top;
    probe.remove();
    c.fillText('(MZZ.DSG)', (r.left - sr.left + r.width / 2) / DC, base / DC);
    const px = c.getImageData(0, 0, dt.width, dt.height).data;
    dtMask = new Uint8Array(dt.width * dt.height);
    for (let i = 0; i < dtMask.length; i++) dtMask[i] = px[i * 4 + 3] > 120 ? 1 : 0;
    sc.s8.style.display = 'none';

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
    const loop = () => { if (playing) { const t = ((performance.now() - t0) / 1000) % DURATION; set(t); } requestAnimationFrame(loop); };
    loop();
}
