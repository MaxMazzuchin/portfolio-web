import './styles/tokens.css';
import './styles/base.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { scroll, reduced } from './core/scroll.js';
import { gl } from './gl/index.js';
import { initTheme } from './core/theme.js';
import { initCursor } from './core/cursor.js';
import { initSound } from './core/sound.js';
import { initEasterEggs } from './core/easter.js';
import { initRouter } from './core/router.js';
import { mountDbars } from './core/dbar.js';
import { projects } from './data/work.js';
import { library } from './data/library.js';
import { mountHome } from './views/home.js';
import { mountWork, mountLibrary } from './views/collection.js';
import { mountAbout } from './views/about.js';
import { mountProject } from './views/project.js';
import { mountNotFound } from './views/notfound.js';

const views = { home: mountHome, work: mountWork, library: mountLibrary, about: mountAbout, project: mountProject, notfound: mountNotFound };
const navFor = { project: 'work' }; // a project page highlights "Trabajos"
let cleanup = () => {};

/** Fills every [data-count] (nav superscripts show 10, in-page labels show (10)). */
function fillCounts() {
    const n = { work: projects.length, library: library.length };
    document.querySelectorAll('[data-count]').forEach((el) => {
        const v = n[el.dataset.count];
        el.textContent = el.closest('.nav') ? String(v) : `(${v})`;
    });
}

/** Mobile menu: the header button toggles a full-screen link list; following any link closes it. */
function initMenu() {
    const btn = document.querySelector('.nav-menu');
    if (!btn) return;
    const label = btn.querySelector('[data-menu-label]');
    const set = (open) => {
        document.documentElement.classList.toggle('menu-open', open);
        btn.setAttribute('aria-expanded', String(open));
        label.textContent = open ? 'Cerrar' : 'Menú';
    };
    btn.addEventListener('click', () => set(!document.documentElement.classList.contains('menu-open')));
    document.addEventListener('click', (e) => { if (e.target.closest('.nav-links a')) set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
}

function markNav(page) {
    const key = navFor[page] || page;
    document.querySelectorAll('.nav-links a').forEach((a) => {
        if (a.dataset.nav === key) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
    });
}

/** Called on first load and after every route swap. */
async function mount(view) {
    cleanup();
    ScrollTrigger.getAll().forEach((t) => t.kill());

    const page = view.dataset.page;
    document.documentElement.dataset.page = page;
    markNav(page);

    // Giant background letters live under the WebGL canvas, so they are moved out of <main> into <body>.
    document.querySelectorAll('body > .ghost-layer').forEach((g) => g.remove());
    const ghosts = view.querySelectorAll('.ghost');
    if (ghosts.length) {
        const layer = document.createElement('div');
        layer.className = 'ghost-layer';
        layer.setAttribute('aria-hidden', 'true');
        ghosts.forEach((g) => layer.appendChild(g));
        document.body.prepend(layer);
    }
    cleanup = (views[page] || mountHome)(view);
    fillCounts();
    mountDbars(view);

    if (!reduced) {
        view.querySelectorAll('[data-reveal]').forEach((el) => {
            gsap.from(el, { autoAlpha: 0, y: 28, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%' } });
        });
    }
    // Recién ahora se muestra el contenido pre-renderizado (ver base.css): GL ya ocultó las imágenes y GSAP los textos que entran animados.
    document.documentElement.classList.add('is-mounted');

    await gl.build(view);
    ScrollTrigger.refresh();
}

function startClock() {
    const el = document.querySelector('[data-clock]');
    if (!el) return;
    const fmt = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Cordoba' });
    const tick = () => { el.textContent = fmt.format(new Date()); };
    tick();
    setInterval(tick, 20000);
}

async function boot() {
    if (import.meta.env.DEV) {
        window.__gl = gl; // debugging handle, stripped from production builds
        if (new URLSearchParams(location.search).has('horse')) setTimeout(() => gl.cover(), 1500); // ?horse deja la cortina con el caballo puesta
    }
    scroll.init();
    gl.init(document.querySelector('[data-gl-canvas]'));
    initTheme();
    initCursor();
    initSound();
    initEasterEggs();
    initMenu();
    startClock();

    const view = document.querySelector('[data-router-view]');
    await mount(view);
    initRouter({ mount });

    // Opening a URL with a hash (e.g. /sobre-mi.html#contacto) lands on that section.
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView();

    let rt;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => mountDbars(document), 200); });

    gl.enableReveal(true);
}

boot();
