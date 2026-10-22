// Markup de la página de un proyecto, sin DOM ni GSAP. Lo usan el build (vite.config.js), que lo deja dentro del HTML de cada
// /proyecto/<slug>/ (buscadores, vistas previas, sin JS), y views/project.js en el navegador (en dev, o con los links viejos ?p=).
import { projects, known, projectUrl } from '../data/work.js';
import { srcsetOf } from '../core/srcset.js';

// Ancho real de una pieza en pantalla, para que el navegador elija la variante justa (ver core/srcset.js).
// La galería ocupa ~70 % del ancho junto a la columna fija (y 100 % en mobile); en la grilla, la mitad.
const SIZES_WIDE = '(max-width: 800px) calc(100vw - 32px), calc(70vw - 80px)';
const SIZES_GRID = '(max-width: 800px) calc(100vw - 32px), calc(35vw - 40px)';
const SIZES_GRID_2 = '(max-width: 800px) calc(50vw - 21px), calc(35vw - 40px)';

// Series largas: en mobile la grilla sigue en dos columnas (en los demás proyectos pasa a una).
const TWO_COLS_MOBILE = new Set(['exp-grafica', '100-posters']);
// Proyectos cuyos videos ocupan todo el ancho de la columna, como las imágenes (el resto se achica para entrar enteros en la altura de la pantalla).
const FULL_WIDTH_VIDEOS = new Set(['curu']);

// Piezas de los manuales armados en código (sus loaders están en `manuals`, views/project.js). Los slugs también están en
// MANUALS (data/work.js): mantener los tres en sincronía.
export const MANUAL_PIECES = { 'contigiani-brinon': 9, nyro: 8, 'blue-marketing': 7, outframe: 7, d2x: 6 };

const pad = (n) => String(n).padStart(2, '0');
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Todas las imágenes del proyecto en el orden de la página: es lo que recorre el visor. */
export function galleryShots(p) {
    if (p.manual) return [];
    if (p.layout === 'equal') {
        // Sin portada grande: la portada se suma a la grilla salvo que ya sea una de sus piezas. Un proyecto solo de videos no tiene imágenes.
        const imgs = p.sections.filter((s) => s.kind !== 'videos').flatMap((s) => s.images);
        return !imgs.length ? [] : imgs.some((x) => x.src === p.cover.src) ? imgs : [p.cover, ...imgs];
    }
    return [p.cover, ...p.sections.filter((s) => s.kind !== 'videos').flatMap((s) => s.images)];
}

/**
 * Contenido de <main data-page="project"> para el proyecto `p`. La galería sigue la estructura del V2:
 * portada → columna única (column) → grilla de dos columnas (grid) → videos, lo que tenga cada proyecto.
 * Si el proyecto tiene caso (data/cases.js), el contexto va de bajada en la columna lateral y el resultado después de la portada.
 */
export function renderProject(p) {
    const c = p.case;
    const at = projects.indexOf(p);
    const next = projects[(at + 1) % projects.length];
    const prev = projects[(at - 1 + projects.length) % projects.length];
    const shots = galleryShots(p);

    let n = 0;
    const fig = (s, cls, sizes = SIZES_WIDE) => {
        const i = n++;
        // La primera pieza es lo primero que se ve: se carga ya; el resto espera a estar cerca.
        const load = i === 0 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
        const set = srcsetOf(s);
        return `<figure class="${cls}" style="--ar:${s.w}/${s.h}" data-cursor-item data-cursor="Ampliar" data-open="${i}" tabindex="0" role="button" aria-label="Ampliar ${esc(p.title)} — ${i + 1}">
            <img data-gl-img src="${s.src}"${set ? ` srcset="${set}" sizes="${sizes}"` : ''} alt="" width="${s.w}" height="${s.h}" ${load} decoding="async">
        </figure>`;
    };

    // Un video es una ruta (V2) o { src, w, h }: con w/h la caja respeta la proporción real (vertical o ancha).
    // Todos van como loop mudo y sin controles (pedido del usuario); el IntersectionObserver de project.js les pone el src cuando se acercan.
    const videos = (sec) => `<div class="g-videos${FULL_WIDTH_VIDEOS.has(p.slug) ? ' g-videos--fill' : ''}">${sec.videos.map((v, i) => {
        const src = typeof v === 'string' ? v : v.src;
        const ar = typeof v === 'string' ? '' : ` style="--ar:${v.w}/${v.h};--r:${(v.w / v.h).toFixed(4)}"`;
        // video-N.mp4 tiene su fotograma de portada al lado (video-N-poster.webp, ver scripts/shrink-videos.mjs): la caja no queda negra mientras baja.
        const poster = src.replace(/\.mp4$/, '-poster.webp');
        return `<video class="g-video"${ar} data-src="${src}" poster="${poster}" playsinline loop muted preload="none" aria-label="${esc(p.title)} — video ${i + 1}"></video>`;
    }).join('')}</div>`;

    let cover = '';
    let sections;
    if (p.manual) {
        // La galería la arma el manual en el navegador (views/project.js, cuando termina de cargar); acá queda el lugar reservado.
        sections = '<div class="cb-slot" data-manual></div>';
    } else if (p.layout === 'equal') {
        sections = (shots.length ? `<div class="g-grid g-equal">${shots.map((x) => fig(x, 'g-item', SIZES_GRID)).join('')}</div>` : '')
            + p.sections.filter((sec) => sec.kind === 'videos').map(videos).join('');
    } else {
        cover = fig(p.cover, 'g-cover');
        sections = p.sections.map((sec) => {
            if (sec.kind === 'videos') return videos(sec);
            const two = sec.kind === 'grid' && TWO_COLS_MOBILE.has(p.slug);
            return `<div class="${sec.kind === 'grid' ? `g-grid${two ? ' g-two' : ''}` : 'g-column'}">${sec.images.map((x) => fig(x, 'g-item', sec.kind === 'grid' ? (two ? SIZES_GRID_2 : SIZES_GRID) : SIZES_WIDE)).join('')}</div>`;
        }).join('');
    }

    const pieces = p.manual ? MANUAL_PIECES[p.slug] ?? 0 : shots.length + p.sections.filter((s) => s.kind === 'videos').reduce((a, s) => a + s.videos.length, 0);

    // Bajada: el contexto del caso si lo hay, si no la descripción del proyecto. Oculta mientras sea un borrador.
    const lead = c && known(c.context) ? c.context : p.description;
    const result = c && known(c.result) ? `
        <article class="p-chapter" data-reveal>
            <p class="mono p-chapter-n">Resultado</p>
            <p class="p-chapter-p">${esc(c.result)}</p>
        </article>` : '';

    // Datos de la columna lateral: solo lo confirmado.
    const facts = [
        ['Proyecto', p.index],
        c && known(c.year) && ['Año', c.year],
        c && known(c.client) && ['Cliente', c.client],
        c && known(c.role) && ['Rol', c.role],
        c && known(c.tools) && ['Herramientas', c.tools.filter(known).join(', ')],
        ['Tipo', p.type],
        ['Piezas', pad(pieces)],
    ].filter(Boolean);

    return `
        <div class="p-layout" data-project="${p.slug}">
            <aside class="p-side">
                <p class="mono p-meta"><span><span class="num">${p.index}</span> / ${pad(projects.length)}</span><span>${esc(p.type)}</span></p>
                <h1 class="p-title" style="--fit:${Math.min(1, 10.5 / Math.max(...p.title.split(/\s+/).map((w) => w.length))).toFixed(3)}">${esc(p.title)}</h1>
                <div class="dbar" data-dbar></div>
                ${known(lead) ? `<p class="p-desc" data-reveal>${esc(lead)}</p>` : ''}
                <dl class="p-facts mono">
                    ${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}
                </dl>
                <nav class="p-pager mono" aria-label="Otros proyectos">
                    <a href="${projectUrl(prev.slug)}" data-cursor-item data-cursor="Anterior"><span>←</span> <span class="num">${prev.index}</span> <span class="p-pager-name">${esc(prev.title)}</span></a>
                    <a href="${projectUrl(next.slug)}" data-cursor-item data-cursor="Siguiente"><span class="p-pager-name">${esc(next.title)}</span> <span class="num">${next.index}</span> <span>→</span></a>
                </nav>
            </aside>
            <section class="p-gallery">${cover}${p.manual ? sections + result : result + sections}</section>
        </div>
        <a class="p-next" href="${projectUrl(next.slug)}" data-cursor-item data-cursor="Siguiente">
            <span class="mono p-next-label"><span>Siguiente — ${next.index}</span><span>↗</span></span>
            <span class="p-next-title">${esc(next.title)}</span>
        </a>`;
}
