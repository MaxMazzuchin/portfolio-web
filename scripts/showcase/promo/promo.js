/**
 * Promo del estreno, "del ruido a la imagen": el portfolio es dither (1 bit) y todo nace del grano.
 * Un caballo se ordena a partir del ruido, cruza tres veces dejando portadas, las cartas se juntan en la rueda,
 * la rueda se deshace en ruido y del ruido sale (MZZ.DSG). Sin UI del sitio, sin destellos.
 * Todo es función del tiempo: `render(t)` deja el escenario en el segundo t (una llamada por cuadro).
 * `AUDIO` es la lista de sonidos con su tiempo. ?f=v (1080×1920, default) | ?f=h (1920×1080) · ?render para grabar.
 */
import { BAYER8, ditherField } from '/src/core/dither.js';
import { projects } from '/src/data/work.js';

const Q = new URLSearchParams(location.search);
const HZ = Q.get('f') === 'h';
const RENDER = Q.has('render');
const W = HZ ? 1920 : 1080;
const H = HZ ? 1080 : 1920;
export const DURATION = 20;

document.documentElement.classList.toggle('h', HZ);
document.documentElement.classList.toggle('render', RENDER);
document.documentElement.style.setProperty('--W', `${W}px`);
document.documentElement.style.setProperty('--H', `${H}px`);

const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (k) => k * k * (3 - 2 * k);
const bayer = (x, y) => BAYER8[y & 7][x & 7];
const hash = (a, b = 0, c = 0) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s); };
const INK = [244, 244, 239];

/* ───────────────────────── línea de tiempo ───────────────────────── */
const EM = [2.6, 3.6]; // el caballo se ordena a partir del grano
const CROSS = [[3.6, 5.6, 1], [6.0, 8.0, -1], [8.4, 10.4, 1]]; // [desde, hasta, dirección]
const HERO = [10.4, 11.4]; // la última portada se achica hasta ser una carta
const ARRIVE = 11.0; // las demás cartas llegan por el arco
const ROT = [12.2, 15.0]; // la rueda gira sola
const DISS = [15.0, 16.8]; // la rueda se deshace en ruido
const TITLE = [16.7, 18.0]; // (MZZ.DSG) se ordena a partir del grano
const CRISP = 18.2;

/* ───────────────────────── datos ───────────────────────── */
const PW = projects.slice(0, 10);
const SLUGS = ['album-artwork', 'sin-datos', 'i-life']; // las tres portadas que deja el caballo
const COV = SLUGS.map((s) => PW.findIndex((p) => p.slug === s));
const P0 = COV[2]; // la carta que queda en el centro de la rueda
const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(i); i.src = src; });

/* ───────────────────────── DOM ───────────────────────── */
const stage = document.getElementById('stage');
stage.innerHTML = `
<canvas class="field"></canvas>
<canvas class="base"></canvas>
<canvas class="top"></canvas>
<div class="wheel">${PW.map(() => '<div class="wc"></div>').join('')}</div>
<canvas class="dissolve"></canvas>
<canvas class="horse" width="640" height="450"></canvas>
<canvas class="dt"></canvas>
<div class="title">(MZZ.DSG)</div>
<div class="online"><span></span><i></i></div>`;
const $ = (s) => stage.querySelector(s);
const field = $('.field'); const base = $('.base'); const top = $('.top'); const wheel = $('.wheel');
const dissolve = $('.dissolve'); const horse = $('.horse'); const dt = $('.dt');
const cards = [...stage.querySelectorAll('.wc')];
const titleEl = $('.title'); const onlineTxt = $('.online span'); const cursor = $('.online i');

/* ───────────────────────── capas de celdas (1 celda = 4 px) ───────────────────────── */
const CELL = 4;
const MW = Math.ceil(W / CELL); const MH = Math.ceil(H / CELL);
const smallCv = () => { const c = document.createElement('canvas'); c.width = MW; c.height = MH; return c; };
base.width = W; base.height = H; top.width = W; top.height = H;
const baseCtx = base.getContext('2d'); const topCtx = top.getContext('2d');
const eraseCv = smallCv(); const monoCv = smallCv();
const eraseCtx = eraseCv.getContext('2d'); const monoCtx = monoCv.getContext('2d');
const eraseImg = eraseCtx.createImageData(MW, MH); const monoImg = monoCtx.createImageData(MW, MH);
dissolve.width = MW; dissolve.height = MH;
const disCtx = dissolve.getContext('2d'); const disImg = disCtx.createImageData(MW, MH);
dt.width = MW; dt.height = MH;
const dtCtx = dt.getContext('2d'); const dtImg = dtCtx.createImageData(MW, MH);

// Portada: en vertical ocupa todo el cuadro; en horizontal queda entera y centrada, con el grano a los lados
function fitRect(img) {
    const ar = img.naturalWidth / img.naturalHeight;
    if (!HZ) { const s = Math.max(W / img.naturalWidth, H / img.naturalHeight); const w = img.naturalWidth * s; const h = img.naturalHeight * s; return [(W - w) / 2, (H - h) / 2, w, h]; }
    const w = H * ar; return [(W - w) / 2, 0, w, H];
}

const IMGS = []; const LUM = [];
function lumaOf(img) { // luminancia por celda (-1 afuera de la imagen), para el tramo en blanco y negro
    const c = smallCv(); const x = c.getContext('2d', { willReadFrequently: true });
    const [rx, ry, rw, rh] = fitRect(img);
    x.drawImage(img, rx / CELL, ry / CELL, rw / CELL, rh / CELL);
    const px = x.getImageData(0, 0, MW, MH).data; const out = new Float32Array(MW * MH);
    for (let i = 0; i < out.length; i++) out[i] = px[i * 4 + 3] < 128 ? -1 : (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255;
    return out;
}

/**
 * Pinta `img` en `ctx` con una máscara de dither: r(x, y) ∈ [0, 1] por celda.
 * r > bayer + BAND: la celda queda a color · r > bayer: blanco o negro según la luminancia · menos: transparente.
 */
const BAND = 0.16;
function drawRevealed(ctx, img, lum, rFn) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); // lo que no es imagen también se revela (en negro): el orden reemplaza al grano
    const [rx, ry, rw, rh] = fitRect(img);
    ctx.drawImage(img, rx, ry, rw, rh);
    const e = eraseImg.data; const m = monoImg.data;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
        const i = (y * MW + x) * 4; const r = rFn(x * CELL + 2, y * CELL + 2); const b = bayer(x, y);
        const l = Math.max(0, lum[y * MW + x]);
        if (r > b + BAND) { e[i + 3] = 0; m[i + 3] = 0; continue; }
        e[i + 3] = 255;
        if (r > b) { const on = l > bayer(x + 3, y + 5) ? INK : [0, 0, 0]; m[i] = on[0]; m[i + 1] = on[1]; m[i + 2] = on[2]; m[i + 3] = 255; } else m[i + 3] = 0;
    }
    eraseCtx.putImageData(eraseImg, 0, 0); monoCtx.putImageData(monoImg, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(eraseCv, 0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(monoCv, 0, 0, W, H);
}
const drawPlain = (ctx, img) => { ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); const [x, y, w, h] = fitRect(img); ctx.drawImage(img, x, y, w, h); };

/* ───────────────────────── caballo ───────────────────────── */
const HW = HZ ? 700 : 900; const HH = (HW * 450) / 640;
Object.assign(horse.style, { width: `${HW}px`, height: `${HH}px`, top: `${(H - HH) / 2}px`, imageRendering: 'pixelated' });
const hCtx = horse.getContext('2d'); const hImg = hCtx.createImageData(640, 450);
const hOff = document.createElement('canvas'); hOff.width = 640; hOff.height = 450;
const hOffCtx = hOff.getContext('2d', { willReadFrequently: true });
let HORSE_IMG;
function drawHorse(t, xh, dir, reveal) {
    horse.style.display = 'block';
    horse.style.left = `${xh - HW / 2}px`;
    horse.style.transform = `scaleX(${dir})`;
    const fi = Math.floor((t - EM[0]) * 16) % 10;
    hOffCtx.clearRect(0, 0, 640, 450);
    hOffCtx.drawImage(HORSE_IMG, (fi % 5) * 640, Math.floor(fi / 5) * 450, 640, 450, 0, 0, 640, 450);
    const src = hOffCtx.getImageData(0, 0, 640, 450).data; const o = hImg.data;
    for (let y = 0; y < 450; y++) for (let x = 0; x < 640; x++) {
        const i = (y * 640 + x) * 4;
        o[i] = INK[0]; o[i + 1] = INK[1]; o[i + 2] = INK[2]; o[i + 3] = (src[i + 3] / 255) * reveal > bayer(x, y) ? 255 : 0;
    }
    hCtx.putImageData(hImg, 0, 0);
}

// Recorrido del caballo y borde de revelado de cada cruce. Todo en coordenadas "espejadas" (siempre de izquierda a derecha).
const TRAIL = 360; const SKEW = 0.18; const C1 = 0.15 * HW;
const xStart = (k) => (k === 0 ? 0.22 * W : -0.6 * HW);
const xEnd = W + 800;
function crossState(t, k) {
    const [t0, t1] = CROSS[k]; const u = clamp((t - t0) / (t1 - t0));
    const xs = xStart(k);
    const xm = lerp(xs, xEnd, lerp(u, ease(u), 0.5));
    const c = lerp(xs + 300, C1, ease(clamp(u / 0.5)));
    return { xm, edge: xm - c };
}

/* ───────────────────────── rueda ───────────────────────── */
// Misma geometría que src/gl/wheel.js: las cartas siguen el arco de un círculo grande y se inclinan con su ángulo.
const geo = HZ ? { cw: 520, ch: 650, R: W * 0.9, step: 0.33, cy: H * 0.46 } : { cw: W * 0.58, ch: W * 0.58 * 1.25, R: W * 1.1, step: 0.4, cy: H * 0.46 };
const wheelP = (t) => P0 + 3.4 * ease(clamp((t - ROT[0]) / (ROT[1] - ROT[0])));
function updateWheel(t) {
    wheel.style.transform = `scale(${1 + 0.07 * ease(clamp((t - HERO[1]) / 3.6))})`;
    const p = wheelP(t);
    cards.forEach((c, i) => {
        if (t < HERO[0] || t >= DISS[1]) { c.style.display = 'none'; return; }
        const hero = i === P0;
        const e = hero ? 1 : ease(clamp((t - (ARRIVE + 0.14 * Math.abs(i - P0))) / 0.9));
        if (e <= 0) { c.style.display = 'none'; return; }
        const raw = i - p; const d = raw + (1 - e) * Math.sign(raw || 1) * 2.5; const ad = Math.abs(d);
        if (ad > 3) { c.style.display = 'none'; return; }
        const phi = d * geo.step;
        const x = W / 2 + geo.R * Math.sin(phi); const y = geo.cy + geo.R * (1 - Math.cos(phi));
        let w = geo.cw; let h = geo.ch; let tx = x - w / 2; let ty = y - h / 2;
        if (hero && t < HERO[1]) { // de portada entera a carta
            const s = ease(clamp((t - HERO[0]) / (HERO[1] - HERO[0])));
            const [fx, fy, fw, fh] = fitRect(IMGS[P0]); const full = HZ ? [fx, fy, fw, fh] : [0, 0, W, H];
            tx = lerp(full[0], x - w / 2, s); ty = lerp(full[1], y - h / 2, s); w = lerp(full[2], w, s); h = lerp(full[3], h, s);
        }
        c.style.display = 'block';
        c.style.width = `${w}px`; c.style.height = `${h}px`;
        c.style.opacity = e * (1 - clamp(ad - 2));
        c.style.transform = `translate(${tx}px, ${ty}px) rotate(${hero && t < HERO[1] ? 0 : phi}rad)`;
    });
}

/* ───────────────────────── texto en dither ───────────────────────── */
function textMask(el) {
    const off = document.createElement('canvas'); off.width = MW; off.height = MH;
    const c = off.getContext('2d', { willReadFrequently: true });
    const sr = stage.getBoundingClientRect();
    const fs = parseFloat(getComputedStyle(el).fontSize); const r = el.getBoundingClientRect();
    const probe = document.createElement('span'); probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    el.append(probe); const baseY = probe.getBoundingClientRect().top - sr.top; probe.remove();
    c.fillStyle = '#fff'; c.textAlign = 'center';
    c.font = `800 ${fs / CELL}px "Inter Tight"`; c.letterSpacing = `${(-0.045 * fs) / CELL}px`;
    c.fillText(el.textContent, (r.left - sr.left + r.width / 2) / CELL, baseY / CELL);
    const px = c.getImageData(0, 0, MW, MH).data; const m = new Uint8Array(MW * MH);
    for (let i = 0; i < m.length; i++) m[i] = px[i * 4 + 3] > 120 ? 1 : 0;
    return m;
}
let titleMask;

/* ───────────────────────── sonido ───────────────────────── */
export const AUDIO = [];
const au = (name, t, p = 1, arg) => AUDIO.push({ name, t, p, arg });
{
    let t = 0.35; let step = 0.5; let n = 0; // chasquidos de grano, cada vez más seguidos
    while (t < 2.5) { au('hover', t, 0.8 + hash(n) * 0.7); t += step * (0.7 + hash(n, 1) * 0.6); step = Math.max(0.1, step * 0.82); n++; }
}
au('gallop', EM[0] + 0.05);
CROSS.forEach(([t0, t1]) => au('gallopRun', t0, 1, t1 - t0));
au('lbOpen', HERO[0] + 0.05);
for (let i = 0; i < PW.length; i++) { const k = Math.abs(i - P0); if (k > 0 && k <= 3) au('tick', ARRIVE + 0.14 * k + 0.45, 0.9 + k * 0.06); }
for (let t = ROT[0], prev = Math.floor(wheelP(ROT[0]) + 0.5); t < ROT[1]; t += 1 / 300) { const cur = Math.floor(wheelP(t) + 0.5); if (cur !== prev) { au('tick', t, 1 + (cur % 2 ? 0.05 : -0.04)); prev = cur; } }
au('wipeIn', DISS[0] + 0.05); au('wipeOut', TITLE[0]);
au('open', CRISP, 0.7); au('kick', CRISP + 0.05);
au('tick', 18.7, 1.2); for (let i = 1; i < 9; i++) au('hover', 18.7 + i * 0.07, 1 + i * 0.03);

/* ───────────────────────── render ───────────────────────── */
let baseKey = ''; let lastTopClear = false;
function update(t) {
    // grano de fondo: denso y claro al principio y al final, casi invisible en el medio
    let a = 0.16; let dens = 0.08;
    if (t < EM[1]) { const k = ease(clamp(t / 2.0)); dens = 0.1 + 0.24 * k * (1 - 0.8 * ease(clamp((t - EM[0]) / 1.0))) + 0.04 * Math.sin(t * 2.4); a = lerp(0.35, 0.95, k) * lerp(1, 0.25, ease(clamp((t - EM[0]) / 1.0))); }
    else if (t >= DISS[0] + 0.4) { const up = ease(clamp((t - (DISS[0] + 0.4)) / 1.4)); const down = ease(clamp((t - CRISP) / 1.2)); dens = lerp(0.08, 0.3, up) * lerp(1, 0.3, down) + 0.03 * Math.sin(t * 2.4) * up; a = lerp(0.16, 0.9, up) * lerp(1, 0.25, down); }
    ditherField(field, `rgba(${INK[0]},${INK[1]},${INK[2]},${clamp(a)})`, t, 8, dens);

    // portadas y caballo
    let hx = null; let dir = 1; let reveal = 1;
    if (t >= EM[0] && t < CROSS[0][0]) { hx = xStart(0); reveal = ease(clamp((t - EM[0]) / (EM[1] - EM[0]) / 0.9)); }
    let activeK = -1; let staticK = -1;
    CROSS.forEach(([t0, t1], k) => { if (t >= t0 && t < t1 + 0.2) activeK = k; else if (t >= t1 + 0.2) staticK = k; });
    base.style.display = top.style.display = t < HERO[1] && t >= CROSS[0][0] ? 'block' : 'none';
    base.style.opacity = top.style.opacity = 1 - ease(clamp((t - HERO[0]) / (HERO[1] - HERO[0])));
    if (activeK >= 0) {
        const [, , d] = CROSS[activeK]; const { xm, edge } = crossState(t, activeK);
        dir = d; hx = d > 0 ? xm : W - xm;
        const key = `b${activeK - 1}`;
        if (baseKey !== key) { if (activeK > 0) drawPlain(baseCtx, IMGS[COV[activeK - 1]]); else baseCtx.clearRect(0, 0, W, H); baseKey = key; }
        drawRevealed(topCtx, IMGS[COV[activeK]], LUM[activeK], (x, y) => clamp((edge - (d > 0 ? x : W - x) - (y - H / 2) * SKEW) / TRAIL));
        lastTopClear = false;
    } else if (staticK >= 0 && t < HERO[1]) {
        const key = `s${staticK}`;
        if (baseKey !== key) { drawPlain(baseCtx, IMGS[COV[staticK]]); baseKey = key; }
        if (!lastTopClear) { topCtx.clearRect(0, 0, W, H); lastTopClear = true; }
    }
    if (hx !== null) drawHorse(t, hx, dir, reveal); else horse.style.display = 'none';

    updateWheel(t);

    // disolución de la rueda: desde los bordes hacia el centro, cada celda pasa por blanco y negro y se apaga
    const di = disImg.data;
    if (t >= DISS[0] && t < DISS[1] + 0.9) {
        const u = (t - DISS[0]) / (DISS[1] - DISS[0]); const f = Math.floor(t * 15);
        const back = t > DISS[1]; // pasada la disolución, el negro se retira parejo y deja ver el grano
        for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
            const i = (y * MW + x) * 4; const dn = clamp(Math.hypot((x / MW - 0.5), (y / MH - 0.5) * (H / W)) * (HZ ? 1.15 : 1.6));
            const amt = back ? 2 * (1 - (t - DISS[1]) / 0.9) : u * 1.8 - (1 - dn) * 0.8; const b = bayer(x, y);
            if (amt > b + 0.1) { di[i] = di[i + 1] = di[i + 2] = 0; di[i + 3] = 255; }
            else if (amt > b) { const v = hash(x, y, f) > 0.5 ? 255 : 0; di[i] = di[i + 1] = di[i + 2] = v; di[i + 3] = 255; }
            else di[i + 3] = 0;
        }
        disCtx.putImageData(disImg, 0, 0); dissolve.style.display = 'block';
    } else dissolve.style.display = 'none';

    // título
    const crisp = t >= CRISP;
    titleEl.style.visibility = crisp ? 'visible' : 'hidden';
    dt.style.display = t >= TITLE[0] && !crisp ? 'block' : 'none';
    if (t >= TITLE[0] && !crisp) {
        const p = ease(clamp((t - TITLE[0]) / (TITLE[1] - TITLE[0]))); const d = dtImg.data;
        for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
            const i = (y * MW + x) * 4; d[i] = INK[0]; d[i + 1] = INK[1]; d[i + 2] = INK[2]; d[i + 3] = titleMask[y * MW + x] && p > bayer(x, y) ? 255 : 0;
        }
        dtCtx.putImageData(dtImg, 0, 0);
    }
    const n = Math.floor(clamp((t - 18.7) / 0.07, 0, 9));
    onlineTxt.textContent = 'YA ONLINE'.slice(0, n);
    cursor.style.visibility = t >= 18.65 && (n < 9 || Math.floor((t - 18.7) / 0.5) % 2 === 0) ? 'visible' : 'hidden';
}

export function render(t) { update(t); }
window.render = render;
window.AUDIO = AUDIO;
window.DURATION = DURATION;

/* ───────────────────────── arranque ───────────────────────── */
async function boot() {
    await Promise.all(['800 100px "Inter Tight"', '600 30px "Roboto Mono"'].map((f) => document.fonts.load(f)));
    await document.fonts.ready;
    HORSE_IMG = await loadImg('/images/transition/caballo.webp');
    await Promise.all(PW.map(async (p, i) => { IMGS[i] = await loadImg(p.cover.src); cards[i].style.backgroundImage = `url(${p.cover.src})`; }));
    COV.forEach((i, k) => { LUM[k] = lumaOf(IMGS[i]); });

    // el título se mide una vez (ancho y línea base reales) y se guarda su máscara
    const w100 = (() => { const s = document.createElement('span'); s.style.cssText = 'position:absolute;visibility:hidden;font:800 100px var(--display);letter-spacing:-.045em;white-space:nowrap'; s.textContent = '(MZZ.DSG)'; stage.append(s); const w = s.getBoundingClientRect().width; s.remove(); return w; })();
    titleEl.style.fontSize = `${(100 * W * (HZ ? 0.74 : 0.93)) / w100}px`;
    titleEl.style.visibility = 'hidden'; titleEl.style.display = 'block';
    titleMask = textMask(titleEl);

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
