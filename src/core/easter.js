import { gl } from '../gl/index.js';

/**
 * Huevos de pascua.
 *  - 5 clicks seguidos en el logo (o en el "M/Z" del home): el caballo de la transición cruza la pantalla.
 *  - Mensaje en la consola del navegador, para quien mira el código.
 *  - El minijuego del 404 vive en views/nf-game.js.
 */
export function initEasterEggs() {
    let n = 0;
    let last = 0;
    document.addEventListener('click', (e) => {
        if (!e.target.closest?.('.nav-logo, .home-init')) return;
        const now = performance.now();
        n = now - last < 1200 ? n + 1 : 1; // los clicks tienen que ser seguidos: pasado 1,2 s sin tocar se empieza de nuevo
        last = now;
        if (n >= 5) { n = 0; gl.horseRun(); }
    });

    try {
        console.log(
            '%cMZZ.DSG%c  Máximo Mazzuchin · diseñador gráfico · Córdoba, Argentina',
            'font: 700 26px/1.4 "Inter Tight", Helvetica, Arial, sans-serif; letter-spacing: -0.02em;',
            'font: 12px/1.4 ui-monospace, Menlo, Consolas, monospace; color: #8a8a84;',
        );
        console.log('🐎 ¿Mirando el código? Hablemos: mazzuchinmaximo@gmail.com\n   Pista: tocá el logo cinco veces seguidas.');
    } catch { /* sin consola */ }
}
