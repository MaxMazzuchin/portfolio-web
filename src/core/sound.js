/**
 * Efectos de sonido sutiles, sintetizados con Web Audio (sin archivos).
 *   Dither 1-bit: tick de la rueda, hover, click, abrir.  Glitch: cortina de transición (entra / se disuelve).
 * Apagado por defecto; el AudioContext recién se crea cuando suena el primer efecto, así que nada corre mientras está apagado.
 */
const KEY = 'sound';
const VOLUME = 0.35 * 0.22; // casi subliminal
const TOUCH_BOOST = 2.6; // los parlantes de un celular casi no reproducen estos golpes cortos: se compensa
const HOVER_SEL = '.nav-links a, .nav-logo, .theme-toggle, .sfx-toggle, .nav-menu, [data-f], .ci-row, [data-c-open]';

let ctx, master, white, crushed;
let on = false;
let unlocked = false;
const last = {};
const rnd = (a, b) => a + Math.random() * (b - a);

function boot() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    // iOS: con el interruptor de silencio puesto, Web Audio queda mudo; el tipo 'playback' lo ignora (Safari 16.4+).
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* no soportado */ }
    master = ctx.createGain();
    master.gain.value = VOLUME * (matchMedia('(pointer: coarse)').matches ? TOUCH_BOOST : 1);
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ctx.destination);
    const n = ctx.sampleRate;
    white = ctx.createBuffer(1, n, ctx.sampleRate);
    crushed = ctx.createBuffer(1, n, ctx.sampleRate);
    const w = white.getChannelData(0);
    const c = crushed.getChannelData(0);
    let hold = 0;
    let v = 0;
    for (let i = 0; i < n; i++) {
        w[i] = Math.random() * 2 - 1;
        if (hold-- <= 0) { hold = 5; v = Math.random() < 0.5 ? -1 : 1; } // 1 bit con muestreo sostenido
        c[i] = v;
    }
    return true;
}

function gainEnv(t, dur, peak, attack = 0.001) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(master);
    return g;
}

function tone(t, f, dur, { type = 'sine', peak = 0.5, fEnd } = {}) {
    const o = ctx.createOscillator();
    const g = gainEnv(t, dur, peak);
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.02);
}

function noise(t, dur, { buf = white, type = 'bandpass', f = 2000, q = 1, peak = 0.5, attack = 0.0005 } = {}) {
    const s = ctx.createBufferSource();
    const fl = ctx.createBiquadFilter();
    const g = gainEnv(t, dur, peak, attack);
    s.buffer = buf;
    s.loop = true;
    fl.type = type;
    fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t);
    s.connect(fl);
    fl.connect(g);
    s.start(t, rnd(0, 0.8));
    s.stop(t + dur + 0.02);
}

/** Ruido con la compuerta abriendo y cerrando en escalones; el filtro barre de f a fEnd. */
function gated(t, dur, levels, { f, fEnd, q = 0.8, peak = 0.5 }) {
    const s = ctx.createBufferSource();
    const fl = ctx.createBiquadFilter();
    const g = ctx.createGain();
    s.buffer = white;
    s.loop = true;
    fl.type = 'bandpass';
    fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t);
    fl.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    const dt = dur / levels.length;
    g.gain.setValueAtTime(0.0001, t);
    levels.forEach((l, i) => g.gain.setValueAtTime(Math.max(0.0001, l * peak), t + i * dt));
    g.gain.setValueAtTime(0.0001, t + dur);
    s.connect(fl);
    fl.connect(g);
    g.connect(master);
    s.start(t, rnd(0, 0.5));
    s.stop(t + dur + 0.02);
}

/** Casco: golpe grave de onda cuadrada (1 bit) más un clack de ruido cuantizado para que se oiga en parlantes chicos. */
function hoof(t, strong, gain) {
    tone(t, strong ? 150 : 125, 0.045, { type: 'square', peak: (strong ? 0.42 : 0.3) * gain, fEnd: 60 });
    noise(t, 0.03, { buf: crushed, f: strong ? 900 : 1300, q: 1.1, peak: (strong ? 0.5 : 0.34) * gain });
}

const stride = (t, gain) => [0, 0.09, 0.18].forEach((b, i) => hoof(t + b, i === 2, gain)); // tres cascos ("ta-ga-DUM")

const SOUNDS = {
    tick: (t, p) => {
        tone(t, 1900 * p, 0.012, { type: 'square', peak: 0.35 });
        noise(t, 0.004, { buf: crushed, type: 'highpass', f: 3000, peak: 0.4 });
    },
    hover: (t, p) => noise(t, 0.003, { buf: crushed, type: 'highpass', f: 5000 * p, peak: 0.22 }),
    click: (t, p) => {
        tone(t, 880 * p, 0.022, { type: 'square', peak: 0.35, fEnd: 520 * p });
        noise(t, 0.006, { buf: crushed, type: 'highpass', f: 2500, peak: 0.4 });
    },
    // Visor de imágenes: dos blips cortos que suben, más chicos que `open`.
    lbOpen: (t, p) => [620, 930].forEach((f, i) => tone(t + i * 0.028, f * p, 0.022, { type: 'square', peak: 0.24 })),
    open: (t, p) => [440, 660, 880, 1320].forEach((f, i) => tone(t + i * 0.034, f * p, 0.03, { type: 'square', peak: 0.3 })),
    // Galope: tres cascos y una pausa ("ta-ga-DUM"), el ciclo del caballo dura 10/16 s; la segunda zancada ya se va apagando.
    gallop: (t) => [0, 0.625].forEach((d, s) => stride(t + d, s ? 0.55 : 1)),
    // Huevo de pascua: el caballo cruza la pantalla; `secs` es lo que dura el cruce (una zancada cada 0,625 s).
    gallopRun: (t, p, secs = 3) => { for (let k = 0; k * 0.625 < secs; k++) stride(t + k * 0.625, 0.8); },
    // Base rítmica del video showcase (scripts/showcase): el casco fuerte suelto. No lo usa el sitio.
    kick: (t) => hoof(t, true, 1.2),
    // Minijuego del 404.
    jump: (t, p) => tone(t, 480 * p, 0.06, { type: 'square', peak: 0.28, fEnd: 900 * p }),
    crash: (t) => { noise(t, 0.2, { buf: crushed, f: 320, q: 0.8, peak: 0.6 }); tone(t, 200, 0.22, { type: 'square', peak: 0.4, fEnd: 50 }); },
    wipeIn: (t) => gated(t, 0.55, Array.from({ length: 22 }, (_, i) => (Math.random() < 0.25 + 0.7 * (i / 22) ? rnd(0.4, 1) : 0)), { f: 900, fEnd: 6000, peak: 0.55 }),
    wipeOut: (t) => gated(t, 0.7, Array.from({ length: 26 }, (_, i) => (Math.random() < 0.95 - 0.9 * (i / 26) ? rnd(0.3, 1) : 0)), { f: 6000, fEnd: 900, peak: 0.5 }),
};
const MIN_GAP = { tick: 0.03, hover: 0.05 }; // la rueda girando rápido no satura

const fine = matchMedia('(hover: hover) and (pointer: fine)');

export const sound = {
    get enabled() { return on; },

    /** p = variación de tono (1 = sin cambio). */
    play(name, p = 1, arg) {
        // Grabación del video showcase (scripts/showcase): anota cada efecto con el reloj de la página, suene o no.
        if (window.__sfxLog) window.__sfxLog.push({ name, p, arg, t: performance.now() / 1000 });
        if (!on || !boot()) return;
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        const now = ctx.currentTime;
        if (MIN_GAP[name] && last[name] && now - last[name] < MIN_GAP[name]) return;
        last[name] = now;
        SOUNDS[name](now + 0.005, p, arg);
    },

    set(v) {
        on = v;
        try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* storage unavailable */ }
        paint();
        if (v) this.play('click');
    },
};

/**
 * Renderiza efectos a un buffer con las mismas recetas del sitio (para el audio del video showcase).
 * cues = [{ name, t, p, arg }] (t en segundos). Devuelve un AudioBuffer estéreo; no toca el contexto en vivo.
 */
export async function renderCues(cues, secs, { sampleRate = 48000, gain = VOLUME } = {}) {
    const live = { ctx, master, white, crushed };
    ctx = new OfflineAudioContext(2, Math.ceil(secs * sampleRate), sampleRate);
    master = ctx.createGain();
    master.gain.value = gain;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ctx.destination);
    white = ctx.createBuffer(1, sampleRate, sampleRate);
    crushed = ctx.createBuffer(1, sampleRate, sampleRate);
    const w = white.getChannelData(0);
    const c = crushed.getChannelData(0);
    let hold = 0;
    let v = 0;
    for (let i = 0; i < sampleRate; i++) {
        w[i] = Math.random() * 2 - 1;
        if (hold-- <= 0) { hold = 5; v = Math.random() < 0.5 ? -1 : 1; }
        c[i] = v;
    }
    for (const q of cues) SOUNDS[q.name]?.(q.t, q.p ?? 1, q.arg);
    try { return await ctx.startRendering(); } finally { ({ ctx, master, white, crushed } = live); }
}

function paint() {
    document.querySelectorAll('.sfx-toggle').forEach((b) => {
        b.setAttribute('aria-pressed', String(on));
    });
}

export function initSound() {
    try { on = localStorage.getItem(KEY) === '1'; } catch { on = false; }
    paint();

    document.querySelector('.sfx-toggle')?.addEventListener('click', () => sound.set(!on));

    // Un contexto de audio queda suspendido hasta un gesto del usuario. Si el sonido ya estaba prendido de una visita anterior, se crea
    // y se reanuda con el primer toque. iOS solo cuenta touchend / click / keydown (no pointerdown ni touchmove), así que se escuchan todos.
    const wake = () => {
        if (!on || !boot()) return;
        if (ctx.state !== 'running') ctx.resume().catch(() => {});
        if (!unlocked) { // un buffer vacío "abre" la salida de audio en iOS
            unlocked = true;
            const src = ctx.createBufferSource();
            src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
            src.connect(ctx.destination);
            src.start(0);
        }
    };
    ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach((ev) => addEventListener(ev, wake, { passive: true }));

    document.addEventListener('pointerover', (e) => {
        if (!on || !fine.matches) return;
        const el = e.target.closest?.(HOVER_SEL);
        if (el && !el.contains(e.relatedTarget)) sound.play('hover', rnd(0.94, 1.06));
    }, { passive: true });

    document.addEventListener('click', (e) => {
        if (!on || e.target.closest('.sfx-toggle')) return; // el toggle ya suena solo al prenderse
        if (e.target.closest(HOVER_SEL)) sound.play('click', rnd(0.97, 1.03));
    });
}
