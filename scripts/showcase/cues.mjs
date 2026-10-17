/**
 * Guion del showcase (20 s a 96 BPM: un pulso = 0,625 s = una zancada del galope; 8 compases de 2,5 s).
 * Lo comparten record.mjs (acciones) y audio.mjs (la base rítmica). Para ajustar tiempos se toca solo este archivo.
 */
export const SITE = 'http://localhost:5199';
export const FPS = 30;
export const DURATION = 20;
export const BEAT = 0.625;
export const BAR = BEAT * 4;

const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => k * k * (3 - 2 * k);
/** Camino del mouse por keyframes [t, x, y] con suavizado. */
const path = (keys) => (t) => {
    if (t <= keys[0][0]) return { x: keys[0][1], y: keys[0][2] };
    for (let i = 1; i < keys.length; i++) {
        if (t <= keys[i][0]) {
            const [t0, x0, y0] = keys[i - 1];
            const [t1, x1, y1] = keys[i];
            const k = ease((t - t0) / (t1 - t0));
            return { x: lerp(x0, x1, k), y: lerp(y0, y1, k) };
        }
    }
    return null; // terminado el camino, el mouse queda donde lo dejó el último click
};

export function timeline(api) {
    const D = !api.mobile;
    const q = [];
    const at = (t, run) => q.push({ t, run });

    // Escritorio: el mouse barre el home (el fondo dither reacciona) y va al "M/Z" para los 5 clicks del huevo de pascua.
    api.mouseAt = path([[0, 300, 700], [0.9, 1500, 300], [1.7, 1000, 800], [2.0, 1870, 1000]]);

    // Compás 2: 5 clicks en corcheas sobre "M/Z" → cruza el caballo.
    for (let k = 0; k < 5; k++) at(2.0 + k * BEAT / 2, () => api.click(D ? '.home-init' : '.nav-logo'));
    // Compás 3: a Trabajos (cortina con caballo) y aparece la rueda.
    at(5.65, () => (D ? api.click('[data-nav="work"]') : api.nav('/trabajo.html'))); // en mobile el menú está plegado
    // Compás 4: la rueda gira rápido y frena; click en "ver proyecto".
    if (D) {
        for (let f = 0; f < 36; f++) at(7.45 + f / 30, () => api.wheel(f < 14 ? 46 : Math.max(5, 46 - (f - 14) * 2)));
    } else {
        for (let f = 0; f < 36; f++) at(7.45 + f / 30, () => api.wheel(f < 14 ? 40 : Math.max(4, 40 - (f - 14) * 1.7)));
    }
    at(9.3, () => (D ? api.click('[data-c-open]') : api.nav('/proyecto/curu/')));
    // Compás 5: un proyecto por pulso (entrar a un proyecto es directo, sin cortina).
    // Los manuales en código tardan en armarse: i-life se queda dos pulsos y se mueve con el scroll.
    at(10.0, () => api.nav('/proyecto/outframe/'));
    at(10.0 + BEAT, () => api.nav('/proyecto/blue-marketing/'));
    at(10.0 + 2 * BEAT, () => api.nav('/proyecto/i-life/'));
    for (let f = 0; f < 30; f++) at(11.0 + f / 30, () => api.wheel(D ? 50 : 40));
    // Compás 6: galería → visor; pasan tres imágenes al pulso.
    at(12.5, () => api.nav('/proyecto/sin-datos/'));
    at(13.2, () => api.page.evaluate(() => document.querySelector('[data-open="0"]')?.click())); // sin importar si la pieza está a la vista
    at(13.75, () => api.key('ArrowRight'));
    at(14.375, () => api.key('ArrowRight'));
    at(14.55, () => api.key('Escape'));
    // Compás 7: Biblioteca (cortina) y un toque a la rueda.
    at(15.0, () => (D ? api.click('[data-nav="library"]') : api.nav('/biblioteca.html')));
    if (D) for (let f = 0; f < 20; f++) at(16.9 + f / 30, () => api.wheel(f < 8 ? 120 : 30));
    // Compás 8: de vuelta al home; MZZ.DSG en dither y se corta el pulso.
    at(17.5, () => api.click('.nav-logo'));
    return q;
}

/** Eventos de la base rítmica (los efectos de la página se suman desde sfx.json). t en segundos. */
export function bassCues() {
    const c = [];
    for (let b = 0; b < DURATION / BEAT - 1; b++) {
        const t = b * BEAT;
        if (t < 2.5 - 1e-6 && b % 1) continue; // el compás 1 entra de a poco
        c.push({ name: 'kick', t });
        c.push({ name: 'tick', t: t + BEAT / 2, p: 0.8 });
        if (b % 2) c.push({ name: 'hover', t: t + BEAT * 0.75, p: 1.1 });
    }
    return c;
}

/** Sonidos que en la grabación no se disparan (clicks sintéticos) o que sumamos a mano para marcar los cortes. */
export function extraCues() {
    const c = [];
    for (let k = 0; k < 5; k++) c.push({ name: 'click', t: 2.0 + k * BEAT / 2, p: 1 + k * 0.06 });
    [5.65, 9.3, 15.0, 17.5].forEach((t) => c.push({ name: 'click', t }));
    c.push({ name: 'open', t: 9.3 });
    [10.0, 10.0 + BEAT, 10.0 + 2 * BEAT, 12.5].forEach((t) => c.push({ name: 'open', t, p: 1.2 }));
    c.push({ name: 'open', t: 19.375, p: 0.8 }, { name: 'kick', t: 19.375 });
    return c;
}
