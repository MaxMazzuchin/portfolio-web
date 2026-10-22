import { projects, bySlug, projectUrl } from '../data/work.js';
import { accentOf } from '../data/accents.js';
import { openLightbox } from '../core/lightbox.js';
import { setAccent } from '../core/accent.js';
import { renderProject, galleryShots } from './project-html.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Proyectos cuya galería es un manual armado en código (HTML/SVG animado) en lugar de imágenes. Se cargan bajo demanda.
// Los slugs también están en MANUALS (data/work.js) y MANUAL_PIECES (project-html.js): mantener los tres en sincronía.
const manuals = {
    'contigiani-brinon': { load: () => import('../brand/contigiani.js') },
    nyro: { load: () => import('../brand/nyro.js') },
    'blue-marketing': { load: () => import('../brand/blue.js') },
    outframe: { load: () => import('../brand/outframe.js') },
    d2x: { load: () => import('../brand/d2x.js') },
};

/**
 * Engancha la página del proyecto indicado por la URL (/proyecto/<slug>/ o ?p=<slug>). El markup sale de renderProject
 * (views/project-html.js): en producción ya viene dentro del HTML (pre-renderizado en el build) y acá solo se enganchan
 * eventos; en dev, o con los links viejos ?p=, se arma en el navegador.
 */
export function mountProject(view) {
    // El slug viene de /proyecto/<slug>/. Los links viejos (/proyecto.html?p=<slug>, o /proyecto/?p=<slug> si el hosting reescribe
    // la ruta) se leen igual y la barra de direcciones pasa a la URL nueva.
    const query = new URLSearchParams(location.search);
    const slug = location.pathname.match(/^\/proyecto\/([\w-]+)/)?.[1] || query.get('p');
    const p = bySlug(slug) || projects[0];
    // Solo se limpia `p`: el resto del query (por ejemplo ?cbt= en dev, que congela las animaciones de los manuales) se respeta.
    query.delete('p');
    const canonical = projectUrl(p.slug) + (query.size ? `?${query}` : '');
    if (location.pathname + location.search !== canonical) history.replaceState(history.state, '', canonical);

    // Todas las imágenes en el orden de la página: es lo que recorre el visor.
    const shots = galleryShots(p);
    if (!view.querySelector(`.p-layout[data-project="${p.slug}"]`)) view.innerHTML = renderProject(p);
    const manual = manuals[p.slug];

    document.title = `${p.title} — ${p.type} | Máximo Mazzuchin`;
    setAccent(accentOf(p.slug));

    let gone = false;
    let manualCleanup = null;
    const slot = view.querySelector('[data-manual]');
    if (slot) {
        manual.load().then(async (mod) => {
            if (gone) return;
            slot.outerHTML = mod.manualHTML();
            manualCleanup = await mod.mountManual(view.querySelector('.p-gallery'));
            if (gone) manualCleanup();
            ScrollTrigger.refresh();
        });
    }

    const open = (t) => openLightbox({ images: shots, index: Number(t.dataset.open), title: p.title });
    const onClick = (e) => {
        const t = e.target.closest('[data-open]');
        if (t) open(t);
    };
    // Con teclado (Enter o Espacio) la pieza se abre al SOLTAR la tecla. Si abriera al apretar, el visor le pasa el foco a su botón
    // "Cerrar" y el resto de la pulsación (el keypress de Enter, el soltado de Espacio) cae sobre ese botón y lo cierra al instante.
    // `armed` evita que un soltado suelto (por ejemplo al cerrar el visor con Enter) lo vuelva a abrir.
    let armed = null;
    const onKey = (e) => {
        const t = e.target;
        if (!t.matches?.('[data-open]') || (e.key !== 'Enter' && e.key !== ' ')) return;
        if (e.type === 'keydown') { e.preventDefault(); armed = e.repeat ? null : t; }
        else if (armed === t) { armed = null; open(t); }
    };
    view.addEventListener('click', onClick);
    view.addEventListener('keydown', onKey);
    view.addEventListener('keyup', onKey);

    // The dither rule in the side column doubles as a scroll progress bar (--p goes 0 → 1 down the page).
    const side = view.querySelector('.p-side');
    const onScroll = () => {
        const max = document.documentElement.scrollHeight - innerHeight;
        side.style.setProperty('--p', max > 0 ? Math.min(1, Math.max(0, scrollY / max)).toFixed(4) : '0');
    };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    onScroll();

    // GRACIAS: la portada (Messi) cae como un sello: llega desde arriba, se pasa un poco y se asienta.
    // Solo escala y se desplaza: las imágenes GL siguen el rectángulo del elemento y no copian una rotación.
    const stamp = p.slug === 'gracias' && !matchMedia('(prefers-reduced-motion: reduce)').matches ? view.querySelector('.g-cover') : null;
    if (stamp) gsap.fromTo(stamp, { y: -70, scale: 1.14, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.9, ease: 'back.out(2.4)', delay: 0.35, clearProps: 'transform,opacity' });

    // Videos: only the ones near the viewport hold a src, so browsing never downloads them all.
    const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
            const v = e.target;
            if (e.isIntersecting) {
                if (!v.getAttribute('src')) { v.src = v.dataset.src; v.play?.().catch(() => {}); }
            } else if (v.getAttribute('src')) {
                v.pause();
                v.removeAttribute('src');
                v.load();
            }
        }
    }, { rootMargin: '300px 0px' });
    view.querySelectorAll('video[data-src]').forEach((v) => io.observe(v));

    return () => {
        gone = true;
        manualCleanup?.();
        view.removeEventListener('click', onClick);
        view.removeEventListener('keydown', onKey);
        view.removeEventListener('keyup', onKey);
        removeEventListener('scroll', onScroll);
        removeEventListener('resize', onScroll);
        io.disconnect();
        if (stamp) gsap.killTweensOf(stamp);
    };
}
