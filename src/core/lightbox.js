import gsap from 'gsap';
import { scroll } from './scroll.js';
import { srcsetOf } from './srcset.js';
import { sound } from './sound.js';

const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/**
 * Full-screen image viewer, one image at a time.
 *  - Desktop: ← / → (or the side buttons, wheel, or a horizontal swipe) move between pieces, click toggles a 2.4x zoom that
 *    pans with the pointer, Esc closes.
 *  - Mobile / touch: arrows under the image, a swipe in any direction (left / up = next, right / down = previous) or a tap
 *    moves between pieces. No zoom: the variant that fits the screen is enough.
 */
export function openLightbox({ images, index = 0, title = '' }) {
    const opener = document.activeElement;
    const mobile = matchMedia('(max-width: 800px), (pointer: coarse)').matches;
    const N = images.length;
    let i = Math.min(Math.max(index, 0), N - 1);

    const root = document.createElement('div');
    root.className = `lb lb--single${mobile ? ' lb--touch' : ''}`;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', `Visor de imágenes — ${title}`);
    root.innerHTML = `
        <div class="lb-top mono">
            <span class="lb-title">${esc(title)}</span>
            <span class="lb-count"><b data-lb-n>${pad(i + 1)}</b> / ${pad(N)}</span>
            <button class="lb-close" type="button" aria-label="Cerrar visor">Cerrar ✕</button>
        </div>
        <div class="lb-stage"><img class="lb-img" alt=""></div>
        <button class="lb-nav lb-prev mono" type="button" aria-label="Anterior">←</button>
        <button class="lb-nav lb-next mono" type="button" aria-label="Siguiente">→</button>
        <p class="lb-hint mono">← → navegar · click para zoom · esc cerrar</p>
    `;
    document.body.appendChild(root);

    // lock page scroll
    scroll.stop();
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    const nEl = root.querySelector('[data-lb-n]');
    const closeBtn = root.querySelector('.lb-close');
    const cleanups = [];

    const img = root.querySelector('.lb-img');
    const stage = root.querySelector('.lb-stage');
    let zoomed = false;
    let busy = false;

    const preload = (k) => { const m = new Image(); m.src = images[(k + N) % N].src; };

    const pan = (e) => {
        const r = stage.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 100;
        const y = ((e.clientY - r.top) / r.height) * 100;
        img.style.transformOrigin = `${x}% ${y}%`;
    };
    const setZoom = (on, e) => {
        if (mobile) return;
        zoomed = on;
        root.classList.toggle('is-zoomed', on);
        if (on && e) pan(e);
        gsap.to(img, { scale: on ? 2.4 : 1, duration: 0.45, ease: 'power3.out' });
    };

    const show = (k, dir = 0) => {
        i = (k + N) % N;
        nEl.textContent = pad(i + 1);
        if (zoomed) setZoom(false);
        img.alt = `${title} — ${i + 1}`;
        // En el celular alcanza con la variante que entra en la pantalla; el original (hasta 2400 px) solo se usa en escritorio, con zoom.
        const set = mobile ? srcsetOf(images[i]) : '';
        if (set) { img.sizes = '100vw'; img.srcset = set; } else { img.removeAttribute('srcset'); img.removeAttribute('sizes'); }
        img.src = images[i].src;
        img.style.transformOrigin = '50% 50%';
        gsap.fromTo(img, { opacity: 0, x: dir * 48 }, { opacity: 1, x: 0, duration: 0.4, ease: 'power3.out' });
        preload(i + 1);
        preload(i - 1);
    };
    const go = (d) => {
        if (busy) return;
        busy = true;
        setTimeout(() => { busy = false; }, 260);
        sound.play('tick', d > 0 ? 1.06 : 0.94);
        show(i + d, d);
    };

    show(i, 0);

    root.querySelector('.lb-prev').addEventListener('click', () => go(-1));
    root.querySelector('.lb-next').addEventListener('click', () => go(1));

    // Swipe en cualquier dirección (izquierda / arriba = siguiente, derecha / abajo = anterior). Un toque corto pasa a la siguiente.
    // `swiped` evita que el click que algunos navegadores disparan al soltar un arrastre cuente como un toque.
    let start = null;
    let swiped = 0;
    stage.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') start = { x: e.clientX, y: e.clientY }; });
    stage.addEventListener('pointerup', (e) => {
        if (!start) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        start = null;
        if (zoomed || Math.max(Math.abs(dx), Math.abs(dy)) < 40) return;
        swiped = performance.now();
        go((Math.abs(dx) >= Math.abs(dy) ? dx : dy) < 0 ? 1 : -1);
    });
    stage.addEventListener('pointercancel', () => { start = null; });

    img.addEventListener('click', (e) => {
        if (performance.now() - swiped < 400) return;
        if (mobile) go(1); else setZoom(!zoomed, e);
    });
    stage.addEventListener('pointermove', (e) => { if (zoomed) pan(e); });
    stage.addEventListener('click', (e) => {
        if (e.target !== stage || performance.now() - swiped < 400) return;
        if (zoomed) setZoom(false); else go(1);
    });

    // wheel / trackpad moves between pieces when not zoomed
    const onWheel = (e) => {
        if (zoomed) return;
        e.preventDefault();
        if (Math.abs(e.deltaY) + Math.abs(e.deltaX) > 24) go((e.deltaY || e.deltaX) > 0 ? 1 : -1);
    };
    root.addEventListener('wheel', onWheel, { passive: false });

    const onKey = (e) => {
        if (e.key === 'ArrowRight') go(1);
        else if (e.key === 'ArrowLeft') go(-1);
        else if (e.key === '+' || e.key === '=') setZoom(true);
        else if (e.key === '-') setZoom(false);
    };
    document.addEventListener('keydown', onKey);
    cleanups.push(() => document.removeEventListener('keydown', onKey));

    /* ---------------- close ---------------- */
    let closed = false;
    const close = () => {
        if (closed) return;
        closed = true;
        cleanups.forEach((fn) => fn());
        document.removeEventListener('keydown', onEsc);
        gsap.to(root, {
            opacity: 0, duration: 0.25, ease: 'power2.in',
            onComplete: () => {
                root.remove();
                document.documentElement.style.overflow = prevOverflow;
                scroll.start();
                opener?.focus?.({ preventScroll: true });
            },
        });
    };
    // Escape cierra; Tab y Shift+Tab giran entre los botones del visor, el foco no se escapa a la página de atrás.
    const onEsc = (e) => {
        if (e.key === 'Escape') { close(); return; }
        if (e.key !== 'Tab') return;
        const f = [...root.querySelectorAll('button')];
        const at = f.indexOf(document.activeElement);
        e.preventDefault();
        f[at < 0 ? (e.shiftKey ? f.length - 1 : 0) : (at + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    };
    document.addEventListener('keydown', onEsc);
    closeBtn.addEventListener('click', close);

    sound.play('lbOpen');
    gsap.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
    closeBtn.focus({ preventScroll: true });
    return close;
}
